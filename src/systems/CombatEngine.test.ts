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
  if (opts.hp !== undefined) c.currentHp = opts.hp;
  if (opts.mp !== undefined) c.currentMp = opts.mp;
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
