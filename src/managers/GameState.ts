import {
  CreatureInstance, RunState, BaseStats, TraitSlot, Backpack,
  STAR_LEVEL_CAPS, generateId, isBossFloor, TOWER_FLOORS,
  BattleSpeed, TacticId, BACKPACK_START_GUARANTEED,
} from '../types';
import { getTemplate } from '../data/creatures';
import { convertObolsToEssence, essenceCostForLevel, depthUnlockCost, depthRunFee } from '../systems/Economy';
import { unlockedSlotCount, applyStatTraitBonuses, MAX_TRAIT_SLOTS } from '../systems/Traits';
import { createBackpack, applyWipeLoss, unloadCapturesToBox } from '../systems/Backpack';

const STAT_NAMES: (keyof BaseStats)[] = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'];

/**
 * Level-scaled stats for `instance`, EXCLUDING trait bonuses — a pure function of the
 * instance's own fields (statBaseline/currentLevel/levelCap), with no dependency on the
 * gameState singleton. `calculateStatsForLevel` (the instance method below) is this plus
 * `applyStatTraitBonuses` as a final, separable step.
 *
 * This is the seam Fix 2 needed: `BreedingSystem.calculateOffspringStats` used to average
 * parents' `currentStats`, which (since stat traits shipped) already has trait bonuses
 * baked in — inflating the child's heritable baseline on top of the child separately
 * re-inheriting the trait at L1, compounding every generation. Reading `statBaseline`
 * directly would have thrown out level scaling too, which is intentionally load-bearing
 * for inheritance (see breeding-and-inheritance.md — stats are meant to compound with
 * level across generations, just not with trait strength). This function keeps exactly
 * the level-scaling half and drops only the trait half, so BreedingSystem can import it
 * and feed parents' pre-trait, level-scaled stats into the averaging instead.
 */
export function calculateLevelScaledStats(instance: CreatureInstance): BaseStats {
  const template = getTemplate(instance.speciesId);
  // Protect runtime callers holding a pre-v5 object. Save migration backfills
  // the field before persisted creatures reach this path.
  const base = instance.statBaseline ?? template.baseStats;
  const level = instance.currentLevel;
  const cap = instance.levelCap;
  const result: BaseStats = { ...base };
  for (const stat of STAT_NAMES) {
    const maxStat = base[stat] * 2.5;
    result[stat] = Math.floor(base[stat] + (maxStat - base[stat]) * (level / cap));
  }
  return result;
}

class GameStateManager {
  creatureBox: CreatureInstance[] = [];
  runParty: CreatureInstance[] = [];
  essence = 0;
  deepestBreakCleared = 0;
  selectedStartFloor = 1;
  currentRun: RunState | null = null;
  hasCompletedFirstRun = false;
  seenSpecies: Set<string> = new Set();
  battleSpeed: BattleSpeed = 1;
  /** Instance ids of the standing party. Persisted; resolved via resolvePartyStatus. */
  defaultParty: string[] = [];
  /** Floors purchased from the Gatekeeper. Floor 1 is always available and never stored. */
  unlockedFloors: number[] = [];
  /**
   * Carried cargo — captures, consumables, marks, traits. Persistent, not run-scoped:
   * a town purchase sits here until the next descent, and a capture that doesn't fit
   * the Box on exit waits here for room rather than being destroyed. Used to live on
   * RunState and be recreated every run; v6 moved it here so it survives between them.
   */
  backpack: Backpack = createBackpack();

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
      // Built from MAX_TRAIT_SLOTS rather than hardcoded literals: if TRAIT_SLOT_LEVELS
      // ever grows a fifth threshold, new creatures pick it up automatically instead of
      // silently getting fewer slots than offspring (resolveInheritedTraitSlots already
      // sizes itself off MAX_TRAIT_SLOTS).
      traitSlots: Array.from({ length: MAX_TRAIT_SLOTS }, () => ({
        traitId: null, traitLevel: 0, unlocked: false,
      })),
      lineage: { parentA: null, parentB: null },
      statBaseline: { ...template.baseStats },
      currentStats: { ...template.baseStats },
      resistances: [...template.resistances],
      weaknesses: [...template.weaknesses],
      isRetired: false,
      isBreedReady: false,
      xp: 0,
      tactic: 'fight_wisely',
    };
  }

  calculateStatsForLevel(instance: CreatureInstance): BaseStats {
    // Stat traits (unlocked slots with a non-null traitId only) layer on top of the
    // level-scaled result, as a distinguishable final step. Kept as a separate composable
    // step in Traits.ts — see its doc comment for why — rather than inlined into the
    // loop below. calculateLevelScaledStats is exported precisely so a caller that needs
    // the pre-trait figure (BreedingSystem's inheritance math — see Fix 2) can ask for it
    // without also pulling in trait inflation.
    return applyStatTraitBonuses(calculateLevelScaledStats(instance), instance);
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
      // Breed-readiness is derived from permanentLevel (see isCreatureBreedReady in
      // systems/Traits.ts) — in-run levelling must never confer it.
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
    this.unlockEarnedTraitSlots(instance);
    return true;
  }

  /**
   * Unlock any trait slots whose permanentLevel threshold is now met. Slots unlock
   * EMPTY (unlocked: true, traitId stays null — no random roll anywhere in this
   * codebase) and unlocking is monotonic: this only ever sets `unlocked` to true,
   * never back to false, so an already-unlocked slot is never re-locked.
   */
  private unlockEarnedTraitSlots(instance: CreatureInstance): void {
    const earned = unlockedSlotCount(instance.permanentLevel);
    for (let i = 0; i < earned; i++) {
      const slot = instance.traitSlots[i];
      if (slot) slot.unlocked = true;
    }
  }

  /** Record clearing a boss on `floor`. Only boss floors count; keeps the running max. */
  recordBreakCleared(floor: number): void {
    if (!isBossFloor(floor)) return;
    if (floor > this.deepestBreakCleared) this.deepestBreakCleared = floor;
  }

  /** Note that the player has met this species; unlocks weakness use for auto-combat. */
  recordSeenSpecies(speciesId: string): void {
    this.seenSpecies.add(speciesId);
  }

  /** Cycle 1x -> 2x -> 4x -> 1x. Returns the new speed. */
  cycleBattleSpeed(): BattleSpeed {
    this.battleSpeed = this.battleSpeed === 1 ? 2 : this.battleSpeed === 2 ? 4 : 1;
    return this.battleSpeed;
  }

  setDefaultParty(instanceIds: string[]): void {
    this.defaultParty = [...instanceIds];
  }

  /**
   * Floors a run may start on: floor 1, plus every floor purchased at the Gatekeeper.
   * Clearing a break no longer grants a deep start on its own — it makes one purchasable.
   */
  unlockedStartFloors(): number[] {
    return [1, ...this.unlockedFloors].sort((a, b) => a - b);
  }

  /**
   * Floors granted by clearing breaks up to `deepestBreakCleared`, under the current
   * 5-floor cadence (clear the break at f -> floor f+1 is earned). Single source of
   * truth for this mapping — used both to compute what's purchasable now and, in the
   * v3->v4 migration, to grant what a returning player already earned under the old
   * rules. Keeping this in one place means retuning the break cadence can't make the
   * two drift apart.
   */
  private floorsEarnedByBreaks(): number[] {
    const out: number[] = [];
    for (let f = 5; f <= this.deepestBreakCleared && f + 1 <= TOWER_FLOORS; f += 5) {
      out.push(f + 1);
    }
    return out;
  }

  /** Floors whose break is cleared but which have not been bought yet. */
  purchasableFloors(): number[] {
    return this.floorsEarnedByBreaks().filter(floor => !this.unlockedFloors.includes(floor));
  }

  /** Buy a permanent unlock. Returns false if not purchasable, already owned, or unaffordable. */
  purchaseFloorUnlock(floor: number): boolean {
    if (!this.purchasableFloors().includes(floor)) return false;
    const cost = depthUnlockCost(floor);
    if (this.essence < cost) return false;
    this.essence -= cost;
    this.unlockedFloors.push(floor);
    this.unlockedFloors.sort((a, b) => a - b);
    return true;
  }

  /** Whether the per-run fee for `floor` is affordable right now. Floor 1 is always true. */
  canAffordStartFloor(floor: number): boolean {
    return this.essence >= depthRunFee(floor);
  }

  /**
   * Whether departing from `floor` will succeed. This is the exact precondition of
   * resolveRunStartFloor(), expressed once so the UI gate and the charge cannot
   * drift apart — the same reason resolvePartyStatus exists for the party half.
   */
  canDepartFrom(floor: number): boolean {
    if (floor <= 1) return true;
    return this.unlockedStartFloors().includes(floor) && this.canAffordStartFloor(floor);
  }

  /** Choose a start floor for the next run. Only floors unlocked (purchased) are accepted. */
  setSelectedStartFloor(floor: number): boolean {
    if (!this.unlockedStartFloors().includes(floor)) return false;
    this.selectedStartFloor = floor;
    return true;
  }

  /**
   * Charge for and return the floor this run begins on.
   *
   * Deliberately throws rather than falling back. Departing from a floor the player did
   * not choose reads as a bug, so an unaffordable or unowned selection is a programming
   * error here — DepartureScene is the gate that must prevent it reaching this point.
   */
  resolveRunStartFloor(): number {
    const chosen = this.selectedStartFloor;
    if (chosen <= 1) return 1;
    if (!this.unlockedStartFloors().includes(chosen)) {
      throw new Error(`Start floor ${chosen} is not unlocked`);
    }
    const fee = depthRunFee(chosen);
    if (this.essence < fee) {
      throw new Error(`Cannot afford the ${fee} Essence fee for floor ${chosen}`);
    }
    this.essence -= fee;
    return chosen;
  }

  addToBox(instance: CreatureInstance): void {
    this.creatureBox.push(instance);
  }

  /**
   * How many creatures the Box can still take. The Box is unbounded today, so this is
   * effectively infinite — it exists as the seam for the bounded, Essence-expandable
   * capacity the capture spec calls for. When that lands, only this method changes;
   * the box-full behaviour on exit is already handled by `unloadCapturesToBox`.
   */
  boxSpaceRemaining(): number {
    return Number.POSITIVE_INFINITY;
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
    // A wipe takes exactly one unprotected thing before anything comes home — never
    // the whole bag, and never a party creature. Everything else is carried out.
    if (!success) {
      const { bag } = applyWipeLoss(this.backpack, Math.random);
      this.backpack = bag;
    }
    // Captures move to the Box up to the space available; anything that does not fit
    // stays in the bag for next time rather than being destroyed.
    const { bag, moved } = unloadCapturesToBox(this.backpack, this.boxSpaceRemaining());
    this.backpack = bag;
    for (const entry of moved) this.addToBox(entry.instance);
    this.currentRun = null;
  }

  initializeNewGame(starterIds: string[]): void {
    this.creatureBox = [];
    for (const id of starterIds) {
      this.addToBox(this.createCreatureInstance(id, 0));
    }
    this.essence = 0;
    this.deepestBreakCleared = 0;
    this.selectedStartFloor = 1;
    this.hasCompletedFirstRun = false;
    this.seenSpecies = new Set();
    this.battleSpeed = 1;
    this.defaultParty = [];
    this.unlockedFloors = [];
    this.backpack = createBackpack();
  }

  saveToLocalStorage(): void {
    const data = {
      version: 6,
      creatureBox: this.creatureBox,
      essence: this.essence,
      deepestBreakCleared: this.deepestBreakCleared,
      selectedStartFloor: this.selectedStartFloor,
      hasCompletedFirstRun: this.hasCompletedFirstRun,
      seenSpecies: [...this.seenSpecies],
      battleSpeed: this.battleSpeed,
      defaultParty: this.defaultParty,
      unlockedFloors: this.unlockedFloors,
      backpack: this.backpack,
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
      // v3 additions — absent on v2 saves, so default safely.
      this.seenSpecies = new Set<string>(data.seenSpecies ?? []);
      this.battleSpeed = (data.battleSpeed ?? 1) as BattleSpeed;
      // v6: backpack moved from RunState to here. A pre-v6 save (or one saved mid-run,
      // pre-migration, with no backpack field at all) has nothing to restore — hand it
      // a fresh bag rather than leaving it undefined.
      this.backpack = (data.backpack && Array.isArray(data.backpack.slots))
        ? {
          slots: [...data.backpack.slots],
          guaranteedSlots: data.backpack.guaranteedSlots ?? BACKPACK_START_GUARANTEED,
        }
        : createBackpack();
      // v4 additions.
      // `defaultParty` has no old-semantics value to preserve when absent — there was
      // nothing like it pre-v4 — so a plain `?? []` is correct as-is. Unlike
      // `unlockedFloors` below, presence-checking here would buy nothing; don't "fix"
      // this into an Array.isArray check.
      this.defaultParty = data.defaultParty ?? [];
      if (Array.isArray(data.unlockedFloors)) {
        this.unlockedFloors = [...data.unlockedFloors];
        // v4 save: this is the player's own current choice — preserve it verbatim.
        this.selectedStartFloor = data.selectedStartFloor ?? 1;
      } else {
        // v3 save: cleared breaks already granted deep starts under the old rules.
        // Grant them outright so nobody is asked to re-buy depth they earned.
        // Presence, not emptiness, is the test — a v4 player who owns nothing must stay that way.
        this.unlockedFloors = this.floorsEarnedByBreaks();
        // A v3 save's selectedStartFloor was chosen under the old rules: a different
        // per-run fee formula ((floor-1)*15 vs the new (floor-1)*5) and floors that
        // auto-unlocked on clearing a break rather than being purchased. That value is
        // not meaningful under the new contract, so we don't carry it forward — this is
        // true independent of the fact that a stale deep value here would otherwise reach
        // resolveRunStartFloor()'s throw the moment an ordinary returning player's Essence
        // falls short of the new fee. Declining to carry forward a *migrated* setting whose
        // meaning changed is not the same as substituting the player's live choice at
        // departure time, which remains forbidden — resolveRunStartFloor() keeps throwing
        // for a v4 save's genuinely unaffordable/unowned selection.
        this.selectedStartFloor = 1;
      }
      this.creatureBox = (data.creatureBox ?? []).map((c: any) => {
        const { longevity, ...rest } = c; // drop longevity if present
        const template = getTemplate(c.speciesId);
        const permanentLevel = c.permanentLevel ?? 1;
        return {
          ...rest,
          permanentLevel,
          essenceInvested: c.essenceInvested ?? 0,
          tactic: (c.tactic ?? 'fight_wisely') as TacticId,
          // Trait slots are unlockable purely by permanentLevel (unlockedSlotCount), but
          // the only place that ever unlocks one — spendEssenceOnLevel — is unreachable
          // for a creature already sitting at its levelCap on load. Recompute what's
          // earned here too so a creature bought straight to its cap before this save
          // ever gets its slots. Also normalizes array length to MAX_TRAIT_SLOTS: an
          // older/shorter traitSlots array (or one with a hole) would otherwise diverge
          // from what resolveInheritedTraitSlots always builds for offspring.
          traitSlots: this.normalizeTraitSlots(c.traitSlots, permanentLevel),
          // v5: old, freshly-bred creatures still hold their unscaled inherited
          // stats in currentStats. Preserve those when possible; if an earlier run
          // already replaced them with template-scaled stats, the species baseline
          // is the only trustworthy fallback.
          statBaseline: c.statBaseline
            ? { ...c.statBaseline }
            : c.lineage?.parentA && c.currentLevel === (c.permanentLevel ?? 1)
              && !this.matchesLegacyTemplateScale(c)
              ? { ...c.currentStats }
              : { ...template.baseStats },
        } as CreatureInstance;
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize a loaded creature's traitSlots to exactly MAX_TRAIT_SLOTS entries,
   * preserving any stored traitId/traitLevel by position. `unlocked` is the OR of
   * "the permanent-level threshold for this index is already met" and "the save
   * already recorded it unlocked" — the OR is what keeps this monotonic: a slot a
   * player already unlocked can never read back as locked, even if some future
   * threshold retune would otherwise imply it shouldn't be earned yet at this level.
   */
  private normalizeTraitSlots(rawSlots: unknown, permanentLevel: number): TraitSlot[] {
    const earned = unlockedSlotCount(permanentLevel);
    const stored = Array.isArray(rawSlots) ? rawSlots : [];
    return Array.from({ length: MAX_TRAIT_SLOTS }, (_, i) => {
      const slot = stored[i] as Partial<TraitSlot> | undefined;
      return {
        traitId: slot?.traitId ?? null,
        traitLevel: slot?.traitLevel ?? 0,
        unlocked: i < earned || slot?.unlocked === true,
      };
    });
  }

  private matchesLegacyTemplateScale(creature: any): boolean {
    const base = getTemplate(creature.speciesId).baseStats;
    const level = creature.currentLevel ?? 1;
    const cap = creature.levelCap ?? 5;
    const statNames: (keyof BaseStats)[] = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'];
    return statNames.every(stat => {
      const expected = Math.floor(base[stat] + (base[stat] * 2.5 - base[stat]) * (level / cap));
      return creature.currentStats?.[stat] === expected;
    });
  }
}

export const gameState = new GameStateManager();
