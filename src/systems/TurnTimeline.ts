import { CombatCreature } from '../types';
import { calculateTurnOrder } from './CombatEngine';

export type TurnSlotSource = 'standard' | 'boss_extra' | 'relic_extra';

/**
 * One scheduled action. Slots, rather than creatures, are the timeline identity:
 * a boss or an explicit run modifier may therefore schedule the same actor twice.
 */
export interface TurnSlot {
  slotId: string;
  actor: CombatCreature;
  source: TurnSlotSource;
}

export interface TurnSlotOptions {
  /** Actor ids which receive one authored boss action in addition to their standard slot. */
  bossExtraActorIds?: ReadonlySet<string>;
}

export function buildTurnSlots(
  combatants: readonly CombatCreature[],
  round: number,
  options: TurnSlotOptions = {},
): TurnSlot[] {
  const ordered = calculateTurnOrder([...combatants]);
  const slots: TurnSlot[] = ordered.map((actor, index) => ({
    slotId: `r${round}:standard:${actor.instance.instanceId}:${index}`,
    actor,
    source: 'standard',
  }));

  // A second boss beat is intentionally separated from its first beat. Insert it
  // around the middle of the remaining order instead of making two adjacent attacks.
  for (const actorId of options.bossExtraActorIds ?? []) {
    const actor = ordered.find(candidate => candidate.instance.instanceId === actorId);
    if (!actor || actor.isKnockedOut) continue;
    const standardIndex = slots.findIndex(slot => slot.actor === actor);
    const insertAt = Math.min(
      slots.length,
      Math.max(standardIndex + 1, Math.ceil(slots.length / 2)),
    );
    slots.splice(insertAt, 0, {
      slotId: `r${round}:boss-extra:${actor.instance.instanceId}`,
      actor,
      source: 'boss_extra',
    });
  }

  return slots;
}

export function createExtraTurnSlot(
  actor: CombatCreature,
  round: number,
): TurnSlot {
  return {
    slotId: `r${round}:relic-extra:${actor.instance.instanceId}`,
    actor,
    source: 'relic_extra',
  };
}

