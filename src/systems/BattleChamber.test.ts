import { describe, expect, it } from 'vitest';
import { getAbility } from '../data/abilities';
import {
  BATTLE_CHAMBER_PRESETS, getBattleChamberPreset, sharedTempoAbilityCost,
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

  it('makes builders free and bounds shared-resource payoff costs', () => {
    expect(sharedTempoAbilityCost(getAbility('basic_attack'))).toBe(0);
    expect(sharedTempoAbilityCost(getAbility('jab'))).toBe(0);
    expect(sharedTempoAbilityCost(getAbility('harden'))).toBe(1);
    expect(sharedTempoAbilityCost(getAbility('slash'))).toBe(1);
    expect(sharedTempoAbilityCost(getAbility('smolder'))).toBe(2);
    expect(sharedTempoAbilityCost(getAbility('razor_wind'))).toBe(2);
  });
});
