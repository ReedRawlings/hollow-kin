import { describe, expect, it } from 'vitest';
import {
  GARY_ESSENCE_REWARD_ID, GARY_SHORTSWORD_EVIDENCE_ID, addGaryEvidence,
  completeGaryDialogue, createRelationshipProgress, garyDeepStartDiscount,
  garyDepthUnlockDiscount, garyGiftBoonId, isGaryShortswordEligible,
  nextGaryDialogue, recordGaryHomecoming, scheduleGaryAssistance,
} from './Relationships';

describe('Gary relationship', () => {
  it('advances only when the matching tower milestones are met', () => {
    const p = createRelationshipProgress();
    expect(nextGaryDialogue(p, { deepestBreakCleared: 0, lastRunSummary: null })).toBe('gary_intro');
    completeGaryDialogue(p, 'gary_intro');
    expect(nextGaryDialogue(p, { deepestBreakCleared: 0, lastRunSummary: null })).toBeNull();
    expect(nextGaryDialogue(p, { deepestBreakCleared: 5, lastRunSummary: null })).toBe('gary_passages');
    completeGaryDialogue(p, 'gary_passages');
    expect(isGaryShortswordEligible(p)).toBe(true);
    addGaryEvidence(p, GARY_SHORTSWORD_EVIDENCE_ID);
    expect(nextGaryDialogue(p, { deepestBreakCleared: 5, lastRunSummary: null }))
      .toBe('gary_shortsword_return');
  });

  it('schedules 10-40 essence every 2-5 completed returns', () => {
    const p = createRelationshipProgress();
    p.stage = 3;
    scheduleGaryAssistance(p, () => 0);
    expect(p.scheduledRewards[GARY_ESSENCE_REWARD_ID]).toEqual({ returnsRemaining: 2, amount: 10 });
    recordGaryHomecoming(p);
    recordGaryHomecoming(p);
    expect(nextGaryDialogue(p, { deepestBreakCleared: 5, lastRunSummary: null }))
      .toBe('gary_essence_assistance');
    expect(completeGaryDialogue(p, 'gary_essence_assistance', () => 0.999999))
      .toBe(10);
    expect(p.scheduledRewards[GARY_ESSENCE_REWARD_ID]).toEqual({ returnsRemaining: 5, amount: 40 });
  });

  it('maps relationship stages to costs and Gary Gift relics', () => {
    const p = createRelationshipProgress();
    expect(garyDeepStartDiscount(p)).toBe(0);
    p.stage = 2;
    expect(garyDeepStartDiscount(p)).toBe(0.1);
    p.stage = 4;
    expect(garyGiftBoonId(p)).toBe('garys_gift_10');
    p.stage = 5;
    expect(garyGiftBoonId(p)).toBe('garys_gift_20');
    expect(garyDepthUnlockDiscount(p)).toBe(0.1);
  });
});
