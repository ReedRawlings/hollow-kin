import { describe, it, expect } from 'vitest';
import { convertObolsToEssence, essenceCostForLevel, depthUnlockCost, depthRunFee, levelFromEssence } from './Economy';
import { DEPTH_UNLOCK_COST_PER_FLOOR, DEPTH_RUN_FEE_PER_FLOOR } from '../types';

// obolsForEncounter is unbranching arithmetic over two tunable constants, and the
// exponent is derived in types.ts rather than asserted here. Nothing to test.

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
