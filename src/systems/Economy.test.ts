import { describe, it, expect } from 'vitest';
import { obolsForEncounter, convertObolsToEssence, essenceCostForLevel } from './Economy';

describe('obolsForEncounter', () => {
  it('gives the normal-combat weight', () => {
    expect(obolsForEncounter('normal')).toBe(5);
  });
  it('gives the boss weight', () => {
    expect(obolsForEncounter('boss')).toBe(75);
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
