import { describe, it, expect } from 'vitest';
import {
  TRAIT_SLOT_LEVELS, MAX_TRAIT_SLOTS, unlockedSlotCount,
  traitUpgradeCost, duplicateSellValue, canSpeciesTakeTrait, getTrait,
  contestedSlotIndices,
} from './Traits';
import { CreatureInstance, DamageType, STAR_LEVEL_CAPS, TraitSlot } from '../types';
import { TRAIT_LIBRARY, TraitDefinition } from '../data/traits';
import { CREATURE_TEMPLATES } from '../data/creatures';

describe('TRAIT_SLOT_LEVELS', () => {
  it('is ordered strictly ascending', () => {
    for (let i = 1; i < TRAIT_SLOT_LEVELS.length; i++) {
      expect(TRAIT_SLOT_LEVELS[i]).toBeGreaterThan(TRAIT_SLOT_LEVELS[i - 1]);
    }
  });

  it('has exactly four thresholds (one per star tier through 3★)', () => {
    expect(TRAIT_SLOT_LEVELS.length).toBe(4);
    expect(MAX_TRAIT_SLOTS).toBe(4);
  });

  it('every threshold equals some star tier\'s cap in STAR_LEVEL_CAPS — the pinned relationship', () => {
    const starCaps = Object.values(STAR_LEVEL_CAPS);
    for (const threshold of TRAIT_SLOT_LEVELS) {
      expect(starCaps).toContain(threshold);
    }
  });

  it('matches the 0★-3★ caps specifically, in order', () => {
    expect(TRAIT_SLOT_LEVELS).toEqual([
      STAR_LEVEL_CAPS[0], STAR_LEVEL_CAPS[1], STAR_LEVEL_CAPS[2], STAR_LEVEL_CAPS[3],
    ]);
  });
});

describe('unlockedSlotCount', () => {
  it('unlocks zero slots below the first threshold', () => {
    expect(unlockedSlotCount(0)).toBe(0);
    expect(unlockedSlotCount(TRAIT_SLOT_LEVELS[0] - 1)).toBe(0);
  });

  it('unlocks exactly one more slot at each threshold, and none between thresholds', () => {
    TRAIT_SLOT_LEVELS.forEach((threshold, i) => {
      expect(unlockedSlotCount(threshold - 1)).toBe(i);   // not yet unlocked
      expect(unlockedSlotCount(threshold)).toBe(i + 1);   // unlocks exactly here
      expect(unlockedSlotCount(threshold + 1)).toBe(i + 1); // stays flat just after
    });
  });

  it('stays flat at the midpoint between two thresholds', () => {
    const mid = Math.floor((TRAIT_SLOT_LEVELS[0] + TRAIT_SLOT_LEVELS[1]) / 2);
    expect(unlockedSlotCount(mid)).toBe(1);
  });

  it('caps at the max slot count beyond the last threshold', () => {
    const beyond = TRAIT_SLOT_LEVELS[TRAIT_SLOT_LEVELS.length - 1] + 1000;
    expect(unlockedSlotCount(beyond)).toBe(MAX_TRAIT_SLOTS);
  });
});

describe('traitUpgradeCost', () => {
  it('rises with level (shape only — see CLAUDE.md alpha rule on magic numbers)', () => {
    expect(traitUpgradeCost(2)).toBeGreaterThan(traitUpgradeCost(1));
    expect(traitUpgradeCost(3)).toBeGreaterThan(traitUpgradeCost(2));
  });

  it('is always positive at every defined level', () => {
    expect(traitUpgradeCost(1)).toBeGreaterThan(0);
    expect(traitUpgradeCost(2)).toBeGreaterThan(0);
    expect(traitUpgradeCost(3)).toBeGreaterThan(0);
  });
});

describe('duplicateSellValue', () => {
  it('returns a positive value for a known trait', () => {
    expect(duplicateSellValue('hp_up')).toBeGreaterThan(0);
  });

  it('is small relative to even the cheapest trait upgrade', () => {
    expect(duplicateSellValue('hp_up')).toBeLessThan(traitUpgradeCost(1));
  });

  it('returns 0 for an unknown trait id, rather than throwing', () => {
    expect(() => duplicateSellValue('not_a_real_trait')).not.toThrow();
    expect(duplicateSellValue('not_a_real_trait')).toBe(0);
  });
});

describe('canSpeciesTakeTrait (strict, deny-by-default)', () => {
  it('allows a real species a trait that is actually in its authored pool', () => {
    const [speciesId, template] = Object.entries(CREATURE_TEMPLATES)[0];
    const inPoolTrait = template.naturalTraitPool[0];
    expect(canSpeciesTakeTrait(speciesId, inPoolTrait)).toBe(true);
  });

  it('denies a real species a trait that is not in its authored pool, if one exists', () => {
    const entry = Object.entries(CREATURE_TEMPLATES).find(
      ([, t]) => t.naturalTraitPool.length < Object.keys(TRAIT_LIBRARY).length,
    );
    expect(entry).toBeDefined();
    const [speciesId, template] = entry!;
    const outOfPoolTrait = Object.keys(TRAIT_LIBRARY).find(
      (id) => !template.naturalTraitPool.includes(id),
    );
    expect(outOfPoolTrait).toBeDefined();
    expect(canSpeciesTakeTrait(speciesId, outOfPoolTrait!)).toBe(false);
  });

  it('denies everything for an entirely unknown species id (missing pool)', () => {
    expect(canSpeciesTakeTrait('not_a_real_species', 'hp_up')).toBe(false);
  });

  it('respects an explicit pool: allows a trait that is in it', () => {
    const templates = { testspecies: { naturalTraitPool: ['hp_up', 'resist_fire'] } };
    expect(canSpeciesTakeTrait('testspecies', 'hp_up', templates)).toBe(true);
    expect(canSpeciesTakeTrait('testspecies', 'resist_fire', templates)).toBe(true);
  });

  it('respects an explicit pool: denies a trait that is not in it', () => {
    const templates = { testspecies: { naturalTraitPool: ['hp_up'] } };
    expect(canSpeciesTakeTrait('testspecies', 'resist_fire', templates)).toBe(false);
  });

  it('denies everything for a species given an explicit empty pool', () => {
    const templates = { testspecies: { naturalTraitPool: [] as string[] } };
    expect(canSpeciesTakeTrait('testspecies', 'hp_up', templates)).toBe(false);
  });
});

describe('naturalTraitPool authoring invariants (CREATURE_TEMPLATES)', () => {
  const templates = Object.values(CREATURE_TEMPLATES);
  const libraryIds = Object.keys(TRAIT_LIBRARY);

  it('every species has a non-empty naturalTraitPool', () => {
    for (const t of templates) {
      expect(t.naturalTraitPool).toBeDefined();
      expect(t.naturalTraitPool.length).toBeGreaterThan(0);
    }
  });

  it('every pool entry is a known trait id', () => {
    for (const t of templates) {
      for (const traitId of t.naturalTraitPool) {
        expect(libraryIds).toContain(traitId);
      }
    }
  });

  it('pools stay narrow — no species pool exceeds half the trait library (curated, not a dump of everything)', () => {
    for (const t of templates) {
      expect(t.naturalTraitPool.length).toBeLessThanOrEqual(libraryIds.length / 2);
    }
  });

  it('no pool contains duplicate trait ids', () => {
    for (const t of templates) {
      expect(new Set(t.naturalTraitPool).size).toBe(t.naturalTraitPool.length);
    }
  });

  it('essence_distiller is rare — held by a small minority of species', () => {
    const count = templates.filter((t) => t.naturalTraitPool.includes('essence_distiller')).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(templates.length / 4);
  });

  // The old rule here — "a resistance trait is only granted to a species that already
  // resists that damage type" (reinforce, never patch) — has been rejected by design.
  // Pools may now hand out a resistance trait for a type the species does NOT resist,
  // including one that patches an existing weakness (see the pool-fix report). What
  // remains true, and worth guarding, is content coverage: every damage type has a
  // matching resistance trait, and every resistance trait is actually reachable by
  // some species' pool.

  it('every DamageType has exactly one corresponding resistance trait in TRAIT_LIBRARY', () => {
    // Derived from TRAIT_LIBRARY itself (category === 'resistance' && target) rather than
    // a hand-rolled list, so a newly added DamageType with no matching trait (a content
    // gap, like the pre-fix Wind/Ghost gap) fails this test instead of silently shipping.
    const resistanceTraitsByDamageType: Record<string, TraitDefinition[]> = {};
    for (const t of Object.values(TRAIT_LIBRARY)) {
      if (t.category !== 'resistance' || !t.target) continue;
      (resistanceTraitsByDamageType[t.target] ??= []).push(t);
    }
    const allDamageTypes: DamageType[] = ['Fighting', 'Electric', 'Wind', 'Fire', 'Ice', 'Ghost'];
    for (const damageType of allDamageTypes) {
      expect(resistanceTraitsByDamageType[damageType]?.length).toBe(1);
    }
  });

  it('every resistance trait in TRAIT_LIBRARY appears in at least one species pool', () => {
    const resistanceTraitIds = Object.values(TRAIT_LIBRARY)
      .filter((t) => t.category === 'resistance')
      .map((t) => t.id);
    expect(resistanceTraitIds.length).toBeGreaterThan(0);
    for (const traitId of resistanceTraitIds) {
      const usedSomewhere = templates.some((t) => t.naturalTraitPool.includes(traitId));
      expect(usedSomewhere).toBe(true);
    }
  });
});

describe('getTrait', () => {
  it('returns the definition for a known trait id', () => {
    const def = getTrait('hp_up');
    expect(def).toBeDefined();
    expect(def?.id).toBe('hp_up');
    expect(def?.category).toBe('stat');
  });

  it('returns undefined for an unknown id, rather than throwing', () => {
    expect(() => getTrait('not_a_real_trait')).not.toThrow();
    expect(getTrait('not_a_real_trait')).toBeUndefined();
  });
});

describe('TRAIT_LIBRARY data integrity', () => {
  const traits = Object.values(TRAIT_LIBRARY);

  it('every entry\'s id matches its own key', () => {
    for (const [key, def] of Object.entries(TRAIT_LIBRARY)) {
      expect(def.id).toBe(key);
    }
  });

  it('every entry has exactly four magnitudes', () => {
    for (const def of traits) {
      expect(def.magnitudes.length).toBe(4);
    }
  });

  it('magnitudes are non-decreasing across levels (rising or flat, never falling)', () => {
    for (const def of traits) {
      for (let i = 1; i < def.magnitudes.length; i++) {
        expect(def.magnitudes[i]).toBeGreaterThanOrEqual(def.magnitudes[i - 1]);
      }
    }
  });

  it('covers all seven stat traits (HP/MP/STR/DEF/WIS/SPD/INT Up)', () => {
    const statTargets = traits.filter((t) => t.category === 'stat').map((t) => t.target);
    for (const stat of ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int']) {
      expect(statTargets).toContain(stat);
    }
  });

  it('has at least two resistance traits', () => {
    expect(traits.filter((t) => t.category === 'resistance').length).toBeGreaterThanOrEqual(2);
  });

  it('has at least two battle_start traits', () => {
    expect(traits.filter((t) => t.category === 'battle_start').length).toBeGreaterThanOrEqual(2);
  });
});

describe('contestedSlotIndices', () => {
  // Minimal creature-instance factory — only the fields contestedSlotIndices reads.
  function makeCreature(traitSlots: TraitSlot[]): CreatureInstance {
    return {
      instanceId: 'c', speciesId: 'kin_070', nickname: null, starRating: 0,
      currentLevel: 1, levelCap: 5, permanentLevel: 1, essenceInvested: 0,
      abilities: [], traitSlots, lineage: { parentA: null, parentB: null },
      statBaseline: { hp: 1, mp: 1, str: 1, def: 1, wis: 1, spd: 1, int: 1 },
      currentStats: { hp: 1, mp: 1, str: 1, def: 1, wis: 1, spd: 1, int: 1 },
      resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
      tactic: 'fight_wisely',
    };
  }

  function emptySlots(): TraitSlot[] {
    return Array.from({ length: MAX_TRAIT_SLOTS }, () => ({ traitId: null, traitLevel: 0, unlocked: false }));
  }

  function slotsWith(overrides: Record<number, Partial<TraitSlot>>): TraitSlot[] {
    const slots = emptySlots();
    for (const [i, o] of Object.entries(overrides)) {
      slots[Number(i)] = { ...slots[Number(i)], ...o };
    }
    return slots;
  }

  it('returns an empty array when neither parent holds any traits', () => {
    const a = makeCreature(emptySlots());
    const b = makeCreature(emptySlots());
    expect(contestedSlotIndices(a, b)).toEqual([]);
  });

  it('does not flag a slot where only one parent holds a trait', () => {
    const a = makeCreature(slotsWith({ 0: { traitId: 'sturdy', traitLevel: 1, unlocked: true } }));
    const b = makeCreature(emptySlots());
    expect(contestedSlotIndices(a, b)).toEqual([]);
  });

  it('flags a slot where both parents hold a (possibly different) trait', () => {
    const a = makeCreature(slotsWith({ 0: { traitId: 'sturdy', traitLevel: 1, unlocked: true } }));
    const b = makeCreature(slotsWith({ 0: { traitId: 'swift', traitLevel: 1, unlocked: true } }));
    expect(contestedSlotIndices(a, b)).toEqual([0]);
  });

  it('reports every contested index, not just the first', () => {
    const a = makeCreature(slotsWith({
      0: { traitId: 't0a', traitLevel: 1, unlocked: true },
      2: { traitId: 't2a', traitLevel: 1, unlocked: true },
    }));
    const b = makeCreature(slotsWith({
      0: { traitId: 't0b', traitLevel: 1, unlocked: true },
      2: { traitId: 't2b', traitLevel: 1, unlocked: true },
    }));
    expect(contestedSlotIndices(a, b)).toEqual([0, 2]);
  });

  it('is not gated on unlocked — an escrowed (locked) slot on both sides still contests', () => {
    const a = makeCreature(slotsWith({ 1: { traitId: 'deep-a', traitLevel: 1, unlocked: false } }));
    const b = makeCreature(slotsWith({ 1: { traitId: 'deep-b', traitLevel: 1, unlocked: false } }));
    expect(contestedSlotIndices(a, b)).toEqual([1]);
  });
});
