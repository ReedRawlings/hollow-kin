# Essence Pivot — Phase 1: Data Model + Currency Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the level-1-every-run/plasm model with the permanent essence progression spine: Obols (in-run) earned from combat, converted to permanent Essence on run exit, and Essence spent to buy permanent creature levels — with a save migration and green build.

**Architecture:** A new pure `src/systems/Economy.ts` module owns all currency math (Obol→Essence conversion, wipe penalty, permanent-level cost curve) so it's unit-testable in isolation. `types.ts` gains the new fields/constants and drops longevity. `GameState.ts` is reworked to store Essence, start runs at a creature's permanent level floor (not 1), convert leftover Obols on `endRun`, and buy permanent levels. Scenes get minimal edits (plasm→obols renames, dropped longevity/stones displays) so `npm run build` stays green — full town-vendor UI is Phase 3.

**Tech Stack:** TypeScript, Phaser 3, Vite. Adding **vitest** for unit tests.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md`. All numeric values below are **placeholders for playtest tuning** — copy them exactly but expect them to change.
- **One permanent currency = Essence.** Obols are run-scoped and never persist as Obols.
- **Leftover-only conversion:** only unspent Obols convert to Essence on exit.
- **Wipe penalty = 50%:** a full wipe converts only half of leftover Obols; a deliberate exit or win converts 100%.
- **Conversion rate placeholder = 0.5** (Essence per leftover Obol).
- **Obol earn weights (placeholder):** normal combat 5, mini-boss 25, major-boss 75. (Phase 1 has no mini/major split yet — treat `boss` encounters as major; that split lands in Phase 2.)
- **Permanent-level cost curve (placeholder):** `floor(10 * level^1.5)` Essence to go from `level` → `level+1`.
- Creatures **reset to their `permanentLevel` floor** at run start, NOT to 1.
- **Longevity is removed** — no field, no ticking, no display.
- Keep the existing zone-based tower for now; the 30-floor descent is Phase 2. Do not restructure `RunGenerator`/`Encounter.zone` in this phase beyond renaming plasm→obols.

---

### Task 1: Set up vitest

**Files:**
- Modify: `package.json:6-17`
- Create: `vitest.config.ts`
- Create: `src/systems/Economy.test.ts` (sanity test, expanded in Task 2)

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` command running vitest in node environment.

- [ ] **Step 1: Add vitest as a dev dependency**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the test script**

Modify `package.json` scripts block so it reads:
```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create a sanity test at `src/systems/Economy.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('vitest wiring', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test to verify the harness works**

Run: `npm test`
Expected: PASS — 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/systems/Economy.test.ts
git commit -m "chore: add vitest test harness"
```

---

### Task 2: Economy module (pure currency math)

**Files:**
- Create: `src/systems/Economy.ts`
- Test: `src/systems/Economy.test.ts` (replace the sanity test)

**Interfaces:**
- Consumes: `OBOL_TO_ESSENCE_RATE`, `WIPE_OBOL_PENALTY`, `OBOL_REWARDS`, `LEVEL_COST_BASE`, `LEVEL_COST_EXPONENT` from `../types` (added in Task 3 — but define them locally here first, see Step 3 note).
- Produces:
  - `obolsForEncounter(kind: 'normal' | 'boss'): number`
  - `convertObolsToEssence(leftoverObols: number, opts?: { isWipe?: boolean; rate?: number }): number`
  - `essenceCostForLevel(level: number): number`

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `src/systems/Economy.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { obolsForEncounter, convertObolsToEssence, essenceCostForLevel } from './Economy';

describe('obolsForEncounter', () => {
  it('gives the normal-combat weight', () => {
    expect(obolsForEncounter('normal')).toBe(5);
  });
  it('gives the boss weight', () => {
    expect(obolsForEncounter('boss')).toBe(75);
  });
});

describe('convertObolsToEssence', () => {
  it('converts 100% of leftover on a clean exit at the default rate', () => {
    // 100 leftover * 0.5 rate = 50
    expect(convertObolsToEssence(100)).toBe(50);
  });
  it('loses 50% of leftover on a wipe, then converts', () => {
    // 100 -> 50 kept (wipe) * 0.5 rate = 25
    expect(convertObolsToEssence(100, { isWipe: true })).toBe(25);
  });
  it('floors fractional results', () => {
    // 15 * 0.5 = 7.5 -> 7
    expect(convertObolsToEssence(15)).toBe(7);
  });
  it('returns 0 for 0 leftover', () => {
    expect(convertObolsToEssence(0)).toBe(0);
  });
  it('honours an overridden rate (e.g. trait/upgrade boost)', () => {
    // 100 * 0.7 = 70
    expect(convertObolsToEssence(100, { rate: 0.7 })).toBe(70);
  });
});

describe('essenceCostForLevel', () => {
  it('costs 10 to go from level 1 to 2', () => {
    expect(essenceCostForLevel(1)).toBe(10); // floor(10 * 1^1.5)
  });
  it('rises with level', () => {
    expect(essenceCostForLevel(4)).toBe(80); // floor(10 * 4^1.5 = 80)
    expect(essenceCostForLevel(9)).toBe(270); // floor(10 * 9^1.5 = 270)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './Economy'` / functions undefined.

- [ ] **Step 3: Create `src/systems/Economy.ts`**

Note: the constants are defined in `types.ts` in Task 3, but to keep this module self-contained and let its tests pass independently, import them from `../types`. Task 3 must run before the full build; for now, add the constants to `types.ts` as part of this task's Step 3 if they don't yet exist (they are pure additive constants and don't break anything).

First add these constants to `src/types.ts` (near the other `export const` blocks, e.g. after `MIN_HIT_CHANCE`):

```ts
// --- Essence / Obol economy (placeholders for playtest tuning) ---
export const OBOL_REWARDS = { normal: 5, boss: 75 } as const;
export const OBOL_TO_ESSENCE_RATE = 0.5;
export const WIPE_OBOL_PENALTY = 0.5; // fraction of leftover Obols lost on a full wipe
export const LEVEL_COST_BASE = 10;
export const LEVEL_COST_EXPONENT = 1.5;
```

Then create `src/systems/Economy.ts`:

```ts
import {
  OBOL_REWARDS, OBOL_TO_ESSENCE_RATE, WIPE_OBOL_PENALTY,
  LEVEL_COST_BASE, LEVEL_COST_EXPONENT,
} from '../types';

/** Obols awarded for clearing one combat encounter. */
export function obolsForEncounter(kind: 'normal' | 'boss'): number {
  return OBOL_REWARDS[kind];
}

/**
 * Convert a run's leftover (unspent) Obols into permanent Essence.
 * A full wipe loses WIPE_OBOL_PENALTY of the leftover before conversion.
 */
export function convertObolsToEssence(
  leftoverObols: number,
  opts: { isWipe?: boolean; rate?: number } = {},
): number {
  const rate = opts.rate ?? OBOL_TO_ESSENCE_RATE;
  const kept = opts.isWipe ? leftoverObols * (1 - WIPE_OBOL_PENALTY) : leftoverObols;
  return Math.floor(kept * rate);
}

/** Essence cost to raise a creature's permanent level from `level` to `level + 1`. */
export function essenceCostForLevel(level: number): number {
  return Math.floor(LEVEL_COST_BASE * Math.pow(level, LEVEL_COST_EXPONENT));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all Economy tests green.

- [ ] **Step 5: Commit**

```bash
git add src/systems/Economy.ts src/systems/Economy.test.ts src/types.ts
git commit -m "feat: add Economy module (obol->essence conversion, level cost curve)"
```

---

### Task 3: Data model changes in types.ts

**Files:**
- Modify: `src/types.ts` (CreatureInstance, RunState, remove STAR_LONGEVITY)

**Interfaces:**
- Consumes: nothing new.
- Produces: `CreatureInstance` with `permanentLevel: number` and `essenceInvested: number` and NO `longevity`; `RunState.obols` (replacing `plasm`). `STAR_LONGEVITY` removed.

- [ ] **Step 1: Update `CreatureInstance`** — in `src/types.ts`, replace the `longevity: number;` line (currently line 72) inside `CreatureInstance` and add the two new fields. The interface's stat/level region should read:

```ts
  starRating: number;
  currentLevel: number;   // level during the current run (temporary); starts at permanentLevel
  levelCap: number;
  permanentLevel: number; // permanent essence-bought floor; run starts here, not at 1
  essenceInvested: number;// total essence permanently spent on this creature
  abilities: (string | null)[];
```
(Delete the old `longevity: number;` line entirely.)

- [ ] **Step 2: Rename `plasm` in `RunState`** — replace `plasm: number;` (line 127) with:

```ts
  obols: number;
```

- [ ] **Step 3: Remove `STAR_LONGEVITY`** — delete the entire block (lines 140-143):

```ts
export const STAR_LONGEVITY: Record<number, number> = {
  0: 2, 1: 4, 2: 6, 3: 8, 4: 10, 5: 12,
  6: 14, 7: 16, 8: 18, 9: 20, 10: 22, 11: 24, 12: 26,
};
```

- [ ] **Step 4: Typecheck to see the expected breakage**

Run: `npx tsc --noEmit`
Expected: FAIL — errors in `GameState.ts`, `BreedingSystem.ts`, and scenes referencing `longevity`, `STAR_LONGEVITY`, and `plasm`. This is expected; Tasks 4–7 fix them. Do NOT commit yet (build is red).

- [ ] **Step 5: Commit the type changes anyway (WIP marker)**

The type changes are a coherent unit even though downstream isn't fixed. Commit so the next tasks have a clean base:
```bash
git add src/types.ts
git commit -m "feat: add permanentLevel/essenceInvested, rename plasm->obols, drop longevity type"
```

---

### Task 4: GameState currency + leveling rework

**Files:**
- Modify: `src/managers/GameState.ts`
- Test: `src/managers/GameState.test.ts` (create)

**Interfaces:**
- Consumes: `convertObolsToEssence`, `essenceCostForLevel` from `../systems/Economy`; the Task 3 types.
- Produces on the `gameState` singleton:
  - field `essence: number` (replaces `townResources`; `breedingStones` removed)
  - `createCreatureInstance(speciesId, starRating?)` sets `permanentLevel = 1`, `essenceInvested = 0`, `currentLevel = 1`, no longevity
  - `startRun()` sets each party creature's `currentLevel = permanentLevel` (no longevity tick)
  - `endRun(success: boolean, leftoverObols: number)` converts leftover Obols → Essence (wipe when `!success`) and adds to `essence`
  - `spendEssenceOnLevel(instance): boolean` — buys one permanent level using the cost curve

- [ ] **Step 1: Write failing tests** — create `src/managers/GameState.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { gameState } from './GameState';

beforeEach(() => {
  gameState.initializeNewGame(['ironjaw', 'stoneguard', 'voltarc']);
});

describe('createCreatureInstance', () => {
  it('starts at permanent level 1 with no essence invested and no longevity', () => {
    const c = gameState.createCreatureInstance('ironjaw', 0);
    expect(c.permanentLevel).toBe(1);
    expect(c.currentLevel).toBe(1);
    expect(c.essenceInvested).toBe(0);
    expect('longevity' in c).toBe(false);
  });
});

describe('startRun', () => {
  it('starts creatures at their permanent level floor, not 1', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 8;
    gameState.setRunParty([c.instanceId]);
    gameState.startRun();
    expect(gameState.runParty[0].currentLevel).toBe(8);
  });
});

describe('endRun obol conversion', () => {
  it('converts 100% of leftover obols to essence on success', () => {
    gameState.essence = 0;
    gameState.setRunParty([gameState.creatureBox[0].instanceId]);
    gameState.startRun();
    gameState.currentRun = null; // no captures
    gameState.endRun(true, 100); // 100 * 0.5 = 50
    expect(gameState.essence).toBe(50);
  });
  it('halves leftover obols on a wipe before converting', () => {
    gameState.essence = 0;
    gameState.setRunParty([gameState.creatureBox[0].instanceId]);
    gameState.startRun();
    gameState.currentRun = null;
    gameState.endRun(false, 100); // 100 -> 50 -> *0.5 = 25
    expect(gameState.essence).toBe(25);
  });
});

describe('spendEssenceOnLevel', () => {
  it('buys a permanent level when affordable and deducts essence', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 1;
    c.essenceInvested = 0;
    gameState.essence = 100;
    const ok = gameState.spendEssenceOnLevel(c);
    expect(ok).toBe(true);
    expect(c.permanentLevel).toBe(2);
    expect(gameState.essence).toBe(90); // cost 10
    expect(c.essenceInvested).toBe(10);
  });
  it('refuses when essence is insufficient', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = 5;
    gameState.essence = 1; // cost floor(10*5^1.5)=111
    const ok = gameState.spendEssenceOnLevel(c);
    expect(ok).toBe(false);
    expect(c.permanentLevel).toBe(5);
    expect(gameState.essence).toBe(1);
  });
  it('refuses at the level cap', () => {
    const c = gameState.creatureBox[0];
    c.permanentLevel = c.levelCap;
    gameState.essence = 100000;
    const ok = gameState.spendEssenceOnLevel(c);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/managers/GameState.test.ts`
Expected: FAIL — `essence`/`spendEssenceOnLevel` undefined, `endRun` signature mismatch.

- [ ] **Step 3: Rework `GameState.ts`** — apply these edits:

Replace the imports (lines 1-5):
```ts
import {
  CreatureInstance, RunState, BaseStats,
  STAR_LEVEL_CAPS, generateId,
} from '../types';
import { getTemplate } from '../data/creatures';
import { convertObolsToEssence, essenceCostForLevel } from '../systems/Economy';
```

Replace the fields block (lines 8-13):
```ts
  creatureBox: CreatureInstance[] = [];
  runParty: CreatureInstance[] = [];
  essence = 0;
  currentRun: RunState | null = null;
  hasCompletedFirstRun = false;
```

Replace `createCreatureInstance` body's derived lines and the returned object's level/longevity fields (lines 15-42). The new method:
```ts
  createCreatureInstance(speciesId: string, starRating = 0): CreatureInstance {
    const template = getTemplate(speciesId);
    const levelCap = STAR_LEVEL_CAPS[starRating] ?? 5;
    return {
      instanceId: generateId(),
      speciesId,
      nickname: null,
      starRating,
      currentLevel: 1,
      levelCap,
      permanentLevel: 1,
      essenceInvested: 0,
      abilities: [...template.defaultAbilities, null, null].slice(0, 4),
      traitSlots: [
        { traitId: null, traitLevel: 0, unlocked: false },
        { traitId: null, traitLevel: 0, unlocked: false },
        { traitId: null, traitLevel: 0, unlocked: false },
        { traitId: null, traitLevel: 0, unlocked: false },
      ],
      lineage: { parentA: null, parentB: null },
      currentStats: { ...template.baseStats },
      resistances: [...template.resistances],
      weaknesses: [...template.weaknesses],
      isRetired: false,
      isBreedReady: false,
      xp: 0,
    };
  }
```

Replace `startRun` (lines 97-107):
```ts
  startRun(): void {
    for (const c of this.runParty) {
      // Start each run at the permanent essence-bought floor, not level 1
      c.currentLevel = c.permanentLevel;
      c.xp = 0;
      c.isBreedReady = false;
      c.currentStats = this.calculateStatsForLevel(c);
    }
  }
```

Replace `endRun` (lines 109-131):
```ts
  endRun(success: boolean, leftoverObols: number): void {
    // Convert leftover (unspent) Obols to permanent Essence. A wipe (!success) loses half first.
    this.essence += convertObolsToEssence(leftoverObols, { isWipe: !success });
    // Reset in-run temporary level back down to the permanent floor for box storage
    for (const c of this.runParty) {
      c.currentLevel = c.permanentLevel;
      c.xp = 0;
      c.currentStats = this.calculateStatsForLevel(c);
    }
    if (this.currentRun) {
      for (const captured of this.currentRun.capturedCreatures) {
        if (success) this.addToBox(captured);
      }
    }
    this.currentRun = null;
  }
```

Add a new method `spendEssenceOnLevel` immediately after `tryLevelUp` (after line 75):
```ts
  /** Spend Essence to raise a creature's permanent level floor by one. Returns false if unaffordable or capped. */
  spendEssenceOnLevel(instance: CreatureInstance): boolean {
    if (instance.permanentLevel >= instance.levelCap) return false;
    const cost = essenceCostForLevel(instance.permanentLevel);
    if (this.essence < cost) return false;
    this.essence -= cost;
    instance.essenceInvested += cost;
    instance.permanentLevel++;
    instance.currentLevel = instance.permanentLevel;
    instance.currentStats = this.calculateStatsForLevel(instance);
    return true;
  }
```

Replace `initializeNewGame` (lines 133-141):
```ts
  initializeNewGame(starterIds: string[]): void {
    this.creatureBox = [];
    for (const id of starterIds) {
      this.addToBox(this.createCreatureInstance(id, 0));
    }
    this.essence = 0;
    this.hasCompletedFirstRun = false;
  }
```

(Save/load is Task 5 — leave `saveToLocalStorage`/`loadFromLocalStorage` for now; they will still reference `townResources`, so the build stays red until Task 5. Tests in this task don't touch save/load.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/managers/GameState.test.ts`
Expected: PASS — all GameState logic tests green.

- [ ] **Step 5: Commit**

```bash
git add src/managers/GameState.ts src/managers/GameState.test.ts
git commit -m "feat: essence currency, permanent-level start, obol conversion on endRun"
```

---

### Task 5: Save/load migration

**Files:**
- Modify: `src/managers/GameState.ts` (`saveToLocalStorage`, `loadFromLocalStorage`)
- Test: `src/managers/GameState.test.ts` (append migration tests)

**Interfaces:**
- Consumes: Task 4 GameState.
- Produces: save payload `{ creatureBox, essence, hasCompletedFirstRun }`; loader that migrates old saves (maps `townResources`→`essence`, drops `plasm`/`breedingStones`/`longevity`, backfills `permanentLevel`/`essenceInvested`).

- [ ] **Step 1: Append failing tests** to `src/managers/GameState.test.ts`:

```ts
describe('save/load migration', () => {
  it('round-trips the new save shape', () => {
    gameState.essence = 42;
    gameState.hasCompletedFirstRun = true;
    gameState.saveToLocalStorage();
    gameState.essence = 0;
    gameState.hasCompletedFirstRun = false;
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.essence).toBe(42);
    expect(gameState.hasCompletedFirstRun).toBe(true);
  });

  it('migrates an old save (townResources->essence, backfills fields, drops longevity)', () => {
    const oldSave = {
      creatureBox: [{
        instanceId: 'old1', speciesId: 'ironjaw', nickname: null, starRating: 0,
        currentLevel: 1, levelCap: 5, longevity: 2,
        abilities: ['tackle', null, null, null],
        traitSlots: [{ traitId: null, traitLevel: 0, unlocked: false }],
        lineage: { parentA: null, parentB: null },
        currentStats: { hp: 30, mp: 5, str: 10, def: 8, wis: 5, spd: 7, int: 4 },
        resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
      }],
      townResources: 90,
      breedingStones: 3,
      hasCompletedFirstRun: true,
    };
    localStorage.setItem('hollow_kin_save', JSON.stringify(oldSave));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.essence).toBe(90);            // townResources -> essence
    const c = gameState.creatureBox[0];
    expect(c.permanentLevel).toBe(1);              // backfilled
    expect(c.essenceInvested).toBe(0);             // backfilled
    expect('longevity' in c).toBe(false);          // dropped
  });
});
```

Note: vitest's `node` environment has no `localStorage`. Add a minimal polyfill at the TOP of `src/managers/GameState.test.ts` (above the imports):

```ts
import { beforeAll } from 'vitest';
beforeAll(() => {
  if (typeof (globalThis as any).localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    };
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/managers/GameState.test.ts`
Expected: FAIL — loader still reads `townResources`/`breedingStones`, does not backfill.

- [ ] **Step 3: Rewrite save/load** in `src/managers/GameState.ts` (replace lines 143-166):

```ts
  saveToLocalStorage(): void {
    const data = {
      version: 2,
      creatureBox: this.creatureBox,
      essence: this.essence,
      hasCompletedFirstRun: this.hasCompletedFirstRun,
    };
    localStorage.setItem('hollow_kin_save', JSON.stringify(data));
  }

  loadFromLocalStorage(): boolean {
    const raw = localStorage.getItem('hollow_kin_save');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      // Essence: new field, else migrate old townResources, else 0
      this.essence = data.essence ?? data.townResources ?? 0;
      this.hasCompletedFirstRun = data.hasCompletedFirstRun ?? false;
      this.creatureBox = (data.creatureBox ?? []).map((c: any) => {
        const { longevity, ...rest } = c; // drop longevity if present
        return {
          ...rest,
          permanentLevel: c.permanentLevel ?? 1,
          essenceInvested: c.essenceInvested ?? 0,
        } as CreatureInstance;
      });
      return true;
    } catch {
      return false;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/managers/GameState.test.ts`
Expected: PASS — round-trip and migration tests green.

- [ ] **Step 5: Commit**

```bash
git add src/managers/GameState.ts src/managers/GameState.test.ts
git commit -m "feat: essence save format + migration from old townResources saves"
```

---

### Task 6: BreedingSystem compile-fix

**Files:**
- Modify: `src/systems/BreedingSystem.ts:1,39,57`

**Interfaces:**
- Consumes: Task 3 types.
- Produces: `breed()` output creatures with `permanentLevel: 1`, `essenceInvested: 0`, no `longevity`. (Full essence carry-over math is Phase 4 — Phase 1 just keeps it compiling with sane defaults.)

- [ ] **Step 1: Remove the STAR_LONGEVITY import** — change line 1:

```ts
import { CreatureInstance, STAR_LEVEL_CAPS, generateId, BaseStats } from '../types';
```

- [ ] **Step 2: Remove the longevity derivation** — delete line 39 (`const longevity = STAR_LONGEVITY[starRating] ?? 2;`).

- [ ] **Step 3: Fix the returned instance fields** — replace the `longevity,` line (line 57) in the returned object with:

```ts
    permanentLevel: 1,
    essenceInvested: 0,
```

- [ ] **Step 4: Typecheck this file compiles**

Run: `npx tsc --noEmit`
Expected: `BreedingSystem.ts` errors gone (scene errors remain until Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/systems/BreedingSystem.ts
git commit -m "fix: breeding output uses permanentLevel/essenceInvested, drop longevity"
```

---

### Task 7: Scene compile-fixes (green build)

**Files:**
- Modify: `src/scenes/RunScene.ts:22,52,147,176`
- Modify: `src/scenes/ShopScene.ts:18,30,37`
- Modify: `src/scenes/CombatScene.ts:7,73,335-338,357,445`
- Modify: `src/scenes/PartySelectScene.ts:28,56-57`
- Modify: `src/scenes/BreedingScene.ts:63,215`
- Modify: `src/scenes/TownScene.ts:21,37,41,68-69`

**Interfaces:**
- Consumes: Tasks 3–5 (obols/essence/permanentLevel; `endRun(success, leftoverObols)`).
- Produces: a fully compiling, runnable game on the (still zone-based) tower, using Obols in-run and Essence in town. No new UI — display-level swaps only.

- [ ] **Step 1: RunScene — plasm→obols**
  - Line 22: in the `RunState` initializer, change `plasm: 0,` → `obols: 0,`.
  - Line 52: change the label to `` `Obols: ${run.obols}` ``.
  - Line 147: change `run.plasm += 15;` → `run.obols += 15;`.
  - Line 176: change `` `Plasm Earned: ${run.plasm}` `` → `` `Obols Earned: ${run.obols}` ``.
  - Find where RunScene calls `gameState.endRun(...)` (search `endRun` in this file). Update the call to pass the run's leftover obols: `gameState.endRun(success, run.obols);` (use the existing success/failure boolean in scope; if the call currently passes only a boolean, add `, run.obols`).

- [ ] **Step 2: ShopScene — plasm→obols**
  - Line 18: `` `Obols: ${run.obols}` ``.
  - Line 30: `const canAfford = run.obols >= item.cost;`.
  - Line 37: `run.obols -= item.cost;`.

- [ ] **Step 3: CombatScene — plasm→obols, drop longevity/townResources**
  - Line 7: remove `STAR_LONGEVITY` from the import list (keep `generateId, STAR_LEVEL_CAPS`).
  - Add a new import near the top of the file (with the other `import` statements): `import { obolsForEncounter } from '../systems/Economy';`
  - Line 73: in the enemy instance literal, delete the `longevity: 0,` line and add `permanentLevel: 1,` and `essenceInvested: 0,`.
  - Lines 335-338: replace the plasm award block with:
    ```ts
    // Award XP and obols
    const obolGain = obolsForEncounter(this.encounter.type === 'boss' ? 'boss' : 'normal');
    run.obols += obolGain;
    ```
  - Line 357: change the rewards string `` `+${plasmGain} Plasm ...` `` → `` `+${obolGain} Obols  |  +${xpPerCreature} XP each` ``.
  - Line 445: remove `gameState.townResources += resourceGain;` (mid-run resource gain no longer flows to town; Obols are the in-run currency and already awarded above). Delete that line and any now-unused `resourceGain` variable it referenced.

- [ ] **Step 4: PartySelectScene — drop longevity**
  - Line 28: change the filter to `const available = gameState.creatureBox.filter(c => !c.isRetired);`.
  - Lines 56-57: replace the longevity label with a permanent-level label:
    ```ts
    this.add.text(x - 45, y + 58, `Lv ${creature.permanentLevel}`, {
      fontSize: '10px', color: '#44ff44', fontFamily: 'monospace',
    });
    ```

- [ ] **Step 5: BreedingScene — drop longevity**
  - Line 63: change `` `${template.archetype} | L:${creature.longevity}` `` → `` `${template.archetype} | Lv ${creature.permanentLevel}` ``.
  - Line 215: change `` `Level Cap: ${offspring.levelCap} | Longevity: ${offspring.longevity}` `` → `` `Level Cap: ${offspring.levelCap}` ``.

- [ ] **Step 6: TownScene — essence display, drop longevity/stones**
  - Line 21: change to `` `Essence: ${gameState.essence}` ``.
  - Lines 37 & 41: remove the `lonColor` longevity-color logic and the `L:${creature.longevity}` portion; the label becomes `` `★${creature.starRating} Lv ${creature.permanentLevel}` `` with a static color (e.g. `'#ffffff'`).
  - Lines 68-69: delete the low-longevity warning block (`const urgent = activeCreatures.filter(c => c.longevity <= 1);` and whatever renders it).

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS — no type errors, Vite build succeeds.

- [ ] **Step 8: Full test suite**

Run: `npm test`
Expected: PASS — all Economy + GameState tests green.

- [ ] **Step 9: Manual playtest smoke check**

Run: `npm run dev`, open the app, and verify the loop:
1. New game → pick a trio.
2. Start a run → win a combat → see "Obols" (not Plasm) increase.
3. Finish/exit the run → return to town → see "Essence" increased (converted from leftover Obols).
4. No "Longevity" or "Stones" text anywhere; party-select shows creatures without a longevity gate.

- [ ] **Step 10: Commit**

```bash
git add src/scenes/
git commit -m "fix: scenes use obols in-run and essence in town; drop longevity/plasm/stones UI"
```

---

## Phase 1 Done — Not Yet in This Phase

Deferred to later phases (do NOT attempt here):
- **Phase 2:** one continuous 30-floor descent, mini/major boss cadence, depth-jumps, removing `Encounter.zone`.
- **Phase 3:** town essence-hub vendor scenes (Leveler, Trait-keeper, Mark-binder, Gatekeeper, Quartermaster, Breeder) with real spend UI wired to `spendEssenceOnLevel` and friends.
- **Phase 4:** breeding essence carry-over math, traits→essence thresholds, marks earn-then-lock permanence, conversion-rate levers (Essence Distiller trait, Quartermaster upgrades, depth).
