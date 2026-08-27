import { describe, expect, it } from 'vitest';
import { EVENTS, EVENT_LIST, getEvent } from './events';

describe('event catalogue', () => {
  it('has at least one event', () => {
    expect(EVENT_LIST.length).toBeGreaterThan(0);
  });

  it('keys every entry by its own id, and ids are unique', () => {
    const ids = EVENT_LIST.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key, def] of Object.entries(EVENTS)) expect(def.id).toBe(key);
  });

  it('gives every event a non-empty name, flavour and terms', () => {
    for (const def of EVENT_LIST) {
      expect(def.name.trim().length).toBeGreaterThan(0);
      expect(def.flavour.trim().length).toBeGreaterThan(0);
      expect(def.terms.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes the wager, which is the always-viable fallback the system relies on', () => {
    expect(EVENTS.warden_wager).toBeDefined();
  });

  it('resolves a known id and falls back rather than throwing on an unknown one', () => {
    expect(getEvent('mercy_well').id).toBe('mercy_well');
    expect(getEvent('not_an_event')).toBe(EVENT_LIST[0]);
  });
});
