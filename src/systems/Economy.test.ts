import { describe, it, expect } from 'vitest';
import { convertObolsToEssence, essenceCostForLevel, depthUnlockCost, depthRunFee, levelFromEssence } from './Economy';
import { DEPTH_UNLOCK_COST_PER_FLOOR, DEPTH_RUN_FEE_PER_FLOOR, LEVEL_COST_BASE } from '../types';

// obolsForEncounter is unbranching arithmetic over two tunable constants, and the
// exponent is derived in types.ts rather than asserted here. Nothing to test.

describe('convertObolsToEssence', () => {
  // The rate and the wipe penalty are placeholder numbers on the playtest tuning list.
  // These tests pin the SHAPE of the conversion so retuning either constant costs nothing.
  it('returns 0 for 0 leftover', () => {
    expect(convertObolsToEssence(0)).toBe(0);
  });

  it('always returns a whole, non-negative amount of essence', () => {
    for (const leftover of [1, 15, 37, 100, 999]) {
      const essence = convertObolsToEssence(leftover);
      expect(Number.isInteger(essence)).toBe(true);
      expect(essence).toBeGreaterThanOrEqual(0);
    }
  });

  it('converts more essence the more leftover is carried out', () => {
    expect(convertObolsToEssence(200)).toBeGreaterThan(convertObolsToEssence(100));
  });

  it('a wipe converts strictly less than a clean exit of the same leftover', () => {
    expect(convertObolsToEssence(100, { isWipe: true }))
      .toBeLessThan(convertObolsToEssence(100));
  });

  it('honours an overridden rate (e.g. trait/upgrade boost)', () => {
    // The rate is supplied by the caller here, so it is a contract, not a tuning value.
    expect(convertObolsToEssence(100, { rate: 0.7 })).toBe(70);
    expect(convertObolsToEssence(100, { rate: 0.7 }))
      .toBeGreaterThan(convertObolsToEssence(100, { rate: 0.5 }));
  });
});

describe('essenceCostForLevel', () => {
  it('is anchored to its base constant at level 1, and rises with every level after', () => {
    expect(essenceCostForLevel(1)).toBe(LEVEL_COST_BASE);
    for (let level = 1; level < 20; level++) {
      expect(essenceCostForLevel(level + 1)).toBeGreaterThan(essenceCostForLevel(level));
    }
  });

  it('rises faster than linearly, so deep levels are the real essence sink', () => {
    // Holds for any LEVEL_COST_EXPONENT above 1; fails the moment the curve goes flat.
    expect(essenceCostForLevel(20)).toBeGreaterThan(10 * essenceCostForLevel(2));
  });
});

describe('levelFromEssence', () => {
  // Costs are read from the curve rather than written out, so retuning the curve
  // does not turn this suite red.
  const c1 = essenceCostForLevel(1);
  const c2 = essenceCostForLevel(2);

  it('stays at level 1 with no essence', () => {
    expect(levelFromEssence(0, 50)).toEqual({ level: 1, invested: 0 });
  });
  it('buys exactly one level at the level-1 cost', () => {
    expect(levelFromEssence(c1, 50)).toEqual({ level: 2, invested: c1 });
  });
  it('does not overspend on a partial level', () => {
    expect(levelFromEssence(c1 + c2 - 1, 50)).toEqual({ level: 2, invested: c1 });
  });
  it('buys multiple levels and reports cumulative invested', () => {
    expect(levelFromEssence(c1 + c2, 50)).toEqual({ level: 3, invested: c1 + c2 });
  });
  it('never exceeds the level cap (invested is only what was spent to reach the cap)', () => {
    expect(levelFromEssence(100000, 3)).toEqual({ level: 3, invested: c1 + c2 });
  });
});

describe('depth costs', () => {
  it('applies a flat percentage discount and floors the result', () => {
    expect(depthRunFee(6, 0.1)).toBe(Math.floor(depthRunFee(6) * 0.9));
    expect(depthUnlockCost(6, 0.1)).toBe(Math.floor(depthUnlockCost(6) * 0.9));
  });
  it('are both free at floor 1', () => {
    expect(depthUnlockCost(1)).toBe(0);
    expect(depthRunFee(1)).toBe(0);
  });

  it('never go negative for a nonsensical floor', () => {
    expect(depthUnlockCost(0)).toBe(0);
    expect(depthRunFee(0)).toBe(0);
  });

  it('both rise with depth', () => {
    expect(depthUnlockCost(11)).toBeGreaterThan(depthUnlockCost(6));
    expect(depthRunFee(11)).toBeGreaterThan(depthRunFee(6));
  });

  it('pins the unlock-vs-fee margin, not just the ordering', () => {
    // The split's whole point: a large one-time gate, a small recurring fee. Comparing
    // only depthUnlockCost(f) > depthRunFee(f) would let a 6-vs-5-per-floor retune pass
    // while violating that intent — pin the ratio at the constant level instead.
    expect(DEPTH_UNLOCK_COST_PER_FLOOR).toBeGreaterThanOrEqual(DEPTH_RUN_FEE_PER_FLOOR * 4);
  });

  it('keeps the per-run fee below the old flat per-run cost at every depth', () => {
    // The old (pre-split) model charged a flat (floor - 1) * OLD_FLAT_PER_RUN_COST every
    // single run — this was depthJumpCost, since deleted. OLD_FLAT_PER_RUN_COST is a
    // historical baseline recorded here, not a live constant to keep in sync with
    // anything: the split is only an improvement for the player if the recurring part
    // actually got cheaper than that baseline.
    const OLD_FLAT_PER_RUN_COST = 15;
    for (const floor of [6, 11, 16, 21, 26]) {
      expect(depthRunFee(floor)).toBeLessThan((floor - 1) * OLD_FLAT_PER_RUN_COST);
    }
  });

  it('derives both from their constants, so retuning a constant retunes the curve', () => {
    expect(depthUnlockCost(6)).toBe(5 * DEPTH_UNLOCK_COST_PER_FLOOR);
    expect(depthRunFee(6)).toBe(5 * DEPTH_RUN_FEE_PER_FLOOR);
  });
});
