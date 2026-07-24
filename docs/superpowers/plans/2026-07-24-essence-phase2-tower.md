# Essence Pivot — Phase 2: One Continuous 30-Floor Descent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-zones-of-15 tower with a single continuous 30-floor descent — mini-boss every 5 floors, major-boss every 10, boss-tier Obol rewards, absolute-floor enemy scaling, and GameState tracking of the deepest cleared 5-floor break (so Phase 3's Gatekeeper can sell depth-jumps).

**Architecture:** `RunGenerator` gains `generateDescent(startFloor)` producing a flat 30-floor `Encounter[]` and a reworked `generatePickNextChoices` that forces bosses and pre-boss rests. `Economy` extends Obol rewards to mini/major boss tiers. `GameState` tracks `deepestBreakCleared` (persisted). `types.ts` swaps zone fields for floor fields. `CombatScene`/`RunScene` render floors instead of zones. Depth-jump PURCHASE UI is deferred to Phase 3 — this phase only builds the generator support (`startFloor`) and the tracking data.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest (already set up in Phase 1).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md` (section 8) and `tower-structure.md`.
- **30-floor continuous descent, no zones.** `TOWER_FLOORS = 30`.
- **Mini-boss on floors 5, 15, 25; major-boss on floors 10, 20, 30.** Rule: a floor is a boss iff `floor % 5 === 0`; it is major iff `floor % 10 === 0`, else mini. Floor 30 (major) is the final boss — clearing it = tower cleared.
- **First floor of a run (the start floor) is always combat. The floor immediately before any boss floor is always rest.**
- **Depth bands for enemy pools:** floors 1–10 → `ZONE_CREATURE_POOLS[1]`, 11–20 → `[2]`, 21–30 → `[3]`. (Reuse the existing pools by band; do not rename the export in this phase.)
- **Obol rewards (placeholders):** normal combat 5, mini-boss 25, major-boss 75.
- **Enemy levels scale by absolute floor** (placeholder formula given per task).
- **Depth-jumps:** `generateDescent(startFloor)` supports starting at any floor; `GameState.deepestBreakCleared` records the deepest 5-floor break boss defeated. The purchase UI (Gatekeeper) is **Phase 3** — in this phase, runs always start at floor 1.
- All numbers are playtest-tunable placeholders.
- Do NOT build: town vendor UI, breeding carry-over, traits/marks work (Phases 3–4).

---

### Task 1: Economy — boss-tier Obol rewards

**Files:**
- Modify: `src/types.ts` (OBOL_REWARDS)
- Modify: `src/systems/Economy.ts` (obolsForEncounter)
- Test: `src/systems/Economy.test.ts`

**Interfaces:**
- Produces: `obolsForEncounter(kind: 'normal' | 'mini' | 'major'): number`; `OBOL_REWARDS = { normal: 5, mini: 25, major: 75 }`.

- [ ] **Step 1: Update the failing tests** — in `src/systems/Economy.test.ts`, replace the existing `describe('obolsForEncounter', ...)` block with:

```ts
describe('obolsForEncounter', () => {
  it('gives the normal-combat weight', () => {
    expect(obolsForEncounter('normal')).toBe(5);
  });
  it('gives the mini-boss weight', () => {
    expect(obolsForEncounter('mini')).toBe(25);
  });
  it('gives the major-boss weight', () => {
    expect(obolsForEncounter('major')).toBe(75);
  });
});
```

- [ ] **Step 2: Run tests to verify the mini/major cases fail**

Run: `npm test src/systems/Economy.test.ts`
Expected: FAIL — `'mini'`/`'major'` not assignable / undefined lookups.

- [ ] **Step 3: Update the constant and function.**

In `src/types.ts`, change `OBOL_REWARDS`:
```ts
export const OBOL_REWARDS = { normal: 5, mini: 25, major: 75 } as const;
```

In `src/systems/Economy.ts`, change the signature:
```ts
export function obolsForEncounter(kind: 'normal' | 'mini' | 'major'): number {
  return OBOL_REWARDS[kind];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/systems/Economy.test.ts`
Expected: PASS. (`convertObolsToEssence`/`essenceCostForLevel` tests unaffected.)

Note: `CombatScene.ts` currently calls `obolsForEncounter(this.encounter.type === 'boss' ? 'boss' : 'normal')` — passing `'boss'`, which no longer exists. This makes the full `tsc` red until Task 5 fixes it. That is expected. `npm test` still passes.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/systems/Economy.ts src/systems/Economy.test.ts
git commit -m "feat: obol rewards support mini/major boss tiers"
```

---

### Task 2: types.ts — descent data model

**Files:**
- Modify: `src/types.ts` (Encounter, RunState, add constants)

**Interfaces:**
- Produces: `Encounter` with `floor: number` (replacing `zone`) and optional `bossTier?: 'mini' | 'major'`; `RunState` with `startFloor: number` (replacing `currentZone`); constants `TOWER_FLOORS`, and helpers `isBossFloor`/`bossTierForFloor`.

- [ ] **Step 1: Update `Encounter`** — replace the interface (currently lines ~114-120):

```ts
export interface Encounter {
  type: EncounterType;
  enemies?: string[];      // creature template IDs for combat encounters
  enemyLevels?: number;    // level for enemies in this encounter
  floor: number;           // absolute tower floor (1..TOWER_FLOORS)
  index: number;           // position within the current run's encounter list
  bossTier?: 'mini' | 'major'; // set on boss encounters
}
```

- [ ] **Step 2: Update `RunState`** — replace `currentZone: number;` with `startFloor: number;`. The interface becomes:

```ts
export interface RunState {
  startFloor: number;         // floor this run began on (1 unless a depth-jump was bought)
  currentEncounterIndex: number;
  encounters: Encounter[];
  choices: Encounter[];       // current pick-next choices
  obols: number;
  capturedCreatures: CreatureInstance[];
  partyHp: Record<string, number>;
  partyMp: Record<string, number>;
  partyKO: Record<string, boolean>;
  xpEarned: number;
}
```

- [ ] **Step 3: Add tower constants + helpers** — add near the other `export const` blocks (e.g. after `OBOL_REWARDS`):

```ts
export const TOWER_FLOORS = 30;

/** A floor is a boss floor iff it is a multiple of 5. */
export function isBossFloor(floor: number): boolean {
  return floor % 5 === 0;
}

/** Boss tier for a boss floor: multiples of 10 are major, other multiples of 5 are mini. */
export function bossTierForFloor(floor: number): 'mini' | 'major' {
  return floor % 10 === 0 ? 'major' : 'mini';
}
```

- [ ] **Step 4: Typecheck — expect downstream red**

Run: `npx tsc --noEmit`
Expected: FAIL only in `RunGenerator.ts`, `RunScene.ts`, `CombatScene.ts` (they use `zone`/`currentZone`). No error inside `types.ts`. `npm test` still passes.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat: Encounter.floor + bossTier, RunState.startFloor, tower constants"
```

---

### Task 3: RunGenerator — generateDescent + pick-next rework

**Files:**
- Modify: `src/systems/RunGenerator.ts` (replace `generateZoneEncounters` with `generateDescent`; rework `generatePickNextChoices`)
- Test: `src/systems/RunGenerator.test.ts` (create)

**Interfaces:**
- Consumes: `Encounter`, `EncounterType`, `TOWER_FLOORS`, `isBossFloor`, `bossTierForFloor` from `../types`; `ZONE_CREATURE_POOLS` from `../data/creatures`.
- Produces:
  - `generateDescent(startFloor?: number): Encounter[]` — one encounter per floor from `startFloor` (default 1) through `TOWER_FLOORS`, indices 0-based within the array.
  - `generatePickNextChoices(encounters: Encounter[], currentIndex: number): Encounter[]` — forces bosses and pre-boss rests; otherwise offers 2–3 choices that never skip past a boss.
  - `poolForFloor(floor: number): string[]` (helper, exported for tests).

- [ ] **Step 1: Write the failing tests** — create `src/systems/RunGenerator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateDescent, generatePickNextChoices, poolForFloor } from './RunGenerator';
import { TOWER_FLOORS } from '../types';

describe('poolForFloor', () => {
  it('maps floors to depth bands 1-3', () => {
    expect(poolForFloor(1)).toEqual(poolForFloor(10));   // band 1
    expect(poolForFloor(11)).toEqual(poolForFloor(20));  // band 2
    expect(poolForFloor(21)).toEqual(poolForFloor(30));  // band 3
    expect(poolForFloor(1)).not.toEqual(poolForFloor(21));
  });
});

describe('generateDescent', () => {
  it('produces one encounter per floor from 1 to 30 by default', () => {
    const d = generateDescent();
    expect(d).toHaveLength(TOWER_FLOORS);
    expect(d[0].floor).toBe(1);
    expect(d[d.length - 1].floor).toBe(30);
    d.forEach((e, i) => expect(e.index).toBe(i));
  });

  it('places mini bosses on 5/15/25 and majors on 10/20/30', () => {
    const d = generateDescent();
    const byFloor = (f: number) => d.find(e => e.floor === f)!;
    for (const f of [5, 15, 25]) {
      expect(byFloor(f).type).toBe('boss');
      expect(byFloor(f).bossTier).toBe('mini');
    }
    for (const f of [10, 20, 30]) {
      expect(byFloor(f).type).toBe('boss');
      expect(byFloor(f).bossTier).toBe('major');
    }
  });

  it('makes the first floor combat and the pre-boss floor rest', () => {
    const d = generateDescent();
    expect(d[0].type).toBe('combat');
    for (const f of [4, 9, 14, 19, 24, 29]) {
      expect(d.find(e => e.floor === f)!.type).toBe('rest');
    }
  });

  it('supports a depth-jump start floor', () => {
    const d = generateDescent(11);
    expect(d[0].floor).toBe(11);
    expect(d[0].type).toBe('combat');
    expect(d[d.length - 1].floor).toBe(30);
    expect(d).toHaveLength(20);
  });

  it('gives every combat/boss enemies and a positive level', () => {
    const d = generateDescent();
    for (const e of d) {
      if (e.type === 'combat' || e.type === 'boss') {
        expect((e.enemies?.length ?? 0)).toBeGreaterThan(0);
        expect(e.enemyLevels!).toBeGreaterThan(0);
      }
    }
  });
});

describe('generatePickNextChoices', () => {
  it('forces the next boss when it is the immediate next encounter', () => {
    const d = generateDescent();
    const bossIdx = d.findIndex(e => e.type === 'boss'); // floor 5, index 4
    const choices = generatePickNextChoices(d, bossIdx - 1);
    expect(choices).toHaveLength(1);
    expect(choices[0].type).toBe('boss');
  });

  it('never offers a choice that skips past a boss', () => {
    const d = generateDescent();
    const choices = generatePickNextChoices(d, -1); // start of run
    const firstBossIdx = d.findIndex(e => e.type === 'boss');
    for (const c of choices) {
      expect(c.index).toBeLessThan(firstBossIdx);
    }
  });

  it('returns the first combat with no real choice at run start', () => {
    const d = generateDescent();
    const choices = generatePickNextChoices(d, -1);
    expect(choices.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty when the run is complete', () => {
    const d = generateDescent();
    expect(generatePickNextChoices(d, d.length - 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/systems/RunGenerator.test.ts`
Expected: FAIL — `generateDescent`/`poolForFloor` not exported.

- [ ] **Step 3: Rewrite `src/systems/RunGenerator.ts`** with this full content:

```ts
import { Encounter, EncounterType, TOWER_FLOORS, isBossFloor, bossTierForFloor } from '../types';
import { ZONE_CREATURE_POOLS } from '../data/creatures';

/** Depth band pool: floors 1-10 -> band 1, 11-20 -> band 2, 21-30 -> band 3. */
export function poolForFloor(floor: number): string[] {
  const band = Math.min(3, Math.floor((floor - 1) / 10) + 1);
  return ZONE_CREATURE_POOLS[band] ?? ZONE_CREATURE_POOLS[1];
}

/** Non-boss, non-forced filler encounter type. */
function fillerType(): EncounterType {
  // Weighted mix: mostly combat, some shop/event. (Rests are only the forced pre-boss ones.)
  const r = Math.random();
  if (r < 0.6) return 'combat';
  if (r < 0.8) return 'shop';
  return 'event';
}

function makeEncounter(type: EncounterType, floor: number, index: number): Encounter {
  const e: Encounter = { type, floor, index };
  if (type === 'boss') {
    e.bossTier = bossTierForFloor(floor);
    const pool = poolForFloor(floor);
    e.enemies = e.bossTier === 'major' ? [pool[0], pool[1], pool[2] ?? pool[0]] : [pool[0], pool[1]];
    e.enemyLevels = Math.floor(floor * (e.bossTier === 'major' ? 1.2 : 1.0)) + 2;
  } else if (type === 'combat') {
    const pool = poolForFloor(floor);
    const isEarly = floor <= 3;
    const enemyCount = isEarly ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
    e.enemies = [];
    for (let i = 0; i < enemyCount; i++) {
      e.enemies.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    e.enemyLevels = Math.max(1, Math.floor(floor * 0.8));
  }
  return e;
}

/**
 * Build the tower descent from `startFloor` (default 1) through TOWER_FLOORS.
 * One encounter per floor. First floor = combat; floor before any boss = rest;
 * boss floors (multiples of 5) are mini/major; the rest are combat/shop/event.
 */
export function generateDescent(startFloor = 1): Encounter[] {
  const encounters: Encounter[] = [];
  let index = 0;
  for (let floor = startFloor; floor <= TOWER_FLOORS; floor++) {
    let type: EncounterType;
    if (isBossFloor(floor)) {
      type = 'boss';
    } else if (floor === startFloor) {
      type = 'combat';                 // first floor of the run is always combat
    } else if (isBossFloor(floor + 1)) {
      type = 'rest';                   // floor immediately before a boss is rest
    } else {
      type = fillerType();
    }
    encounters.push(makeEncounter(type, floor, index));
    index++;
  }
  return encounters;
}

/**
 * Pick-next choices on the linear descent. Bosses and pre-boss rests are forced
 * (returned alone). Otherwise offer 2-3 encounters strictly before the next boss —
 * so a choice can never skip past a boss floor.
 */
export function generatePickNextChoices(encounters: Encounter[], currentIndex: number): Encounter[] {
  const remaining = encounters.filter((_, i) => i > currentIndex);
  if (remaining.length === 0) return [];

  // First encounter of the run is forced (generateDescent guarantees it is combat).
  if (currentIndex === -1) return [remaining[0]];

  const next = remaining[0];

  // Forced: the immediate next encounter is a boss, or a rest sitting right before a boss.
  if (next.type === 'boss') return [next];
  if (next.type === 'rest' && remaining[1]?.type === 'boss') return [next];

  // Barrier: cannot choose anything at or beyond the next boss.
  const nextBossPos = remaining.findIndex(e => e.type === 'boss');
  const selectable = nextBossPos === -1 ? remaining : remaining.slice(0, nextBossPos);
  const beforeForcedRest = selectable.filter(
    (e, i) => !(e.type === 'rest' && selectable[i + 1]?.type === 'boss'),
  );
  const candidates = beforeForcedRest.length > 0 ? beforeForcedRest : selectable;

  if (candidates.length <= 1) return candidates;

  const count = Math.min(candidates.length, 2 + (Math.random() < 0.4 ? 1 : 0));
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/systems/RunGenerator.test.ts`
Expected: PASS — all descent + pick-next tests green.

- [ ] **Step 5: Commit**

```bash
git add src/systems/RunGenerator.ts src/systems/RunGenerator.test.ts
git commit -m "feat: 30-floor descent generator + boss-aware pick-next"
```

---

### Task 4: GameState — deepest-break tracking

**Files:**
- Modify: `src/managers/GameState.ts`
- Test: `src/managers/GameState.test.ts` (append)

**Interfaces:**
- Produces on `gameState`: field `deepestBreakCleared: number` (0 initially); `recordBreakCleared(floor: number): void` (raises the max only for boss floors); `unlockedStartFloors(): number[]` (floor 1 plus the floor after each cleared break). Save payload includes `deepestBreakCleared`; loader backfills `?? 0`.

- [ ] **Step 1: Append failing tests** to `src/managers/GameState.test.ts`:

```ts
describe('deepest-break tracking', () => {
  it('starts at 0 and only records boss floors, keeping the max', () => {
    expect(gameState.deepestBreakCleared).toBe(0);
    gameState.recordBreakCleared(5);
    expect(gameState.deepestBreakCleared).toBe(5);
    gameState.recordBreakCleared(10);
    expect(gameState.deepestBreakCleared).toBe(10);
    gameState.recordBreakCleared(5); // lower — ignored
    expect(gameState.deepestBreakCleared).toBe(10);
  });

  it('ignores non-boss floors', () => {
    gameState.recordBreakCleared(7);
    expect(gameState.deepestBreakCleared).toBe(0);
  });

  it('unlockedStartFloors returns floor 1 plus the floor after each cleared break', () => {
    expect(gameState.unlockedStartFloors()).toEqual([1]);
    gameState.recordBreakCleared(10);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6, 11]);
  });

  it('persists deepestBreakCleared across save/load', () => {
    gameState.recordBreakCleared(15);
    gameState.saveToLocalStorage();
    gameState.deepestBreakCleared = 0;
    gameState.loadFromLocalStorage();
    expect(gameState.deepestBreakCleared).toBe(15);
  });

  it('defaults deepestBreakCleared to 0 when loading an older save', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 2, creatureBox: [], essence: 5, hasCompletedFirstRun: true,
    }));
    gameState.loadFromLocalStorage();
    expect(gameState.deepestBreakCleared).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/managers/GameState.test.ts`
Expected: FAIL — `deepestBreakCleared`/`recordBreakCleared`/`unlockedStartFloors` undefined.

- [ ] **Step 3: Implement in `src/managers/GameState.ts`.**

Add the import for `isBossFloor`:
```ts
import {
  CreatureInstance, RunState, BaseStats,
  STAR_LEVEL_CAPS, generateId, isBossFloor,
} from '../types';
```

Add the field alongside `essence`:
```ts
  essence = 0;
  deepestBreakCleared = 0;
```

Add the two methods (e.g. after `spendEssenceOnLevel`):
```ts
  /** Record clearing a boss on `floor`. Only boss floors count; keeps the running max. */
  recordBreakCleared(floor: number): void {
    if (!isBossFloor(floor)) return;
    if (floor > this.deepestBreakCleared) this.deepestBreakCleared = floor;
  }

  /** Floors a run may start on: floor 1, plus the floor after each cleared 5-floor break. */
  unlockedStartFloors(): number[] {
    const floors = [1];
    for (let f = 5; f <= this.deepestBreakCleared; f += 5) floors.push(f + 1);
    return floors;
  }
```

Update `initializeNewGame` to reset it (add after `this.essence = 0;`):
```ts
    this.deepestBreakCleared = 0;
```

Update `saveToLocalStorage` data object to include it:
```ts
    const data = {
      version: 2,
      creatureBox: this.creatureBox,
      essence: this.essence,
      deepestBreakCleared: this.deepestBreakCleared,
      hasCompletedFirstRun: this.hasCompletedFirstRun,
    };
```

Update `loadFromLocalStorage` to backfill it (add alongside the other assignments):
```ts
      this.deepestBreakCleared = data.deepestBreakCleared ?? 0;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/managers/GameState.test.ts`
Expected: PASS — all break-tracking + prior GameState tests green.

- [ ] **Step 5: Commit**

```bash
git add src/managers/GameState.ts src/managers/GameState.test.ts
git commit -m "feat: track deepest cleared break + unlocked start floors (persisted)"
```

---

### Task 5: CombatScene — boss-tier rewards + record break clear

**Files:**
- Modify: `src/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `obolsForEncounter('normal'|'mini'|'major')`, `Encounter.floor`/`bossTier`, `gameState.recordBreakCleared`.

- [ ] **Step 1: Fix the Obol award to use boss tier.** Find the victory-reward code that calls `obolsForEncounter(...)` (Phase 1 left it as `this.encounter.type === 'boss' ? 'boss' : 'normal'`). Replace with a tier-aware version:

```ts
const obolKind = this.encounter.type === 'boss'
  ? (this.encounter.bossTier ?? 'mini')
  : 'normal';
const obolGain = obolsForEncounter(obolKind);
run.obols += obolGain;
```

- [ ] **Step 2: Record the break on a boss victory.** In the victory path (where the battle is won — same block that awards obols), add, after the obol award:

```ts
if (this.encounter.type === 'boss') {
  gameState.recordBreakCleared(this.encounter.floor);
}
```

(Confirm `gameState` is already imported in this file — it is, from Phase 1. If not, add `import { gameState } from '../managers/GameState';`.)

- [ ] **Step 3: Update the enemy-instance literal if it references `zone`.** Search `CombatScene.ts` for `.zone` or `zone:`. If the enemy `CreatureInstance` construction or any enemy-level calc reads `this.encounter.zone`, replace it with `this.encounter.floor` (enemy levels already come from `encounter.enemyLevels`, so this is usually just removing a stale `zone` read). Verify no `zone` reference remains in this file.

- [ ] **Step 4: Typecheck this file's errors resolve**

Run: `npx tsc --noEmit`
Expected: `CombatScene.ts` errors gone; only `RunScene.ts` remains red (Task 6). `npm test` still passes.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/CombatScene.ts
git commit -m "feat: combat awards boss-tier obols and records break clears"
```

---

### Task 6: RunScene — descent UI + green build

**Files:**
- Modify: `src/scenes/RunScene.ts`

**Interfaces:**
- Consumes: `generateDescent`, Task 2 types, `Encounter.floor`/`bossTier`.

- [ ] **Step 1: Replace run initialization** (the `init` method's new-run branch). Replace the zone1 generation + `currentZone`/`currentEncounterIndex` block with:

```ts
      gameState.startRun();
      const startFloor = 1; // depth-jump selection is Phase 3
      const encounters = generateDescent(startFloor);
      gameState.currentRun = {
        startFloor,
        currentEncounterIndex: -1,
        encounters,
        choices: [],
        obols: 0,
        capturedCreatures: [],
        partyHp: {},
        partyMp: {},
        partyKO: {},
        xpEarned: 0,
      };
```

Update the import line to pull `generateDescent` instead of `generateZoneEncounters`:
```ts
import { generateDescent, generatePickNextChoices } from '../systems/RunGenerator';
```

- [ ] **Step 2: Replace the header** (the `ZONE ... Encounter x/15` text). Use the current encounter's floor:

```ts
    const currentFloor = run.currentEncounterIndex >= 0
      ? run.encounters[run.currentEncounterIndex].floor
      : run.startFloor;
    this.add.text(cx, 20, `TOWER — Floor ${currentFloor} / ${TOWER_FLOORS}`, {
      fontSize: '20px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);
```

Add `TOWER_FLOORS` to the types import at the top of the file:
```ts
import { Encounter, RunState, TOWER_FLOORS } from '../types';
```

- [ ] **Step 3: Remove the zone-completion / NEXT ZONE branch.** In `drawUI`, the `if (choices.length === 0)` block currently checks `run.currentZone < 3` and regenerates the next zone. Replace the whole block with a simple run-complete check:

```ts
    if (choices.length === 0) {
      this.showRunEnd(true); // reached the bottom (floor-30 boss cleared)
      return;
    }
```

- [ ] **Step 4: Update encounter labels for boss tiers.** In `getEncounterLabel`, replace the `'boss'` case:

```ts
      case 'boss': return e.bossTier === 'major' ? 'MAJOR BOSS' : 'MINI BOSS';
```

- [ ] **Step 5: Update the run-end summary.** In `showRunEnd`, replace the `Zones Cleared: ${run.currentZone}` line with the deepest floor reached:

```ts
    const deepestFloor = run.currentEncounterIndex >= 0
      ? run.encounters[run.currentEncounterIndex].floor
      : run.startFloor;
    this.add.text(cx, cy - 20, [
      `Floor Reached: ${deepestFloor} / ${TOWER_FLOORS}`,
      `Obols Earned: ${run.obols}`,
      `Creatures Captured: ${run.capturedCreatures.length}`,
    ].join('\n'), {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);
```

- [ ] **Step 6: Remove any remaining `currentZone` references.** Grep `RunScene.ts` for `currentZone` and `generateZoneEncounters`; there should be none left. Fix any stragglers.

- [ ] **Step 7: Typecheck + build + test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: PASS — zero type errors, build succeeds, all unit tests green (Economy + GameState + RunGenerator).

- [ ] **Step 8: Grep for stale zone references across src**

Run: `grep -rn "currentZone\|generateZoneEncounters\|\.zone\b\|ZONE " src/ | grep -v ZONE_CREATURE_POOLS`
Expected: no live references (ZONE_CREATURE_POOLS is the retained pool export and is allowed).

- [ ] **Step 9: Manual playtest smoke check (controller may run this).** `npm run dev`, then: New Game → run → header reads "TOWER — Floor 1 / 30"; descend a few floors; a boss floor shows "MINI BOSS"/"MAJOR BOSS"; no "ZONE"/"NEXT ZONE" text anywhere.

- [ ] **Step 10: Commit**

```bash
git add src/scenes/RunScene.ts
git commit -m "feat: RunScene renders one 30-floor descent (no zones)"
```

---

## Phase 2 Done — Not Yet in This Phase

- **Phase 3:** town essence-hub vendor scenes, including the **Gatekeeper** that spends Essence to buy depth-jumps (reads `unlockedStartFloors()` / sets a chosen `startFloor`), and the Leveler wiring `spendEssenceOnLevel`.
- **Phase 4:** breeding essence carry-over, traits→essence thresholds, marks earn-then-lock + Floor Marks on bosses, conversion-rate levers.
