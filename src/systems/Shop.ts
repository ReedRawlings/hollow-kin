import { CreatureInstance, RunState } from '../types';

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
