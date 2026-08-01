import { describe, expect, it } from 'vitest';
import { createSeededRandom } from './SeededRandom';

describe('createSeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createSeededRandom(1729);
    const b = createSeededRandom(1729);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('produces values in the Math.random range', () => {
    const rng = createSeededRandom(1);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
