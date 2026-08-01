import {
  CombatCreature, CreatureTemplate, RiteDef, RiteLog, RiteCondition, RiteBand,
  CaptureParty, BidReaction, StatName, bandForFloor,
  CAPTURE_BAND_MULTIPLIER, CAPTURE_HP_NUDGE,
  CAPTURE_ENRAGE_AFTER, CAPTURE_INSULT_FRACTION,
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

/**
 * A fresh per-enemy record. One per enemy per battle; never persisted.
 *
 * The last five fields have no writer yet — capture is not wired into
 * CombatScene, so nothing populates any of this. When it is, these are the
 * write sites that task owes:
 *
 * - `damageTypesDealt`   — tally on every resolved ability with a damage type,
 *                          either side, alongside the existing damageTypesTaken.
 * - `itemConsumedOnSelf` /
 *   `itemConsumedByAlly`  — CombatScene.useItem, by whether the target is this
 *                          creature or one of its allies.
 * - `struckStatStages`   — at the moment this creature's attack lands, record
 *                          the struck creature's buffStages. It cannot be read
 *                          later; the defender is out of scope by evaluation time.
 * - `debuffApplied`      — wherever a negative stat stage is applied to anyone.
 *
 * Until then those conditions read as false, so a rite depending on one leaves
 * the creature at full freight rather than throwing.
 */
export function newRiteLog(): RiteLog {
  return {
    damageTypesTaken: [],
    statusesApplied: [],
    hasActed: false,
    turnsAlive: 0,
    latchedRites: [],
    rejectedBids: 0,
    isEnraged: false,
    damageTypesDealt: {},
    itemConsumedOnSelf: false,
    itemConsumedByAlly: false,
    struckStatStages: {},
    debuffApplied: false,
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
    case 'enemy_party_lost_member':
      return party.anyKnockedOut;
    case 'solo_actor':
      return party.actorCount <= 1;
    case 'item_consumed':
      return condition.scope === 'self' ? log.itemConsumedOnSelf : log.itemConsumedByAlly;
    case 'damage_type_dealt':
      return (log.damageTypesDealt[condition.damageType] ?? 0) >= (condition.times ?? 1);
    case 'struck_enemy_stat_stage_at_least':
      return (log.struckStatStages[condition.stat] ?? 0) >= condition.stage;
    case 'enemy_party_contains_archetype':
      return party.archetypes.includes(condition.archetype);
    case 'debuff_applied':
      return log.debuffApplied;
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

/**
 * Whether this species can be taken in the wild at the given tower band. A band
 * with no price, or a price of exactly 0, cannot be bought there — which is how
 * boss-exclusive and breed-only species are expressed, and also what makes a
 * species met outside its authored bands untakeable rather than free.
 */
export function isUncapturable(template: CreatureTemplate, towerBand: number): boolean {
  const price = template.captureBasePrice?.[towerBand];
  return price === undefined || price === 0;
}

/**
 * Why a capture cannot be attempted here, or null if it can.
 *
 * Boss is checked first and is deliberately NOT expressed as a zero price. Boss
 * encounters draw from the ordinary wild pool, so the same species is a legitimate
 * wild catch one floor earlier — zeroing its band price would make it uncapturable
 * everywhere, which is a different (and wrong) rule. Only a genuinely never-takeable
 * species gets a 0, and no alpha species has one.
 */
export function captureRefusal(
  template: CreatureTemplate,
  towerBand: number,
  isBossEncounter: boolean,
): 'boss' | 'not_in_this_band' | null {
  if (isBossEncounter) return 'boss';
  if (isUncapturable(template, towerBand)) return 'not_in_this_band';
  return null;
}

/**
 * What it costs to guarantee this creature right now. Returns 0 for species that
 * cannot be captured at all, which `captureChance` reads as impossible.
 *
 * Does NOT consider the encounter — a caller must check `captureRefusal` first.
 * Keeping the boss rule out of here preserves this function's single job (pricing)
 * and keeps it usable for a boss's Monsterpedia entry later.
 *
 * Depth enters only through which tower band the floor falls in — the price for
 * that band is authored, not computed. `riteBand` is the unrelated rite tier.
 */
export function capturePrice(
  template: CreatureTemplate,
  floor: number,
  target: CombatCreature,
  riteBand: CaptureBand,
): number {
  const towerBand = bandForFloor(floor);
  // Past this guard the band's price is always present and non-zero — that is
  // exactly what isUncapturable tests — so there is no default to fall back to.
  if (isUncapturable(template, towerBand)) return 0;
  const base = template.captureBasePrice[towerBand];
  // HP is a nudge, not a lever — a full-HP target costs a quarter more, never triple.
  const nudge = 1 + CAPTURE_HP_NUDGE * hpFraction(target);
  return Math.max(1, Math.round(base * CAPTURE_BAND_MULTIPLIER[riteBand] * nudge));
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
