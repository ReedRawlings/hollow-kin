import { describe, expect, it } from 'vitest';
import {
  beginTempoRound, canSpendRelay, createPackTempoState, generateTempo,
  relayCandidates, relayTimeline, spendRelay, tempoReasonForAction,
} from './PackTempo';

describe('Pack Tempo resource', () => {
  it('starts empty, caps at three, and remains Relay-ready across rounds', () => {
    let state = createPackTempoState();
    state = generateTempo(state, 'slot-a', 'weakness').state;
    state = generateTempo(state, 'slot-b', 'break').state;
    state = generateTempo(state, 'slot-c', 'rebound').state;
    expect(state.points).toBe(3);
    expect(canSpendRelay(state)).toBe(true);
    const nextRound = beginTempoRound(state);
    expect(nextRound.points).toBe(3);
    expect(canSpendRelay(nextRound)).toBe(true);
  });

  it('generates at most once per action, including an extra action by the same Kin', () => {
    let state = createPackTempoState();
    state = generateTempo(state, 'standard-slot', 'weakness').state;
    expect(generateTempo(state, 'standard-slot', 'break').granted).toBe(0);
    expect(generateTempo(state, 'extra-slot', 'weakness').granted).toBe(1);
  });

  it('allows an explicit modifier to exceed base one-point generation', () => {
    const result = generateTempo(createPackTempoState(), 'slot-a', 'boon', 2);
    expect(result.granted).toBe(2);
    expect(result.state.points).toBe(2);
  });

  it('earns Tempo from a landed weakness without requiring knowledge metadata', () => {
    expect(tempoReasonForAction([{ landed: true, exploitedWeakness: true }])).toBe('weakness');
    expect(tempoReasonForAction([{ landed: false, exploitedWeakness: true }])).toBeNull();
    expect(tempoReasonForAction([{ landed: true, exploitedWeakness: false }])).toBeNull();
  });

  it('spends all three points and never expires merely because a round ended', () => {
    let state = createPackTempoState();
    state = generateTempo(state, 'slot-a', 'boon', 3).state;
    expect(spendRelay(state)?.points).toBe(0);
    expect(spendRelay(createPackTempoState())).toBeNull();
  });
});

describe('Relay timeline', () => {
  const id = (entry: string) => entry;

  it('pulls one unused action forward without copying it', () => {
    const original = ['kin-a', 'foe-a', 'foe-b', 'kin-b'];
    const relayed = relayTimeline(original, 0, 'kin-b', id)!;
    expect(relayed).toEqual(['kin-a', 'kin-b', 'foe-a', 'foe-b']);
    expect([...relayed].sort()).toEqual([...original].sort());
  });

  it('offers only later eligible slots that would move', () => {
    const timeline = ['kin-a', 'foe-a', 'kin-b', 'foe-b', 'kin-c'];
    expect(relayCandidates(timeline, 0, id, entry => entry.startsWith('kin')))
      .toEqual(['kin-b', 'kin-c']);
  });
});
