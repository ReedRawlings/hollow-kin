import { describe, expect, it } from 'vitest';
import { ActiveBoon } from '../types';
import { BOON_LIST, BOONS, getBoon } from '../data/boons';
import {
  activeBoonSummaries, damageDealtMultiplier, damageTakenMultiplier,
  grantBoon, obolMultiplier, postVictoryHealFraction, tickAfterBattle,
} from './Boons';

/** The id of the first boon carrying each effect kind, so tests never hard-code names. */
function idWithEffect(kind: string): string {
  const found = BOON_LIST.find(b => b.effect.kind === kind);
  if (!found) throw new Error(`no boon with effect ${kind}`);
  return found.id;
}

describe('boon catalog authoring', () => {
  it('keys every entry by its own id', () => {
    for (const [key, def] of Object.entries(BOONS)) expect(def.id).toBe(key);
  });

  it('gives every boon a name, a description and a positive duration', () => {
    for (const def of BOON_LIST) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.battles).toBeGreaterThan(0);
    }
  });

  it('covers all four effect kinds', () => {
    const kinds = new Set(BOON_LIST.map(b => b.effect.kind));
    for (const k of ['damage_dealt', 'damage_taken', 'obol_bonus', 'post_victory_heal']) {
      expect(kinds.has(k as any)).toBe(true);
    }
  });

  it('falls back rather than throwing on an unknown id', () => {
    expect(getBoon('no_such_boon')).toBe(BOON_LIST[0]);
  });
});

describe('neutral values with no boons', () => {
  const none: ActiveBoon[] = [];
  it('multiplies damage dealt by one', () => expect(damageDealtMultiplier(none)).toBe(1));
  it('multiplies damage taken by one', () => expect(damageTakenMultiplier(none, 1)).toBe(1));
  it('multiplies obols by one', () => expect(obolMultiplier(none)).toBe(1));
  it('heals nothing after a victory', () => expect(postVictoryHealFraction(none)).toBe(0));
  it('summarises to an empty list', () => expect(activeBoonSummaries(none)).toEqual([]));
});

describe('grantBoon', () => {
  it('adds a boon with its full duration', () => {
    const id = idWithEffect('damage_dealt');
    const active = grantBoon([], id);
    expect(active).toHaveLength(1);
    expect(active[0].boonId).toBe(id);
    expect(active[0].battlesLeft).toBe(getBoon(id).battles);
  });

  it('keeps boons of different effect kinds side by side', () => {
    let active = grantBoon([], idWithEffect('damage_dealt'));
    active = grantBoon(active, idWithEffect('obol_bonus'));
    expect(active).toHaveLength(2);
  });

  it('REPLACES rather than stacks when the effect kind repeats', () => {
    // Keyed on effect.kind, not boon id — two differently-named boons with the
    // same effect must not multiply together.
    const id = idWithEffect('damage_dealt');
    let active = grantBoon([], id);
    active = tickAfterBattle(active);           // burn one battle
    const before = damageDealtMultiplier(active);
    active = grantBoon(active, id);             // re-grant
    expect(active).toHaveLength(1);
    expect(active[0].battlesLeft).toBe(getBoon(id).battles);  // duration refreshed
    expect(damageDealtMultiplier(active)).toBe(before);       // magnitude UNCHANGED
  });

  it('does not mutate the list it was given', () => {
    const original = grantBoon(grantBoon([], idWithEffect('damage_dealt')), idWithEffect('obol_bonus'));
    const snapshot = original.map(a => ({ ...a }));
    grantBoon(original, idWithEffect('post_victory_heal'));
    expect(original).toHaveLength(snapshot.length);
    expect(original).toEqual(snapshot);
  });
});

describe('tickAfterBattle', () => {
  it('does not mutate the list it was given', () => {
    const original = grantBoon(grantBoon([], idWithEffect('damage_dealt')), idWithEffect('obol_bonus'));
    const snapshot = original.map(a => ({ ...a }));
    tickAfterBattle(original);
    expect(original).toHaveLength(snapshot.length);
    expect(original).toEqual(snapshot);
  });

  it('counts a boon down by one battle', () => {
    const id = idWithEffect('obol_bonus');
    const active = tickAfterBattle(grantBoon([], id));
    expect(active[0].battlesLeft).toBe(getBoon(id).battles - 1);
  });

  it('drops a boon once it is spent', () => {
    const id = idWithEffect('obol_bonus');
    let active = grantBoon([], id);
    for (let i = 0; i < getBoon(id).battles; i++) active = tickAfterBattle(active);
    expect(active).toHaveLength(0);
  });

  it('leaves a run-long boon alone', () => {
    // battlesLeft === null is the Relic shape; it must survive ticking.
    const active = tickAfterBattle([{ boonId: idWithEffect('obol_bonus'), battlesLeft: null }]);
    expect(active).toHaveLength(1);
    expect(active[0].battlesLeft).toBeNull();
  });
});

describe('effect queries', () => {
  it('raises damage dealt above neutral', () => {
    expect(damageDealtMultiplier(grantBoon([], idWithEffect('damage_dealt')))).toBeGreaterThan(1);
  });

  it('raises obols above neutral', () => {
    expect(obolMultiplier(grantBoon([], idWithEffect('obol_bonus')))).toBeGreaterThan(1);
  });

  it('heals a positive fraction after a victory', () => {
    expect(postVictoryHealFraction(grantBoon([], idWithEffect('post_victory_heal')))).toBeGreaterThan(0);
  });

  it('reduces damage taken below neutral', () => {
    expect(damageTakenMultiplier(grantBoon([], idWithEffect('damage_taken')), 1)).toBeLessThan(1);
  });

  it('applies a first-round ward on round 1 and not on round 2', () => {
    const active = grantBoon([], idWithEffect('damage_taken'));
    expect(damageTakenMultiplier(active, 1)).toBeLessThan(1);
    expect(damageTakenMultiplier(active, 2)).toBe(1);
  });

  it('reports each active boon with its remaining battles', () => {
    const active = grantBoon([], idWithEffect('damage_dealt'));
    const summary = activeBoonSummaries(active);
    expect(summary).toHaveLength(1);
    expect(summary[0].name).toBe(getBoon(active[0].boonId).name);
    expect(summary[0].battlesLeft).toBe(active[0].battlesLeft);
  });
});
