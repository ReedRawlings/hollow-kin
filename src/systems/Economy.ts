import {
  OBOL_REWARDS, OBOL_TO_ESSENCE_RATE, WIPE_OBOL_PENALTY,
  LEVEL_COST_BASE, LEVEL_COST_EXPONENT,
} from '../types';

/** Obols awarded for clearing one combat encounter. */
export function obolsForEncounter(kind: 'normal' | 'mini' | 'major'): number {
  return OBOL_REWARDS[kind];
}

/**
 * Convert a run's leftover (unspent) Obols into permanent Essence.
 * A full wipe loses WIPE_OBOL_PENALTY of the leftover before conversion.
 */
export function convertObolsToEssence(
  leftoverObols: number,
  opts: { isWipe?: boolean; rate?: number } = {},
): number {
  const rate = opts.rate ?? OBOL_TO_ESSENCE_RATE;
  const kept = opts.isWipe ? leftoverObols * (1 - WIPE_OBOL_PENALTY) : leftoverObols;
  return Math.floor(kept * rate);
}

/** Essence cost to raise a creature's permanent level from `level` to `level + 1`. */
export function essenceCostForLevel(level: number): number {
  return Math.floor(LEVEL_COST_BASE * Math.pow(level, LEVEL_COST_EXPONENT));
}

/** Essence cost to start a run at `startFloor` (a cleared depth-jump). Floor 1 is free. */
export function depthJumpCost(startFloor: number): number {
  return Math.max(0, (startFloor - 1) * 15);
}

/**
 * Spend an essence pool buying permanent levels up the cost curve from level 1.
 * Returns the level reached and the essence actually consumed (leftover is dropped).
 * Preserves the Leveler invariant: `invested` == cumulative cost of `level`.
 */
export function levelFromEssence(essence: number, levelCap: number): { level: number; invested: number } {
  let level = 1;
  let invested = 0;
  while (level < levelCap) {
    const cost = essenceCostForLevel(level);
    if (invested + cost > essence) break;
    invested += cost;
    level++;
  }
  return { level, invested };
}
