import { describe, it, expect } from 'vitest';
import { CREATURE_TEMPLATES, STARTER_TRIO_A, getTemplate, poolForBand } from './creatures';
import { ABILITIES } from './abilities';
import { ARCHETYPE_ORDER } from '../systems/Bestiary';
import { Archetype } from '../types';

/**
 * Authoring invariants for the roster. Everything here guards a failure mode that
 * is silent at runtime — a bad ability id degrades a creature to basic attacks, a
 * missing archetype floats it to the top of the Monsterpedia, an unpriced band
 * makes a species quietly untakeable. None of them are type errors.
 */
describe('roster authoring invariants', () => {
  const templates = Object.values(CREATURE_TEMPLATES);

  it('keys every template by its own id', () => {
    for (const [key, t] of Object.entries(CREATURE_TEMPLATES)) {
      expect(t.id).toBe(key);
    }
  });

  it('gives every creature abilities that actually exist', () => {
    // getAbility falls back to basic_attack on an unknown id, so a typo in a
    // generated ability reference would ship as a creature that just punches.
    for (const t of templates) {
      expect(t.defaultAbilities.length).toBeGreaterThan(0);
      for (const abilityId of t.defaultAbilities) {
        expect(Object.keys(ABILITIES)).toContain(abilityId);
      }
    }
  });

  it('places every creature in at least one tower band', () => {
    for (const t of templates) {
      expect(t.towerIds.length).toBeGreaterThan(0);
    }
  });

  it('prices every band a creature appears in', () => {
    // A band with no price reads as uncapturable, which for a wild species is a
    // silent content bug rather than a design decision.
    for (const t of templates) {
      for (const band of t.towerIds) {
        expect(t.captureBasePrice[band]).toBeGreaterThan(0);
      }
    }
  });

  it('gives every creature a family rite', () => {
    for (const t of templates) {
      expect(t.rites?.length ?? 0).toBeGreaterThan(0);
      expect(t.rites!.some(r => r.band === 'family')).toBe(true);
    }
  });

  it('shares one identical family rite across each archetype', () => {
    const byArchetype = new Map<Archetype, string>();
    for (const t of templates) {
      const familyId = t.rites!.find(r => r.band === 'family')!.id;
      const seen = byArchetype.get(t.archetype);
      if (seen === undefined) byArchetype.set(t.archetype, familyId);
      else expect(familyId).toBe(seen);
    }
  });

  it('has a Monsterpedia sort position for every archetype in use', () => {
    // ARCHETYPE_ORDER is derived from an exhaustive Record, so this cannot drift
    // — but an archetype missing from it sorts to index -1, ahead of everything.
    for (const t of templates) {
      expect(ARCHETYPE_ORDER).toContain(t.archetype);
    }
  });
});

describe('poolForBand', () => {
  it('returns every creature authored into that band, and only those', () => {
    for (const band of [1, 2]) {
      const pool = poolForBand(band);
      expect(pool.length).toBeGreaterThan(0);
      for (const id of pool) {
        expect(getTemplate(id).towerIds).toContain(band);
      }
      const expected = Object.values(CREATURE_TEMPLATES)
        .filter(t => t.towerIds.includes(band)).length;
      expect(pool).toHaveLength(expected);
    }
  });

  it('returns nothing for a band no creature is authored into', () => {
    expect(poolForBand(9)).toEqual([]);
  });
});

describe('getTemplate', () => {
  it('throws on an unknown species id rather than returning undefined', () => {
    // The old signature lied about its return type, which disarmed TypeScript at
    // every call site and turned a dead id into a TypeError frames away — or, in
    // the save loader's catch, into a silent "no save found".
    expect(() => getTemplate('not_a_real_species')).toThrow(/Unknown species/);
  });
});

describe('starter trio', () => {
  it('names three creatures that exist', () => {
    expect(STARTER_TRIO_A).toHaveLength(3);
    for (const id of STARTER_TRIO_A) expect(() => getTemplate(id)).not.toThrow();
  });

  it('covers three distinct stat shapes, so a first descent meets all of them', () => {
    const roles = STARTER_TRIO_A.map(id => getTemplate(id).role);
    expect(new Set(roles).size).toBe(3);
  });

  it('starts the player in the shallowest band', () => {
    for (const id of STARTER_TRIO_A) {
      expect(getTemplate(id).towerIds).toContain(1);
    }
  });
});
