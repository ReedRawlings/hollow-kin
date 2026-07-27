import {
  CombatCreature, CreatureTemplate, RiteDef, RiteLog, RiteCondition, RiteBand,
  CaptureParty, BidReaction, StatName,
  CAPTURE_DEPTH_EXPONENT, CAPTURE_BAND_MULTIPLIER, CAPTURE_HP_NUDGE,
  CAPTURE_ENRAGE_AFTER, CAPTURE_INSULT_FRACTION, DEFAULT_CAPTURE_BASE_PRICE,
} from '../types';

/**
 * Capture pricing and rite evaluation.
 *
 * Pure throughout: nothing here mutates a creature, a log, or the run, and
 * nothing consumes RNG. It answers "what does this cost and which rites are
 * satisfied"; the scene rolls the dice and applies the results. That is the same
 * contract TacticsAI keeps, and it is what stops capture from being able to
 * desync the combat RNG stream.
 */

export type CaptureBand = 'unsatisfied' | RiteBand;

/** A fresh per-enemy record. One per enemy per battle; never persisted. */
export function newRiteLog(): RiteLog {
  return {
    damageTypesTaken: [],
    statusesApplied: [],
    hasActed: false,
    turnsAlive: 0,
    latchedRites: [],
    rejectedBids: 0,
    isEnraged: false,
  };
}

function hpFraction(c: CombatCreature): number {
  return c.maxHp > 0 ? c.currentHp / c.maxHp : 0;
}

function stageOf(c: CombatCreature, statName: StatName): number {
  return c.buffStages[statName] ?? 0;
}

/** Whether one condition holds right now. */
function conditionHolds(
  condition: RiteCondition,
  target: CombatCreature,
  log: RiteLog,
  party: CaptureParty,
): boolean {
  switch (condition.kind) {
    case 'damage_type_taken':
      return log.damageTypesTaken.includes(condition.damageType);
    case 'status_active':
      return target.statusEffects.some(s => s.type === condition.status);
    case 'status_applied':
      return log.statusesApplied.includes(condition.status);
    case 'stat_stage_at_most':
      return stageOf(target, condition.stat) <= condition.stage;
    case 'stat_stage_at_least':
      return stageOf(target, condition.stat) >= condition.stage;
    case 'hp_above':
      return hpFraction(target) > condition.fraction;
    case 'hp_below':
      return hpFraction(target) < condition.fraction;
    case 'has_not_acted':
      return !log.hasActed;
    case 'survived_turns':
      return log.turnsAlive >= condition.turns;
    case 'ally_knocked_out':
      return party.anyKnockedOut;
    case 'solo_actor':
      return party.actorCount <= 1;
  }
}

/** All conditions must hold. An empty condition list is never satisfied. */
function riteHolds(rite: RiteDef, target: CombatCreature, log: RiteLog, party: CaptureParty): boolean {
  if (rite.conditions.length === 0) return false;
  return rite.conditions.every(c => conditionHolds(c, target, log, party));
}

export interface RiteEvaluation {
  /** Rite ids satisfied right now, including sticky rites latched earlier. */
  satisfied: string[];
  /** Sticky rites newly true this evaluation. The caller latches these into the log. */
  toLatch: string[];
  /** The best band among the satisfied rites. */
  band: CaptureBand;
}

/**
 * Which rites are satisfied, and therefore which price band applies.
 *
 * Sticky rites latch: once true they stay true for the battle even if the
 * condition lapses. Volatile rites are re-checked every time and never latch,
 * which is what makes them the demanding tier — they must hold at the instant
 * of the bid.
 */
export function evaluateRites(
  template: CreatureTemplate,
  target: CombatCreature,
  log: RiteLog,
  party: CaptureParty,
): RiteEvaluation {
  const satisfied: string[] = [];
  const toLatch: string[] = [];

  for (const rite of template.rites ?? []) {
    if (log.latchedRites.includes(rite.id)) {
      satisfied.push(rite.id);
      continue;
    }
    if (!riteHolds(rite, target, log, party)) continue;
    satisfied.push(rite.id);
    if (rite.persistence === 'sticky') toLatch.push(rite.id);
  }

  return { satisfied, toLatch, band: bandFor(template, satisfied) };
}

/** Bands replace rather than stack: signature beats family beats nothing. */
export function bandFor(template: CreatureTemplate, satisfiedRiteIds: string[]): CaptureBand {
  let best: CaptureBand = 'unsatisfied';
  for (const rite of template.rites ?? []) {
    if (!satisfiedRiteIds.includes(rite.id)) continue;
    if (rite.band === 'signature') return 'signature';
    if (rite.band === 'family') best = 'family';
  }
  return best;
}

/** A base price of exactly 0 means the species cannot be taken in the wild. */
export function isUncapturable(template: CreatureTemplate): boolean {
  return template.captureBasePrice === 0;
}

/**
 * What it costs to guarantee this creature right now. Returns 0 for species that
 * cannot be captured at all, which `captureChance` reads as impossible.
 */
export function capturePrice(
  template: CreatureTemplate,
  floor: number,
  target: CombatCreature,
  band: CaptureBand,
): number {
  if (isUncapturable(template)) return 0;
  const base = template.captureBasePrice ?? DEFAULT_CAPTURE_BASE_PRICE;
  const depth = Math.pow(Math.max(1, floor), CAPTURE_DEPTH_EXPONENT);
  // HP is a nudge, not a lever — a full-HP target costs a quarter more, never triple.
  const nudge = 1 + CAPTURE_HP_NUDGE * hpFraction(target);
  return Math.max(1, Math.round(base * depth * CAPTURE_BAND_MULTIPLIER[band] * nudge));
}

/** Bid the price for a certainty; bid under it and you get exactly that fraction. */
export function captureChance(bid: number, price: number): number {
  if (price <= 0) return 0;
  return Math.min(1, Math.max(0, bid / price));
}

/**
 * What a rejected bid tells the player. Deliberately not a number: it brackets
 * the price, which is a hint about the puzzle without naming the rite.
 */
export function reactionFor(bid: number, price: number): BidReaction {
  return bid < price * CAPTURE_INSULT_FRACTION ? 'insulted' : 'wavers';
}

/** An enraged creature refuses every further bid; only a rite clears it. */
export function canBid(log: RiteLog): boolean {
  return !log.isEnraged;
}

/**
 * The log fields to write after a bid is rejected. Returned rather than applied
 * so this module stays pure.
 */
export function registerRejection(log: RiteLog): Pick<RiteLog, 'rejectedBids' | 'isEnraged'> {
  const rejectedBids = log.rejectedBids + 1;
  return { rejectedBids, isEnraged: rejectedBids >= CAPTURE_ENRAGE_AFTER };
}

/**
 * Satisfying any rite clears enrage. Coins never will — that is the whole point
 * of the state, and it is why brute-force probing dead-ends back at the puzzle.
 */
export function clearsEnrage(evaluation: RiteEvaluation): boolean {
  return evaluation.satisfied.length > 0;
}
