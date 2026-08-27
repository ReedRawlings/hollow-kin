import { describe, expect, it } from 'vitest';
import { Backpack, CreatureInstance, RunState } from '../types';
import { ITEM_LIST } from '../data/items';
import { REWARD_BOON_LIST } from '../data/boons';
import { EVENTS } from '../data/events';
import { createBackpack, add, usedSlots } from './Backpack';
import { effectiveMaxHp } from './Boons';
import {
  EventContext, EventOffer,
  viableEvents, pickEvent, obolCost, prepareEvent,
  diceDonors, diceRecipients,
  resolveMercyWell, resolveBloodBoon, resolveDiceTransfer, resolveTinkersTrade, resolveWardenWager,
} from './Events';

// ---------- fixtures ----------

function creature(instanceId: string, hp = 100, mp = 20): CreatureInstance {
  const stats = { hp, mp, str: 10, def: 10, wis: 10, spd: 10, int: 10 };
  return {
    instanceId,
    speciesId: 'kin_070',
    nickname: null,
    starRating: 0,
    currentLevel: 1,
    levelCap: 5,
    permanentLevel: 1,
    essenceInvested: 0,
    abilities: [],
    traitSlots: [],
    lineage: { parentA: null, parentB: null },
    statBaseline: { ...stats },
    currentStats: stats,
    resistances: [],
    weaknesses: [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
    tactic: 'fight_wisely',
  };
}

function runFor(party: CreatureInstance[], obols = 100): RunState {
  return {
    startFloor: 1,
    currentEncounterIndex: 2,
    encounters: [
      { type: 'combat', floor: 1, index: 0 },
      { type: 'shop', floor: 2, index: 1 },
      { type: 'event', floor: 3, index: 2 },
    ],
    choices: [],
    obols,
    partyHp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.hp])),
    partyMp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.mp])),
    partyKO: Object.fromEntries(party.map(c => [c.instanceId, false])),
    autoCombat: false,
    activeBoons: [],
  };
}

interface CtxOpts {
  obols?: number;
  hp?: Record<string, number>;
  mp?: Record<string, number>;
  ko?: string[];
  backpack?: Backpack;
  party?: CreatureInstance[];
}

/** Three-creature party at full HP/MP with 100 Obols and an empty bag, unless overridden. */
function ctxWith(opts: CtxOpts = {}): EventContext {
  const party = opts.party ?? [creature('a'), creature('b'), creature('c')];
  const run = runFor(party, opts.obols ?? 100);
  Object.assign(run.partyHp, opts.hp ?? {});
  Object.assign(run.partyMp, opts.mp ?? {});
  for (const id of opts.ko ?? []) { run.partyKO[id] = true; run.partyHp[id] = 0; }
  return { run, party, backpack: opts.backpack ?? createBackpack(6, 2) };
}

function fullBag(): Backpack {
  let bag = createBackpack(2, 0);
  bag = add(bag, { kind: 'item', itemId: 'moonwater' })!.bag;
  bag = add(bag, { kind: 'item', itemId: 'moonwater' })!.bag;
  return bag;
}

const always = (value: number) => () => value;
const sequence = (values: number[]) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };
const ids = (ctx: EventContext) => viableEvents(ctx).map(e => e.id);

function snapshot(ctx: EventContext): string {
  return JSON.stringify({ run: ctx.run, party: ctx.party, backpack: ctx.backpack });
}

function offerOf<T extends EventOffer['id']>(id: T, ctx: EventContext, roll = always(0)): Extract<EventOffer, { id: T }> {
  return prepareEvent(id, ctx, roll) as Extract<EventOffer, { id: T }>;
}

// ---------- viability ----------

describe('viability', () => {
  it('always includes the wager', () => {
    expect(ids(ctxWith())).toContain('warden_wager');
    expect(ids(ctxWith({ obols: 0, ko: ['a', 'b', 'c'], backpack: fullBag() }))).toContain('warden_wager');
  });

  it('offers the well only with Obols to pay and someone short of HP or MP', () => {
    expect(ids(ctxWith())).not.toContain('mercy_well');
    expect(ids(ctxWith({ hp: { a: 50 } }))).toContain('mercy_well');
    expect(ids(ctxWith({ mp: { a: 5 } }))).toContain('mercy_well');
    expect(ids(ctxWith({ hp: { a: 50 }, obols: 0 }))).not.toContain('mercy_well');
    // A knocked-out creature short of HP does not count as someone the well can help.
    expect(ids(ctxWith({ ko: ['a'] }))).not.toContain('mercy_well');
  });

  it('offers the blood boon only with a living creature to bleed', () => {
    expect(ids(ctxWith())).toContain('blood_boon');
    expect(ids(ctxWith({ ko: ['a', 'b'] }))).toContain('blood_boon');
    expect(ids(ctxWith({ ko: ['a', 'b', 'c'] }))).not.toContain('blood_boon');
  });

  it('offers the dice only with two living creatures', () => {
    expect(ids(ctxWith())).toContain('dice_transfer');
    expect(ids(ctxWith({ ko: ['a'] }))).toContain('dice_transfer');
    expect(ids(ctxWith({ ko: ['a', 'b'] }))).not.toContain('dice_transfer');
  });

  it('offers the trade only with Obols and a free bag slot', () => {
    expect(ids(ctxWith())).toContain('tinkers_trade');
    expect(ids(ctxWith({ obols: 0 }))).not.toContain('tinkers_trade');
    expect(ids(ctxWith({ backpack: fullBag() }))).not.toContain('tinkers_trade');
  });

  it('draws uniformly from the viable set and never outside it', () => {
    const ctx = ctxWith({ ko: ['a', 'b', 'c'], obols: 0 });
    expect(pickEvent(ctx, always(0))!.id).toBe('warden_wager');
    expect(pickEvent(ctx, always(0.999))!.id).toBe('warden_wager');

    const rich = ctxWith({ hp: { a: 50 } });
    const viable = ids(rich);
    const seen = new Set<string>();
    for (let r = 0; r < 1; r += 0.05) seen.add(pickEvent(rich, always(r))!.id);
    expect([...seen].sort()).toEqual([...viable].sort());
  });
});

// ---------- obol cost ----------

describe('obolCost', () => {
  it('is free at zero and rises with Obols, never exceeding them', () => {
    expect(obolCost(0)).toBe(0);
    expect(obolCost(500)).toBeGreaterThan(obolCost(50));
    for (const n of [1, 7, 50, 999]) {
      expect(obolCost(n)).toBeGreaterThanOrEqual(0);
      expect(obolCost(n)).toBeLessThanOrEqual(n);
      expect(Number.isInteger(obolCost(n))).toBe(true);
    }
  });
});

// ---------- mercy well ----------

describe('mercy_well', () => {
  it('raises every living member toward max without exceeding it, leaves the fallen, and charges the cost', () => {
    const ctx = ctxWith({ hp: { a: 50, b: 99 }, mp: { a: 5, b: 19 }, ko: ['c'] });
    const before = snapshot(ctx);
    const offer = offerOf('mercy_well', ctx);
    const res = resolveMercyWell(offer, ctx);

    for (const id of ['a', 'b']) {
      const max = effectiveMaxHp(ctx.party.find(c => c.instanceId === id)!.currentStats.hp, ctx.run.activeBoons);
      expect(res.partyHp![id]).toBeGreaterThan(ctx.run.partyHp[id]);
      expect(res.partyHp![id]).toBeLessThanOrEqual(max);
      expect(res.partyMp![id]).toBeGreaterThan(ctx.run.partyMp[id]);
      expect(res.partyMp![id]).toBeLessThanOrEqual(20);
    }
    expect(res.partyHp!.c).toBe(0);
    expect(res.partyMp!.c).toBe(ctx.run.partyMp.c);
    expect(res.obols).toBe(ctx.run.obols - offer.cost);
    expect(offer.cost).toBe(obolCost(ctx.run.obols));
    expect(res.message.length).toBeGreaterThan(0);
    expect(snapshot(ctx)).toBe(before);
  });

  it('respects a boon-raised max HP', () => {
    const ctx = ctxWith({ hp: { a: 100 } });
    ctx.run.activeBoons = [{ boonId: 'garys_gift_10', battlesLeft: null }];
    const res = resolveMercyWell(offerOf('mercy_well', ctx), ctx);
    expect(res.partyHp!.a).toBeGreaterThan(100);
    expect(res.partyHp!.a).toBeLessThanOrEqual(110);
  });
});

// ---------- blood boon ----------

describe('blood_boon', () => {
  it('names a real reward boon and a living victim before accepting', () => {
    const ctx = ctxWith({ ko: ['a'] });
    const offer = offerOf('blood_boon', ctx, sequence([0.5, 0.5]));
    expect(REWARD_BOON_LIST.some(b => b.id === offer.boonId)).toBe(true);
    expect(['b', 'c']).toContain(offer.victimId);
  });

  it('grants the boon, bleeds exactly one living member, and never knocks anyone out', () => {
    const ctx = ctxWith({ hp: { a: 40, b: 60 } });
    const before = snapshot(ctx);
    for (const r of [0, 0.4, 0.99]) {
      const offer = offerOf('blood_boon', ctx, always(r));
      const res = resolveBloodBoon(offer, ctx);
      expect(res.activeBoons!.some(b => b.boonId === offer.boonId)).toBe(true);
      const bled = ctx.party.filter(c => res.partyHp![c.instanceId] < ctx.run.partyHp[c.instanceId]);
      expect(bled.map(c => c.instanceId)).toEqual([offer.victimId]);
      for (const c of ctx.party) expect(res.partyHp![c.instanceId]).toBeGreaterThanOrEqual(1);
      expect(res.obols).toBeUndefined();
    }
    expect(snapshot(ctx)).toBe(before);
  });

  it('takes nothing from a victim already at 1 HP rather than dropping it', () => {
    const ctx = ctxWith({ hp: { a: 1 } });
    const res = resolveBloodBoon({ ...offerOf('blood_boon', ctx), victimId: 'a' }, ctx);
    expect(res.partyHp!.a).toBe(1);
    expect(res.activeBoons!.length).toBeGreaterThan(0);
  });

  it('bleeds a share of CURRENT HP, so a hurt creature loses less than a whole one', () => {
    const ctx = ctxWith({ hp: { a: 40 } });
    const hurt = resolveBloodBoon({ ...offerOf('blood_boon', ctx), victimId: 'a' }, ctx);
    const whole = resolveBloodBoon({ ...offerOf('blood_boon', ctx), victimId: 'b' }, ctx);
    expect(40 - hurt.partyHp!.a).toBeLessThan(100 - whole.partyHp!.b);
  });
});

// ---------- dice ----------

describe('dice_transfer', () => {
  it('rolls a whole number on a d12 before accepting', () => {
    const lo = offerOf('dice_transfer', ctxWith(), always(0));
    const hi = offerOf('dice_transfer', ctxWith(), always(0.999));
    expect(lo.roll).toBeGreaterThanOrEqual(1);
    expect(hi.roll).toBeLessThanOrEqual(12);
    expect(hi.roll).toBeGreaterThan(lo.roll);
    expect(Number.isInteger(lo.roll)).toBe(true);
  });

  it('moves at most the roll, never drains the donor, never overfills the recipient, conserves the total', () => {
    const cases: { hp: Record<string, number>; r: number }[] = [
      { hp: { a: 100, b: 50 }, r: 0.999 },  // roll-limited
      { hp: { a: 3, b: 50 }, r: 0.999 },    // donor-limited
      { hp: { a: 100, b: 98 }, r: 0.999 },  // recipient-limited
      { hp: { a: 1, b: 50 }, r: 0.5 },      // donor at 1 gives nothing
    ];
    for (const { hp, r } of cases) {
      const ctx = ctxWith({ hp });
      const before = snapshot(ctx);
      const offer = offerOf('dice_transfer', ctx, always(r));
      const res = resolveDiceTransfer(offer, ctx, 'a', 'b');
      const moved = ctx.run.partyHp.a - res.partyHp!.a;
      expect(moved).toBeGreaterThanOrEqual(0);
      expect(moved).toBeLessThanOrEqual(offer.roll);
      expect(res.partyHp!.a).toBeGreaterThanOrEqual(1);
      expect(res.partyHp!.b).toBeLessThanOrEqual(100);
      expect(res.partyHp!.b - ctx.run.partyHp.b).toBe(moved);
      const total = (hpMap: Record<string, number>) => Object.values(hpMap).reduce((n, v) => n + v, 0);
      expect(total(res.partyHp!)).toBe(total(ctx.run.partyHp));
      expect(res.partyMp).toBeUndefined();
      expect(snapshot(ctx)).toBe(before);
    }
  });

  it('lists donors who can spare HP and recipients who can take it, excluding the fallen and the donor', () => {
    const ctx = ctxWith({ hp: { a: 1, b: 50 }, ko: ['c'] });
    expect(diceDonors(ctx).map(c => c.instanceId)).toEqual(['b']);
    expect(diceRecipients(ctx, 'b').map(c => c.instanceId)).toEqual(['a']);
    const full = ctxWith();
    expect(diceRecipients(full, 'a').map(c => c.instanceId)).toEqual([]);
  });
});

// ---------- tinker's trade ----------

describe('tinkers_trade', () => {
  it('lays out three distinct real items and charges the shared cost', () => {
    for (const r of [0, 0.33, 0.7, 0.999]) {
      const ctx = ctxWith();
      const offer = offerOf('tinkers_trade', ctx, always(r));
      expect(offer.itemIds).toHaveLength(3);
      expect(new Set(offer.itemIds).size).toBe(3);
      for (const id of offer.itemIds) expect(ITEM_LIST.some(i => i.id === id)).toBe(true);
      expect(offer.cost).toBe(obolCost(ctx.run.obols));
    }
  });

  it('adds exactly the chosen item to the bag and takes the Obols, without touching the party', () => {
    const ctx = ctxWith();
    const before = snapshot(ctx);
    const offer = offerOf('tinkers_trade', ctx, sequence([0.1, 0.6, 0.9]));
    const chosen = offer.itemIds[1];
    const res = resolveTinkersTrade(offer, ctx, chosen);
    expect(usedSlots(res.backpack!)).toBe(usedSlots(ctx.backpack) + 1);
    expect(res.backpack!.slots.some(s => s?.kind === 'item' && s.itemId === chosen)).toBe(true);
    expect(res.obols).toBe(ctx.run.obols - offer.cost);
    expect(res.partyHp).toBeUndefined();
    expect(res.activeBoons).toBeUndefined();
    expect(snapshot(ctx)).toBe(before);
  });

  it('refuses an item that was not on the cloth', () => {
    const ctx = ctxWith();
    const offer = offerOf('tinkers_trade', ctx);
    const other = ITEM_LIST.find(i => !offer.itemIds.includes(i.id))!.id;
    expect(() => resolveTinkersTrade(offer, ctx, other)).toThrow();
  });
});

// ---------- warden's wager ----------

describe('warden_wager', () => {
  it('prepares a combat on this floor and index that pays more than an ordinary fight', () => {
    const ctx = ctxWith();
    const offer = offerOf('warden_wager', ctx);
    expect(offer.encounter.type).toBe('combat');
    expect(offer.encounter.floor).toBe(3);
    expect(offer.encounter.index).toBe(ctx.run.currentEncounterIndex);
    expect(offer.encounter.enemies!.length).toBeGreaterThan(0);
    expect(offer.encounter.rewardMultiplier).toBeGreaterThan(1);
  });

  it('resolves to that encounter and nothing else', () => {
    const ctx = ctxWith();
    const before = snapshot(ctx);
    const offer = offerOf('warden_wager', ctx);
    const res = resolveWardenWager(offer, ctx);
    expect(res.encounter).toBe(offer.encounter);
    expect(res.partyHp).toBeUndefined();
    expect(res.partyMp).toBeUndefined();
    expect(res.obols).toBeUndefined();
    expect(res.activeBoons).toBeUndefined();
    expect(res.backpack).toBeUndefined();
    expect(res.message.length).toBeGreaterThan(0);
    expect(snapshot(ctx)).toBe(before);
  });
});

// ---------- offer/definition agreement ----------

describe('prepareEvent', () => {
  it('carries the catalogue definition for every event', () => {
    const ctx = ctxWith({ hp: { a: 50 } });
    for (const def of Object.values(EVENTS)) {
      expect(prepareEvent(def.id, ctx, always(0.5)).def).toBe(def);
    }
  });
});
