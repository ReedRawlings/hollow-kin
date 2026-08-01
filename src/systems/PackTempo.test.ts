import { describe, expect, it } from 'vitest';
import {
  beginTempoRound,
  canSpendRelay,
  createPackTempoState,
  generateTempo,
  relayCandidates,
  relayTimeline,
  spendRelay,
  spendTempo,
} from './PackTempo';

describe('Pack Tempo resource', () => {
  it('starts empty, caps at three, and carries points between rounds', () => {
    let state = createPackTempoState();
    expect(state.points).toBe(0);
    for (const id of ['a', 'b', 'c']) {
      state = generateTempo(state, id, 'move_condition').state;
    }
    const capped = generateTempo(state, 'd', 'conditional_critical');
    expect(capped.state.points).toBe(3);
    expect(capped.wastedAtCap).toBe(true);

    const nextRound = beginTempoRound(capped.state);
    expect(nextRound.points).toBe(3);
    expect(nextRound.generatedActorIds.size).toBe(0);
  });

  it('allows each Kin to generate at most once per round', () => {
    const first = generateTempo(createPackTempoState(), 'kin-a', 'known_weakness');
    const second = generateTempo(first.state, 'kin-a', 'conditional_critical');
    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
    expect(second.state.points).toBe(1);
  });

  it('spends exactly one point for Relay', () => {
    const earned = generateTempo(createPackTempoState(), 'kin-a', 'move_condition').state;
    expect(canSpendRelay(earned)).toBe(true);
    expect(spendRelay(earned)?.points).toBe(0);
    expect(spendRelay(createPackTempoState())).toBeNull();
  });

  it('spends arbitrary move costs without overdrawing the pool', () => {
    let state = createPackTempoState();
    for (const id of ['a', 'b', 'c']) state = generateTempo(state, id, 'move_condition').state;
    expect(spendTempo(state, 2)?.points).toBe(1);
    expect(spendTempo(state, 4)).toBeNull();
    expect(spendTempo(state, 0)?.points).toBe(3);
  });
});

describe('Relay timeline', () => {
  const id = (entry: string) => entry;

  it('pulls one unused action forward without adding or removing an action', () => {
    const original = ['kin-a', 'foe-a', 'foe-b', 'kin-b', 'kin-c'];
    const relayed = relayTimeline(original, 0, 'kin-b', id);
    expect(relayed).toEqual(['kin-a', 'kin-b', 'foe-a', 'foe-b', 'kin-c']);
    expect(relayed).toHaveLength(original.length);
    expect([...relayed!].sort()).toEqual([...original].sort());
  });

  it('rejects past, current, already-next, missing, and duplicated entries', () => {
    expect(relayTimeline(['a', 'b', 'c'], 1, 'a', id)).toBeNull();
    expect(relayTimeline(['a', 'b', 'c'], 1, 'b', id)).toBeNull();
    expect(relayTimeline(['a', 'b', 'c'], 0, 'b', id)).toBeNull();
    expect(relayTimeline(['a', 'b', 'c'], 0, 'x', id)).toBeNull();
    expect(relayTimeline(['a', 'b', 'b'], 0, 'b', id)).toBeNull();
  });

  it('only offers later eligible actions that would actually move', () => {
    const timeline = ['kin-a', 'foe-a', 'kin-b', 'foe-b', 'kin-c'];
    expect(relayCandidates(timeline, 0, id, entry => entry.startsWith('kin')))
      .toEqual(['kin-b', 'kin-c']);
    expect(relayCandidates(timeline, 2, id, entry => entry.startsWith('kin')))
      .toEqual(['kin-c']);
  });

  it('supports a chain while preserving exactly one action per original entry', () => {
    const original = ['kin-a', 'foe-a', 'kin-b', 'foe-b', 'kin-c'];
    const first = relayTimeline(original, 0, 'kin-b', id)!;
    const second = relayTimeline(first, 1, 'kin-c', id)!;
    expect(second).toEqual(['kin-a', 'kin-b', 'kin-c', 'foe-a', 'foe-b']);
    expect([...second].sort()).toEqual([...original].sort());
  });
});
