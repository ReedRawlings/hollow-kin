# Essence Pivot — Phase 3: Town Essence Hub (Leveler + Gatekeeper) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the town into an essence hub with two working vendors — the **Leveler** (spend Essence to buy permanent creature levels) and the **Gatekeeper** (spend Essence to start a run at a cleared depth) — and wire the chosen depth-jump into the run start.

**Architecture:** Two new Phaser scenes (`LevelerScene`, `GatekeeperScene`) registered in `main.ts` and reachable from a restructured `TownScene`. The pure logic they lean on already exists: `spendEssenceOnLevel` (Phase 1) and `unlockedStartFloors()` (Phase 2). This phase adds `depthJumpCost` (Economy) and `selectedStartFloor` + `resolveRunStartFloor()` (GameState, the deduct-and-resolve entry point), then points `RunScene` at it. Trait-keeper, Mark-binder, Quartermaster, and breeding carry-over remain Phase 4 (their systems don't exist yet).

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest (already set up).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md` (section 9) and `town.md`.
- **Essence is the only currency spent in town.** No new currencies.
- **Leveler** spends Essence via the existing `gameState.spendEssenceOnLevel(creature)` (cost curve `floor(10*level^1.5)`, capped at `levelCap`). Do not reimplement the cost math.
- **Gatekeeper** offers the floors from `gameState.unlockedStartFloors()` (always includes floor 1). Selecting a floor > 1 sets `gameState.selectedStartFloor`; the Essence cost is charged **per run at run start** via `resolveRunStartFloor()`, which falls back to floor 1 if the player cannot afford it or the floor is no longer unlocked.
- **Depth-jump cost (placeholder):** `depthJumpCost(startFloor) = (startFloor - 1) * 15` Essence. Floor 1 is free. Tunable.
- The depth-jump cost is a **per-run** charge (paid each time you start deep) — a deliberate Essence sink. This is a tunable design lever, not a one-time unlock.
- Scenes have no unit tests; verify them by `npm run build` (green) + playtest. Pure logic (Economy, GameState) is unit-tested (TDD).
- Do NOT build: Trait-keeper, Mark-binder, Quartermaster vendors, or breeding carry-over (Phase 4 — their systems are unbuilt).

---

### Task 1: Economy — depthJumpCost

**Files:**
- Modify: `src/systems/Economy.ts`
- Test: `src/systems/Economy.test.ts`

**Interfaces:**
- Produces: `depthJumpCost(startFloor: number): number` — `(startFloor - 1) * 15`, and `0` for floor 1.

- [ ] **Step 1: Write the failing tests** — append to `src/systems/Economy.test.ts`:

```ts
import { depthJumpCost } from './Economy';

describe('depthJumpCost', () => {
  it('is free to start at floor 1', () => {
    expect(depthJumpCost(1)).toBe(0);
  });
  it('scales with the start floor', () => {
    expect(depthJumpCost(6)).toBe(75);   // (6-1)*15
    expect(depthJumpCost(11)).toBe(150); // (11-1)*15
    expect(depthJumpCost(26)).toBe(375); // (26-1)*15
  });
});
```
(If `Economy.test.ts` already imports from `./Economy`, add `depthJumpCost` to that existing import instead of adding a duplicate import line.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/systems/Economy.test.ts`
Expected: FAIL — `depthJumpCost` not exported.

- [ ] **Step 3: Implement** — add to `src/systems/Economy.ts`:

```ts
/** Essence cost to start a run at `startFloor` (a cleared depth-jump). Floor 1 is free. */
export function depthJumpCost(startFloor: number): number {
  return Math.max(0, (startFloor - 1) * 15);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/systems/Economy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/Economy.ts src/systems/Economy.test.ts
git commit -m "feat: depthJumpCost (essence cost to start a run deep)"
```

---

### Task 2: GameState — selectedStartFloor + resolveRunStartFloor

**Files:**
- Modify: `src/managers/GameState.ts`
- Test: `src/managers/GameState.test.ts` (append)

**Interfaces:**
- Consumes: `depthJumpCost` from `../systems/Economy`; existing `unlockedStartFloors()`.
- Produces on `gameState`:
  - field `selectedStartFloor = 1` (persisted in save v2, additive).
  - `setSelectedStartFloor(floor: number): boolean` — sets it only if `floor` is in `unlockedStartFloors()`; returns success.
  - `resolveRunStartFloor(): number` — if `selectedStartFloor > 1`, is still unlocked, AND affordable, deducts `depthJumpCost(selectedStartFloor)` from `essence` and returns that floor; otherwise returns 1.

- [ ] **Step 1: Append failing tests** to `src/managers/GameState.test.ts`:

```ts
describe('depth-jump start floor', () => {
  it('defaults to floor 1', () => {
    expect(gameState.selectedStartFloor).toBe(1);
  });

  it('setSelectedStartFloor only accepts unlocked floors', () => {
    gameState.recordBreakCleared(10); // unlocks [1,6,11]
    expect(gameState.setSelectedStartFloor(11)).toBe(true);
    expect(gameState.selectedStartFloor).toBe(11);
    expect(gameState.setSelectedStartFloor(16)).toBe(false); // not unlocked
    expect(gameState.selectedStartFloor).toBe(11);           // unchanged
  });

  it('resolveRunStartFloor deducts essence and returns the chosen floor when affordable', () => {
    gameState.recordBreakCleared(10);
    gameState.setSelectedStartFloor(11);
    gameState.essence = 200;
    const floor = gameState.resolveRunStartFloor(); // cost (11-1)*15 = 150
    expect(floor).toBe(11);
    expect(gameState.essence).toBe(50);
  });

  it('resolveRunStartFloor falls back to floor 1 when unaffordable (no deduction)', () => {
    gameState.recordBreakCleared(10);
    gameState.setSelectedStartFloor(11);
    gameState.essence = 100; // < 150
    const floor = gameState.resolveRunStartFloor();
    expect(floor).toBe(1);
    expect(gameState.essence).toBe(100);
  });

  it('resolveRunStartFloor returns 1 (free) when selection is floor 1', () => {
    gameState.essence = 100;
    expect(gameState.resolveRunStartFloor()).toBe(1);
    expect(gameState.essence).toBe(100);
  });

  it('persists selectedStartFloor across save/load', () => {
    gameState.recordBreakCleared(10);
    gameState.setSelectedStartFloor(6);
    gameState.saveToLocalStorage();
    gameState.selectedStartFloor = 1;
    gameState.loadFromLocalStorage();
    expect(gameState.selectedStartFloor).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/managers/GameState.test.ts`
Expected: FAIL — `selectedStartFloor`/`setSelectedStartFloor`/`resolveRunStartFloor` undefined.

- [ ] **Step 3: Implement in `src/managers/GameState.ts`.**

Add `depthJumpCost` to the Economy import:
```ts
import { convertObolsToEssence, essenceCostForLevel, depthJumpCost } from '../systems/Economy';
```

Add the field next to `deepestBreakCleared`:
```ts
  deepestBreakCleared = 0;
  selectedStartFloor = 1;
```

Add the two methods (e.g. after `unlockedStartFloors`):
```ts
  /** Choose a start floor for the next run. Only floors unlocked by cleared breaks are accepted. */
  setSelectedStartFloor(floor: number): boolean {
    if (!this.unlockedStartFloors().includes(floor)) return false;
    this.selectedStartFloor = floor;
    return true;
  }

  /**
   * Resolve the floor a starting run begins on. If a deep start is selected, still unlocked,
   * and affordable, deducts its Essence cost and returns it; otherwise returns 1 (free).
   */
  resolveRunStartFloor(): number {
    const chosen = this.selectedStartFloor;
    if (chosen > 1 && this.unlockedStartFloors().includes(chosen)) {
      const cost = depthJumpCost(chosen);
      if (this.essence >= cost) {
        this.essence -= cost;
        return chosen;
      }
    }
    return 1;
  }
```

Reset it in `initializeNewGame` (add after `this.deepestBreakCleared = 0;`):
```ts
    this.selectedStartFloor = 1;
```

Add it to the save payload (`saveToLocalStorage` data object):
```ts
      selectedStartFloor: this.selectedStartFloor,
```

Backfill it in `loadFromLocalStorage` (alongside the other assignments):
```ts
      this.selectedStartFloor = data.selectedStartFloor ?? 1;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/managers/GameState.test.ts`
Expected: PASS — all new + prior GameState tests green.

- [ ] **Step 5: Commit**

```bash
git add src/managers/GameState.ts src/managers/GameState.test.ts
git commit -m "feat: selectedStartFloor + resolveRunStartFloor (depth-jump charge)"
```

---

### Task 3: RunScene — start at the resolved depth-jump floor

**Files:**
- Modify: `src/scenes/RunScene.ts`

**Interfaces:**
- Consumes: `gameState.resolveRunStartFloor()`.

- [ ] **Step 1: Use the resolved start floor.** In `RunScene.init`, the new-run branch currently reads `const startFloor = 1;`. Replace it with:

```ts
      const startFloor = gameState.resolveRunStartFloor();
```

(The rest — `generateDescent(startFloor)` and `startFloor: startFloor` in the RunState — already uses the `startFloor` variable, so no other change is needed. `resolveRunStartFloor()` deducts the Essence cost exactly once, here, at the start of a new run.)

- [ ] **Step 2: Typecheck + build + test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: PASS — green build, all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/RunScene.ts
git commit -m "feat: runs begin at the resolved depth-jump start floor"
```

---

### Task 4: LevelerScene

**Files:**
- Create: `src/scenes/LevelerScene.ts`
- Modify: `src/main.ts` (register the scene)

**Interfaces:**
- Consumes: `gameState` (creatureBox, essence, `spendEssenceOnLevel`), `essenceCostForLevel` from `../systems/Economy`, `getTemplate`.
- Produces: a scene keyed `'LevelerScene'` that returns to `'TownScene'` on back.

- [ ] **Step 1: Create `src/scenes/LevelerScene.ts`** with this full content:

```ts
import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { essenceCostForLevel } from '../systems/Economy';
import { CreatureInstance } from '../types';

export class LevelerScene extends Phaser.Scene {
  private selectedId: string | null = null;

  constructor() {
    super({ key: 'LevelerScene' });
  }

  create(): void {
    this.selectedId = null;
    this.draw();
  }

  private draw(): void {
    this.children.removeAll();
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 30, 'THE LEVELER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(cx, 62, 'Spend Essence to raise a creature\'s permanent level', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    });

    const creatures = gameState.creatureBox.filter(c => !c.isRetired);
    creatures.forEach((creature, i) => {
      const template = getTemplate(creature.speciesId);
      const x = 40 + (i % 4) * 230;
      const y = 130 + Math.floor(i / 4) * 70;
      const isSel = creature.instanceId === this.selectedId;

      const bg = this.add.rectangle(x + 100, y + 15, 210, 55, isSel ? 0x334466 : 0x222240, 0.9)
        .setStrokeStyle(2, isSel ? 0x66aaff : 0x444466).setInteractive({ useHandCursor: true });
      this.add.rectangle(x + 20, y + 15, 34, 34, template.spriteColor);
      this.add.text(x + 45, y, template.name, {
        fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      });
      this.add.text(x + 45, y + 18, `Lv ${creature.permanentLevel} / cap ${creature.levelCap}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      });
      bg.on('pointerdown', () => { this.selectedId = creature.instanceId; this.draw(); });
    });

    // Selected-creature action panel
    const selected = creatures.find(c => c.instanceId === this.selectedId);
    if (selected) {
      this.drawActionPanel(selected, cx);
    }

    this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      gameState.saveToLocalStorage();
      this.scene.start('TownScene');
    });
  }

  private drawActionPanel(creature: CreatureInstance, cx: number): void {
    const y = 470;
    const atCap = creature.permanentLevel >= creature.levelCap;
    const cost = essenceCostForLevel(creature.permanentLevel);
    const canAfford = gameState.essence >= cost;

    const label = atCap
      ? `${getTemplate(creature.speciesId).name} is at its level cap (${creature.levelCap})`
      : `Next level: ${creature.permanentLevel} → ${creature.permanentLevel + 1}  |  Cost: ${cost} Essence`;
    this.add.text(cx, y, label, {
      fontSize: '14px', color: atCap ? '#888888' : (canAfford ? '#e0d0a0' : '#aa6666'), fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (!atCap) {
      const enabled = canAfford;
      const bg = this.add.rectangle(cx, y + 45, 200, 46, enabled ? 0x336633 : 0x333333, enabled ? 0.9 : 0.6)
        .setStrokeStyle(2, enabled ? 0x44aa44 : 0x555555);
      this.add.text(cx, y + 45, 'BUY LEVEL', {
        fontSize: '15px', color: enabled ? '#ffffff' : '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5);
      if (enabled) {
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (gameState.spendEssenceOnLevel(creature)) {
            gameState.saveToLocalStorage();
            this.draw();
          }
        });
      }
    }
  }
}
```

- [ ] **Step 2: Register the scene in `src/main.ts`.** Add the import:
```ts
import { LevelerScene } from './scenes/LevelerScene';
```
and add `LevelerScene` to the `scene: [...]` array (e.g. after `BreedingScene`).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. (No town button yet — that's Task 6. `npm test` unaffected.)

- [ ] **Step 4: Commit**

```bash
git add src/scenes/LevelerScene.ts src/main.ts
git commit -m "feat: LevelerScene (spend essence to buy permanent levels)"
```

---

### Task 5: GatekeeperScene

**Files:**
- Create: `src/scenes/GatekeeperScene.ts`
- Modify: `src/main.ts` (register the scene)

**Interfaces:**
- Consumes: `gameState` (essence, `unlockedStartFloors`, `selectedStartFloor`, `setSelectedStartFloor`), `depthJumpCost` from `../systems/Economy`.
- Produces: a scene keyed `'GatekeeperScene'` that returns to `'TownScene'` on back.

- [ ] **Step 1: Create `src/scenes/GatekeeperScene.ts`** with this full content:

```ts
import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { depthJumpCost } from '../systems/Economy';

export class GatekeeperScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GatekeeperScene' });
  }

  create(): void {
    this.draw();
  }

  private draw(): void {
    this.children.removeAll();
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 30, 'THE GATEKEEPER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(cx, 62, 'Choose where your next descent begins (Essence charged at run start)', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    });

    const floors = gameState.unlockedStartFloors();
    floors.forEach((floor, i) => {
      const y = 140 + i * 60;
      const isSel = floor === gameState.selectedStartFloor;
      const cost = depthJumpCost(floor);
      const label = floor === 1 ? 'Floor 1  (free)' : `Floor ${floor}  —  ${cost} Essence / run`;

      const bg = this.add.rectangle(cx, y, 420, 48, isSel ? 0x334466 : 0x222240, 0.9)
        .setStrokeStyle(2, isSel ? 0x66aaff : 0x444466).setInteractive({ useHandCursor: true });
      this.add.text(cx, y, `${isSel ? '▶ ' : ''}${label}`, {
        fontSize: '15px', color: isSel ? '#ffffff' : '#cccccc', fontFamily: 'monospace',
      }).setOrigin(0.5);
      bg.on('pointerdown', () => {
        gameState.setSelectedStartFloor(floor);
        gameState.saveToLocalStorage();
        this.draw();
      });
    });

    if (floors.length === 1) {
      this.add.text(cx, 220, 'Clear a mini-boss (floor 5) to unlock deeper starts.', {
        fontSize: '13px', color: '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      gameState.saveToLocalStorage();
      this.scene.start('TownScene');
    });
  }
}
```

- [ ] **Step 2: Register the scene in `src/main.ts`.** Add the import:
```ts
import { GatekeeperScene } from './scenes/GatekeeperScene';
```
and add `GatekeeperScene` to the `scene: [...]` array (after `LevelerScene`).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. (`npm test` unaffected.)

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GatekeeperScene.ts src/main.ts
git commit -m "feat: GatekeeperScene (select a cleared depth to start a run)"
```

---

### Task 6: TownScene hub — vendor buttons + green build

**Files:**
- Modify: `src/scenes/TownScene.ts`

**Interfaces:**
- Consumes: the `'LevelerScene'` and `'GatekeeperScene'` keys (Tasks 4–5).

- [ ] **Step 1: Add the two vendor buttons and reflow into two rows.** In `TownScene.create`, replace the existing single-row button block:

```ts
    // Buttons
    const btnY = 480;
    this.createButton(cx - 200, btnY, 'ENTER TOWER', '#44aa44', () => {
      this.scene.start('PartySelectScene');
    });

    this.createButton(cx, btnY, 'BREED', '#aa44aa', () => {
      if (activeCreatures.length >= 2) {
        this.scene.start('BreedingScene');
      }
    });

    this.createButton(cx + 200, btnY, 'NEW GAME', '#aa4444', () => {
      localStorage.removeItem('hollow_kin_save');
      this.scene.start('BootScene');
    });
```

with a two-row layout that adds Leveler and Gatekeeper:

```ts
    // Vendors (row 1)
    const vendorY = 430;
    this.createButton(cx - 100, vendorY, 'LEVELER', '#4488aa', () => {
      this.scene.start('LevelerScene');
    });
    this.createButton(cx + 100, vendorY, 'GATEKEEPER', '#aa8844', () => {
      this.scene.start('GatekeeperScene');
    });

    // Run / breed / new game (row 2)
    const btnY = 500;
    this.createButton(cx - 200, btnY, 'ENTER TOWER', '#44aa44', () => {
      this.scene.start('PartySelectScene');
    });
    this.createButton(cx, btnY, 'BREED', '#aa44aa', () => {
      if (activeCreatures.length >= 2) {
        this.scene.start('BreedingScene');
      }
    });
    this.createButton(cx + 200, btnY, 'NEW GAME', '#aa4444', () => {
      localStorage.removeItem('hollow_kin_save');
      this.scene.start('BootScene');
    });
```

- [ ] **Step 2: Show the selected start floor in the town header (context for the Gatekeeper).** After the `Essence:` text line, add:

```ts
    if (gameState.selectedStartFloor > 1) {
      this.add.text(20, 88, `Next descent starts at floor ${gameState.selectedStartFloor}`, {
        fontSize: '12px', color: '#88aacc', fontFamily: 'monospace',
      });
    }
```

(Adjust the Creature Box y-offset only if it visually overlaps; the box starts at y=100 which sits just below.)

- [ ] **Step 3: Typecheck + build + test**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: PASS — green build, all unit tests pass.

- [ ] **Step 4: Manual playtest smoke check (controller may run this).** `npm run dev`, then:
  1. Town shows LEVELER and GATEKEEPER buttons.
  2. LEVELER → pick a creature → BUY LEVEL deducts Essence and raises its Lv (buy is disabled/greyed when Essence < cost or at cap).
  3. GATEKEEPER → shows "Floor 1 (free)" (only option until a mini-boss is cleared); selecting it updates the highlight.
  4. Back returns to town; Essence total is consistent.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/TownScene.ts
git commit -m "feat: town hub with Leveler + Gatekeeper vendor buttons"
```

---

## Phase 3 Done — Not Yet in This Phase

- **Phase 4:** Trait-keeper (traits → essence thresholds), Mark-binder (marks earn-then-lock + Floor Marks on bosses), Quartermaster (backpack/inventory capacity), breeding essence carry-over to offspring, and Obols→Essence conversion-rate levers (Essence Distiller trait, Quartermaster upgrades, depth). These need their underlying systems built first.
