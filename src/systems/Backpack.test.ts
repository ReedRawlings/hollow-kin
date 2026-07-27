import { describe, it, expect } from 'vitest';
import {
  createBackpack, add, removeAt, isFull, freeSlots, usedSlots, capacity,
  isProtected, losableIndices, applyWipeLoss, capturedCreatures, unloadCapturesToBox,
} from './Backpack';
import { BackpackContents, CreatureInstance } from '../types';

function creature(id: string): BackpackContents {
  return { kind: 'creature', instance: { instanceId: id } as CreatureInstance };
}
const item = (id: string): BackpackContents => ({ kind: 'item', itemId: id });
const mark = (id: string): BackpackContents => ({ kind: 'mark', markId: id, earnedBy: 'c1' });

/** Fills every slot so the wipe tests have a known, fully-occupied bag. */
function packed(cap: number, guaranteed: number) {
  let bag = createBackpack(cap, guaranteed);
  for (let i = 0; i < cap; i++) bag = add(bag, item(`i${i}`))!.bag;
  return bag;
}

describe('backpack capacity', () => {
  it('starts empty at the requested capacity', () => {
    const bag = createBackpack(6, 2);
    expect(capacity(bag)).toBe(6);
    expect(usedSlots(bag)).toBe(0);
    expect(freeSlots(bag)).toBe(6);
    expect(isFull(bag)).toBe(false);
  });

  it('never promises more guaranteed slots than it has slots', () => {
    const bag = createBackpack(2, 99);
    expect(bag.guaranteedSlots).toBeLessThanOrEqual(capacity(bag));
  });

  it('reports full once every slot is taken', () => {
    const bag = packed(3, 1);
    expect(isFull(bag)).toBe(true);
    expect(freeSlots(bag)).toBe(0);
  });

  it('refuses to add to a full bag rather than dropping the cargo', () => {
    expect(add(packed(2, 0), creature('c1'))).toBeNull();
  });
});

describe('adding', () => {
  it('fills the safest slots first, so nothing sits at risk while a guaranteed slot is empty', () => {
    const bag = createBackpack(4, 2);
    const first = add(bag, creature('c1'))!;
    expect(isProtected(first.bag, first.index)).toBe(true);
  });

  it('does not mutate the bag it was given', () => {
    const bag = createBackpack(3, 1);
    const before = usedSlots(bag);
    add(bag, creature('c1'));
    expect(usedSlots(bag)).toBe(before);
  });

  it('reuses a slot freed by a removal', () => {
    let bag = packed(3, 0);
    bag = removeAt(bag, 1);
    const added = add(bag, creature('c1'))!;
    expect(added.index).toBe(1);
  });
});

describe('wipe loss', () => {
  it('takes exactly one thing, never the whole bag', () => {
    const bag = packed(5, 0);
    const before = usedSlots(bag);
    const result = applyWipeLoss(bag, () => 0.5);
    expect(usedSlots(result.bag)).toBe(before - 1);
    expect(result.lost).not.toBeNull();
  });

  it('never takes from a guaranteed slot', () => {
    const bag = packed(4, 4); // every slot protected
    const result = applyWipeLoss(bag, () => 0.99);
    expect(result.lost).toBeNull();
    expect(usedSlots(result.bag)).toBe(usedSlots(bag));
  });

  it('only ever considers occupied, unprotected slots', () => {
    let bag = createBackpack(5, 2);
    bag = add(bag, creature('safe'))!.bag;  // slot 0, protected
    bag = add(bag, creature('also'))!.bag;  // slot 1, protected
    bag = add(bag, creature('risk'))!.bag;  // slot 2, at risk
    expect(losableIndices(bag)).toEqual([2]);
  });

  it('loses nothing from an empty bag rather than erroring', () => {
    const result = applyWipeLoss(createBackpack(4, 1), () => 0.5);
    expect(result.lost).toBeNull();
    expect(result.lostIndex).toBe(-1);
  });

  it('takes the slot the roll selects', () => {
    const bag = packed(4, 0);
    expect(applyWipeLoss(bag, () => 0).lostIndex).toBe(0);
    expect(applyWipeLoss(bag, () => 0.99).lostIndex).toBe(3);
  });

  it('stays in range even if a roll returns exactly 1', () => {
    const bag = packed(3, 0);
    const result = applyWipeLoss(bag, () => 1);
    expect(result.lostIndex).toBeGreaterThanOrEqual(0);
    expect(result.lostIndex).toBeLessThan(capacity(bag));
    expect(result.lost).not.toBeNull();
  });

  it('can take a captured creature — captures are cargo like anything else', () => {
    let bag = createBackpack(2, 0);
    bag = add(bag, creature('caught'))!.bag;
    expect(applyWipeLoss(bag, () => 0).lost).toEqual(creature('caught'));
  });

  it('can take an earned mark being carried home', () => {
    let bag = createBackpack(2, 0);
    bag = add(bag, mark('mark_floor_5'))!.bag;
    expect(applyWipeLoss(bag, () => 0).lost?.kind).toBe('mark');
  });
});

describe('unloading to the box', () => {
  it('moves captures across when there is room', () => {
    let bag = createBackpack(4, 0);
    bag = add(bag, creature('a'))!.bag;
    bag = add(bag, creature('b'))!.bag;
    const result = unloadCapturesToBox(bag, 5);
    expect(result.moved).toHaveLength(2);
    expect(capturedCreatures(result.bag)).toHaveLength(0);
  });

  it('leaves what does not fit in the bag rather than destroying it', () => {
    let bag = createBackpack(4, 0);
    bag = add(bag, creature('a'))!.bag;
    bag = add(bag, creature('b'))!.bag;
    bag = add(bag, creature('c'))!.bag;
    const result = unloadCapturesToBox(bag, 1);
    expect(result.moved).toHaveLength(1);
    expect(capturedCreatures(result.bag)).toHaveLength(2);
  });

  it('moves nothing when the box is full, and keeps every capture', () => {
    let bag = createBackpack(3, 0);
    bag = add(bag, creature('a'))!.bag;
    const result = unloadCapturesToBox(bag, 0);
    expect(result.moved).toHaveLength(0);
    expect(capturedCreatures(result.bag)).toHaveLength(1);
  });

  it('leaves non-creature cargo untouched', () => {
    let bag = createBackpack(3, 0);
    bag = add(bag, item('potion'))!.bag;
    bag = add(bag, creature('a'))!.bag;
    const result = unloadCapturesToBox(bag, 5);
    expect(usedSlots(result.bag)).toBe(1);
    expect(result.bag.slots.some(s => s?.kind === 'item')).toBe(true);
  });
});
