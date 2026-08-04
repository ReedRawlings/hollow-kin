/**
 * Trait library data. See `traits-system.md` for the full design and
 * `docs/superpowers/specs/2026-07-26-traits-system-design.md` for the design spec.
 *
 * Traits are passive/triggered effects a creature can hold in an unlocked trait slot.
 * A slot holds a trait id + a level (1-4); this file only defines *what a trait id means*
 * — magnitude per level. Slot unlocking and cost/compatibility logic live in
 * `src/systems/Traits.ts`.
 *
 * All magnitudes below are alpha placeholders (see the numbers note at the top of
 * CLAUDE.md) — the shape (rising across levels) is the part that matters right now.
 */

export interface TraitDefinition {
  id: string;
  name: string;
  category: 'stat' | 'battle_start' | 'resistance' | 'affinity' | 'evasion' | 'type' | 'economy';
  description: string;
  /** Effect magnitude per trait level, index 0 = L1 … index 3 = L4. */
  magnitudes: [number, number, number, number];
  /**
   * What the effect points at. The domain depends on `category` — it is typed as a
   * plain string because those domains are unrelated, so nothing enforces the pairing.
   * Read this table before consuming `target`:
   *
   * | category       | `target` is                          | example   |
   * |----------------|--------------------------------------|-----------|
   * | `stat`         | a `BaseStats` key                    | `'str'`   |
   * | `battle_start` | a `BaseStats` key (the stat buffed)  | `'str'`   |
   * | `resistance`   | a `DamageType`                       | `'Ash'`  |
   * | `type`         | an `Archetype`                       | `'Kami'`  |
   * | others         | omitted — the effect has no operand  | —         |
   *
   * Omitted where the effect needs no operand (e.g. `resist_status`, `evasion_up`).
   */
  target?: string;
}

export const TRAIT_LIBRARY: Record<string, TraitDefinition> = {
  // --- Stat Increase Traits — passive % bonus to one base stat, scales with level ---
  hp_up: {
    id: 'hp_up', name: 'HP Up', category: 'stat',
    description: 'Passively raises max HP.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'hp',
  },
  mp_up: {
    id: 'mp_up', name: 'MP Up', category: 'stat',
    description: 'Passively raises max MP.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'mp',
  },
  str_up: {
    id: 'str_up', name: 'STR Up', category: 'stat',
    description: 'Passively raises STR.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'str',
  },
  def_up: {
    id: 'def_up', name: 'DEF Up', category: 'stat',
    description: 'Passively raises DEF.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'def',
  },
  wis_up: {
    id: 'wis_up', name: 'WIS Up', category: 'stat',
    description: 'Passively raises WIS.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'wis',
  },
  spd_up: {
    id: 'spd_up', name: 'SPD Up', category: 'stat',
    description: 'Passively raises SPD.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'spd',
  },
  int_up: {
    id: 'int_up', name: 'INT Up', category: 'stat',
    description: 'Passively raises INT.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'int',
  },

  // --- Start of Battle Traits — trigger once at the start of combat ---
  opening_buff: {
    id: 'opening_buff', name: 'Opening Buff', category: 'battle_start',
    description: 'Raises ATK by a number of buff stages on the first turn of battle.',
    magnitudes: [1, 1, 2, 2],
    target: 'str',
  },
  opening_ward: {
    id: 'opening_ward', name: 'Opening Ward', category: 'battle_start',
    description: 'Raises DEF by a number of buff stages on the first turn of battle.',
    magnitudes: [1, 1, 2, 2],
    target: 'def',
  },
  initiative_boost: {
    id: 'initiative_boost', name: 'Initiative Boost', category: 'battle_start',
    description: 'Raises SPD by a number of buff stages at the start of battle.',
    magnitudes: [1, 1, 2, 2],
    target: 'spd',
  },
  opening_block: {
    id: 'opening_block', name: 'Opening Block', category: 'battle_start',
    description: 'Negates a fraction of the first instance of damage taken each battle.',
    magnitudes: [0.25, 0.5, 0.75, 1.0],
  },

  // --- Resistance Traits — passive reduction to incoming damage/effects of a kind ---
  // One per ward, enforced by Traits.test.ts ('every DamageType has exactly one
  // corresponding resistance trait'). Adding a ward means adding a trait here AND putting
  // it in at least one species' naturalTraitPool — a second test enforces that.
  resist_ash: {
    id: 'resist_ash', name: 'Resist Ash', category: 'resistance',
    description: 'Reduces incoming Ash damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Ash',
  },
  resist_salt: {
    id: 'resist_salt', name: 'Resist Salt', category: 'resistance',
    description: 'Reduces incoming Salt damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Salt',
  },
  resist_bell: {
    id: 'resist_bell', name: 'Resist Bell', category: 'resistance',
    description: 'Reduces incoming Bell damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Bell',
  },
  resist_iron: {
    id: 'resist_iron', name: 'Resist Iron', category: 'resistance',
    description: 'Reduces incoming Iron damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Iron',
  },
  resist_breath: {
    id: 'resist_breath', name: 'Resist Breath', category: 'resistance',
    description: 'Reduces incoming Breath damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Breath',
  },
  resist_mirror: {
    id: 'resist_mirror', name: 'Resist Mirror', category: 'resistance',
    description: 'Reduces incoming Mirror damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Mirror',
  },
  resist_bane: {
    id: 'resist_bane', name: 'Resist Bane', category: 'resistance',
    description: 'Reduces incoming Bane damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Bane',
  },
  resist_rust: {
    id: 'resist_rust', name: 'Resist Rust', category: 'resistance',
    description: 'Reduces incoming Rust damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Rust',
  },
  resist_honey: {
    id: 'resist_honey', name: 'Resist Honey', category: 'resistance',
    description: 'Reduces incoming Honey damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Honey',
  },
  resist_thorn: {
    id: 'resist_thorn', name: 'Resist Thorn', category: 'resistance',
    description: 'Reduces incoming Thorn damage.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
    target: 'Thorn',
  },
  resist_status: {
    id: 'resist_status', name: 'Resist Status', category: 'resistance',
    description: 'Reduces the chance of debuffs/status landing on this creature.',
    magnitudes: [0.1, 0.2, 0.3, 0.4],
  },

  // --- Party Affinity Traits — triggered buffs based on party composition ---
  kin_bond: {
    id: 'kin_bond', name: 'Kin Bond', category: 'affinity',
    description: 'Buffs this creature when partied with another of the same archetype.',
    magnitudes: [1, 1, 2, 2],
  },

  // --- Evasion Traits — passive increase to dodge chance ---
  evasion_up: {
    id: 'evasion_up', name: 'Evasion Up', category: 'evasion',
    description: 'Passively raises this creature\'s chance to dodge incoming attacks.',
    magnitudes: [0.03, 0.06, 0.10, 0.15],
  },

  // --- Type Traits — one representative example; the full per-archetype set is later content ---
  kami_slayer: {
    id: 'kami_slayer', name: 'Kami Slayer', category: 'type',
    description: 'Increases damage dealt to Kami-archetype enemies.',
    magnitudes: [0.05, 0.10, 0.18, 0.28],
    target: 'Kami',
  },

  // --- Economy Traits — affect run currency rather than combat ---
  essence_distiller: {
    id: 'essence_distiller', name: 'Essence Distiller', category: 'economy',
    description: 'Boosts the Obols-to-Essence conversion rate applied on tower exit.',
    magnitudes: [0.05, 0.10, 0.15, 0.25],
  },
};
