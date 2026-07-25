# Monsterpedia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A town-accessible creature catalog showing which of the game's species the player has met, with full details for discovered ones and silhouettes for the rest.

**Architecture:** A pure module (`src/systems/Bestiary.ts`) derives the entry list, progress counts, and paging from `gameState.seenSpecies` + `CREATURE_TEMPLATES`. A Phaser scene (`src/scenes/BestiaryScene.ts`) draws it and holds no derivation logic. No new persisted state and no save migration — this reads data the auto-combat feature already records.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest.

**Source spec:** `docs/superpowers/specs/2026-07-25-monsterpedia-design.md`

## Global Constraints

- **Add no persisted state and no save version bump.** `gameState.seenSpecies` already exists and is persisted in save v3. This feature is read-only over it.
- **Do not modify combat, `TacticsAI`, or the fog.** The recording point (`CombatScene.showBattleEnd`) stays exactly where it is.
- **Single-tier discovery.** `seenSpecies.has(id)` is the entire model. No "studied" tier, no defeat counters, no partial reveals.
- **Undiscovered entries must not leak information** — no name, no stats, no archetype-identifying text. A dimmed block and `???` only.
- **Element lifecycle:** Phaser's `children.removeAll()` only *detaches*; it does not `.destroy()` or deregister input handlers. `BestiaryScene` redraws on paging and on opening/closing the detail panel, so it must track every interactive object it creates and `.destroy()` them before each redraw — following the pattern now used in `CombatScene` (`hudElements`/`destroyHud`) and `RunScene` (`uiElements`/`clearUI`). This exact trap caused two real bugs on the previous branch.
- Ordering is by archetype (in `ARCHETYPE_ORDER`) then species id, and must be stable.
- `npx tsc --noEmit` clean, `npm test` green (121 tests currently, plus what you add), `npm run build` succeeds, output pristine.

---

### Task 1: `Bestiary` pure module

**Files:**
- Create: `src/systems/Bestiary.ts`
- Create: `src/systems/Bestiary.test.ts`

**Interfaces:**
- Consumes: `CREATURE_TEMPLATES` from `src/data/creatures.ts`; `CreatureTemplate`, `Archetype` from `src/types.ts`.
- Produces:
  - `interface BestiaryEntry { speciesId: string; name: string; archetype: Archetype; discovered: boolean; template: CreatureTemplate }`
  - `const ARCHETYPE_ORDER: readonly Archetype[]`
  - `buildBestiary(seen: ReadonlySet<string>): BestiaryEntry[]`
  - `bestiaryProgress(entries: BestiaryEntry[]): { discovered: number; total: number }`
  - `pageCount(total: number, pageSize: number): number`
  - `pageOf(entries: BestiaryEntry[], pageIndex: number, pageSize: number): BestiaryEntry[]`

- [ ] **Step 1: Write the failing tests**

Create `src/systems/Bestiary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CREATURE_TEMPLATES } from '../data/creatures';
import {
  buildBestiary, bestiaryProgress, pageCount, pageOf, ARCHETYPE_ORDER,
} from './Bestiary';

describe('buildBestiary', () => {
  it('returns one entry per species in the roster', () => {
    const entries = buildBestiary(new Set());
    expect(entries).toHaveLength(Object.keys(CREATURE_TEMPLATES).length);
  });

  it('marks nothing discovered for an empty set', () => {
    expect(buildBestiary(new Set()).every(e => !e.discovered)).toBe(true);
  });

  it('marks exactly the passed species as discovered', () => {
    const entries = buildBestiary(new Set(['ironjaw', 'petalward']));
    const discovered = entries.filter(e => e.discovered).map(e => e.speciesId).sort();
    expect(discovered).toEqual(['ironjaw', 'petalward']);
  });

  it('ignores species ids that are not in the roster', () => {
    const entries = buildBestiary(new Set(['ironjaw', 'not_a_real_species']));
    expect(entries.filter(e => e.discovered).map(e => e.speciesId)).toEqual(['ironjaw']);
  });

  it('carries the template through so the scene needs no second lookup', () => {
    const entry = buildBestiary(new Set()).find(e => e.speciesId === 'ironjaw')!;
    expect(entry.template).toBe(CREATURE_TEMPLATES['ironjaw']);
    expect(entry.name).toBe(CREATURE_TEMPLATES['ironjaw'].name);
    expect(entry.archetype).toBe(CREATURE_TEMPLATES['ironjaw'].archetype);
  });

  it('groups by archetype in ARCHETYPE_ORDER, then sorts by species id', () => {
    const entries = buildBestiary(new Set());

    // Archetype blocks must appear in ARCHETYPE_ORDER and never repeat.
    const blocks: string[] = [];
    for (const e of entries) {
      if (blocks[blocks.length - 1] !== e.archetype) blocks.push(e.archetype);
    }
    expect(blocks).toEqual([...new Set(blocks)]); // no archetype appears twice
    const expectedOrder = ARCHETYPE_ORDER.filter(a => blocks.includes(a));
    expect(blocks).toEqual(expectedOrder);

    // Within each archetype, species ids ascend.
    for (const archetype of blocks) {
      const ids = entries.filter(e => e.archetype === archetype).map(e => e.speciesId);
      expect(ids).toEqual([...ids].sort());
    }
  });

  it('is stable — two calls produce the same order', () => {
    const a = buildBestiary(new Set()).map(e => e.speciesId);
    const b = buildBestiary(new Set(['ironjaw'])).map(e => e.speciesId);
    expect(a).toEqual(b);
  });
});

describe('bestiaryProgress', () => {
  it('counts discovered against total', () => {
    const entries = buildBestiary(new Set(['ironjaw', 'petalward']));
    expect(bestiaryProgress(entries)).toEqual({
      discovered: 2,
      total: Object.keys(CREATURE_TEMPLATES).length,
    });
  });

  it('reports zero discovered for a fresh save', () => {
    expect(bestiaryProgress(buildBestiary(new Set())).discovered).toBe(0);
  });
});

describe('pageCount', () => {
  it('rounds a partial final page up', () => {
    expect(pageCount(36, 30)).toBe(2);
  });
  it('does not add an empty page when the total divides evenly', () => {
    expect(pageCount(60, 30)).toBe(2);
  });
  it('reports a single page for a total smaller than one page', () => {
    expect(pageCount(5, 30)).toBe(1);
  });
  it('reports one page for an empty roster, so the UI never shows "page 0 of 0"', () => {
    expect(pageCount(0, 30)).toBe(1);
  });
});

describe('pageOf', () => {
  const entries = buildBestiary(new Set());

  it('returns the first pageSize entries for page 0', () => {
    expect(pageOf(entries, 0, 10)).toEqual(entries.slice(0, 10));
  });

  it('returns the correct middle slice', () => {
    expect(pageOf(entries, 1, 10)).toEqual(entries.slice(10, 20));
  });

  it('returns a short final page rather than padding', () => {
    const last = pageCount(entries.length, 30) - 1;
    expect(pageOf(entries, last, 30)).toEqual(entries.slice(last * 30));
    expect(pageOf(entries, last, 30).length).toBeLessThanOrEqual(30);
  });

  it('returns empty for an out-of-range page instead of throwing', () => {
    expect(pageOf(entries, 99, 30)).toEqual([]);
  });

  it('returns empty for a negative page instead of slicing from the end', () => {
    expect(pageOf(entries, -1, 30)).toEqual([]);
  });
});
```

The negative-index test matters specifically: `Array.prototype.slice` treats a negative start as an offset from the end, so a naive `slice(pageIndex * pageSize, ...)` would silently return real entries for page -1.

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/systems/Bestiary.test.ts`
Expected: FAIL — cannot resolve `./Bestiary`.

- [ ] **Step 3: Implement the module**

Create `src/systems/Bestiary.ts`:

```typescript
import { CreatureTemplate, Archetype } from '../types';
import { CREATURE_TEMPLATES } from '../data/creatures';

/** A species as the Monsterpedia displays it. */
export interface BestiaryEntry {
  speciesId: string;
  name: string;
  archetype: Archetype;
  /** True once the player has met this species in a battle. */
  discovered: boolean;
  template: CreatureTemplate;
}

/**
 * Canonical archetype display order. Explicit rather than derived from object
 * key order so the grid layout can't reshuffle when creatures are added.
 */
export const ARCHETYPE_ORDER: readonly Archetype[] = [
  'Kami', 'Spirits', 'Flora', 'Fauna', 'Rock', 'Mecha', 'Food', 'Human',
];

/**
 * Every species in the roster, flagged against the player's seen set and
 * ordered by archetype then species id. `seen` may contain ids that are not in
 * the roster (from an older save); those are simply ignored.
 */
export function buildBestiary(seen: ReadonlySet<string>): BestiaryEntry[] {
  const entries: BestiaryEntry[] = Object.values(CREATURE_TEMPLATES).map(template => ({
    speciesId: template.id,
    name: template.name,
    archetype: template.archetype,
    discovered: seen.has(template.id),
    template,
  }));

  return entries.sort((a, b) => {
    const byArchetype = ARCHETYPE_ORDER.indexOf(a.archetype) - ARCHETYPE_ORDER.indexOf(b.archetype);
    if (byArchetype !== 0) return byArchetype;
    return a.speciesId < b.speciesId ? -1 : a.speciesId > b.speciesId ? 1 : 0;
  });
}

export function bestiaryProgress(entries: BestiaryEntry[]): { discovered: number; total: number } {
  return {
    discovered: entries.filter(e => e.discovered).length,
    total: entries.length,
  };
}

/** Pages needed to show `total` entries. Always at least 1, so the UI never reads "page 0 of 0". */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * One page of entries. Out-of-range and negative indices return empty rather
 * than throwing or — worse — slicing from the end, which a bare
 * `slice(pageIndex * pageSize)` would do for a negative index.
 */
export function pageOf(
  entries: BestiaryEntry[],
  pageIndex: number,
  pageSize: number,
): BestiaryEntry[] {
  if (pageIndex < 0) return [];
  const start = pageIndex * pageSize;
  if (start >= entries.length) return [];
  return entries.slice(start, start + pageSize);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/systems/Bestiary.test.ts`
Expected: PASS (all).

Run: `npm test`
Expected: all suites pass.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/systems/Bestiary.ts src/systems/Bestiary.test.ts
git commit -m "feat: Bestiary derivation module

Pure entry-list construction, progress counts, and paging over
CREATURE_TEMPLATES and the player's seenSpecies set. All display logic the
Monsterpedia scene needs, testable without a Phaser harness."
```

---

### Task 2: `BestiaryScene` and the town entry point

**Files:**
- Create: `src/scenes/BestiaryScene.ts`
- Modify: `src/main.ts` (register the scene)
- Modify: `src/scenes/TownScene.ts` (add the button)

**Interfaces:**
- Consumes: `buildBestiary`, `bestiaryProgress`, `pageOf`, `pageCount`, `BestiaryEntry` (Task 1); `gameState.seenSpecies`; `getAbility` from `src/data/abilities.ts`.
- Produces: a scene registered under the key `'BestiaryScene'`, reachable from `TownScene` and returning to it.

- [ ] **Step 1: Create the scene**

Create `src/scenes/BestiaryScene.ts`:

```typescript
import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getAbility } from '../data/abilities';
import {
  buildBestiary, bestiaryProgress, pageOf, pageCount, BestiaryEntry,
} from '../systems/Bestiary';

const PAGE_SIZE = 30;
const COLS = 6;
const CELL_W = 140;
const CELL_H = 70;
const GRID_X = 90;
const GRID_Y = 130;
const COL_SPACING = 145;
const ROW_SPACING = 82;

export class BestiaryScene extends Phaser.Scene {
  private entries: BestiaryEntry[] = [];
  private pageIndex = 0;
  private detailFor: BestiaryEntry | null = null;

  /**
   * Every interactive object this scene creates. Tracked so they can be
   * explicitly destroyed on redraw — children.removeAll() only detaches from
   * the display list and leaves input handlers registered, which turns stale
   * cells into invisible hotspots.
   */
  private uiElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'BestiaryScene' });
  }

  create(): void {
    this.entries = buildBestiary(gameState.seenSpecies);
    this.pageIndex = 0;
    this.detailFor = null;
    this.uiElements = [];
    this.draw();
  }

  private clearUI(): void {
    for (const el of this.uiElements) el.destroy();
    this.uiElements = [];
  }

  private draw(): void {
    this.clearUI();
    this.children.removeAll();

    const cx = this.cameras.main.centerX;
    this.add.rectangle(480, 320, 960, 640, 0x1a1a2e);

    this.add.text(cx, 30, 'MONSTERPEDIA', {
      fontSize: '24px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const { discovered, total } = bestiaryProgress(this.entries);
    this.add.text(cx, 62, `Discovered ${discovered} / ${total}`, {
      fontSize: '14px', color: '#88ccff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.drawGrid();
    this.drawPaging();

    const back = this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true });
    this.uiElements.push(back);
    back.on('pointerdown', () => this.scene.start('TownScene'));

    // The detail panel is drawn last so it sits above the grid, and its
    // backdrop swallows clicks that would otherwise reach cells underneath.
    if (this.detailFor) this.drawDetail(this.detailFor);
  }

  private drawGrid(): void {
    const page = pageOf(this.entries, this.pageIndex, PAGE_SIZE);

    page.forEach((entry, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * COL_SPACING;
      const y = GRID_Y + row * ROW_SPACING;

      const cell = this.add.rectangle(x, y, CELL_W, CELL_H, 0x222244, 0.9)
        .setStrokeStyle(1, entry.discovered ? 0x445588 : 0x2a2a3a);

      if (entry.discovered) {
        this.add.rectangle(x - 45, y, 38, 38, entry.template.spriteColor);
        this.add.text(x - 20, y - 12, entry.name, {
          fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
        });
        this.add.text(x - 20, y + 4, entry.archetype, {
          fontSize: '10px', color: '#8888aa', fontFamily: 'monospace',
        });

        cell.setInteractive({ useHandCursor: true });
        this.uiElements.push(cell);
        cell.on('pointerover', () => cell.setFillStyle(0x33335a));
        cell.on('pointerout', () => cell.setFillStyle(0x222244));
        cell.on('pointerdown', () => {
          this.detailFor = entry;
          this.draw();
        });
      } else {
        // Silhouette: no name, no archetype, nothing that identifies the species.
        this.add.rectangle(x - 45, y, 38, 38, 0x33334a);
        this.add.text(x - 20, y - 6, '???', {
          fontSize: '12px', color: '#555577', fontFamily: 'monospace',
        });
      }
    });
  }

  private drawPaging(): void {
    const pages = pageCount(this.entries.length, PAGE_SIZE);
    if (pages <= 1) return;

    const cx = this.cameras.main.centerX;
    this.add.text(cx, 560, `Page ${this.pageIndex + 1} / ${pages}`, {
      fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (this.pageIndex > 0) {
      const prev = this.add.text(cx - 110, 560, '← Prev', {
        fontSize: '13px', color: '#88ccff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.uiElements.push(prev);
      prev.on('pointerdown', () => { this.pageIndex--; this.draw(); });
    }

    if (this.pageIndex < pages - 1) {
      const next = this.add.text(cx + 110, 560, 'Next →', {
        fontSize: '13px', color: '#88ccff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.uiElements.push(next);
      next.on('pointerdown', () => { this.pageIndex++; this.draw(); });
    }
  }

  private drawDetail(entry: BestiaryEntry): void {
    // Full-screen backdrop: dims the grid and, because it is interactive,
    // absorbs clicks so a cell underneath cannot be triggered through it.
    const backdrop = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6)
      .setInteractive();
    this.uiElements.push(backdrop);
    backdrop.on('pointerdown', () => { this.detailFor = null; this.draw(); });

    const px = 480;
    const py = 320;
    this.add.rectangle(px, py, 560, 380, 0x222244, 0.98).setStrokeStyle(2, 0x6688aa);

    this.add.rectangle(px - 220, py - 130, 56, 56, entry.template.spriteColor);
    this.add.text(px - 175, py - 148, entry.name, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    });
    this.add.text(px - 175, py - 122, entry.archetype, {
      fontSize: '13px', color: '#8888aa', fontFamily: 'monospace',
    });

    const s = entry.template.baseStats;
    this.add.text(px - 220, py - 75, 'BASE STATS', {
      fontSize: '11px', color: '#88ccff', fontFamily: 'monospace',
    });
    this.add.text(px - 220, py - 55,
      `HP:${s.hp}  MP:${s.mp}  STR:${s.str}  DEF:${s.def}`, {
        fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      });
    this.add.text(px - 220, py - 37,
      `INT:${s.int}  WIS:${s.wis}  SPD:${s.spd}`, {
        fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      });

    this.add.text(px - 220, py + 0, 'ABILITIES', {
      fontSize: '11px', color: '#88ccff', fontFamily: 'monospace',
    });
    const abilityNames = entry.template.defaultAbilities
      .map(id => getAbility(id).name)
      .join(', ') || '—';
    this.add.text(px - 220, py + 20, abilityNames, {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      wordWrap: { width: 440 },
    });

    this.add.text(px - 220, py + 60, 'RESISTS', {
      fontSize: '11px', color: '#88ffaa', fontFamily: 'monospace',
    });
    this.add.text(px - 130, py + 60, entry.template.resistances.join(', ') || 'none', {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
    });

    this.add.text(px - 220, py + 82, 'WEAK TO', {
      fontSize: '11px', color: '#ff8888', fontFamily: 'monospace',
    });
    this.add.text(px - 130, py + 82, entry.template.weaknesses.join(', ') || 'none', {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
    });

    const close = this.add.text(px, py + 150, '[ CLOSE ]', {
      fontSize: '13px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.uiElements.push(close);
    close.on('pointerdown', () => { this.detailFor = null; this.draw(); });
  }
}
```

- [ ] **Step 2: Register the scene**

In `src/main.ts`, add the import after the `GatekeeperScene` import:

```typescript
import { BestiaryScene } from './scenes/BestiaryScene';
```

and add `BestiaryScene` to the end of the `scene` array in `config`:

```typescript
  scene: [BootScene, TownScene, PartySelectScene, RunScene, CombatScene, ShopScene, RestScene, BreedingScene, LevelerScene, GatekeeperScene, BestiaryScene],
```

- [ ] **Step 3: Add the town button**

In `src/scenes/TownScene.ts`, the vendor row currently holds two buttons at `cx - 100` and `cx + 100`. Make room for a third by spreading them:

```typescript
    // Vendors (row 1)
    const vendorY = 430;
    this.createButton(cx - 190, vendorY, 'LEVELER', '#4488aa', () => {
      this.scene.start('LevelerScene');
    });
    this.createButton(cx, vendorY, 'GATEKEEPER', '#aa8844', () => {
      this.scene.start('GatekeeperScene');
    });
    this.createButton(cx + 190, vendorY, 'MONSTERPEDIA', '#6666aa', () => {
      this.scene.start('BestiaryScene');
    });
```

`createButton` draws a 160-wide rectangle, so at ±190 the three buttons sit 30px apart and stay inside the 960 canvas.

- [ ] **Step 4: Type-check and test**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all suites pass (Task 1's tests plus the existing 121).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

**Keep the browser tab focused and visible.** Phaser's loop stops stepping in a backgrounded tab, which makes any timing-dependent behavior look broken (see `CLAUDE.md`).

Run: `npm run dev`. From town, click MONSTERPEDIA.
Expected:
- Grid of creature cells, grouped by archetype, with a `Discovered N / 36` counter.
- Species you have fought show colour block, name, and archetype; the rest show a dim block and `???`.
- Clicking a discovered cell opens the detail panel with stats, abilities, resists, and weaknesses. Clicking an undiscovered cell does nothing.
- CLOSE and clicking the dimmed backdrop both dismiss the panel.
- With 36 creatures and a page size of 30 there are two pages — Next/Prev work and the counter tracks.
- **Lifecycle check:** open the detail panel, close it, then click the cell that was *underneath* the panel's CLOSE text. It must open that cell's entry and nothing else. Repeat paging back and forth several times, then click a cell — exactly one panel should open.
- Back returns to town.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BestiaryScene.ts src/main.ts src/scenes/TownScene.ts
git commit -m "feat: Monsterpedia screen

Town-accessible creature catalog over the existing seenSpecies data.
Grid grouped by archetype with silhouettes for undiscovered species,
click-through detail panel, and paging sized for the roster growing to 96.
Tracks and destroys its interactive objects rather than relying on
children.removeAll(), which only detaches."
```

---

## Post-Implementation

- [ ] `npm test` and `npm run build` one final time.
- [ ] Update `CLAUDE.md`: move the Monsterpedia out of **What's NOT Built Yet** into **Working systems**, and add `BestiaryScene` / `Bestiary.ts` to the source structure listing.
- [ ] Update `ui-ux.md`'s Bestiary section (line ~101) to record what shipped: single-tier discovery, town-only access, detail-on-click, and that entries unlock on first encounter with breed-only discovery still unbuilt.
- [ ] Remove the resolved line from `game-design-document.md:435` ("Bestiary / Monsterpedia design — ... no dedicated doc") and point it at the spec.

---

## Self-Review Notes

**Spec coverage.** §1 (no new state) — honored, the plan touches no save code. §2 (single-tier) — Task 1's `discovered` boolean. §3 (grid, counter, detail, paging, town-only) — Task 2. §4 (architecture split) — Tasks 1 and 2, with all derivation in the pure module. §5 (element lifecycle) — Task 2's `uiElements`/`clearUI` plus the explicit lifecycle check in Step 5. §6 (testing) — Task 1's suite, including the exact-ordering and page-boundary cases the spec names. §7 (out of scope) — nothing in the plan builds them.

**Two things worth flagging as judgment calls:**

1. **The detail backdrop is interactive on purpose.** It dims the grid *and* absorbs clicks. Without that, a click landing on the panel but missing CLOSE would fall through to whatever cell sits underneath, opening a different entry. Step 5's lifecycle check is written to catch exactly that regression.

2. **Page size 30 with 36 creatures means a nearly-empty second page.** Slightly awkward now, correct at 96. The alternative — sizing pages to fit the current roster — would need reworking the moment creatures are added, and the spec explicitly calls paging the one piece of forward-thinking worth paying for.
