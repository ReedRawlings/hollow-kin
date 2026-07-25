import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CombatCreature, CreatureInstance, CreatureTemplate, BaseStats, DamageType,
} from '../types';
import { createCombatCreature, getEnemyAction } from './CombatEngine';

export function testStats(over: Partial<BaseStats> = {}): BaseStats {
  return { hp: 100, mp: 20, str: 40, def: 20, wis: 20, spd: 20, int: 40, ...over };
}

export interface TestCreatureOpts {
  speciesId?: string;
  abilities?: (string | null)[];
  isPlayer?: boolean;
  hp?: number;
  mp?: number;
  stats?: Partial<BaseStats>;
  weaknesses?: DamageType[];
  resistances?: DamageType[];
}

/** Builds a CombatCreature with predictable stats for AI and engine tests. */
export function makeTestCreature(opts: TestCreatureOpts = {}): CombatCreature {
  const speciesId = opts.speciesId ?? 'dummy';
  const s = testStats(opts.stats);
  const template: CreatureTemplate = {
    id: speciesId,
    name: speciesId,
    archetype: 'Fauna',
    baseStats: s,
    defaultAbilities: [],
    resistances: [],
    weaknesses: [],
    spriteColor: 0,
  };
  const instance: CreatureInstance = {
    instanceId: `i-${speciesId}`,
    speciesId,
    nickname: null,
    starRating: 0,
    currentLevel: 1,
    levelCap: 5,
    permanentLevel: 1,
    essenceInvested: 0,
    abilities: opts.abilities ?? ['basic_attack'],
    traitSlots: [],
    lineage: { parentA: null, parentB: null },
    currentStats: s,
    resistances: opts.resistances ?? [],
    weaknesses: opts.weaknesses ?? [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
  };
  const c = createCombatCreature(instance, template, opts.isPlayer ?? true);
  // opts.hp/opts.mp set currentHp/currentMp directly. createCombatCreature already
  // derived maxHp/maxMp from the stats block, so an opts.hp/opts.mp that exceeds
  // that stat-derived max would otherwise produce an impossible currentHp > maxHp
  // (or currentMp > maxMp) state. When that happens, raise the max to match instead
  // — this lets callers build either "damaged creature" fixtures (hp below the
  // stats-derived max, e.g. { hp: 20 } against the default 100 stats) or "tankier
  // creature at full health" fixtures (hp above the default max, e.g. { hp: 500 })
  // without needing to also override `stats`.
  if (opts.hp !== undefined) {
    c.currentHp = opts.hp;
    if (opts.hp > c.maxHp) c.maxHp = opts.hp;
  }
  if (opts.mp !== undefined) {
    c.currentMp = opts.mp;
    if (opts.mp > c.maxMp) c.maxMp = opts.mp;
  }
  c.isKnockedOut = c.currentHp <= 0;
  return c;
}

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
});

import { calculateDamage, baseDamage } from './CombatEngine';
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
    const weak = makeTestCreature({ speciesId: 'd', weaknesses: ['Fire'] });
    const ember = getAbility('ember');
    expect(baseDamage(a, weak, ember, true)).toBeCloseTo(baseDamage(a, weak, ember, false) * 1.5);
  });

  it('applies the resistance multiplier only when asked', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const tough = makeTestCreature({ speciesId: 'd', resistances: ['Fire'] });
    const ember = getAbility('ember');
    expect(baseDamage(a, tough, ember, true)).toBeCloseTo(baseDamage(a, tough, ember, false) * 0.5);
  });

  it('halves damage against a defending target', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    const open = baseDamage(a, d, getAbility('smash'), true);
    d.isDefending = true;
    expect(baseDamage(a, d, getAbility('smash'), true)).toBeCloseTo(open * 0.5);
  });
});

describe('calculateDamage — RNG contract', () => {
  it('rolls hit before crit, and misses without rolling crit', () => {
    // First value > hitChance forces a miss; only one roll should be consumed.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const a = makeTestCreature({ speciesId: 'a', isPlayer: true });
    const d = makeTestCreature({ speciesId: 'd', isPlayer: false });
    // seismic_slam has accuracy 90, so 0.99 > 0.90 misses.
    const result = calculateDamage(a, d, getAbility('seismic_slam'));
    expect(result.missed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not crit for enemy attackers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const hero = makeTestCreature({ speciesId: 'hero', isPlayer: true });
    expect(calculateDamage(enemy, hero, getAbility('smash')).isCrit).toBe(false);
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
