import {
  OBOL_REWARDS, OBOL_TO_ESSENCE_RATE, WIPE_OBOL_PENALTY,
  LEVEL_COST_BASE, LEVEL_COST_EXPONENT,
  OBOL_REWARD_EXPONENT, OBOL_REWARD_SCALAR,
  DEPTH_UNLOCK_COST_PER_FLOOR, DEPTH_RUN_FEE_PER_FLOOR,
} from '../types';

/**
 * Obols awarded for clearing one combat encounter on `floor`.
 *
 * Rewards scale with depth as `base * SCALAR * floor^EXPONENT`. The exponent is derived
 * from the level cost curve so progression pace holds with depth — see the comment on
 * `OBOL_REWARD_EXPONENT` in types.ts before changing either constant.
 *
 * Floor 1 is the anchor: at SCALAR 1.0 it pays exactly the base reward.
 */
export function obolsForEncounter(kind: 'normal' | 'mini' | 'major', floor: number): number {
  const scaled = OBOL_REWARDS[kind] * OBOL_REWARD_SCALAR * Math.pow(Math.max(1, floor), OBOL_REWARD_EXPONENT);
  return Math.max(1, Math.round(scaled));
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

/** One-time Essence cost to permanently unlock `floor` as a start point. Floor 1 is free. */
export function depthUnlockCost(floor: number): number {
  return Math.max(0, (floor - 1) * DEPTH_UNLOCK_COST_PER_FLOOR);
}

/** Per-run Essence fee for departing from an already-unlocked `floor`. Floor 1 is free. */
export function depthRunFee(floor: number): number {
  return Math.max(0, (floor - 1) * DEPTH_RUN_FEE_PER_FLOOR);
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
