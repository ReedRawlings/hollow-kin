import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/items';
import { BOONS, REWARD_BOON_LIST } from '../data/boons';
import { OfferContext, REWARD_ITEM_POOLS, generateOffer } from './RewardOffer';

/** A deterministic roll sequence, cycling so a draw can never run dry. */
function rolls(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function ctx(over: Partial<OfferContext> = {}): OfferContext {
  return { tier: 'normal', floor: 3, anyHurt: true, anyMpMissing: true, ...over };
}

describe('generateOffer', () => {
  it('never offers run-long relationship boons as random combat boons', () => {
    for (let i = 0; i < 100; i++) {
      const cards = generateOffer({ tier: 'major', floor: 20, anyHurt: false, anyMpMissing: false }, Math.random);
      for (const card of cards) {
        if (card.kind === 'boon') expect(REWARD_BOON_LIST.some(b => b.id === card.boonId)).toBe(true);
      }
    }
  });
  it('offers three cards when every kind is viable', () => {
    expect(generateOffer(ctx(), rolls([0.1, 0.5, 0.9]))).toHaveLength(3);
  });

  it('never repeats a kind within one offer', () => {
    for (const r of [0.05, 0.3, 0.55, 0.8, 0.99]) {
      const kinds = generateOffer(ctx(), rolls([r])).map(c => c.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it('omits the heal card when nobody is hurt', () => {
    const kinds = generateOffer(ctx({ anyHurt: false }), rolls([0.1, 0.5, 0.9])).map(c => c.kind);
    expect(kinds).not.toContain('heal');
  });

  it('omits the mana card when nobody is missing MP', () => {
    const kinds = generateOffer(ctx({ anyMpMissing: false }), rolls([0.1, 0.5, 0.9])).map(c => c.kind);
    expect(kinds).not.toContain('mana');
  });

  it('never emits a card the party cannot use', () => {
    // With nobody hurt and nobody short of MP, only obols/item/boon are viable —
    // and those three are ALWAYS viable, so the offer is still exactly three.
    // The point is that neither relief kind leaks in, not that the count shrank.
    const cards = generateOffer(ctx({ anyHurt: false, anyMpMissing: false }), rolls([0.5]));
    expect(cards).toHaveLength(3);
    for (const c of cards) expect(['obols', 'item', 'boon']).toContain(c.kind);
  });

  it('offers as many cards as there are viable kinds, capped at three', () => {
    // obols/item/boon are unconditionally viable, so the floor is three and the
    // `remaining.length > 0` guard in the draw loop is defensive, never load-bearing.
    // If a future change makes a third kind conditional, this is the test that
    // catches the offer silently shrinking.
    expect(generateOffer(ctx(), rolls([0.5]))).toHaveLength(3);
    expect(generateOffer(ctx({ anyHurt: false }), rolls([0.5]))).toHaveLength(3);
    expect(generateOffer(ctx({ anyMpMissing: false }), rolls([0.5]))).toHaveLength(3);
  });

  it('emits a resolvable payload on every card', () => {
    for (const r of [0.1, 0.4, 0.7, 0.95]) {
      for (const card of generateOffer(ctx(), rolls([r]))) {
        switch (card.kind) {
          case 'heal':
          case 'mana': expect(card.fraction).toBeGreaterThan(0); break;
          case 'obols': expect(card.amount).toBeGreaterThan(0); break;
          case 'item': expect(ITEMS[card.itemId]).toBeDefined(); break;
          case 'boon': expect(BOONS[card.boonId]).toBeDefined(); break;
        }
      }
    }
  });

  it('pays more Obols deeper in the tower', () => {
    const shallow = generateOffer(ctx({ floor: 1 }), rolls([0.5]));
    const deep = generateOffer(ctx({ floor: 18 }), rolls([0.5]));
    const amount = (cards: ReturnType<typeof generateOffer>) =>
      cards.find(c => c.kind === 'obols')?.amount ?? 0;
    // Only meaningful when both offers happened to draw the obols card; the roll
    // sequence is fixed, so if one has it both do.
    if (amount(shallow) > 0) expect(amount(deep)).toBeGreaterThan(amount(shallow));
  });

  it('is deterministic for the same rolls', () => {
    const a = generateOffer(ctx(), rolls([0.2, 0.6, 0.85]));
    const b = generateOffer(ctx(), rolls([0.2, 0.6, 0.85]));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('reward item pools', () => {
  it('only names items that exist', () => {
    for (const pool of Object.values(REWARD_ITEM_POOLS)) {
      for (const id of pool) expect(ITEMS[id]).toBeDefined();
    }
  });

  it('gives every tier something to offer', () => {
    for (const pool of Object.values(REWARD_ITEM_POOLS)) {
      expect(pool.length).toBeGreaterThan(0);
    }
  });

  it('offers the rarer extraction items only at major tier', () => {
    // Waystones and Smoke Husks are the most expensive things the shops sell;
    // handing one out after an ordinary fight would undercut the departure lock.
    // Minis are excluded too — they occur twice as often as majors, so gating
    // the pair to majors alone is the safer economy call.
    expect(REWARD_ITEM_POOLS.normal).not.toContain('waystone');
    expect(REWARD_ITEM_POOLS.normal).not.toContain('smoke_husk');
    expect(REWARD_ITEM_POOLS.mini).not.toContain('waystone');
    expect(REWARD_ITEM_POOLS.mini).not.toContain('smoke_husk');
  });
});
