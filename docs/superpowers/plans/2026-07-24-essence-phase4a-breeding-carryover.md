# Essence Pivot — Phase 4a: Breeding Essence Carry-Over Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make breeding carry a jump-start to the offspring — the parents' invested essence partially transfers, giving the child a starting `permanentLevel` above 1 (Design Model B), instead of always starting at level 1.

**Architecture:** A new pure `levelFromEssence(essence, levelCap)` helper in `Economy.ts` "spends" an essence pool up the existing `essenceCostForLevel` cost curve to yield a `{ level, invested }` pair — preserving the invariant that a creature's `essenceInvested` always equals the cumulative cost of its `permanentLevel` (the same invariant the Leveler maintains). `BreedingSystem.breed` computes a carry-over pool from the parents and applies this helper to set the offspring's starting level. `BreedingScene` shows the resulting jump-start in the offspring preview.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest (already set up).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md` (section 4) and `breeding-and-inheritance.md`.
- **Both parents are still retired on breeding** — keep the existing behavior; this phase only changes the offspring's starting level.
- **Carry-over formula (placeholder):** `pool = floor( ((parentA.essenceInvested + parentB.essenceInvested) / 2) * BREED_CARRYOVER_FRACTION )`, with `BREED_CARRYOVER_FRACTION = 0.5`. Then the offspring's `permanentLevel`/`essenceInvested` come from spending `pool` up the `essenceCostForLevel` curve, capped at the offspring's `levelCap`.
- **Invariant:** offspring `essenceInvested` must equal the cumulative cost of its `permanentLevel` (i.e. `sum(essenceCostForLevel(1..permanentLevel-1))`), and `currentLevel === permanentLevel`. This matches how the Leveler leaves a creature.
- `essenceCostForLevel(level) = floor(10 * level^1.5)` (existing). Do not reimplement it.
- All numbers are playtest-tunable placeholders.
- Do NOT build: traits system / Trait-keeper, marks system / Mark-binder, Quartermaster/inventory, or Obols→Essence conversion-rate levers (separate later work — they need their own systems).

---

### Task 1: Economy — levelFromEssence helper

**Files:**
- Modify: `src/types.ts` (add `BREED_CARRYOVER_FRACTION`)
- Modify: `src/systems/Economy.ts` (add `levelFromEssence`)
- Test: `src/systems/Economy.test.ts`

**Interfaces:**
- Produces: `levelFromEssence(essence: number, levelCap: number): { level: number; invested: number }` — greedily spends `essence` buying levels up the cost curve from level 1, stopping at `levelCap` or when the next level is unaffordable. `invested` is the essence actually consumed. `BREED_CARRYOVER_FRACTION = 0.5`.

- [ ] **Step 1: Write the failing tests** — append to `src/systems/Economy.test.ts`. Add `levelFromEssence` to the existing `./Economy` import (do not add a duplicate import line):

```ts
describe('levelFromEssence', () => {
  it('stays at level 1 with no essence', () => {
    expect(levelFromEssence(0, 50)).toEqual({ level: 1, invested: 0 });
  });
  it('buys exactly one level at the level-1 cost (10)', () => {
    // cost(1)=10 -> reaches level 2, invested 10
    expect(levelFromEssence(10, 50)).toEqual({ level: 2, invested: 10 });
  });
  it('does not overspend on a partial level', () => {
    // 19 essence: buys L1->2 (10), can't afford L2->3 (28). level 2, invested 10.
    expect(levelFromEssence(19, 50)).toEqual({ level: 2, invested: 10 });
  });
  it('buys multiple levels and reports cumulative invested', () => {
    // cost(1)=10, cost(2)=28 -> 38 reaches level 3, invested 38
    expect(levelFromEssence(38, 50)).toEqual({ level: 3, invested: 38 });
  });
  it('never exceeds the level cap (invested is only what was spent to reach the cap)', () => {
    // cap 3: cost(1)=10, cost(2)=28 -> invested 38 reaches level 3, stops even with essence to spare
    expect(levelFromEssence(100000, 3)).toEqual({ level: 3, invested: 38 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/systems/Economy.test.ts`
Expected: FAIL — `levelFromEssence` not exported.

- [ ] **Step 3: Implement.**

Add the constant to `src/types.ts` (near the other economy consts, e.g. after `LEVEL_COST_EXPONENT`):
```ts
export const BREED_CARRYOVER_FRACTION = 0.5; // fraction of parents' avg invested essence that carries to offspring
```

Add the function to `src/systems/Economy.ts`:
```ts
/**
 * Spend an essence pool buying permanent levels up the cost curve from level 1.
 * Returns the level reached and the essence actually consumed (leftover is dropped).
 * Preserves the Leveler invariant: `invested` == cumulative cost of `level`.
 */
export function levelFromEssence(essence: number, levelCap: number): { level: number; invested: number } {
  let level = 1;
  let invested = 0;
  while (level < levelCap) {
    const cost = essenceCostForLevel(level);
    if (invested + cost > essence) break;
    invested += cost;
    level++;
  }
  return { level, invested };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/systems/Economy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/systems/Economy.ts src/systems/Economy.test.ts
git commit -m "feat: levelFromEssence helper + BREED_CARRYOVER_FRACTION"
```

---

### Task 2: BreedingSystem — offspring essence carry-over

**Files:**
- Modify: `src/systems/BreedingSystem.ts`
- Test: `src/systems/BreedingSystem.test.ts` (create)

**Interfaces:**
- Consumes: `levelFromEssence`, `essenceCostForLevel`, `BREED_CARRYOVER_FRACTION` (from `../systems/Economy` / `../types`).
- Produces: `breed()` returns an offspring whose `permanentLevel`/`essenceInvested`/`currentLevel` reflect the carry-over. Adds an exported pure helper `carryoverForParents(parentA, parentB, levelCap): { level: number; invested: number }` for testability.

- [ ] **Step 1: Write the failing tests** — create `src/systems/BreedingSystem.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { breed, carryoverForParents } from './BreedingSystem';
import { CreatureInstance } from '../types';

// Minimal creature-instance factory for tests (only fields breeding reads).
function makeParent(overrides: Partial<CreatureInstance>): CreatureInstance {
  return {
    instanceId: 'p', speciesId: 'ironjaw', nickname: null, starRating: 1,
    currentLevel: 1, levelCap: 50, permanentLevel: 1, essenceInvested: 0,
    abilities: [], traitSlots: [], lineage: { parentA: null, parentB: null },
    currentStats: { hp: 30, mp: 5, str: 10, def: 8, wis: 5, spd: 7, int: 4 },
    resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
    ...overrides,
  };
}

describe('carryoverForParents', () => {
  it('is level 1 / 0 invested when both parents have no invested essence', () => {
    const a = makeParent({ essenceInvested: 0 });
    const b = makeParent({ essenceInvested: 0 });
    expect(carryoverForParents(a, b, 50)).toEqual({ level: 1, invested: 0 });
  });

  it('carries half the average invested essence, converted through the cost curve', () => {
    // Two Lv3 parents: essenceInvested 38 each. avg 38, *0.5 = 19 pool.
    // levelFromEssence(19,50) -> level 2, invested 10.
    const a = makeParent({ essenceInvested: 38 });
    const b = makeParent({ essenceInvested: 38 });
    expect(carryoverForParents(a, b, 50)).toEqual({ level: 2, invested: 10 });
  });

  it('respects the offspring level cap', () => {
    const a = makeParent({ essenceInvested: 100000 });
    const b = makeParent({ essenceInvested: 100000 });
    const r = carryoverForParents(a, b, 3);
    expect(r.level).toBe(3);
  });
});

describe('breed applies carry-over to the offspring', () => {
  it('sets permanentLevel = currentLevel = carried level, and matching essenceInvested', () => {
    const a = makeParent({ instanceId: 'a', essenceInvested: 38 });
    const b = makeParent({ instanceId: 'b', essenceInvested: 38 });
    const child = breed(a, b, 'ironjaw', []);
    expect(child.permanentLevel).toBe(2);
    expect(child.currentLevel).toBe(2);
    expect(child.essenceInvested).toBe(10);
  });

  it('still retires both parents', () => {
    const a = makeParent({ instanceId: 'a', essenceInvested: 0 });
    const b = makeParent({ instanceId: 'b', essenceInvested: 0 });
    breed(a, b, 'ironjaw', []);
    expect(a.isRetired).toBe(true);
    expect(b.isRetired).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/systems/BreedingSystem.test.ts`
Expected: FAIL — `carryoverForParents` not exported; offspring still `permanentLevel: 1`.

- [ ] **Step 3: Implement in `src/systems/BreedingSystem.ts`.**

Update the imports (line 1):
```ts
import { CreatureInstance, STAR_LEVEL_CAPS, generateId, BaseStats, BREED_CARRYOVER_FRACTION } from '../types';
import { getTemplate } from '../data/creatures';
import { levelFromEssence } from './Economy';
```

Add the exported helper (e.g. after `calculateOffspringStats`):
```ts
/** Jump-start the offspring inherits: half the parents' average invested essence, spent up the cost curve. */
export function carryoverForParents(
  parentA: CreatureInstance,
  parentB: CreatureInstance,
  levelCap: number,
): { level: number; invested: number } {
  const avgInvested = (parentA.essenceInvested + parentB.essenceInvested) / 2;
  const pool = Math.floor(avgInvested * BREED_CARRYOVER_FRACTION);
  return levelFromEssence(pool, levelCap);
}
```

In `breed`, after `const levelCap = ...`, compute the carry-over and use it for the offspring's level fields. Replace the offspring object's `currentLevel: 1, ... permanentLevel: 1, essenceInvested: 0,` lines so they read:
```ts
  const carry = carryoverForParents(parentA, parentB, levelCap);
```
(place this line after `const levelCap = STAR_LEVEL_CAPS[starRating] ?? 5;`), and in the returned object set:
```ts
    currentLevel: carry.level,
    levelCap,
    permanentLevel: carry.level,
    essenceInvested: carry.invested,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/systems/BreedingSystem.test.ts`
Expected: PASS — carry-over + retirement tests green.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS — all tests green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/systems/BreedingSystem.ts src/systems/BreedingSystem.test.ts
git commit -m "feat: breeding carries an essence jump-start to the offspring"
```

---

### Task 3: BreedingScene — show the jump-start in the preview

**Files:**
- Modify: `src/scenes/BreedingScene.ts`

**Interfaces:**
- Consumes: the offspring produced for the preview (which now has `permanentLevel` > 1 when parents have invested essence).

- [ ] **Step 1: Add a carry-over line to the offspring preview.** Locate the offspring preview text in `BreedingScene.ts` (search for `Level Cap:` — it renders `` `Level Cap: ${offspring.levelCap}` `` near the preview panel). Add a line just below it showing the carried-over starting level:

```ts
    this.add.text(cx, cy + 100, `Starts at Lv ${offspring.permanentLevel} (carried from parents)`, {
      fontSize: '12px', color: '#88ccaa', fontFamily: 'monospace',
    }).setOrigin(0.5);
```

Adjust the `cy + 100` y-offset if needed so it sits just under the existing "Level Cap" line without overlap (match the spacing of the surrounding preview text). If the preview computes the offspring via a helper, reuse that same offspring object — do not recompute it differently.

- [ ] **Step 2: Typecheck + build + test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: PASS — green build, all unit tests pass.

- [ ] **Step 3: Manual playtest smoke check (controller may run this).** `npm run dev`, then: get a creature to a permanent level > 1 at the Leveler (or via a save), open BREED, pick two parents with invested essence, and confirm the offspring preview shows "Starts at Lv N (carried from parents)" with N > 1; confirm the bred child appears in the box at that level.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BreedingScene.ts
git commit -m "feat: breeding preview shows the offspring's carried-over start level"
```

---

## Phase 4a Done — Not Yet Built

The rest of the original "Phase 4" needs its own systems first and is out of scope here:
- **Traits system** + Trait-keeper (traits unlock at essence thresholds).
- **Marks system** + Mark-binder (earn-then-lock, Floor Marks on bosses).
- **Quartermaster / inventory** (backpack capacity).
- **Obols→Essence conversion-rate levers** (Essence Distiller trait, Quartermaster upgrades, depth) — depend on the traits/Quartermaster systems above (a depth-only lever could ship independently later).
