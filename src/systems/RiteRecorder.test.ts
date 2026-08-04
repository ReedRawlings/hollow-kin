import { describe, it, expect } from 'vitest';
import {
  newLogBook, logFor, recordDamageTypeUsed, recordDamageTaken, recordStrike,
  recordItemUsed, recordEffectOutcome, recordActed, recordRoundSurvived,
  snapshotEffects, captureParty,
} from './RiteRecorder';
import { makeTestCreature } from './testFixtures';
import { getAbility } from '../data/abilities';

const enemy = (id: string) => makeTestCreature({ speciesId: id, isPlayer: false });
const hero = (id: string) => makeTestCreature({ speciesId: id, isPlayer: true });

/** makeTestCreature gives every creature a distinct instanceId already. */
function book(...enemies: ReturnType<typeof enemy>[]) {
  return { b: newLogBook(enemies), enemies };
}

describe('newLogBook', () => {
  it('opens one log per enemy, keyed by instance id', () => {
    const a = enemy('a'), c = enemy('c');
    const b = newLogBook([a, c]);
    expect(b.size).toBe(2);
    expect(logFor(b, a)).toBeDefined();
    expect(logFor(b, c)).toBeDefined();
  });

  it('has no log for a player creature — the book is enemies only', () => {
    const b = newLogBook([enemy('a')]);
    expect(logFor(b, hero('h'))).toBeUndefined();
  });

  it('starts every field empty, so nothing is satisfied before the fight', () => {
    const a = enemy('a');
    const log = logFor(newLogBook([a]), a)!;
    expect(log.damageTypesTaken).toEqual([]);
    expect(log.damageTypesDealt).toEqual({});
    expect(log.debuffApplied).toBe(false);
    expect(log.itemConsumedOnSelf).toBe(false);
    expect(log.hasActed).toBe(false);
    expect(log.turnsAlive).toBe(0);
  });
});

describe('recordDamageTypeUsed — battle-wide tally', () => {
  it('tallies onto every enemy log, because the condition is about the battle', () => {
    const { b, enemies } = book(enemy('a'), enemy('c'));
    recordDamageTypeUsed(b, getAbility('ember')); // Ash
    for (const e of enemies) expect(logFor(b, e)!.damageTypesDealt.Ash).toBe(1);
  });

  it('counts repeats, since "twice" cannot be a membership check', () => {
    const { b, enemies } = book(enemy('a'));
    recordDamageTypeUsed(b, getAbility('ember'));
    recordDamageTypeUsed(b, getAbility('ember'));
    expect(logFor(b, enemies[0])!.damageTypesDealt.Ash).toBe(2);
  });

  it('ignores an ability with no damage type', () => {
    const { b, enemies } = book(enemy('a'));
    recordDamageTypeUsed(b, getAbility('bold')); // Status, damageType None
    expect(logFor(b, enemies[0])!.damageTypesDealt).toEqual({});
  });
});

describe('recordDamageTaken — per-creature', () => {
  it('records only on the creature that was hit', () => {
    const { b, enemies } = book(enemy('a'), enemy('c'));
    recordDamageTaken(b, enemies[0], getAbility('ember'));
    expect(logFor(b, enemies[0])!.damageTypesTaken).toContain('Ash');
    expect(logFor(b, enemies[1])!.damageTypesTaken).toEqual([]);
  });

  it('does not duplicate a type already taken — it is a set, not a tally', () => {
    const { b, enemies } = book(enemy('a'));
    recordDamageTaken(b, enemies[0], getAbility('ember'));
    recordDamageTaken(b, enemies[0], getAbility('ember'));
    expect(logFor(b, enemies[0])!.damageTypesTaken).toEqual(['Ash']);
  });

  it('silently ignores a player target — players are never captured', () => {
    const { b } = book(enemy('a'));
    expect(() => recordDamageTaken(b, hero('h'), getAbility('ember'))).not.toThrow();
  });
});

describe('recordStrike — the stages of whoever this creature hit', () => {
  it('records the struck creature\'s stages onto the ENEMY attacker', () => {
    const { b, enemies } = book(enemy('a'));
    const struck = hero('h');
    struck.buffStages.def = 2;
    recordStrike(b, enemies[0], struck);
    expect(logFor(b, enemies[0])!.struckStatStages.def).toBe(2);
  });

  it('keeps the highest stage seen, not the most recent', () => {
    const { b, enemies } = book(enemy('a'));
    const high = hero('h'); high.buffStages.def = 3;
    const low = hero('h2'); low.buffStages.def = 1;
    recordStrike(b, enemies[0], high);
    recordStrike(b, enemies[0], low);
    expect(logFor(b, enemies[0])!.struckStatStages.def).toBe(3);
  });

  it('ignores a player attacker — this rite is about what the captive did', () => {
    const { b, enemies } = book(enemy('a'));
    const struck = enemy('victim'); struck.buffStages.def = 2;
    recordStrike(b, hero('h'), struck);
    expect(logFor(b, enemies[0])!.struckStatStages).toEqual({});
  });

  it('ignores a zero or negative stage, so an ordinary hit records nothing', () => {
    const { b, enemies } = book(enemy('a'));
    const struck = hero('h'); struck.buffStages.def = -2;
    recordStrike(b, enemies[0], struck);
    expect(logFor(b, enemies[0])!.struckStatStages.def).toBeUndefined();
  });
});

describe('recordItemUsed — self vs ally, from the captive\'s point of view', () => {
  it('marks the targeted enemy as self and its fellow enemies as ally', () => {
    const { b, enemies } = book(enemy('a'), enemy('c'), enemy('d'));
    recordItemUsed(b, enemies[0]);
    expect(logFor(b, enemies[0])!.itemConsumedOnSelf).toBe(true);
    expect(logFor(b, enemies[0])!.itemConsumedByAlly).toBe(false);
    expect(logFor(b, enemies[1])!.itemConsumedByAlly).toBe(true);
    expect(logFor(b, enemies[2])!.itemConsumedByAlly).toBe(true);
  });

  it('records nothing when the item was used on a player creature', () => {
    // Most items target allies. Only the enemy-targeted ones (grave_ash,
    // null_salt) can satisfy the Fauna and Food rites at all.
    const { b, enemies } = book(enemy('a'));
    recordItemUsed(b, hero('h'));
    expect(logFor(b, enemies[0])!.itemConsumedOnSelf).toBe(false);
    expect(logFor(b, enemies[0])!.itemConsumedByAlly).toBe(false);
  });

  it('tolerates an untargeted item', () => {
    const { b, enemies } = book(enemy('a'));
    expect(() => recordItemUsed(b, null)).not.toThrow();
    expect(logFor(b, enemies[0])!.itemConsumedOnSelf).toBe(false);
  });
});

describe('recordEffectOutcome — measured, not assumed', () => {
  it('records a debuff on every log when a stage actually dropped', () => {
    // Measured by comparing before/after rather than reading the ability's
    // declared effects: a chance-gated debuff that failed its roll must not count.
    const { b, enemies } = book(enemy('a'), enemy('c'));
    const target = hero('h');
    const before = snapshotEffects(target);
    target.buffStages.def = -1;
    recordEffectOutcome(b, target, before);
    for (const e of enemies) expect(logFor(b, e)!.debuffApplied).toBe(true);
  });

  it('does not record a debuff when the roll failed and nothing changed', () => {
    const { b, enemies } = book(enemy('a'));
    const target = hero('h');
    const before = snapshotEffects(target);
    recordEffectOutcome(b, target, before);
    expect(logFor(b, enemies[0])!.debuffApplied).toBe(false);
  });

  it('does not treat a buff as a debuff', () => {
    const { b, enemies } = book(enemy('a'));
    const target = hero('h');
    const before = snapshotEffects(target);
    target.buffStages.str = 2;
    recordEffectOutcome(b, target, before);
    expect(logFor(b, enemies[0])!.debuffApplied).toBe(false);
  });

  it('records a new status onto the enemy that received it', () => {
    const { b, enemies } = book(enemy('a'), enemy('c'));
    const before = snapshotEffects(enemies[0]);
    enemies[0].statusEffects.push({ type: 'burn', turnsRemaining: 3 });
    recordEffectOutcome(b, enemies[0], before);
    expect(logFor(b, enemies[0])!.statusesApplied).toContain('burn');
    expect(logFor(b, enemies[1])!.statusesApplied).toEqual([]);
  });
});

describe('turn tracking', () => {
  it('marks only an enemy as having acted', () => {
    const { b, enemies } = book(enemy('a'));
    recordActed(b, hero('h'));
    expect(logFor(b, enemies[0])!.hasActed).toBe(false);
    recordActed(b, enemies[0]);
    expect(logFor(b, enemies[0])!.hasActed).toBe(true);
  });

  it('counts rounds survived for the living only', () => {
    const { b, enemies } = book(enemy('a'), enemy('c'));
    enemies[1].isKnockedOut = true;
    recordRoundSurvived(b, enemies);
    recordRoundSurvived(b, enemies);
    expect(logFor(b, enemies[0])!.turnsAlive).toBe(2);
    expect(logFor(b, enemies[1])!.turnsAlive).toBe(0);
  });
});

describe('captureParty — facts about the CAPTORS', () => {
  it('reports a knocked-out player creature', () => {
    const down = hero('h'); down.isKnockedOut = true;
    expect(captureParty([hero('a'), down], new Set()).anyKnockedOut).toBe(true);
    expect(captureParty([hero('a')], new Set()).anyKnockedOut).toBe(false);
  });

  it('lists the archetypes the player fielded', () => {
    const p = captureParty([hero('a')], new Set());
    expect(p.archetypes.length).toBe(1);
  });

  it('counts only players that have actually acted', () => {
    const a = hero('a'), c = hero('c');
    expect(captureParty([a, c], new Set()).actorCount).toBe(0);
    expect(captureParty([a, c], new Set([a.instance.instanceId])).actorCount).toBe(1);
  });
});
