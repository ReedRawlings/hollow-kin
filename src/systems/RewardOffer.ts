import { BOON_LIST } from '../data/boons';
import { obolsForEncounter } from './Economy';

/**
 * What a victory offers the player: three cards of DISTINCT kinds, drawn from a
 * weighted pool that leans toward relief after ordinary fights and toward boons
 * and rarer items after bosses.
 *
 * Pure — RNG is injected as `roll`, matching `Backpack.applyWipeLoss`, so a test
 * can pin an offer exactly and the scene keeps ownership of its RNG stream.
 *
 * Kinds that cannot do anything are filtered out BEFORE the draw, so a full-HP
 * party is never offered a heal. If that leaves fewer than three viable kinds the
 * offer is simply shorter — padding it with a dead card is the worst version of
 * this screen. This generalises the "EVERYONE IS FULL" handling the two-boon
 * screen already had.
 *
 * Alpha placeholder values throughout.
 */

export type RewardTier = 'normal' | 'mini' | 'major';

export type RewardKind = 'heal' | 'mana' | 'obols' | 'item' | 'boon';

export type RewardCard =
  | { kind: 'heal'; fraction: number }
  | { kind: 'mana'; fraction: number }
  | { kind: 'obols'; amount: number }
  | { kind: 'item'; itemId: string }
  | { kind: 'boon'; boonId: string };

export interface OfferContext {
  tier: RewardTier;
  floor: number;
  /** Is any living creature below full HP? */
  anyHurt: boolean;
  /** Is any living creature below full MP? */
  anyMpMissing: boolean;
}

/**
 * Which items each tier may hand out. Explicit rather than derived from price so
 * it can be tuned without moving shop costs. Extraction items are boss-only: a
 * Waystone after an ordinary fight would quietly undo the departure lock that
 * slice 1 exists to create.
 */
export const REWARD_ITEM_POOLS: Record<RewardTier, string[]> = {
  normal: ['mending_draught', 'moonwater', 'power_increase', 'clearroot'],
  mini: ['mending_draught', 'moonwater', 'clearroot', 'grave_ash', 'null_salt', 'hollow_candle'],
  major: ['grave_ash', 'null_salt', 'hollow_candle', 'smoke_husk', 'waystone'],
};

/** Relative draw weight per kind, per tier. */
const WEIGHTS: Record<RewardTier, Record<RewardKind, number>> = {
  normal: { heal: 3, mana: 3, obols: 3, item: 2, boon: 1 },
  mini: { heal: 2, mana: 2, obols: 2, item: 3, boon: 3 },
  major: { heal: 2, mana: 2, obols: 2, item: 3, boon: 4 },
};

/** Recovery strength per tier, as a fraction of maximum. */
const RELIEF: Record<RewardTier, { hp: number; mp: number }> = {
  normal: { hp: 0.10, mp: 0.20 },
  mini: { hp: 0.20, mp: 0.30 },
  major: { hp: 0.30, mp: 0.40 },
};

/** Bonus Obols as a fraction of what the encounter itself paid. */
const OBOL_CARD_FRACTION = 0.5;

/** Weighted pick from `pool`, or null when it is empty. Consumes one roll. */
function pick<T>(pool: { value: T; weight: number }[], roll: () => number): T | null {
  const total = pool.reduce((n, p) => n + p.weight, 0);
  if (total <= 0) return null;
  let target = roll() * total;
  for (const p of pool) {
    target -= p.weight;
    if (target < 0) return p.value;
  }
  return pool[pool.length - 1].value;
}

function payload(kind: RewardKind, ctx: OfferContext, roll: () => number): RewardCard {
  switch (kind) {
    case 'heal':
      return { kind: 'heal', fraction: RELIEF[ctx.tier].hp };
    case 'mana':
      return { kind: 'mana', fraction: RELIEF[ctx.tier].mp };
    case 'obols': {
      const base = obolsForEncounter(ctx.tier, ctx.floor);
      return { kind: 'obols', amount: Math.max(1, Math.round(base * OBOL_CARD_FRACTION)) };
    }
    case 'item': {
      const pool = REWARD_ITEM_POOLS[ctx.tier];
      const itemId = pick(pool.map(value => ({ value, weight: 1 })), roll) ?? pool[0];
      return { kind: 'item', itemId };
    }
    case 'boon': {
      const boonId = pick(BOON_LIST.map(b => ({ value: b.id, weight: 1 })), roll) ?? BOON_LIST[0].id;
      return { kind: 'boon', boonId };
    }
  }
}

/**
 * Three cards of distinct kinds, or fewer when fewer kinds are viable.
 *
 * `roll` returns a float in [0, 1). Each drawn kind consumes one roll, and each
 * payload that needs a choice consumes one more.
 */
export function generateOffer(ctx: OfferContext, roll: () => number): RewardCard[] {
  const viable: RewardKind[] = ['obols', 'item', 'boon'];
  if (ctx.anyHurt) viable.unshift('heal');
  if (ctx.anyMpMissing) viable.unshift('mana');

  const remaining = viable.map(kind => ({ value: kind, weight: WEIGHTS[ctx.tier][kind] }));
  const cards: RewardCard[] = [];

  while (cards.length < 3 && remaining.length > 0) {
    const kind = pick(remaining, roll);
    if (kind === null) break;
    remaining.splice(remaining.findIndex(r => r.value === kind), 1);
    cards.push(payload(kind, ctx, roll));
  }
  return cards;
}
