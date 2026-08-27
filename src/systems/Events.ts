import { ActiveBoon, Backpack, CreatureInstance, Encounter, RunState } from '../types';
import { EventDefinition, EventId, EVENT_LIST, getEvent } from '../data/events';
import { ITEM_LIST, getItem } from '../data/items';
import { getTemplate } from '../data/creatures';
import { REWARD_BOON_LIST, getBoon } from '../data/boons';
import { add, freeSlots } from './Backpack';
import { effectiveMaxHp, grantBoon } from './Boons';
import { makeEncounter } from './RunGenerator';

/**
 * Event rooms — the small gamble on the way down.
 *
 * Pure throughout, like Items.ts and RewardOffer.ts: RNG is injected as `roll`
 * (a float in [0, 1)), nothing mutates the run, party or bag, and nothing here
 * starts a fight or ends a run. The scene applies an `EventResolution`.
 *
 * Two-step contract, because the player must SEE the terms before accepting:
 *
 *   1. `prepareEvent` resolves everything random up front — the d12, the named
 *      boon and its victim, the three wares, the wager's encounter — into an
 *      `EventOffer`. The offer is what the scene shows.
 *   2. A resolver takes that same offer (plus any player choice) and returns the
 *      resolution. Because the randomness was spent in step 1, what was shown is
 *      what happens.
 *
 * Alpha placeholder values throughout — see the note at the top of CLAUDE.md.
 */

// ---------- tunables ----------

/** Both priced events share this: a slice of CURRENT Obols, floored, free at 0. */
export const EVENT_OBOL_COST_FRACTION = 0.1;
/** Mercy Well: fraction of max HP and max MP restored to each living kin. */
export const MERCY_WELL_FRACTION = 0.1;
/** Blood Boon: fraction of the victim's CURRENT HP taken. */
export const BLOOD_BOON_HP_FRACTION = 0.2;
/** The Dice: sides on the die. */
export const DICE_SIDES = 12;
/** Tinker's Trade: wares laid out. */
export const TINKER_WARE_COUNT = 3;
/** Warden's Wager: multiplier on the victory's Obols and XP. */
export const WAGER_REWARD_MULTIPLIER = 2;

// ---------- types ----------

export interface EventContext {
  run: RunState;
  /** `gameState.runParty` — may include knocked-out creatures. */
  party: CreatureInstance[];
  backpack: Backpack;
}

export type EventOffer =
  | { id: 'mercy_well'; def: EventDefinition; cost: number; hpFraction: number; mpFraction: number }
  | { id: 'blood_boon'; def: EventDefinition; boonId: string; victimId: string; hpFraction: number }
  | { id: 'dice_transfer'; def: EventDefinition; roll: number }
  | { id: 'tinkers_trade'; def: EventDefinition; cost: number; itemIds: string[] }
  | { id: 'warden_wager'; def: EventDefinition; encounter: Encounter };

/**
 * What the scene applies. Every field is optional except the message; an absent
 * field means "unchanged". Maps are complete copies, not deltas.
 */
export interface EventResolution {
  partyHp?: Record<string, number>;
  partyMp?: Record<string, number>;
  obols?: number;
  activeBoons?: ActiveBoon[];
  backpack?: Backpack;
  /** warden_wager only — the fight to start. */
  encounter?: Encounter;
  /** One player-facing result line. */
  message: string;
}

// ---------- helpers ----------

function isLiving(c: CreatureInstance, run: RunState): boolean {
  return !run.partyKO[c.instanceId];
}

function living(ctx: EventContext): CreatureInstance[] {
  return ctx.party.filter(c => isLiving(c, ctx.run));
}

function maxHp(c: CreatureInstance, run: RunState): number {
  return effectiveMaxHp(c.currentStats.hp, run.activeBoons);
}

function hpOf(c: CreatureInstance, run: RunState): number {
  return run.partyHp[c.instanceId] ?? 0;
}

function mpOf(c: CreatureInstance, run: RunState): number {
  return run.partyMp[c.instanceId] ?? 0;
}

function displayName(c: CreatureInstance): string {
  return c.nickname ?? getTemplate(c.speciesId).name;
}

function byId(ctx: EventContext, instanceId: string): CreatureInstance {
  const c = ctx.party.find(p => p.instanceId === instanceId);
  if (!c) throw new Error(`Events: no party member ${instanceId}`);
  return c;
}

/** Index into a list of `size` from a [0, 1) roll, clamped so 1 - ε never overruns. */
function indexFrom(roll: () => number, size: number): number {
  return Math.min(size - 1, Math.max(0, Math.floor(roll() * size)));
}

/** `count` distinct picks from `pool` (or as many as it holds), one roll each. */
function pickDistinct<T>(pool: readonly T[], count: number, roll: () => number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    picked.push(remaining.splice(indexFrom(roll, remaining.length), 1)[0]);
  }
  return picked;
}

// ---------- viability ----------

/** The shared 10% rule: floored, so it is free until there is enough to slice. */
export function obolCost(obols: number): number {
  return Math.max(0, Math.floor(obols * EVENT_OBOL_COST_FRACTION));
}

function isViable(id: EventId, ctx: EventContext): boolean {
  const { run } = ctx;
  const alive = living(ctx);
  switch (id) {
    case 'mercy_well':
      return run.obols > 0 && alive.some(c => hpOf(c, run) < maxHp(c, run) || mpOf(c, run) < c.currentStats.mp);
    case 'blood_boon':
      return alive.length >= 1;
    case 'dice_transfer':
      return alive.length >= 2;
    case 'tinkers_trade':
      return run.obols > 0 && freeSlots(ctx.backpack) > 0;
    case 'warden_wager':
      return true;
  }
}

/** Events whose terms could fire right now, in catalogue order. */
export function viableEvents(ctx: EventContext): EventDefinition[] {
  return EVENT_LIST.filter(def => isViable(def.id, ctx));
}

/** Uniform draw from the viable set; null only if nothing is viable, which the wager prevents. */
export function pickEvent(ctx: EventContext, roll: () => number): EventDefinition | null {
  const viable = viableEvents(ctx);
  if (viable.length === 0) return null;
  return viable[indexFrom(roll, viable.length)];
}

// ---------- the dice's pickers (the scene greys out the rest) ----------

/** Living kin with HP to spare — a donor always keeps at least 1. */
export function diceDonors(ctx: EventContext): CreatureInstance[] {
  return living(ctx).filter(c => hpOf(c, ctx.run) > 1);
}

/** Living kin other than the donor with room to take HP. */
export function diceRecipients(ctx: EventContext, donorId: string): CreatureInstance[] {
  return living(ctx).filter(c => c.instanceId !== donorId && hpOf(c, ctx.run) < maxHp(c, ctx.run));
}

// ---------- prepare ----------

/**
 * Spend every roll the event needs and hand back what the player will see.
 * Callers should check viability first; preparing a non-viable event still
 * returns an offer, but its resolver may have nothing to do.
 */
export function prepareEvent(id: EventId, ctx: EventContext, roll: () => number): EventOffer {
  const def = getEvent(id);
  const { run } = ctx;
  switch (id) {
    case 'mercy_well':
      return { id, def, cost: obolCost(run.obols), hpFraction: MERCY_WELL_FRACTION, mpFraction: MERCY_WELL_FRACTION };
    case 'blood_boon': {
      const boonId = REWARD_BOON_LIST[indexFrom(roll, REWARD_BOON_LIST.length)].id;
      const alive = living(ctx);
      const victimId = alive.length ? alive[indexFrom(roll, alive.length)].instanceId : '';
      return { id, def, boonId, victimId, hpFraction: BLOOD_BOON_HP_FRACTION };
    }
    case 'dice_transfer':
      return { id, def, roll: 1 + indexFrom(roll, DICE_SIDES) };
    case 'tinkers_trade':
      return { id, def, cost: obolCost(run.obols), itemIds: pickDistinct(ITEM_LIST, TINKER_WARE_COUNT, roll).map(i => i.id) };
    case 'warden_wager': {
      const here = run.encounters[run.currentEncounterIndex];
      const floor = here?.floor ?? run.startFloor;
      const index = here?.index ?? run.currentEncounterIndex;
      const encounter: Encounter = { ...makeEncounter('combat', floor, index), rewardMultiplier: WAGER_REWARD_MULTIPLIER };
      return { id, def, encounter };
    }
  }
}

// ---------- resolvers ----------

export function resolveMercyWell(
  offer: Extract<EventOffer, { id: 'mercy_well' }>,
  ctx: EventContext,
): EventResolution {
  const { run } = ctx;
  const partyHp = { ...run.partyHp };
  const partyMp = { ...run.partyMp };
  for (const c of living(ctx)) {
    const hpMax = maxHp(c, run);
    const mpMax = c.currentStats.mp;
    partyHp[c.instanceId] = Math.min(hpMax, hpOf(c, run) + Math.floor(hpMax * offer.hpFraction));
    partyMp[c.instanceId] = Math.min(mpMax, mpOf(c, run) + Math.floor(mpMax * offer.mpFraction));
  }
  const obols = run.obols - offer.cost;
  const paid = offer.cost > 0 ? ` for ${offer.cost} Obols` : '';
  return { partyHp, partyMp, obols, message: `The well mends your kin${paid}.` };
}

export function resolveBloodBoon(
  offer: Extract<EventOffer, { id: 'blood_boon' }>,
  ctx: EventContext,
): EventResolution {
  const { run } = ctx;
  const partyHp = { ...run.partyHp };
  const activeBoons = grantBoon(run.activeBoons, offer.boonId);
  const victim = ctx.party.find(c => c.instanceId === offer.victimId);
  let message = `${getBoon(offer.boonId).name} is yours.`;
  if (victim && isLiving(victim, run)) {
    const current = hpOf(victim, run);
    // Never below 1: the cost is a wound, not a death.
    const loss = Math.min(Math.floor(current * offer.hpFraction), Math.max(0, current - 1));
    partyHp[victim.instanceId] = current - loss;
    message = `${displayName(victim)} gives ${loss} HP, and ${getBoon(offer.boonId).name} is yours.`;
  }
  return { partyHp, activeBoons, message };
}

export function resolveDiceTransfer(
  offer: Extract<EventOffer, { id: 'dice_transfer' }>,
  ctx: EventContext,
  donorId: string,
  recipientId: string,
): EventResolution {
  const { run } = ctx;
  const donor = byId(ctx, donorId);
  const recipient = byId(ctx, recipientId);
  if (donorId === recipientId) throw new Error('Events: donor and recipient must differ');
  const partyHp = { ...run.partyHp };
  const donorHp = hpOf(donor, run);
  const recipientHp = hpOf(recipient, run);
  const room = maxHp(recipient, run) - recipientHp;
  const moved = Math.max(0, Math.min(offer.roll, donorHp - 1, room));
  partyHp[donorId] = donorHp - moved;
  partyHp[recipientId] = recipientHp + moved;
  return {
    partyHp,
    message: `The die shows ${offer.roll}. ${displayName(donor)} gives ${moved} HP to ${displayName(recipient)}.`,
  };
}

export function resolveTinkersTrade(
  offer: Extract<EventOffer, { id: 'tinkers_trade' }>,
  ctx: EventContext,
  itemId: string,
): EventResolution {
  if (!offer.itemIds.includes(itemId)) throw new Error(`Events: ${itemId} was not on offer`);
  const added = add(ctx.backpack, { kind: 'item', itemId });
  if (!added) throw new Error('Events: no room in the bag');
  const obols = ctx.run.obols - offer.cost;
  const paid = offer.cost > 0 ? ` for ${offer.cost} Obols` : '';
  return { backpack: added.bag, obols, message: `You take the ${getItem(itemId).name}${paid}.` };
}

export function resolveWardenWager(
  offer: Extract<EventOffer, { id: 'warden_wager' }>,
  _ctx: EventContext,
): EventResolution {
  return { encounter: offer.encounter, message: 'The wager is on.' };
}
