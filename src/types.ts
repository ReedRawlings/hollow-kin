export type Archetype =
  | 'Kami' | 'Spirits' | 'Flora' | 'Fauna' | 'Rock' | 'Mecha' | 'Food' | 'Human'
  | 'Devils' | 'Dragon' | 'Slimes';

/**
 * The second content axis, orthogonal to archetype. Archetype decides element
 * identity, trait pool and first ability; role decides the stat shape and the
 * second ability. The nine roles collapse to four stat profiles — the Buff and
 * Debuff modifiers change what a creature does, never how it is statted.
 */
export type Role =
  | 'Tank' | 'Tank Buff' | 'Tank Debuff'
  | 'Mage' | 'Mage Buff' | 'Mage Debuff'
  | 'Healer Buff' | 'Healer Debuff'
  | 'Fighter';

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

export type CriticalCondition = 'target_statused' | 'target_debuffed' | 'target_below_half';

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
  /** Authored Pack Tempo trigger evaluated once after the whole action resolves. */
  tempoGeneration?: 'on_hit';
  /** Deterministic condition replacing random critical rolls. */
  critCondition?: CriticalCondition;
  /** Presentation tag for a move with an intentionally broad or easy crit condition. */
  keen?: boolean;
  effects?: AbilityEffect[];
}

export interface CreatureTemplate {
  id: string;
  name: string;
  archetype: Archetype;
  role: Role;
  /**
   * Tower bands this species can be encountered in. Band N covers floors
   * (N-1)*10+1 .. N*10, so `[1, 2]` means anywhere on floors 1-20. This is the
   * single source of encounter placement — pools are derived from it rather
   * than maintained alongside it.
   */
  towerIds: number[];
  baseStats: BaseStats;
  defaultAbilities: string[];
  resistances: DamageType[];
  weaknesses: DamageType[];
  spriteColor: number;
  /** Trait ids this species may be imbued with. Compatibility is curated, never random. */
  naturalTraitPool: string[];
  /**
   * Base Obol price before rite band and HP, keyed by tower band. One entry per
   * band in `towerIds`, drawn from that band's range at authoring time and then
   * fixed — depth is already priced in by which band you meet the creature in,
   * so nothing recomputes at encounter time. A band whose entry is 0 (or absent)
   * cannot be taken in the wild there, which is how boss-exclusive and
   * breed-only species are expressed.
   */
  captureBasePrice: Record<number, number>;
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
   * every construction site populates it — loading already backfills it from the
   * species template, so persisted creatures always carry one.
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
  isPlayerOwned: boolean;
}

/**
 * What the tactics AI decides to do. The AI never applies it — the scene does.
 *
 * A single-variant union on purpose: `kind` is the discriminator future actions
 * hang off, capture being the next one.
 */
export type CombatAction =
  | { kind: 'ability'; abilityId: string; target: CombatCreature };

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
  /** Optional narrative payload resolved when this combat is won. */
  storyEventId?: string;
}

export interface RunState {
  startFloor: number;         // floor this run began on (1 unless a depth-jump was bought)
  currentEncounterIndex: number;
  encounters: Encounter[];
  choices: Encounter[];       // current pick-next choices
  obols: number;
  partyHp: Record<string, number>;
  partyMp: Record<string, number>;
  partyKO: Record<string, boolean>;
  xpEarned: number;
  autoCombat: boolean;    // AUTO toggle state; persists across encounters within a run
  activeBoons: ActiveBoon[];  // timed modifiers; expire with the run
}

export type RunOutcome = 'cleared' | 'fled' | 'wiped';

export interface LastRunSummary {
  outcome: RunOutcome;
  deepestFloor: number;
}

export interface ScheduledRelationshipReward {
  returnsRemaining: number;
  amount: number;
}

/** Generic persisted relationship state; content systems interpret its ids. */
export interface RelationshipProgress {
  stage: number;
  completedEventIds: string[];
  flags: string[];
  evidenceIds: string[];
  scheduledRewards: Record<string, ScheduledRelationshipReward>;
}

/**
 * A timed modifier active for the current run, chosen at the post-battle offer.
 *
 * `battlesLeft: null` means "lasts the whole run". Nothing produces that today —
 * it exists because a Relic is the same shape with no expiry, so Relics can reuse
 * this layer instead of duplicating it.
 */
export interface ActiveBoon {
  boonId: string;
  battlesLeft: number | null;
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
  Devils: 0xcc3366,
  Dragon: 0x338866,
  Slimes: 0x66ddcc,
};

export const RESISTANCE_MULTIPLIER = 0.5;
export const WEAKNESS_MULTIPLIER = 1.5;
export const CRIT_MULTIPLIER = 1.5;
export const MIN_HIT_CHANCE = 0.30;

// --- Essence / Obol economy (placeholders for playtest tuning) ---
/** Base Obol reward per encounter kind, before depth scaling. */
export const OBOL_REWARDS = { normal: 5, mini: 25, major: 75 } as const;
export const OBOL_TO_ESSENCE_RATE = 0.5;

// Obol rewards scale with depth — see OBOL_REWARD_EXPONENT below LEVEL_COST_EXPONENT.

// --- Tower structure ---
/**
 * The full tower is 100 floors in 10 bands. Alpha stops at 20 — the deepest the
 * Tower ID 1,2 roster reaches. Raise this as bands are authored; nothing else
 * needs to change with it.
 */
export const TOWER_FLOORS = 20;

/** Floors per tower band. Band N covers floors (N-1)*BAND_SIZE+1 .. N*BAND_SIZE. */
export const TOWER_BAND_SIZE = 10;

/** Highest band the full 100-floor tower reaches. */
export const TOWER_BAND_COUNT = 10;

/**
 * Which tower band a floor sits in. Shared by encounter generation and capture
 * pricing so the two can never disagree about where a band starts.
 */
export function bandForFloor(floor: number): number {
  const band = Math.floor((floor - 1) / TOWER_BAND_SIZE) + 1;
  return Math.max(1, Math.min(TOWER_BAND_COUNT, band));
}

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
 * `creature` and `item` are both live today. `mark` and `trait` are declared now
 * because each is already specified elsewhere and each must be wipe-eligible when
 * it arrives — marks earned in-run and carried out to be bound with Essence in
 * town, and traits dropped by bosses and events.
 *
 * The bag itself lives on `GameStateManager.backpack`, not on `RunState` — it is
 * carried cargo, not run-scoped state, so it persists across runs (town purchases
 * sit in it until the next descent; a capture that doesn't fit the Box waits in it
 * for room). It is included in the save.
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
  /**
   * A creature on the CAPTURING side (the player's party) has been knocked out.
   *
   * Named for the side it reads, not for a relationship: it was once
   * `ally_knocked_out`, which said the opposite of what it does — `CaptureParty`
   * is the party opposing the creature being captured. Renamed 2026-07-31.
   */
  | { kind: 'enemy_party_lost_member' }
  | { kind: 'solo_actor' }
  // The five below were added for the authored family rites. They read log
  // fields the combat scene does not write yet — see the note on RiteLog.
  /** An item was used on this creature (`self`) or on one of its allies (`ally`). */
  | { kind: 'item_consumed'; scope: 'self' | 'ally' }
  /** A damage type was USED this battle, by either side. `times` defaults to 1. */
  | { kind: 'damage_type_dealt'; damageType: DamageType; times?: number }
  /** This creature struck an enemy whose stage in `stat` was at least `stage`. */
  | { kind: 'struck_enemy_stat_stage_at_least'; stat: StatName; stage: number }
  /** The side opposing this creature fields the given archetype. */
  | { kind: 'enemy_party_contains_archetype'; archetype: Archetype }
  /** Any creature took a stat-stage debuff this battle. */
  | { kind: 'debuff_applied' };

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
 *
 * The last five fields are read by the authored family rites but are NOT written
 * by anything yet: capture is not wired into CombatScene. Whoever does that
 * wiring owns populating them, and `newRiteLog` names the write site for each.
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
  /**
   * How many times each damage type has been USED this battle, by either side.
   * Distinct from `damageTypesTaken`, which records only what this creature
   * received — a tally rather than a set, because "twice" cannot be expressed
   * by a membership check.
   */
  damageTypesDealt: Partial<Record<DamageType, number>>;
  /** An item was used on this creature. */
  itemConsumedOnSelf: boolean;
  /** An item was used on one of this creature's allies. */
  itemConsumedByAlly: boolean;
  /**
   * The highest stage this creature has seen in each stat on an enemy it struck.
   * Read at the moment of the hit — the struck creature's stages are out of
   * scope by the time a rite is evaluated.
   */
  struckStatStages: Partial<Record<StatName, number>>;
  /** Any creature on either side has taken a stat-stage debuff this battle. */
  debuffApplied: boolean;
}

/**
 * Facts about the **player's** party — which is the side *opposing* the creature
 * being captured. Every field here is read from the captors' point of view, which
 * is why the conditions that use it are all named `enemy_party_*`.
 */
export interface CaptureParty {
  /** A player creature is down. Not the captured creature's own side. */
  anyKnockedOut: boolean;
  /** How many of the player's creatures have acted this battle. */
  actorCount: number;
  /** Archetypes fielded, for rites that read the opposing team's composition. */
  archetypes: Archetype[];
}

/**
 * What a rejected bid tells the player. Never a number.
 *
 * "Never a number" scopes to this feedback channel only — **the price itself is
 * shown to the player.** `capturePrice` already folds in the satisfied rite band,
 * so the displayed number drops the moment a rite latches; that drop is the
 * discovery, and what stays hidden is *which* rite caused it. Do not turn this into
 * a price-guessing game: with enrage at CAPTURE_ENRAGE_AFTER rejections and enemies
 * acting after every failed bid, probing for the number would be unplayable.
 */
export type BidReaction = 'insulted' | 'wavers';

/**
 * Capture price = towerBandPrice * riteBandMultiplier * hpNudge.
 *
 * There used to be a continuous `floor^CAPTURE_DEPTH_EXPONENT` term here, tracking
 * OBOL_REWARD_EXPONENT so captures could not get relatively cheaper with depth.
 * The per-band price table in `CreatureTemplate.captureBasePrice` replaced it —
 * depth is priced by which band you meet the creature in, and keeping both would
 * count depth twice. The coupling concern still holds, but it now lives in the
 * band ranges (20-40 at band 1 climbing to 201-220 at band 10), which have to
 * stay ahead of Obol income at depth.
 */

/**
 * Multipliers on the base price by satisfied RITE tier — not tower band. The two
 * senses of "band" are unrelated; see `bandForFloor` for the tower one.
 */
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

// There is no DEFAULT_CAPTURE_BASE_PRICE any more. It existed to cover species
// with no authored price back when the price was a single scalar. Prices are now
// authored per tower band, and a band with no price means "not takeable here"
// rather than "charge the default" — so a fallback would silently make a
// deliberately uncapturable species purchasable. `creatures.test.ts` pins that
// every band a species appears in carries a real price.
