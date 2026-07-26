import { describe, it, expect } from 'vitest';
import { breed, carryoverForParents, calculateOffspringStar } from './BreedingSystem';
import { CreatureInstance } from '../types';

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
