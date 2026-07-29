# Expedition Commitment & Consumables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove free flight from the tower — departure becomes something earned at boss floors or carried as a Waystone — and grow the backpack's two placeholder items into a nine-item consumable pool usable in battle and on the run map.

**Architecture:** Two new pure systems modules (`Departure.ts`, `Items.ts`) hold all the logic; Phaser scenes only render and route. Departure state is *derived* from the descent, never stored. Item resolution splits along the seam the codebase already has — `CombatEngine` owns combat state, `Recovery` owns run state — and `Items.ts` dispatches to whichever applies, returning an outcome the scene acts on rather than ending battles or runs itself.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest.

**Spec:** `docs/superpowers/specs/2026-07-29-expedition-commitment-and-consumables-design.md`

## Global Constraints

- **`SAVE_VERSION` stays at 7.** No field may be added to anything in `saveToLocalStorage`. `currentRun` is not persisted, so `RunState` is free; `Backpack` and `CreatureInstance` are not.
- **Every number in this plan is an alpha placeholder.** Tests assert shape and relationships — never a magic value. `expect(x).toBe(75)` is a plan violation; `expect(bossDamage).toBeLessThan(normalDamage)` is correct.
- **A wipe costs exactly one thing, at random, from unprotected slots.** Nothing here may make an item categorically wipe-safe. Protection stays positional.
- **Item consumption is the caller's job**, and only on a non-`refused` outcome. Mirrors the existing `tryBuyItem` rule: never take payment for something you can't deliver.
- **Run `npx tsc --noEmit` before every commit.** `npm run build` runs `tsc` and a broken type is the most likely failure mode in scene edits.
- Test command is `npm test` (vitest run). Single file: `npx vitest run src/systems/Foo.test.ts`.
- Test fixtures live in `src/systems/testFixtures.ts` — `makeTestCreature(opts)` and `testStats(over)`. It is deliberately **not** named `*.test.ts`. Use it; do not import from a `.test.ts` file.

---

### Task 1: Departure — the derived gate

**Files:**
- Create: `src/systems/Departure.ts`
- Test: `src/systems/Departure.test.ts`

**Interfaces:**
- Consumes: `RunState`, `Encounter`, `Backpack` from `src/types.ts`.
- Produces: `canDepart(run: RunState): boolean`, `nextDepartureFloor(run: RunState): number | null`, `hasWaystone(bag: Backpack): boolean`. Task 6 renders all three.

- [ ] **Step 1: Write the failing test**

Create `src/systems/Departure.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Backpack, Encounter, RunState } from '../types';
import { canDepart, hasWaystone, nextDepartureFloor } from './Departure';

function encounter(index: number, floor: number, type: Encounter['type']): Encounter {
  return { type, floor, index };
}

/** A descent with bosses at floors 5 and 10, combat elsewhere. */
function descent(): Encounter[] {
  return Array.from({ length: 10 }, (_, i) =>
    encounter(i, i + 1, (i + 1) % 5 === 0 ? 'boss' : 'combat'));
}

function runAt(index: number, startFloor = 1): RunState {
  return {
    startFloor,
    currentEncounterIndex: index,
    encounters: descent(),
    choices: [],
    obols: 0,
    partyHp: {},
    partyMp: {},
    partyKO: {},
    xpEarned: 0,
    autoCombat: false,
  };
}

function bag(slots: Backpack['slots']): Backpack {
  return { slots, guaranteedSlots: 2 };
}

describe('canDepart', () => {
  it('is closed at the start of a run, before anything is cleared', () => {
    expect(canDepart(runAt(-1))).toBe(false);
  });

  it('is closed on an ordinary floor', () => {
    expect(canDepart(runAt(0))).toBe(false);
  });

  it('opens on the boss floor just cleared', () => {
    expect(canDepart(runAt(4))).toBe(true); // index 4 === floor 5 === boss
  });

  it('closes again once the party commits to the next room', () => {
    expect(canDepart(runAt(5))).toBe(false);
  });
});

describe('nextDepartureFloor', () => {
  it('reports the first boss ahead at the start of a run', () => {
    expect(nextDepartureFloor(runAt(-1))).toBe(5);
  });

  it('looks strictly ahead, not at the boss just cleared', () => {
    expect(nextDepartureFloor(runAt(4))).toBe(10);
  });

  it('is null once no boss remains', () => {
    expect(nextDepartureFloor(runAt(9))).toBeNull();
  });

  it('reads the generated descent rather than assuming a cadence', () => {
    // A descent whose only boss sits at floor 3 must report 3, not 5.
    const run = runAt(-1);
    run.encounters = [
      encounter(0, 1, 'combat'),
      encounter(1, 2, 'combat'),
      encounter(2, 3, 'boss'),
    ];
    expect(nextDepartureFloor(run)).toBe(3);
  });
});

describe('hasWaystone', () => {
  it('is false for an empty bag', () => {
    expect(hasWaystone(bag([null, null]))).toBe(false);
  });

  it('is false when carrying some other item', () => {
    expect(hasWaystone(bag([{ kind: 'item', itemId: 'mending_draught' }]))).toBe(false);
  });

  it('is true when a waystone is carried', () => {
    expect(hasWaystone(bag([null, { kind: 'item', itemId: 'waystone' }]))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/Departure.test.ts`
Expected: FAIL — `Failed to resolve import "./Departure"`.

- [ ] **Step 3: Write the implementation**

Create `src/systems/Departure.ts`:

```ts
import { Backpack, RunState } from '../types';

/**
 * When the party may walk out of the tower, and where the next chance is.
 *
 * Pure and Phaser-free, like Departure's neighbours in this folder. The whole
 * module exists so that "can I leave?" has exactly one answer, computed the same
 * way by the run map's button, its header line and its commitment modal.
 *
 * Departure state is DERIVED, never stored. Committing to a room advances
 * `currentEncounterIndex`, which closes the gate as a side effect of the move the
 * player already makes — so there is no flag to keep in sync, and a fresh run
 * reads closed for free because the index starts at -1. This follows the same
 * reasoning as breed-readiness (see CLAUDE.md): a stored copy of a derivable fact
 * is a bug waiting to happen.
 */

/**
 * Departure is open exactly on the boss floor just cleared.
 *
 * Entering the tower is itself a commitment, so a run that has cleared nothing
 * (`currentEncounterIndex === -1`) is closed regardless of where it started.
 */
export function canDepart(run: RunState): boolean {
  const current = run.encounters[run.currentEncounterIndex];
  return run.currentEncounterIndex >= 0 && current?.type === 'boss';
}

/**
 * Floor of the next boss ahead in the descent, or null when none remains.
 *
 * Deliberately scans the generated encounter list rather than computing the next
 * multiple of five. The descent is the authority on where bosses actually are,
 * and an arithmetic shortcut here could disagree with it — which would show the
 * player a promised exit floor that never arrives.
 */
export function nextDepartureFloor(run: RunState): number | null {
  for (let i = run.currentEncounterIndex + 1; i < run.encounters.length; i++) {
    if (run.encounters[i].type === 'boss') return run.encounters[i].floor;
  }
  return null;
}

/** Does the bag hold anything that can end the expedition early? */
export function hasWaystone(bag: Backpack): boolean {
  return bag.slots.some(s => s !== null && s.kind === 'item' && s.itemId === 'waystone');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/Departure.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/systems/Departure.ts src/systems/Departure.test.ts
git commit -m "feat: derive departure gating from the descent"
```

---

### Task 2: CombatEngine primitives for the new item effects

**Files:**
- Modify: `src/systems/CombatEngine.ts` (add after `applyBuffDebuff`, ~line 113)
- Test: `src/systems/CombatEngine.test.ts` (append a new `describe` block)

**Interfaces:**
- Consumes: `CombatCreature`, `StatName`, `StatusType` from `src/types.ts`; `applyDamage` already in this file.
- Produces: `revive(target, hpFraction, mpFraction): boolean`, `clearNegativeStatuses(target): StatusType[]`, `stripPositiveStages(target): StatName[]`, `applyPercentDamage(target, fraction): number`. Task 4 calls all four.

- [ ] **Step 1: Write the failing test**

Append to `src/systems/CombatEngine.test.ts`:

```ts
describe('item effect primitives', () => {
  it('revive refuses a creature that is still standing', () => {
    const c = makeTestCreature();
    expect(revive(c, 0.25, 0.25)).toBe(false);
  });

  it('revive brings back a downed creature above zero HP', () => {
    const c = makeTestCreature({ hp: 0 });
    expect(revive(c, 0.25, 0.25)).toBe(true);
    expect(c.isKnockedOut).toBe(false);
    expect(c.currentHp).toBeGreaterThan(0);
  });

  it('revive never returns someone at zero HP even on a tiny fraction', () => {
    const c = makeTestCreature({ hp: 0 });
    revive(c, 0.0001, 0);
    expect(c.currentHp).toBeGreaterThanOrEqual(1);
  });

  it('clearNegativeStatuses empties the list and reports what went', () => {
    const c = makeTestCreature();
    c.statusEffects = [
      { type: 'poison', turnsRemaining: 3 },
      { type: 'burn', turnsRemaining: 2 },
    ];
    const removed = clearNegativeStatuses(c);
    expect(removed).toEqual(['poison', 'burn']);
    expect(c.statusEffects).toEqual([]);
  });

  it('clearNegativeStatuses on a clean creature reports nothing', () => {
    expect(clearNegativeStatuses(makeTestCreature())).toEqual([]);
  });

  it('stripPositiveStages clears buffs but leaves debuffs alone', () => {
    const c = makeTestCreature();
    c.buffStages = { str: 2, def: -1, spd: 3 };
    const cleared = stripPositiveStages(c);
    expect(cleared.sort()).toEqual(['spd', 'str']);
    expect(c.buffStages.str).toBe(0);
    expect(c.buffStages.spd).toBe(0);
    expect(c.buffStages.def).toBe(-1); // a debuff is the enemy's problem, not ours to fix
  });

  it('applyPercentDamage scales with the target maximum HP', () => {
    const small = makeTestCreature({ stats: { hp: 100 } });
    const large = makeTestCreature({ stats: { hp: 400 } });
    expect(applyPercentDamage(large, 0.25)).toBeGreaterThan(applyPercentDamage(small, 0.25));
  });

  it('applyPercentDamage ignores DEF entirely', () => {
    const soft = makeTestCreature({ stats: { hp: 200, def: 1 } });
    const armoured = makeTestCreature({ stats: { hp: 200, def: 999 } });
    expect(applyPercentDamage(armoured, 0.25)).toBe(applyPercentDamage(soft, 0.25));
  });

  it('applyPercentDamage knocks out and reports only the damage actually dealt', () => {
    const c = makeTestCreature({ stats: { hp: 100 }, hp: 10 });
    expect(applyPercentDamage(c, 0.5)).toBe(10); // dealt, not the notional 50
    expect(c.isKnockedOut).toBe(true);
  });
});
```

Add the four names to this file's existing import from `./CombatEngine`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/CombatEngine.test.ts`
Expected: FAIL — `revive is not a function` (or an import error for the four new names).

- [ ] **Step 3: Write the implementation**

In `src/systems/CombatEngine.ts`, ensure `StatusType` is in the import from `../types`, then add directly below `applyBuffDebuff`:

```ts
/**
 * Bring a knocked-out creature back. Returns false — and changes nothing — when
 * the target is still standing, so a caller can refuse the item rather than
 * consuming it for no effect.
 *
 * The HP floor of 1 matters: a low fraction against a low-HP creature otherwise
 * floors to 0, which would revive someone directly back into a knockout.
 */
export function revive(target: CombatCreature, hpFraction: number, mpFraction: number): boolean {
  if (!target.isKnockedOut) return false;
  target.isKnockedOut = false;
  target.currentHp = Math.max(1, Math.min(target.maxHp, Math.floor(target.maxHp * hpFraction)));
  target.currentMp = Math.min(target.maxMp, Math.floor(target.maxMp * mpFraction));
  return true;
}

/** Remove every status, reporting what was cleared. All statuses are negative today. */
export function clearNegativeStatuses(target: CombatCreature): StatusType[] {
  const removed = target.statusEffects.map(s => s.type);
  target.statusEffects = [];
  return removed;
}

/**
 * Zero out positive stat stages only, reporting which stats were cleared.
 *
 * Leaving negative stages untouched is the point: this counters a buffed elite,
 * it is not a cleanse. Clearing debuffs too would hand the enemy a favour.
 */
export function stripPositiveStages(target: CombatCreature): StatName[] {
  const cleared: StatName[] = [];
  for (const stat of Object.keys(target.buffStages) as StatName[]) {
    if ((target.buffStages[stat] ?? 0) > 0) {
      target.buffStages[stat] = 0;
      cleared.push(stat);
    }
  }
  return cleared;
}

/**
 * Damage as a fraction of the target's maximum HP, returning the damage actually
 * dealt (capped at the target's remaining HP).
 *
 * Deliberately bypasses `calculateDamage`: ignoring DEF and the type chart is
 * exactly what earns a fixed-damage item a backpack slot when the party's
 * abilities are being resisted, and is why it cannot just be a zero-MP ability.
 */
export function applyPercentDamage(target: CombatCreature, fraction: number): number {
  const intended = Math.max(1, Math.floor(target.maxHp * fraction));
  const dealt = Math.min(intended, target.currentHp);
  applyDamage(target, intended);
  return dealt;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/CombatEngine.test.ts`
Expected: PASS — all pre-existing tests plus 9 new ones.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/systems/CombatEngine.ts src/systems/CombatEngine.test.ts
git commit -m "feat: revive, status clear, buff strip and percent damage primitives"
```

---

### Task 3: The nine-item catalog

**Files:**
- Modify: `src/data/items.ts` (full rewrite)
- Test: `src/data/items.test.ts` (create)

**Interfaces:**
- Consumes: `StatName` from `src/types.ts`.
- Produces: `ItemDefinition` (now with `usableIn` and `targeting`), `ItemUsableIn`, `ItemTargeting`, `ITEMS`, `ITEM_LIST`, `getItem(id)`. Tasks 4, 5, 7, 8, 10 all import from here.

**Note:** `getItem` keeps its existing fallback-to-first-item behaviour rather than throwing — a corrupted `itemId` in a saved backpack must not crash the boot path. This is the opposite of `getTemplate`, which throws, and the difference is deliberate: a bad species id is unrecoverable, a bad item id is one wasted slot.

- [ ] **Step 1: Write the failing test**

Create `src/data/items.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ITEMS, ITEM_LIST, getItem } from './items';

describe('item catalog authoring', () => {
  it('keys every entry by its own id', () => {
    for (const [key, def] of Object.entries(ITEMS)) expect(def.id).toBe(key);
  });

  it('gives every item a name and a description', () => {
    for (const def of ITEM_LIST) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it('carries the eight pitched items plus the pre-existing buff', () => {
    for (const id of [
      'mending_draught', 'moonwater', 'hollow_candle', 'clearroot', 'power_increase',
      'grave_ash', 'null_salt', 'smoke_husk', 'waystone',
    ]) {
      expect(ITEMS[id]).toBeDefined();
    }
  });

  it('only lets effects that survive a battle be used on the map', () => {
    // RunState tracks partyHp/partyMp/partyKO and nothing else, so any other
    // effect kind would consume the item and silently do nothing out there.
    const mapSafe = new Set(['heal', 'restore_mp', 'revive', 'depart']);
    for (const def of ITEM_LIST) {
      if (def.usableIn === 'map' || def.usableIn === 'both') {
        expect(mapSafe.has(def.effect.kind)).toBe(true);
      }
    }
  });

  it('targets nothing with the two effects that act on the whole run or battle', () => {
    for (const def of ITEM_LIST) {
      if (def.effect.kind === 'depart' || def.effect.kind === 'escape_battle') {
        expect(def.targeting).toBe('none');
      }
    }
  });

  it('only revives with downed-ally targeting, and only downed-ally targeting revives', () => {
    for (const def of ITEM_LIST) {
      expect(def.effect.kind === 'revive').toBe(def.targeting === 'downed_ally');
    }
  });

  it('hurts a boss less than an ordinary enemy with percent damage', () => {
    for (const def of ITEM_LIST) {
      if (def.effect.kind === 'percent_damage') {
        expect(def.effect.bossFraction).toBeLessThan(def.effect.fraction);
        expect(def.effect.bossFraction).toBeGreaterThan(0);
      }
    }
  });

  it('falls back rather than throwing on an unknown id', () => {
    expect(getItem('no_such_item')).toBe(ITEM_LIST[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/items.test.ts`
Expected: FAIL — `ITEMS.moonwater` is undefined, and `def.usableIn` does not exist.

- [ ] **Step 3: Write the implementation**

Replace `src/data/items.ts` entirely:

```ts
import { StatName } from '../types';

/**
 * The expedition consumable pool — bought at a shop, carried in the backpack,
 * spent to answer a specific danger.
 *
 * `usableIn` and `targeting` exist so neither the combat scene nor the run map
 * has to hard-code item ids to know what to offer. Adding an item is a data
 * change; no scene should ever grow a branch named after one.
 *
 * Alpha placeholder values throughout — see the note at the top of CLAUDE.md.
 */

/**
 * Where an item may be used. `combat_non_boss` exists for the escape item:
 * encoding the boss restriction as data keeps it testable and keeps CombatScene
 * free of item-specific special cases.
 */
export type ItemUsableIn = 'combat' | 'combat_non_boss' | 'map' | 'both';

export type ItemTargeting = 'living_ally' | 'downed_ally' | 'enemy' | 'none';

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  usableIn: ItemUsableIn;
  targeting: ItemTargeting;
  effect:
    | { kind: 'heal'; amount: number }                      // fraction of max HP
    | { kind: 'restore_mp'; amount: number }                // fraction of max MP
    | { kind: 'revive'; hpAmount: number; mpAmount: number }
    | { kind: 'cure_status' }
    | { kind: 'buff'; stat: StatName; stages: number }
    | { kind: 'percent_damage'; fraction: number; bossFraction: number }
    | { kind: 'strip_buffs' }
    | { kind: 'escape_battle' }
    | { kind: 'depart' };
}

/**
 * Only `heal`, `restore_mp`, `revive` and `depart` may be marked map-usable.
 * RunState carries partyHp, partyMp and partyKO and nothing else — buff stages
 * and statuses are discarded when a battle ends — so any other effect out there
 * would consume the item and silently do nothing. `items.test.ts` pins this.
 */
export const ITEMS: Record<string, ItemDefinition> = {
  mending_draught: {
    id: 'mending_draught',
    name: 'Mending Draught',
    description: 'Restores HP to one ally.',
    usableIn: 'both',
    targeting: 'living_ally',
    effect: { kind: 'heal', amount: 0.4 },
  },
  moonwater: {
    id: 'moonwater',
    name: 'Moonwater',
    description: 'Restores MP to one ally.',
    usableIn: 'both',
    targeting: 'living_ally',
    effect: { kind: 'restore_mp', amount: 0.4 },
  },
  hollow_candle: {
    id: 'hollow_candle',
    name: 'Hollow Candle',
    description: 'Wakes one fallen ally with a little HP and MP.',
    usableIn: 'both',
    targeting: 'downed_ally',
    effect: { kind: 'revive', hpAmount: 0.25, mpAmount: 0.25 },
  },
  clearroot: {
    id: 'clearroot',
    name: 'Clearroot',
    description: 'Clears every affliction from one ally.',
    usableIn: 'combat',
    targeting: 'living_ally',
    effect: { kind: 'cure_status' },
  },
  power_increase: {
    id: 'power_increase',
    name: 'Power Increase',
    description: "Raises one ally's STR by a stage.",
    usableIn: 'combat',
    targeting: 'living_ally',
    effect: { kind: 'buff', stat: 'str', stages: 1 },
  },
  grave_ash: {
    id: 'grave_ash',
    name: 'Grave Ash',
    description: 'Burns one enemy for a share of its vigour. Wardens shrug most of it off.',
    usableIn: 'combat',
    targeting: 'enemy',
    effect: { kind: 'percent_damage', fraction: 0.25, bossFraction: 0.08 },
  },
  null_salt: {
    id: 'null_salt',
    name: 'Null Salt',
    description: 'Strips every advantage one enemy has built up.',
    usableIn: 'combat',
    targeting: 'enemy',
    effect: { kind: 'strip_buffs' },
  },
  smoke_husk: {
    id: 'smoke_husk',
    name: 'Smoke Husk',
    description: 'Leave a fight at once, with nothing to show for it. Not from a warden.',
    usableIn: 'combat_non_boss',
    targeting: 'none',
    effect: { kind: 'escape_battle' },
  },
  waystone: {
    id: 'waystone',
    name: 'Waystone',
    description: 'Ends the expedition safely, wherever you stand. Everything carried comes home.',
    usableIn: 'map',
    targeting: 'none',
    effect: { kind: 'depart' },
  },
};

export const ITEM_LIST: readonly ItemDefinition[] = Object.values(ITEMS);

/**
 * Falls back to the first item rather than throwing — deliberately unlike
 * `getTemplate`, which does throw. A corrupted species id in a save is
 * unrecoverable; a corrupted item id costs one slot and must not stop the boot.
 */
export function getItem(id: string): ItemDefinition {
  return ITEMS[id] ?? ITEM_LIST[0];
}
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: `src/data/items.test.ts` PASSES (8 tests). Other suites still pass — `ItemDefinition` gained fields but none were removed, and both existing item ids kept their `effect` shapes.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/data/items.ts src/data/items.test.ts
git commit -m "feat: expand the item catalog to nine expedition consumables"
```

---

### Task 4: `Items.ts` — resolving an item in either context

**Files:**
- Create: `src/systems/Items.ts`
- Modify: `src/systems/Recovery.ts` (add `reviveOnRun`)
- Test: `src/systems/Items.test.ts`

**Interfaces:**
- Consumes: `ItemDefinition`, `getItem` (Task 3); `applyHeal`, `applyBuffDebuff`, `revive`, `clearNegativeStatuses`, `stripPositiveStages`, `applyPercentDamage` (Task 2); `applyTargetedRecovery`, `canReceiveRecovery` from `Recovery`.
- Produces: `ItemContext`, `ItemOutcome`, `canUseItem(def, ctx)`, `applyItemInCombat(def, target, ctx)`, `applyItemOnMap(def, target, run)`, and `reviveOnRun(creature, run, hpFraction, mpFraction)` on `Recovery`. Tasks 7, 8, 9 consume these.

- [ ] **Step 1: Write the failing test**

Create `src/systems/Items.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CreatureInstance, RunState } from '../types';
import { ITEMS, ITEM_LIST } from '../data/items';
import { makeTestCreature } from './testFixtures';
import { applyItemInCombat, applyItemOnMap, canUseItem } from './Items';

const inCombat = { where: 'combat', isBoss: false } as const;
const inBoss = { where: 'combat', isBoss: true } as const;
const onMap = { where: 'map', isBoss: false } as const;

function mapCreature(): CreatureInstance {
  return {
    instanceId: 'c1',
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
    currentStats: { hp: 100, mp: 20, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
    resistances: [],
    weaknesses: [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
    tactic: 'fight_wisely',
  };
}

function mapRun(hp = 50, mp = 5, ko = false): RunState {
  return {
    startFloor: 1,
    currentEncounterIndex: 0,
    encounters: [],
    choices: [],
    obols: 0,
    partyHp: { c1: hp },
    partyMp: { c1: mp },
    partyKO: { c1: ko },
    xpEarned: 0,
    autoCombat: false,
  };
}

describe('canUseItem', () => {
  it('offers every item somewhere — none is unreachable', () => {
    for (const def of ITEM_LIST) {
      const anywhere = canUseItem(def, inCombat) || canUseItem(def, inBoss) || canUseItem(def, onMap);
      expect(anywhere).toBe(true);
    }
  });

  it('refuses the escape item against a boss and allows it otherwise', () => {
    expect(canUseItem(ITEMS.smoke_husk, inBoss)).toBe(false);
    expect(canUseItem(ITEMS.smoke_husk, inCombat)).toBe(true);
  });

  it('keeps the waystone out of combat and on the map', () => {
    expect(canUseItem(ITEMS.waystone, inCombat)).toBe(false);
    expect(canUseItem(ITEMS.waystone, onMap)).toBe(true);
  });
});

describe('applyItemInCombat', () => {
  it('heals a wounded ally', () => {
    const c = makeTestCreature({ stats: { hp: 100 }, hp: 20 });
    expect(applyItemInCombat(ITEMS.mending_draught, c, inCombat).kind).toBe('applied');
    expect(c.currentHp).toBeGreaterThan(20);
  });

  it('refuses to revive someone still standing', () => {
    const c = makeTestCreature();
    expect(applyItemInCombat(ITEMS.hollow_candle, c, inCombat).kind).toBe('refused');
  });

  it('revives a downed ally', () => {
    const c = makeTestCreature({ hp: 0 });
    expect(applyItemInCombat(ITEMS.hollow_candle, c, inCombat).kind).toBe('applied');
    expect(c.isKnockedOut).toBe(false);
  });

  it('hits a boss for less than an ordinary enemy of the same size', () => {
    const normal = makeTestCreature({ stats: { hp: 400 } });
    const boss = makeTestCreature({ stats: { hp: 400 } });
    applyItemInCombat(ITEMS.grave_ash, normal, inCombat);
    applyItemInCombat(ITEMS.grave_ash, boss, inBoss);
    expect(400 - boss.currentHp).toBeLessThan(400 - normal.currentHp);
  });

  it('reports an escape rather than mutating anything', () => {
    expect(applyItemInCombat(ITEMS.smoke_husk, null, inCombat).kind).toBe('escape_battle');
  });

  it('refuses the escape item in a boss fight', () => {
    expect(applyItemInCombat(ITEMS.smoke_husk, null, inBoss).kind).toBe('refused');
  });

  it('refuses the waystone in combat', () => {
    expect(applyItemInCombat(ITEMS.waystone, null, inCombat).kind).toBe('refused');
  });
});

describe('applyItemOnMap', () => {
  it('heals a wounded ally', () => {
    const run = mapRun(50);
    expect(applyItemOnMap(ITEMS.mending_draught, mapCreature(), run).kind).toBe('applied');
    expect(run.partyHp.c1).toBeGreaterThan(50);
  });

  it('refuses to heal someone already full', () => {
    const run = mapRun(100);
    expect(applyItemOnMap(ITEMS.mending_draught, mapCreature(), run).kind).toBe('refused');
  });

  it('revives a downed ally out on the map', () => {
    const run = mapRun(0, 0, true);
    expect(applyItemOnMap(ITEMS.hollow_candle, mapCreature(), run).kind).toBe('applied');
    expect(run.partyKO.c1).toBe(false);
    expect(run.partyHp.c1).toBeGreaterThan(0);
  });

  it('reports a departure rather than ending the run itself', () => {
    expect(applyItemOnMap(ITEMS.waystone, null, mapRun()).kind).toBe('depart');
  });

  it('refuses every combat-only effect instead of silently doing nothing', () => {
    // The regression test for the trap Clearroot originally fell into: a map use
    // that no-ops still consumes the item, which is a bug the player pays for.
    for (const def of ITEM_LIST) {
      if (def.usableIn === 'combat' || def.usableIn === 'combat_non_boss') {
        expect(applyItemOnMap(def, mapCreature(), mapRun()).kind).toBe('refused');
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/Items.test.ts`
Expected: FAIL — `Failed to resolve import "./Items"`.

- [ ] **Step 3a: Add `reviveOnRun` to `Recovery.ts`**

Append to `src/systems/Recovery.ts`:

```ts
/**
 * Bring a knocked-out creature back on the run map.
 *
 * The run-state twin of CombatEngine's `revive`: same contract, different state
 * shape. Returns false and changes nothing when the target is still standing, so
 * a caller can refuse rather than consume.
 */
export function reviveOnRun(
  creature: CreatureInstance,
  run: RunState,
  hpFraction: number,
  mpFraction: number,
): boolean {
  if (!run.partyKO[creature.instanceId]) return false;
  run.partyKO[creature.instanceId] = false;
  run.partyHp[creature.instanceId] = Math.max(
    1, Math.floor(creature.currentStats.hp * hpFraction),
  );
  run.partyMp[creature.instanceId] = Math.floor(creature.currentStats.mp * mpFraction);
  return true;
}
```

- [ ] **Step 3b: Write `Items.ts`**

Create `src/systems/Items.ts`:

```ts
import { CombatCreature, CreatureInstance, RunState } from '../types';
import { ItemDefinition } from '../data/items';
import {
  applyBuffDebuff, applyHeal, applyPercentDamage, clearNegativeStatuses,
  revive, stripPositiveStages,
} from './CombatEngine';
import { applyTargetedRecovery, canReceiveRecovery, reviveOnRun } from './Recovery';

/**
 * Resolving a carried item — the one place that knows what each effect does.
 *
 * Two entry points rather than one, because combat and the run map genuinely
 * hold different state: combat has `CombatCreature` (currentHp, buffStages,
 * statusEffects), the map has `CreatureInstance` plus RunState's partyHp/partyMp/
 * partyKO. The codebase already splits along that seam — CombatEngine on one
 * side, Recovery on the other — so this module follows it instead of inventing
 * an adapter to hide it.
 *
 * Nothing here ends a battle or a run. Extraction items resolve to an OUTCOME the
 * scene acts on, which keeps this module pure, Phaser-free and unit-testable.
 *
 * Consumption is the CALLER's job, and only on a non-`refused` outcome — the same
 * "don't take payment for what you can't deliver" rule `tryBuyItem` follows.
 */

/** Where a use is being attempted. `isBoss` is only meaningful in combat. */
export interface ItemContext {
  where: 'combat' | 'map';
  isBoss: boolean;
}

export type ItemOutcome =
  | { kind: 'applied'; message: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'escape_battle' }
  | { kind: 'depart' };

/** Is this item offerable in this context at all? Drives both UIs' menus. */
export function canUseItem(def: ItemDefinition, ctx: ItemContext): boolean {
  switch (def.usableIn) {
    case 'both': return true;
    case 'map': return ctx.where === 'map';
    case 'combat': return ctx.where === 'combat';
    case 'combat_non_boss': return ctx.where === 'combat' && !ctx.isBoss;
  }
}

const WRONG_PLACE = 'Not here.';
const NO_TARGET = 'Nothing to use it on.';

/** Resolve against combat state. `target` is null for effects that take none. */
export function applyItemInCombat(
  def: ItemDefinition,
  target: CombatCreature | null,
  ctx: ItemContext,
): ItemOutcome {
  if (!canUseItem(def, ctx)) return { kind: 'refused', reason: WRONG_PLACE };

  const name = target?.template.name ?? '';

  switch (def.effect.kind) {
    case 'heal': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      if (target.currentHp >= target.maxHp) return { kind: 'refused', reason: `${name} is unhurt.` };
      const healed = applyHeal(target, def.effect.amount);
      return { kind: 'applied', message: `${name} recovers ${healed} HP.` };
    }
    case 'restore_mp': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      if (target.currentMp >= target.maxMp) return { kind: 'refused', reason: `${name} is clear-headed.` };
      const before = target.currentMp;
      target.currentMp = Math.min(target.maxMp, before + Math.floor(target.maxMp * def.effect.amount));
      return { kind: 'applied', message: `${name} recovers ${target.currentMp - before} MP.` };
    }
    case 'revive': {
      if (!target) return { kind: 'refused', reason: NO_TARGET };
      if (!revive(target, def.effect.hpAmount, def.effect.mpAmount)) {
        return { kind: 'refused', reason: `${name} is still standing.` };
      }
      return { kind: 'applied', message: `${name} wakes.` };
    }
    case 'cure_status': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      const removed = clearNegativeStatuses(target);
      if (!removed.length) return { kind: 'refused', reason: `${name} is unafflicted.` };
      return { kind: 'applied', message: `${name} is cleansed of ${removed.join(', ')}.` };
    }
    case 'buff': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      applyBuffDebuff(target, def.effect.stat, def.effect.stages);
      return { kind: 'applied', message: `${name}'s ${def.effect.stat.toUpperCase()} rises.` };
    }
    case 'percent_damage': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      const fraction = ctx.isBoss ? def.effect.bossFraction : def.effect.fraction;
      const dealt = applyPercentDamage(target, fraction);
      return { kind: 'applied', message: `${name} takes ${dealt} damage.` };
    }
    case 'strip_buffs': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      const cleared = stripPositiveStages(target);
      if (!cleared.length) return { kind: 'refused', reason: `${name} has no advantage to strip.` };
      return { kind: 'applied', message: `${name} loses its edge.` };
    }
    case 'escape_battle':
      return { kind: 'escape_battle' };
    case 'depart':
      return { kind: 'refused', reason: WRONG_PLACE };
  }
}

/**
 * Resolve against run state.
 *
 * Every combat-only effect is REFUSED here rather than falling through to a
 * no-op. A refusal is a bug caught; a no-op is an item consumed for nothing.
 */
export function applyItemOnMap(
  def: ItemDefinition,
  target: CreatureInstance | null,
  run: RunState,
): ItemOutcome {
  if (!canUseItem(def, { where: 'map', isBoss: false })) {
    return { kind: 'refused', reason: WRONG_PLACE };
  }

  const name = target?.nickname ?? target?.speciesId ?? '';

  switch (def.effect.kind) {
    case 'heal': {
      if (!target || !canReceiveRecovery('hp', target, run)) {
        return { kind: 'refused', reason: NO_TARGET };
      }
      const healed = applyTargetedRecovery('hp', def.effect.amount, target, run);
      return { kind: 'applied', message: `${name} recovers ${healed} HP.` };
    }
    case 'restore_mp': {
      if (!target || !canReceiveRecovery('mp', target, run)) {
        return { kind: 'refused', reason: NO_TARGET };
      }
      const restored = applyTargetedRecovery('mp', def.effect.amount, target, run);
      return { kind: 'applied', message: `${name} recovers ${restored} MP.` };
    }
    case 'revive': {
      if (!target || !reviveOnRun(target, run, def.effect.hpAmount, def.effect.mpAmount)) {
        return { kind: 'refused', reason: 'No one has fallen.' };
      }
      return { kind: 'applied', message: `${name} wakes.` };
    }
    case 'depart':
      return { kind: 'depart' };
    // Combat-only effects. Listed rather than defaulted so that adding an effect
    // kind is a compile error here, not a silent map no-op.
    case 'cure_status':
    case 'buff':
    case 'percent_damage':
    case 'strip_buffs':
    case 'escape_battle':
      return { kind: 'refused', reason: WRONG_PLACE };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/Items.test.ts src/systems/Recovery.test.ts`
Expected: PASS — 15 new tests in `Items.test.ts`, `Recovery.test.ts` unchanged and still green.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/systems/Items.ts src/systems/Items.test.ts src/systems/Recovery.ts
git commit -m "feat: resolve items against combat and run state"
```

---

### Task 5: Shop catalogs and the merchant's rotating stock

**Files:**
- Modify: `src/systems/Shop.ts` (extend both catalogs, add `merchantStockFor`)
- Test: `src/systems/Shop.test.ts` (append)

**Interfaces:**
- Consumes: `ITEMS` (Task 3); `Encounter` from `src/types.ts`.
- Produces: extended `MERCHANT_ITEM_OFFERS` / `TOWN_ITEM_OFFERS`, and `merchantStockFor(encounter: Encounter, count?: number): ItemOffer[]`. Task 10 renders both.

- [ ] **Step 1: Write the failing test**

Append to `src/systems/Shop.test.ts`:

```ts
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
});
```

Add `ITEMS` (from `../data/items`), `Encounter` (from `../types`), and `merchantStockFor` to this file's imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/systems/Shop.test.ts`
Expected: FAIL — `merchantStockFor is not a function`, and the town catalog is missing seven ids.

- [ ] **Step 3: Write the implementation**

In `src/systems/Shop.ts`, add `Encounter` to the `../types` import, then replace the two catalog constants and append `merchantStockFor`:

```ts
/**
 * Alpha placeholder prices. Two relationships are real design and are pinned by
 * tests: the tower always charges more than town (preparation should beat
 * improvisation), and the two ways out are the most expensive things sold
 * (they buy safety, which is the scarcest thing in the tower).
 */
export const MERCHANT_ITEM_OFFERS: readonly ItemOffer[] = [
  { itemId: 'mending_draught', cost: 15 },
  { itemId: 'moonwater', cost: 15 },
  { itemId: 'power_increase', cost: 15 },
  { itemId: 'clearroot', cost: 20 },
  { itemId: 'grave_ash', cost: 25 },
  { itemId: 'null_salt', cost: 30 },
  { itemId: 'hollow_candle', cost: 45 },
  { itemId: 'smoke_husk', cost: 60 },
  { itemId: 'waystone', cost: 80 },
];

export const TOWN_ITEM_OFFERS: readonly ItemOffer[] = [
  { itemId: 'mending_draught', cost: 8 },
  { itemId: 'moonwater', cost: 8 },
  { itemId: 'power_increase', cost: 8 },
  { itemId: 'clearroot', cost: 10 },
  { itemId: 'grave_ash', cost: 12 },
  { itemId: 'null_salt', cost: 15 },
  { itemId: 'hollow_candle', cost: 22 },
  { itemId: 'smoke_husk', cost: 30 },
  { itemId: 'waystone', cost: 40 },
];

/**
 * What this particular tower merchant has in stock.
 *
 * A subset rather than the whole catalog, for two reasons: nine offers overflow
 * the shop scene's fixed layout, and a market worth finding should not be the
 * same market every time. Town always stocks everything, so a player who
 * prepares is never at the mercy of this draw.
 *
 * The draw is a pure function of the encounter's `floor` and `index` rather than
 * `Math.random()`. `Encounter` carries no seed field and adding one would touch
 * the save-free run state for no gain; deriving from two values the encounter
 * already has means the scene can redraw as often as it likes without the stock
 * shuffling under the player's cursor.
 */
export function merchantStockFor(encounter: Encounter, count = 3): ItemOffer[] {
  const pool = [...MERCHANT_ITEM_OFFERS];
  const wanted = Math.min(count, pool.length);
  const picked: ItemOffer[] = [];

  // A small deterministic mixer — enough to decorrelate neighbouring shops
  // without pulling in a seeded-RNG dependency for nine items.
  let seed = (encounter.floor * 73856093) ^ (encounter.index * 19349663);
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed;
  };

  while (picked.length < wanted) {
    picked.push(...pool.splice(next() % pool.length, 1));
  }
  return picked;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/systems/Shop.test.ts`
Expected: PASS — pre-existing tests plus 10 new ones.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/systems/Shop.ts src/systems/Shop.test.ts
git commit -m "feat: stock nine items, with a rotating tower merchant"
```

---

### Task 6: Departure gating on the run map

**Files:**
- Modify: `src/scenes/RunScene.ts`

**Interfaces:**
- Consumes: `canDepart`, `nextDepartureFloor`, `hasWaystone` (Task 1); `getItem` (Task 3).
- Produces: nothing importable. Task 7 replaces this scene's `drawBag`.

**Manual verification only** — Phaser scenes have no test harness in this repo, matching every other scene here.

- [ ] **Step 1: Replace the flee state with departure state**

In `src/scenes/RunScene.ts`, add the import:

```ts
import { canDepart, hasWaystone, nextDepartureFloor } from '../systems/Departure';
```

Rename the field `confirmingFlee` to `confirmingDeparture`, and add one more beside it:

```ts
  private confirmingDeparture = false;
  /** Set when the player picked a room while departure was open — the commit modal. */
  private confirmingCommit: Encounter | null = null;
```

Reset both in `init()` where `confirmingFlee = false` currently sits.

- [ ] **Step 2: Render the three-state DEPART control**

Replace the `FLEE` button block (currently `button(this, 874, 573, 100, 28, 'FLEE', ...)`) with:

```ts
    const open = canDepart(run);
    const waystone = hasWaystone(gameState.backpack);
    const nextFloor = nextDepartureFloor(run);
    const nextText = nextFloor === null ? 'NONE — THE BOTTOM IS THE ONLY WAY OUT' : `FLOOR ${nextFloor}`;

    if (open) {
      button(this, 862, 573, 124, 28, 'DEPART', () => this.requestDeparture(), UI.gold);
    } else if (waystone) {
      button(this, 862, 573, 124, 28, 'USE WAYSTONE', () => this.requestDeparture(), UI.teal);
    } else {
      button(this, 862, 573, 124, 28, 'NO WAY OUT', () => this.flashLock(), UI.line, false);
    }

    this.add.text(24, 573,
      open ? 'SAFE PASSAGE OUT — TAKE IT OR PRESS ON'
        : waystone ? `WAYSTONE READY  ·  NEXT FREE EXIT: ${nextText}`
          : `NO WAYSTONE  ·  NEXT GUARANTEED DEPARTURE: ${nextText}`, {
      fontFamily: BODY_FONT, fontSize: '9px',
      color: open ? UI.goldCss : waystone ? UI.tealCss : UI.mutedBright,
    }).setOrigin(0, 0.5);
```

The commitment line must be on the map at all times, not only inside a modal — that is the pitch's explicit UI requirement.

- [ ] **Step 3: Gate the request, and flash instead of opening a dead modal**

Replace `requestFlee()` with:

```ts
  private requestDeparture(): void {
    if (this.ending) return;
    if (!canDepart(gameState.currentRun!) && !hasWaystone(gameState.backpack)) {
      this.flashLock();
      return;
    }
    this.confirmingDeparture = true;
    this.draw();
  }

  /**
   * Departure is locked and there is no waystone. Flash the header line rather
   * than opening a modal whose only button is "never mind" — an unusable modal
   * reads as a broken button.
   */
  private flashLock(): void {
    const line = this.add.text(480, 300, 'THE WAY BACK IS SHUT', {
      fontFamily: DISPLAY_FONT, fontSize: '13px', color: UI.redCss,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: line, alpha: 0, duration: 900, onComplete: () => line.destroy() });
  }
```

Update the `ESC` handler and the three `this.confirmingFlee` guards in `drawOffer`/`commitSelected` to read `this.confirmingDeparture || this.confirmingCommit !== null`.

- [ ] **Step 4: Consume the waystone when it is the thing letting you leave**

Rewrite `drawFleeConfirmation` as `drawDepartureConfirmation`, and route its confirm through:

```ts
  private confirmDeparture(): void {
    const run = gameState.currentRun!;
    if (!canDepart(run)) {
      // Only a waystone can be paying for this exit — spend it before the results
      // screen renders the bag, or the ledger shows an item the player no longer has.
      const i = gameState.backpack.slots.findIndex(
        s => s !== null && s.kind === 'item' && s.itemId === 'waystone');
      if (i === -1) { this.confirmingDeparture = false; this.draw(); return; }
      gameState.backpack = removeAt(gameState.backpack, i);
    }
    this.showRunEnd('fled');
  }
```

Add `removeAt` to the existing `../systems/Backpack` import.

The modal body reads, when departure is open: *"The run ends here. Your leftover Obols convert to Essence at the full rate."* When a waystone is paying: *"The waystone breaks. The run ends here, at the full rate."*

- [ ] **Step 5: Add the commitment modal**

In `commitSelected`, when `canDepart(run)` is true, stage the encounter instead of entering it:

```ts
  private commitSelected(): void {
    const encounter = gameState.currentRun?.choices[this.selected];
    if (!encounter || this.ending || this.confirmingDeparture || this.showingBag) return;
    if (this.confirmingCommit) return;
    if (canDepart(gameState.currentRun!)) {
      this.confirmingCommit = encounter;
      this.draw();
      return;
    }
    this.selectEncounter(encounter);
  }
```

Draw it from `draw()` alongside the departure modal:

```ts
  private drawCommitConfirmation(encounter: Encounter): void {
    const run = gameState.currentRun!;
    const nextFloor = nextDepartureFloor(run);
    const carrying = hasWaystone(gameState.backpack);
    this.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
    panel(this, 480, 320, 560, 262, true);
    this.add.text(480, 240, 'PRESS ON?', {
      fontFamily: DISPLAY_FONT, fontSize: '13px', color: UI.hi,
    }).setOrigin(0.5);
    this.add.text(480, 292,
      nextFloor === null
        ? `Committing to floor ${encounter.floor}. There is no guaranteed way out below this.`
        : `Committing to floor ${encounter.floor}. The next guaranteed way out is floor ${nextFloor}.`, {
        fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
        align: 'center', wordWrap: { width: 470 },
      }).setOrigin(0.5);
    if (carrying) {
      this.add.text(480, 336, 'You carry a waystone — one exit, any time.', {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.tealCss,
      }).setOrigin(0.5);
    }
    button(this, 385, 382, 170, 50, 'PRESS ON', () => {
      const staged = this.confirmingCommit!;
      this.confirmingCommit = null;
      this.selectEncounter(staged);
    }, UI.gold);
    button(this, 575, 382, 170, 50, 'DEPART INSTEAD', () => {
      this.confirmingCommit = null;
      this.confirmDeparture();
    }, UI.teal);
    this.add.text(480, 432, 'ENTER PRESS ON  ·  ESC BACK', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    }).setOrigin(0.5);
  }
```

Wire `ENTER` and `ESC` in `create()` to this modal ahead of the departure modal, and call it at the end of `draw()`.

- [ ] **Step 6: Verify by hand**

Run `npm run dev`, then in the browser:
1. Start a run. **DEPART is dimmed** and the header reads `NO WAYSTONE · NEXT GUARANTEED DEPARTURE: FLOOR 5`. Pressing it flashes `THE WAY BACK IS SHUT`.
2. Buy a waystone from the town Provisioner first, re-enter: the button reads `USE WAYSTONE`. Using it ends the run at the full rate and the results-screen bag no longer lists it.
3. Clear the floor-5 boss. The button reads `DEPART` in gold, the header reads `SAFE PASSAGE OUT`. Picking a room raises **PRESS ON?** naming floor 10.
4. Press on: the button dims again and the header switches back to floor 10.

**Keep the browser tab focused** — Chrome throttles `requestAnimationFrame` to zero in a background tab and Phaser's clock stops, which looks exactly like a hang. See CLAUDE.md.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit && npm test
git add src/scenes/RunScene.ts
git commit -m "feat: gate tower departure on boss floors and waystones"
```

---

### Task 7: The interactive bag panel

**Files:**
- Create: `src/scenes/run/BagPanel.ts`
- Modify: `src/scenes/RunScene.ts` (delete `drawBag`/`slotLabel`, delegate)

**Interfaces:**
- Consumes: `canUseItem`, `applyItemOnMap`, `ItemOutcome` (Task 4); `getItem` (Task 3); `Theme` helpers.
- Produces: `drawBagPanel(scene, opts)` where `opts` is `{ run, onClose, onDepart, onChanged }`.

- [ ] **Step 1: Create the panel module**

Create `src/scenes/run/BagPanel.ts`. It owns the modal's own selection state and renders three stages: the slot grid, a target picker for targeted items, and a result line.

```ts
import Phaser from 'phaser';
import { gameState } from '../../managers/GameState';
import { getTemplate } from '../../data/creatures';
import { getItem } from '../../data/items';
import { canUseItem, applyItemOnMap } from '../../systems/Items';
import { capacity, isProtected, removeAt, usedSlots } from '../../systems/Backpack';
import { BackpackSlot, CreatureInstance, RunState } from '../../types';
import { UI, BODY_FONT, DISPLAY_FONT, button, panel } from '../../ui/Theme';

/**
 * The bag, lifted out of RunScene once it stopped being read-only.
 *
 * Follows the `scenes/combat/BattlefieldRenderer` precedent: a panel with its
 * own selection state, drawn into a scene it does not own. RunScene was already
 * 425 lines before departure gating landed on top of it, and the bag is the
 * self-contained piece.
 *
 * The panel never decides what an item does — `applyItemOnMap` does. It renders
 * the outcome and, on anything other than a refusal, consumes the slot.
 */

export interface BagPanelOpts {
  run: RunState;
  onClose: () => void;
  /** A waystone resolved to `depart` — the scene owns ending the run. */
  onDepart: () => void;
  /** Something changed; the caller should redraw the map behind the modal. */
  onChanged: () => void;
}

/** Which slot the player is choosing a target for; module-scoped, reset on open. */
let pendingSlot: number | null = null;
let lastMessage = '';

export function resetBagPanel(): void {
  pendingSlot = null;
  lastMessage = '';
}

export function drawBagPanel(scene: Phaser.Scene, opts: BagPanelOpts): void {
  const { run } = opts;
  const bag = gameState.backpack;

  scene.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
  panel(scene, 480, 320, 640, 452, true);
  scene.add.text(480, 122, 'THE BAG', {
    fontFamily: DISPLAY_FONT, fontSize: '16px', color: UI.hi,
  }).setOrigin(0.5);
  scene.add.text(480, 156, `${run.obols} OBOLS  ·  ${usedSlots(bag)}/${capacity(bag)} SLOTS USED`, {
    fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.goldCss,
  }).setOrigin(0.5);

  if (pendingSlot !== null) {
    drawTargetPicker(scene, opts, pendingSlot);
    return;
  }

  bag.slots.forEach((slot, i) => {
    const x = 260 + (i % 3) * 148;
    const y = 220 + Math.floor(i / 3) * 96;
    const safe = isProtected(bag, i);
    scene.add.rectangle(x, y, 136, 84, UI.panel)
      .setStrokeStyle(2, slot ? (safe ? UI.teal : UI.line) : UI.line);
    if (safe) {
      scene.add.text(x, y - 32, 'SECURED', {
        fontFamily: BODY_FONT, fontSize: '8px', color: UI.tealCss,
      }).setOrigin(0.5);
    }
    scene.add.text(x, y - 8, slotLabel(slot), {
      fontFamily: BODY_FONT, fontSize: '8px',
      color: slot ? UI.body : UI.muted, align: 'center', wordWrap: { width: 124 },
    }).setOrigin(0.5);

    if (slot?.kind === 'item') {
      const def = getItem(slot.itemId);
      if (canUseItem(def, { where: 'map', isBoss: false })) {
        button(scene, x, y + 26, 84, 22, 'USE', () => beginUse(scene, opts, i), UI.gold);
      } else {
        scene.add.text(x, y + 26, 'FOR FIGHTS', {
          fontFamily: BODY_FONT, fontSize: '8px', color: UI.muted,
        }).setOrigin(0.5);
      }
    }
  });

  scene.add.text(480, 470, lastMessage
    || 'SECURED SLOTS SURVIVE A WIPE. EVERYTHING ELSE RISKS ONE RANDOM LOSS.', {
    fontFamily: BODY_FONT, fontSize: '8px',
    color: lastMessage ? UI.greenCss : UI.mutedBright, align: 'center',
  }).setOrigin(0.5);
  button(scene, 480, 512, 170, 44, 'CLOSE', () => { resetBagPanel(); opts.onClose(); }, UI.lineBright);
}

/** Resolve straight away when the item takes no target; otherwise pick one. */
function beginUse(scene: Phaser.Scene, opts: BagPanelOpts, slotIndex: number): void {
  const slot = gameState.backpack.slots[slotIndex];
  if (slot?.kind !== 'item') return;
  if (getItem(slot.itemId).targeting === 'none') {
    resolve(scene, opts, slotIndex, null);
    return;
  }
  pendingSlot = slotIndex;
  opts.onChanged();
}

function drawTargetPicker(scene: Phaser.Scene, opts: BagPanelOpts, slotIndex: number): void {
  const slot = gameState.backpack.slots[slotIndex];
  if (slot?.kind !== 'item') { pendingSlot = null; opts.onChanged(); return; }
  const def = getItem(slot.itemId);

  scene.add.text(480, 196, `USE ${def.name.toUpperCase()} ON WHOM?`, {
    fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
  }).setOrigin(0.5);

  gameState.runParty.forEach((creature, i) => {
    const down = opts.run.partyKO[creature.instanceId];
    const eligible = def.targeting === 'downed_ally' ? down : !down;
    const x = 260 + i * 220;
    const card = panel(scene, x, 300, 200, 132, false);
    scene.add.text(x, 270, creature.nickname ?? getTemplate(creature.speciesId).name, {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: eligible ? UI.text : UI.muted,
    }).setOrigin(0.5);
    scene.add.text(x, 302, down ? 'DOWN' : `HP ${opts.run.partyHp[creature.instanceId]}/${creature.currentStats.hp}`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: down ? UI.redCss : UI.greenCss,
    }).setOrigin(0.5);
    scene.add.text(x, 326, `MP ${opts.run.partyMp[creature.instanceId]}/${creature.currentStats.mp}`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: down ? UI.muted : UI.tealCss,
    }).setOrigin(0.5);
    if (eligible) {
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => resolve(scene, opts, slotIndex, creature));
    }
  });

  button(scene, 480, 470, 170, 44, 'BACK',
    () => { pendingSlot = null; opts.onChanged(); }, UI.lineBright);
}

/**
 * Ask Items.ts what happens, then act on it.
 *
 * The slot is consumed on any outcome EXCEPT a refusal — the same rule
 * `tryBuyItem` follows for payment. A refusal reports why and keeps the item.
 */
function resolve(
  scene: Phaser.Scene,
  opts: BagPanelOpts,
  slotIndex: number,
  target: CreatureInstance | null,
): void {
  const slot = gameState.backpack.slots[slotIndex];
  if (slot?.kind !== 'item') return;
  const outcome = applyItemOnMap(getItem(slot.itemId), target, opts.run);

  if (outcome.kind === 'refused') {
    lastMessage = outcome.reason.toUpperCase();
    pendingSlot = null;
    opts.onChanged();
    return;
  }

  gameState.backpack = removeAt(gameState.backpack, slotIndex);
  pendingSlot = null;

  if (outcome.kind === 'depart') {
    resetBagPanel();
    opts.onDepart();
    return;
  }

  lastMessage = outcome.kind === 'applied' ? outcome.message.toUpperCase() : '';
  gameState.saveToLocalStorage();
  opts.onChanged();
}

function slotLabel(slot: BackpackSlot): string {
  if (!slot) return 'empty';
  switch (slot.kind) {
    case 'creature': return getTemplate(slot.instance.speciesId).name.toUpperCase();
    case 'item': return getItem(slot.itemId).name.toUpperCase();
    case 'mark': return `MARK · ${slot.markId.toUpperCase()}`;
    case 'trait': return `${slot.traitId.toUpperCase()} L${slot.traitLevel}`;
  }
}
```

- [ ] **Step 2: Delegate from `RunScene`**

Delete `drawBag` and `slotLabel` from `src/scenes/RunScene.ts`, drop the now-unused `getTemplate`/`getItem`/`BackpackSlot`/`isProtected`/`capacity` imports if nothing else uses them, and replace the `if (this.showingBag) this.drawBag(run);` call in `draw()` with:

```ts
    if (this.showingBag) {
      drawBagPanel(this, {
        run,
        onClose: () => { this.showingBag = false; this.draw(); },
        onDepart: () => { this.showingBag = false; this.showRunEnd('fled'); },
        onChanged: () => this.draw(),
      });
    }
```

Call `resetBagPanel()` in `init()` and wherever `showingBag` is set true, so a stale target picker never survives into a new run.

- [ ] **Step 3: Verify by hand**

Run `npm run dev`:
1. Buy a Mending Draught and a Clearroot in town; enter the tower; open `BAG`.
2. The Draught shows `USE`; the Clearroot shows `FOR FIGHTS`.
3. Take damage in a fight, then use the Draught on the wounded creature — HP rises on the party strip behind the modal and the slot empties.
4. Using it on a full-HP party reports a refusal **and keeps the item**.
5. With a Waystone: `USE` ends the run directly from the bag.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit && npm test
git add src/scenes/run/BagPanel.ts src/scenes/RunScene.ts
git commit -m "feat: make the run-map bag usable"
```

---

### Task 8: Combat item menu — paging, enemy and downed-ally targeting

**Files:**
- Modify: `src/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: `canUseItem`, `applyItemInCombat` (Task 4); `getItem` (Task 3).
- Produces: nothing importable. Task 9 extends the same `useItem` path.

- [ ] **Step 1: Widen the pending-action type and add paging state**

In `src/scenes/CombatScene.ts`, add the import:

```ts
import { applyItemInCombat, canUseItem } from '../systems/Items';
```

The `pendingAllyAction` field's comment says both item effects target one ally. That is no
longer true. Replace it and add paging state:

```ts
  /**
   * What's awaiting a click in the ALLY field. Items can now target the fallen as
   * well as the living, so the pending action carries which picker is open.
   *
   * Enemy-targeted items are deliberately NOT represented here — they use the
   * persistent `currentTarget` hover selection, exactly as enemy abilities do.
   * See selectItem for why routing them through this field breaks targeting.
   */
  private pendingAllyAction:
    | { kind: 'ability'; abilityId: string }
    | { kind: 'item'; itemId: string; slotIndex: number; picker: 'living_ally' | 'downed_ally' }
    | null = null;

  /** First row shown in the ITEM submenu; nine items no longer fit four rows. */
  private itemPage = 0;
```

Reset `itemPage = 0` in `init()` and whenever the submenu opens.

- [ ] **Step 2: Filter the menu by context and page it**

`bagItemIds()` currently returns every unique item id. Filter it through `canUseItem` so the menu never offers something that will be refused:

```ts
  /** Unique item ids usable in THIS battle, in slot order. */
  private bagItemIds(): string[] {
    const ctx = { where: 'combat' as const, isBoss: this.encounter.type === 'boss' };
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const slot of gameState.backpack.slots) {
      if (slot && slot.kind === 'item' && !seen.has(slot.itemId)) {
        seen.add(slot.itemId);
        if (canUseItem(getItem(slot.itemId), ctx)) ids.push(slot.itemId);
      }
    }
    return ids;
  }
```

In the `ITEM` submenu builder (around line 683), slice by page and reserve the last row for `MORE ▸` when the list overflows:

```ts
      const all = this.bagItemIds();
      const PAGE = 3; // fourth row is the pager
      const pages = Math.max(1, Math.ceil(all.length / PAGE));
      this.itemPage = this.itemPage % pages;
      const shown = all.slice(this.itemPage * PAGE, this.itemPage * PAGE + PAGE);
      const rows: SubRowSpec[] = shown.map((itemId, i) => {
        const def = getItem(itemId);
        return {
          label: def.name.toUpperCase(),
          meta: `x${counts.get(itemId) ?? 0}`,
          selected: this.subRowIndex === i,
          disabled: false,
          onHover: () => { this.subRowIndex = i; this.redraw(); },
          onClick: () => { this.subRowIndex = i; this.selectItem(itemId); },
        };
      });
      if (pages > 1) {
        rows.push({
          label: `MORE (${this.itemPage + 1}/${pages})`,
          meta: '', selected: false, disabled: false,
          onHover: () => {},
          onClick: () => { this.itemPage = (this.itemPage + 1) % pages; this.subRowIndex = 0; this.redraw(); },
        });
      }
      while (rows.length < 4) rows.push(emptyRow());
```

- [ ] **Step 3: Route selection to the right picker**

Replace `selectItem`:

```ts
  private selectItem(itemId: string): void {
    const slotIndex = gameState.backpack.slots.findIndex(
      s => s !== null && s.kind === 'item' && s.itemId === itemId);
    if (slotIndex === -1) return;
    const def = getItem(itemId);

    if (def.targeting === 'none') {
      this.useItem(itemId, slotIndex, null);
      return;
    }
    if (def.targeting === 'enemy') {
      // Mirrors chooseAbility's single_enemy branch exactly. Do NOT route this
      // through pendingAllyAction: that flips the phase to PLAYER_TARGETING, and
      // `enemyInteractive` is computed as `PLAYER_CHOOSING && !pendingAllyAction`
      // — so the enemy field would go dead and strand the player with no way to
      // pick a target and no way back.
      const living = this.enemyParty.filter(e => !e.isKnockedOut);
      if (living.length === 1) { this.useItem(itemId, slotIndex, living[0]); return; }
      this.ensureValidTarget();
      if (this.currentTarget) this.useItem(itemId, slotIndex, this.currentTarget);
      return;
    }
    const wantDown = def.targeting === 'downed_ally';
    const candidates = this.playerParty.filter(c => c.isKnockedOut === wantDown);
    if (candidates.length === 0) return;
    if (candidates.length === 1) { this.useItem(itemId, slotIndex, candidates[0]); return; }
    this.pendingAllyAction = {
      kind: 'item', itemId, slotIndex, picker: wantDown ? 'downed_ally' : 'living_ally',
    };
    this.phase = BattlePhase.PLAYER_TARGETING;
    this.redraw();
  }
```

- [ ] **Step 3b: Let the battlefield renderer target the fallen**

`src/scenes/combat/BattlefieldRenderer.ts:283` hard-codes `if (view.allyInteractive && !ko)`, so a downed ally can never be clicked. Add an optional predicate to `BattlefieldView` beside `allyInteractive`:

```ts
  allyInteractive: boolean;
  /** Which allies may be clicked while `allyInteractive`. Defaults to the living. */
  allyTargetable?: (ally: CombatCreature) => boolean;
```

and replace line 283's condition:

```ts
  const targetable = view.allyTargetable ? view.allyTargetable(creature) : !ko;
  if (view.allyInteractive && targetable) {
```

The default keeps every existing caller — including single-ally abilities — behaving exactly as it does today.

In `CombatScene.redraw()`, pass the predicate alongside `allyInteractive` in the `renderBattlefield({ ... })` call:

```ts
      allyTargetable: (ally: CombatCreature) =>
        this.pendingAllyAction?.kind === 'item' && this.pendingAllyAction.picker === 'downed_ally'
          ? ally.isKnockedOut
          : !ally.isKnockedOut,
```

- [ ] **Step 4: Resolve through `Items.ts`**

Replace the body of `useItem` so the scene stops interpreting effects itself. Note the
signature widens — `target` is now nullable, for the effects that take none:

```ts
  private useItem(itemId: string, slotIndex: number, target: CombatCreature | null): void {
    const actor = this.turnOrder[this.currentTurnIndex];
    if (!actor) return;
    const def = getItem(itemId);
    const ctx = { where: 'combat' as const, isBoss: this.encounter.type === 'boss' };
    const outcome = applyItemInCombat(def, target, ctx);

    if (outcome.kind === 'refused') {
      // Nothing consumed and nothing spent — hand the turn back rather than
      // burning it on a mistake. Same rule tryBuyItem follows for payment.
      this.addMessage(outcome.reason);
      this.pendingAllyAction = null;
      this.phase = BattlePhase.PLAYER_CHOOSING;
      this.redraw();
      return;
    }

    this.phase = BattlePhase.EXECUTING;
    actor.isDefending = false;
    this.pendingAllyAction = null;
    gameState.backpack = removeAt(gameState.backpack, slotIndex);
    gameState.saveToLocalStorage();

    if (outcome.kind === 'escape_battle') {
      // Free action: escapeBattle() never calls finishTurn(), so the turn is
      // never passed and no enemy acts in response. The delay is for readability.
      this.addMessage(`${actor.template.name} broke the ${def.name}!`);
      this.redraw();
      this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
        () => this.escapeBattle());
      return;
    }

    this.addMessage(`${actor.template.name} used ${def.name} — ${outcome.message}`);
    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
      () => this.finishTurn(actor));
  }
```

This keeps the existing method's turn-advance tail verbatim — `redraw()`, then
`finishTurn(actor)` behind `scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed)`. The
`applyHeal` / `applyBuffDebuff` imports it used are now unreachable from this file; drop
them from the import list if nothing else uses them.

Add a temporary stub so this task compiles and its manual checks run on their own:

```ts
  private escapeBattle(): void { /* Task 9 */ }
```

- [ ] **Step 5: Verify by hand**

Run `npm run dev`. Buy several items in town, enter a fight:
1. `ITEM` lists three plus `MORE (1/3)`; clicking `MORE` pages through all of them.
2. Waystone never appears in the list; Smoke Husk appears in a normal fight and **not** against a boss.
3. Grave Ash prompts for an enemy when two are alive and auto-targets when one is.
4. Hollow Candle offers only downed allies, and is unselectable when nobody is down.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit && npm test
git add src/scenes/CombatScene.ts
git commit -m "feat: page the combat item menu and target enemies and the fallen"
```

---

### Task 9: Smoke Husk — the free-action escape

**Files:**
- Modify: `src/scenes/CombatScene.ts`

**Interfaces:**
- Consumes: the `escapeBattle()` stub from Task 8.
- Produces: nothing importable. Final task.

**The important detail:** `showBattleEnd` records every enemy species into `gameState.seenSpecies` at a single choke point, and its comment explicitly anticipates a mid-battle flee. Escape must **not** route through it. A free-action escape that recorded species would make "enter, read the enemy, escape, re-enter informed" a free scouting loop against auto-combat's knowledge fog.

- [ ] **Step 1: Implement the escape**

Replace the Task 8 stub:

```ts
  /**
   * Leave a fight at once, with nothing to show for it.
   *
   * A free action by design: the battle ends the instant the husk breaks, so no
   * enemy acts in response. It is still only reachable on a player turn, because
   * that is the only time the ITEM menu exists — so no change to the turn loop is
   * needed to make it "free".
   *
   * Deliberately does NOT call showBattleEnd(): that records every enemy species
   * into the knowledge fog, and a no-cost escape that did so would turn this item
   * into free reconnaissance ("enter, read them, leave, come back informed").
   * Forfeiting the encounter must also forfeit what you learned in it.
   *
   * No Obols and no XP are awarded, and `recordBreakCleared` is never reached —
   * `usableIn: 'combat_non_boss'` keeps this off boss floors entirely, so an
   * escape can never bank a break the party did not earn.
   */
  private escapeBattle(): void {
    this.destroyAll();
    const run = gameState.currentRun!;
    this.savePartyState(run);
    gameState.saveToLocalStorage();
    this.scene.start('RunScene', { continueRun: true });
  }
```

`currentEncounterIndex` was set when the room was entered, so the floor counts as visited and `RunScene.refreshChoices()` offers the next rooms normally.

- [ ] **Step 2: Verify by hand**

Run `npm run dev`:
1. Buy a Smoke Husk in town, enter a normal fight, use it.
2. You return to the run map immediately, **before any enemy acts**. Obols are unchanged. HP/MP carry the damage already taken.
3. Re-enter a fight with the same species: the Monsterpedia has **not** recorded them, and auto-combat still treats them as unknown.
4. In a boss fight, Smoke Husk does not appear in the `ITEM` list at all.

- [ ] **Step 3: Typecheck, full suite, commit**

```bash
npx tsc --noEmit && npm test
git add src/scenes/CombatScene.ts
git commit -m "feat: smoke husk escapes a fight without banking what it taught you"
```

---

### Task 10: Shop scenes — rotating stock and the full town grid

**Files:**
- Modify: `src/scenes/ShopScene.ts`
- Modify: `src/scenes/TownShopScene.ts`

**Interfaces:**
- Consumes: `merchantStockFor`, `TOWN_ITEM_OFFERS` (Task 5); `getItem` (Task 3).
- Produces: nothing importable.

**Both scenes currently hard-code `mending_draught` when choosing an accent colour and glyph** (`offer.itemId === 'mending_draught' ? UI.green : UI.gold`). With nine items that is wrong for seven of them. Replace it in both with one shared helper driven by the effect kind, so adding an item never needs a scene edit.

- [ ] **Step 1: Add the shared presentation helper**

Add to `src/ui/Theme.ts`:

```ts
/**
 * Accent colour and glyph for an item, chosen from its EFFECT rather than its id.
 * Both shop scenes used to test `itemId === 'mending_draught'`, which silently
 * mis-coloured every item added after it.
 */
export function itemAccent(kind: string): { color: number; glyph: string } {
  switch (kind) {
    case 'heal': return { color: UI.green, glyph: '+' };
    case 'restore_mp': return { color: UI.teal, glyph: '~' };
    case 'revive': return { color: UI.amber, glyph: '*' };
    case 'cure_status': return { color: UI.green, glyph: 'C' };
    case 'buff': return { color: UI.gold, glyph: 'STR' };
    case 'percent_damage': return { color: UI.red, glyph: 'X' };
    case 'strip_buffs': return { color: UI.orange, glyph: 'V' };
    case 'escape_battle': return { color: UI.teal, glyph: '<' };
    case 'depart': return { color: UI.gold, glyph: 'W' };
    default: return { color: UI.lineBright, glyph: '?' };
  }
}
```

- [ ] **Step 2: Rotate the tower merchant's stock**

In `src/scenes/ShopScene.ts`, replace `MERCHANT_ITEM_OFFERS.map(...)` with `merchantStockFor(this.encounter).map(...)`, and swap both hard-coded ternaries for `itemAccent(getItem(item.itemId).effect.kind)`.

- [ ] **Step 3: Lay the town Provisioner out as a 3×3 grid**

`drawOffer` already takes `(x, y, w, h, offer, index)` — the signature does not change, but
its internals are laid out for a tall card (its BUY button sits at `y + 132`, far outside a
116px card) and must be rewritten compact. Replace the offer loop with a grid:

```ts
    TOWN_ITEM_OFFERS.forEach((offer, i) => {
      this.drawOffer(200 + (i % 3) * 280, 200 + Math.floor(i / 3) * 130, 260, 116, offer, i);
    });
```

and replace `drawOffer` wholesale. The whole card becomes the buy control — at this size a
separate button would crowd out the description:

```ts
  private drawOffer(
    x: number, y: number, w: number, h: number, offer: ItemOffer, index: number,
  ): void {
    const def = getItem(offer.itemId);
    const selected = this.selected === index;
    const state = this.offerState(offer);
    const { color: accent, glyph } = itemAccent(def.effect.kind);

    panel(this, x, y, w, h, selected);
    spritePlate(this, x - w / 2 + 34, y - 14, 44, 44,
      state.enabled ? accent : UI.line, selected ? UI.gold : UI.line);
    this.add.text(x - w / 2 + 34, y - 14, glyph, {
      fontFamily: DISPLAY_FONT, fontSize: glyph.length > 2 ? '9px' : '16px',
      color: state.enabled ? Phaser.Display.Color.IntegerToColor(accent).rgba : UI.muted,
    }).setOrigin(0.5);

    this.add.text(x - w / 2 + 66, y - h / 2 + 12, def.name.toUpperCase(), {
      fontFamily: DISPLAY_FONT, fontSize: '9px',
      color: state.enabled ? UI.hi : UI.muted,
    });
    this.add.text(x + w / 2 - 14, y - h / 2 + 12, `${offer.cost}`, {
      fontFamily: DISPLAY_FONT, fontSize: '10px',
      color: state.enabled ? UI.tealCss : UI.muted,
    }).setOrigin(1, 0);
    this.add.text(x - w / 2 + 66, y - h / 2 + 32, def.description, {
      fontFamily: BODY_FONT, fontSize: '9px',
      color: state.enabled ? UI.body : UI.muted, wordWrap: { width: w - 84 },
    });
    this.add.text(x, y + h / 2 - 14,
      state.enabled ? `BUY  ·  ${offer.cost} ESSENCE` : state.reason, {
        fontFamily: DISPLAY_FONT, fontSize: '8px',
        color: state.enabled ? UI.greenCss : UI.redCss,
      }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: state.enabled });
    hit.on('pointerover', () => {
      if (this.selected !== index) { this.selected = index; this.draw(); }
    });
    hit.on('pointerdown', () => {
      if (!state.enabled) return;
      this.selected = index;
      this.purchaseSelected();
    });
  }
```

Add `itemAccent` to the `../ui/Theme` import and drop the now-unused `button` import if
nothing else in the file uses it. Match `this.draw()` to whatever this scene's redraw
method is actually called.

- [ ] **Step 4: Verify by hand**

Run `npm run dev`:
1. The town Provisioner shows **all nine** items in a 3×3 grid, each with its own glyph and colour, a Waystone among them.
2. Buying with a full bag is refused **and charges nothing** (existing `tryBuyItem` behaviour — confirm the Essence total is unchanged).
3. Two different tower markets in one run stock **different** item sets; re-entering the same market shows the same set.

- [ ] **Step 5: Typecheck, full suite, commit**

```bash
npx tsc --noEmit && npm test
git add src/ui/Theme.ts src/scenes/ShopScene.ts src/scenes/TownShopScene.ts
git commit -m "feat: rotating tower stock and a full town provisioner grid"
```

---

## Final verification

- [ ] `npm test` — all suites green, ~390 tests (350 existing + ~40 added).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — succeeds.
- [ ] Full loop by hand, tab focused: town → buy a Waystone and a Smoke Husk → enter → DEPART dimmed with the floor-5 line → escape a fight with the husk → clear floor 5 → DEPART lit → PRESS ON modal → use the Waystone from the bag → results screen pays the full rate and no longer lists it.
- [ ] `grep -rn "SAVE_VERSION" src/` still reads 7.
- [ ] Update `CLAUDE.md`: move Waystone/Smoke Husk departure and the nine-item pool into "What's Built", note that Preparations, Heirlooms and Marks remain unbuilt, and add Smoke Husk's price to the placeholder-tuning list as the first number to revisit.
