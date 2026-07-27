import { Backpack, CreatureInstance, RunState } from '../types';
import { add as addToBackpack, isFull } from './Backpack';

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
        && (run.partyHp[c.instanceId] ?? 0) < c.currentStats.hp
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
        const max = c.currentStats.hp;
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
      run.partyHp[ko.instanceId] = Math.floor(ko.currentStats.hp * 0.25);
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

export const MERCHANT_ITEM_OFFERS: readonly ItemOffer[] = [
  { itemId: 'power_increase', cost: 15 },
  { itemId: 'mending_draught', cost: 15 },
];

export const TOWN_ITEM_OFFERS: readonly ItemOffer[] = [
  { itemId: 'power_increase', cost: 8 },
  { itemId: 'mending_draught', cost: 8 },
];

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
