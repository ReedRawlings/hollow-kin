import { describe, expect, it } from 'vitest';
import { CreatureInstance, RunState } from '../types';
import { ITEMS, ITEM_LIST, ItemDefinition } from '../data/items';
import { makeTestCreature } from './testFixtures';
import { applyItemInCombat, applyItemOnMap, canUseItem } from './Items';

const inCombat = { where: 'combat', isBoss: false } as const;
const inBoss = { where: 'combat', isBoss: true } as const;
const onMap = { where: 'map', isBoss: false } as const;

function mapCreature(): CreatureInstance {
  return {
    instanceId: 'c1',
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
    currentStats: { hp: 100, mp: 20, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    resistances: [],
    weaknesses: [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
    tactic: 'fight_wisely',
  };
}

function mapRun(hp = 50, mp = 5, ko = false): RunState {
  return {
    startFloor: 1,
    currentEncounterIndex: 0,
    encounters: [],
    choices: [],
    obols: 0,
    partyHp: { c1: hp },
    partyMp: { c1: mp },
    partyKO: { c1: ko },
    autoCombat: false,
    activeBoons: [],
  };
}

describe('canUseItem', () => {
  it('offers every item somewhere — none is unreachable', () => {
    for (const def of ITEM_LIST) {
      const anywhere = canUseItem(def, inCombat) || canUseItem(def, inBoss) || canUseItem(def, onMap);
      expect(anywhere).toBe(true);
    }
  });

  it('refuses the escape item against a boss and allows it otherwise', () => {
    expect(canUseItem(ITEMS.smoke_husk, inBoss)).toBe(false);
    expect(canUseItem(ITEMS.smoke_husk, inCombat)).toBe(true);
  });

  it('keeps the waystone out of combat and on the map', () => {
    expect(canUseItem(ITEMS.waystone, inCombat)).toBe(false);
    expect(canUseItem(ITEMS.waystone, onMap)).toBe(true);
  });
});

describe('applyItemInCombat', () => {
  it('heals a wounded ally', () => {
    const c = makeTestCreature({ stats: { hp: 100 }, hp: 20 });
    expect(applyItemInCombat(ITEMS.mending_draught, c, inCombat).kind).toBe('applied');
    expect(c.currentHp).toBeGreaterThan(20);
  });

  it('refuses to revive someone still standing', () => {
    const c = makeTestCreature();
    expect(applyItemInCombat(ITEMS.hollow_candle, c, inCombat).kind).toBe('refused');
  });

  it('revives a downed ally', () => {
    const c = makeTestCreature({ hp: 0 });
    expect(applyItemInCombat(ITEMS.hollow_candle, c, inCombat).kind).toBe('applied');
    expect(c.isKnockedOut).toBe(false);
  });

  it('hits a boss for less than an ordinary enemy of the same size', () => {
    const normal = makeTestCreature({ stats: { hp: 400 } });
    const boss = makeTestCreature({ stats: { hp: 400 } });
    applyItemInCombat(ITEMS.grave_ash, normal, inCombat);
    applyItemInCombat(ITEMS.grave_ash, boss, inBoss);
    expect(400 - boss.currentHp).toBeLessThan(400 - normal.currentHp);
  });

  it('reports an escape rather than mutating anything', () => {
    expect(applyItemInCombat(ITEMS.smoke_husk, null, inCombat).kind).toBe('escape_battle');
  });

  it('refuses the escape item in a boss fight', () => {
    expect(applyItemInCombat(ITEMS.smoke_husk, null, inBoss).kind).toBe('refused');
  });

  it('refuses the waystone in combat', () => {
    expect(applyItemInCombat(ITEMS.waystone, null, inCombat).kind).toBe('refused');
  });

  describe('party-wide buff (power_increase)', () => {
    it('raises every living ally by one stage and leaves a knocked-out ally untouched', () => {
      const a = makeTestCreature();
      const b = makeTestCreature();
      const downed = makeTestCreature({ hp: 0 });
      const party = [a, b, downed];

      const outcome = applyItemInCombat(ITEMS.power_increase, null, inCombat, party);

      expect(outcome.kind).toBe('applied');
      expect(a.buffStages.str).toBe(1);
      expect(b.buffStages.str).toBe(1);
      expect(downed.buffStages.str ?? 0).toBe(0);
    });

    it('refuses when there is no living ally to receive it', () => {
      const downed = makeTestCreature({ hp: 0 });
      expect(applyItemInCombat(ITEMS.power_increase, null, inCombat, [downed]).kind).toBe('refused');
    });
  });

  it('still applies a single-target buff to only the chosen ally', () => {
    // Regression test for the pre-existing living_ally buff branch, which
    // power_increase no longer exercises now that it targets the whole party.
    const singleTargetBuff: ItemDefinition = {
      id: 'test_single_target_buff',
      name: 'Test Tonic',
      description: 'test fixture only',
      usableIn: 'combat',
      targeting: 'living_ally',
      effect: { kind: 'buff', stat: 'str', stages: 1 },
    };
    const a = makeTestCreature();
    const b = makeTestCreature();

    const outcome = applyItemInCombat(singleTargetBuff, a, inCombat, [a, b]);

    expect(outcome.kind).toBe('applied');
    expect(a.buffStages.str).toBe(1);
    expect(b.buffStages.str ?? 0).toBe(0);
  });
});

describe('applyItemOnMap', () => {
  it('heals a wounded ally', () => {
    const run = mapRun(50);
    expect(applyItemOnMap(ITEMS.mending_draught, mapCreature(), run).kind).toBe('applied');
    expect(run.partyHp.c1).toBeGreaterThan(50);
  });

  it('refuses to heal someone already full', () => {
    const run = mapRun(100);
    expect(applyItemOnMap(ITEMS.mending_draught, mapCreature(), run).kind).toBe('refused');
  });

  it('revives a downed ally out on the map', () => {
    const run = mapRun(0, 0, true);
    expect(applyItemOnMap(ITEMS.hollow_candle, mapCreature(), run).kind).toBe('applied');
    expect(run.partyKO.c1).toBe(false);
    expect(run.partyHp.c1).toBeGreaterThan(0);
  });

  it('reports a departure rather than ending the run itself', () => {
    expect(applyItemOnMap(ITEMS.waystone, null, mapRun()).kind).toBe('depart');
  });

  it('refuses every combat-only effect instead of silently doing nothing', () => {
    // The regression test for the trap Clearroot originally fell into: a map use
    // that no-ops still consumes the item, which is a bug the player pays for.
    for (const def of ITEM_LIST) {
      if (def.usableIn === 'combat' || def.usableIn === 'combat_non_boss') {
        expect(applyItemOnMap(def, mapCreature(), mapRun()).kind).toBe('refused');
      }
    }
  });
});
