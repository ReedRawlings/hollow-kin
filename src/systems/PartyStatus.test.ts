import { describe, it, expect } from 'vitest';
import { CreatureInstance } from '../types';
import { resolvePartyStatus, describePartyStatus, PARTY_SIZE } from './PartyStatus';
import { breed } from './BreedingSystem';

function makeCreature(instanceId: string, speciesId = 'ironjaw', over: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    instanceId, speciesId, nickname: null, starRating: 0, currentLevel: 1, levelCap: 5,
    permanentLevel: 1, essenceInvested: 0, abilities: [], traitSlots: [],
    lineage: { parentA: null, parentB: null },
    currentStats: { hp: 10, mp: 10, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
    tactic: 'fight_wisely',
    ...over,
  };
}

describe('resolvePartyStatus', () => {
  it('is ready when all three are present and active', () => {
    const box = [makeCreature('a'), makeCreature('b'), makeCreature('c')];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(status.kind).toBe('ready');
    if (status.kind === 'ready') {
      expect(status.members.map(m => m.instanceId)).toEqual(['a', 'b', 'c']);
    }
  });

  it('preserves the stored order, not box order', () => {
    const box = [makeCreature('a'), makeCreature('b'), makeCreature('c')];
    const status = resolvePartyStatus(['c', 'a', 'b'], box);
    if (status.kind !== 'ready') throw new Error('expected ready');
    expect(status.members.map(m => m.instanceId)).toEqual(['c', 'a', 'b']);
  });

  it('is incomplete on a brand-new game with no party set', () => {
    expect(resolvePartyStatus([], [])).toEqual({ kind: 'incomplete', have: 0 });
  });

  it('is incomplete with fewer than a full party', () => {
    const box = [makeCreature('a'), makeCreature('b')];
    expect(resolvePartyStatus(['a', 'b'], box)).toEqual({ kind: 'incomplete', have: 2 });
  });

  it('reports a retired member as missing, by name', () => {
    const box = [
      makeCreature('a'),
      makeCreature('b', 'ironjaw', { isRetired: true }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(status.kind).toBe('missing');
    if (status.kind === 'missing') {
      expect(status.missingNames).toEqual(['Ironjaw']);
      expect(status.remaining.map(m => m.instanceId)).toEqual(['a', 'c']);
    }
  });

  it('prefers a nickname over the species name when reporting a missing member', () => {
    const box = [
      makeCreature('a'),
      makeCreature('b', 'ironjaw', { isRetired: true, nickname: 'Chomper' }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    if (status.kind !== 'missing') throw new Error('expected missing');
    expect(status.missingNames).toEqual(['Chomper']);
  });

  it('names every missing member, not just the first', () => {
    const box = [
      makeCreature('a', 'ironjaw', { isRetired: true }),
      makeCreature('b', 'emberwhelp', { isRetired: true }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    if (status.kind !== 'missing') throw new Error('expected missing');
    expect(status.missingNames).toEqual(['Ironjaw', 'Emberwhelp']);
  });

  it('does not throw when a stored id is absent from the box entirely', () => {
    const box = [makeCreature('a'), makeCreature('c')];
    const status = resolvePartyStatus(['a', 'ghost-id', 'c'], box);
    expect(status.kind).toBe('missing');
    if (status.kind === 'missing') {
      expect(status.missingNames).toHaveLength(1);
      expect(status.remaining.map(m => m.instanceId)).toEqual(['a', 'c']);
    }
  });

  it('reports incomplete rather than missing when the party is both short and stale', () => {
    // Length is checked first: a two-id party is incomplete regardless of retirement.
    const box = [makeCreature('a', 'ironjaw', { isRetired: true })];
    expect(resolvePartyStatus(['a', 'b'], box)).toEqual({ kind: 'incomplete', have: 2 });
  });

  it('expects a party of three', () => {
    expect(PARTY_SIZE).toBe(3);
  });
});

describe('resolvePartyStatus after a real breed (finding 1 regression)', () => {
  // This exercises the actual production flow, not a hand-set isRetired fixture: call
  // the real breed(), then leave both parents in the box exactly as BreedingScene now
  // does (it no longer calls removeFromBox — see BreedingScene.performBreed). A test
  // that hand-sets isRetired: true would not catch a regression to the old behavior,
  // because "parent removed from the box entirely" is a different state than "parent
  // retired but still in the box", and only the latter is what breed() + BreedingScene
  // together produce.
  it('names both retired parents by their real names, not a placeholder', () => {
    const parentA = makeCreature('a', 'ironjaw', { isBreedReady: true, starRating: 1 });
    const parentB = makeCreature('b', 'emberwhelp', { isBreedReady: true, starRating: 1 });
    const thirdMember = makeCreature('c', 'stoneguard');
    const box: CreatureInstance[] = [parentA, parentB, thirdMember];

    const offspring = breed(parentA, parentB, parentA.speciesId, []);
    // Mirrors BreedingScene.performBreed(): add the offspring, do NOT remove the parents.
    box.push(offspring);

    expect(parentA.isRetired).toBe(true);
    expect(parentB.isRetired).toBe(true);

    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(status.kind).toBe('missing');
    if (status.kind !== 'missing') throw new Error('expected missing');
    expect(status.missingNames).toEqual(['Ironjaw', 'Emberwhelp']);
    expect(status.missingNames).not.toContain('a former party member');

    expect(describePartyStatus(status)).toBe('Ironjaw and Emberwhelp are no longer available.');
  });
});

describe('describePartyStatus', () => {
  it('returns null when the party is ready', () => {
    const box = [makeCreature('a'), makeCreature('b'), makeCreature('c')];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(describePartyStatus(status)).toBeNull();
  });

  it('uses singular "is" for exactly one missing name', () => {
    const box = [
      makeCreature('a'),
      makeCreature('b', 'ironjaw', { isRetired: true }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(describePartyStatus(status)).toBe('Ironjaw is no longer available.');
  });

  it('uses plural "are" for two missing names — the ordinary post-breeding case', () => {
    const box = [
      makeCreature('a', 'ironjaw', { isRetired: true }),
      makeCreature('b', 'emberwhelp', { isRetired: true }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(describePartyStatus(status)).toBe('Ironjaw and Emberwhelp are no longer available.');
  });

  it('describes the incomplete case by how many more are needed', () => {
    const status = resolvePartyStatus(['a', 'b'], [makeCreature('a'), makeCreature('b')]);
    expect(describePartyStatus(status)).toBe('Choose 1 more — set your party in PARTY.');
  });
});
