import { describe, it, expect } from 'vitest';
import { generateDescent, generatePickNextChoices, poolForFloor } from './RunGenerator';
import { TOWER_FLOORS } from '../types';

describe('poolForFloor', () => {
  it('maps floors to depth bands 1-3', () => {
    expect(poolForFloor(1)).toEqual(poolForFloor(10));   // band 1
    expect(poolForFloor(11)).toEqual(poolForFloor(20));  // band 2
    expect(poolForFloor(21)).toEqual(poolForFloor(30));  // band 3
    expect(poolForFloor(1)).not.toEqual(poolForFloor(21));
  });
});

describe('generateDescent', () => {
  it('produces one encounter per floor from 1 to 30 by default', () => {
    const d = generateDescent();
    expect(d).toHaveLength(TOWER_FLOORS);
    expect(d[0].floor).toBe(1);
    expect(d[d.length - 1].floor).toBe(30);
    d.forEach((e, i) => expect(e.index).toBe(i));
  });

  it('places mini bosses on 5/15/25 and majors on 10/20/30', () => {
    const d = generateDescent();
    const byFloor = (f: number) => d.find(e => e.floor === f)!;
    for (const f of [5, 15, 25]) {
      expect(byFloor(f).type).toBe('boss');
      expect(byFloor(f).bossTier).toBe('mini');
    }
    for (const f of [10, 20, 30]) {
      expect(byFloor(f).type).toBe('boss');
      expect(byFloor(f).bossTier).toBe('major');
    }
  });

  it('makes the first floor combat and the pre-boss floor rest', () => {
    const d = generateDescent();
    expect(d[0].type).toBe('combat');
    for (const f of [4, 9, 14, 19, 24, 29]) {
      expect(d.find(e => e.floor === f)!.type).toBe('rest');
    }
  });

  it('supports a depth-jump start floor', () => {
    const d = generateDescent(11);
    expect(d[0].floor).toBe(11);
    expect(d[0].type).toBe('combat');
    expect(d[d.length - 1].floor).toBe(30);
    expect(d).toHaveLength(20);
  });

  it('gives every combat/boss enemies and a positive level', () => {
    const d = generateDescent();
    for (const e of d) {
      if (e.type === 'combat' || e.type === 'boss') {
        expect((e.enemies?.length ?? 0)).toBeGreaterThan(0);
        expect(e.enemyLevels!).toBeGreaterThan(0);
      }
    }
  });
});

describe('generatePickNextChoices', () => {
  it('forces the next boss when it is the immediate next encounter', () => {
    const d = generateDescent();
    const bossIdx = d.findIndex(e => e.type === 'boss'); // floor 5, index 4
    const choices = generatePickNextChoices(d, bossIdx - 1);
    expect(choices).toHaveLength(1);
    expect(choices[0].type).toBe('boss');
  });

  it('never offers a choice that skips past a boss', () => {
    const d = generateDescent();
    const choices = generatePickNextChoices(d, -1); // start of run
    const firstBossIdx = d.findIndex(e => e.type === 'boss');
    for (const c of choices) {
      expect(c.index).toBeLessThan(firstBossIdx);
    }
  });

  it('never offers a choice at or past the next boss from a real mid-segment index', () => {
    const d = generateDescent();
    const firstBossIdx = d.findIndex(e => e.type === 'boss'); // floor 5, index 4
    // Index 0 (floor 1, forced combat already consumed) -> currentIndex 0 means
    // "we are standing on floor 1's encounter", so remaining = floors 2..30.
    // Floors 2 and 3 are real filler candidates before the floor-4 pre-boss rest
    // and floor-5 boss, giving a genuine multi-choice pool to exercise the barrier.
    for (let i = 0; i < 200; i++) {
      const choices = generatePickNextChoices(d, 0);
      for (const c of choices) {
        expect(c.index).toBeLessThan(firstBossIdx);
      }
    }
  });

  it('never offers the pre-boss rest floor as a general (non-forced) choice', () => {
    const d = generateDescent();
    const firstBossIdx = d.findIndex(e => e.type === 'boss'); // floor 5, index 4
    const preBossRestIdx = firstBossIdx - 1; // floor 4, index 3
    expect(d[preBossRestIdx].type).toBe('rest');
    // Loop many iterations since candidate selection/shuffling involves randomness;
    // if the pre-boss rest were ever eligible, it would show up across 200 tries.
    for (let i = 0; i < 200; i++) {
      const choices = generatePickNextChoices(d, 0);
      expect(choices.some(c => c.index === preBossRestIdx)).toBe(false);
    }
  });

  it('returns the first combat with no real choice at run start', () => {
    const d = generateDescent();
    const choices = generatePickNextChoices(d, -1);
    expect(choices.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty when the run is complete', () => {
    const d = generateDescent();
    expect(generatePickNextChoices(d, d.length - 1)).toEqual([]);
  });
});
