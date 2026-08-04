import { describe, expect, it } from 'vitest';
import {
  beginSharedActionRound, canSpendSharedActions, createSharedActionPool,
  spendSharedActions,
} from './SharedActionPool';

describe('Shared Action Pool', () => {
  it('starts full at three and refreshes rather than banking between rounds', () => {
    const initial = createSharedActionPool();
    expect(initial).toEqual({ points: 3, cap: 3 });

    const spent = spendSharedActions(initial, 2)!;
    expect(spent.points).toBe(1);
    expect(beginSharedActionRound(spent)).toEqual({ points: 3, cap: 3 });
  });

  it('pays zero-cost fallbacks and rejects overdrafts or invalid costs', () => {
    const state = createSharedActionPool();
    expect(canSpendSharedActions(state, 0)).toBe(true);
    expect(spendSharedActions(state, 0)).toEqual(state);
    expect(spendSharedActions(state, 4)).toBeNull();
    expect(spendSharedActions(state, -1)).toBeNull();
    expect(spendSharedActions(state, 1.5)).toBeNull();
  });
});
