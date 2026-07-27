export type Archetype = 'Kami' | 'Spirits' | 'Flora' | 'Fauna' | 'Rock' | 'Mecha' | 'Food' | 'Human';

export type DamageType = 'Fighting' | 'Electric' | 'Wind' | 'Fire' | 'Ice' | 'Ghost';

export type StatName = 'hp' | 'mp' | 'str' | 'def' | 'wis' | 'spd' | 'int';

export type StatusType = 'poison' | 'burn' | 'freeze' | 'stun' | 'sleep' | 'blind';

export type AbilityCategory = 'Physical' | 'Special' | 'Status';

export type TargetingType = 'single_enemy' | 'all_enemies' | 'self' | 'single_ally' | 'all_allies';

/** A standing behavior the player assigns to a creature. */
export type TacticId =
  | 'fight_wisely'
  | 'all_out'
  | 'conserve_mp'
  | 'heal_first'
  | 'follow_orders';

/**
 * A profile the AI can actually execute. Excludes 'follow_orders' — that value
 * means "do not call the AI at all" — and adds the enemy profile, which the
 * player can never select. The scene narrows TacticId to TacticProfile, so the
 * type system makes it impossible to hand 'follow_orders' to chooseAction.
 */
export type TacticProfile = Exclude<TacticId, 'follow_orders'> | 'enemy_default';

export const TACTIC_LABELS: Record<TacticId, string> = {
  fight_wisely: 'Fight Wisely',
  all_out: 'All Out',
  conserve_mp: 'Conserve MP',
  heal_first: 'Heal First',
  follow_orders: 'Follow Orders',
};

/** Player-assignable tactics, in cycle order for the UI. */
export const TACTIC_ORDER: TacticId[] = [
  'fight_wisely', 'all_out', 'conserve_mp', 'heal_first', 'follow_orders',
];

/** Species whose resistances and weaknesses a side is allowed to exploit. */
export type KnownSpecies = ReadonlySet<string>;

export type EncounterType = 'combat' | 'shop' | 'rest' | 'event' | 'boss';

export interface BaseStats {
  hp: number;
  mp: number;
  str: number;
  def: number;
  wis: number;
  spd: number;
  int: number;
}

export interface AbilityEffect {
  type: 'buff' | 'debuff' | 'status' | 'heal' | 'recoil';
  stat?: StatName;
  stages?: number;
  status?: StatusType;
  chance?: number; // 0-1, defaults to 1
  value?: number;  // for heal (% of max HP) or recoil (% of damage)
}

export interface Ability {
  id: string;
  name: string;
  damageType: DamageType | 'None';
  power: number;
  accuracy: number;
  category: AbilityCategory;
  mpCost: number;
  targeting: TargetingType;
  description: string;
  highCrit?: boolean;
  effects?: AbilityEffect[];
}

export interface CreatureTemplate {
  id: string;
  name: string;
  archetype: Archetype;
  baseStats: BaseStats;
  defaultAbilities: string[];
  resistances: DamageType[];
  weaknesses: DamageType[];
  spriteColor: number;
  /** Trait ids this species may be imbued with. Compatibility is curated, never random. */
  naturalTraitPool: string[];
  /**
   * Base Obol price before depth, band and HP. Omitted falls back to
   * DEFAULT_CAPTURE_BASE_PRICE; an explicit 0 means uncapturable in the wild,
   * which is how boss-exclusive and breed-only species are expressed.
   */
  captureBasePrice?: number;
  /** Rites that discount this species. Omitted means it can only be bought at full freight. */
  rites?: RiteDef[];
}

export interface TraitSlot {
  traitId: string | null;
  traitLevel: number;
  unlocked: boolean;
}

export interface CreatureInstance {
  instanceId: string;
  speciesId: string;
  nickname: string | null;
  starRating: number;
  currentLevel: number;   // level during the current run (temporary); starts at permanentLevel
  levelCap: number;
  permanentLevel: number; // permanent essence-bought floor; run starts here, not at 1
  essenceInvested: number;// total essence permanently spent on this creature
  abilities: (string | null)[];
  traitSlots: TraitSlot[];
  lineage: { parentA: string | null; parentB: string | null };
  /**
   * Permanent, instance-specific level-1 stat baseline (inherited for offspring).
   *
   * Optional because several construction sites do not set it yet and readers already
   * fall back (`instance.statBaseline ?? template.baseStats`). Tighten to required once
   * every construction site populates it and the save migration has backfilled.
   */
  statBaseline?: BaseStats;
  currentStats: BaseStats;
  resistances: DamageType[];
  weaknesses: DamageType[];
  isRetired: boolean;
  isBreedReady: boolean;
  xp: number;
  tactic: TacticId;       // standing auto-combat behavior; persists across runs
}

export interface ActiveStatus {
  type: StatusType;
  turnsRemaining: number;
}

export interface CombatCreature {
  instance: CreatureInstance;
  template: CreatureTemplate;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  buffStages: Partial<Record<StatName, number>>;
  statusEffects: ActiveStatus[];
  isKnockedOut: boolean;
  isDefending: boolean;
  isPlayerOwned: boolean;
}

/** What the tactics AI decides to do. The AI never applies it — the scene does. */
export type CombatAction =
  | { kind: 'ability'; abilityId: string; target: CombatCreature }
  | { kind: 'defend' };

export enum BattlePhase {
  STARTING = 'STARTING',
  NEXT_TURN = 'NEXT_TURN',
  PLAYER_CHOOSING = 'PLAYER_CHOOSING',
  PLAYER_TARGETING = 'PLAYER_TARGETING',
  EXECUTING = 'EXECUTING',
  TURN_END = 'TURN_END',
  VICTORY = 'VICTORY',
  DEFEAT = 'DEFEAT',
}

export interface Encounter {
  type: EncounterType;
  enemies?: string[];      // creature template IDs for combat encounters
  enemyLevels?: number;    // level for enemies in this encounter
  floor: number;           // absolute tower floor (1..TOWER_FLOORS)
  index: number;           // position within the current run's encounter list
  bossTier?: 'mini' | 'major'; // set on boss encounters
}

export interface RunState {
  startFloor: number;         // floor this run began on (1 unless a depth-jump was bought)
  currentEncounterIndex: number;
  encounters: Encounter[];
  choices: Encounter[];       // current pick-next choices
  obols: number;
  /** Everything carried on the descent. Captures, consumables, marks and traits all
   *  compete for the same slots — see BackpackSlot. */
  backpack: Backpack;
  partyHp: Record<string, number>;
  partyMp: Record<string, number>;
  partyKO: Record<string, boolean>;
  xpEarned: number;
  autoCombat: boolean;    // AUTO toggle state; persists across encounters within a run
}

export const STAR_LEVEL_CAPS: Record<number, number> = {
  0: 5, 1: 10, 2: 20, 3: 30, 4: 40, 5: 50,
  6: 60, 7: 70, 8: 80, 9: 90, 10: 95, 11: 97, 12: 99,
};

export const BUFF_MULTIPLIERS: Record<number, number> = {
  [-3]: 0.75, [-2]: 0.85, [-1]: 0.9,
  0: 1.0,
  1: 1.1, 2: 1.25, 3: 1.5,
};

export const ARCHETYPE_COLORS: Record<Archetype, number> = {
  Kami: 0x88ccff,
  Spirits: 0x9966cc,
  Flora: 0x66cc66,
  Fauna: 0xcc8833,
  Rock: 0x888888,
  Mecha: 0xcc3333,
  Food: 0xcccc33,
  Human: 0xccaa77,
};

export const RESISTANCE_MULTIPLIER = 0.5;
export const WEAKNESS_MULTIPLIER = 1.5;
export const CRIT_MULTIPLIER = 1.5;
export const BASE_CRIT_RATE = 0.05;
export const HIGH_CRIT_RATE = 0.15;
export const MIN_HIT_CHANCE = 0.30;

// --- Essence / Obol economy (placeholders for playtest tuning) ---
/** Base Obol reward per encounter kind, before depth scaling. */
export const OBOL_REWARDS = { normal: 5, mini: 25, major: 75 } as const;
export const OBOL_TO_ESSENCE_RATE = 0.5;

// Obol rewards scale with depth — see OBOL_REWARD_EXPONENT below LEVEL_COST_EXPONENT.

// --- Tower structure ---
export const TOWER_FLOORS = 30;

/** A floor is a boss floor iff it is a multiple of 5. */
export function isBossFloor(floor: number): boolean {
  return floor % 5 === 0;
}

/** Boss tier for a boss floor: multiples of 10 are major, other multiples of 5 are mini. */
export function bossTierForFloor(floor: number): 'mini' | 'major' {
  return floor % 10 === 0 ? 'major' : 'mini';
}
export const WIPE_OBOL_PENALTY = 0.5; // fraction of leftover Obols lost on a full wipe

/**
 * Depth cost is split in two: a large one-time Gatekeeper purchase that permanently
 * unlocks a floor as a start point, plus a small fee charged each run you actually
 * depart from it. Both are alpha placeholders — see the note at the top of CLAUDE.md.
 * The unlock must stay meaningfully larger than the fee or the purchase is pointless.
 */
export const DEPTH_UNLOCK_COST_PER_FLOOR = 40;
export const DEPTH_RUN_FEE_PER_FLOOR = 5;

export const LEVEL_COST_BASE = 10;
export const LEVEL_COST_EXPONENT = 1.5;

/**
 * Obol rewards scale with depth: `base * OBOL_REWARD_SCALAR * floor^OBOL_REWARD_EXPONENT`.
 *
 * The exponent is NOT a free parameter — it is derived from `LEVEL_COST_EXPONENT`. A creature
 * that clears floor F is roughly level F, so the marginal cost of one more floor of reach is
 * ~`LEVEL_COST_BASE * F^LEVEL_COST_EXPONENT`. A run to floor F earns the sum of its floors,
 * which grows as `F^(OBOL_REWARD_EXPONENT + 1)`. Progression pace holds constant only when
 * those match, hence:
 *
 *     OBOL_REWARD_EXPONENT === LEVEL_COST_EXPONENT - 1
 *
 * At 0 — flat rewards, the behaviour before this scaling landed — every floor of progress
 * costs more runs than the last, floors 1-10 pay exactly what floors 21-30 pay, and the
 * EV-optimal exit sits around floor 20, making the deepest third of the tower not worth
 * attempting. **Retune these two constants together, never separately.**
 *
 * SCALAR is the independent knob: it sets total game length and has no effect on pace.
 * At 1.0, floor 1 pays exactly the base reward, so the scaling is purely additive — no
 * floor pays less than it did before; depth simply pays more. Lower it to lengthen the game.
 */
export const OBOL_REWARD_EXPONENT = LEVEL_COST_EXPONENT - 1;
export const OBOL_REWARD_SCALAR = 1.0;
export const BREED_CARRYOVER_FRACTION = 0.5; // fraction of parents' avg invested essence that carries to offspring

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// --- Battle pacing ---
export const BATTLE_SPEEDS = [1, 2, 4] as const;
export type BattleSpeed = typeof BATTLE_SPEEDS[number];

export const COMBAT_DELAY_ACTION = 800;       // after an action resolves
export const COMBAT_DELAY_TURN_END = 400;     // after a turn finishes
export const COMBAT_DELAY_STATUS_SKIP = 1000; // on a status-skip message
export const COMBAT_DELAY_AUTO_THINK = 350;   // beat before an AI acts, so it reads as a decision
export const COMBAT_DELAY_FLOOR = 100;        // never go below this, or tweens collapse

/** Scale a pacing delay by the player's battle speed, never below the floor. */
export function scaledDelay(baseMs: number, speed: BattleSpeed): number {
  return Math.max(COMBAT_DELAY_FLOOR, Math.round(baseMs / speed));
}

// --- Backpack ---

/**
 * One thing carried on the descent. Everything the player brings home shares these
 * slots, which is what makes carrying capacity a real decision rather than a number:
 * a captured creature and the consumable that might have saved the run compete for
 * the same space.
 *
 * `creature` is live today. The others are declared now because each is already
 * specified elsewhere and each must be wipe-eligible when it arrives — consumables
 * bought at shops and used in battle, marks earned in-run and carried out to be
 * bound with Essence in town, and traits dropped by bosses and events.
 */
export type BackpackContents =
  | { kind: 'creature'; instance: CreatureInstance }
  | { kind: 'item'; itemId: string }
  | { kind: 'mark'; markId: string; earnedBy: string }
  | { kind: 'trait'; traitId: string; traitLevel: number };

/** A slot is empty (`null`) or holds exactly one thing. */
export type BackpackSlot = BackpackContents | null;

export interface Backpack {
  slots: BackpackSlot[];
  /**
   * The first `guaranteedSlots` slots survive a wipe. This is the hedge the design
   * rules promise, and what Quartermaster upgrades will eventually sell — capacity
   * buys room, guaranteed capacity buys certainty.
   */
  guaranteedSlots: number;
}

/** Placeholders. Capacity and guaranteed count both become Quartermaster-purchasable. */
export const BACKPACK_START_CAPACITY = 6;
export const BACKPACK_START_GUARANTEED = 2;

// --- Capture: rites and pricing ---

/**
 * Which price band a rite unlocks. Bands REPLACE rather than stack — if a family
 * and a signature rite are both satisfied, the better band applies.
 */
export type RiteBand = 'family' | 'signature';

/**
 * When a rite counts. `sticky` latches the first time it is true and stays true
 * for the rest of the battle; `volatile` must be true at the instant of the bid.
 * Common species get sticky rites, rare ones volatile.
 */
export type RitePersistence = 'volatile' | 'sticky';

/**
 * The grammar rites are written in. Bespoke rites are combinations of these
 * primitives rather than bespoke code, so every rite is evaluable from battle
 * state and none of them need a special case.
 */
export type RiteCondition =
  | { kind: 'damage_type_taken'; damageType: DamageType }
  | { kind: 'status_active'; status: StatusType }
  | { kind: 'status_applied'; status: StatusType }
  | { kind: 'stat_stage_at_most'; stat: StatName; stage: number }
  | { kind: 'stat_stage_at_least'; stat: StatName; stage: number }
  | { kind: 'hp_above'; fraction: number }
  | { kind: 'hp_below'; fraction: number }
  | { kind: 'has_not_acted' }
  | { kind: 'survived_turns'; turns: number }
  | { kind: 'ally_knocked_out' }
  | { kind: 'solo_actor' };

/** All conditions must hold for the rite to be satisfied. */
export interface RiteDef {
  id: string;
  band: RiteBand;
  persistence: RitePersistence;
  conditions: RiteCondition[];
}

/**
 * Per-enemy battle record the rite conditions are evaluated against. Owned by the
 * combat scene for the duration of one battle, keyed by instance id. Never
 * persisted — runs are not saved.
 */
export interface RiteLog {
  damageTypesTaken: DamageType[];
  statusesApplied: StatusType[];
  hasActed: boolean;
  turnsAlive: number;
  /** Sticky rites that have latched this battle. */
  latchedRites: string[];
  /** Bids this creature has rejected. At CAPTURE_ENRAGE_AFTER it enrages. */
  rejectedBids: number;
  isEnraged: boolean;
}

/** Facts about the player's side that some rites key off. */
export interface CaptureParty {
  anyKnockedOut: boolean;
  /** How many of the player's creatures have acted this battle. */
  actorCount: number;
}

/** What a rejected bid tells the player. Never a number. */
export type BidReaction = 'insulted' | 'wavers';

/**
 * Capture price = base * floor^CAPTURE_DEPTH_EXPONENT * bandMultiplier * hpNudge.
 *
 * The depth exponent tracks OBOL_REWARD_EXPONENT deliberately: Obol income grows
 * as floor^0.5, so a price growing more slowly would make captures relatively
 * cheaper with depth and turn deep floors into the farmable ones. Move them together.
 */
export const CAPTURE_DEPTH_EXPONENT = OBOL_REWARD_EXPONENT;

/** Band multipliers on the base price. Unsatisfied is full freight. */
export const CAPTURE_BAND_MULTIPLIER: Record<'unsatisfied' | RiteBand, number> = {
  unsatisfied: 1.0,
  family: 0.4,
  signature: 0.1,
};

/** HP is a nudge, not a lever: at most this much extra at full HP. */
export const CAPTURE_HP_NUDGE = 0.25;

/** Rejected bids before the creature enrages and refuses everything. */
export const CAPTURE_ENRAGE_AFTER = 3;

/** A bid below this fraction of the price insults rather than tempts. */
export const CAPTURE_INSULT_FRACTION = 0.5;

/** Used when a species has no authored price yet. 0 on a template means uncapturable. */
export const DEFAULT_CAPTURE_BASE_PRICE = 20;
