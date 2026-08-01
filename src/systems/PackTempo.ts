/** Stable-core Pack Tempo rules. This module knows nothing about Phaser. */

export const BASE_TEMPO_CAP = 3;
export const RELAY_TEMPO_COST = 1;

export type TempoGenerationReason =
  | 'known_weakness'
  | 'technical'
  | 'conditional_critical'
  | 'move_condition'
  | 'instinct'
  | 'encounter_rule';

export interface PackTempoState {
  points: number;
  cap: number;
  /** Actor ids whose qualifying trigger has already been consumed this round. */
  generatedActorIds: ReadonlySet<string>;
}

export interface TempoGenerationResult {
  state: PackTempoState;
  granted: boolean;
  wastedAtCap: boolean;
}

export function createPackTempoState(cap = BASE_TEMPO_CAP): PackTempoState {
  const safeCap = Math.max(0, Math.floor(cap));
  return { points: 0, cap: safeCap, generatedActorIds: new Set<string>() };
}

/** Tempo carries between rounds; only the per-Kin generation latch resets. */
export function beginTempoRound(state: PackTempoState): PackTempoState {
  return { ...state, generatedActorIds: new Set<string>() };
}

/**
 * Consume a Kin's one qualifying generation opportunity for this round.
 * Reaching the cap still consumes the opportunity and reports a wasted point,
 * which prevents a later passive trigger from bypassing the once-per-round rule.
 */
export function generateTempo(
  state: PackTempoState,
  actorId: string,
  _reason: TempoGenerationReason,
): TempoGenerationResult {
  if (state.generatedActorIds.has(actorId)) {
    return { state, granted: false, wastedAtCap: false };
  }

  const generatedActorIds = new Set(state.generatedActorIds);
  generatedActorIds.add(actorId);
  if (state.points >= state.cap) {
    return {
      state: { ...state, generatedActorIds },
      granted: false,
      wastedAtCap: true,
    };
  }

  return {
    state: { ...state, points: state.points + 1, generatedActorIds },
    granted: true,
    wastedAtCap: false,
  };
}

export function canSpendRelay(state: PackTempoState): boolean {
  return state.points >= RELAY_TEMPO_COST;
}

/** Spend an arbitrary shared-resource cost without allowing a negative balance. */
export function spendTempo(state: PackTempoState, amount: number): PackTempoState | null {
  const cost = Math.max(0, Math.floor(amount));
  if (state.points < cost) return null;
  return { ...state, points: state.points - cost };
}

export function spendRelay(state: PackTempoState): PackTempoState | null {
  if (!canSpendRelay(state)) return null;
  return spendTempo(state, RELAY_TEMPO_COST);
}

/**
 * Move one unused action to immediately after the current timeline entry.
 * The array length and every entry are preserved exactly once. Returning null
 * means the target is absent, already acted, duplicated, or already next.
 */
export function relayTimeline<T>(
  timeline: readonly T[],
  currentIndex: number,
  targetId: string,
  getId: (entry: T) => string,
): T[] | null {
  if (currentIndex < 0 || currentIndex >= timeline.length) return null;

  const matches: number[] = [];
  for (let i = 0; i < timeline.length; i++) {
    if (getId(timeline[i]) === targetId) matches.push(i);
  }
  if (matches.length !== 1) return null;

  const targetIndex = matches[0];
  if (targetIndex <= currentIndex || targetIndex === currentIndex + 1) return null;

  const reordered = [...timeline];
  const [target] = reordered.splice(targetIndex, 1);
  reordered.splice(currentIndex + 1, 0, target);
  return reordered;
}

/** Candidates whose one existing action would actually move forward. */
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
