import { describe, expect, it } from 'vitest';
import { getAbility } from '../data/abilities';
import { getTemplate, STARTER_HAND_LOADOUTS } from '../data/creatures';
import {
  BATTLE_CHAMBER_PRESETS, DEFAULT_BATTLE_CHAMBER_RESOURCE_MODEL,
  BATTLE_CHAMBER_LOADOUTS, battleChamberResourceRules, getBattleChamberPreset,
  sharedActionAbilityCost,
} from './BattleChamber';

describe('Battle Chamber presets', () => {
  it('have unique ids, three Kin, enemies, and explicit seeds', () => {
    expect(new Set(BATTLE_CHAMBER_PRESETS.map(preset => preset.id)).size)
      .toBe(BATTLE_CHAMBER_PRESETS.length);
    for (const preset of BATTLE_CHAMBER_PRESETS) {
      expect(preset.partyIds).toHaveLength(3);
      expect(preset.enemyIds.length).toBeGreaterThan(0);
      expect(Number.isInteger(preset.seed)).toBe(true);
    }
  });

  it('falls back to the first preset for an unknown id', () => {
    expect(getBattleChamberPreset('missing')).toBe(BATTLE_CHAMBER_PRESETS[0]);
  });

  it('makes the dedicated Relay preset earn Tempo from three chamber-readable weaknesses', () => {
    const preset = getBattleChamberPreset('tempo_relay');
    expect(preset.initialTempoPoints ?? 0).toBe(0);
    expect(preset.linkArts).toBe(true);
    expect(preset.enemyIds.map(id => getTemplate(id).weaknesses[0]))
      .toEqual(['Iron', 'Ash', 'Salt']);
  });

  it('contains an isolated double-action experiment', () => {
    expect(getBattleChamberPreset('mini_boss').bossDoubleAction).toBe(true);
  });

  it('opens on individual MP while retaining the legacy AP comparison', () => {
    expect(DEFAULT_BATTLE_CHAMBER_RESOURCE_MODEL).toBe('individual_mp');
    expect(battleChamberResourceRules('shared_actions')).toEqual({
      moveCurrency: 'shared_action_points',
      learnedMoveCost: '1-2 AP',
      basicAttackCost: '0 AP',
      roundRefresh: '3 AP at round start; no banking',
      relayCurrency: 'pack_tempo',
    });
    expect(battleChamberResourceRules('individual_mp').moveCurrency).toBe('individual_mp');
  });

  it('uses the same authored Link-ready test loadouts under MP and legacy AP', () => {
    expect(BATTLE_CHAMBER_LOADOUTS).toBe(STARTER_HAND_LOADOUTS);
    expect(BATTLE_CHAMBER_LOADOUTS).toEqual({
      kin_070: ['jab', 'slash'],
      kin_092: ['frost', 'harden'],
      kin_123: ['ember', 'smolder'],
    });
  });

  it('makes builders free and bounds shared-resource payoff costs', () => {
    expect(sharedActionAbilityCost(getAbility('basic_attack'))).toBe(0);
    expect(sharedActionAbilityCost(getAbility('jab'))).toBe(1);
    expect(sharedActionAbilityCost(getAbility('harden'))).toBe(1);
    expect(sharedActionAbilityCost(getAbility('slash'))).toBe(1);
    expect(sharedActionAbilityCost(getAbility('smolder'))).toBe(2);
    expect(sharedActionAbilityCost(getAbility('razor_wind'))).toBe(2);
  });
});
