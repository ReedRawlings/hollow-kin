import { CreatureInstance, STAR_LEVEL_CAPS, generateId, BaseStats, BREED_CARRYOVER_FRACTION } from '../types';
import { getTemplate } from '../data/creatures';
import { levelFromEssence } from './Economy';
import { isCreatureBreedReady } from './Traits';

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

export function breed(
  parentA: CreatureInstance,
  parentB: CreatureInstance,
  offspringSpeciesId: string,
  chosenAbilities: string[],
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
    traitSlots: [
      { traitId: null, traitLevel: 0, unlocked: starRating >= 2 },
      { traitId: null, traitLevel: 0, unlocked: starRating >= 3 },
      { traitId: null, traitLevel: 0, unlocked: starRating >= 4 },
      { traitId: null, traitLevel: 0, unlocked: starRating >= 5 },
    ],
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
