import { LastRunSummary, RelationshipProgress } from '../types';

export const GARY_RELATIONSHIP_ID = 'gary';
export const GARY_SHORTSWORD_EVENT_ID = 'gary_shortsword';
export const GARY_SHORTSWORD_EVIDENCE_ID = 'garrette_shortsword';
export const GARY_ESSENCE_REWARD_ID = 'gary_essence_assistance';

export type GaryDialogueEventId =
  | 'gary_intro'
  | 'gary_passages'
  | 'gary_shortsword_return'
  | 'gary_turn_back'
  | 'gary_garrette_rest'
  | 'gary_essence_assistance';

export interface GaryEventContext {
  deepestBreakCleared: number;
  lastRunSummary: LastRunSummary | null;
}

export function createRelationshipProgress(): RelationshipProgress {
  return {
    stage: 0,
    completedEventIds: [],
    flags: [],
    evidenceIds: [],
    scheduledRewards: {},
  };
}

export function hasGaryEvidence(progress: RelationshipProgress, evidenceId: string): boolean {
  return progress.evidenceIds.includes(evidenceId);
}

export function addGaryEvidence(progress: RelationshipProgress, evidenceId: string): void {
  if (!progress.evidenceIds.includes(evidenceId)) progress.evidenceIds.push(evidenceId);
}

/** The highest-priority conversation Gary has waiting in town. */
export function nextGaryDialogue(
  progress: RelationshipProgress,
  context: GaryEventContext,
): GaryDialogueEventId | null {
  if (progress.stage === 0) return 'gary_intro';
  if (progress.stage === 1 && context.deepestBreakCleared >= 5) return 'gary_passages';
  if (progress.stage === 2 && hasGaryEvidence(progress, GARY_SHORTSWORD_EVIDENCE_ID)) {
    return 'gary_shortsword_return';
  }
  if (progress.stage === 3 && (context.lastRunSummary?.deepestFloor ?? 0) >= 40) {
    return 'gary_turn_back';
  }
  if (progress.stage === 4 && progress.flags.includes('garrette_defeated')) {
    return 'gary_garrette_rest';
  }
  if (progress.scheduledRewards[GARY_ESSENCE_REWARD_ID]?.returnsRemaining === 0) {
    return 'gary_essence_assistance';
  }
  return null;
}

export function isGaryShortswordEligible(progress: RelationshipProgress): boolean {
  return progress.stage === 2 && !hasGaryEvidence(progress, GARY_SHORTSWORD_EVIDENCE_ID);
}

function randomInt(min: number, max: number, roll: () => number): number {
  return min + Math.floor(Math.min(0.999999, Math.max(0, roll())) * (max - min + 1));
}

export function scheduleGaryAssistance(
  progress: RelationshipProgress,
  roll: () => number = Math.random,
): void {
  progress.scheduledRewards[GARY_ESSENCE_REWARD_ID] = {
    returnsRemaining: randomInt(2, 5, roll),
    amount: randomInt(10, 40, roll),
  };
}

/** Count a completed tower trip toward Gary's next assistance payment. */
export function recordGaryHomecoming(
  progress: RelationshipProgress,
  roll: () => number = Math.random,
): void {
  if (progress.stage < 3) return;
  const reward = progress.scheduledRewards[GARY_ESSENCE_REWARD_ID];
  if (!reward) {
    scheduleGaryAssistance(progress, roll);
    return;
  }
  if (reward.returnsRemaining > 0) reward.returnsRemaining -= 1;
}

export function completeGaryDialogue(
  progress: RelationshipProgress,
  eventId: GaryDialogueEventId,
  roll: () => number = Math.random,
): number {
  if (eventId === 'gary_essence_assistance') {
    const reward = progress.scheduledRewards[GARY_ESSENCE_REWARD_ID];
    if (!reward || reward.returnsRemaining !== 0) return 0;
    const amount = reward.amount;
    scheduleGaryAssistance(progress, roll);
    return amount;
  }

  if (progress.completedEventIds.includes(eventId)) return 0;
  const expectedStage: Record<Exclude<GaryDialogueEventId, 'gary_essence_assistance'>, number> = {
    gary_intro: 1,
    gary_passages: 2,
    gary_shortsword_return: 3,
    gary_turn_back: 4,
    gary_garrette_rest: 5,
  };
  progress.completedEventIds.push(eventId);
  progress.stage = Math.max(progress.stage, expectedStage[eventId]);
  if (eventId === 'gary_shortsword_return') scheduleGaryAssistance(progress, roll);
  return 0;
}

/** Stage 2 makes repeatedly using an owned deep start ten percent cheaper. */
export function garyDeepStartDiscount(progress: RelationshipProgress): number {
  return progress.stage >= 2 ? 0.1 : 0;
}

/** The completed arc also discounts future one-time passage repairs. */
export function garyDepthUnlockDiscount(progress: RelationshipProgress): number {
  return progress.stage >= 5 ? 0.1 : 0;
}

export function garyGiftBoonId(progress: RelationshipProgress): string | null {
  if (progress.stage >= 5) return 'garys_gift_20';
  if (progress.stage >= 4) return 'garys_gift_10';
  return null;
}
