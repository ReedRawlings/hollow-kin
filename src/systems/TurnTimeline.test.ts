import { describe, expect, it } from 'vitest';
import { CombatCreature } from '../types';
import { buildTurnSlots } from './TurnTimeline';

function creature(id: string, spd: number, player = false): CombatCreature {
  return {
    instance: {
      instanceId: id,
      currentStats: { hp: 10, mp: 10, str: 5, def: 5, wis: 5, spd, int: 5 },
    },
    isPlayerOwned: player,
    isKnockedOut: false,
    buffStages: {},
  } as CombatCreature;
}

describe('turn action slots', () => {
  it('gives ordinary combatants one unique standard slot in speed order', () => {
    const slow = creature('slow', 2);
    const fast = creature('fast', 9);
    const slots = buildTurnSlots([slow, fast], 1);
    expect(slots.map(slot => slot.actor.instance.instanceId)).toEqual(['fast', 'slow']);
    expect(new Set(slots.map(slot => slot.slotId)).size).toBe(2);
    expect(slots.every(slot => slot.source === 'standard')).toBe(true);
  });

  it('can schedule a boss twice with separately identified, separated slots', () => {
    const boss = creature('boss', 10);
    const kinA = creature('kin-a', 8, true);
    const kinB = creature('kin-b', 6, true);
    const slots = buildTurnSlots([boss, kinA, kinB], 2, {
      bossExtraActorIds: new Set(['boss']),
    });
    expect(slots.filter(slot => slot.actor === boss)).toHaveLength(2);
    expect(slots.map(slot => slot.source)).toEqual([
      'standard', 'standard', 'boss_extra', 'standard',
    ]);
    expect(new Set(slots.map(slot => slot.slotId)).size).toBe(4);
  });
});
