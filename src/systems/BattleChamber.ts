import { STARTER_HAND_LOADOUTS, STARTER_TRIO_A } from '../data/creatures';
import { Ability, EncounterType } from '../types';

export type BattleChamberResourceModel = 'individual_mp' | 'shared_actions';

/** The active combat architecture is tested against expedition-style individual MP. */
export const DEFAULT_BATTLE_CHAMBER_RESOURCE_MODEL: BattleChamberResourceModel = 'individual_mp';

export interface BattleChamberResourceRules {
  moveCurrency: 'individual_mp' | 'shared_action_points';
  learnedMoveCost: string;
  basicAttackCost: string;
  roundRefresh: string;
  relayCurrency: 'pack_tempo';
}

export function battleChamberResourceRules(
  model: BattleChamberResourceModel,
): BattleChamberResourceRules {
  if (model === 'shared_actions') {
    return {
      moveCurrency: 'shared_action_points',
      learnedMoveCost: '1-2 AP',
      basicAttackCost: '0 AP',
      roundRefresh: '3 AP at round start; no banking',
      relayCurrency: 'pack_tempo',
    };
  }
  return {
    moveCurrency: 'individual_mp',
    learnedMoveCost: 'authored MP cost',
    basicAttackCost: '0 MP',
    roundRefresh: 'none during battle',
    relayCurrency: 'pack_tempo',
  };
}

/** The Chamber uses the real Founding Hand loadouts so its results cannot drift. */
export const BATTLE_CHAMBER_LOADOUTS = STARTER_HAND_LOADOUTS;

/**
 * Experimental conversion, deliberately isolated from the production rules:
 * Basic Attack is the free fallback; learned setup/payoff moves cost 1–2 AP.
 */
export function sharedActionAbilityCost(ability: Ability): number {
  if (ability.id === 'basic_attack') return 0;
  if (ability.power <= 0) return 1;
  return Math.min(2, Math.max(1, Math.ceil(ability.mpCost / 3)));
}

export interface BattleChamberPreset {
  id: string;
  name: string;
  purpose: string;
  partyIds: readonly string[];
  enemyIds: readonly string[];
  enemyLevel: number;
  encounterType: EncounterType;
  bossTier?: 'mini' | 'major';
  initialHpFraction: number;
  initialMpFraction: number;
  /** Test fixture: seeds spendable Tempo without changing production combat. */
  initialTempoPoints?: number;
  /** Enable authored Link Art recipes and their combat UI. */
  linkArts?: boolean;
  /** Give the first living enemy a second, separately telegraphed action slot. */
  bossDoubleAction?: boolean;
  seed: number;
}

export interface BattleChamberContext {
  presetId: string;
  seed: number;
  auto: boolean;
  resourceModel: BattleChamberResourceModel;
  initialTempoPoints?: number;
  linkArts?: boolean;
  bossDoubleAction?: boolean;
  /** Development lab knowledge: authored weaknesses are visible and Tempo-eligible immediately. */
  revealWeaknesses?: boolean;
  comparisonResults?: Partial<Record<BattleChamberResourceModel, BattleChamberResult>>;
}

export interface BattleChamberResult {
  presetId: string;
  resourceModel: BattleChamberResourceModel;
  outcome: 'victory' | 'defeat';
  rounds: number;
  tempoGenerated: number;
  tempoSpent: number;
  tempoWasted: number;
  relays: number;
  actionPointsSpent: number;
  tempoSpentOnRelay: number;
  playerActions: number;
  enemyActions: number;
  packFirstRounds: number;
  initiativeRounds: number;
  relayHeldRounds: number;
  linkArtsCompleted: number;
  linksInterrupted: number;
  relayEnabledLinks: number;
}

export const BATTLE_CHAMBER_PRESETS: readonly BattleChamberPreset[] = [
  {
    id: 'tempo_relay',
    name: 'RELAY + LINKS',
    purpose: 'Earn Tempo from Iron, Ash, and Salt weaknesses; Relay into a Link.',
    partyIds: STARTER_TRIO_A,
    enemyIds: ['kin_013', 'kin_017', 'kin_037'],
    enemyLevel: 1,
    encounterType: 'combat',
    initialHpFraction: 1,
    initialMpFraction: 1,
    linkArts: true,
    seed: 101,
  },
  {
    id: 'attrition',
    name: 'ATTRITION',
    purpose: 'Test held Relay under resource pressure.',
    partyIds: STARTER_TRIO_A,
    enemyIds: ['kin_013', 'kin_087', 'kin_075'],
    enemyLevel: 2,
    encounterType: 'combat',
    initialHpFraction: 0.55,
    initialMpFraction: 0.35,
    initialTempoPoints: 3,
    seed: 202,
  },
  {
    id: 'mini_boss',
    name: 'TWIN THREAT',
    purpose: 'A mini-boss owns two separate intent slots every round.',
    partyIds: STARTER_TRIO_A,
    enemyIds: ['kin_075'],
    enemyLevel: 3,
    encounterType: 'boss',
    bossTier: 'mini',
    initialHpFraction: 1,
    initialMpFraction: 1,
    bossDoubleAction: true,
    linkArts: true,
    seed: 303,
  },
] as const;

export function getBattleChamberPreset(id: string): BattleChamberPreset {
  return BATTLE_CHAMBER_PRESETS.find(preset => preset.id === id)
    ?? BATTLE_CHAMBER_PRESETS[0];
}
