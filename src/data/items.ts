import { StatName } from '../types';

/**
 * The expedition consumable pool — bought at a shop, carried in the backpack,
 * spent to answer a specific danger.
 *
 * `usableIn` and `targeting` exist so neither the combat scene nor the run map
 * has to hard-code item ids to know what to offer. Adding an item is a data
 * change; no scene should ever grow a branch named after one.
 *
 * Alpha placeholder values throughout — see the note at the top of CLAUDE.md.
 */

/**
 * Where an item may be used. `combat_non_boss` exists for the escape item:
 * encoding the boss restriction as data keeps it testable and keeps CombatScene
 * free of item-specific special cases.
 */
export type ItemUsableIn = 'combat' | 'combat_non_boss' | 'map' | 'both';

export type ItemTargeting = 'living_ally' | 'downed_ally' | 'enemy' | 'none' | 'all_living_allies';

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  usableIn: ItemUsableIn;
  targeting: ItemTargeting;
  effect:
    | { kind: 'heal'; amount: number }                      // fraction of max HP
    | { kind: 'restore_mp'; amount: number }                // fraction of max MP
    | { kind: 'revive'; hpAmount: number; mpAmount: number }
    | { kind: 'cure_status' }
    | { kind: 'buff'; stat: StatName; stages: number }
    | { kind: 'percent_damage'; fraction: number; bossFraction: number }
    | { kind: 'strip_buffs' }
    | { kind: 'escape_battle' }
    | { kind: 'depart' };
}

/**
 * Only `heal`, `restore_mp`, `revive` and `depart` may be marked map-usable.
 * RunState carries partyHp, partyMp and partyKO and nothing else — buff stages
 * and statuses are discarded when a battle ends — so any other effect out there
 * would consume the item and silently do nothing. `items.test.ts` pins this.
 */
export const ITEMS: Record<string, ItemDefinition> = {
  mending_draught: {
    id: 'mending_draught',
    name: 'Mending Draught',
    description: 'Restores HP to one ally.',
    usableIn: 'both',
    targeting: 'living_ally',
    effect: { kind: 'heal', amount: 0.4 },
  },
  moonwater: {
    id: 'moonwater',
    name: 'Moonwater',
    description: 'Restores MP to one ally.',
    usableIn: 'both',
    targeting: 'living_ally',
    effect: { kind: 'restore_mp', amount: 0.4 },
  },
  hollow_candle: {
    id: 'hollow_candle',
    name: 'Hollow Candle',
    description: 'Wakes one fallen ally with a little HP and MP.',
    usableIn: 'both',
    targeting: 'downed_ally',
    effect: { kind: 'revive', hpAmount: 0.25, mpAmount: 0.25 },
  },
  clearroot: {
    id: 'clearroot',
    name: 'Clearroot',
    description: 'Clears every affliction from one ally.',
    usableIn: 'combat',
    targeting: 'living_ally',
    effect: { kind: 'cure_status' },
  },
  power_increase: {
    id: 'power_increase',
    name: 'Power Increase',
    description: "Raises the whole party's STR by a stage.",
    usableIn: 'combat',
    targeting: 'all_living_allies',
    effect: { kind: 'buff', stat: 'str', stages: 1 },
  },
  grave_ash: {
    id: 'grave_ash',
    name: 'Grave Ash',
    description: 'Burns one enemy for a share of its vigour. Wardens shrug most of it off.',
    usableIn: 'combat',
    targeting: 'enemy',
    effect: { kind: 'percent_damage', fraction: 0.25, bossFraction: 0.08 },
  },
  null_salt: {
    id: 'null_salt',
    name: 'Null Salt',
    description: 'Strips every advantage one enemy has built up.',
    usableIn: 'combat',
    targeting: 'enemy',
    effect: { kind: 'strip_buffs' },
  },
  smoke_husk: {
    id: 'smoke_husk',
    name: 'Smoke Husk',
    description: 'Leave a fight at once, with nothing to show for it. Not from a warden.',
    usableIn: 'combat_non_boss',
    targeting: 'none',
    effect: { kind: 'escape_battle' },
  },
  waystone: {
    id: 'waystone',
    name: 'Waystone',
    description: 'Ends the expedition safely, wherever you stand. Everything carried comes home.',
    usableIn: 'map',
    targeting: 'none',
    effect: { kind: 'depart' },
  },
};

export const ITEM_LIST: readonly ItemDefinition[] = Object.values(ITEMS);

/**
 * Falls back to the first item rather than throwing — deliberately unlike
 * `getTemplate`, which does throw. A corrupted species id in a save is
 * unrecoverable; a corrupted item id costs one slot and must not stop the boot.
 */
export function getItem(id: string): ItemDefinition {
  return ITEMS[id] ?? ITEM_LIST[0];
}
