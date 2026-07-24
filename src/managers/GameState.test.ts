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
});
