# Departure Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standing default party so the player stops re-picking three creatures every run, a pre-run departure screen that also chooses the start floor, and a split of depth cost into a one-time Gatekeeper unlock plus a smaller per-run fee.

**Architecture:** Two pure modules carry everything testable — `Economy` gains the two cost functions, and a new `PartyStatus` resolves a stored party against the box so town and the departure screen can never disagree about whether a party is usable. `GameState` gains two persisted fields and a save bump. Three scenes change roles: `PartySelectScene` becomes a party editor, `GatekeeperScene` sells permanent unlocks, and a new `DepartureScene` is the pre-run gate.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest.

**Source spec:** `docs/superpowers/specs/2026-07-25-departure-flow-design.md`

## Global Constraints

- **Never substitute.** Neither a party member nor a start floor may be silently replaced. An unusable party or an unaffordable floor **blocks** and says why; the player fixes it. Departing with a creature or at a depth the player did not choose reads as a bug.
- **The three creatures the player entered with can never be lost** — unrelated to this feature, but do not write anything that implies otherwise.
- **This project is in alpha; numbers are placeholders** (see the note at the top of `CLAUDE.md`). Test the *shape* of cost curves — free at floor 1, rising with depth — not exact magic numbers. Do pin relationships between constants.
- Save bumps **v3 → v4**. A v3 save must migrate with `unlockedFloors` granted for every break already cleared, or players lose depths they earned.
- **Element lifecycle:** Phaser's `children.removeAll()` only *detaches*; it does not `.destroy()` or deregister input handlers, leaving stale interactive objects live as invisible hotspots. Every scene touched here must track the objects it creates and destroy them before redrawing — follow `BestiaryScene`'s `track()` / `destroyTracked()` pattern. This has caused three real bugs in this codebase already.
- `npx tsc --noEmit` clean, `npm test` green (136 tests currently, plus what you add), `npm run build` succeeds, output pristine.
- The game must be **playable at every commit**. Do not leave `ENTER TOWER` broken between tasks.

---

### Task 1: Split depth cost into unlock and per-run fee

**Files:**
- Modify: `src/types.ts` (two constants)
- Modify: `src/systems/Economy.ts`
- Modify: `src/systems/Economy.test.ts`

**Interfaces:**
- Produces: `depthUnlockCost(floor: number): number`, `depthRunFee(floor: number): number`, and constants `DEPTH_UNLOCK_COST_PER_FLOOR`, `DEPTH_RUN_FEE_PER_FLOOR`.
- `depthJumpCost` stays for now so `GameState` and `GatekeeperScene` keep compiling; Task 6 removes it.

- [ ] **Step 1: Write the failing tests**

Append to `src/systems/Economy.test.ts`:

```typescript
import { depthUnlockCost, depthRunFee } from './Economy';
import { DEPTH_UNLOCK_COST_PER_FLOOR, DEPTH_RUN_FEE_PER_FLOOR } from '../types';

describe('depth costs', () => {
  it('are both free at floor 1', () => {
    expect(depthUnlockCost(1)).toBe(0);
    expect(depthRunFee(1)).toBe(0);
  });

  it('never go negative for a nonsensical floor', () => {
    expect(depthUnlockCost(0)).toBe(0);
    expect(depthRunFee(0)).toBe(0);
  });

  it('both rise with depth', () => {
    expect(depthUnlockCost(11)).toBeGreaterThan(depthUnlockCost(6));
    expect(depthRunFee(11)).toBeGreaterThan(depthRunFee(6));
  });

  it('charges far more to unlock a floor than to depart from it', () => {
    // The split's whole point: a large one-time gate, a small recurring fee.
    for (const floor of [6, 11, 16, 21, 26]) {
      expect(depthUnlockCost(floor)).toBeGreaterThan(depthRunFee(floor));
    }
  });

  it('keeps the per-run fee below the old flat per-run cost at every depth', () => {
    // The old model charged (floor - 1) * 15 every single run. The split is only
    // an improvement for the player if the recurring part actually got cheaper.
    for (const floor of [6, 11, 16, 21, 26]) {
      expect(depthRunFee(floor)).toBeLessThan((floor - 1) * 15);
    }
  });

  it('derives both from their constants, so retuning a constant retunes the curve', () => {
    expect(depthUnlockCost(6)).toBe(5 * DEPTH_UNLOCK_COST_PER_FLOOR);
    expect(depthRunFee(6)).toBe(5 * DEPTH_RUN_FEE_PER_FLOOR);
  });
});
```

Note what these do *not* do: no test asserts `depthUnlockCost(6) === 200`. The values are alpha placeholders and will move; the tests pin the shape and the relationship instead, so retuning does not redden the suite.

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/systems/Economy.test.ts`
Expected: FAIL — `depthUnlockCost` is not exported.

- [ ] **Step 3: Add the constants**

In `src/types.ts`, immediately after the `WIPE_OBOL_PENALTY` line:

```typescript
/**
 * Depth cost is split in two: a large one-time Gatekeeper purchase that permanently
 * unlocks a floor as a start point, plus a small fee charged each run you actually
 * depart from it. Both are alpha placeholders — see the note at the top of CLAUDE.md.
 * The unlock must stay meaningfully larger than the fee or the purchase is pointless.
 */
export const DEPTH_UNLOCK_COST_PER_FLOOR = 40;
export const DEPTH_RUN_FEE_PER_FLOOR = 5;
```

- [ ] **Step 4: Add the functions**

In `src/systems/Economy.ts`, extend the `../types` import with `DEPTH_UNLOCK_COST_PER_FLOOR, DEPTH_RUN_FEE_PER_FLOOR` and add after `depthJumpCost`:

```typescript
/** One-time Essence cost to permanently unlock `floor` as a start point. Floor 1 is free. */
export function depthUnlockCost(floor: number): number {
  return Math.max(0, (floor - 1) * DEPTH_UNLOCK_COST_PER_FLOOR);
}

/** Per-run Essence fee for departing from an already-unlocked `floor`. Floor 1 is free. */
export function depthRunFee(floor: number): number {
  return Math.max(0, (floor - 1) * DEPTH_RUN_FEE_PER_FLOOR);
}
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/systems/Economy.test.ts` → PASS
Run: `npm test` → all pass. Run: `npx tsc --noEmit` → no output.

```bash
git add src/types.ts src/systems/Economy.ts src/systems/Economy.test.ts
git commit -m "feat: split depth cost into one-time unlock and per-run fee

depthUnlockCost gates a floor permanently; depthRunFee is charged each
departure. Tests pin the shape and the unlock-exceeds-fee relationship
rather than the placeholder values."
```

---

### Task 2: `PartyStatus` — resolve a stored party against the box

**Files:**
- Create: `src/systems/PartyStatus.ts`
- Create: `src/systems/PartyStatus.test.ts`

**Interfaces:**
- Consumes: `CreatureInstance` from `src/types.ts`; `getTemplate` from `src/data/creatures.ts`.
- Produces:
  - `type PartyStatus = { kind: 'ready'; members: CreatureInstance[] } | { kind: 'incomplete'; have: number } | { kind: 'missing'; missingNames: string[]; remaining: CreatureInstance[] }`
  - `resolvePartyStatus(defaultParty: string[], box: CreatureInstance[]): PartyStatus`
  - `PARTY_SIZE: number`

- [ ] **Step 1: Write the failing tests**

Create `src/systems/PartyStatus.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CreatureInstance } from '../types';
import { resolvePartyStatus, PARTY_SIZE } from './PartyStatus';

function makeCreature(instanceId: string, speciesId = 'ironjaw', over: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    instanceId, speciesId, nickname: null, starRating: 0, currentLevel: 1, levelCap: 5,
    permanentLevel: 1, essenceInvested: 0, abilities: [], traitSlots: [],
    lineage: { parentA: null, parentB: null },
    currentStats: { hp: 10, mp: 10, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
    tactic: 'fight_wisely',
    ...over,
  };
}

describe('resolvePartyStatus', () => {
  it('is ready when all three are present and active', () => {
    const box = [makeCreature('a'), makeCreature('b'), makeCreature('c')];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(status.kind).toBe('ready');
    if (status.kind === 'ready') {
      expect(status.members.map(m => m.instanceId)).toEqual(['a', 'b', 'c']);
    }
  });

  it('preserves the stored order, not box order', () => {
    const box = [makeCreature('a'), makeCreature('b'), makeCreature('c')];
    const status = resolvePartyStatus(['c', 'a', 'b'], box);
    if (status.kind !== 'ready') throw new Error('expected ready');
    expect(status.members.map(m => m.instanceId)).toEqual(['c', 'a', 'b']);
  });

  it('is incomplete on a brand-new game with no party set', () => {
    expect(resolvePartyStatus([], [])).toEqual({ kind: 'incomplete', have: 0 });
  });

  it('is incomplete with fewer than a full party', () => {
    const box = [makeCreature('a'), makeCreature('b')];
    expect(resolvePartyStatus(['a', 'b'], box)).toEqual({ kind: 'incomplete', have: 2 });
  });

  it('reports a retired member as missing, by name', () => {
    const box = [
      makeCreature('a'),
      makeCreature('b', 'ironjaw', { isRetired: true }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    expect(status.kind).toBe('missing');
    if (status.kind === 'missing') {
      expect(status.missingNames).toEqual(['Ironjaw']);
      expect(status.remaining.map(m => m.instanceId)).toEqual(['a', 'c']);
    }
  });

  it('prefers a nickname over the species name when reporting a missing member', () => {
    const box = [
      makeCreature('a'),
      makeCreature('b', 'ironjaw', { isRetired: true, nickname: 'Chomper' }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    if (status.kind !== 'missing') throw new Error('expected missing');
    expect(status.missingNames).toEqual(['Chomper']);
  });

  it('names every missing member, not just the first', () => {
    const box = [
      makeCreature('a', 'ironjaw', { isRetired: true }),
      makeCreature('b', 'emberwhelp', { isRetired: true }),
      makeCreature('c'),
    ];
    const status = resolvePartyStatus(['a', 'b', 'c'], box);
    if (status.kind !== 'missing') throw new Error('expected missing');
    expect(status.missingNames).toEqual(['Ironjaw', 'Emberwhelp']);
  });

  it('does not throw when a stored id is absent from the box entirely', () => {
    const box = [makeCreature('a'), makeCreature('c')];
    const status = resolvePartyStatus(['a', 'ghost-id', 'c'], box);
    expect(status.kind).toBe('missing');
    if (status.kind === 'missing') {
      expect(status.missingNames).toHaveLength(1);
      expect(status.remaining.map(m => m.instanceId)).toEqual(['a', 'c']);
    }
  });

  it('reports incomplete rather than missing when the party is both short and stale', () => {
    // Length is checked first: a two-id party is incomplete regardless of retirement.
    const box = [makeCreature('a', 'ironjaw', { isRetired: true })];
    expect(resolvePartyStatus(['a', 'b'], box)).toEqual({ kind: 'incomplete', have: 2 });
  });

  it('expects a party of three', () => {
    expect(PARTY_SIZE).toBe(3);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/systems/PartyStatus.test.ts`
Expected: FAIL — cannot resolve `./PartyStatus`.

- [ ] **Step 3: Implement**

Create `src/systems/PartyStatus.ts`:

```typescript
import { CreatureInstance } from '../types';
import { getTemplate } from '../data/creatures';

/** A run takes exactly three creatures. */
export const PARTY_SIZE = 3;

/**
 * Whether a stored default party can actually descend.
 *
 * `missing` is the ordinary consequence of the breeding loop, not a rare edge case:
 * breeding retires both parents, so any party containing a bred-away creature lands
 * here. It carries names so the UI can say which creature is gone rather than making
 * the player open the editor to find out.
 */
export type PartyStatus =
  | { kind: 'ready'; members: CreatureInstance[] }
  | { kind: 'incomplete'; have: number }
  | { kind: 'missing'; missingNames: string[]; remaining: CreatureInstance[] };

function displayName(c: CreatureInstance): string {
  return c.nickname ?? getTemplate(c.speciesId).name;
}

/**
 * Resolve `defaultParty` (instance ids) against the creature box.
 *
 * Length is checked before membership: a short party is `incomplete` whether or not
 * its members are also stale, because "pick more creatures" is the action either way.
 */
export function resolvePartyStatus(
  defaultParty: string[],
  box: CreatureInstance[],
): PartyStatus {
  if (defaultParty.length !== PARTY_SIZE) {
    return { kind: 'incomplete', have: defaultParty.length };
  }

  const members: CreatureInstance[] = [];
  const missingNames: string[] = [];

  for (const id of defaultParty) {
    const found = box.find(c => c.instanceId === id);
    if (found && !found.isRetired) {
      members.push(found);
    } else if (found) {
      missingNames.push(displayName(found));
    } else {
      // Not in the box at all — a stale save. We cannot name it, but we must not throw.
      missingNames.push('a former party member');
    }
  }

  if (missingNames.length > 0) return { kind: 'missing', missingNames, remaining: members };
  return { kind: 'ready', members };
}
```

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/systems/PartyStatus.test.ts` → PASS
Run: `npm test` and `npx tsc --noEmit` → clean.

```bash
git add src/systems/PartyStatus.ts src/systems/PartyStatus.test.ts
git commit -m "feat: PartyStatus resolves a stored party against the box

One function decides whether a default party can descend, so town and the
departure screen cannot disagree. Names missing members rather than
reporting a generic failure, since breeding retiring a parent is the
ordinary way a party goes stale."
```

---

### Task 3: `GameState` — default party, floor unlocks, save v4

**Files:**
- Modify: `src/managers/GameState.ts`
- Modify: `src/managers/GameState.test.ts`

**Interfaces:**
- Consumes: `depthUnlockCost`, `depthRunFee` (Task 1).
- Produces on `gameState`:
  - `defaultParty: string[]`, `unlockedFloors: number[]`
  - `setDefaultParty(ids: string[]): void`
  - `purchasableFloors(): number[]` — cleared-break floors not yet bought
  - `purchaseFloorUnlock(floor: number): boolean`
  - `canAffordStartFloor(floor: number): boolean`
  - `unlockedStartFloors()` — **meaning changes** to floor 1 plus *purchased* floors
  - `resolveRunStartFloor()` — **now throws** rather than substituting

- [ ] **Step 1: Write the failing tests**

Append to `src/managers/GameState.test.ts`:

```typescript
describe('default party', () => {
  it('is empty on a new game', () => {
    gameState.initializeNewGame(['ironjaw']);
    expect(gameState.defaultParty).toEqual([]);
  });

  it('stores a copy, so later edits to the caller array do not leak in', () => {
    const ids = ['a', 'b', 'c'];
    gameState.setDefaultParty(ids);
    ids.push('d');
    expect(gameState.defaultParty).toEqual(['a', 'b', 'c']);
  });

  it('round-trips through save and load', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.setDefaultParty(['x', 'y', 'z']);
    gameState.saveToLocalStorage();
    gameState.defaultParty = [];
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.defaultParty).toEqual(['x', 'y', 'z']);
  });
});

describe('floor unlocks', () => {
  beforeEach(() => {
    gameState.initializeNewGame(['ironjaw']);
  });

  it('offers nothing to buy before any break is cleared', () => {
    expect(gameState.purchasableFloors()).toEqual([]);
  });

  it('offers floor 6 once the floor-5 break is cleared', () => {
    gameState.recordBreakCleared(5);
    expect(gameState.purchasableFloors()).toEqual([6]);
  });

  it('starts with only floor 1 available even after clearing a break', () => {
    gameState.recordBreakCleared(5);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('adds a floor to the available list once bought, and stops offering it', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    expect(gameState.purchaseFloorUnlock(6)).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6]);
    expect(gameState.purchasableFloors()).toEqual([]);
  });

  it('deducts the unlock cost', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    const before = gameState.essence;
    gameState.purchaseFloorUnlock(6);
    expect(gameState.essence).toBe(before - depthUnlockCost(6));
  });

  it('refuses a floor whose break has not been cleared', () => {
    gameState.essence = 10_000;
    expect(gameState.purchaseFloorUnlock(6)).toBe(false);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('refuses when the player cannot afford it, without deducting', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 1;
    expect(gameState.purchaseFloorUnlock(6)).toBe(false);
    expect(gameState.essence).toBe(1);
  });

  it('does not double-charge for a floor already owned', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    const after = gameState.essence;
    expect(gameState.purchaseFloorUnlock(6)).toBe(false);
    expect(gameState.essence).toBe(after);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6]);
  });

  it('keeps available floors sorted regardless of purchase order', () => {
    gameState.recordBreakCleared(10);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(11);
    gameState.purchaseFloorUnlock(6);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6, 11]);
  });

  it('round-trips unlocked floors through save and load', () => {
    gameState.recordBreakCleared(10);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.saveToLocalStorage();
    gameState.unlockedFloors = [];
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6]);
  });
});

describe('resolveRunStartFloor', () => {
  beforeEach(() => {
    gameState.initializeNewGame(['ironjaw']);
  });

  it('is free at floor 1 and deducts nothing', () => {
    gameState.essence = 100;
    gameState.selectedStartFloor = 1;
    expect(gameState.resolveRunStartFloor()).toBe(1);
    expect(gameState.essence).toBe(100);
  });

  it('returns the selected floor and deducts exactly its fee', () => {
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.setSelectedStartFloor(6);
    const before = gameState.essence;
    expect(gameState.resolveRunStartFloor()).toBe(6);
    expect(gameState.essence).toBe(before - depthRunFee(6));
  });

  it('throws rather than departing from a floor the player cannot afford', () => {
    // Never substitute: picking floor 6 and silently starting on floor 1 reads as a bug.
    gameState.recordBreakCleared(5);
    gameState.essence = 10_000;
    gameState.purchaseFloorUnlock(6);
    gameState.setSelectedStartFloor(6);
    gameState.essence = 0;
    expect(() => gameState.resolveRunStartFloor()).toThrow();
  });

  it('throws rather than departing from a floor that was never unlocked', () => {
    gameState.selectedStartFloor = 11; // forced past setSelectedStartFloor's guard
    gameState.essence = 10_000;
    expect(() => gameState.resolveRunStartFloor()).toThrow();
  });

  it('does not deduct essence when it throws', () => {
    gameState.selectedStartFloor = 11;
    gameState.essence = 10_000;
    expect(() => gameState.resolveRunStartFloor()).toThrow();
    expect(gameState.essence).toBe(10_000);
  });
});

describe('canAffordStartFloor', () => {
  it('is always true for floor 1, even with no essence', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.essence = 0;
    expect(gameState.canAffordStartFloor(1)).toBe(true);
  });

  it('tracks the per-run fee for deeper floors', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.essence = depthRunFee(6);
    expect(gameState.canAffordStartFloor(6)).toBe(true);
    gameState.essence = depthRunFee(6) - 1;
    expect(gameState.canAffordStartFloor(6)).toBe(false);
  });
});

describe('save v3 -> v4 migration', () => {
  it('grants unlocked floors for breaks already cleared, so no depth is lost', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 3,
      essence: 500,
      deepestBreakCleared: 10,
      selectedStartFloor: 1,
      hasCompletedFirstRun: true,
      creatureBox: [],
      seenSpecies: [],
      battleSpeed: 1,
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1, 6, 11]);
    expect(gameState.defaultParty).toEqual([]);
    expect(gameState.essence).toBe(500);
  });

  it('grants nothing when no break was cleared', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 3, essence: 0, deepestBreakCleared: 0,
      selectedStartFloor: 1, hasCompletedFirstRun: false,
      creatureBox: [], seenSpecies: [], battleSpeed: 1,
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });

  it('does not re-grant on a v4 save that deliberately owns nothing', () => {
    // A v4 player who cleared breaks but chose not to buy must stay unbought.
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 4, essence: 0, deepestBreakCleared: 10,
      selectedStartFloor: 1, hasCompletedFirstRun: true,
      creatureBox: [], seenSpecies: [], battleSpeed: 1,
      defaultParty: [], unlockedFloors: [],
    }));
    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.unlockedStartFloors()).toEqual([1]);
  });
});
```

Add `depthUnlockCost, depthRunFee` to the file's imports from `../systems/Economy`.

The last migration test is the one that matters most: distinguishing "v3, field absent, grant it" from "v4, field present but empty, respect it" requires checking presence rather than truthiness. `data.unlockedFloors ?? grant()` handles this correctly; `data.unlockedFloors || grant()` does not, because `[]` is falsy-adjacent in the sense that `[].length === 0` — a naive implementation that grants whenever the array is empty would fail this test.

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/managers/GameState.test.ts`
Expected: FAIL — `setDefaultParty` is not a function.

- [ ] **Step 3: Add fields and methods**

In `src/managers/GameState.ts`, extend the `../systems/Economy` import with `depthUnlockCost, depthRunFee`.

Add fields after `hasCompletedFirstRun = false;`:

```typescript
  /** Instance ids of the standing party. Persisted; resolved via resolvePartyStatus. */
  defaultParty: string[] = [];
  /** Floors purchased from the Gatekeeper. Floor 1 is always available and never stored. */
  unlockedFloors: number[] = [];
```

Replace `unlockedStartFloors` and `resolveRunStartFloor` with:

```typescript
  setDefaultParty(instanceIds: string[]): void {
    this.defaultParty = [...instanceIds];
  }

  /**
   * Floors a run may start on: floor 1, plus every floor purchased at the Gatekeeper.
   * Clearing a break no longer grants a deep start on its own — it makes one purchasable.
   */
  unlockedStartFloors(): number[] {
    return [1, ...this.unlockedFloors].sort((a, b) => a - b);
  }

  /** Floors whose break is cleared but which have not been bought yet. */
  purchasableFloors(): number[] {
    const out: number[] = [];
    for (let f = 5; f <= this.deepestBreakCleared && f + 1 <= TOWER_FLOORS; f += 5) {
      const floor = f + 1;
      if (!this.unlockedFloors.includes(floor)) out.push(floor);
    }
    return out;
  }

  /** Buy a permanent unlock. Returns false if not purchasable, already owned, or unaffordable. */
  purchaseFloorUnlock(floor: number): boolean {
    if (!this.purchasableFloors().includes(floor)) return false;
    const cost = depthUnlockCost(floor);
    if (this.essence < cost) return false;
    this.essence -= cost;
    this.unlockedFloors.push(floor);
    this.unlockedFloors.sort((a, b) => a - b);
    return true;
  }

  /** Whether the per-run fee for `floor` is affordable right now. Floor 1 is always true. */
  canAffordStartFloor(floor: number): boolean {
    return this.essence >= depthRunFee(floor);
  }

  /**
   * Charge for and return the floor this run begins on.
   *
   * Deliberately throws rather than falling back. Departing from a floor the player did
   * not choose reads as a bug, so an unaffordable or unowned selection is a programming
   * error here — DepartureScene is the gate that must prevent it reaching this point.
   */
  resolveRunStartFloor(): number {
    const chosen = this.selectedStartFloor;
    if (chosen <= 1) return 1;
    if (!this.unlockedStartFloors().includes(chosen)) {
      throw new Error(`Start floor ${chosen} is not unlocked`);
    }
    const fee = depthRunFee(chosen);
    if (this.essence < fee) {
      throw new Error(`Cannot afford the ${fee} Essence fee for floor ${chosen}`);
    }
    this.essence -= fee;
    return chosen;
  }
```

In `initializeNewGame`, after `this.battleSpeed = 1;`:

```typescript
    this.defaultParty = [];
    this.unlockedFloors = [];
```

- [ ] **Step 4: Bump the save**

In `saveToLocalStorage`, change `version: 3` to `version: 4` and add:

```typescript
      defaultParty: this.defaultParty,
      unlockedFloors: this.unlockedFloors,
```

In `loadFromLocalStorage`, after the `battleSpeed` line:

```typescript
      // v4 additions.
      this.defaultParty = data.defaultParty ?? [];
      if (Array.isArray(data.unlockedFloors)) {
        this.unlockedFloors = [...data.unlockedFloors];
      } else {
        // v3 save: cleared breaks already granted deep starts under the old rules.
        // Grant them outright so nobody is asked to re-buy depth they earned.
        // Presence, not emptiness, is the test — a v4 player who owns nothing must stay that way.
        const granted: number[] = [];
        for (let f = 5; f <= this.deepestBreakCleared && f + 1 <= TOWER_FLOORS; f += 5) {
          granted.push(f + 1);
        }
        this.unlockedFloors = granted;
      }
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run src/managers/GameState.test.ts` → PASS
Run: `npm test` and `npx tsc --noEmit` → clean.

```bash
git add src/managers/GameState.ts src/managers/GameState.test.ts
git commit -m "feat: persistent default party and purchased floor unlocks

unlockedStartFloors now means bought, not merely earned; clearing a break
makes a floor purchasable. resolveRunStartFloor throws on an unaffordable
or unowned selection rather than silently departing elsewhere.

Save v4 grants unlockedFloors for every break a v3 save already cleared,
keyed on field presence so a v4 player who owns nothing stays that way."
```

---

### Task 4: Gatekeeper sells permanent unlocks

**Files:**
- Modify: `src/scenes/GatekeeperScene.ts`

**Interfaces:**
- Consumes: `purchasableFloors`, `purchaseFloorUnlock`, `unlockedStartFloors` (Task 3); `depthUnlockCost`, `depthRunFee` (Task 1).
- Produces: no exports; the Gatekeeper becomes a shop rather than a selector.

- [ ] **Step 1: Rewrite the scene**

Replace the whole body of `src/scenes/GatekeeperScene.ts`:

```typescript
import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { depthUnlockCost, depthRunFee } from '../systems/Economy';

export class GatekeeperScene extends Phaser.Scene {
  /**
   * Everything drawn, tracked so it can be destroyed on redraw. children.removeAll()
   * only detaches — it leaves interactive objects registered and clickable.
   */
  private tracked: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'GatekeeperScene' });
  }

  create(): void {
    this.tracked = [];
    this.draw();
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.tracked.push(obj);
    return obj;
  }

  private destroyTracked(): void {
    for (const o of this.tracked) o.destroy();
    this.tracked = [];
  }

  private draw(): void {
    this.destroyTracked();
    const cx = this.cameras.main.centerX;

    this.track(this.add.rectangle(480, 320, 960, 640, 0x1a1a2e));
    this.track(this.add.text(cx, 30, 'THE GATEKEEPER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(cx, 62, 'Unlock a deeper starting point. Permanent, bought once.', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    }));

    const owned = gameState.unlockedStartFloors().filter(f => f > 1);
    this.track(this.add.text(20, 112, owned.length > 0
      ? `Unlocked: ${owned.map(f => `Floor ${f}`).join(', ')}`
      : 'Unlocked: none yet — you always begin at Floor 1', {
      fontSize: '12px', color: '#88ccaa', fontFamily: 'monospace',
    }));

    const purchasable = gameState.purchasableFloors();

    if (purchasable.length === 0) {
      this.track(this.add.text(cx, 240, gameState.deepestBreakCleared === 0
        ? 'Clear the floor-5 mini-boss to earn your first deeper start.'
        : 'Nothing left to unlock at your current depth. Clear another break.', {
        fontSize: '14px', color: '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5));
    }

    purchasable.forEach((floor, i) => {
      const y = 170 + i * 62;
      const cost = depthUnlockCost(floor);
      const affordable = gameState.essence >= cost;

      const bg = this.track(this.add.rectangle(cx, y, 460, 52, affordable ? 0x222240 : 0x1c1c28, 0.9)
        .setStrokeStyle(2, affordable ? 0x66aaff : 0x333344));
      this.track(this.add.text(cx, y - 9, `Unlock Floor ${floor}  —  ${cost} Essence`, {
        fontSize: '15px', color: affordable ? '#ffffff' : '#666677', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.track(this.add.text(cx, y + 12, `then ${depthRunFee(floor)} Essence each run you start there`, {
        fontSize: '11px', color: affordable ? '#8899aa' : '#555566', fontFamily: 'monospace',
      }).setOrigin(0.5));

      if (affordable) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x334466));
        bg.on('pointerout', () => bg.setFillStyle(0x222240));
        bg.on('pointerdown', () => {
          gameState.purchaseFloorUnlock(floor);
          gameState.saveToLocalStorage();
          this.draw();
        });
      }
    });

    const back = this.track(this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }));
    back.on('pointerdown', () => this.scene.start('TownScene'));
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → no output. Run: `npm test` → all pass.

Note `depthJumpCost` is now unreferenced by this scene but still exists; Task 6 removes it.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GatekeeperScene.ts
git commit -m "feat: Gatekeeper sells permanent floor unlocks

Changes from setting a per-run selection to selling a one-time unlock.
Shows what is already owned, what a purchase costs, and the recurring fee
that follows it. Unaffordable options render disabled rather than hidden."
```

---

### Task 5: `DepartureScene`

**Files:**
- Create: `src/scenes/DepartureScene.ts`
- Modify: `src/main.ts` (register)

**Interfaces:**
- Consumes: `resolvePartyStatus`, `PartyStatus` (Task 2); `defaultParty`, `unlockedStartFloors`, `canAffordStartFloor`, `setSelectedStartFloor`, `setRunParty` (Task 3); `depthRunFee` (Task 1); `getTemplate`.
- Produces: a scene registered as `'DepartureScene'`. Not yet reachable — Task 6 wires `ENTER TOWER` to it.

- [ ] **Step 1: Create the scene**

Create `src/scenes/DepartureScene.ts`:

```typescript
import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { depthRunFee } from '../systems/Economy';
import { resolvePartyStatus } from '../systems/PartyStatus';

export class DepartureScene extends Phaser.Scene {
  private tracked: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'DepartureScene' });
  }

  create(): void {
    this.tracked = [];
    this.draw();
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.tracked.push(obj);
    return obj;
  }

  private destroyTracked(): void {
    for (const o of this.tracked) o.destroy();
    this.tracked = [];
  }

  private draw(): void {
    this.destroyTracked();
    const cx = this.cameras.main.centerX;

    this.track(this.add.rectangle(480, 320, 960, 640, 0x1a1a2e));
    this.track(this.add.text(cx, 40, 'DESCEND', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(20, 20, `Essence: ${gameState.essence}`, {
      fontSize: '14px', color: '#e0b060', fontFamily: 'monospace',
    }));

    const status = resolvePartyStatus(gameState.defaultParty, gameState.creatureBox);

    // The party this run takes. Town blocks departure on a bad party, so reaching
    // this screen with one is not expected — but render it rather than crash.
    if (status.kind !== 'ready') {
      this.track(this.add.text(cx, 200, 'Your party is not ready to descend.', {
        fontSize: '16px', color: '#ff8888', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.drawButton(cx, 300, 220, 'CHANGE PARTY', '#4488aa', () => {
        this.scene.start('PartySelectScene');
      });
      this.drawBack();
      return;
    }

    status.members.forEach((c, i) => {
      const x = 160 + i * 240;
      const template = getTemplate(c.speciesId);
      this.track(this.add.rectangle(x, 130, 48, 48, template.spriteColor));
      this.track(this.add.text(x + 34, 112, c.nickname ?? template.name, {
        fontSize: '13px', color: '#ffffff', fontFamily: 'monospace',
      }));
      this.track(this.add.text(x + 34, 132, `Lv ${c.permanentLevel}  HP ${c.currentStats.hp}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      }));
    });

    this.drawFloorChips();

    const floor = gameState.selectedStartFloor;
    const affordable = gameState.canAffordStartFloor(floor);

    if (affordable) {
      this.drawButton(cx, 470, 220, floor > 1 ? `DESCEND — Floor ${floor}` : 'DESCEND', '#44aa44', () => {
        gameState.setRunParty(gameState.defaultParty);
        this.scene.start('RunScene');
      });
    } else {
      // Never substitute a cheaper floor: the player picked this one.
      this.track(this.add.rectangle(cx, 470, 220, 50, 0x333333, 0.7).setStrokeStyle(2, 0x555555));
      this.track(this.add.text(cx, 470, 'DESCEND', {
        fontSize: '15px', color: '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.track(this.add.text(cx, 508,
        `Not enough Essence for Floor ${floor} (${depthRunFee(floor)} needed) — choose another floor`, {
          fontSize: '12px', color: '#ff8888', fontFamily: 'monospace',
        }).setOrigin(0.5));
    }

    this.drawButton(cx, 545, 220, 'CHANGE PARTY', '#4488aa', () => {
      this.scene.start('PartySelectScene');
    });

    this.drawBack();
  }

  private drawFloorChips(): void {
    const cx = this.cameras.main.centerX;
    const floors = gameState.unlockedStartFloors();

    this.track(this.add.text(cx, 250, 'Start from:', {
      fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5));

    const spacing = 130;
    const startX = cx - ((floors.length - 1) * spacing) / 2;

    floors.forEach((floor, i) => {
      const x = startX + i * spacing;
      const selected = floor === gameState.selectedStartFloor;
      const affordable = gameState.canAffordStartFloor(floor);
      const fee = depthRunFee(floor);

      const fill = !affordable ? 0x1c1c28 : selected ? 0x334466 : 0x222240;
      const stroke = !affordable ? 0x333344 : selected ? 0x66aaff : 0x444466;
      const chip = this.track(this.add.rectangle(x, 300, 116, 52, fill, 0.95)
        .setStrokeStyle(2, stroke));

      this.track(this.add.text(x, 290, `Floor ${floor}`, {
        fontSize: '14px', color: affordable ? '#ffffff' : '#666677', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.track(this.add.text(x, 310, floor === 1 ? 'free' : `${fee} Essence`, {
        fontSize: '10px', color: affordable ? '#8899aa' : '#555566', fontFamily: 'monospace',
      }).setOrigin(0.5));

      // Unaffordable chips stay visible but unselectable — hiding a floor the player
      // bought would make them wonder where their purchase went.
      if (affordable && !selected) {
        chip.setInteractive({ useHandCursor: true });
        chip.on('pointerdown', () => {
          gameState.setSelectedStartFloor(floor);
          gameState.saveToLocalStorage();
          this.draw();
        });
      }
    });
  }

  private drawButton(x: number, y: number, w: number, label: string, color: string, cb: () => void): void {
    const bg = this.track(this.add.rectangle(x, y, w, 50,
      Phaser.Display.Color.HexStringToColor(color).color, 0.85)
      .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true }));
    this.track(this.add.text(x, y, label, {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5));
    bg.on('pointerover', () => bg.setAlpha(1));
    bg.on('pointerout', () => bg.setAlpha(0.85));
    bg.on('pointerdown', cb);
  }

  private drawBack(): void {
    const back = this.track(this.add.text(30, 600, '← Back to town', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }));
    back.on('pointerdown', () => this.scene.start('TownScene'));
  }
}
```

- [ ] **Step 2: Register it**

In `src/main.ts`, add the import after the `BestiaryScene` import:

```typescript
import { DepartureScene } from './scenes/DepartureScene';
```

and append `DepartureScene` to the `scene` array in `config`.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → no output. Run: `npm test` → all pass. Run: `npm run build` → succeeds.

The scene is registered but unreachable until Task 6 — that is intentional, so the flow switch happens atomically and the game stays playable at every commit.

```bash
git add src/scenes/DepartureScene.ts src/main.ts
git commit -m "feat: DepartureScene — pre-run party and start-floor gate

Shows the party being taken and a chip per unlocked floor with its per-run
fee. An unaffordable floor stays selected and visible with DESCEND
disabled and the reason stated — never substituted for a cheaper one.

Registered but not yet reachable; the flow switch lands next."
```

---

### Task 6: Wire the flow — town, party editor, remove the old cost

**Files:**
- Modify: `src/scenes/TownScene.ts`
- Modify: `src/scenes/PartySelectScene.ts`
- Modify: `src/systems/Economy.ts` (remove `depthJumpCost`)
- Modify: `src/systems/Economy.test.ts` (remove its tests)

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: `ENTER TOWER` → `DepartureScene`; `PARTY` → `PartySelectScene`; `PartySelectScene` writes `defaultParty` and returns to town.

- [ ] **Step 1: Make PartySelectScene a party editor**

In `src/scenes/PartySelectScene.ts`:

Add to the imports: `import { PARTY_SIZE } from '../systems/PartyStatus';`

In `create()`, initialise `this.selected` from the stored party instead of empty, keeping only ids still present and active:

```typescript
    const available = gameState.creatureBox.filter(c => !c.isRetired);
    this.selected = gameState.defaultParty.filter(
      id => available.some(c => c.instanceId === id),
    );
```

Place this **before** the `available.forEach(...)` loop that builds the cards, and inside that loop pre-highlight a card whose creature is already selected — after the existing `bg` is created:

```typescript
      if (this.selected.includes(creature.instanceId)) {
        bg.setStrokeStyle(3, 0x44ff44);
      }
```

Change the confirm handler to save and return to town:

```typescript
    this.confirmBtn.on('pointerdown', () => {
      if (this.selected.length === PARTY_SIZE) {
        gameState.setDefaultParty(this.selected);
        gameState.saveToLocalStorage();
        this.scene.start('TownScene');
      }
    });
```

Update the two header strings so the screen reads as an editor rather than a run gate — `'SELECT YOUR PARTY (3)'` becomes `'YOUR PARTY (3)'`, and the subtitle `'Click creatures to select/deselect'` becomes `'Click to select. This party is used for every descent.'`

**Then call `this.updateConfirm()` as the last line of `create()`.** The confirm button's label is written once at construction as the literal `'CONFIRM (0/3)'`, and only `toggleSelect` refreshes it. Without this call, opening the editor with a full party pre-selected shows a live, clickable button reading "CONFIRM (0/3)" — the count wrong and the enabled styling wrong. This is the one line that makes pre-selection actually look pre-selected.

- [ ] **Step 2: Add the town party display and PARTY button**

In `src/scenes/TownScene.ts`, add imports:

```typescript
import { resolvePartyStatus } from '../systems/PartyStatus';
```

Insert a party panel before the vendor row (the `const vendorY = 430;` line). It renders from the same `resolvePartyStatus` the departure screen uses, so the two cannot disagree:

```typescript
    // Party panel — the standing party, or why it cannot descend.
    //
    // NOTE ON PLACEMENT: the creature-box list above lays out at
    // `135 + floor(i / 6) * 75`, so it reaches y=360 once the box holds 19+
    // creatures and would collide with this panel. Before committing, check the
    // box row count and move this panel down (or cap the box list's visible rows)
    // if they overlap. Do not just leave them stacked — see Step 6.
    const status = resolvePartyStatus(gameState.defaultParty, gameState.creatureBox);
    this.add.text(20, 330, 'Descent Party', {
      fontSize: '15px', color: '#88ccff', fontFamily: 'monospace',
    });

    if (status.kind === 'ready') {
      status.members.forEach((c, i) => {
        const template = getTemplate(c.speciesId);
        const x = 30 + i * 230;
        this.add.rectangle(x + 16, 372, 30, 30, template.spriteColor);
        this.add.text(x + 38, 362, c.nickname ?? template.name, {
          fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
        });
        this.add.text(x + 38, 378, `Lv ${c.permanentLevel}`, {
          fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
        });
      });
    } else if (status.kind === 'incomplete') {
      this.add.text(30, 365, `Choose ${3 - status.have} more — set your party in PARTY.`, {
        fontSize: '13px', color: '#ffaa66', fontFamily: 'monospace',
      });
    } else {
      // Name the creature that left. "Party invalid" would make the player open the
      // editor just to work out what changed — breeding retires parents constantly.
      this.add.text(30, 365, `${status.missingNames.join(' and ')} is no longer available.`, {
        fontSize: '13px', color: '#ffaa66', fontFamily: 'monospace',
      });
      this.add.text(30, 383, 'Set a new party in PARTY.', {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
      });
    }
```

- [ ] **Step 3: Rewire the buttons**

Still in `src/scenes/TownScene.ts`, replace the run/breed/new-game row so `ENTER TOWER` goes to the departure screen, gated on the party being ready, and a `PARTY` button is added. Spread four buttons across the row:

```typescript
    // Run / party / breed / new game (row 2)
    const btnY = 500;
    const canDescend = status.kind === 'ready';
    this.createButton(cx - 285, btnY, 'ENTER TOWER', canDescend ? '#44aa44' : '#2a4a2a', () => {
      if (canDescend) this.scene.start('DepartureScene');
    });
    this.createButton(cx - 95, btnY, 'PARTY', '#4488aa', () => {
      this.scene.start('PartySelectScene');
    });
    this.createButton(cx + 95, btnY, 'BREED', '#aa44aa', () => {
      if (activeCreatures.length >= 2) {
        this.scene.start('BreedingScene');
      }
    });
    this.createButton(cx + 285, btnY, 'NEW GAME', '#aa4444', () => {
      localStorage.removeItem('hollow_kin_save');
      this.scene.start('BootScene');
    });
```

`createButton` draws 160-wide rectangles, so at ±285 and ±95 the four sit 30px apart and span 155–805 of the 960 canvas.

- [ ] **Step 4: Remove the superseded cost function**

In `src/systems/Economy.ts`, delete `depthJumpCost` entirely. In `src/systems/Economy.test.ts`, delete the `describe('depthJumpCost', ...)` block and remove `depthJumpCost` from the imports.

Run `grep -rn "depthJumpCost" src/` and confirm no references remain.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → no output. Run: `npm test` → all pass. Run: `npm run build` → succeeds.

- [ ] **Step 6: Manual verification**

**Keep the browser tab focused and visible** — Phaser's loop stops stepping in a backgrounded tab, which makes everything look broken (see `CLAUDE.md`).

Run `npm run dev`. Check:
- Town shows a Descent Party panel. On a fresh save it says how many more to choose and `ENTER TOWER` is dimmed and does nothing.
- `PARTY` opens the editor with nothing pre-selected. Pick three, confirm, and it returns to town with them shown.
- Re-open `PARTY`. All three must be pre-highlighted **and the button must read `CONFIRM (3/3)` in its enabled styling** — if it reads `(0/3)`, the `updateConfirm()` call from Step 1 is missing.
- **Layout check:** the town creature box grows with every capture and breed. Confirm the box list does not run into the Descent Party panel. If your box is small, temporarily verify by eye that ~19 creatures would still fit above y=330; if not, move the panel or cap the box's visible rows.
- `ENTER TOWER` now opens the departure screen: the three creatures, a `Floor 1 — free` chip, DESCEND.
- DESCEND starts the run with that party.
- Return to town, breed two party members away, and the panel names them and blocks `ENTER TOWER`.
- With a break cleared and Essence in hand, the Gatekeeper offers an unlock; buy it, then the departure screen shows a second chip. Select it and DESCEND — Essence drops by the per-run fee, not the unlock cost.
- Spend Essence down below that fee, return to the departure screen: the chip is greyed, DESCEND is disabled, the message names the floor, and **you are not moved to a different floor**.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/TownScene.ts src/scenes/PartySelectScene.ts src/systems/Economy.ts src/systems/Economy.test.ts
git commit -m "feat: wire the departure flow

ENTER TOWER opens the departure screen instead of party select, and is
disabled while the party cannot descend. PartySelectScene becomes a party
editor that writes defaultParty and returns to town. Town shows the
standing party, or names the creature that left.

Removes depthJumpCost, superseded by the unlock/fee split."
```

---

## Post-Implementation

- [ ] `npm test` and `npm run build` once more.
- [ ] Update `CLAUDE.md`: describe the departure flow under working systems, note save v4, and correct the depth-jump line — it currently says "buy a deeper start at the Gatekeeper (per-run Essence cost)", which is now half wrong.
- [ ] Update `economy-balancing.md`'s depth-jump entries and the Balancing Levers list to cover both the unlock cost and the per-run fee.
- [ ] Playtest the open question from spec §10: does the departure screen earn its click, or does it become a speed bump? If the latter, the fallback is moving the party and floor display into town and letting ENTER TOWER descend directly — the data model supports that without change.

---

## Self-Review Notes

**Spec coverage.** §2 data model → Task 3. §3 departure screen → Task 5. §4 town and party editor → Task 6. §5 stale parties → Task 2 (logic) and Task 6 (display). §6 cost split → Tasks 1, 3, 4. §7 architecture → the file list matches. §8 testing → Tasks 1–3 carry the named cases, including the "deepest affordable" trap being absent by design. §9 out of scope → nothing here builds presets, reordering, or substitution.

**Ordering keeps the game playable at every commit.** Task 1 leaves `depthJumpCost` in place so `GameState` and the Gatekeeper keep compiling; Task 5 registers an unreachable scene; Task 6 flips the flow and removes the dead function in one commit. No intermediate state has a broken `ENTER TOWER`.

**One judgment call worth flagging:** Task 3 makes `resolveRunStartFloor` throw. That is deliberate — it is the last line of defence behind a UI gate, and a throw surfaces a gate failure loudly instead of quietly relocating the player. The risk is an uncaught exception reaching the player if Task 6's gating is wrong, which is why Task 6's manual verification explicitly exercises the unaffordable path.

**Alpha-appropriate tests.** No test asserts a specific cost value. They pin shape (free at floor 1, rising with depth), relationships (unlock exceeds fee; fee below the old flat cost), and derivation from constants — so retuning the placeholders does not redden the suite, per the alpha note in `CLAUDE.md`.
