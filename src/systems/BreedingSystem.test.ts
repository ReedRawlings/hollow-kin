import { describe, it, expect } from 'vitest';
import {
  breed, carryoverForParents, calculateOffspringStar, calculateOffspringStats,
  resolveInheritedTraitSlots,
} from './BreedingSystem';
import { CreatureInstance, TraitSlot } from '../types';
import { unlockedSlotCount, MAX_TRAIT_SLOTS, TRAIT_SLOT_LEVELS, applyStatTraitBonuses } from './Traits';
import { calculateLevelScaledStats } from '../managers/GameState';

// Minimal creature-instance factory for tests (only fields breeding reads).
function makeParent(overrides: Partial<CreatureInstance>): CreatureInstance {
  return {
    instanceId: 'p', speciesId: 'kin_070', nickname: null, starRating: 1,
    currentLevel: 1, levelCap: 50, permanentLevel: 1, essenceInvested: 0,
    abilities: [], traitSlots: [], lineage: { parentA: null, parentB: null },
    statBaseline: { hp: 30, mp: 5, str: 10, def: 8, wis: 5, spd: 7, int: 4 },
    currentStats: { hp: 30, mp: 5, str: 10, def: 8, wis: 5, spd: 7, int: 4 },
    resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
    tactic: 'fight_wisely',
    ...overrides,
  };
}

// Empty trait slots, useful as a base for overriding specific indices in tests.
function emptySlots(): TraitSlot[] {
  return Array.from({ length: MAX_TRAIT_SLOTS }, () => ({ traitId: null, traitLevel: 0, unlocked: false }));
}

function slotsWith(overrides: Record<number, Partial<TraitSlot>>): TraitSlot[] {
  const slots = emptySlots();
  for (const [i, o] of Object.entries(overrides)) {
    slots[Number(i)] = { ...slots[Number(i)], ...o };
  }
  return slots;
}

describe('calculateOffspringStar breed-ready bonus', () => {
  // isBreedReady is a stored field that (as of the breed-readiness-becomes-derived
  // fix) nothing ever sets true anymore — GameState now derives readiness from
  // permanentLevel >= levelCap instead. If this read raw `.isBreedReady` it would
  // silently become dead code: the +1-star bonus would never fire again. Pin the
  // fix by driving readiness the same way GameState now does.
  it('grants +1 star when both parents are at their permanent level cap and share a star rating', () => {
    const a = makeParent({ instanceId: 'a', starRating: 2, permanentLevel: 20, levelCap: 20 });
    const b = makeParent({ instanceId: 'b', starRating: 2, permanentLevel: 20, levelCap: 20 });
    expect(calculateOffspringStar(a, b)).toBe(3); // avgStar 2, +1 bonus
  });

  it('withholds the bonus when a parent has not reached its permanent level cap', () => {
    const a = makeParent({ instanceId: 'a', starRating: 2, permanentLevel: 20, levelCap: 20 });
    const b = makeParent({ instanceId: 'b', starRating: 2, permanentLevel: 5, levelCap: 20 });
    expect(calculateOffspringStar(a, b)).toBe(2); // avgStar only, no bonus
  });
});

describe('carryoverForParents', () => {
  it('is level 1 / 0 invested when both parents have no invested essence', () => {
    const a = makeParent({ essenceInvested: 0 });
    const b = makeParent({ essenceInvested: 0 });
    expect(carryoverForParents(a, b, 50)).toEqual({ level: 1, invested: 0 });
  });

  it('carries half the average invested essence, converted through the cost curve', () => {
    // Two Lv3 parents: essenceInvested 38 each. avg 38, *0.5 = 19 pool.
    // levelFromEssence(19,50) -> level 2, invested 10.
    const a = makeParent({ essenceInvested: 38 });
    const b = makeParent({ essenceInvested: 38 });
    expect(carryoverForParents(a, b, 50)).toEqual({ level: 2, invested: 10 });
  });

  it('respects the offspring level cap', () => {
    const a = makeParent({ essenceInvested: 100000 });
    const b = makeParent({ essenceInvested: 100000 });
    const r = carryoverForParents(a, b, 3);
    expect(r.level).toBe(3);
  });
});

describe('breed applies carry-over to the offspring', () => {
  it('sets permanentLevel = currentLevel = carried level, and matching essenceInvested', () => {
    const a = makeParent({ instanceId: 'a', essenceInvested: 38 });
    const b = makeParent({ instanceId: 'b', essenceInvested: 38 });
    const child = breed(a, b, 'kin_070', []);
    expect(child.permanentLevel).toBe(2);
    expect(child.currentLevel).toBe(2);
    expect(child.essenceInvested).toBe(10);
  });

  it('still retires both parents', () => {
    const a = makeParent({ instanceId: 'a', essenceInvested: 0 });
    const b = makeParent({ instanceId: 'b', essenceInvested: 0 });
    breed(a, b, 'kin_070', []);
    expect(a.isRetired).toBe(true);
    expect(b.isRetired).toBe(true);
  });

  it('stores inherited stats as the offspring permanent baseline (matches calculateOffspringStats)', () => {
    // Fix 2: calculateOffspringStats derives from statBaseline/currentLevel/levelCap now,
    // not raw currentStats — see the describe block below for why. This test only checks
    // breed()'s wiring: it stores exactly what calculateOffspringStats computes.
    const a = makeParent({
      instanceId: 'a',
      statBaseline: { hp: 48, mp: 36, str: 28, def: 26, wis: 24, spd: 22, int: 20 },
      currentLevel: 10, levelCap: 10,
    });
    const b = makeParent({
      instanceId: 'b',
      statBaseline: { hp: 48, mp: 36, str: 28, def: 26, wis: 24, spd: 22, int: 20 },
      currentLevel: 10, levelCap: 10,
    });
    const expected = calculateOffspringStats(a, b, 'kin_070');
    const child = breed(a, b, 'kin_070', []);

    expect(child.statBaseline).toEqual(expected);
    expect(child.currentStats).toEqual(child.statBaseline);
    expect(child.currentStats).not.toBe(child.statBaseline);
  });
});

describe('calculateOffspringStats excludes trait bonuses from the heritable baseline (Fix 2)', () => {
  const baseline = { hp: 40, mp: 20, str: 20, def: 16, wis: 12, spd: 12, int: 12 };

  it('produces the same offspring statBaseline for a parent with vs without a high-level stat trait, given identical statBaseline/currentLevel/levelCap', () => {
    const untraited = makeParent({
      instanceId: 'untraited', statBaseline: { ...baseline }, currentLevel: 10, levelCap: 10,
      traitSlots: emptySlots(),
    });
    untraited.currentStats = calculateLevelScaledStats(untraited);

    const traited = makeParent({
      instanceId: 'traited', statBaseline: { ...baseline }, currentLevel: 10, levelCap: 10,
      traitSlots: slotsWith({ 0: { traitId: 'str_up', traitLevel: 4, unlocked: true } }),
    });
    // currentStats as GameState would actually produce it: level-scaled stats with the
    // stat trait's bonus already layered on top (calculateStatsForLevel's real behavior).
    traited.currentStats = applyStatTraitBonuses(calculateLevelScaledStats(traited), traited);
    // Sanity check the leak vector is real: the trait really does inflate currentStats.
    expect(traited.currentStats.str).toBeGreaterThan(untraited.currentStats.str);

    const other = makeParent({
      instanceId: 'other', statBaseline: { ...baseline }, currentLevel: 10, levelCap: 10,
      traitSlots: emptySlots(),
    });
    other.currentStats = calculateLevelScaledStats(other);

    const fromUntraited = calculateOffspringStats(untraited, other, 'kin_070');
    const fromTraited = calculateOffspringStats(traited, other, 'kin_070');

    expect(fromTraited).toEqual(fromUntraited);
  });

  it('still produces a stronger offspring baseline from higher-LEVEL parents (level scaling survives)', () => {
    // A baseline well above the Cat template floor (42 hp), so Math.max's floor
    // clamp in calculateOffspringStats can't mask the level-scaling difference this
    // test is checking for.
    const highBaseline = { hp: 300, mp: 200, str: 200, def: 160, wis: 120, spd: 120, int: 120 };
    const low = makeParent({
      instanceId: 'low', statBaseline: { ...highBaseline }, currentLevel: 1, levelCap: 50,
    });
    const high = makeParent({
      instanceId: 'high', statBaseline: { ...highBaseline }, currentLevel: 50, levelCap: 50,
    });

    const fromLow = calculateOffspringStats(low, low, 'kin_070');
    const fromHigh = calculateOffspringStats(high, high, 'kin_070');

    expect(fromHigh.hp).toBeGreaterThan(fromLow.hp);
  });
});

describe('resolveInheritedTraitSlots', () => {
  it('leaves a slot empty when neither parent has a trait there', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: emptySlots() });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    const slots = resolveInheritedTraitSlots(a, b, 999);
    expect(slots[0].traitId).toBeNull();
    expect(slots[0].traitLevel).toBe(0);
  });

  it('passes down the trait when only one parent has it in that slot', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: slotsWith({ 0: { traitId: 'sturdy', traitLevel: 3, unlocked: true } }) });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    const slots = resolveInheritedTraitSlots(a, b, 999);
    expect(slots[0].traitId).toBe('sturdy');
  });

  it('passes down parent B\'s trait when only B has one in that slot', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: emptySlots() });
    const b = makeParent({ instanceId: 'b', traitSlots: slotsWith({ 0: { traitId: 'swift', traitLevel: 2, unlocked: true } }) });
    const slots = resolveInheritedTraitSlots(a, b, 999);
    expect(slots[0].traitId).toBe('swift');
  });

  it('defaults to parent A\'s trait when both parents have one in the same slot and no choice is supplied', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: slotsWith({ 0: { traitId: 'sturdy', traitLevel: 3, unlocked: true } }) });
    const b = makeParent({ instanceId: 'b', traitSlots: slotsWith({ 0: { traitId: 'swift', traitLevel: 2, unlocked: true } }) });
    const slots = resolveInheritedTraitSlots(a, b, 999);
    expect(slots[0].traitId).toBe('sturdy');
  });

  it('honors an explicit choice for parent B when both parents contest a slot', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: slotsWith({ 0: { traitId: 'sturdy', traitLevel: 3, unlocked: true } }) });
    const b = makeParent({ instanceId: 'b', traitSlots: slotsWith({ 0: { traitId: 'swift', traitLevel: 2, unlocked: true } }) });
    const slots = resolveInheritedTraitSlots(a, b, 999, ['B']);
    expect(slots[0].traitId).toBe('swift');
  });

  it('always sets inherited traitLevel to 1, regardless of the parent\'s trait level', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: slotsWith({ 0: { traitId: 'sturdy', traitLevel: 3, unlocked: true } }) });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    const slots = resolveInheritedTraitSlots(a, b, 999);
    expect(slots[0].traitLevel).toBe(1);
  });

  it('resolves all four slot indices even when the offspring level opens fewer of them', () => {
    const a = makeParent({
      instanceId: 'a',
      traitSlots: slotsWith({
        0: { traitId: 't0', traitLevel: 1, unlocked: true },
        1: { traitId: 't1', traitLevel: 1, unlocked: true },
        2: { traitId: 't2', traitLevel: 1, unlocked: true },
        3: { traitId: 't3', traitLevel: 1, unlocked: true },
      }),
    });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    // permanentLevel 1 opens zero slots (thresholds are 5/10/20/30), yet every
    // parent slot had a trait to escrow.
    const slots = resolveInheritedTraitSlots(a, b, 1);
    expect(slots.map((s) => s.traitId)).toEqual(['t0', 't1', 't2', 't3']);
  });

  it('escrows a trait inherited into a not-yet-open slot: retained, unlocked:false', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: slotsWith({ 3: { traitId: 'deep-trait', traitLevel: 1, unlocked: true } }) });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    // permanentLevel 20 opens 3 slots (5/10/20), slot index 3 (threshold 30) stays locked.
    const slots = resolveInheritedTraitSlots(a, b, 20);
    expect(unlockedSlotCount(20)).toBe(3);
    expect(slots[3].traitId).toBe('deep-trait'); // nothing dropped
    expect(slots[3].unlocked).toBe(false);
  });

  it('marks slots unlocked purely by offspring permanentLevel, matching unlockedSlotCount', () => {
    const a = makeParent({ instanceId: 'a', traitSlots: emptySlots() });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    const level = TRAIT_SLOT_LEVELS[1]; // opens exactly 2 slots
    const slots = resolveInheritedTraitSlots(a, b, level);
    expect(slots.filter((s) => s.unlocked).length).toBe(unlockedSlotCount(level));
    expect(slots[0].unlocked).toBe(true);
    expect(slots[1].unlocked).toBe(true);
    expect(slots[2].unlocked).toBe(false);
    expect(slots[3].unlocked).toBe(false);
  });
});

describe('breed() trait slot wiring (no star-based unlocking)', () => {
  it('derives unlocked slot count from the offspring\'s carried-over permanentLevel, not its star rating', () => {
    // High star rating, but zero essence invested by either parent -> offspring
    // carries over to permanentLevel 1, which opens zero trait slots. A star-based
    // model (unlocked: starRating >= 2/3/4/5) would have unlocked slots here; the
    // permanentLevel-driven model must not.
    const a = makeParent({ instanceId: 'a', starRating: 5, permanentLevel: 50, levelCap: 50, essenceInvested: 0 });
    const b = makeParent({ instanceId: 'b', starRating: 5, permanentLevel: 50, levelCap: 50, essenceInvested: 0 });
    const child = breed(a, b, 'kin_070', []);
    expect(child.permanentLevel).toBe(1);
    expect(child.traitSlots.every((s) => s.unlocked === false)).toBe(true);
  });

  it('inherits a parent trait into the offspring\'s traitSlots end to end', () => {
    const a = makeParent({
      instanceId: 'a',
      traitSlots: slotsWith({ 0: { traitId: 'sturdy', traitLevel: 4, unlocked: true } }),
    });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    const child = breed(a, b, 'kin_070', []);
    expect(child.traitSlots[0].traitId).toBe('sturdy');
    expect(child.traitSlots[0].traitLevel).toBe(1);
  });
});
