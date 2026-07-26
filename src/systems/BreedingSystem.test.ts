import { describe, it, expect } from 'vitest';
import { breed, carryoverForParents, calculateOffspringStar, resolveInheritedTraitSlots } from './BreedingSystem';
import { CreatureInstance, TraitSlot } from '../types';
import { unlockedSlotCount, MAX_TRAIT_SLOTS, TRAIT_SLOT_LEVELS } from './Traits';

// Minimal creature-instance factory for tests (only fields breeding reads).
function makeParent(overrides: Partial<CreatureInstance>): CreatureInstance {
  return {
    instanceId: 'p', speciesId: 'ironjaw', nickname: null, starRating: 1,
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
    const child = breed(a, b, 'ironjaw', []);
    expect(child.permanentLevel).toBe(2);
    expect(child.currentLevel).toBe(2);
    expect(child.essenceInvested).toBe(10);
  });

  it('still retires both parents', () => {
    const a = makeParent({ instanceId: 'a', essenceInvested: 0 });
    const b = makeParent({ instanceId: 'b', essenceInvested: 0 });
    breed(a, b, 'ironjaw', []);
    expect(a.isRetired).toBe(true);
    expect(b.isRetired).toBe(true);
  });

  it('stores inherited stats as the offspring permanent baseline', () => {
    const inherited = { hp: 120, mp: 90, str: 72, def: 66, wis: 60, spd: 54, int: 48 };
    const a = makeParent({ instanceId: 'a', currentStats: inherited });
    const b = makeParent({ instanceId: 'b', currentStats: inherited });
    const child = breed(a, b, 'ironjaw', []);

    expect(child.statBaseline).toEqual({
      hp: 40, mp: 30, str: 24, def: 22, wis: 20, spd: 18, int: 16,
    });
    expect(child.currentStats).toEqual(child.statBaseline);
    expect(child.currentStats).not.toBe(child.statBaseline);
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
    const child = breed(a, b, 'ironjaw', []);
    expect(child.permanentLevel).toBe(1);
    expect(child.traitSlots.every((s) => s.unlocked === false)).toBe(true);
  });

  it('inherits a parent trait into the offspring\'s traitSlots end to end', () => {
    const a = makeParent({
      instanceId: 'a',
      traitSlots: slotsWith({ 0: { traitId: 'sturdy', traitLevel: 4, unlocked: true } }),
    });
    const b = makeParent({ instanceId: 'b', traitSlots: emptySlots() });
    const child = breed(a, b, 'ironjaw', []);
    expect(child.traitSlots[0].traitId).toBe('sturdy');
    expect(child.traitSlots[0].traitLevel).toBe(1);
  });
});
