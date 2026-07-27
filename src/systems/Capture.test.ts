import { describe, it, expect } from 'vitest';
import {
  newRiteLog, evaluateRites, bandFor, capturePrice, captureChance,
  reactionFor, canBid, registerRejection, clearsEnrage, isUncapturable,
} from './Capture';
import { CombatCreature, CreatureTemplate, RiteDef, CaptureParty } from '../types';

// --- fixtures -------------------------------------------------------------

const NO_PARTY: CaptureParty = { anyKnockedOut: false, actorCount: 2 };

function template(overrides: Partial<CreatureTemplate> = {}): CreatureTemplate {
  return {
    id: 'test_beast', name: 'Test Beast', archetype: 'Fauna',
    baseStats: { hp: 30, mp: 10, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    defaultAbilities: ['basic_attack'], resistances: [], weaknesses: [],
    spriteColor: 0xffffff, naturalTraitPool: [],
    captureBasePrice: 20,
    ...overrides,
  };
}

function foe(overrides: Partial<CombatCreature> = {}): CombatCreature {
  return {
    instance: { instanceId: 'i1', speciesId: 'test_beast' } as CombatCreature['instance'],
    template: template(),
    currentHp: 30, maxHp: 30, currentMp: 10, maxMp: 10,
    buffStages: {}, statusEffects: [],
    isKnockedOut: false, isDefending: false, isPlayerOwned: false,
    ...overrides,
  };
}

const FAMILY_FIRE: RiteDef = {
  id: 'family_fire', band: 'family', persistence: 'sticky',
  conditions: [{ kind: 'damage_type_taken', damageType: 'Fire' }],
};
const SIGNATURE_MERCY: RiteDef = {
  id: 'sig_mercy', band: 'signature', persistence: 'volatile',
  conditions: [{ kind: 'hp_above', fraction: 0.75 }],
};

// --- band selection -------------------------------------------------------

describe('band selection', () => {
  it('takes the signature band when both a family and a signature rite hold', () => {
    const t = template({ rites: [FAMILY_FIRE, SIGNATURE_MERCY] });
    expect(bandFor(t, ['family_fire', 'sig_mercy'])).toBe('signature');
  });

  it('takes signature regardless of rite order in the template', () => {
    const t = template({ rites: [SIGNATURE_MERCY, FAMILY_FIRE] });
    expect(bandFor(t, ['family_fire', 'sig_mercy'])).toBe('signature');
  });

  it('falls back to unsatisfied when nothing holds', () => {
    expect(bandFor(template({ rites: [FAMILY_FIRE] }), [])).toBe('unsatisfied');
  });

  it('prices a satisfied band below an unsatisfied one', () => {
    const t = template({ rites: [FAMILY_FIRE, SIGNATURE_MERCY] });
    const target = foe();
    const none = capturePrice(t, 10, target, 'unsatisfied');
    const family = capturePrice(t, 10, target, 'family');
    const signature = capturePrice(t, 10, target, 'signature');
    expect(family).toBeLessThan(none);
    expect(signature).toBeLessThan(family);
  });
});

// --- sticky vs volatile ---------------------------------------------------

describe('rite persistence', () => {
  it('latches a sticky rite so it survives the condition lapsing', () => {
    const t = template({ rites: [FAMILY_FIRE] });
    const log = newRiteLog();
    log.damageTypesTaken.push('Fire');

    const first = evaluateRites(t, foe(), log, NO_PARTY);
    expect(first.satisfied).toContain('family_fire');
    expect(first.toLatch).toContain('family_fire');

    // The caller latches, then the underlying fact is somehow gone.
    const latched = { ...log, latchedRites: first.toLatch, damageTypesTaken: [] };
    expect(evaluateRites(t, foe(), latched, NO_PARTY).satisfied).toContain('family_fire');
  });

  it('never latches a volatile rite, so it lapses with its condition', () => {
    const t = template({ rites: [SIGNATURE_MERCY] });
    const log = newRiteLog();

    const healthy = evaluateRites(t, foe({ currentHp: 30, maxHp: 30 }), log, NO_PARTY);
    expect(healthy.satisfied).toContain('sig_mercy');
    expect(healthy.toLatch).toHaveLength(0);

    const hurt = evaluateRites(t, foe({ currentHp: 10, maxHp: 30 }), log, NO_PARTY);
    expect(hurt.satisfied).toHaveLength(0);
    expect(hurt.band).toBe('unsatisfied');
  });

  it('treats a rite with no conditions as never satisfied rather than always', () => {
    const empty: RiteDef = { id: 'empty', band: 'family', persistence: 'sticky', conditions: [] };
    expect(evaluateRites(template({ rites: [empty] }), foe(), newRiteLog(), NO_PARTY).satisfied)
      .toHaveLength(0);
  });

  it('requires every condition, not any', () => {
    const both: RiteDef = {
      id: 'both', band: 'family', persistence: 'volatile',
      conditions: [{ kind: 'has_not_acted' }, { kind: 'hp_above', fraction: 0.5 }],
    };
    const t = template({ rites: [both] });
    const acted = { ...newRiteLog(), hasActed: true };
    expect(evaluateRites(t, foe(), acted, NO_PARTY).satisfied).toHaveLength(0);
    expect(evaluateRites(t, foe(), newRiteLog(), NO_PARTY).satisfied).toContain('both');
  });
});

// --- uncapturable ---------------------------------------------------------

describe('uncapturable species', () => {
  const boss = template({ captureBasePrice: 0 });

  it('is flagged by an explicit base price of 0, not by omission', () => {
    expect(isUncapturable(boss)).toBe(true);
    expect(isUncapturable(template({ captureBasePrice: undefined }))).toBe(false);
  });

  it('cannot be bought at any bid', () => {
    const price = capturePrice(boss, 30, foe(), 'signature');
    expect(price).toBe(0);
    expect(captureChance(999999, price)).toBe(0);
  });
});

// --- bidding --------------------------------------------------------------

describe('bidding', () => {
  it('clamps to certainty at and above the price', () => {
    expect(captureChance(100, 100)).toBe(1);
    expect(captureChance(250, 100)).toBe(1);
  });

  it('never returns a negative chance for a nonsense bid', () => {
    expect(captureChance(-50, 100)).toBe(0);
  });

  it('insults strictly below half the price and wavers at exactly half', () => {
    expect(reactionFor(49, 100)).toBe('insulted');
    expect(reactionFor(50, 100)).toBe('wavers');
    expect(reactionFor(99, 100)).toBe('wavers');
  });

  it('charges more for a healthy target than a hurt one', () => {
    const t = template();
    const healthy = capturePrice(t, 10, foe({ currentHp: 30, maxHp: 30 }), 'unsatisfied');
    const hurt = capturePrice(t, 10, foe({ currentHp: 1, maxHp: 30 }), 'unsatisfied');
    expect(healthy).toBeGreaterThan(hurt);
    // ...but only as a nudge. Grinding to 1 HP must never be worth a detour.
    expect(healthy / hurt).toBeLessThanOrEqual(1.3);
  });

  it('gets more expensive with depth', () => {
    const t = template();
    expect(capturePrice(t, 30, foe(), 'unsatisfied'))
      .toBeGreaterThan(capturePrice(t, 1, foe(), 'unsatisfied'));
  });
});

// --- enrage ---------------------------------------------------------------

describe('enrage', () => {
  it('enrages on the third rejection and not before', () => {
    let log = newRiteLog();
    for (let i = 0; i < 2; i++) {
      log = { ...log, ...registerRejection(log) };
      expect(log.isEnraged).toBe(false);
      expect(canBid(log)).toBe(true);
    }
    log = { ...log, ...registerRejection(log) };
    expect(log.isEnraged).toBe(true);
    expect(canBid(log)).toBe(false);
  });

  it('is cleared by satisfying any rite, never by another bid', () => {
    const t = template({ rites: [SIGNATURE_MERCY] });
    const satisfied = evaluateRites(t, foe(), newRiteLog(), NO_PARTY);
    const unsatisfied = evaluateRites(t, foe({ currentHp: 1, maxHp: 30 }), newRiteLog(), NO_PARTY);
    expect(clearsEnrage(satisfied)).toBe(true);
    expect(clearsEnrage(unsatisfied)).toBe(false);
  });
});

// --- party-scoped conditions ---------------------------------------------

describe('party-scoped conditions', () => {
  it('reads ally_knocked_out from the party, not the target', () => {
    const rite: RiteDef = {
      id: 'grief', band: 'signature', persistence: 'volatile',
      conditions: [{ kind: 'ally_knocked_out' }],
    };
    const t = template({ rites: [rite] });
    expect(evaluateRites(t, foe(), newRiteLog(), NO_PARTY).satisfied).toHaveLength(0);
    expect(evaluateRites(t, foe(), newRiteLog(), { anyKnockedOut: true, actorCount: 2 }).satisfied)
      .toContain('grief');
  });

  it('counts a single actor as solo', () => {
    const rite: RiteDef = {
      id: 'duel', band: 'signature', persistence: 'volatile',
      conditions: [{ kind: 'solo_actor' }],
    };
    const t = template({ rites: [rite] });
    expect(evaluateRites(t, foe(), newRiteLog(), { anyKnockedOut: false, actorCount: 1 }).satisfied)
      .toContain('duel');
    expect(evaluateRites(t, foe(), newRiteLog(), { anyKnockedOut: false, actorCount: 3 }).satisfied)
      .toHaveLength(0);
  });
});
