import { describe, expect, it } from 'vitest';
import { CreatureInstance, RunState } from '../types';
import {
  SHOP_ITEMS, ShopItemId, canBenefitFromShopItem, tryPurchaseShopItem,
} from './Shop';

function creature(instanceId: string): CreatureInstance {
  return {
    instanceId,
    speciesId: 'ironjaw',
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
    capturedCreatures: [],
    partyHp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.hp])),
    partyMp: Object.fromEntries(party.map(c => [c.instanceId, c.currentStats.mp])),
    partyKO: Object.fromEntries(party.map(c => [c.instanceId, false])),
    xpEarned: 0,
    autoCombat: false,
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
