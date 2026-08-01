/**
 * Timed run-scoped modifiers, chosen at the post-battle offer and active the
 * moment they are taken. No arming step, no backpack slot, no charges to spend.
 *
 * A boon is functionally a short-duration Relic. That is deliberate: when Relics
 * are built they should reuse this layer rather than duplicate it, which is why
 * `ActiveBoon.battlesLeft` already permits `null` for "lasts the run".
 *
 * There is intentionally NO MP-discount boon. `ability.mpCost` is read raw in
 * roughly thirteen places across CombatScene and TacticsAI (affordability, menu
 * labels, Conserve MP's one-third-max ceiling, Heal First's cheapest-heal
 * reserve, comparison tiebreaks). A discount that missed any one of them would
 * make auto-combat plan against a cost the player does not pay. Every boon here
 * is a single-point modifier by design.
 *
 * Alpha placeholder values throughout — see the note at the top of CLAUDE.md.
 */

export type BoonEffect =
  | { kind: 'damage_dealt'; multiplier: number }
  | { kind: 'damage_taken'; multiplier: number; firstRoundOnly: boolean }
  | { kind: 'obol_bonus'; multiplier: number }
  | { kind: 'post_victory_heal'; fraction: number }
  | { kind: 'max_hp_flat'; amount: number };

export interface BoonDefinition {
  id: string;
  name: string;
  description: string;
  /** Compact run-map copy when the name alone does not explain the effect. */
  statusText?: string;
  /** Battles this lasts when granted; null lasts until the run ends. */
  battles: number | null;
  effect: BoonEffect;
}

export const BOONS: Record<string, BoonDefinition> = {
  war_chorus: {
    id: 'war_chorus',
    name: 'War Chorus',
    description: 'Your kin strike harder for the next two fights.',
    battles: 2,
    effect: { kind: 'damage_dealt', multiplier: 1.1 },
  },
  warding_thread: {
    id: 'warding_thread',
    name: 'Warding Thread',
    description: 'The opening round of the next two fights lands softer.',
    battles: 2,
    effect: { kind: 'damage_taken', multiplier: 0.75, firstRoundOnly: true },
  },
  distillers_seal: {
    id: 'distillers_seal',
    name: "Distiller's Seal",
    description: 'The next three victories pay more Obols.',
    battles: 3,
    effect: { kind: 'obol_bonus', multiplier: 1.1 },
  },
  menders_incense: {
    id: 'menders_incense',
    name: "Mender's Incense",
    description: 'Each of the next three victories closes a few wounds.',
    battles: 3,
    effect: { kind: 'post_victory_heal', fraction: 0.1 },
  },
  garys_gift_10: {
    id: 'garys_gift_10',
    name: "Gary's Gift",
    description: '+10 maximum Health to every creature in the party for this run.',
    statusText: "Gary's Gift: +10 Health to all Creatures in Party",
    battles: null,
    effect: { kind: 'max_hp_flat', amount: 10 },
  },
  garys_gift_20: {
    id: 'garys_gift_20',
    name: "Gary's Gift",
    description: '+20 maximum Health to every creature in the party for this run.',
    statusText: "Gary's Gift: +20 Health to all Creatures in Party",
    battles: null,
    effect: { kind: 'max_hp_flat', amount: 20 },
  },
};

export const BOON_LIST: readonly BoonDefinition[] = Object.values(BOONS);
/** Only timed boons belong in random post-combat offers; relics have owners. */
export const REWARD_BOON_LIST: readonly BoonDefinition[] = BOON_LIST.filter(b => b.battles !== null);

/** Falls back rather than throwing, matching `getItem` — a bad id costs one boon,
 *  not the run. */
export function getBoon(id: string): BoonDefinition {
  return BOONS[id] ?? BOON_LIST[0];
}
