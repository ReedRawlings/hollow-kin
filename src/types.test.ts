import { describe, it, expect } from 'vitest';
import {
  scaledDelay, COMBAT_DELAY_ACTION, COMBAT_DELAY_TURN_END, COMBAT_DELAY_FLOOR,
} from './types';

describe('scaledDelay', () => {
  it('leaves delays untouched at 1x', () => {
    expect(scaledDelay(COMBAT_DELAY_ACTION, 1)).toBe(800);
  });

  it('halves at 2x and quarters at 4x', () => {
    expect(scaledDelay(COMBAT_DELAY_ACTION, 2)).toBe(400);
    expect(scaledDelay(COMBAT_DELAY_ACTION, 4)).toBe(200);
  });

  it('never drops below the floor', () => {
    expect(scaledDelay(COMBAT_DELAY_TURN_END, 4)).toBe(COMBAT_DELAY_FLOOR);
    expect(scaledDelay(120, 4)).toBe(COMBAT_DELAY_FLOOR);
  });
});
