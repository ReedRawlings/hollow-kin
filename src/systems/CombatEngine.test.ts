import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEnemyAction } from './TacticsAI';
import { makeTestCreature } from './testFixtures';

/** Forces Math.random to yield the given sequence, then repeat its last value. */
function seedRandom(values: number[]): void {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => values[Math.min(i++, values.length - 1)]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getEnemyAction — characterization', () => {
  it('picks the highest-power affordable non-Status ability', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20,
      abilities: ['jab', 'thrash', 'smash'], // power 30 / 75 / 50
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('thrash');
  });

  it('ignores abilities it cannot afford', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 4,
      abilities: ['jab', 'thrash', 'smash'], // costs 2 / 5 / 4
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('smash');
  });

  it('never uses Status abilities', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20,
      abilities: ['bold', 'mend', 'harden'], // all Status
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('basic_attack');
  });

  it('falls back to basic_attack with no MP', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 0, abilities: ['thrash'],
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('basic_attack');
  });

  it('targets a random living party member and skips the knocked out', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const b = makeTestCreature({ speciesId: 'b', hp: 0 });
    const c = makeTestCreature({ speciesId: 'c' });
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false, mp: 0 });

    seedRandom([0]);
    expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).toBe('a');

    vi.restoreAllMocks();
    seedRandom([0.99]);
    expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).toBe('c');

    // Distinguishing seed: against the *filtered* aliveTargets ([a, c], length 2),
    // 0.4 selects floor(0.4*2)=0 -> a. A regressed port that forgot to filter out
    // the knocked-out member would index into the unfiltered [a, b, c] (length 3),
    // selecting floor(0.4*3)=1 -> b, the knocked-out creature. This is the only
    // seed of the three that would actually catch that regression.
    vi.restoreAllMocks();
    seedRandom([0.4]);
    expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).toBe('a');
  });

  it('never targets the knocked-out member, across a spread of seeds', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const b = makeTestCreature({ speciesId: 'b', hp: 0 });
    const c = makeTestCreature({ speciesId: 'c' });
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false, mp: 0 });

    for (const seed of [0, 0.1, 0.25, 0.4, 0.5, 0.75, 0.9, 0.99]) {
      seedRandom([seed]);
      expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).not.toBe('b');
      vi.restoreAllMocks();
    }
  });

  it('consumes exactly one Math.random call per decision', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['jab'],
    });
    getEnemyAction(enemy, [makeTestCreature({ speciesId: 'hero' })]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // Pins the POST-PORT contract for the empty-foes branch — this is a deliberate
  // divergence from the pre-port getEnemyAction, not an accidental regression.
  // See the doc comment on getEnemyAction in TacticsAI.ts for the full rationale:
  // the old code indexed an empty array (burning one Math.random() call) and
  // returned an undefined target paired with the enemy's actual best ability;
  // this returns a safe, defined (if knocked-out) target and burns zero RNG.
  it('all foes knocked out (post-port): returns basic_attack, a defined target, and zero Math.random calls', () => {
    const spy = vi.spyOn(Math, 'random');
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['jab', 'thrash', 'smash'],
    });
    const downedHero = makeTestCreature({ speciesId: 'hero', hp: 0 });
    const result = getEnemyAction(enemy, [downedHero]);
    expect(result).toEqual({ abilityId: 'basic_attack', target: downedHero });
    expect(result.target).toBeDefined();
    expect(spy).not.toHaveBeenCalled();
  });
});

import {
  calculateDamage, baseDamage, isHostileAbility, resolveNonDamagingAbility,
  rollAbilityHit, revive, clearNegativeStatuses, stripPositiveStages, applyPercentDamage,
  meetsCriticalCondition,
} from './CombatEngine';
import { getAbility } from '../data/abilities';

describe('baseDamage', () => {
  it('is deterministic and consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const a = makeTestCreature({ speciesId: 'a', isPlayer: true });
    const d = makeTestCreature({ speciesId: 'd', isPlayer: false });
    const first = baseDamage(a, d, getAbility('smash'), true);
    const second = baseDamage(a, d, getAbility('smash'), true);
    expect(first).toBe(second);
    expect(spy).not.toHaveBeenCalled();
  });

  it('applies the weakness multiplier only when asked', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const weak = makeTestCreature({ speciesId: 'd', weaknesses: ['Ash'] });
    const ember = getAbility('ember');
    expect(baseDamage(a, weak, ember, true)).toBeCloseTo(baseDamage(a, weak, ember, false) * 1.5);
  });

  it('applies the resistance multiplier only when asked', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const tough = makeTestCreature({ speciesId: 'd', resistances: ['Ash'] });
    const ember = getAbility('ember');
    expect(baseDamage(a, tough, ember, true)).toBeCloseTo(baseDamage(a, tough, ember, false) * 0.5);
  });

});

describe('calculateDamage — RNG and critical contract', () => {
  it('uses one accuracy roll and misses without any critical RNG', () => {
    // Value > hitChance forces a miss; accuracy is the only roll.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const a = makeTestCreature({ speciesId: 'a', isPlayer: true });
    const d = makeTestCreature({ speciesId: 'd', isPlayer: false });
    // seismic_slam has accuracy 90, so 0.99 > 0.90 misses.
    const result = calculateDamage(a, d, getAbility('seismic_slam'));
    expect(result.missed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not crit when an enemy move has no authored condition', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const hero = makeTestCreature({ speciesId: 'hero', isPlayer: true });
    expect(calculateDamage(enemy, hero, getAbility('smash')).isCrit).toBe(false);
  });

  it('evaluates authored critical conditions deterministically', () => {
    const attacker = makeTestCreature({ speciesId: 'attacker', isPlayer: true });
    const target = makeTestCreature({ speciesId: 'target', isPlayer: false });
    target.buffStages.def = -1;
    expect(meetsCriticalCondition(target, getAbility('slash'))).toBe(true);

    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(calculateDamage(attacker, target, getAbility('slash')).isCrit).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('never gives an unauthored move a random critical', () => {
    const attacker = makeTestCreature({ speciesId: 'attacker', isPlayer: true });
    const target = makeTestCreature({ speciesId: 'target', isPlayer: false });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(calculateDamage(attacker, target, getAbility('smash')).isCrit).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns damage: 0 for zero-power Status abilities that hit (guards against baseDamage early return regression)', () => {
    // bold has power: 0, accuracy: 100. Math.random() for hit check must be < 1.0.
    seedRandom([0]);
    const user = makeTestCreature({ speciesId: 'user', isPlayer: true });
    const target = makeTestCreature({ speciesId: 'target', isPlayer: false });
    const result = calculateDamage(user, target, getAbility('bold'));
    // Without the early return at line 73, baseDamage returns 0, but then line 88
    // would return Math.max(1, 0) = 1, breaking zero-power abilities.
    expect(result.damage).toBe(0);
    expect(result.missed).toBe(false);
  });
});

describe('non-damaging ability accuracy', () => {
  it('classifies enemy-targeting debuffs as hostile and friendly moves as non-hostile', () => {
    expect(isHostileAbility(getAbility('weaken'))).toBe(true);
    expect(isHostileAbility(getAbility('scold'))).toBe(true);
    expect(isHostileAbility(getAbility('bold'))).toBe(false);
    expect(isHostileAbility(getAbility('soothe'))).toBe(false);
  });

  it('uses the configured accuracy boundary', () => {
    // Weaken is 85% accurate; the boundary itself hits.
    seedRandom([0.85]);
    expect(rollAbilityHit(getAbility('weaken'))).toBe(true);

    vi.restoreAllMocks();
    seedRandom([0.851]);
    expect(rollAbilityHit(getAbility('weaken'))).toBe(false);
  });

  it('misses a hostile debuff without changing the target', () => {
    seedRandom([0.99]);
    const user = makeTestCreature({ speciesId: 'user', isPlayer: true });
    const target = makeTestCreature({ speciesId: 'target', isPlayer: false });

    const result = resolveNonDamagingAbility(getAbility('weaken'), user, target);

    expect(result).toEqual({ missed: true, messages: [] });
    expect(target.buffStages.str).toBeUndefined();
  });

  it('applies a hostile debuff after a successful accuracy roll', () => {
    // First roll hits; second roll is the effect's guaranteed chance.
    seedRandom([0, 0]);
    const user = makeTestCreature({ speciesId: 'user', isPlayer: true });
    const target = makeTestCreature({ speciesId: 'target', isPlayer: false });

    const result = resolveNonDamagingAbility(getAbility('weaken'), user, target);

    expect(result.missed).toBe(false);
    expect(target.buffStages.str).toBe(-1);
  });

  it('keeps friendly self buffs guaranteed without an accuracy roll', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const user = makeTestCreature({ speciesId: 'user', isPlayer: true });

    const result = resolveNonDamagingAbility(getAbility('bold'), user, user);

    expect(result.missed).toBe(false);
    expect(user.buffStages.str).toBe(1);
    // applyAbilityEffects still performs its effect-chance roll; there is no
    // additional ability-accuracy roll for the friendly move.
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('item effect primitives', () => {
  it('revive refuses a creature that is still standing', () => {
    const c = makeTestCreature();
    expect(revive(c, 0.25, 0.25)).toBe(false);
  });

  it('revive brings back a downed creature above zero HP', () => {
    const c = makeTestCreature({ hp: 0 });
    expect(revive(c, 0.25, 0.25)).toBe(true);
    expect(c.isKnockedOut).toBe(false);
    expect(c.currentHp).toBeGreaterThan(0);
  });

  it('revive never returns someone at zero HP even on a tiny fraction', () => {
    const c = makeTestCreature({ hp: 0 });
    revive(c, 0.0001, 0);
    expect(c.currentHp).toBeGreaterThanOrEqual(1);
  });

  it('revive never lowers MP below what the creature was carrying when it fell', () => {
    // A knock-out only ever zeroes HP; MP is whatever it was. A revive item's
    // small MP fraction must not act as a penalty for someone felled at full MP.
    const c = makeTestCreature({ hp: 0, mp: 20 });
    const mpBefore = c.currentMp;
    revive(c, 0.25, 0.1); // 0.1 * maxMp would be well below what was carried
    expect(c.currentMp).toBeGreaterThanOrEqual(mpBefore);
  });

  it('clearNegativeStatuses empties the list and reports what went', () => {
    const c = makeTestCreature();
    c.statusEffects = [
      { type: 'poison', turnsRemaining: 3 },
      { type: 'burn', turnsRemaining: 2 },
    ];
    const removed = clearNegativeStatuses(c);
    expect(removed).toEqual(['poison', 'burn']);
    expect(c.statusEffects).toEqual([]);
  });

  it('clearNegativeStatuses on a clean creature reports nothing', () => {
    expect(clearNegativeStatuses(makeTestCreature())).toEqual([]);
  });

  it('stripPositiveStages clears buffs but leaves debuffs alone', () => {
    const c = makeTestCreature();
    c.buffStages = { str: 2, def: -1, spd: 3 };
    const cleared = stripPositiveStages(c);
    expect(cleared.sort()).toEqual(['spd', 'str']);
    expect(c.buffStages.str).toBe(0);
    expect(c.buffStages.spd).toBe(0);
    expect(c.buffStages.def).toBe(-1); // a debuff is the enemy's problem, not ours to fix
  });

  it('applyPercentDamage scales with the target maximum HP', () => {
    const small = makeTestCreature({ stats: { hp: 100 } });
    const large = makeTestCreature({ stats: { hp: 400 } });
    expect(applyPercentDamage(large, 0.25)).toBeGreaterThan(applyPercentDamage(small, 0.25));
  });

  it('applyPercentDamage ignores DEF entirely', () => {
    const soft = makeTestCreature({ stats: { hp: 200, def: 1 } });
    const armoured = makeTestCreature({ stats: { hp: 200, def: 999 } });
    expect(applyPercentDamage(armoured, 0.25)).toBe(applyPercentDamage(soft, 0.25));
  });

  it('applyPercentDamage knocks out and reports only the damage actually dealt', () => {
    const c = makeTestCreature({ stats: { hp: 100 }, hp: 10 });
    expect(applyPercentDamage(c, 0.5)).toBe(10); // dealt, not the notional 50
    expect(c.isKnockedOut).toBe(true);
  });
});
