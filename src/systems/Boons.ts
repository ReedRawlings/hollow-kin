import { ActiveBoon } from '../types';
import { BoonEffect, getBoon } from '../data/boons';

/**
 * The timed-modifier layer. Pure, Phaser-free, and the only place that knows what
 * a boon does.
 *
 * Every query returns a NEUTRAL value when nothing applies — 1 for a multiplier,
 * 0 for a fraction — so callers multiply unconditionally and never branch on
 * "is a boon active". That is what keeps the combat hook sites to one line each.
 */

/** Effects currently in force, resolved from ids. */
function effects(active: ActiveBoon[]): BoonEffect[] {
  return active.map(a => getBoon(a.boonId).effect);
}

/**
 * Add a boon, or replace an existing one of the SAME EFFECT KIND.
 *
 * Keyed on `effect.kind` rather than boon id on purpose: two differently-named
 * boons with the same effect must not stack into a combined multiplier. Re-taking
 * one refreshes its duration and leaves its magnitude alone.
 *
 * Returns a new array; never mutates the input.
 */
export function grantBoon(active: ActiveBoon[], boonId: string): ActiveBoon[] {
  const def = getBoon(boonId);
  const kept = active.filter(a => getBoon(a.boonId).effect.kind !== def.effect.kind);
  return [...kept, { boonId: def.id, battlesLeft: def.battles }];
}

/**
 * Count every timed boon down one battle and drop the spent ones.
 *
 * A `battlesLeft` of `null` means "lasts the run" and is left untouched — the
 * shape Relics will use.
 */
export function tickAfterBattle(active: ActiveBoon[]): ActiveBoon[] {
  const out: ActiveBoon[] = [];
  for (const a of active) {
    if (a.battlesLeft === null) { out.push(a); continue; }
    const left = a.battlesLeft - 1;
    if (left > 0) out.push({ ...a, battlesLeft: left });
  }
  return out;
}

/** Multiplier on damage dealt by the player's kin. Never applies to item damage. */
export function damageDealtMultiplier(active: ActiveBoon[]): number {
  let m = 1;
  for (const e of effects(active)) if (e.kind === 'damage_dealt') m *= e.multiplier;
  return m;
}

/** Multiplier on damage the player's kin receive, in the given 1-based round. */
export function damageTakenMultiplier(active: ActiveBoon[], round: number): number {
  let m = 1;
  for (const e of effects(active)) {
    if (e.kind !== 'damage_taken') continue;
    if (e.firstRoundOnly && round !== 1) continue;
    m *= e.multiplier;
  }
  return m;
}

/** Multiplier on Obols awarded for a victory. */
export function obolMultiplier(active: ActiveBoon[]): number {
  let m = 1;
  for (const e of effects(active)) if (e.kind === 'obol_bonus') m *= e.multiplier;
  return m;
}

/** Fraction of max HP restored to each living kin after a victory. 0 when none. */
export function postVictoryHealFraction(active: ActiveBoon[]): number {
  let f = 0;
  for (const e of effects(active)) if (e.kind === 'post_victory_heal') f += e.fraction;
  return f;
}

/** What to show the player on the run map. */
export function activeBoonSummaries(
  active: ActiveBoon[],
): { name: string; battlesLeft: number | null }[] {
  return active.map(a => ({ name: getBoon(a.boonId).name, battlesLeft: a.battlesLeft }));
}
