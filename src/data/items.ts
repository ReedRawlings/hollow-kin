import { StatName } from '../types';

/**
 * A carryable consumable — bought at a shop, held in the backpack, used in
 * battle on a single target. Two kinds for now; more can join the union later.
 *
 * `heal.amount` is a fraction of the target's max HP, matching AbilityEffect's
 * `value` for a 'heal' effect (see types.ts) — this lets battle usage call
 * CombatEngine's existing `applyHeal(target, fraction)` directly instead of a
 * second heal implementation.
 *
 * `buff.stages` feeds CombatEngine's existing `applyBuffDebuff`, which already
 * clamps to the ±3 stage cap — nothing here needs to re-enforce that.
 *
 * Alpha placeholder values throughout — see the note at the top of CLAUDE.md.
 */
export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  /** What using it does. Add kinds later; two is enough now. */
  effect:
    | { kind: 'heal'; amount: number }              // restore HP to one creature
    | { kind: 'buff'; stat: StatName; stages: number }; // buff one creature
}

export const ITEMS: Record<string, ItemDefinition> = {
  power_increase: {
    id: 'power_increase',
    name: 'Power Increase',
    description: 'Raises one ally\'s STR by a stage.',
    effect: { kind: 'buff', stat: 'str', stages: 1 },
  },
  mending_draught: {
    id: 'mending_draught',
    name: 'Mending Draught',
    description: 'Restores HP to one ally.',
    effect: { kind: 'heal', amount: 0.4 },
  },
};

export const ITEM_LIST: readonly ItemDefinition[] = Object.values(ITEMS);

/** Falls back to the first item rather than throwing, matching getAbility's
 *  fallback style — a corrupted/legacy itemId in a save should not crash the game. */
export function getItem(id: string): ItemDefinition {
  return ITEMS[id] ?? ITEM_LIST[0];
}
