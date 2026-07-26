import { describe, expect, it } from 'vitest';
import { CreatureInstance, RunState } from '../types';
import {
  applyTargetedRecovery, canReceiveRecovery, eligibleRecoveryTargets,
} from './Recovery';

function creature(instanceId: string): CreatureInstance {
  return {
    instanceId,
    speciesId: 'ironjaw',
    nickname: null,
    starRating: 0,
    currentLevel: 1,
    levelCap: 5,
    permanentLevel: 1,
    essenceInvested: 0,
    abilities: [],
    traitSlots: [],
    lineage: { parentA: null, parentB: null },
    statBaseline: { hp: 100, mp: 20, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    currentStats: { hp: 100, mp: 20, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    resistances: [],
    weaknesses: [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
    tactic: 'fight_wisely',
  };
}

function runFor(party: CreatureInstance[]): RunState {
  return {
    startFloor: 1,
    currentEncounterIndex: 0,
    encounters: [],
    choices: [],
    obols: 0,
    capturedCreatures: [],
    partyHp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.hp])),
    partyMp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.mp])),
    partyKO: Object.fromEntries(party.map(c => [c.instanceId, false])),
    xpEarned: 0,
    autoCombat: false,
  };
}

describe('targeted recovery', () => {
  it('offers only living creatures with a deficit in the chosen resource', () => {
    const party = [creature('full'), creature('hurt'), creature('ko')];
    const run = runFor(party);
    run.partyHp.hurt = 50;
    run.partyMp.hurt = 10;
    run.partyHp.ko = 0;
    run.partyMp.ko = 0;
    run.partyKO.ko = true;

    expect(eligibleRecoveryTargets('hp', party, run).map(c => c.instanceId)).toEqual(['hurt']);
    expect(eligibleRecoveryTargets('mp', party, run).map(c => c.instanceId)).toEqual(['hurt']);
  });

  it('does not allow ordinary recovery on knocked-out creatures', () => {
    const target = creature('target');
    const run = runFor([target]);
    run.partyKO.target = true;
    run.partyHp.target = 0;

    expect(canReceiveRecovery('hp', target, run)).toBe(false);
    expect(applyTargetedRecovery('hp', 0.5, target, run)).toBe(0);
    expect(run.partyHp.target).toBe(0);
  });

  it('restores only the selected creature and caps HP at maximum', () => {
    const selected = creature('selected');
    const other = creature('other');
    const run = runFor([selected, other]);
    run.partyHp.selected = 80;
    run.partyHp.other = 25;

    expect(applyTargetedRecovery('hp', 0.5, selected, run)).toBe(20);
    expect(run.partyHp).toEqual({ selected: 100, other: 25 });
  });

  it('supports a full MP restore without changing another creature', () => {
    const selected = creature('selected');
    const other = creature('other');
    const run = runFor([selected, other]);
    run.partyMp.selected = 3;
    run.partyMp.other = 4;

    expect(applyTargetedRecovery('mp', 1, selected, run)).toBe(17);
    expect(run.partyMp).toEqual({ selected: 20, other: 4 });
  });
});
