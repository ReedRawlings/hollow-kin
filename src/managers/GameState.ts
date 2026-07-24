import {
  CreatureInstance, RunState, BaseStats,
  STAR_LEVEL_CAPS, generateId, isBossFloor, TOWER_FLOORS,
} from '../types';
import { getTemplate } from '../data/creatures';
import { convertObolsToEssence, essenceCostForLevel } from '../systems/Economy';

class GameStateManager {
  creatureBox: CreatureInstance[] = [];
  runParty: CreatureInstance[] = [];
  essence = 0;
  deepestBreakCleared = 0;
  currentRun: RunState | null = null;
  hasCompletedFirstRun = false;

  createCreatureInstance(speciesId: string, starRating = 0): CreatureInstance {
    const template = getTemplate(speciesId);
    const levelCap = STAR_LEVEL_CAPS[starRating] ?? 5;
    return {
      instanceId: generateId(),
      speciesId,
      nickname: null,
      starRating,
      currentLevel: 1,
      levelCap,
      permanentLevel: 1,
      essenceInvested: 0,
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

  /** Spend Essence to raise a creature's permanent level floor by one. Returns false if unaffordable or capped. */
  spendEssenceOnLevel(instance: CreatureInstance): boolean {
    if (instance.permanentLevel >= instance.levelCap) return false;
    const cost = essenceCostForLevel(instance.permanentLevel);
    if (this.essence < cost) return false;
    this.essence -= cost;
    instance.essenceInvested += cost;
    instance.permanentLevel++;
    instance.currentLevel = instance.permanentLevel;
    instance.currentStats = this.calculateStatsForLevel(instance);
    return true;
  }

  /** Record clearing a boss on `floor`. Only boss floors count; keeps the running max. */
  recordBreakCleared(floor: number): void {
    if (!isBossFloor(floor)) return;
    if (floor > this.deepestBreakCleared) this.deepestBreakCleared = floor;
  }

  /** Floors a run may start on: floor 1, plus the floor after each cleared 5-floor break. */
  unlockedStartFloors(): number[] {
    const floors = [1];
    for (let f = 5; f <= this.deepestBreakCleared && f + 1 <= TOWER_FLOORS; f += 5) floors.push(f + 1);
    return floors;
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
    for (const c of this.runParty) {
      // Start each run at the permanent essence-bought floor, not level 1
      c.currentLevel = c.permanentLevel;
      c.xp = 0;
      c.isBreedReady = false;
      c.currentStats = this.calculateStatsForLevel(c);
    }
  }

  endRun(success: boolean, leftoverObols: number): void {
    // Convert leftover (unspent) Obols to permanent Essence. A wipe (!success) loses half first.
    this.essence += convertObolsToEssence(leftoverObols, { isWipe: !success });
    // Reset in-run temporary level back down to the permanent floor for box storage
    for (const c of this.runParty) {
      c.currentLevel = c.permanentLevel;
      c.xp = 0;
      c.currentStats = this.calculateStatsForLevel(c);
    }
    if (this.currentRun) {
      for (const captured of this.currentRun.capturedCreatures) {
        if (success) this.addToBox(captured);
      }
    }
    this.currentRun = null;
  }

  initializeNewGame(starterIds: string[]): void {
    this.creatureBox = [];
    for (const id of starterIds) {
      this.addToBox(this.createCreatureInstance(id, 0));
    }
    this.essence = 0;
    this.deepestBreakCleared = 0;
    this.hasCompletedFirstRun = false;
  }

  saveToLocalStorage(): void {
    const data = {
      version: 2,
      creatureBox: this.creatureBox,
      essence: this.essence,
      deepestBreakCleared: this.deepestBreakCleared,
      hasCompletedFirstRun: this.hasCompletedFirstRun,
    };
    localStorage.setItem('hollow_kin_save', JSON.stringify(data));
  }

  loadFromLocalStorage(): boolean {
    const raw = localStorage.getItem('hollow_kin_save');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      // Essence: new field, else migrate old townResources, else 0
      this.essence = data.essence ?? data.townResources ?? 0;
      this.deepestBreakCleared = data.deepestBreakCleared ?? 0;
      this.hasCompletedFirstRun = data.hasCompletedFirstRun ?? false;
      this.creatureBox = (data.creatureBox ?? []).map((c: any) => {
        const { longevity, ...rest } = c; // drop longevity if present
        return {
          ...rest,
          permanentLevel: c.permanentLevel ?? 1,
          essenceInvested: c.essenceInvested ?? 0,
        } as CreatureInstance;
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const gameState = new GameStateManager();
