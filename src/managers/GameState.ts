import {
  CreatureInstance, RunState, BaseStats,
  STAR_LEVEL_CAPS, STAR_LONGEVITY, generateId,
} from '../types';
import { getTemplate } from '../data/creatures';

class GameStateManager {
  creatureBox: CreatureInstance[] = [];
  runParty: CreatureInstance[] = [];
  townResources = 0;
  breedingStones = 0;
  currentRun: RunState | null = null;
  hasCompletedFirstRun = false;

  createCreatureInstance(speciesId: string, starRating = 0): CreatureInstance {
    const template = getTemplate(speciesId);
    const levelCap = STAR_LEVEL_CAPS[starRating] ?? 5;
    const longevity = STAR_LONGEVITY[starRating] ?? 2;
    return {
      instanceId: generateId(),
      speciesId,
      nickname: null,
      starRating,
      currentLevel: 1,
      levelCap,
      longevity,
      abilities: [...template.defaultAbilities, null, null].slice(0, 4),
      traitSlots: [
        { traitId: null, traitLevel: 0, unlocked: false },
        { traitId: null, traitLevel: 0, unlocked: false },
        { traitId: null, traitLevel: 0, unlocked: false },
        { traitId: null, traitLevel: 0, unlocked: false },
      ],
      lineage: { parentA: null, parentB: null },
      currentStats: { ...template.baseStats },
      resistances: [...template.resistances],
      weaknesses: [...template.weaknesses],
      isRetired: false,
      isBreedReady: false,
      xp: 0,
    };
  }

  calculateStatsForLevel(instance: CreatureInstance): BaseStats {
    const template = getTemplate(instance.speciesId);
    const base = template.baseStats;
    const level = instance.currentLevel;
    const cap = instance.levelCap;
    const statNames: (keyof BaseStats)[] = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'];
    const result: BaseStats = { ...base };
    for (const stat of statNames) {
      const maxStat = base[stat] * 2.5;
      result[stat] = Math.floor(base[stat] + (maxStat - base[stat]) * (level / cap));
    }
    return result;
  }

  xpForLevel(level: number): number {
    return level * 12;
  }

  tryLevelUp(instance: CreatureInstance): boolean {
    if (instance.currentLevel >= instance.levelCap) return false;
    const needed = this.xpForLevel(instance.currentLevel);
    if (instance.xp >= needed) {
      instance.xp -= needed;
      instance.currentLevel++;
      instance.currentStats = this.calculateStatsForLevel(instance);
      if (instance.currentLevel >= instance.levelCap) {
        instance.isBreedReady = true;
      }
      return true;
    }
    return false;
  }

  addToBox(instance: CreatureInstance): void {
    this.creatureBox.push(instance);
  }

  removeFromBox(instanceId: string): CreatureInstance | undefined {
    const idx = this.creatureBox.findIndex(c => c.instanceId === instanceId);
    if (idx === -1) return undefined;
    return this.creatureBox.splice(idx, 1)[0];
  }

  getBoxCreature(instanceId: string): CreatureInstance | undefined {
    return this.creatureBox.find(c => c.instanceId === instanceId);
  }

  setRunParty(instanceIds: string[]): void {
    this.runParty = instanceIds
      .map(id => this.creatureBox.find(c => c.instanceId === id))
      .filter((c): c is CreatureInstance => c !== undefined);
  }

  startRun(): void {
    // Tick longevity for all party members
    for (const c of this.runParty) {
      c.longevity = Math.max(0, c.longevity - 1);
      // Reset level for the run
      c.currentLevel = 1;
      c.xp = 0;
      c.isBreedReady = false;
      c.currentStats = this.calculateStatsForLevel(c);
    }
  }

  endRun(success: boolean): void {
    if (success) {
      this.townResources += 30;
      this.breedingStones += 1;
    } else {
      this.townResources += 10;
    }
    // Reset creatures back to level 1 for box storage
    for (const c of this.runParty) {
      c.currentLevel = 1;
      c.xp = 0;
      c.currentStats = this.calculateStatsForLevel(c);
    }
    // Add captured creatures to box
    if (this.currentRun) {
      for (const captured of this.currentRun.capturedCreatures) {
        if (success) {
          this.addToBox(captured);
        }
      }
    }
    this.currentRun = null;
  }

  initializeNewGame(starterIds: string[]): void {
    this.creatureBox = [];
    for (const id of starterIds) {
      this.addToBox(this.createCreatureInstance(id, 0));
    }
    this.townResources = 0;
    this.breedingStones = 0;
    this.hasCompletedFirstRun = false;
  }

  saveToLocalStorage(): void {
    const data = {
      creatureBox: this.creatureBox,
      townResources: this.townResources,
      breedingStones: this.breedingStones,
      hasCompletedFirstRun: this.hasCompletedFirstRun,
    };
    localStorage.setItem('hollow_kin_save', JSON.stringify(data));
  }

  loadFromLocalStorage(): boolean {
    const raw = localStorage.getItem('hollow_kin_save');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.creatureBox = data.creatureBox;
      this.townResources = data.townResources;
      this.breedingStones = data.breedingStones;
      this.hasCompletedFirstRun = data.hasCompletedFirstRun;
      return true;
    } catch {
      return false;
    }
  }
}

export const gameState = new GameStateManager();
