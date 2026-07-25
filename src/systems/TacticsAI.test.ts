import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeTestCreature } from './CombatEngine.test';
import { getAbility } from '../data/abilities';
import { chooseAction, estimateDamage, NO_KNOWLEDGE } from './TacticsAI';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('estimateDamage', () => {
  it('consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    estimateDamage(a, d, getAbility('smash'), NO_KNOWLEDGE);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores a weakness on an unknown species', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'unknown', weaknesses: ['Fire'] });
    const blind = estimateDamage(a, d, getAbility('ember'), NO_KNOWLEDGE);
    const informed = estimateDamage(a, d, getAbility('ember'), new Set(['unknown']));
    expect(informed).toBeGreaterThan(blind);
  });

  it('weights by accuracy', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    // inferno_strike: power 70, accuracy 85. razor_wind: power 70, accuracy 95.
    expect(estimateDamage(a, d, getAbility('inferno_strike'), NO_KNOWLEDGE))
      .toBeLessThan(estimateDamage(a, d, getAbility('razor_wind'), NO_KNOWLEDGE));
  });

  it('returns 0 for a zero-power ability', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    expect(estimateDamage(a, d, getAbility('bold'), NO_KNOWLEDGE)).toBe(0);
  });
});

describe('chooseAction — enemy_default', () => {
  it('matches getEnemyAction: strongest affordable non-Status ability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['jab', 'thrash', 'smash'],
    });
    const hero = makeTestCreature({ speciesId: 'hero' });
    const action = chooseAction(enemy, [enemy], [hero], 'enemy_default', NO_KNOWLEDGE);
    expect(action).toEqual({ kind: 'ability', abilityId: 'thrash', target: hero });
  });

  it('never picks a Status ability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['bold', 'mend'],
    });
    const hero = makeTestCreature({ speciesId: 'hero' });
    const action = chooseAction(enemy, [enemy], [hero], 'enemy_default', NO_KNOWLEDGE);
    expect(action).toEqual({ kind: 'ability', abilityId: 'basic_attack', target: hero });
  });

  it('never exploits a weakness even when handed knowledge', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Weaker-power Fire move vs a Fire-weak target: an informed AI would pick ember.
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['ember', 'thrash'],
    });
    const hero = makeTestCreature({ speciesId: 'hero', weaknesses: ['Fire'] });
    const action = chooseAction(enemy, [enemy], [hero], 'enemy_default', new Set(['hero']));
    // enemy_default sorts by raw power only: thrash (75) beats ember (40).
    expect(action).toMatchObject({ abilityId: 'thrash' });
  });

  it('defends when no foe is alive', () => {
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const dead = makeTestCreature({ speciesId: 'hero', hp: 0 });
    expect(chooseAction(enemy, [enemy], [dead], 'enemy_default', NO_KNOWLEDGE))
      .toEqual({ kind: 'defend' });
  });
});
