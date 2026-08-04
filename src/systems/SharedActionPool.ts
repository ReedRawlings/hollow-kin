export const BASE_SHARED_ACTION_CAP = 3;

export interface SharedActionPoolState {
  points: number;
  cap: number;
}

/** Chamber prototype: the pack receives a fresh shared move budget each round. */
export function createSharedActionPool(
  cap = BASE_SHARED_ACTION_CAP,
): SharedActionPoolState {
  const safeCap = Math.max(0, Math.floor(cap));
  return { points: safeCap, cap: safeCap };
}

/** Unspent Action Points do not bank; every round begins at the pool's cap. */
export function beginSharedActionRound(
  state: SharedActionPoolState,
): SharedActionPoolState {
  return { ...state, points: state.cap };
}

export function canSpendSharedActions(
  state: SharedActionPoolState,
  amount: number,
): boolean {
  return Number.isInteger(amount) && amount >= 0 && state.points >= amount;
}

export function spendSharedActions(
  state: SharedActionPoolState,
  amount: number,
): SharedActionPoolState | null {
  if (!canSpendSharedActions(state, amount)) return null;
  return { ...state, points: state.points - amount };
}
