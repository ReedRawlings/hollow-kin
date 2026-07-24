import { beforeAll } from 'vitest';
beforeAll(() => {
  if (typeof (globalThis as any).localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    };
  }
});

import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from './GameState';

beforeEach(() => {
  gameState.initializeNewGame(['ironjaw', 'stoneguard', 'voltarc']);
});

describe('createCreatureInstance', () => {
  it('starts at permanent level 1 with no essence invested and no longevity', () => {
    const c = gameState.createCreatureInstance('ironjaw', 0);
    expect(c.permanentLevel).toBe(1);
    expect(c.currentLevel).toBe(1);
    expect(c.essenceInvested).toBe(0);
    expect('longevity' in c).toBe(false);
  });
});

describe('startRun', () => {
  it('starts creatures at their permanent level floor, not 1', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 8;
    gameState.setRunParty([c.instanceId]);
    gameState.startRun();
    expect(gameState.runParty[0].currentLevel).toBe(8);
  });
});

describe('endRun obol conversion', () => {
  it('converts 100% of leftover obols to essence on success', () => {
    gameState.essence = 0;
    gameState.setRunParty([gameState.creatureBox[0].instanceId]);
    gameState.startRun();
    gameState.currentRun = null; // no captures
    gameState.endRun(true, 100); // 100 * 0.5 = 50
    expect(gameState.essence).toBe(50);
  });
  it('halves leftover obols on a wipe before converting', () => {
    gameState.essence = 0;
    gameState.setRunParty([gameState.creatureBox[0].instanceId]);
    gameState.startRun();
    gameState.currentRun = null;
    gameState.endRun(false, 100); // 100 -> 50 -> *0.5 = 25
    expect(gameState.essence).toBe(25);
  });
});

describe('spendEssenceOnLevel', () => {
  it('buys a permanent level when affordable and deducts essence', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 1;
    c.essenceInvested = 0;
    gameState.essence = 100;
    const ok = gameState.spendEssenceOnLevel(c);
    expect(ok).toBe(true);
    expect(c.permanentLevel).toBe(2);
    expect(gameState.essence).toBe(90); // cost 10
    expect(c.essenceInvested).toBe(10);
  });
  it('refuses when essence is insufficient', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 5;
    gameState.essence = 1; // cost floor(10*5^1.5)=111
    const ok = gameState.spendEssenceOnLevel(c);
    expect(ok).toBe(false);
    expect(c.permanentLevel).toBe(5);
    expect(gameState.essence).toBe(1);
  });
  it('refuses at the level cap', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = c.levelCap;
    gameState.essence = 100000;
    const ok = gameState.spendEssenceOnLevel(c);
    expect(ok).toBe(false);
  });
  it('succeeds at exact-cost boundary, spending to zero', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 1;
    c.essenceInvested = 0;
    gameState.essence = 10; // exactly the cost for level 1->2
    const ok = gameState.spendEssenceOnLevel(c);
    expect(ok).toBe(true);
    expect(c.permanentLevel).toBe(2);
    expect(gameState.essence).toBe(0);
  });
});

describe('save/load migration', () => {
  it('round-trips the new save shape', () => {
    gameState.essence = 42;
    gameState.hasCompletedFirstRun = true;
    gameState.saveToLocalStorage();
    gameState.essence = 0;
    gameState.hasCompletedFirstRun = false;
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.essence).toBe(42);
    expect(gameState.hasCompletedFirstRun).toBe(true);
  });

  it('migrates an old save (townResources->essence, backfills fields, drops longevity)', () => {
    const oldSave = {
      creatureBox: [{
        instanceId: 'old1', speciesId: 'ironjaw', nickname: null, starRating: 0,
        currentLevel: 1, levelCap: 5, longevity: 2,
        abilities: ['tackle', null, null, null],
        traitSlots: [{ traitId: null, traitLevel: 0, unlocked: false }],
        lineage: { parentA: null, parentB: null },
        currentStats: { hp: 30, mp: 5, str: 10, def: 8, wis: 5, spd: 7, int: 4 },
        resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
      }],
      townResources: 90,
      breedingStones: 3,
      hasCompletedFirstRun: true,
    };
    localStorage.setItem('hollow_kin_save', JSON.stringify(oldSave));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.essence).toBe(90);            // townResources -> essence
    const c = gameState.creatureBox[0];
    expect(c.permanentLevel).toBe(1);              // backfilled
    expect(c.essenceInvested).toBe(0);             // backfilled
    expect('longevity' in c).toBe(false);          // dropped
  });
});

describe('deepest-break tracking', () => {
  it('starts at 0 and only records boss floors, keeping the max', () => {
    expect(gameState.deepestBreakCleared).toBe(0);
    gameState.recordBreakCleared(5);
    expect(gameState.deepestBreakCleared).toBe(5);
    gameState.recordBreakCleared(10);
    expect(gameState.deepestBreakCleared).toBe(10);
    gameState.recordBreakCleared(5); // lower — ignored
    expect(gameState.deepestBreakCleared).toBe(10);
  });

  it('ignores non-boss floors', () => {
    gameState.recordBreakCleared(7);
    expect(gameState.deepestBreakCleared).toBe(0);
  });

  it('unlockedStartFloors returns floor 1 plus the floor after each cleared break', () => {
    expect(gameState.unlockedStartFloors()).toEqual([1]);
    gameState.recordBreakCleared(10);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6, 11]);
  });

  it('persists deepestBreakCleared across save/load', () => {
    gameState.recordBreakCleared(15);
    gameState.saveToLocalStorage();
    gameState.deepestBreakCleared = 0;
    gameState.loadFromLocalStorage();
    expect(gameState.deepestBreakCleared).toBe(15);
  });

  it('defaults deepestBreakCleared to 0 when loading an older save', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 2, creatureBox: [], essence: 5, hasCompletedFirstRun: true,
    }));
    gameState.loadFromLocalStorage();
    expect(gameState.deepestBreakCleared).toBe(0);
  });
});
