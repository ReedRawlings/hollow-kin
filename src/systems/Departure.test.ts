import { describe, expect, it } from 'vitest';
import { Backpack, Encounter, RunState } from '../types';
import { canDepart, hasWaystone, nextDepartureFloor } from './Departure';

function encounter(index: number, floor: number, type: Encounter['type']): Encounter {
  return { type, floor, index };
}

/** A descent with bosses at floors 5 and 10, combat elsewhere. */
function descent(): Encounter[] {
  return Array.from({ length: 10 }, (_, i) =>
    encounter(i, i + 1, (i + 1) % 5 === 0 ? 'boss' : 'combat'));
}

function runAt(index: number, startFloor = 1): RunState {
  return {
    startFloor,
    currentEncounterIndex: index,
    encounters: descent(),
    choices: [],
    obols: 0,
    partyHp: {},
    partyMp: {},
    partyKO: {},
    xpEarned: 0,
    autoCombat: false,
  };
}

function bag(slots: Backpack['slots']): Backpack {
  return { slots, guaranteedSlots: 2 };
}

describe('canDepart', () => {
  it('is closed at the start of a run, before anything is cleared', () => {
    expect(canDepart(runAt(-1))).toBe(false);
  });

  it('is closed on an ordinary floor', () => {
    expect(canDepart(runAt(0))).toBe(false);
  });

  it('opens on the boss floor just cleared', () => {
    expect(canDepart(runAt(4))).toBe(true); // index 4 === floor 5 === boss
  });

  it('closes again once the party commits to the next room', () => {
    expect(canDepart(runAt(5))).toBe(false);
  });
});

describe('nextDepartureFloor', () => {
  it('reports the first boss ahead at the start of a run', () => {
    expect(nextDepartureFloor(runAt(-1))).toBe(5);
  });

  it('looks strictly ahead, not at the boss just cleared', () => {
    expect(nextDepartureFloor(runAt(4))).toBe(10);
  });

  it('is null once no boss remains', () => {
    expect(nextDepartureFloor(runAt(9))).toBeNull();
  });

  it('reads the generated descent rather than assuming a cadence', () => {
    // A descent whose only boss sits at floor 3 must report 3, not 5.
    const run = runAt(-1);
    run.encounters = [
      encounter(0, 1, 'combat'),
      encounter(1, 2, 'combat'),
      encounter(2, 3, 'boss'),
    ];
    expect(nextDepartureFloor(run)).toBe(3);
  });
});

describe('hasWaystone', () => {
  it('is false for an empty bag', () => {
    expect(hasWaystone(bag([null, null]))).toBe(false);
  });

  it('is false when carrying some other item', () => {
    expect(hasWaystone(bag([{ kind: 'item', itemId: 'mending_draught' }]))).toBe(false);
  });

  it('is true when a waystone is carried', () => {
    expect(hasWaystone(bag([null, { kind: 'item', itemId: 'waystone' }]))).toBe(true);
  });
});
