import {
  CombatCreature, CreatureInstance, CreatureTemplate, BaseStats, DamageType,
} from '../types';
import { createCombatCreature } from './CombatEngine';

/**
 * Shared test fixtures for CombatEngine.test.ts and TacticsAI.test.ts (and any
 * future combat/tactics test file — Tasks 7/8 will add more tactic profiles
 * that need the same fixture).
 *
 * Deliberately NOT named `*.test.ts` so vitest's `include: ['src/**\/*.test.ts']`
 * glob (see vitest.config.ts) never collects it as a suite. Importing a
 * `.test.ts` file from another test file re-executes its top-level `it()`
 * blocks as a side effect, which used to double-count CombatEngine.test.ts's
 * tests when TacticsAI.test.ts imported `makeTestCreature` from it directly.
 */

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
    naturalTraitPool: [],
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
    statBaseline: { ...s },
    currentStats: s,
    resistances: opts.resistances ?? [],
    weaknesses: opts.weaknesses ?? [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
    tactic: 'fight_wisely',
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
