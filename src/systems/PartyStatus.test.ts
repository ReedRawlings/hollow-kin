import { describe, it, expect } from 'vitest';
import { CreatureInstance } from '../types';
import { resolvePartyStatus, PARTY_SIZE } from './PartyStatus';

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
