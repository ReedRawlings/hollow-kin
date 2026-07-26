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
import { estimateDamage, NO_KNOWLEDGE } from '../systems/TacticsAI';
import { makeTestCreature } from '../systems/testFixtures';
import { getAbility } from '../data/abilities';
import { depthUnlockCost, depthRunFee } from '../systems/Economy';
import { breed } from '../systems/BreedingSystem';
import { isCreatureBreedReady, TRAIT_SLOT_LEVELS, MAX_TRAIT_SLOTS, unlockedSlotCount } from '../systems/Traits';
import { STAR_LEVEL_CAPS } from '../types';
import { getTemplate } from '../data/creatures';

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

  it('scales a real offspring from its inherited baseline instead of its species template', () => {
    const parentA = gameState.createCreatureInstance('ironjaw');
    const parentB = gameState.createCreatureInstance('ironjaw');
    // calculateOffspringStats (Fix 2) reads statBaseline/currentLevel/levelCap, not
    // currentStats directly — give both parents a strong, fully-leveled baseline instead
    // of forcing currentStats the way this test used to.
    const strongBaseline = { hp: 240, mp: 240, str: 240, def: 240, wis: 240, spd: 240, int: 240 };
    parentA.statBaseline = { ...strongBaseline };
    parentB.statBaseline = { ...strongBaseline };
    parentA.currentLevel = parentA.levelCap; // level === cap -> level-scaled stat is base * 2.5 (max)
    parentB.currentLevel = parentB.levelCap;

    const child = breed(parentA, parentB, 'ironjaw', []);
    const inheritedHp = child.statBaseline!.hp;

    // Inherited baseline comes from the parents' strong stats, not the ironjaw species
    // template floor.
    expect(inheritedHp).toBeGreaterThan(getTemplate('ironjaw').baseStats.hp);

    gameState.creatureBox = [child];
    gameState.setRunParty([child.instanceId]);
    gameState.startRun();

    // startRun scales the child up from its own inherited statBaseline, not the template.
    expect(child.currentStats.hp).toBeGreaterThan(inheritedHp);
    expect(child.statBaseline!.hp).toBe(inheritedHp);
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

  it('keeps using an offspring-specific baseline after a permanent level purchase', () => {
    const c = gameState.creatureBox[0];
    c.statBaseline = { hp: 100, mp: 50, str: 40, def: 30, wis: 25, spd: 20, int: 15 };
    gameState.essence = 10;

    expect(gameState.spendEssenceOnLevel(c)).toBe(true);
    expect(c.currentStats.hp).toBe(160);
    expect(c.statBaseline.hp).toBe(100);
  });
});

describe('save/load migration', () => {
  it('round-trips the new save shape', () => {
    gameState.creatureBox[0].statBaseline!.hp = 77;
    gameState.essence = 42;
    gameState.hasCompletedFirstRun = true;
    gameState.saveToLocalStorage();
    gameState.essence = 0;
    gameState.hasCompletedFirstRun = false;
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.essence).toBe(42);
    expect(gameState.hasCompletedFirstRun).toBe(true);
    expect(gameState.creatureBox[0].statBaseline!.hp).toBe(77);
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
    expect(c.statBaseline!.hp).toBe(40);             // species baseline backfilled
    expect('longevity' in c).toBe(false);          // dropped
    // Fix 1: the loaded traitSlots array is normalized to MAX_TRAIT_SLOTS entries, even
    // though this save only stored one.
    expect(c.traitSlots.length).toBe(MAX_TRAIT_SLOTS);
  });

  describe('trait slot normalization on load (Fix 1)', () => {
    function saveWith(creatureOverrides: Record<string, unknown>) {
      return {
        version: 5,
        creatureBox: [{
          instanceId: 'c1', speciesId: 'ironjaw', nickname: null, starRating: 0,
          currentLevel: 1, levelCap: 5, permanentLevel: 1, essenceInvested: 0,
          abilities: [], lineage: { parentA: null, parentB: null },
          statBaseline: { hp: 40, mp: 20, str: 18, def: 8, wis: 7, spd: 16, int: 6 },
          currentStats: { hp: 40, mp: 20, str: 18, def: 8, wis: 7, spd: 16, int: 6 },
          resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
          ...creatureOverrides,
        }],
        essence: 0,
      };
    }

    it('unlocks the earned slots for a creature saved already sitting at its levelCap (the unreachable-unlock bug)', () => {
      // spendEssenceOnLevel — the only other place that unlocks a slot — early-returns at
      // the level cap, so a creature saved already at its cap could otherwise never have
      // its earned slots unlocked. Loading must recompute this directly from permanentLevel.
      localStorage.setItem('hollow_kin_save', JSON.stringify(saveWith({
        permanentLevel: TRAIT_SLOT_LEVELS[1], levelCap: TRAIT_SLOT_LEVELS[1],
        traitSlots: [],
      })));
      expect(gameState.loadFromLocalStorage()).toBe(true);
      const c = gameState.creatureBox[0];
      expect(c.traitSlots.length).toBe(MAX_TRAIT_SLOTS);
      expect(unlockedSlotCount(TRAIT_SLOT_LEVELS[1])).toBe(2);
      expect(c.traitSlots.filter(s => s.unlocked).length).toBe(unlockedSlotCount(TRAIT_SLOT_LEVELS[1]));
      expect(c.traitSlots[0].unlocked).toBe(true);
      expect(c.traitSlots[1].unlocked).toBe(true);
      expect(c.traitSlots[2].unlocked).toBe(false);
    });

    it('normalizes a short traitSlots array to MAX_TRAIT_SLOTS, preserving the stored slot by position', () => {
      localStorage.setItem('hollow_kin_save', JSON.stringify(saveWith({
        traitSlots: [{ traitId: 'sturdy', traitLevel: 3, unlocked: true }],
      })));
      expect(gameState.loadFromLocalStorage()).toBe(true);
      const c = gameState.creatureBox[0];
      expect(c.traitSlots.length).toBe(MAX_TRAIT_SLOTS);
      expect(c.traitSlots[0].traitId).toBe('sturdy');
      expect(c.traitSlots[0].traitLevel).toBe(3);
      expect(c.traitSlots[0].unlocked).toBe(true);
      // The rest are backfilled empty, not left undefined.
      for (let i = 1; i < MAX_TRAIT_SLOTS; i++) {
        expect(c.traitSlots[i].traitId).toBeNull();
      }
    });

    it('keeps a stored unlocked:true slot unlocked even when permanentLevel is below its threshold (monotonic OR)', () => {
      localStorage.setItem('hollow_kin_save', JSON.stringify(saveWith({
        permanentLevel: 1, levelCap: TRAIT_SLOT_LEVELS[3],
        traitSlots: [
          { traitId: null, traitLevel: 0, unlocked: false },
          { traitId: null, traitLevel: 0, unlocked: false },
          { traitId: null, traitLevel: 0, unlocked: false },
          { traitId: 'deep-trait', traitLevel: 1, unlocked: true }, // stored unlocked beyond threshold
        ],
      })));
      expect(gameState.loadFromLocalStorage()).toBe(true);
      const c = gameState.creatureBox[0];
      expect(unlockedSlotCount(1)).toBe(0); // permanentLevel alone would unlock nothing
      expect(c.traitSlots[3].unlocked).toBe(true); // but the stored flag is preserved
      expect(c.traitSlots[3].traitId).toBe('deep-trait');
    });
  });

  it('preserves unscaled inherited stats when migrating a freshly-bred pre-v5 creature', () => {
    const inherited = { hp: 100, mp: 50, str: 40, def: 30, wis: 25, spd: 20, int: 15 };
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 4,
      creatureBox: [{
        instanceId: 'old-child', speciesId: 'ironjaw', nickname: null, starRating: 0,
        currentLevel: 1, levelCap: 5, permanentLevel: 1, essenceInvested: 0,
        abilities: [], traitSlots: [], lineage: { parentA: 'a', parentB: 'b' },
        currentStats: inherited, resistances: [], weaknesses: [],
        isRetired: false, isBreedReady: false, xp: 0,
      }],
    }));

    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.creatureBox[0].statBaseline).toEqual(inherited);
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

  it('clearing a break makes its floor purchasable, not unlocked outright', () => {
    expect(gameState.unlockedStartFloors()).toEqual([1]);
    gameState.recordBreakCleared(10);
    expect(gameState.purchasableFloors()).toEqual([6, 11]);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('caps purchasableFloors at the tower top when the tower is fully cleared', () => {
    gameState.deepestBreakCleared = 30;
    expect(gameState.purchasableFloors()).toEqual([6, 11, 16, 21, 26]);
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

describe('depth-jump start floor', () => {
  it('defaults to floor 1', () => {
    expect(gameState.selectedStartFloor).toBe(1);
  });

  it('setSelectedStartFloor only accepts purchased floors, not merely cleared-break floors', () => {
    gameState.recordBreakCleared(10); // makes [6,11] purchasable, not unlocked
    expect(gameState.setSelectedStartFloor(11)).toBe(false); // not bought yet
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(11);
    expect(gameState.setSelectedStartFloor(11)).toBe(true);
    expect(gameState.selectedStartFloor).toBe(11);
    expect(gameState.setSelectedStartFloor(16)).toBe(false); // never purchased
    expect(gameState.selectedStartFloor).toBe(11);           // unchanged
  });

  it('resolveRunStartFloor deducts the per-run fee and returns the chosen floor when affordable', () => {
    gameState.recordBreakCleared(10);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(11);
    gameState.setSelectedStartFloor(11);
    const before = gameState.essence;
    const floor = gameState.resolveRunStartFloor();
    expect(floor).toBe(11);
    expect(gameState.essence).toBe(before - depthRunFee(11));
  });

  it('throws rather than falling back to floor 1 when the selected floor is unaffordable', () => {
    gameState.recordBreakCleared(10);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(11);
    gameState.setSelectedStartFloor(11);
    gameState.essence = 1; // below depthRunFee(11)
    expect(() => gameState.resolveRunStartFloor()).toThrow();
    expect(gameState.essence).toBe(1);
  });

  it('resolveRunStartFloor returns 1 (free) when selection is floor 1', () => {
    gameState.essence = 100;
    expect(gameState.resolveRunStartFloor()).toBe(1);
    expect(gameState.essence).toBe(100);
  });

  it('persists selectedStartFloor across save/load', () => {
    gameState.recordBreakCleared(10);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.setSelectedStartFloor(6);
    gameState.saveToLocalStorage();
    gameState.selectedStartFloor = 1;
    gameState.loadFromLocalStorage();
    expect(gameState.selectedStartFloor).toBe(6);
  });
});

describe('tactics and settings persistence', () => {
  it('gives new creatures the balanced tactic by default', () => {
    const c = gameState.createCreatureInstance('ironjaw', 0);
    expect(c.tactic).toBe('fight_wisely');
  });

  it('records seen species without duplicates', () => {
    gameState.seenSpecies = new Set();
    gameState.recordSeenSpecies('ironjaw');
    gameState.recordSeenSpecies('ironjaw');
    expect(gameState.seenSpecies.size).toBe(1);
    expect(gameState.seenSpecies.has('ironjaw')).toBe(true);
  });

  it('round-trips seenSpecies, battleSpeed, and tactic through save/load', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.creatureBox[0].tactic = 'heal_first';
    gameState.seenSpecies = new Set(['mossgolem', 'petalward']);
    gameState.battleSpeed = 4;
    gameState.saveToLocalStorage();

    gameState.creatureBox = [];
    gameState.seenSpecies = new Set();
    gameState.battleSpeed = 1;
    expect(gameState.loadFromLocalStorage()).toBe(true);

    expect(gameState.creatureBox[0].tactic).toBe('heal_first');
    expect(gameState.battleSpeed).toBe(4);
    expect([...gameState.seenSpecies].sort()).toEqual(['mossgolem', 'petalward']);
  });

  it('cycles battle speed 1 -> 2 -> 4 -> 1', () => {
    expect(gameState.battleSpeed).toBe(1);
    expect(gameState.cycleBattleSpeed()).toBe(2);
    expect(gameState.battleSpeed).toBe(2);
    expect(gameState.cycleBattleSpeed()).toBe(4);
    expect(gameState.battleSpeed).toBe(4);
    expect(gameState.cycleBattleSpeed()).toBe(1);
    expect(gameState.battleSpeed).toBe(1);
  });

  it('migrates a v2 save with safe defaults', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 2,
      essence: 40,
      deepestBreakCleared: 5,
      selectedStartFloor: 1,
      hasCompletedFirstRun: true,
      creatureBox: [{
        instanceId: 'old-1', speciesId: 'ironjaw', nickname: null, starRating: 1,
        currentLevel: 3, levelCap: 10, abilities: ['ember'], traitSlots: [],
        lineage: { parentA: null, parentB: null },
        currentStats: { hp: 50, mp: 10, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
        resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
      }],
    }));

    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.creatureBox[0].tactic).toBe('fight_wisely');
    expect(gameState.battleSpeed).toBe(1);
    expect(gameState.seenSpecies.size).toBe(0);
    expect(gameState.essence).toBe(40);
  });
});

describe('seenSpecies fog timing (finding 2 regression)', () => {
  // Pins *when* recordSeenSpecies must be called relative to a battle, not
  // just that it eventually gets called (the dedup test above already covers
  // that). CombatScene originally called it inside initBattle() — before
  // nextTurn() ever runs, i.e. before the AI evaluates the fight the species
  // belongs to — so `known.has(foe.speciesId)` was always true and the fog
  // could never suppress a type multiplier. CombatScene can't be exercised
  // here without a Phaser harness, so this pins the same defect shape one
  // layer down: it fails if a species is marked "seen" before the AI's
  // damage estimate for *that same fight* is taken, and passes only when the
  // recording happens after — mirroring CombatScene.showBattleEnd(), the
  // sole choke point both battle-end paths (VICTORY and DEFEAT) pass through.
  it('stays blind to a species until it is recorded, and only reflects the weakness afterward', () => {
    gameState.seenSpecies = new Set();

    const attacker = makeTestCreature({ speciesId: 'attacker' });
    const foe = makeTestCreature({ speciesId: 'weak-foe', weaknesses: ['Fire'] });
    const ability = getAbility('ember');
    const blindDamage = estimateDamage(attacker, foe, ability, NO_KNOWLEDGE);

    // "Battle start" — mirrors CombatScene.initBattle(). The species must not
    // be known yet, and the AI's estimate for this fight must match the
    // fully-blind baseline exactly.
    expect(gameState.seenSpecies.has(foe.instance.speciesId)).toBe(false);
    const midBattleDamage = estimateDamage(attacker, foe, ability, gameState.seenSpecies);
    expect(midBattleDamage).toBe(blindDamage);

    // "Battle resolution" — mirrors CombatScene.showBattleEnd(), called
    // regardless of victory or defeat.
    gameState.recordSeenSpecies(foe.instance.speciesId);

    expect(gameState.seenSpecies.has(foe.instance.speciesId)).toBe(true);
    const nextBattleDamage = estimateDamage(attacker, foe, ability, gameState.seenSpecies);
    expect(nextBattleDamage).toBeGreaterThan(blindDamage);
  });
});

describe('default party', () => {
  it('is empty on a new game', () => {
    gameState.initializeNewGame(['ironjaw']);
    expect(gameState.defaultParty).toEqual([]);
  });

  it('stores a copy, so later edits to the caller array do not leak in', () => {
    const ids = ['a', 'b', 'c'];
    gameState.setDefaultParty(ids);
    ids.push('d');
    expect(gameState.defaultParty).toEqual(['a', 'b', 'c']);
  });

  it('round-trips through save and load', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.setDefaultParty(['x', 'y', 'z']);
    gameState.saveToLocalStorage();
    gameState.defaultParty = [];
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.defaultParty).toEqual(['x', 'y', 'z']);
  });
});

describe('floor unlocks', () => {
  beforeEach(() => {
    gameState.initializeNewGame(['ironjaw']);
  });

  it('offers nothing to buy before any break is cleared', () => {
    expect(gameState.purchasableFloors()).toEqual([]);
  });

  it('offers floor 6 once the floor-5 break is cleared', () => {
    gameState.recordBreakCleared(5);
    expect(gameState.purchasableFloors()).toEqual([6]);
  });

  it('starts with only floor 1 available even after clearing a break', () => {
    gameState.recordBreakCleared(5);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('adds a floor to the available list once bought, and stops offering it', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    expect(gameState.purchaseFloorUnlock(6)).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6]);
    expect(gameState.purchasableFloors()).toEqual([]);
  });

  it('deducts the unlock cost', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    const before = gameState.essence;
    gameState.purchaseFloorUnlock(6);
    expect(gameState.essence).toBe(before - depthUnlockCost(6));
  });

  it('refuses a floor whose break has not been cleared', () => {
    gameState.essence = 10_000;
    expect(gameState.purchaseFloorUnlock(6)).toBe(false);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('refuses when the player cannot afford it, without deducting', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 1;
    expect(gameState.purchaseFloorUnlock(6)).toBe(false);
    expect(gameState.essence).toBe(1);
  });

  it('does not double-charge for a floor already owned', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    const after = gameState.essence;
    expect(gameState.purchaseFloorUnlock(6)).toBe(false);
    expect(gameState.essence).toBe(after);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6]);
  });

  it('keeps available floors sorted regardless of purchase order', () => {
    gameState.recordBreakCleared(10);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(11);
    gameState.purchaseFloorUnlock(6);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6, 11]);
  });

  it('round-trips unlocked floors through save and load', () => {
    gameState.recordBreakCleared(10);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.saveToLocalStorage();
    gameState.unlockedFloors = [];
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6]);
  });
});

describe('resolveRunStartFloor', () => {
  beforeEach(() => {
    gameState.initializeNewGame(['ironjaw']);
  });

  it('is free at floor 1 and deducts nothing', () => {
    gameState.essence = 100;
    gameState.selectedStartFloor = 1;
    expect(gameState.resolveRunStartFloor()).toBe(1);
    expect(gameState.essence).toBe(100);
  });

  it('returns the selected floor and deducts exactly its fee', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.setSelectedStartFloor(6);
    const before = gameState.essence;
    expect(gameState.resolveRunStartFloor()).toBe(6);
    expect(gameState.essence).toBe(before - depthRunFee(6));
  });

  it('throws rather than departing from a floor the player cannot afford', () => {
    // Never substitute: picking floor 6 and silently starting on floor 1 reads as a bug.
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.setSelectedStartFloor(6);
    gameState.essence = 0;
    expect(() => gameState.resolveRunStartFloor()).toThrow();
  });

  it('throws rather than departing from a floor that was never unlocked', () => {
    gameState.selectedStartFloor = 11; // forced past setSelectedStartFloor's guard
    gameState.essence = 10_000;
    expect(() => gameState.resolveRunStartFloor()).toThrow();
  });

  it('does not deduct essence when it throws', () => {
    gameState.selectedStartFloor = 11;
    gameState.essence = 10_000;
    expect(() => gameState.resolveRunStartFloor()).toThrow();
    expect(gameState.essence).toBe(10_000);
  });
});

describe('canAffordStartFloor', () => {
  it('is always true for floor 1, even with no essence', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.essence = 0;
    expect(gameState.canAffordStartFloor(1)).toBe(true);
  });

  it('tracks the per-run fee for deeper floors', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.essence = depthRunFee(6);
    expect(gameState.canAffordStartFloor(6)).toBe(true);
    gameState.essence = depthRunFee(6) - 1;
    expect(gameState.canAffordStartFloor(6)).toBe(false);
  });
});

describe('canDepartFrom', () => {
  // The point of this suite is the equivalence itself — canDepartFrom(f) must return
  // true exactly when resolveRunStartFloor() (run against the same state) would not
  // throw. A test that only asserted canDepartFrom's own return value in isolation
  // would not catch the two drifting apart (finding 2); this checks them together,
  // across a spread of states, every time.
  function resolveRunStartFloorThrows(): boolean {
    try {
      gameState.resolveRunStartFloor();
      return false;
    } catch {
      return true;
    }
  }

  function assertEquivalence(floor: number): void {
    const before = gameState.essence;
    gameState.selectedStartFloor = floor;
    const departable = gameState.canDepartFrom(floor);
    const threw = resolveRunStartFloorThrows();
    gameState.essence = before; // undo any charge resolveRunStartFloor may have taken
    expect(departable).toBe(!threw);
  }

  it('floor 1 is always departable, even with no essence and nothing unlocked', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.essence = 0;
    assertEquivalence(1);
    expect(gameState.canDepartFrom(1)).toBe(true);
  });

  it('a floor that is unlocked and affordable is departable', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.essence = depthRunFee(6);
    assertEquivalence(6);
    expect(gameState.canDepartFrom(6)).toBe(true);
  });

  it('a floor that is unlocked but unaffordable is not departable', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.essence = depthRunFee(6) - 1;
    assertEquivalence(6);
    expect(gameState.canDepartFrom(6)).toBe(false);
  });

  it('a floor that was never unlocked is not departable, even flush with essence', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.essence = 10_000;
    // Never unlocked floor 6 — set selectedStartFloor directly, bypassing the guard
    // in setSelectedStartFloor, the same way a stale/forced value could reach here.
    assertEquivalence(6);
    expect(gameState.canDepartFrom(6)).toBe(false);
  });
});

describe('save v3 -> v4 migration', () => {
  it('grants unlocked floors for breaks already cleared, so no depth is lost', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 3,
      essence: 500,
      deepestBreakCleared: 10,
      selectedStartFloor: 1,
      hasCompletedFirstRun: true,
      creatureBox: [],
      seenSpecies: [],
      battleSpeed: 1,
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6, 11]);
    expect(gameState.defaultParty).toEqual([]);
    expect(gameState.essence).toBe(500);
  });

  it('grants nothing when no break was cleared', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 3, essence: 0, deepestBreakCleared: 0,
      selectedStartFloor: 1, hasCompletedFirstRun: false,
      creatureBox: [], seenSpecies: [], battleSpeed: 1,
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('does not re-grant on a v4 save that deliberately owns nothing', () => {
    // A v4 player who cleared breaks but chose not to buy must stay unbought.
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 4, essence: 0, deepestBreakCleared: 10,
      selectedStartFloor: 1, hasCompletedFirstRun: true,
      creatureBox: [], seenSpecies: [], battleSpeed: 1,
      defaultParty: [], unlockedFloors: [],
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('resets a v3 save\'s selectedStartFloor to 1 while still granting the earned unlocks', () => {
    // v3's selectedStartFloor: 11 was chosen under the old rules (auto-unlock + a
    // different fee formula). It must not survive the migration verbatim, but the
    // unlocked-floor grant (tested above) must still happen.
    // Poison the in-memory field to something other than 1 first: gameState is a
    // singleton and beforeEach happens to already leave it at 1, so without this the
    // assertion below would pass by coincidence even if load() stopped touching the
    // field entirely — it must be load() actively normalizing it, not an accident of
    // prior state.
    gameState.selectedStartFloor = 999;
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 3,
      essence: 500,
      deepestBreakCleared: 10,
      selectedStartFloor: 11,
      hasCompletedFirstRun: true,
      creatureBox: [], seenSpecies: [], battleSpeed: 1,
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.selectedStartFloor).toBe(1);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6, 11]);
  });

  it('regression: a v3 save with low Essence no longer crashes resolveRunStartFloor on load', () => {
    // Before the fix, selectedStartFloor: 11 carried over verbatim. A returning player
    // whose Essence didn't cover the new (floor-1)*5 fee for floor 11 would hit an
    // uncaught throw the moment RunScene.init() called resolveRunStartFloor() — no dev
    // tools or manual state poking required, just an ordinary low-Essence returning player.
    // Poisoned for the same reason as above: gameState is a singleton and beforeEach
    // already leaves selectedStartFloor at 1, so this write is what makes the assertions
    // below actually exercise load()'s migration logic instead of passing by coincidence.
    gameState.selectedStartFloor = 999;
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 3,
      essence: 1, // far below the fee for floor 11 under the new formula
      deepestBreakCleared: 10,
      selectedStartFloor: 11,
      hasCompletedFirstRun: true,
      creatureBox: [], seenSpecies: [], battleSpeed: 1,
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(() => gameState.resolveRunStartFloor()).not.toThrow();
    expect(gameState.resolveRunStartFloor()).toBe(1);
  });

  it('preserves a v4 save\'s selectedStartFloor as-is (migration reset does not apply)', () => {
    // A v4 save's selectedStartFloor is the player's own current, live choice and must
    // not be clobbered — the reset is a migration-only decision for v3 saves.
    gameState.selectedStartFloor = 999; // poison, see above
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 4, essence: 10_000, deepestBreakCleared: 10,
      selectedStartFloor: 6, hasCompletedFirstRun: true,
      creatureBox: [], seenSpecies: [], battleSpeed: 1,
      defaultParty: [], unlockedFloors: [6],
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.selectedStartFloor).toBe(6);
  });
});

describe('breed-readiness (derived)', () => {
  // Both regressions share one root cause: isBreedReady used to be a stored flag,
  // set only inside in-run leveling (tryLevelUp) and reset at the top of every run
  // (startRun). isCreatureBreedReady derives it from permanentLevel/levelCap alone,
  // so neither path can affect it anymore.

  it('regression: buying a creature straight to its level cap makes it breed-ready (previously impossible)', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = c.levelCap - 1;
    gameState.essence = 1_000_000;
    expect(isCreatureBreedReady(c)).toBe(false);

    const ok = gameState.spendEssenceOnLevel(c);

    expect(ok).toBe(true);
    expect(c.permanentLevel).toBe(c.levelCap);
    expect(isCreatureBreedReady(c)).toBe(true);
  });

  it('regression: breed-readiness survives startRun() (previously wiped every run)', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = c.levelCap;
    expect(isCreatureBreedReady(c)).toBe(true);

    gameState.setRunParty([c.instanceId]);
    gameState.startRun();

    expect(isCreatureBreedReady(gameState.runParty[0])).toBe(true);
  });

  it('in-run leveling (tryLevelUp) never confers breed-readiness, only permanentLevel does', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 1; // far below cap
    c.currentLevel = c.levelCap - 1;
    c.xp = 1_000_000;

    const ok = gameState.tryLevelUp(c);

    expect(ok).toBe(true);
    expect(c.currentLevel).toBe(c.levelCap);
    expect(isCreatureBreedReady(c)).toBe(false); // permanentLevel is still 1
  });
});

describe('trait slot unlocking (permanentLevel-driven)', () => {
  it('a purchase reaching the first threshold opens exactly slot 1, empty', () => {
    const c = gameState.creatureBox[0]; // 0-star, levelCap 5 = TRAIT_SLOT_LEVELS[0]
    c.permanentLevel = TRAIT_SLOT_LEVELS[0] - 1;
    gameState.essence = 1_000_000;

    expect(gameState.spendEssenceOnLevel(c)).toBe(true);

    expect(c.permanentLevel).toBe(TRAIT_SLOT_LEVELS[0]);
    expect(c.traitSlots[0].unlocked).toBe(true);
    expect(c.traitSlots[0].traitId).toBeNull(); // unlocks EMPTY, never rolled
    expect(c.traitSlots.slice(1).every(s => !s.unlocked)).toBe(true);
  });

  it('a purchase reaching the second threshold opens slot 2 as well', () => {
    const c = gameState.creatureBox[0];
    c.starRating = 1;
    c.levelCap = STAR_LEVEL_CAPS[1]; // 10 = TRAIT_SLOT_LEVELS[1]
    c.permanentLevel = TRAIT_SLOT_LEVELS[1] - 1;
    gameState.essence = 1_000_000;

    expect(gameState.spendEssenceOnLevel(c)).toBe(true);

    expect(c.permanentLevel).toBe(TRAIT_SLOT_LEVELS[1]);
    expect(c.traitSlots[0].unlocked).toBe(true);
    expect(c.traitSlots[1].unlocked).toBe(true);
    expect(c.traitSlots[1].traitId).toBeNull();
    expect(c.traitSlots.slice(2).every(s => !s.unlocked)).toBe(true);
  });

  it('in-run leveling (tryLevelUp) past a slot threshold unlocks nothing — permanentLevel only', () => {
    const c = gameState.creatureBox[0];
    c.starRating = 1;
    c.levelCap = STAR_LEVEL_CAPS[1]; // 10
    c.permanentLevel = 1; // stays put; only currentLevel moves
    c.currentLevel = TRAIT_SLOT_LEVELS[1] - 1;
    c.xp = 1_000_000;

    expect(gameState.tryLevelUp(c)).toBe(true);

    expect(c.currentLevel).toBe(TRAIT_SLOT_LEVELS[1]);
    expect(c.traitSlots.every(s => !s.unlocked)).toBe(true);
  });

  it('never re-locks a slot that is already unlocked, even when a later purchase would not unlock it on its own', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 1;
    c.traitSlots[2].unlocked = true; // simulate a slot unlocked some other way
    gameState.essence = 1_000_000;

    expect(gameState.spendEssenceOnLevel(c)).toBe(true); // permanentLevel -> 2, below every threshold

    expect(c.traitSlots[2].unlocked).toBe(true); // stays unlocked, monotonic
  });
});

describe('escrowed trait round-trip: breed -> spendEssenceOnLevel unlocks it', () => {
  it('an inherited trait stuck in a locked slot survives to become active once permanentLevel opens that slot', () => {
    // Star 3 gives levelCap 30 == TRAIT_SLOT_LEVELS[3], the last slot's threshold.
    const parentA = gameState.createCreatureInstance('ironjaw', 3);
    const parentB = gameState.createCreatureInstance('ironjaw', 3);
    parentA.traitSlots[3] = { traitId: 'deep-trait', traitLevel: 1, unlocked: true };
    // parentB's slot 3 stays empty; both parents have essenceInvested 0, so the
    // offspring carries over to permanentLevel 1 — well below every threshold.

    const child = breed(parentA, parentB, 'ironjaw', []);

    expect(child.levelCap).toBe(TRAIT_SLOT_LEVELS[3]);
    expect(child.permanentLevel).toBe(1);
    expect(child.traitSlots[3].traitId).toBe('deep-trait'); // escrowed, not dropped
    expect(child.traitSlots[3].unlocked).toBe(false);

    gameState.essence = 10_000_000;
    while (child.permanentLevel < TRAIT_SLOT_LEVELS[3]) {
      expect(gameState.spendEssenceOnLevel(child)).toBe(true);
    }

    expect(child.permanentLevel).toBe(TRAIT_SLOT_LEVELS[3]);
    expect(child.traitSlots[3].unlocked).toBe(true);
    // The regression this guards: unlockEarnedTraitSlots must only flip `unlocked`,
    // never touch `traitId`/`traitLevel` on a slot it opens.
    expect(child.traitSlots[3].traitId).toBe('deep-trait');
    expect(child.traitSlots[3].traitLevel).toBe(1);
  });
});

describe('calculateStatsForLevel — stat trait bonuses', () => {
  it('an unlocked STR Up trait raises STR relative to the same creature without it', () => {
    const plain = gameState.createCreatureInstance('ironjaw', 0);
    const buffed = gameState.createCreatureInstance('ironjaw', 0);
    buffed.traitSlots[0] = { traitId: 'str_up', traitLevel: 1, unlocked: true };

    const plainStats = gameState.calculateStatsForLevel(plain);
    const buffedStats = gameState.calculateStatsForLevel(buffed);

    expect(buffedStats.str).toBeGreaterThan(plainStats.str);
    // Only the targeted stat moves — trait bonuses don't leak across stats.
    expect(buffedStats.hp).toBe(plainStats.hp);
  });

  it('a locked slot holding a traitId (an escrowed inherited trait) contributes nothing', () => {
    const plain = gameState.createCreatureInstance('ironjaw', 0);
    const escrowed = gameState.createCreatureInstance('ironjaw', 0);
    escrowed.traitSlots[0] = { traitId: 'str_up', traitLevel: 4, unlocked: false };

    const plainStats = gameState.calculateStatsForLevel(plain);
    const escrowedStats = gameState.calculateStatsForLevel(escrowed);

    expect(escrowedStats.str).toBe(plainStats.str);
  });

  it('an unlocked slot with a null traitId contributes nothing', () => {
    const plain = gameState.createCreatureInstance('ironjaw', 0);
    const empty = gameState.createCreatureInstance('ironjaw', 0);
    empty.traitSlots[0] = { traitId: null, traitLevel: 0, unlocked: true };

    const plainStats = gameState.calculateStatsForLevel(plain);
    const emptyStats = gameState.calculateStatsForLevel(empty);

    expect(emptyStats.str).toBe(plainStats.str);
  });

  it('a higher trait level yields a larger bonus than a lower one', () => {
    const low = gameState.createCreatureInstance('ironjaw', 0);
    const high = gameState.createCreatureInstance('ironjaw', 0);
    low.traitSlots[0] = { traitId: 'str_up', traitLevel: 1, unlocked: true };
    high.traitSlots[0] = { traitId: 'str_up', traitLevel: 4, unlocked: true };

    const lowStats = gameState.calculateStatsForLevel(low);
    const highStats = gameState.calculateStatsForLevel(high);

    expect(highStats.str).toBeGreaterThan(lowStats.str);
  });

  it('is applied automatically at the natural calculateStatsForLevel call sites (e.g. startRun)', () => {
    const c = gameState.creatureBox[0]; // ironjaw
    c.traitSlots[0] = { traitId: 'str_up', traitLevel: 4, unlocked: true };
    const withoutTrait = gameState.calculateStatsForLevel({ ...c, traitSlots: [] });
    gameState.setRunParty([c.instanceId]);

    gameState.startRun(); // recomputes currentStats via calculateStatsForLevel

    expect(gameState.runParty[0].currentStats.str).toBeGreaterThan(withoutTrait.str);
  });
});
