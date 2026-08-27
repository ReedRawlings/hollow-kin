/** Stable-core Pack Tempo rules. This module knows nothing about Phaser. */

export const BASE_TEMPO_CAP = 3;
export const RELAY_TEMPO_COST = 3;

export type TempoGenerationReason =
  | 'weakness'
  | 'omen_resolved'
  | 'break'
  | 'rebound'
  | 'trait'
  | 'boon'
  | 'encounter_rule';

export interface PackTempoState {
  points: number;
  cap: number;
  /** Action-slot ids whose base generation has already resolved. */
  generatedActionIds: ReadonlySet<string>;
}

export interface TempoGenerationResult {
  state: PackTempoState;
  granted: number;
  wastedAtCap: number;
}

export interface TempoActionOutcome {
  landed: boolean;
  exploitedWeakness: boolean;
}

/** Knowledge is intentionally absent: discovering a weakness still earns its Tempo. */
export function tempoReasonForAction(
  outcomes: readonly TempoActionOutcome[],
): TempoGenerationReason | null {
  return outcomes.some(outcome => outcome.landed && outcome.exploitedWeakness)
    ? 'weakness'
    : null;
}

export function createPackTempoState(cap = BASE_TEMPO_CAP): PackTempoState {
  const safeCap = Math.max(0, Math.floor(cap));
  return { points: 0, cap: safeCap, generatedActionIds: new Set<string>() };
}

/** Tempo carries between rounds. Action ids are unique, but clearing keeps snapshots compact. */
export function beginTempoRound(state: PackTempoState): PackTempoState {
  return { ...state, generatedActionIds: new Set<string>() };
}

/**
 * Resolve all Tempo earned by one action at once. Base actions request amount 1;
 * an explicit trait/boon modifier may request more without weakening the
 * invariant that generation resolves only once for that action.
 */
export function generateTempo(
  state: PackTempoState,
  actionId: string,
  _reason: TempoGenerationReason,
  amount = 1,
): TempoGenerationResult {
  if (state.generatedActionIds.has(actionId)) {
    return { state, granted: 0, wastedAtCap: 0 };
  }
  const generatedActionIds = new Set(state.generatedActionIds);
  generatedActionIds.add(actionId);
  const requested = Math.max(0, Math.floor(amount));
  const room = Math.max(0, state.cap - state.points);
  const granted = Math.min(room, requested);
  return {
    state: { ...state, points: state.points + granted, generatedActionIds },
    granted,
    wastedAtCap: requested - granted,
  };
}

export function canSpendRelay(state: PackTempoState): boolean {
  return state.points >= RELAY_TEMPO_COST;
}

export function spendTempo(state: PackTempoState, amount: number): PackTempoState | null {
  const cost = Math.max(0, Math.floor(amount));
  if (state.points < cost) return null;
  return { ...state, points: state.points - cost };
}

export function spendRelay(state: PackTempoState): PackTempoState | null {
  if (!canSpendRelay(state)) return null;
  return spendTempo(state, RELAY_TEMPO_COST);
}

/** Move one unused action slot directly after the current slot. */
export function relayTimeline<T>(
  timeline: readonly T[],
  currentIndex: number,
  targetId: string,
  getId: (entry: T) => string,
): T[] | null {
  if (currentIndex < 0 || currentIndex >= timeline.length) return null;
  const matches = timeline.map((entry, index) => getId(entry) === targetId ? index : -1)
    .filter(index => index >= 0);
  if (matches.length !== 1) return null;
  const targetIndex = matches[0];
  if (targetIndex <= currentIndex || targetIndex === currentIndex + 1) return null;
  const reordered = [...timeline];
  const [target] = reordered.splice(targetIndex, 1);
  reordered.splice(currentIndex + 1, 0, target);
  return reordered;
}

export function relayCandidates<T>(
  timeline: readonly T[],
  currentIndex: number,
  getId: (entry: T) => string,
  isEligible: (entry: T) => boolean,
): T[] {
  const seen = new Set<string>();
  return timeline.slice(currentIndex + 2).filter(entry => {
    const id = getId(entry);
    if (seen.has(id) || !isEligible(entry)) return false;
    seen.add(id);
    return true;
  });
}
