# Post-Battle Offers & Timed Boons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed two-boon victory screen with a three-card reward offer drawn from a pool, and add timed run-scoped boons that take effect the moment they are chosen.

**Architecture:** Two new pure systems modules — `Boons.ts` (a timed-modifier layer queried through neutral-valued functions) and `RewardOffer.ts` (weighted draw of three distinct card kinds). `PostCombatScene` renders the offer and resolves the chosen card. Boons hook combat at exactly two sites: where damage is applied, and the victory branch of `showBattleEnd`.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest.

**Design provenance:** agreed in conversation on 2026-07-29; no separate spec document. The rationale that matters is recorded inline in the task notes below. This is slice 2 of `expedition-items-pitch.md`, following the merged slice 1 (`docs/superpowers/specs/2026-07-29-expedition-commitment-and-consumables-design.md`).

## Global Constraints

- **Saves are disposable in pre-alpha.** `SAVE_VERSION` may be bumped freely if a design wants a persisted field; never contort a design to avoid one, and never write a migration — `loadFromLocalStorage` discarding a non-matching version is the intended behaviour. *(As it happens this slice needs no bump: boons live on `RunState`, and `currentRun` is not persisted.)*
- **Every gameplay number here is an alpha placeholder.** Tests assert shape and relationships, never a magic value. `expect(x).toBe(75)` is a plan violation; `expect(a).toBeLessThan(b)` is correct.
- **Boon queries return neutral values** (`1` for multipliers, `0` for fractions) when nothing applies, so no caller ever branches on "is a boon active".
- **"One of each kind" keys on `effect.kind`, not boon id.** Two differently-named boons with the same effect must not stack — that multiplication is the failure the pitch explicitly warns against.
- Pure systems modules take RNG as an injected `roll: () => number`, matching `Backpack.applyWipeLoss`. No `Math.random()` inside them.
- **`button()` in `src/ui/Theme.ts` attaches its click handler only inside `if (enabled && onClick)`.** Passing a handler together with `enabled: false` produces a DEAD button. This bug has already been shipped and fixed once on this codebase. Pass `null` for `onClick` when disabled (the established idiom), or attach the handler yourself outside the helper.
- Run `npx tsc --noEmit` before every commit; it must be clean. Test command is `npm test` (409 tests at branch point). Single file: `npx vitest run src/systems/Foo.test.ts`.
- Test fixtures live in `src/systems/testFixtures.ts` — `makeTestCreature(opts)`, `testStats(over)`. It is deliberately not named `*.test.ts`; import from it, never from a `.test.ts` file.
- Commit only the task's own files by explicit path. **Never `git add -A` or `git add .`** — this repo has deliberately-untracked scratch (`_to_delete/`, `output/`, `test-actions/`).
- Phaser scenes have no test harness in this repo. That is the established convention, not an oversight — do not add one. Scene tasks are verified by reading, `tsc`, and the suite.
- **Do not use browser automation or start a dev server.** Several agents have died mid-session doing so. A consolidated browser pass runs at the end, driven by the controller.

---

### Task 1: The boon layer

**Files:**
- Create: `src/data/boons.ts`
- Create: `src/systems/Boons.ts`
- Create: `src/systems/Boons.test.ts`
- Modify: `src/types.ts` (add `ActiveBoon`, add `activeBoons` to `RunState`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `BoonDefinition`, `BoonEffect`, `BOONS`, `BOON_LIST`, `getBoon(id)` from `src/data/boons.ts`; `ActiveBoon` from `src/types.ts`; and from `src/systems/Boons.ts` — `grantBoon(active, boonId): ActiveBoon[]`, `tickAfterBattle(active): ActiveBoon[]`, `damageDealtMultiplier(active): number`, `damageTakenMultiplier(active, round): number`, `obolMultiplier(active): number`, `postVictoryHealFraction(active): number`, `activeBoonSummaries(active): { name: string; battlesLeft: number | null }[]`. Tasks 2, 3, 4 and 6 all consume these.

- [ ] **Step 1: Add the types**

In `src/types.ts`, add next to the other run types:

```ts
/**
 * A timed modifier active for the current run, chosen at the post-battle offer.
 *
 * `battlesLeft: null` means "lasts the whole run". Nothing produces that today —
 * it exists because a Relic is the same shape with no expiry, so Relics can reuse
 * this layer instead of duplicating it.
 */
export interface ActiveBoon {
  boonId: string;
  battlesLeft: number | null;
}
```

and add to `RunState`, after `autoCombat`:

```ts
  activeBoons: ActiveBoon[];  // timed modifiers; expire with the run
```

`RunState` is not persisted (`saveToLocalStorage` omits `currentRun`), so this needs no `SAVE_VERSION` change.

**This will break every construction site of `RunState`.** Find them with `grep -rn "autoCombat:" src/` and add `activeBoons: []` to each — there are sites in `src/scenes/RunScene.ts` and in several test files. `tsc` will name any you miss.

- [ ] **Step 2: Write the failing test**

Create `src/systems/Boons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ActiveBoon } from '../types';
import { BOON_LIST, BOONS, getBoon } from '../data/boons';
import {
  activeBoonSummaries, damageDealtMultiplier, damageTakenMultiplier,
  grantBoon, obolMultiplier, postVictoryHealFraction, tickAfterBattle,
} from './Boons';

/** The id of the first boon carrying each effect kind, so tests never hard-code names. */
function idWithEffect(kind: string): string {
  const found = BOON_LIST.find(b => b.effect.kind === kind);
  if (!found) throw new Error(`no boon with effect ${kind}`);
  return found.id;
}

describe('boon catalog authoring', () => {
  it('keys every entry by its own id', () => {
    for (const [key, def] of Object.entries(BOONS)) expect(def.id).toBe(key);
  });

  it('gives every boon a name, a description and a positive duration', () => {
    for (const def of BOON_LIST) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.battles).toBeGreaterThan(0);
    }
  });

  it('covers all four effect kinds', () => {
    const kinds = new Set(BOON_LIST.map(b => b.effect.kind));
    for (const k of ['damage_dealt', 'damage_taken', 'obol_bonus', 'post_victory_heal']) {
      expect(kinds.has(k as any)).toBe(true);
    }
  });

  it('falls back rather than throwing on an unknown id', () => {
    expect(getBoon('no_such_boon')).toBe(BOON_LIST[0]);
  });
});

describe('neutral values with no boons', () => {
  const none: ActiveBoon[] = [];
  it('multiplies damage dealt by one', () => expect(damageDealtMultiplier(none)).toBe(1));
  it('multiplies damage taken by one', () => expect(damageTakenMultiplier(none, 1)).toBe(1));
  it('multiplies obols by one', () => expect(obolMultiplier(none)).toBe(1));
  it('heals nothing after a victory', () => expect(postVictoryHealFraction(none)).toBe(0));
  it('summarises to an empty list', () => expect(activeBoonSummaries(none)).toEqual([]));
});

describe('grantBoon', () => {
  it('adds a boon with its full duration', () => {
    const id = idWithEffect('damage_dealt');
    const active = grantBoon([], id);
    expect(active).toHaveLength(1);
    expect(active[0].boonId).toBe(id);
    expect(active[0].battlesLeft).toBe(getBoon(id).battles);
  });

  it('keeps boons of different effect kinds side by side', () => {
    let active = grantBoon([], idWithEffect('damage_dealt'));
    active = grantBoon(active, idWithEffect('obol_bonus'));
    expect(active).toHaveLength(2);
  });

  it('REPLACES rather than stacks when the effect kind repeats', () => {
    // Keyed on effect.kind, not boon id — two differently-named boons with the
    // same effect must not multiply together.
    const id = idWithEffect('damage_dealt');
    let active = grantBoon([], id);
    active = tickAfterBattle(active);           // burn one battle
    const before = damageDealtMultiplier(active);
    active = grantBoon(active, id);             // re-grant
    expect(active).toHaveLength(1);
    expect(active[0].battlesLeft).toBe(getBoon(id).battles);  // duration refreshed
    expect(damageDealtMultiplier(active)).toBe(before);       // magnitude UNCHANGED
  });

  it('does not mutate the list it was given', () => {
    const original: ActiveBoon[] = [];
    grantBoon(original, idWithEffect('damage_dealt'));
    expect(original).toHaveLength(0);
  });
});

describe('tickAfterBattle', () => {
  it('counts a boon down by one battle', () => {
    const id = idWithEffect('obol_bonus');
    const active = tickAfterBattle(grantBoon([], id));
    expect(active[0].battlesLeft).toBe(getBoon(id).battles - 1);
  });

  it('drops a boon once it is spent', () => {
    const id = idWithEffect('obol_bonus');
    let active = grantBoon([], id);
    for (let i = 0; i < getBoon(id).battles; i++) active = tickAfterBattle(active);
    expect(active).toHaveLength(0);
  });

  it('leaves a run-long boon alone', () => {
    // battlesLeft === null is the Relic shape; it must survive ticking.
    const active = tickAfterBattle([{ boonId: idWithEffect('obol_bonus'), battlesLeft: null }]);
    expect(active).toHaveLength(1);
    expect(active[0].battlesLeft).toBeNull();
  });
});

describe('effect queries', () => {
  it('raises damage dealt above neutral', () => {
    expect(damageDealtMultiplier(grantBoon([], idWithEffect('damage_dealt')))).toBeGreaterThan(1);
  });

  it('raises obols above neutral', () => {
    expect(obolMultiplier(grantBoon([], idWithEffect('obol_bonus')))).toBeGreaterThan(1);
  });

  it('heals a positive fraction after a victory', () => {
    expect(postVictoryHealFraction(grantBoon([], idWithEffect('post_victory_heal')))).toBeGreaterThan(0);
  });

  it('reduces damage taken below neutral', () => {
    expect(damageTakenMultiplier(grantBoon([], idWithEffect('damage_taken')), 1)).toBeLessThan(1);
  });

  it('applies a first-round ward on round 1 and not on round 2', () => {
    const active = grantBoon([], idWithEffect('damage_taken'));
    expect(damageTakenMultiplier(active, 1)).toBeLessThan(1);
    expect(damageTakenMultiplier(active, 2)).toBe(1);
  });

  it('reports each active boon with its remaining battles', () => {
    const active = grantBoon([], idWithEffect('damage_dealt'));
    const summary = activeBoonSummaries(active);
    expect(summary).toHaveLength(1);
    expect(summary[0].name).toBe(getBoon(active[0].boonId).name);
    expect(summary[0].battlesLeft).toBe(active[0].battlesLeft);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/systems/Boons.test.ts`
Expected: FAIL — `Failed to resolve import "../data/boons"`.

- [ ] **Step 4: Write the boon catalog**

Create `src/data/boons.ts`:

```ts
/**
 * Timed run-scoped modifiers, chosen at the post-battle offer and active the
 * moment they are taken. No arming step, no backpack slot, no charges to spend.
 *
 * A boon is functionally a short-duration Relic. That is deliberate: when Relics
 * are built they should reuse this layer rather than duplicate it, which is why
 * `ActiveBoon.battlesLeft` already permits `null` for "lasts the run".
 *
 * There is intentionally NO MP-discount boon. `ability.mpCost` is read raw in
 * roughly thirteen places across CombatScene and TacticsAI (affordability, menu
 * labels, Conserve MP's one-third-max ceiling, Heal First's cheapest-heal
 * reserve, comparison tiebreaks). A discount that missed any one of them would
 * make auto-combat plan against a cost the player does not pay. Every boon here
 * is a single-point modifier by design.
 *
 * Alpha placeholder values throughout — see the note at the top of CLAUDE.md.
 */

export type BoonEffect =
  | { kind: 'damage_dealt'; multiplier: number }
  | { kind: 'damage_taken'; multiplier: number; firstRoundOnly: boolean }
  | { kind: 'obol_bonus'; multiplier: number }
  | { kind: 'post_victory_heal'; fraction: number };

export interface BoonDefinition {
  id: string;
  name: string;
  description: string;
  /** Battles this lasts when granted. */
  battles: number;
  effect: BoonEffect;
}

export const BOONS: Record<string, BoonDefinition> = {
  war_chorus: {
    id: 'war_chorus',
    name: 'War Chorus',
    description: 'Your kin strike harder for the next two fights.',
    battles: 2,
    effect: { kind: 'damage_dealt', multiplier: 1.1 },
  },
  warding_thread: {
    id: 'warding_thread',
    name: 'Warding Thread',
    description: 'The opening round of the next two fights lands softer.',
    battles: 2,
    effect: { kind: 'damage_taken', multiplier: 0.75, firstRoundOnly: true },
  },
  distillers_seal: {
    id: 'distillers_seal',
    name: "Distiller's Seal",
    description: 'The next three victories pay more Obols.',
    battles: 3,
    effect: { kind: 'obol_bonus', multiplier: 1.1 },
  },
  menders_incense: {
    id: 'menders_incense',
    name: "Mender's Incense",
    description: 'Each of the next three victories closes a few wounds.',
    battles: 3,
    effect: { kind: 'post_victory_heal', fraction: 0.1 },
  },
};

export const BOON_LIST: readonly BoonDefinition[] = Object.values(BOONS);

/** Falls back rather than throwing, matching `getItem` — a bad id costs one boon,
 *  not the run. */
export function getBoon(id: string): BoonDefinition {
  return BOONS[id] ?? BOON_LIST[0];
}
```

- [ ] **Step 5: Write the boon system**

Create `src/systems/Boons.ts`:

```ts
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/systems/Boons.test.ts`
Expected: PASS — 24 tests.

Then run the whole suite: `npm test`. Expect 409 pre-existing plus 24 new = 433, with **no failures** — if `RunState` construction sites were missed in Step 1, they surface here or in `tsc`.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/data/boons.ts src/systems/Boons.ts src/systems/Boons.test.ts src/types.ts
git commit -m "feat: timed run-scoped boons"
```

If `tsc` named other files needing `activeBoons: []`, add those paths to the same commit — the field addition and its construction sites belong together.

---

### Task 2: The reward offer generator

**Files:**
- Create: `src/systems/RewardOffer.ts`
- Create: `src/systems/RewardOffer.test.ts`

**Interfaces:**
- Consumes: `BOON_LIST` from `src/data/boons.ts` (Task 1); `ITEMS` from `src/data/items.ts`; `obolsForEncounter` from `src/systems/Economy.ts`.
- Produces: `RewardKind`, `RewardCard`, `OfferContext`, `generateOffer(ctx, roll): RewardCard[]`, `REWARD_ITEM_POOLS`. Tasks 4 and 5 consume these.

- [ ] **Step 1: Write the failing test**

Create `src/systems/RewardOffer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/items';
import { BOONS } from '../data/boons';
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

  it('offers the rarer extraction items only at boss tiers', () => {
    // Waystones and Smoke Husks are the most expensive things the shops sell;
    // handing one out after an ordinary fight would undercut the departure lock.
    expect(REWARD_ITEM_POOLS.normal).not.toContain('waystone');
    expect(REWARD_ITEM_POOLS.normal).not.toContain('smoke_husk');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/RewardOffer.test.ts`
Expected: FAIL — `Failed to resolve import "./RewardOffer"`.

- [ ] **Step 3: Write the implementation**

Create `src/systems/RewardOffer.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/systems/RewardOffer.test.ts`
Expected: PASS — 11 tests.

Then `npm test`: expect 433 + 11 = 444, no failures.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/systems/RewardOffer.ts src/systems/RewardOffer.test.ts
git commit -m "feat: weighted three-card reward offer"
```

---

### Task 3: Wire boons into combat

**Files:**
- Modify: `src/scenes/CombatScene.ts` (`resolveAbility`, the victory branch of `showBattleEnd`, and `escapeBattle`)
- Modify: `src/scenes/RunScene.ts` (initialise `activeBoons` on a new run)

**Interfaces:**
- Consumes: `damageDealtMultiplier`, `damageTakenMultiplier`, `obolMultiplier`, `postVictoryHealFraction`, `tickAfterBattle` from `src/systems/Boons.ts` (Task 1).
- Produces: nothing importable. Task 6 displays what this maintains.

**Verification is by reading, `tsc` and the suite** — Phaser scenes have no test harness here.

- [ ] **Step 1: Initialise the field on a new run**

In `src/scenes/RunScene.ts`'s `init()`, the fresh-run object literal already sets `xpEarned: 0, autoCombat: false`. Add `activeBoons: []` beside them. (If Task 1's `tsc` pass already forced this, confirm it is there and move on.)

- [ ] **Step 2: Apply the damage multipliers**

In `src/scenes/CombatScene.ts`, add the import:

```ts
import {
  damageDealtMultiplier, damageTakenMultiplier, obolMultiplier,
  postVictoryHealFraction, tickAfterBattle,
} from '../systems/Boons';
```

`resolveAbility` currently reads:

```ts
    if (ability.power > 0) {
      const result = calculateDamage(attacker, target, ability);
      if (result.missed) { ... return; }
      applyDamage(target, result.damage);
      let msg = `${attacker.template.name} used ${ability.name} → ${result.damage} dmg to ${target.template.name}`;
```

Replace the damage application with a boon-adjusted figure. Note this method serves **both sides** — enemies resolve abilities through it too — so the multipliers must key on ownership, not assume the player:

```ts
    if (ability.power > 0) {
      const result = calculateDamage(attacker, target, ability);
      if (result.missed) { ... return; }

      // Boons are the player's. `damageDealt` applies only when one of the
      // player's kin is swinging; `damageTaken` only when one of them is being
      // hit. resolveAbility runs for enemy turns as well, so keying on ownership
      // rather than assuming the player is what keeps an enemy from riding the
      // player's War Chorus.
      const boons = gameState.currentRun?.activeBoons ?? [];
      const dealt = attacker.isPlayerOwned ? damageDealtMultiplier(boons) : 1;
      const taken = target.isPlayerOwned ? damageTakenMultiplier(boons, this.roundNumber) : 1;
      const damage = Math.max(1, Math.round(result.damage * dealt * taken));

      applyDamage(target, damage);
      let msg = `${attacker.template.name} used ${ability.name} → ${damage} dmg to ${target.template.name}`;
```

Update the rest of the method to use `damage` rather than `result.damage`, **including the `applyAbilityEffects(ability, attacker, target, result.damage)` call** — recoil should be computed from the damage actually dealt.

**Item damage is deliberately untouched.** `applyPercentDamage` (Grave Ash) does not go through `resolveAbility` and must not be multiplied: War Chorus says the player's *kin* strike harder, and an item is not a kin. Leaving it alone also keeps Grave Ash's "reliable, ignores everything" identity intact.

- [ ] **Step 3: Apply the victory effects and tick**

In `showBattleEnd`'s victory branch, `obolGain` is currently:

```ts
      const obolGain = obolsForEncounter(obolKind, this.encounter.floor);
      run.obols += obolGain;
```

Multiply it, then after the level-up loop and before `savePartyState(run)`, apply the post-victory heal and tick the boons:

```ts
      const boons = run.activeBoons;
      const obolGain = Math.max(
        1, Math.round(obolsForEncounter(obolKind, this.encounter.floor) * obolMultiplier(boons)),
      );
      run.obols += obolGain;
```

and further down, immediately before `this.savePartyState(run)`:

```ts
      // Post-victory heal, then count every boon down one battle. Both happen
      // here so the ledger the player is about to see already reflects them.
      const healFraction = postVictoryHealFraction(boons);
      if (healFraction > 0) {
        for (const pc of this.playerParty) {
          if (pc.isKnockedOut) continue;
          pc.currentHp = Math.min(pc.maxHp, pc.currentHp + Math.floor(pc.maxHp * healFraction));
        }
      }
      run.activeBoons = tickAfterBattle(boons);
```

The heal runs on `this.playerParty` (combat state) rather than `run.partyHp`, because `savePartyState(run)` copies combat state into the run immediately afterwards — writing to the run first would be overwritten.

- [ ] **Step 4: Tick on an escape too**

In `escapeBattle()`, add the tick before `savePartyState`:

```ts
    // A Smoke Husk escape spent a battle even though it paid nothing. Not
    // counting it would quietly make the husk a duration-extender for boons.
    run.activeBoons = tickAfterBattle(run.activeBoons);
```

Read the method first — it currently resolves `run` from `gameState.currentRun!`; reuse that local rather than adding a second lookup.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm test
```
Expect 444 tests, unchanged — this task adds none. Then:

```bash
git add src/scenes/CombatScene.ts src/scenes/RunScene.ts
git commit -m "feat: boons modify combat damage, victory obols and healing"
```

---

### Task 4: The reward offer screen

**Files:**
- Modify: `src/scenes/PostCombatScene.ts` (substantial rewrite)
- Modify: `src/scenes/CombatScene.ts` (pass the tier through to the scene)

**Interfaces:**
- Consumes: `generateOffer`, `RewardCard`, `OfferContext` from `src/systems/RewardOffer.ts` (Task 2); `grantBoon` from `src/systems/Boons.ts` (Task 1); `applyTargetedRecovery`, `canReceiveRecovery`, `eligibleRecoveryTargets` from `src/systems/Recovery.ts`; `add as addToBackpack`, `isFull` from `src/systems/Backpack.ts`; `getItem` from `src/data/items.ts`; `getBoon` from `src/data/boons.ts`.
- Produces: nothing importable. Task 5 extends this scene's item path.

- [ ] **Step 1: Pass the encounter tier through**

`CombatScene.showBattleEnd` currently starts the scene with `{ floor, obolGain, xpPerCreature, levelUpMessage }`. The offer needs the tier. It is already computed there as `obolKind`; pass it:

```ts
      this.scene.start('PostCombatScene', {
        floor: this.encounter.floor,
        tier: obolKind,
        obolGain,
        xpPerCreature,
        levelUpMessage: levelUpMsg.trim(),
      });
```

and widen `PostCombatData` in `PostCombatScene.ts`:

```ts
interface PostCombatData {
  floor: number;
  tier: 'normal' | 'mini' | 'major';
  obolGain: number;
  xpPerCreature: number;
  levelUpMessage: string;
}
```

- [ ] **Step 2: Generate the offer once, in `init`**

The scene redraws on hover, so the offer must be generated **once per battle**, not per draw — regenerating in `draw()` would reshuffle the cards under the player's cursor. This is the same failure the tower merchant's stock hit in slice 1.

Replace the `BOONS` constant and `selectedBoon` state with:

```ts
  private offer: RewardCard[] = [];
  private selected = 0;
  private selectingTarget = false;
  private targetIndex = 0;
  private keyboardBound = false;

  init(data: PostCombatData): void {
    this.rewardData = data;
    this.selected = 0;
    this.selectingTarget = false;
    this.targetIndex = 0;

    const run = gameState.currentRun!;
    const party = gameState.runParty;
    this.offer = generateOffer({
      tier: data.tier,
      floor: data.floor,
      anyHurt: party.some(c => canReceiveRecovery('hp', c, run)),
      anyMpMissing: party.some(c => canReceiveRecovery('mp', c, run)),
    }, Math.random);
  }
```

`canReceiveRecovery` already excludes knocked-out creatures and already returns false at full HP/MP, so it is exactly the viability predicate the generator wants — do not reimplement it.

- [ ] **Step 3: Render the cards**

Keep the existing `screenFrame` / `header` / earnings panel / party strip layout. Replace the two fixed boon cards with the offer, laid out across the same band. Card copy comes from the card kind:

```ts
  /** Display copy for a card. Derived from the card, never from a hard-coded id. */
  private cardFace(card: RewardCard): { label: string; value: string; body: string; color: number } {
    switch (card.kind) {
      case 'heal':
        return {
          label: 'MEND WOUNDS', value: `${Math.round(card.fraction * 100)}%`,
          body: 'Restore one living creature by that share of its maximum HP.',
          color: UI.green,
        };
      case 'mana':
        return {
          label: 'CLEAR THE MIND', value: `${Math.round(card.fraction * 100)}%`,
          body: 'Restore one living creature by that share of its maximum MP.',
          color: UI.teal,
        };
      case 'obols':
        return {
          label: 'SPOILS', value: `+${card.amount}`,
          body: 'Take the coin now. It converts to Essence when you leave.',
          color: UI.gold,
        };
      case 'item': {
        const def = getItem(card.itemId);
        return { label: def.name.toUpperCase(), value: 'SUPPLY', body: def.description, color: UI.amber };
      }
      case 'boon': {
        const def = getBoon(card.boonId);
        return {
          label: def.name.toUpperCase(), value: `${def.battles} FIGHTS`,
          body: def.description, color: UI.orange,
        };
      }
    }
  }
```

Lay the cards out across the width the two boons currently occupy, sized by `this.offer.length` so a two-card offer is not left with a gap:

```ts
    const count = this.offer.length;
    const gap = 12;
    const cardW = (912 - gap * (count - 1)) / count;
    this.offer.forEach((card, i) => {
      const x = 24 + cardW / 2 + i * (cardW + gap);
      this.drawCard(card, x, 315, cardW, i === this.selected, i);
    });
```

This mirrors `RunScene.draw()`'s room-card layout, which already handles a variable card count on the same canvas — follow its shape.

`drawCard` replaces the existing `drawBoon(x, y, w, boon, index)`. Same furniture, driven by `cardFace` instead of a hard-coded constant:

```ts
  private drawCard(
    card: RewardCard, x: number, y: number, w: number, selected: boolean, index: number,
  ): void {
    const face = this.cardFace(card);
    const bg = panel(this, x, y, w, 286, selected);
    spritePlate(this, x, y - 55, w - 30, 116, face.color, selected ? UI.gold : UI.line);
    this.add.text(x, y - 55, face.value, {
      fontFamily: DISPLAY_FONT, fontSize: face.value.length > 6 ? '11px' : '20px',
      color: Phaser.Display.Color.IntegerToColor(face.color).rgba,
    }).setOrigin(0.5);
    this.add.text(x, y + 30, face.label, {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: selected ? UI.hi : UI.text,
    }).setOrigin(0.5);
    this.add.text(x, y + 69, face.body, {
      fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
      align: 'center', wordWrap: { width: w - 54 },
    }).setOrigin(0.5);
    this.add.text(x, y + 111, this.cardFootnote(card), {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
    }).setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (this.swappingFor !== null || this.selectingTarget) return;
      if (this.selected !== index) { this.selected = index; this.draw(); }
    });
    bg.on('pointerdown', () => {
      if (this.swappingFor !== null || this.selectingTarget) return;
      this.selected = index;
      this.takeSelected();
    });
  }

  /** The one line under a card that says what taking it will cost or need. */
  private cardFootnote(card: RewardCard): string {
    if (card.kind === 'heal' || card.kind === 'mana') return 'CHOOSE A TARGET';
    if (card.kind === 'item') return isFull(gameState.backpack) ? 'BAG IS FULL — SWAP' : 'INTO THE BAG';
    if (card.kind === 'boon') return 'TAKES HOLD AT ONCE';
    return 'TAKEN IMMEDIATELY';
  }
```

The `swappingFor` guard in both handlers is required, not defensive: `RunScene.drawOffer` carries the identical guard, and its comment records why — cards stay interactive underneath an overlay, so a click meant for the modal commits a card instead. `swappingFor` does not exist until Task 5; add the field as `private swappingFor: string | null = null;` now so this task compiles, and Task 5 gives it behaviour.

**If `this.offer` is empty** (nothing viable — possible only if the party is untouched and the draw somehow yields nothing), render a single CONTINUE affordance and skip card drawing entirely. Do not render an empty band.

- [ ] **Step 4: Resolve the chosen card**

```ts
  /**
   * Take the selected card. `heal` and `mana` need a target first; everything
   * else resolves immediately.
   *
   * The item path is deliberately the only one that can fail — a full bag is
   * handled in Task 5. Until then it refuses without consuming the offer.
   */
  private takeSelected(): void {
    const run = gameState.currentRun!;
    const card = this.offer[this.selected];
    if (!card) { this.continueRun(); return; }

    switch (card.kind) {
      case 'heal':
      case 'mana': {
        const kind = card.kind === 'heal' ? 'hp' : 'mp';
        if (!this.selectingTarget) {
          const first = gameState.runParty.findIndex(c => canReceiveRecovery(kind, c, run));
          if (first === -1) { this.continueRun(); return; }
          this.targetIndex = first;
          this.selectingTarget = true;
          this.draw();
          return;
        }
        const target = gameState.runParty[this.targetIndex];
        if (!target || !canReceiveRecovery(kind, target, run)) return;
        applyTargetedRecovery(kind, card.fraction, target, run);
        break;
      }
      case 'obols':
        run.obols += card.amount;
        break;
      case 'boon':
        run.activeBoons = grantBoon(run.activeBoons, card.boonId);
        break;
      case 'item': {
        if (isFull(gameState.backpack)) return;   // Task 5 replaces this with a swap
        const result = addToBackpack(gameState.backpack, { kind: 'item', itemId: card.itemId });
        if (!result) return;
        gameState.backpack = result.bag;
        break;
      }
    }
    this.continueRun();
  }
```

Keep the existing `continueRun()` (saves and starts `RunScene` with `continueRun: true`) and the existing target-selection screen, changing only which fraction and kind it reads — take those from the selected card rather than a `BOONS` constant.

Wire `← →` to move `this.selected` across `this.offer.length`, `ENTER` to `takeSelected()`, and `ESC` to back out of target selection, exactly as the current bindings do.

**Watch the dead-button rule:** if the item card is rendered unavailable on a full bag, pass `null` as its `onClick` rather than a handler with `enabled: false`.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm test
```
Expect 444, unchanged. Then:

```bash
git add src/scenes/PostCombatScene.ts src/scenes/CombatScene.ts
git commit -m "feat: three-card reward offer replaces the fixed two boons"
```

---

### Task 5: Full-bag swap on the item card

**Files:**
- Modify: `src/scenes/PostCombatScene.ts`

**Interfaces:**
- Consumes: `removeAt`, `add as addToBackpack`, `isFull`, `isProtected`, `capacity`, `usedSlots` from `src/systems/Backpack.ts`; `getItem` from `src/data/items.ts`; `getTemplate` from `src/data/creatures.ts`.
- Produces: nothing importable. Final task before display.

- [ ] **Step 1: Add the swap state**

```ts
  /** Set when the player took an item card with no room — pick a slot to drop. */
  private swappingFor: string | null = null;   // the incoming itemId
```

Task 4 already declared this field so its hover/click guards compile; you are giving it behaviour, not introducing it. Reset it in `init()` alongside the other fields.

This task also needs `BackpackSlot` imported from `../types` and `getTemplate` from `../data/creatures` for `slotLabel` — check what `PostCombatScene` already imports before adding.

- [ ] **Step 2: Open the swap instead of refusing**

Replace the item case from Task 4:

```ts
      case 'item': {
        if (isFull(gameState.backpack)) {
          // The pitch's rule: taking an item with a full bag means using,
          // replacing or abandoning something. Offer the replace.
          this.swappingFor = card.itemId;
          this.draw();
          return;
        }
        const result = addToBackpack(gameState.backpack, { kind: 'item', itemId: card.itemId });
        if (!result) return;
        gameState.backpack = result.bag;
        break;
      }
```

- [ ] **Step 3: Draw the slot picker**

```ts
  /**
   * Choose what to drop so the new item fits. Deliberately shows the SECURED
   * marking, because which slot the player gives up changes what a wipe can take
   * — that is the whole reason guaranteed slots exist.
   */
  private drawSwap(incomingId: string): void {
    const bag = gameState.backpack;
    this.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
    panel(this, 480, 320, 640, 420, true);

    this.add.text(480, 138, 'THE BAG IS FULL', {
      fontFamily: DISPLAY_FONT, fontSize: '14px', color: UI.hi,
    }).setOrigin(0.5);
    this.add.text(480, 170, `DROP SOMETHING TO MAKE ROOM FOR ${getItem(incomingId).name.toUpperCase()}`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
    }).setOrigin(0.5);

    bag.slots.forEach((slot, i) => {
      const x = 260 + (i % 3) * 148;
      const y = 240 + Math.floor(i / 3) * 92;
      const safe = isProtected(bag, i);
      const cell = this.add.rectangle(x, y, 136, 80, UI.panel)
        .setStrokeStyle(2, safe ? UI.teal : UI.line);
      if (safe) {
        this.add.text(x, y - 28, 'SECURED', {
          fontFamily: BODY_FONT, fontSize: '8px', color: UI.tealCss,
        }).setOrigin(0.5);
      }
      this.add.text(x, y - 4, this.slotLabel(slot), {
        fontFamily: BODY_FONT, fontSize: '8px', color: slot ? UI.body : UI.muted,
        align: 'center', wordWrap: { width: 124 },
      }).setOrigin(0.5);
      if (slot !== null) {
        this.add.text(x, y + 26, 'DROP', {
          fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.redCss,
        }).setOrigin(0.5);
        cell.setInteractive({ useHandCursor: true });
        cell.on('pointerdown', () => this.resolveSwap(i, incomingId));
      }
    });

    button(this, 480, 500, 200, 44, 'KEEP MY BAG', () => {
      this.swappingFor = null;
      this.continueRun();
    }, UI.lineBright);
  }

  private slotLabel(slot: BackpackSlot): string {
    if (!slot) return 'empty';
    switch (slot.kind) {
      case 'creature': return getTemplate(slot.instance.speciesId).name.toUpperCase();
      case 'item': return getItem(slot.itemId).name.toUpperCase();
      case 'mark': return `MARK · ${slot.markId.toUpperCase()}`;
      case 'trait': return `${slot.traitId.toUpperCase()} L${slot.traitLevel}`;
    }
  }

  /** Drop `index`, put the incoming item in its place, and move on. */
  private resolveSwap(index: number, incomingId: string): void {
    const dropped = removeAt(gameState.backpack, index);
    const result = addToBackpack(dropped, { kind: 'item', itemId: incomingId });
    gameState.backpack = result ? result.bag : dropped;
    this.swappingFor = null;
    this.continueRun();
  }
```

Call `drawSwap` from `draw()` when `this.swappingFor !== null`, ahead of the card rendering, and guard the card hover/click handlers against firing while it is open — `RunScene.drawOffer` carries the same guard for its modals, and its comment explains why: cards stay interactive underneath an overlay unless explicitly blocked.

**`KEEP MY BAG` forfeits the card entirely.** That is the honest reading of "using, replacing, or abandoning" — the player abandoned it. Do not silently fall back to another card.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm test
```
Expect 444, unchanged. Then:

```bash
git add src/scenes/PostCombatScene.ts
git commit -m "feat: swap a bag slot to take a reward item"
```

---

### Task 6: Show active boons on the run map

**Files:**
- Modify: `src/scenes/RunScene.ts`

**Interfaces:**
- Consumes: `activeBoonSummaries` from `src/systems/Boons.ts` (Task 1).
- Produces: nothing. Final task.

- [ ] **Step 1: Render the strip**

A boon the player cannot see is a boon they will not believe in. `RunScene.draw()` already renders a `TRAIL` row at y≈106 and the commitment line at y≈573. Add a boon strip under the trail:

```ts
    const boons = activeBoonSummaries(run.activeBoons);
    if (boons.length) {
      this.add.text(24, 126, 'IN EFFECT', {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
      }).setOrigin(0, 0.5);
      boons.forEach((b, i) => {
        const label = b.battlesLeft === null
          ? b.name.toUpperCase()
          : `${b.name.toUpperCase()}  ${b.battlesLeft}`;
        this.add.text(96 + i * 176, 126, label, {
          fontFamily: DISPLAY_FONT, fontSize: '8px',
          color: Phaser.Display.Color.IntegerToColor(UI.orange).rgba,
        }).setOrigin(0, 0.5);
      });
    }
```

**Note `UI.orange` is a number, not a CSS string.** `Theme.ts` exposes `orange: 0xde5d3a` with no `orangeCss` companion (unlike `gold`/`teal`/`green`, which have both). Converting via `Phaser.Display.Color.IntegerToColor(...).rgba` is the pattern this file already uses elsewhere — see `drawTrail` and `offerMeta`. Writing `UI.orangeCss` will not compile.

The trailing number is battles remaining. With four boons and one of each kind the strip holds at most four entries, so 176px each fits the 912px band.

**Verify the vertical placement against the real scene before committing** — do not trust y=126 because this plan says so. `RunScene.draw()` puts the TRAIL row near y=106 and the "CHOOSE THE NEXT ROOM" heading near y=143, so the strip is threading a ~37px gap. Read the actual coordinates, compute the clearances above and below, and report them. If it does not fit cleanly, move the heading down or shorten the strip rather than letting text overlap. Two off-canvas/overlapping-layout bugs shipped on the previous slice from exactly this kind of assumed coordinate.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit && npm test
```
Expect 444, unchanged. Then:

```bash
git add src/scenes/RunScene.ts
git commit -m "feat: show active boons and their remaining battles on the run map"
```

---

## Final verification

- [ ] `npm test` — all green, ~444 tests (409 at branch point + 24 boons + 11 offer).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — succeeds.
- [ ] `grep -rn "activeBoons" src/` — every `RunState` construction site sets it.
- [ ] Browser pass, **tab foregrounded** (a hidden tab throttles `requestAnimationFrame` to zero, stops Phaser's clock, and makes every `delayedCall` silently never fire — this looks exactly like a hang and has cost this project real time): win a fight and confirm three distinct cards; take a boon and confirm it appears on the run map with a countdown; confirm the count drops after the next fight and the boon vanishes at zero; take an Obols card and watch the purse rise; fill the bag and confirm the item card opens the swap picker; confirm `KEEP MY BAG` forfeits the card.
- [ ] Update `CLAUDE.md`: move the reward offer and boons into "What's Built"; note that Heirlooms and Marks-as-unlocks remain the last two deferred pieces of the pitch; record that there is deliberately no MP-discount boon and why.
