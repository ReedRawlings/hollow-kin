/**
 * The event-room catalogue — what a `?` room can turn out to be.
 *
 * An event is an OFFER: a name, one line of flavour, the exact terms, and the
 * choice to accept or walk away. What each one actually does lives in
 * `systems/Events.ts`, the same split `items.ts` / `Items.ts` use. Nothing here
 * grants XP — that is combat's reward, and the only event that yields any is the
 * one that starts a fight.
 *
 * `terms` is player-facing copy. The numbers it quotes are placeholders like
 * everything else (see the alpha note in CLAUDE.md) and are kept next to the
 * tunables in `systems/Events.ts` so the two move together.
 */

export type EventId =
  | 'mercy_well'
  | 'blood_boon'
  | 'dice_transfer'
  | 'tinkers_trade'
  | 'warden_wager';

export interface EventDefinition {
  id: EventId;
  name: string;
  /** One line of atmosphere, shown above the terms. */
  flavour: string;
  /** What you pay and what you get, in plain words. */
  terms: string;
}

export const EVENTS: Record<EventId, EventDefinition> = {
  mercy_well: {
    id: 'mercy_well',
    name: 'Mercy Well',
    flavour: 'Clear water in a cracked basin, and a slot for coin beside it.',
    terms: 'Every standing kin recovers a tenth of its Health and Mana. Costs a tenth of your Obols.',
  },
  blood_boon: {
    id: 'blood_boon',
    name: 'Blood Boon',
    flavour: 'An altar that asks only a little of someone.',
    terms: 'Gain a boon. One standing kin, chosen by the altar, loses a fifth of its current Health.',
  },
  dice_transfer: {
    id: 'dice_transfer',
    name: 'The Dice',
    flavour: 'A bone die on a table set for two.',
    terms: 'Roll a twelve-sided die. Move that much Health from one kin to another. No one drops below 1.',
  },
  tinkers_trade: {
    id: 'tinkers_trade',
    name: "Tinker's Trade",
    flavour: 'Three things laid on a cloth, and a hand held out.',
    terms: 'Pay a tenth of your Obols. Choose one of three wares for your bag.',
  },
  warden_wager: {
    id: 'warden_wager',
    name: "Warden's Wager",
    flavour: 'Something is waiting, and it has heard you are worth the trouble.',
    terms: 'Fight here. Win, and the Obols and experience are doubled.',
  },
};

export const EVENT_LIST: readonly EventDefinition[] = Object.values(EVENTS);

/**
 * Falls back to the first event rather than throwing, matching `getItem` and
 * `getBoon` — a bad id should cost one room, not the run.
 */
export function getEvent(id: string): EventDefinition {
  return EVENTS[id as EventId] ?? EVENT_LIST[0];
}
