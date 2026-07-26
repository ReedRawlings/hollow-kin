import { CreatureInstance, STAR_LEVEL_CAPS, TraitSlot, generateId, BaseStats, BREED_CARRYOVER_FRACTION } from '../types';
import { getTemplate } from '../data/creatures';
import { levelFromEssence } from './Economy';
import { isCreatureBreedReady, unlockedSlotCount, MAX_TRAIT_SLOTS } from './Traits';

/** Which parent's trait wins a contested slot (both parents hold a trait there). */
export type ParentChoice = 'A' | 'B';

export function calculateOffspringStar(parentA: CreatureInstance, parentB: CreatureInstance): number {
  const avgStar = Math.floor((parentA.starRating + parentB.starRating) / 2);
  // Breed-ready bonus: if both breed-ready and same star, +1. Breed-readiness is
  // derived from permanentLevel (see isCreatureBreedReady) — the raw
  // CreatureInstance.isBreedReady field is stale/unused, never read here.
  if (isCreatureBreedReady(parentA) && isCreatureBreedReady(parentB) && parentA.starRating === parentB.starRating) {
    return avgStar + 1;
  }
  return avgStar;
}

export function calculateOffspringStats(
  parentA: CreatureInstance,
  parentB: CreatureInstance,
  offspringSpeciesId: string,
): BaseStats {
  const template = getTemplate(offspringSpeciesId);
  const base = template.baseStats;
  const statNames: (keyof BaseStats)[] = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'];

  const result: BaseStats = { ...base };
  for (const stat of statNames) {
    const inherited = Math.floor((parentA.currentStats[stat] + parentB.currentStats[stat]) / 6);
    result[stat] = Math.max(base[stat], inherited);
  }
  return result;
}

/** Jump-start the offspring inherits: half the parents' average invested essence, spent up the cost curve. */
export function carryoverForParents(
  parentA: CreatureInstance,
  parentB: CreatureInstance,
  levelCap: number,
): { level: number; invested: number } {
  const avgInvested = (parentA.essenceInvested + parentB.essenceInvested) / 2;
  const pool = Math.floor(avgInvested * BREED_CARRYOVER_FRACTION);
  return levelFromEssence(pool, levelCap);
}

/**
 * Resolve the offspring's trait slots from both parents, per slot index:
 * - both parents hold a trait there -> the chosen parent's trait passes (defaults
 *   to parent A when no choice is supplied for that index, so this is testable
 *   without UI)
 * - one parent holds a trait there -> that trait passes
 * - neither does -> the slot stays empty (`traitId: null`)
 *
 * Inherited traits always arrive at `traitLevel: 1` regardless of the parent's
 * level — identity carries, strength does not.
 *
 * All `MAX_TRAIT_SLOTS` indices are resolved even when `offspringPermanentLevel`
 * opens fewer of them (escrow): a trait inherited into a not-yet-open slot is
 * still stored, with `unlocked: false`, and becomes active once level opens that
 * slot. Nothing is dropped. Which slots are open is derived solely from
 * `offspringPermanentLevel` via `unlockedSlotCount` — never from star rating.
 */
export function resolveInheritedTraitSlots(
  parentA: CreatureInstance,
  parentB: CreatureInstance,
  offspringPermanentLevel: number,
  choices: (ParentChoice | undefined)[] = [],
): TraitSlot[] {
  const openCount = unlockedSlotCount(offspringPermanentLevel);
  const slots: TraitSlot[] = [];
  for (let i = 0; i < MAX_TRAIT_SLOTS; i++) {
    // Deliberately NOT gated on parentX.traitSlots[i].unlocked: slot indices are
    // positional in the bloodline, so a trait a parent carries in a still-locked
    // (escrowed) slot propagates exactly as if it were active. Whether the parent
    // ever leveled far enough to unlock it is irrelevant to inheritance.
    const traitA = parentA.traitSlots[i]?.traitId ?? null;
    const traitB = parentB.traitSlots[i]?.traitId ?? null;

    let inheritedTraitId: string | null;
    if (traitA && traitB) {
      inheritedTraitId = (choices[i] ?? 'A') === 'B' ? traitB : traitA;
    } else {
      inheritedTraitId = traitA ?? traitB;
    }

    slots.push({
      traitId: inheritedTraitId,
      traitLevel: inheritedTraitId ? 1 : 0,
      unlocked: i < openCount,
    });
  }
  return slots;
}

export function breed(
  parentA: CreatureInstance,
  parentB: CreatureInstance,
  offspringSpeciesId: string,
  chosenAbilities: string[],
  traitChoices: (ParentChoice | undefined)[] = [],
): CreatureInstance {
  const template = getTemplate(offspringSpeciesId);
  const starRating = calculateOffspringStar(parentA, parentB);
  const levelCap = STAR_LEVEL_CAPS[starRating] ?? 5;
  const carry = carryoverForParents(parentA, parentB, levelCap);
  const baseStats = calculateOffspringStats(parentA, parentB, offspringSpeciesId);

  // Fill abilities: chosen ones first, then defaults
  const abilities: (string | null)[] = [...chosenAbilities];
  while (abilities.length < 4) abilities.push(null);

  // Retire parents
  parentA.isRetired = true;
  parentB.isRetired = true;

  return {
    instanceId: generateId(),
    speciesId: offspringSpeciesId,
    nickname: null,
    starRating,
    currentLevel: carry.level,
    levelCap,
    permanentLevel: carry.level,
    essenceInvested: carry.invested,
    abilities: abilities.slice(0, 4),
    traitSlots: resolveInheritedTraitSlots(parentA, parentB, carry.level, traitChoices),
    lineage: { parentA: parentA.instanceId, parentB: parentB.instanceId },
    // Unlike an ordinary creature's species baseline, this survives every later
    // run reset and level recalculation.
    statBaseline: { ...baseStats },
    currentStats: { ...baseStats },
    resistances: [...template.resistances],
    weaknesses: [...template.weaknesses],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
    tactic: 'fight_wisely',
  };
}
