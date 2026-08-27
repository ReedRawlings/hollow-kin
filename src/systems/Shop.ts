import { Backpack, CreatureInstance, Encounter, RunState } from '../types';
import { add as addToBackpack, isFull } from './Backpack';
import { runMaxHp } from './Recovery';

export type ShopItemId = 'heal_party' | 'restore_mp' | 'revive_creature';

export interface ShopItem {
  id: ShopItemId;
  name: string;
  cost: number;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'heal_party', name: 'Heal Party (50% HP)', cost: 20 },
  { id: 'restore_mp', name: 'Restore MP (Full)', cost: 25 },
  { id: 'revive_creature', name: 'Revive Creature', cost: 40 },
];

export function canBenefitFromShopItem(
  itemId: ShopItemId,
  run: RunState,
  party: CreatureInstance[],
): boolean {
  switch (itemId) {
    case 'heal_party':
      return party.some(c =>
        !run.partyKO[c.instanceId]
        && (run.partyHp[c.instanceId] ?? 0) < runMaxHp(c, run)
      );
    case 'restore_mp':
      return party.some(c =>
        !run.partyKO[c.instanceId]
        && (run.partyMp[c.instanceId] ?? 0) < c.currentStats.mp
      );
    case 'revive_creature':
      return party.some(c => run.partyKO[c.instanceId]);
  }
}

/**
 * Atomically buy and apply a shop item.
 *
 * Payment happens only after both preconditions are true: the run can afford
 * the item and applying it will change party state.
 */
export function tryPurchaseShopItem(
  item: ShopItem,
  run: RunState,
  party: CreatureInstance[],
): boolean {
  if (run.obols < item.cost || !canBenefitFromShopItem(item.id, run, party)) {
    return false;
  }

  switch (item.id) {
    case 'heal_party':
      for (const c of party) {
        if (run.partyKO[c.instanceId]) continue;
        const max = runMaxHp(c, run);
        const current = run.partyHp[c.instanceId] ?? 0;
        run.partyHp[c.instanceId] = Math.min(max, current + Math.floor(max * 0.5));
      }
      break;
    case 'restore_mp':
      for (const c of party) {
        if (run.partyKO[c.instanceId]) continue;
        run.partyMp[c.instanceId] = c.currentStats.mp;
      }
      break;
    case 'revive_creature': {
      const ko = party.find(c => run.partyKO[c.instanceId]);
      if (!ko) return false;
      run.partyKO[ko.instanceId] = false;
      run.partyHp[ko.instanceId] = Math.floor(runMaxHp(ko, run) * 0.25);
      run.partyMp[ko.instanceId] = Math.floor(ko.currentStats.mp * 0.25);
      break;
    }
  }

  run.obols -= item.cost;
  return true;
}

// --- Carryable items: bought into the backpack, used later in battle. ---
//
// Two catalogs, same offer shape, different ledger: the tower merchant charges
// Obols (the in-run currency), the town shop charges Essence (the permanent one) —
// see ShopScene and TownShopScene respectively. `tryBuyItem` below is deliberately
// currency-agnostic so both scenes share one purchase path.

export interface ItemOffer {
  itemId: string;
  cost: number;
}

/**
 * Alpha placeholder prices. Two relationships are real design and are pinned by
 * tests: the tower always charges more than town (preparation should beat
 * improvisation), and the two ways out are the most expensive things sold
 * (they buy safety, which is the scarcest thing in the tower).
 */
export const MERCHANT_ITEM_OFFERS: readonly ItemOffer[] = [
  { itemId: 'mending_draught', cost: 15 },
  { itemId: 'moonwater', cost: 15 },
  { itemId: 'clearroot', cost: 20 },
  { itemId: 'power_increase', cost: 22 },
  { itemId: 'grave_ash', cost: 25 },
  { itemId: 'null_salt', cost: 30 },
  { itemId: 'hollow_candle', cost: 45 },
  { itemId: 'smoke_husk', cost: 60 },
  { itemId: 'waystone', cost: 80 },
];

export const TOWN_ITEM_OFFERS: readonly ItemOffer[] = [
  { itemId: 'mending_draught', cost: 8 },
  { itemId: 'moonwater', cost: 8 },
  { itemId: 'clearroot', cost: 10 },
  { itemId: 'power_increase', cost: 11 },
  { itemId: 'grave_ash', cost: 12 },
  { itemId: 'null_salt', cost: 15 },
  { itemId: 'hollow_candle', cost: 22 },
  { itemId: 'smoke_husk', cost: 30 },
  { itemId: 'waystone', cost: 40 },
];

/**
 * What this particular tower merchant has in stock.
 *
 * A subset rather than the whole catalog, for two reasons: nine offers overflow
 * the shop scene's fixed layout, and a market worth finding should not be the
 * same market every time. Town always stocks everything, so a player who
 * prepares is never at the mercy of this draw.
 *
 * The draw is a pure function of the encounter's `floor` and `index` rather than
 * `Math.random()`. `Encounter` carries no seed field and adding one would touch
 * the save-free run state for no gain; deriving from two values the encounter
 * already has means the scene can redraw as often as it likes without the stock
 * shuffling under the player's cursor.
 */
export function merchantStockFor(encounter: Encounter, count = 3): ItemOffer[] {
  const pool = [...MERCHANT_ITEM_OFFERS];
  const wanted = Math.min(count, pool.length);
  const picked: ItemOffer[] = [];

  // A small deterministic mixer — enough to decorrelate neighbouring shops
  // without pulling in a seeded-RNG dependency for nine items.
  //
  // Math.imul keeps the multiply inside 32 bits. A plain `seed * 1103515245`
  // pushes the product past 2^53 (JS doubles' safe-integer ceiling) once seed
  // itself reaches 2^31, silently destroying the low bits the `>>> 0` mask
  // depends on — which flattened almost every draw to the same handful of
  // stock lists.
  let seed = ((encounter.floor * 73856093) ^ (encounter.index * 19349663)) >>> 0;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed;
  };

  while (picked.length < wanted) {
    picked.push(...pool.splice(next() % pool.length, 1));
  }
  return picked;
}

/**
 * Buy `offer` into `backpack`, paid from a wallet holding `available` currency.
 *
 * Pure and side-effect-free: on success it returns the new backpack and `bought:
 * true`; the caller is the one who actually owns the wallet (RunState.obols or
 * GameStateManager.essence), so it deducts `offer.cost` itself only when `bought`
 * is true. Fails gracefully — insufficient funds or a full bag — without taking
 * payment either way, per the "don't take the Obols if the bag can't hold it" rule.
 */
export function tryBuyItem(
  offer: ItemOffer,
  available: number,
  backpack: Backpack,
): { backpack: Backpack; bought: boolean } {
  if (available < offer.cost || isFull(backpack)) {
    return { backpack, bought: false };
  }
  const result = addToBackpack(backpack, { kind: 'item', itemId: offer.itemId });
  if (!result) return { backpack, bought: false }; // guards a race with the isFull check above
  return { backpack: result.bag, bought: true };
}
