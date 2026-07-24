import {
  OBOL_REWARDS, OBOL_TO_ESSENCE_RATE, WIPE_OBOL_PENALTY,
  LEVEL_COST_BASE, LEVEL_COST_EXPONENT,
} from '../types';

/** Obols awarded for clearing one combat encounter. */
export function obolsForEncounter(kind: 'normal' | 'boss'): number {
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
