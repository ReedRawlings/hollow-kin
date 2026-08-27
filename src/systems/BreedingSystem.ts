import { CreatureInstance, STAR_LEVEL_CAPS, TraitSlot, generateId, BaseStats, BREED_CARRYOVER_FRACTION } from '../types';
import { getTemplate } from '../data/creatures';
import { levelFromEssence } from './Economy';
import { isCreatureBreedReady, unlockedSlotCount, MAX_TRAIT_SLOTS } from './Traits';
import { calculateLevelScaledStats } from '../managers/GameState';
import { PARTY_SIZE } from './PartyStatus';

/**
 * Living creatures a box must hold before breeding is allowed.
 *
 * Breeding is net -1: both parents retire and one offspring is born. Without this
 * floor a player can breed their way out of a fieldable party — three starters
 * become two living creatures, PartySelectScene's `selected.length === PARTY_SIZE`
 * gate never satisfies, and the tower becomes unenterable. Because the only other
 * path that adds to the box is `unloadCapturesToBox` (and capture is not wired into
 * combat yet), there is currently no way back up: the save is finished.
 *
 * This guard is a stopgap. Wiring capture is the real fix, and once the box can grow
 * again this floor stops being the thing standing between a player and a dead save —
 * but it should stay, because breeding into an unfieldable party is never a move
 * anyone means to make.
 */
export const MIN_LIVING_TO_BREED = PARTY_SIZE + 1;

/**
 * Whether the box can support a breeding right now.
 *
 * `too_few` and `would_strand` are deliberately distinct: one means "you have nothing
 * to pair", the other means "the pairing itself is what would trap you". They want
 * different words in front of the player.
 */
export type BreedingAvailability =
  | { kind: 'available' }
  | { kind: 'too_few'; living: number }
  | { kind: 'would_strand'; living: number };

/** Non-retired creatures. Retired parents stay in the box as tombstones forever. */
export function livingCreatures(box: CreatureInstance[]): CreatureInstance[] {
  return box.filter(c => !c.isRetired);
}

export function breedingAvailability(box: CreatureInstance[]): BreedingAvailability {
  const living = livingCreatures(box).length;
  if (living < 2) return { kind: 'too_few', living };
  if (living < MIN_LIVING_TO_BREED) return { kind: 'would_strand', living };
  return { kind: 'available' };
}

/** Player-facing explanation, or null when breeding is available. */
export function breedingBlockedReason(a: BreedingAvailability): string | null {
  switch (a.kind) {
    case 'available':
      return null;
    case 'too_few':
      return 'Breeding needs two creatures.';
    case 'would_strand':
      return `Breeding retires both parents for one offspring. With ${a.living} kin `
        + `you would be left with ${a.living - 1} — too few to field a party of `
        + `${PARTY_SIZE}, and no way back. Find another kin first.`;
  }
}

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

  // Read each parent's LEVEL-SCALED stats, excluding trait bonuses — not `currentStats`
  // directly. `currentStats` is `calculateStatsForLevel`'s output, which (since stat
  // traits shipped) already has trait bonuses baked in on top of level scaling. Averaging
  // that would inflate the offspring's heritable statBaseline with the parent's trait
  // strength — on top of the offspring separately re-inheriting the trait itself at L1
  // (resolveInheritedTraitSlots) — compounding every generation. Level scaling itself is
  // intentionally still here: docs/design/breeding-and-inheritance.md is explicit that stats compound
  // with level across generations, which is exactly why breeding too early founds a weak
  // line. calculateLevelScaledStats (GameState.ts) is the level-scaling half alone.
  const scaledA = calculateLevelScaledStats(parentA);
  const scaledB = calculateLevelScaledStats(parentB);

  const result: BaseStats = { ...base };
  for (const stat of statNames) {
    const inherited = Math.floor((scaledA[stat] + scaledB[stat]) / 6);
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
