import {
  CombatCreature, RiteLog, CaptureParty, DamageType, StatName, StatusType, Ability, Archetype,
} from '../types';
import { newRiteLog } from './Capture';

/**
 * Writes the per-enemy battle record that capture rites are evaluated against.
 *
 * `Capture.ts` answers "what does this cost and which rites hold"; this module is
 * the other half — it remembers the things those questions ask about which cannot
 * be recovered from live combat state.
 *
 * That distinction is the whole reason this exists. Conditions like `hp_below` or
 * `status_active` read the creature directly and need no memory. But "was this
 * creature ever hit with fire", "has fire been used twice", "did it strike someone
 * whose DEF was buffed" are all historical, and the sharpest case is
 * `struckStatStages`: the struck creature's stages are out of scope by the time a
 * bid happens, so that fact exists only at the instant of the hit.
 *
 * The book is owned by the combat scene for one battle and discarded with it —
 * runs are never saved mid-battle. Keyed by instance id and **enemies only**:
 * player creatures are never captured, so every recorder here no-ops on one
 * rather than requiring the caller to check.
 */
export type RiteLogBook = Map<string, RiteLog>;

export function newLogBook(enemies: CombatCreature[]): RiteLogBook {
  return new Map(enemies.map(e => [e.instance.instanceId, newRiteLog()]));
}

export function logFor(book: RiteLogBook, creature: CombatCreature): RiteLog | undefined {
  return book.get(creature.instance.instanceId);
}

/**
 * A damage type was used this battle, by either side. Tallied onto every enemy's
 * log because the condition is a fact about the battle, not about one creature.
 *
 * Called only for hits that land. A miss deals nothing, and a rite about a fight
 * being full of fire should not be satisfied by a whiff.
 */
export function recordDamageTypeUsed(book: RiteLogBook, ability: Ability): void {
  if (ability.damageType === 'None') return;
  const type = ability.damageType as DamageType;
  for (const log of book.values()) {
    log.damageTypesDealt[type] = (log.damageTypesDealt[type] ?? 0) + 1;
  }
}

/** This creature received damage of a type. A set — "was it ever" — not a tally. */
export function recordDamageTaken(
  book: RiteLogBook,
  target: CombatCreature,
  ability: Ability,
): void {
  if (ability.damageType === 'None') return;
  const log = logFor(book, target);
  if (!log) return;
  const type = ability.damageType as DamageType;
  if (!log.damageTypesTaken.includes(type)) log.damageTypesTaken.push(type);
}

/**
 * Record what `struck` had going when `attacker` hit it.
 *
 * Only meaningful for an enemy attacker — the rite asks what the creature being
 * captured did, not what the player did. Keeps the highest stage seen per stat,
 * and ignores anything at or below zero so an ordinary hit records nothing.
 *
 * Must be called at the moment the hit lands, before the ability's own effects
 * resolve: those could debuff the target, and the rite is about the state the
 * captive chose to attack into.
 */
export function recordStrike(
  book: RiteLogBook,
  attacker: CombatCreature,
  struck: CombatCreature,
): void {
  const log = logFor(book, attacker);
  if (!log) return;
  for (const [stat, stage] of Object.entries(struck.buffStages) as [StatName, number][]) {
    if (stage <= 0) continue;
    if (stage > (log.struckStatStages[stat] ?? 0)) log.struckStatStages[stat] = stage;
  }
}

/**
 * An item was consumed on `target`.
 *
 * "self" and "ally" are from the captive's point of view, so this only registers
 * when the item hit an enemy: that creature gets `onSelf`, its fellow enemies get
 * `byAlly`. Items aimed at the player's own party record nothing, which means only
 * the enemy-targeted items can satisfy the Fauna and Food family rites.
 */
export function recordItemUsed(book: RiteLogBook, target: CombatCreature | null): void {
  if (!target) return;
  const targetLog = logFor(book, target);
  if (!targetLog) return;
  targetLog.itemConsumedOnSelf = true;
  for (const [id, log] of book) {
    if (id !== target.instance.instanceId) log.itemConsumedByAlly = true;
  }
}

/** Stat stages and statuses at a moment in time, for measuring what an action changed. */
export interface EffectSnapshot {
  stages: Partial<Record<StatName, number>>;
  statuses: StatusType[];
}

export function snapshotEffects(c: CombatCreature): EffectSnapshot {
  return { stages: { ...c.buffStages }, statuses: c.statusEffects.map(s => s.type) };
}

/**
 * Record what an action actually did to `target`, by diffing against a snapshot
 * taken before it resolved.
 *
 * Measured rather than read off the ability's declared effects, because effects are
 * chance-gated: an ability that *can* debuff but failed its roll must not satisfy a
 * rite. Comparing before and after is the only way to know it landed.
 *
 * `debuffApplied` is battle-wide ("any creature took a stat-stage debuff"), so it
 * goes on every log. Statuses are per-creature and go on the target's own log.
 */
export function recordEffectOutcome(
  book: RiteLogBook,
  target: CombatCreature,
  before: EffectSnapshot,
): void {
  const debuffed = (Object.keys(target.buffStages) as StatName[])
    .some(stat => (target.buffStages[stat] ?? 0) < (before.stages[stat] ?? 0));
  if (debuffed) {
    for (const log of book.values()) log.debuffApplied = true;
  }

  const log = logFor(book, target);
  if (!log) return;
  for (const status of target.statusEffects.map(s => s.type)) {
    if (before.statuses.includes(status)) continue;
    if (!log.statusesApplied.includes(status)) log.statusesApplied.push(status);
  }
}

/** This creature has taken a turn. Read by `has_not_acted`. */
export function recordActed(book: RiteLogBook, actor: CombatCreature): void {
  const log = logFor(book, actor);
  if (log) log.hasActed = true;
}

/** One more round endured, for every enemy still standing. Read by `survived_turns`. */
export function recordRoundSurvived(book: RiteLogBook, enemies: CombatCreature[]): void {
  for (const e of enemies) {
    if (e.isKnockedOut) continue;
    const log = logFor(book, e);
    if (log) log.turnsAlive += 1;
  }
}

/**
 * Facts about the **capturing** party, assembled at bid time rather than logged.
 *
 * These are all readable from live state, so there is nothing to remember — except
 * which players have acted, which the scene tracks and passes in.
 */
export function captureParty(
  playerParty: CombatCreature[],
  actedInstanceIds: ReadonlySet<string>,
): CaptureParty {
  return {
    anyKnockedOut: playerParty.some(c => c.isKnockedOut),
    actorCount: playerParty.filter(c => actedInstanceIds.has(c.instance.instanceId)).length,
    archetypes: [...new Set(playerParty.map(c => c.template.archetype))] as Archetype[],
  };
}
