import { describe, expect, it } from 'vitest';
import { victoryRewards } from './Battle';
import { grantBoon } from '../Boons';
import { REWARD_BOON_LIST } from '../../data/boons';
import { ActiveBoon, Encounter } from '../../types';

// Shape tests only: the ratio is the point, never the absolute payout.
const base: Encounter = { type: 'combat', floor: 3, index: 2, enemies: ['kin_070'], enemyLevels: 2 };

describe('victoryRewards', () => {
  it('rewardMultiplier scales both Obols and XP by that factor', () => {
    const plain = victoryRewards(base, []);
    const doubled = victoryRewards({ ...base, rewardMultiplier: 2 }, []);
    expect(plain.obolGain).toBeGreaterThan(0);
    expect(plain.xpPerCreature).toBeGreaterThan(0);
    expect(doubled.obolGain / plain.obolGain).toBeCloseTo(2, 1);
    expect(doubled.xpPerCreature / plain.xpPerCreature).toBeCloseTo(2, 1);
  });

  it('an absent multiplier behaves as 1', () => {
    expect(victoryRewards({ ...base, rewardMultiplier: 1 }, [])).toEqual(victoryRewards(base, []));
  });

  it('composes with the boon Obol multiplier rather than replacing it', () => {
    const obolBoon = REWARD_BOON_LIST.find(b => b.effect.kind === 'obol_bonus');
    if (!obolBoon) return;
    const boons: ActiveBoon[] = grantBoon([], obolBoon.id);
    const withBoon = victoryRewards(base, boons);
    const both = victoryRewards({ ...base, rewardMultiplier: 2 }, boons);
    expect(withBoon.obolGain).toBeGreaterThan(victoryRewards(base, []).obolGain);
    expect(both.obolGain / withBoon.obolGain).toBeCloseTo(2, 1);
  });
});
