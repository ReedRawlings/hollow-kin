import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_LIST, getItem } from './items';

describe('item catalog authoring', () => {
  it('keys every entry by its own id', () => {
    for (const [key, def] of Object.entries(ITEMS)) expect(def.id).toBe(key);
  });

  it('gives every item a name and a description', () => {
    for (const def of ITEM_LIST) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('carries the eight pitched items plus the pre-existing buff', () => {
    for (const id of [
      'mending_draught', 'moonwater', 'hollow_candle', 'clearroot', 'power_increase',
      'grave_ash', 'null_salt', 'smoke_husk', 'waystone',
    ]) {
      expect(ITEMS[id]).toBeDefined();
    }
  });

  it('only lets effects that survive a battle be used on the map', () => {
    // RunState tracks partyHp/partyMp/partyKO and nothing else, so any other
    // effect kind would consume the item and silently do nothing out there.
    const mapSafe = new Set(['heal', 'restore_mp', 'revive', 'depart']);
    for (const def of ITEM_LIST) {
      if (def.usableIn === 'map' || def.usableIn === 'both') {
        expect(mapSafe.has(def.effect.kind)).toBe(true);
      }
    }
  });

  it('targets nothing with the two effects that act on the whole run or battle', () => {
    for (const def of ITEM_LIST) {
      if (def.effect.kind === 'depart' || def.effect.kind === 'escape_battle') {
        expect(def.targeting).toBe('none');
      }
    }
  });

  it('only revives with downed-ally targeting, and only downed-ally targeting revives', () => {
    for (const def of ITEM_LIST) {
      expect(def.effect.kind === 'revive').toBe(def.targeting === 'downed_ally');
    }
  });

  it('hurts a boss less than an ordinary enemy with percent damage', () => {
    for (const def of ITEM_LIST) {
      if (def.effect.kind === 'percent_damage') {
        expect(def.effect.bossFraction).toBeLessThan(def.effect.fraction);
        expect(def.effect.bossFraction).toBeGreaterThan(0);
      }
    }
  });

  it('falls back rather than throwing on an unknown id', () => {
    expect(getItem('no_such_item')).toBe(ITEM_LIST[0]);
  });
});
