import { STARTER_TRIO_A } from '../data/creatures';
import { Ability, EncounterType } from '../types';

export type BattleChamberResourceModel = 'individual_mp' | 'shared_tempo';

/** Chamber-only loadouts that make the shared-resource comparison legible. */
export const SHARED_TEMPO_LOADOUTS: Readonly<Record<string, readonly string[]>> = {
  kin_070: ['jab', 'slash'],
  kin_092: ['frost', 'harden'],
  kin_123: ['ember', 'smolder'],
};

/**
 * Experimental conversion, deliberately isolated from the production rules:
 * builders are free, setup costs 1, and damaging payoffs cost 1–2.
 */
export function sharedTempoAbilityCost(ability: Ability): number {
  if (ability.id === 'basic_attack' || ability.tempoGeneration === 'on_hit') return 0;
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
  seed: number;
}

export interface BattleChamberContext {
  presetId: string;
  seed: number;
  auto: boolean;
  resourceModel: BattleChamberResourceModel;
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
  tempoSpentOnMoves: number;
  tempoSpentOnRelay: number;
  playerActions: number;
  enemyActions: number;
  packFirstRounds: number;
  initiativeRounds: number;
}

export const BATTLE_CHAMBER_PRESETS: readonly BattleChamberPreset[] = [
  {
    id: 'tempo_relay',
    name: 'TEMPO RELAY',
    purpose: 'Earn Tempo and pull Geta through an enemy-heavy timeline.',
    partyIds: STARTER_TRIO_A,
    enemyIds: ['kin_013', 'kin_087'],
    enemyLevel: 1,
    encounterType: 'combat',
    initialHpFraction: 1,
    initialMpFraction: 1,
    seed: 101,
  },
  {
    id: 'attrition',
    name: 'ATTRITION',
    purpose: 'Test decisions with wounded Kin, limited MP, and three intentions.',
    partyIds: STARTER_TRIO_A,
    enemyIds: ['kin_013', 'kin_087', 'kin_075'],
    enemyLevel: 2,
    encounterType: 'combat',
    initialHpFraction: 0.55,
    initialMpFraction: 0.35,
    seed: 202,
  },
  {
    id: 'mini_boss',
    name: 'MINI-BOSS',
    purpose: 'Measure a longer single-target fight before adding boss modules.',
    partyIds: STARTER_TRIO_A,
    enemyIds: ['kin_075'],
    enemyLevel: 3,
    encounterType: 'boss',
    bossTier: 'mini',
    initialHpFraction: 1,
    initialMpFraction: 1,
    seed: 303,
  },
] as const;

export function getBattleChamberPreset(id: string): BattleChamberPreset {
  return BATTLE_CHAMBER_PRESETS.find(preset => preset.id === id)
    ?? BATTLE_CHAMBER_PRESETS[0];
}
