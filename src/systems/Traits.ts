import { STAR_LEVEL_CAPS, CreatureInstance, BaseStats } from '../types';
import { TRAIT_LIBRARY, TraitDefinition } from '../data/traits';
import { CREATURE_TEMPLATES } from '../data/creatures';

/**
 * Permanent-level thresholds at which a new trait slot unlocks. Pinned to the 0★-3★
 * STAR_LEVEL_CAPS — each star tier through 3★ buys exactly one more slot, and a
 * creature's final reachable slot opens the same beat it hits its cap and becomes
 * breed-ready. If STAR_LEVEL_CAPS changes for those tiers, this moves with it —
 * see traits-system.md.
 */
export const TRAIT_SLOT_LEVELS: number[] = [
  STAR_LEVEL_CAPS[0], STAR_LEVEL_CAPS[1], STAR_LEVEL_CAPS[2], STAR_LEVEL_CAPS[3],
];

export const MAX_TRAIT_SLOTS = TRAIT_SLOT_LEVELS.length;

/**
 * How many trait slots are unlocked at a given permanent level. `permanentLevel` only —
 * the temporary in-run `currentLevel` must never be passed here; it never unlocks a slot.
 * Slots unlock EMPTY: this only reports capacity, never rolls or assigns content.
 */
export function unlockedSlotCount(permanentLevel: number): number {
  return TRAIT_SLOT_LEVELS.filter((threshold) => permanentLevel >= threshold).length;
}

/**
 * Whether a creature is breed-ready: derived from its permanent essence-bought
 * floor alone, never from the temporary in-run `currentLevel`. Breed-readiness
 * used to be a stored flag (`CreatureInstance.isBreedReady`) set only inside
 * in-run leveling, which meant a creature bought straight to its cap could
 * never earn it, and starting a new run before breeding wiped it. Deriving it
 * here fixes both: it is simply always in sync with `permanentLevel`.
 *
 * `isBreedReady` remains on `CreatureInstance` for now (deliberately deferred
 * cleanup) but is unused — callers should use this helper instead.
 */
export function isCreatureBreedReady(creature: CreatureInstance): boolean {
  return creature.permanentLevel >= creature.levelCap;
}

const TRAIT_UPGRADE_COSTS: Record<1 | 2 | 3, number> = {
  1: 240, // L1 -> L2
  2: 540, // L2 -> L3
  3: 960, // L3 -> L4
};

/**
 * Essence cost to upgrade a trait from `fromLevel` to `fromLevel + 1`. Placeholders —
 * see traits-system.md: roughly one mid-game permanent level per upgrade. Retune
 * alongside LEVEL_COST_BASE/LEVEL_COST_EXPONENT if that curve moves.
 */
export function traitUpgradeCost(fromLevel: 1 | 2 | 3): number {
  return TRAIT_UPGRADE_COSTS[fromLevel];
}

/** Small consolation Essence value for selling back a duplicate of an already-held trait. */
const DUPLICATE_SELL_VALUE = 20;

/** Essence value of selling a duplicate trait back to the Trait-keeper. 0 for an unknown id. */
export function duplicateSellValue(traitId: string): number {
  return getTrait(traitId) ? DUPLICATE_SELL_VALUE : 0;
}

/** A lookup source for species compatibility checks — structurally satisfied by CreatureTemplate. */
type TraitPoolSource = Record<string, { naturalTraitPool?: string[] }>;

/**
 * Whether `speciesId` can be imbued with `traitId`, per its `naturalTraitPool`.
 *
 * STRICT (deny-by-default): a species with no pool defined, or an entirely unknown
 * species id, cannot take any trait. A trait must appear in the species' curated
 * `naturalTraitPool` to be allowed — compatibility is authored per species (Task 4),
 * never randomly assigned. A strong trait the player cannot use on the creature they
 * wanted is an intended outcome, not a bug.
 *
 * `templates` defaults to the real creature template table; tests may inject a
 * stand-in map to exercise the strict path without touching real species data.
 */
export function canSpeciesTakeTrait(
  speciesId: string,
  traitId: string,
  templates: TraitPoolSource = CREATURE_TEMPLATES,
): boolean {
  const pool = templates[speciesId]?.naturalTraitPool;
  if (!pool) return false;
  return pool.includes(traitId);
}

/** Look up a trait's definition by id. Returns undefined (never throws) for an unknown id. */
export function getTrait(traitId: string): TraitDefinition | undefined {
  return TRAIT_LIBRARY[traitId];
}

const STAT_NAMES: (keyof BaseStats)[] = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'];

/**
 * Total fractional bonus (e.g. 0.10 for +10%) a creature's `stat` gets from its `'stat'`-
 * category traits. Only slots that are BOTH `unlocked: true` AND hold a non-null `traitId`
 * contribute — a locked slot escrowing an inherited trait (see the breed -> spendEssenceOnLevel
 * round-trip in GameState) is inert until it unlocks. `traitLevel` is 1-indexed into the
 * 0-indexed `magnitudes` tuple. If more than one slot ever targets the same stat, their
 * bonuses simply add — there's no stacking penalty, by design (this is alpha placeholder
 * math per CLAUDE.md; only the shape — rises with level, zero when inert — is load-bearing).
 */
function statTraitBonusFraction(instance: CreatureInstance, stat: keyof BaseStats): number {
  let total = 0;
  for (const slot of instance.traitSlots ?? []) {
    if (!slot.unlocked || !slot.traitId) continue;
    const trait = getTrait(slot.traitId);
    if (!trait || trait.category !== 'stat' || trait.target !== stat) continue;
    const levelIndex = Math.min(Math.max(slot.traitLevel, 1), trait.magnitudes.length) - 1;
    total += trait.magnitudes[levelIndex];
  }
  return total;
}

/**
 * Layers stat-trait bonuses on top of an already level-scaled `BaseStats` block. Kept as a
 * separate composable step (rather than folded inline into `calculateStatsForLevel`'s loop)
 * so it can be called and tested in isolation, and so a later task can add non-stat trait
 * effects (battle_start, resistance, ...) as their own composable steps at the appropriate
 * seam without needing to touch this one. `calculateStatsForLevel` calls this once, at the
 * end, on the result of its own level-scaling — see GameState.ts.
 */
export function applyStatTraitBonuses(stats: BaseStats, instance: CreatureInstance): BaseStats {
  const result = { ...stats };
  for (const stat of STAT_NAMES) {
    const bonus = statTraitBonusFraction(instance, stat);
    if (bonus > 0) {
      result[stat] = Math.floor(result[stat] * (1 + bonus));
    }
  }
  return result;
}
