import { STAR_LEVEL_CAPS, CreatureInstance } from '../types';
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
 * `naturalTraitPool` does not exist on any real species template yet — a later task
 * (Task 4) authors it per species. Until that data lands, a species with no pool
 * defined is treated as PERMISSIVE (returns true), so this function is meaningfully
 * testable ahead of that data existing. Once pools are authored, a species found
 * with no explicit pool should likely flip to strict (deny-by-default) — update this
 * comment and behavior when that change is made.
 *
 * `templates` defaults to the real creature template table; tests may inject a
 * stand-in map with `naturalTraitPool` populated to exercise the strict path early.
 */
export function canSpeciesTakeTrait(
  speciesId: string,
  traitId: string,
  // CreatureTemplate doesn't declare naturalTraitPool yet (Task 4 adds it), so TS's
  // weak-type check rejects a direct structural match here — cast is safe since the
  // lookup only ever reads the optional field, never assumes CreatureTemplate's shape.
  templates: TraitPoolSource = CREATURE_TEMPLATES as unknown as TraitPoolSource,
): boolean {
  const pool = templates[speciesId]?.naturalTraitPool;
  if (!pool) return true;
  return pool.includes(traitId);
}

/** Look up a trait's definition by id. Returns undefined (never throws) for an unknown id. */
export function getTrait(traitId: string): TraitDefinition | undefined {
  return TRAIT_LIBRARY[traitId];
}
