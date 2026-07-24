import { describe, it, expect } from 'vitest';
import { breed, carryoverForParents } from './BreedingSystem';
import { CreatureInstance } from '../types';

// Minimal creature-instance factory for tests (only fields breeding reads).
function makeParent(overrides: Partial<CreatureInstance>): CreatureInstance {
  return {
    instanceId: 'p', speciesId: 'ironjaw', nickname: null, starRating: 1,
    currentLevel: 1, levelCap: 50, permanentLevel: 1, essenceInvested: 0,
    abilities: [], traitSlots: [], lineage: { parentA: null, parentB: null },
    currentStats: { hp: 30, mp: 5, str: 10, def: 8, wis: 5, spd: 7, int: 4 },
    resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
    ...overrides,
  };
}

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
});
