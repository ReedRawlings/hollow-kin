import { describe, it, expect } from 'vitest';
import { CREATURE_TEMPLATES } from '../data/creatures';
import {
  buildBestiary, bestiaryProgress, pageCount, pageOf, ARCHETYPE_ORDER,
} from './Bestiary';

describe('buildBestiary', () => {
  it('returns one entry per species in the roster', () => {
    const entries = buildBestiary(new Set());
    expect(entries).toHaveLength(Object.keys(CREATURE_TEMPLATES).length);
  });

  it('marks nothing discovered for an empty set', () => {
    expect(buildBestiary(new Set()).every(e => !e.discovered)).toBe(true);
  });

  it('marks exactly the passed species as discovered', () => {
    const entries = buildBestiary(new Set(['kin_070', 'kin_020']));
    const discovered = entries.filter(e => e.discovered).map(e => e.speciesId).sort();
    expect(discovered).toEqual(['kin_020', 'kin_070']);
  });

  it('ignores species ids that are not in the roster', () => {
    const entries = buildBestiary(new Set(['kin_070', 'not_a_real_species']));
    expect(entries.filter(e => e.discovered).map(e => e.speciesId)).toEqual(['kin_070']);
  });

  it('carries the template through so the scene needs no second lookup', () => {
    const entry = buildBestiary(new Set()).find(e => e.speciesId === 'kin_070')!;
    expect(entry.template).toBe(CREATURE_TEMPLATES['kin_070']);
    expect(entry.name).toBe(CREATURE_TEMPLATES['kin_070'].name);
    expect(entry.archetype).toBe(CREATURE_TEMPLATES['kin_070'].archetype);
  });

  it('groups by archetype in ARCHETYPE_ORDER, then sorts by species id', () => {
    const entries = buildBestiary(new Set());

    // Archetype blocks must appear in ARCHETYPE_ORDER and never repeat.
    const blocks: string[] = [];
    for (const e of entries) {
      if (blocks[blocks.length - 1] !== e.archetype) blocks.push(e.archetype);
    }
    expect(blocks).toEqual([...new Set(blocks)]); // no archetype appears twice
    const expectedOrder = ARCHETYPE_ORDER.filter(a => blocks.includes(a));
    expect(blocks).toEqual(expectedOrder);

    // Within each archetype, species ids ascend.
    for (const archetype of blocks) {
      const ids = entries.filter(e => e.archetype === archetype).map(e => e.speciesId);
      expect(ids).toEqual([...ids].sort());
    }
  });

  it('is stable — two calls produce the same order', () => {
    const a = buildBestiary(new Set()).map(e => e.speciesId);
    const b = buildBestiary(new Set(['kin_070'])).map(e => e.speciesId);
    expect(a).toEqual(b);
  });
});

describe('bestiaryProgress', () => {
  it('counts discovered against total', () => {
    const entries = buildBestiary(new Set(['kin_070', 'kin_020']));
    expect(bestiaryProgress(entries)).toEqual({
      discovered: 2,
      total: Object.keys(CREATURE_TEMPLATES).length,
    });
  });

  it('reports zero discovered for a fresh save', () => {
    expect(bestiaryProgress(buildBestiary(new Set())).discovered).toBe(0);
  });
});

describe('pageCount', () => {
  it('rounds a partial final page up', () => {
    expect(pageCount(36, 30)).toBe(2);
  });
  it('does not add an empty page when the total divides evenly', () => {
    expect(pageCount(60, 30)).toBe(2);
  });
  it('reports a single page for a total smaller than one page', () => {
    expect(pageCount(5, 30)).toBe(1);
  });
  it('reports one page for an empty roster, so the UI never shows "page 0 of 0"', () => {
    expect(pageCount(0, 30)).toBe(1);
  });
});

describe('pageOf', () => {
  const entries = buildBestiary(new Set());

  it('returns the first pageSize entries for page 0', () => {
    expect(pageOf(entries, 0, 10)).toEqual(entries.slice(0, 10));
  });

  it('returns the correct middle slice', () => {
    expect(pageOf(entries, 1, 10)).toEqual(entries.slice(10, 20));
  });

  it('returns a short final page rather than padding', () => {
    const last = pageCount(entries.length, 30) - 1;
    expect(pageOf(entries, last, 30)).toEqual(entries.slice(last * 30));
    expect(pageOf(entries, last, 30).length).toBeLessThanOrEqual(30);
  });

  it('returns empty for an out-of-range page instead of throwing', () => {
    expect(pageOf(entries, 99, 30)).toEqual([]);
  });

  it('returns empty for a negative page instead of slicing from the end', () => {
    expect(pageOf(entries, -1, 30)).toEqual([]);
  });
});
