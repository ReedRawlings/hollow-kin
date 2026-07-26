import { CreatureInstance } from '../types';
import { getTemplate } from '../data/creatures';

/** A run takes exactly three creatures. */
export const PARTY_SIZE = 3;

/**
 * Whether a stored default party can actually descend.
 *
 * `missing` is the ordinary consequence of the breeding loop, not a rare edge case:
 * breeding retires both parents, so any party containing a bred-away creature lands
 * here. It carries names so the UI can say which creature is gone rather than making
 * the player open the editor to find out.
 */
export type PartyStatus =
  | { kind: 'ready'; members: CreatureInstance[] }
  | { kind: 'incomplete'; have: number }
  | { kind: 'missing'; missingNames: string[]; remaining: CreatureInstance[] };

function displayName(c: CreatureInstance): string {
  return c.nickname ?? getTemplate(c.speciesId).name;
}

/**
 * Resolve `defaultParty` (instance ids) against the creature box.
 *
 * Length is checked before membership: a short party is `incomplete` whether or not
 * its members are also stale, because "pick more creatures" is the action either way.
 */
export function resolvePartyStatus(
  defaultParty: string[],
  box: CreatureInstance[],
): PartyStatus {
  if (defaultParty.length !== PARTY_SIZE) {
    return { kind: 'incomplete', have: defaultParty.length };
  }

  const members: CreatureInstance[] = [];
  const missingNames: string[] = [];

  for (const id of defaultParty) {
    const found = box.find(c => c.instanceId === id);
    if (found && !found.isRetired) {
      members.push(found);
    } else if (found) {
      missingNames.push(displayName(found));
    } else {
      // Not in the box at all — a stale save. We cannot name it, but we must not throw.
      missingNames.push('a former party member');
    }
  }

  if (missingNames.length > 0) return { kind: 'missing', missingNames, remaining: members };
  return { kind: 'ready', members };
}

/**
 * The player-facing sentence for a non-ready party status, or null when the party is
 * ready and there is nothing to say. Breeding retires both parents, so two names is the
 * ordinary case, not an edge case — the verb must agree with the count.
 *
 * Extracted out of TownScene so it is testable: this exact string (and its singular vs.
 * plural agreement) previously lived inline in a scene and was untested, which is how it
 * shipped broken.
 */
export function describePartyStatus(status: PartyStatus): string | null {
  if (status.kind === 'ready') return null;
  if (status.kind === 'incomplete') {
    return `Choose ${PARTY_SIZE - status.have} more — set your party in PARTY.`;
  }
  const verb = status.missingNames.length === 1 ? 'is' : 'are';
  return `${status.missingNames.join(' and ')} ${verb} no longer available.`;
}
