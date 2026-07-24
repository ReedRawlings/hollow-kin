import { describe, it, expect } from 'vitest';
import { obolsForEncounter, convertObolsToEssence, essenceCostForLevel, depthJumpCost, levelFromEssence } from './Economy';

describe('obolsForEncounter', () => {
  it('gives the normal-combat weight', () => {
    expect(obolsForEncounter('normal')).toBe(5);
  });
  it('gives the mini-boss weight', () => {
    expect(obolsForEncounter('mini')).toBe(25);
  });
  it('gives the major-boss weight', () => {
    expect(obolsForEncounter('major')).toBe(75);
  });
});

describe('convertObolsToEssence', () => {
  it('converts 100% of leftover on a clean exit at the default rate', () => {
    // 100 leftover * 0.5 rate = 50
    expect(convertObolsToEssence(100)).toBe(50);
  });
  it('loses 50% of leftover on a wipe, then converts', () => {
    // 100 -> 50 kept (wipe) * 0.5 rate = 25
    expect(convertObolsToEssence(100, { isWipe: true })).toBe(25);
  });
  it('floors fractional results', () => {
    // 15 * 0.5 = 7.5 -> 7
    expect(convertObolsToEssence(15)).toBe(7);
  });
  it('returns 0 for 0 leftover', () => {
    expect(convertObolsToEssence(0)).toBe(0);
  });
  it('honours an overridden rate (e.g. trait/upgrade boost)', () => {
    // 100 * 0.7 = 70
    expect(convertObolsToEssence(100, { rate: 0.7 })).toBe(70);
  });
  it('floors odd leftover after wipe penalty before rate conversion', () => {
    // 15 * 0.5 wipe-keep = 7.5, * 0.5 rate = 3.75, floored to 3
    expect(convertObolsToEssence(15, { isWipe: true })).toBe(3);
  });
});

describe('essenceCostForLevel', () => {
  it('costs 10 to go from level 1 to 2', () => {
    expect(essenceCostForLevel(1)).toBe(10); // floor(10 * 1^1.5)
  });
  it('rises with level', () => {
    expect(essenceCostForLevel(4)).toBe(80); // floor(10 * 4^1.5 = 80)
    expect(essenceCostForLevel(9)).toBe(270); // floor(10 * 9^1.5 = 270)
  });
});

describe('depthJumpCost', () => {
  it('is free to start at floor 1', () => {
    expect(depthJumpCost(1)).toBe(0);
  });
  it('scales with the start floor', () => {
    expect(depthJumpCost(6)).toBe(75);   // (6-1)*15
    expect(depthJumpCost(11)).toBe(150); // (11-1)*15
    expect(depthJumpCost(26)).toBe(375); // (26-1)*15
  });
});

describe('levelFromEssence', () => {
  it('stays at level 1 with no essence', () => {
    expect(levelFromEssence(0, 50)).toEqual({ level: 1, invested: 0 });
  });
  it('buys exactly one level at the level-1 cost (10)', () => {
    // cost(1)=10 -> reaches level 2, invested 10
    expect(levelFromEssence(10, 50)).toEqual({ level: 2, invested: 10 });
  });
  it('does not overspend on a partial level', () => {
    // 19 essence: buys L1->2 (10), can't afford L2->3 (28). level 2, invested 10.
    expect(levelFromEssence(19, 50)).toEqual({ level: 2, invested: 10 });
  });
  it('buys multiple levels and reports cumulative invested', () => {
    // cost(1)=10, cost(2)=28 -> 38 reaches level 3, invested 38
    expect(levelFromEssence(38, 50)).toEqual({ level: 3, invested: 38 });
  });
  it('never exceeds the level cap (invested is only what was spent to reach the cap)', () => {
    // cap 3: cost(1)=10, cost(2)=28 -> invested 38 reaches level 3, stops even with essence to spare
    expect(levelFromEssence(100000, 3)).toEqual({ level: 3, invested: 38 });
  });
});
