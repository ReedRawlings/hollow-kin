export type Archetype = 'Kami' | 'Spirits' | 'Flora' | 'Fauna' | 'Rock' | 'Mecha' | 'Food' | 'Human';

export type DamageType = 'Fighting' | 'Electric' | 'Wind' | 'Fire' | 'Ice' | 'Ghost';

export type StatName = 'hp' | 'mp' | 'str' | 'def' | 'wis' | 'spd' | 'int';

export type StatusType = 'poison' | 'burn' | 'freeze' | 'stun' | 'sleep' | 'blind';

export type AbilityCategory = 'Physical' | 'Special' | 'Status';

export type TargetingType = 'single_enemy' | 'all_enemies' | 'self' | 'single_ally' | 'all_allies';

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
  currentLevel: number;
  levelCap: number;
  longevity: number;
  abilities: (string | null)[];
  traitSlots: TraitSlot[];
  lineage: { parentA: string | null; parentB: string | null };
  currentStats: BaseStats;
  resistances: DamageType[];
  weaknesses: DamageType[];
  isRetired: boolean;
  isBreedReady: boolean;
  xp: number;
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
  enemies?: string[];     // creature template IDs for combat encounters
  enemyLevels?: number;   // level for enemies in this encounter
  zone: number;
  index: number;
}

export interface RunState {
  currentZone: number;
  currentEncounterIndex: number;
  encounters: Encounter[];
  choices: Encounter[];       // current pick-next choices
  plasm: number;
  capturedCreatures: CreatureInstance[];
  partyHp: Record<string, number>;
  partyMp: Record<string, number>;
  partyKO: Record<string, boolean>;
  xpEarned: number;
}

export const STAR_LEVEL_CAPS: Record<number, number> = {
  0: 5, 1: 10, 2: 20, 3: 30, 4: 40, 5: 50,
  6: 60, 7: 70, 8: 80, 9: 90, 10: 95, 11: 97, 12: 99,
};

export const STAR_LONGEVITY: Record<number, number> = {
  0: 2, 1: 4, 2: 6, 3: 8, 4: 10, 5: 12,
  6: 14, 7: 16, 8: 18, 9: 20, 10: 22, 11: 24, 12: 26,
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

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
