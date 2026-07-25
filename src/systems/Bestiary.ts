import { CreatureTemplate, Archetype } from '../types';
import { CREATURE_TEMPLATES } from '../data/creatures';

/** A species as the Monsterpedia displays it. */
export interface BestiaryEntry {
  speciesId: string;
  name: string;
  archetype: Archetype;
  /** True once the player has met this species in a battle. */
  discovered: boolean;
  template: CreatureTemplate;
}

/**
 * Canonical archetype display order. Explicit rather than derived from object
 * key order so the grid layout can't reshuffle when creatures are added.
 */
export const ARCHETYPE_ORDER: readonly Archetype[] = [
  'Kami', 'Spirits', 'Flora', 'Fauna', 'Rock', 'Mecha', 'Food', 'Human',
];

/**
 * Every species in the roster, flagged against the player's seen set and
 * ordered by archetype then species id. `seen` may contain ids that are not in
 * the roster (from an older save); those are simply ignored.
 */
export function buildBestiary(seen: ReadonlySet<string>): BestiaryEntry[] {
  const entries: BestiaryEntry[] = Object.values(CREATURE_TEMPLATES).map(template => ({
    speciesId: template.id,
    name: template.name,
    archetype: template.archetype,
    discovered: seen.has(template.id),
    template,
  }));

  return entries.sort((a, b) => {
    const byArchetype = ARCHETYPE_ORDER.indexOf(a.archetype) - ARCHETYPE_ORDER.indexOf(b.archetype);
    if (byArchetype !== 0) return byArchetype;
    return a.speciesId < b.speciesId ? -1 : a.speciesId > b.speciesId ? 1 : 0;
  });
}

export function bestiaryProgress(entries: BestiaryEntry[]): { discovered: number; total: number } {
  return {
    discovered: entries.filter(e => e.discovered).length,
    total: entries.length,
  };
}

/** Pages needed to show `total` entries. Always at least 1, so the UI never reads "page 0 of 0". */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * One page of entries. Out-of-range and negative indices return empty rather
 * than throwing or — worse — slicing from the end, which a bare
 * `slice(pageIndex * pageSize)` would do for a negative index.
 */
export function pageOf(
  entries: BestiaryEntry[],
  pageIndex: number,
  pageSize: number,
): BestiaryEntry[] {
  if (pageIndex < 0) return [];
  const start = pageIndex * pageSize;
  if (start >= entries.length) return [];
  return entries.slice(start, start + pageSize);
}
