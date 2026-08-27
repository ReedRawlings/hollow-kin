import { describe, expect, it } from 'vitest';
import { CreatureInstance, Encounter, RunState } from '../types';
import {
  SHOP_ITEMS, ShopItemId, canBenefitFromShopItem, tryPurchaseShopItem,
  MERCHANT_ITEM_OFFERS, TOWN_ITEM_OFFERS, tryBuyItem, merchantStockFor,
} from './Shop';
import { createBackpack, isFull, usedSlots } from './Backpack';
import { ITEMS } from '../data/items';

function creature(instanceId: string): CreatureInstance {
  return {
    instanceId,
    speciesId: 'kin_070',
    nickname: null,
    starRating: 0,
    currentLevel: 1,
    levelCap: 5,
    permanentLevel: 1,
    essenceInvested: 0,
    abilities: [],
    traitSlots: [],
    lineage: { parentA: null, parentB: null },
    statBaseline: { hp: 100, mp: 20, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    currentStats: { hp: 100, mp: 20, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    resistances: [],
    weaknesses: [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
    tactic: 'fight_wisely',
  };
}

function runFor(party: CreatureInstance[], obols = 100): RunState {
  return {
    startFloor: 1,
    currentEncounterIndex: 0,
    encounters: [],
    choices: [],
    obols,
    partyHp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.hp])),
    partyMp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.mp])),
    partyKO: Object.fromEntries(party.map(c => [c.instanceId, false])),
    autoCombat: false,
    activeBoons: [],
  };
}

function item(id: ShopItemId) {
  return SHOP_ITEMS.find(candidate => candidate.id === id)!;
}

describe('shop item eligibility', () => {
  it('disables HP and MP restoration when every living creature is full', () => {
    const party = [creature('a'), creature('b')];
    const run = runFor(party);

    expect(canBenefitFromShopItem('heal_party', run, party)).toBe(false);
    expect(canBenefitFromShopItem('restore_mp', run, party)).toBe(false);
  });

  it('enables restoration when any living creature has a deficit', () => {
    const party = [creature('a'), creature('b')];
    const run = runFor(party);
    run.partyHp.b = 99;
    run.partyMp.b = 19;

    expect(canBenefitFromShopItem('heal_party', run, party)).toBe(true);
    expect(canBenefitFromShopItem('restore_mp', run, party)).toBe(true);
  });

  it('enables revive only when a creature is knocked out', () => {
    const party = [creature('a')];
    const run = runFor(party);
    expect(canBenefitFromShopItem('revive_creature', run, party)).toBe(false);

    run.partyKO.a = true;
    expect(canBenefitFromShopItem('revive_creature', run, party)).toBe(true);
  });
});

describe('tryPurchaseShopItem', () => {
  it('does not charge when the item would have no effect', () => {
    const party = [creature('a')];
    const run = runFor(party);

    expect(tryPurchaseShopItem(item('revive_creature'), run, party)).toBe(false);
    expect(run.obols).toBe(100);
  });

  it('does not apply or charge for an unaffordable item', () => {
    const party = [creature('a')];
    const run = runFor(party, 19);
    run.partyHp.a = 10;

    expect(tryPurchaseShopItem(item('heal_party'), run, party)).toBe(false);
    expect(run.partyHp.a).toBe(10);
    expect(run.obols).toBe(19);
  });

  it('charges once and heals living party members when useful', () => {
    const party = [creature('a'), creature('b')];
    const run = runFor(party);
    run.partyHp.a = 10;
    run.partyHp.b = 90;

    expect(tryPurchaseShopItem(item('heal_party'), run, party)).toBe(true);
    expect(run.partyHp).toEqual({ a: 60, b: 100 });
    expect(run.obols).toBe(80);
  });

  it('charges once and revives the first knocked-out creature', () => {
    const party = [creature('a'), creature('b')];
    const run = runFor(party);
    run.partyKO.b = true;
    run.partyHp.b = 0;
    run.partyMp.b = 0;

    expect(tryPurchaseShopItem(item('revive_creature'), run, party)).toBe(true);
    expect(run.partyKO.b).toBe(false);
    expect(run.partyHp.b).toBe(25);
    expect(run.partyMp.b).toBe(5);
    expect(run.obols).toBe(60);
  });
});

describe('tryBuyItem', () => {
  it('puts the item in the bag and reports bought when funds and room are both there', () => {
    const offer = MERCHANT_ITEM_OFFERS[0];
    const bag = createBackpack();

    const result = tryBuyItem(offer, offer.cost, bag);

    expect(result.bought).toBe(true);
    expect(usedSlots(result.backpack)).toBe(usedSlots(bag) + 1);
  });

  it('refuses and leaves the bag untouched when funds are short — never takes a partial payment', () => {
    const offer = MERCHANT_ITEM_OFFERS[0];
    const bag = createBackpack();

    const result = tryBuyItem(offer, offer.cost - 1, bag);

    expect(result.bought).toBe(false);
    expect(result.backpack).toBe(bag);
    expect(usedSlots(result.backpack)).toBe(usedSlots(bag));
  });

  it('refuses on a full bag even with ample funds — never takes payment for nothing', () => {
    const offer = MERCHANT_ITEM_OFFERS[0];
    const bag = createBackpack(0, 0); // zero capacity: always full

    const result = tryBuyItem(offer, offer.cost * 100, bag);

    expect(result.bought).toBe(false);
    expect(isFull(result.backpack)).toBe(true);
  });

  it('offers the same item catalog shape at both the tower merchant and the town shop', () => {
    const merchantIds = new Set(MERCHANT_ITEM_OFFERS.map(o => o.itemId));
    const townIds = new Set(TOWN_ITEM_OFFERS.map(o => o.itemId));
    expect(townIds).toEqual(merchantIds);
  });
});

describe('item catalogs', () => {
  it('sells only items that exist', () => {
    for (const offer of [...MERCHANT_ITEM_OFFERS, ...TOWN_ITEM_OFFERS]) {
      expect(ITEMS[offer.itemId]).toBeDefined();
    }
  });

  it('stocks the whole pool in town, so a waystone is always buyable', () => {
    const townIds = new Set(TOWN_ITEM_OFFERS.map(o => o.itemId));
    for (const id of Object.keys(ITEMS)) expect(townIds.has(id)).toBe(true);
  });

  it('charges more in the tower than in town for the same item', () => {
    // Preparation should beat improvisation; the exact gap is a tuning matter.
    for (const tower of MERCHANT_ITEM_OFFERS) {
      const town = TOWN_ITEM_OFFERS.find(o => o.itemId === tower.itemId)!;
      expect(tower.cost).toBeGreaterThan(town.cost);
    }
  });

  it('prices the two ways out above every other item', () => {
    const price = (id: string) => TOWN_ITEM_OFFERS.find(o => o.itemId === id)!.cost;
    const others = TOWN_ITEM_OFFERS
      .filter(o => o.itemId !== 'waystone' && o.itemId !== 'smoke_husk')
      .map(o => o.cost);
    expect(price('waystone')).toBeGreaterThan(Math.max(...others));
    expect(price('smoke_husk')).toBeGreaterThan(Math.max(...others));
  });
});

describe('merchantStockFor', () => {
  const shop = (floor: number, index: number): Encounter => ({ type: 'shop', floor, index });

  it('offers the requested number of items', () => {
    expect(merchantStockFor(shop(3, 2), 3)).toHaveLength(3);
  });

  it('never repeats an item within one shop', () => {
    const ids = merchantStockFor(shop(3, 2), 3).map(o => o.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only stocks things the merchant catalog actually sells', () => {
    const sold = new Set(MERCHANT_ITEM_OFFERS.map(o => o.itemId));
    for (const offer of merchantStockFor(shop(7, 5), 3)) {
      expect(sold.has(offer.itemId)).toBe(true);
    }
  });

  it('is stable for the same shop, so redrawing the scene never reshuffles it', () => {
    const a = merchantStockFor(shop(7, 5), 3).map(o => o.itemId);
    const b = merchantStockFor(shop(7, 5), 3).map(o => o.itemId);
    expect(a).toEqual(b);
  });

  it('differs between shops, so two markets are not the same market', () => {
    const seen = new Set(
      [0, 1, 2, 3, 4, 5, 6, 7].map(i => merchantStockFor(shop(i + 1, i), 3).map(o => o.itemId).join()),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('cannot ask for more than the catalog holds', () => {
    expect(merchantStockFor(shop(1, 0), 99)).toHaveLength(MERCHANT_ITEM_OFFERS.length);
  });

  it('spreads the catalog across shops instead of one item dominating every draw', () => {
    // A shape assertion, not a values one: no single item should crowd out the
    // rest across a descent's worth of real (floor, index) pairs. `generateDescent`
    // assigns index = floor - startFloor and startFloor is always 1, 6, 11 or 16
    // (a run start or a depth-jump start) — so this mirrors what the mixer is
    // actually fed in play, not an arbitrary grid.
    //
    // `seen.size > 1` (the pre-existing 'differs between shops' test below) passes
    // even with the broken 32-bit-overflowing mixer, because SOME shops still
    // differ — it just never catches that one item (Mending Draught) was in
    // nearly every one of them. Measured directly: the broken mixer put it in
    // 50/50 shops in this exact sample; a correct mixer keeps every item under
    // half.
    const startFloors = [1, 6, 11, 16];
    const pairs: Array<[number, number]> = [];
    for (const startFloor of startFloors) {
      for (let floor = startFloor; floor <= 20; floor++) pairs.push([floor, floor - startFloor]);
    }
    const counts = new Map<string, number>();
    for (const [floor, index] of pairs) {
      for (const offer of merchantStockFor(shop(floor, index), 3)) {
        counts.set(offer.itemId, (counts.get(offer.itemId) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(MERCHANT_ITEM_OFFERS.length); // every item shows up somewhere
    for (const [, n] of counts) {
      expect(n / pairs.length).toBeLessThan(0.6);
    }
  });
});
