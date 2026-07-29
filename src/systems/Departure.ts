import { Backpack, RunState } from '../types';

/**
 * When the party may walk out of the tower, and where the next chance is.
 *
 * Pure and Phaser-free, like Departure's neighbours in this folder. The whole
 * module exists so that "can I leave?" has exactly one answer, computed the same
 * way by the run map's button, its header line and its commitment modal.
 *
 * Departure state is DERIVED, never stored. Committing to a room advances
 * `currentEncounterIndex`, which closes the gate as a side effect of the move the
 * player already makes — so there is no flag to keep in sync, and a fresh run
 * reads closed for free because the index starts at -1. This follows the same
 * reasoning as breed-readiness (see CLAUDE.md): a stored copy of a derivable fact
 * is a bug waiting to happen.
 */

/**
 * Departure is open exactly on the boss floor just cleared.
 *
 * Entering the tower is itself a commitment, so a run that has cleared nothing
 * (`currentEncounterIndex === -1`) is closed regardless of where it started.
 */
export function canDepart(run: RunState): boolean {
  const current = run.encounters[run.currentEncounterIndex];
  return run.currentEncounterIndex >= 0 && current?.type === 'boss';
}

/**
 * Floor of the next boss ahead in the descent, or null when none remains.
 *
 * Deliberately scans the generated encounter list rather than computing the next
 * multiple of five. The descent is the authority on where bosses actually are,
 * and an arithmetic shortcut here could disagree with it — which would show the
 * player a promised exit floor that never arrives.
 */
export function nextDepartureFloor(run: RunState): number | null {
  for (let i = run.currentEncounterIndex + 1; i < run.encounters.length; i++) {
    if (run.encounters[i].type === 'boss') return run.encounters[i].floor;
  }
  return null;
}

/** Does the bag hold anything that can end the expedition early? */
export function hasWaystone(bag: Backpack): boolean {
  return bag.slots.some(s => s !== null && s.kind === 'item' && s.itemId === 'waystone');
}
