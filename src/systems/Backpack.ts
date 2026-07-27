import {
  Backpack, BackpackContents, BackpackSlot,
  BACKPACK_START_CAPACITY, BACKPACK_START_GUARANTEED,
} from '../types';

/**
 * The backpack — what the player carries on a descent, and what a wipe can take.
 *
 * Pure throughout, like Capture.ts: nothing here mutates a run or consumes RNG on
 * its own. The one function that needs randomness takes it as a parameter, so a
 * test can pin the outcome and the scene keeps ownership of the RNG stream.
 *
 * The rule this module exists to enforce, from CLAUDE.md's design rules:
 * **a wipe costs exactly one thing, chosen at random from unprotected slots —
 * never the whole inventory.** Getting this wrong in either direction breaks the
 * design: taking everything makes players descend empty rather than risk anything
 * worth carrying, and taking nothing makes the backpack free value.
 */

export function createBackpack(
  capacity: number = BACKPACK_START_CAPACITY,
  guaranteedSlots: number = BACKPACK_START_GUARANTEED,
): Backpack {
  return {
    slots: new Array<BackpackSlot>(Math.max(0, capacity)).fill(null),
    guaranteedSlots: Math.min(Math.max(0, guaranteedSlots), Math.max(0, capacity)),
  };
}

export function capacity(bag: Backpack): number {
  return bag.slots.length;
}

export function usedSlots(bag: Backpack): number {
  return bag.slots.reduce((n, s) => (s === null ? n : n + 1), 0);
}

export function freeSlots(bag: Backpack): number {
  return capacity(bag) - usedSlots(bag);
}

export function isFull(bag: Backpack): boolean {
  return freeSlots(bag) === 0;
}

/** Index of the first empty slot, or -1 when full. */
export function firstFreeIndex(bag: Backpack): number {
  return bag.slots.findIndex(s => s === null);
}

/**
 * A slot is protected purely by position — the first `guaranteedSlots` are safe.
 * Position is therefore meaningful, which is why `add` fills from the front: the
 * safest space is used first, so a player never loses something to a wipe while a
 * guaranteed slot sat empty.
 */
export function isProtected(bag: Backpack, index: number): boolean {
  return index < bag.guaranteedSlots;
}

/**
 * Put something in the first free slot. Returns the new bag and the index used, or
 * `null` when there is no room — callers must handle the full case rather than
 * silently dropping cargo.
 */
export function add(bag: Backpack, contents: BackpackContents): { bag: Backpack; index: number } | null {
  const index = firstFreeIndex(bag);
  if (index === -1) return null;
  const slots = [...bag.slots];
  slots[index] = contents;
  return { bag: { ...bag, slots }, index };
}

/** Empty a slot. A no-op on an already-empty or out-of-range index. */
export function removeAt(bag: Backpack, index: number): Backpack {
  if (index < 0 || index >= bag.slots.length || bag.slots[index] === null) return bag;
  const slots = [...bag.slots];
  slots[index] = null;
  return { ...bag, slots };
}

/** Occupied, unprotected slot indices — exactly the candidates for a wipe loss. */
export function losableIndices(bag: Backpack): number[] {
  const out: number[] = [];
  for (let i = bag.guaranteedSlots; i < bag.slots.length; i++) {
    if (bag.slots[i] !== null) out.push(i);
  }
  return out;
}

export interface WipeLoss {
  bag: Backpack;
  /** What was taken, or null when there was nothing losable. */
  lost: BackpackContents | null;
  lostIndex: number;
}

/**
 * Apply a wipe: take exactly one thing at random from the unprotected slots.
 *
 * `roll` returns a float in [0, 1) — injected rather than calling Math.random here
 * so tests can pin which slot is taken, and so the scene keeps one RNG stream.
 *
 * Losing nothing is a legitimate outcome (empty bag, or everything protected) and
 * is reported as `lost: null` rather than treated as an error.
 */
export function applyWipeLoss(bag: Backpack, roll: () => number): WipeLoss {
  const candidates = losableIndices(bag);
  if (candidates.length === 0) return { bag, lost: null, lostIndex: -1 };

  const pick = Math.min(candidates.length - 1, Math.floor(roll() * candidates.length));
  const lostIndex = candidates[pick];
  return { bag: removeAt(bag, lostIndex), lost: bag.slots[lostIndex], lostIndex };
}

/** Every captured creature being carried, in slot order. */
export function capturedCreatures(bag: Backpack): Extract<BackpackContents, { kind: 'creature' }>[] {
  return bag.slots.filter(
    (s): s is Extract<BackpackContents, { kind: 'creature' }> => s !== null && s.kind === 'creature',
  );
}

/**
 * Move captures into the Box on a successful exit, up to the space available.
 *
 * Per the capture spec's box-full rule, anything that does not fit **stays in the
 * bag** and moves across the next time there is room — a capture is never destroyed
 * for want of storage.
 */
export function unloadCapturesToBox(bag: Backpack, boxSpace: number): {
  bag: Backpack;
  moved: Extract<BackpackContents, { kind: 'creature' }>[];
} {
  const moved: Extract<BackpackContents, { kind: 'creature' }>[] = [];
  if (boxSpace <= 0) return { bag, moved };

  const slots = [...bag.slots];
  for (let i = 0; i < slots.length && moved.length < boxSpace; i++) {
    const s = slots[i];
    if (s !== null && s.kind === 'creature') {
      moved.push(s);
      slots[i] = null;
    }
  }
  return { bag: { ...bag, slots }, moved };
}
