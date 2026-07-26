# Traits System — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-26-traits-system-design.md` (authoritative — read it for rationale)
**Branch:** `feat/traits`
**Baseline:** 205 tests passing

---

## Global Constraints

These bind every task. Violating any is a defect regardless of what a task says.

1. **Slot thresholds are `[5, 10, 20, 30]`** on `permanentLevel`, and are **pinned to `STAR_LEVEL_CAPS`** (`0★=5, 1★=10, 2★=20, 3★=30`). Export as `TRAIT_SLOT_LEVELS`. A test must assert the *relationship* — every threshold equals some star tier's cap — not the literal array.
2. **`permanentLevel` only.** `currentLevel` (temporary in-run level) must never unlock a slot or affect breed-readiness.
3. **Slots unlock EMPTY.** There is no random trait roll anywhere. A newly unlocked slot has `traitId: null`.
4. **Alpha rule (from `CLAUDE.md`):** do not write tests that pin a magic number unless the value is the point. Test shape — cost rises, threshold ordering, relationships. Pinning `=== 240` is wrong; asserting `L2→L3 costs more than L1→L2` is right.
5. **Do not bump the save version.** Another agent has already moved it to v5 in uncommitted work. Breed-readiness becomes a derived helper; leave the `isBreedReady` field on `CreatureInstance` in place (unused) rather than removing it. Field removal is a later cleanup.
6. **Surgical edits only in `src/systems/BreedingSystem.ts`, `src/managers/GameState.ts`, `src/types.ts`.** Another agent has uncommitted `statBaseline` / save-v5 work in these files — in `BreedingSystem.ts` it sits in the *same object literal* you are editing. Change only the lines your task names. Never rewrite a whole file.
7. **TypeScript, existing code style.** Match surrounding conventions. Run `npx vitest run` before reporting.
8. **Commit only files your task touches.** Never `git add -A` — the tree contains another agent's uncommitted work.

---

## Task 1: Trait data and core system

**Files:** `src/data/traits.ts` (new), `src/systems/Traits.ts` (new), `src/systems/Traits.test.ts` (new)

Create the trait library and the pure logic around it. No UI, no GameState changes.

**`src/data/traits.ts`** — a `TraitDefinition` record keyed by trait id:

```ts
export interface TraitDefinition {
  id: string;
  name: string;
  category: 'stat' | 'battle_start' | 'resistance' | 'affinity' | 'evasion' | 'type' | 'economy';
  description: string;
  /** Effect magnitude per trait level, index 0 = L1 … index 3 = L4. */
  magnitudes: [number, number, number, number];
  /** For 'stat' traits, which stat it raises. For 'resistance', the DamageType resisted. */
  target?: string;
}
```

Author a starter library covering the categories in `traits-system.md`. At minimum the seven **stat** traits (HP/MP/STR/DEF/WIS/SPD/INT Up) since Task 6 makes those live, plus at least two each of resistance and battle-start. Magnitudes should rise across the four levels.

**`src/systems/Traits.ts`** — pure functions, no Phaser, no singletons:

- `TRAIT_SLOT_LEVELS` and `unlockedSlotCount(permanentLevel): number`
- `traitUpgradeCost(fromLevel: 1|2|3): number` — placeholders 240 / 540 / 960, rising
- `duplicateSellValue(traitId): number` — small
- `canSpeciesTakeTrait(speciesId, traitId): boolean` — reads the species `naturalTraitPool` (Task 4 authors the pools; until then treat a missing/undefined pool as **permissive** so this task is independently testable, and document that)
- `getTrait(traitId): TraitDefinition | undefined`

**Tests:** slot count rises at each threshold and nowhere between; thresholds all correspond to star caps; upgrade cost rises with level; compatibility respects the pool; unknown trait ids return undefined rather than throwing.

---

## Task 2: Derived breed-readiness and level-driven slot unlocking

**Files:** `src/managers/GameState.ts`, `src/systems/Traits.ts`, `src/managers/GameState.test.ts`

Two related changes, both keyed on `permanentLevel`.

**(a) Breed-readiness becomes derived.** Add `isCreatureBreedReady(creature): boolean` returning `permanentLevel >= levelCap`. Then:
- Delete the `isBreedReady = true` assignment in `GameState.tryLevelUp` (in-run levelling must not confer it)
- Delete the `isBreedReady = false` reset in `GameState.startRun`
- Update all readers to call the helper: `TownScene.ts:62`, `BreedingScene.ts:66,123,164`
- **Leave the `isBreedReady` field on the interface** (Global Constraint 5)

This fixes two live bugs, and both need a regression test:
- Buying a creature to its cap makes it breed-ready. Previously impossible — the run started at the cap, so `tryLevelUp` returned at its guard and the flag was never set.
- Breed-readiness survives `startRun()`. Previously wiped.

**(b) Slots unlock on permanent level.** After `spendEssenceOnLevel` raises `permanentLevel`, unlock any slots whose threshold is now met. Unlocked slots get `unlocked: true` and **keep `traitId: null`**. Never un-unlock a slot.

**Tests:** a level-5 purchase opens exactly slot 1; level 10 opens slot 2; in-run `tryLevelUp` to level 10 opens nothing; slots already unlocked stay unlocked; a creature at its cap is breed-ready before and after `startRun()`.

---

## Task 3: Breeding trait inheritance

**Files:** `src/systems/BreedingSystem.ts`, `src/systems/BreedingSystem.test.ts`

**Delete lines 73–76** — the `unlocked: starRating >= 2/3/4/5` slot logic. That is a third, abandoned model. Slot unlocking belongs to permanent level (Task 2) and the offspring's unlocked count must derive from its carried-over `permanentLevel`.

⚠️ Another agent has uncommitted `statBaseline` / `currentStats` edits in this same object literal. Replace only the `traitSlots` lines.

Implement inheritance, resolved entirely at breeding, in three cases per slot index:

| Parents | Result |
|---|---|
| Both have a trait in that slot | Player chooses — expose both as options |
| One has a trait | That trait passes |
| Neither | Slot stays empty |

- **Inherited traits arrive at `traitLevel: 1`** regardless of the parent's level
- **Escrow:** resolve all four slot indices even when the offspring's `permanentLevel` opens fewer. A trait inherited into a locked slot is stored with `unlocked: false` and becomes active when level opens it. Nothing is dropped
- Signature should let the caller supply choices for contested slots, defaulting deterministically (parent A) when none are supplied, so it stays testable

**Tests:** each of the three cases; inherited level is always 1; a trait inherited into a slot beyond the offspring's level is retained with `unlocked: false`; no star-based unlocking remains.

---

## Task 4: Author `naturalTraitPool` per species

**Files:** `src/types.ts`, `src/data/creatures.ts`, `src/systems/Traits.test.ts`

Add `naturalTraitPool: string[]` to `CreatureTemplate` in `types.ts` (additive — another agent has uncommitted edits in this file; add only this field).

Author a pool for **every** creature in `CREATURE_TEMPLATES` (36 species). Curate to archetype and to the creature's own resistances/weaknesses — a Mecha with `resistances: ['Fire']` should have fire/speed/electric-flavoured traits; a Flora healer should have WIS/HP and heal-supporting traits. No species gets the entire library.

Then flip `canSpeciesTakeTrait` from permissive to strict, since pools now exist.

**Tests:** every species has a non-empty pool; no pool contains an unknown trait id; no pool contains the entire library.

---

## Task 5: Trait-keeper scene

**Files:** `src/scenes/TraitKeeperScene.ts` (new), `src/scenes/TownScene.ts`, `src/main.ts`

Follow the structure of `LevelerScene.ts` — same layout conventions, creature list, back button.

Four services, all in Essence:
- **Buy** a trait from a small stock into the player's held traits
- **Imbue** a held trait into an unlocked, empty slot on a compatible creature. Imbuing into an *occupied* slot replaces and destroys the old trait
- **Upgrade** a trait L1→L4 at `traitUpgradeCost`
- **Sell** a duplicate for `duplicateSellValue`

Held traits need somewhere to live — add a simple `heldTraits: string[]` to `GameState`, persisted. **Do not bump the save version** (Global Constraint 5); default it to `[]` when absent so old saves load.

Buttons must be genuinely disabled (not just dimmed) when unaffordable, incompatible, or when no slot is open — match how `LevelerScene` handles its at-cap state.

Wire a `TRAIT-KEEPER` button into `TownScene` beside `LEVELER`/`GATEKEEPER`, and register the scene in `main.ts`.

---

## Task 6: Stat traits take effect in combat

**Files:** `src/managers/GameState.ts` or `src/systems/CombatEngine.ts` (choose the seam that fits — justify it), plus tests

Make the seven **stat** traits actually modify stats, so traits are not inert. Apply the trait's magnitude for its current level to the corresponding stat, from unlocked slots with a non-null `traitId` only.

Scope deliberately: **stat traits only.** Battle-start, resistance, affinity, evasion, type, and economy traits stay data-only for now — a later pass wires them.

⚠️ `calculateStatsForLevel` has uncommitted `statBaseline` edits from another agent. Layer trait bonuses on top of whatever it returns rather than restructuring it.

**Tests:** a creature with an unlocked STR Up trait has higher STR than the same creature without; a locked slot or null `traitId` contributes nothing; a higher trait level gives a larger bonus.

---

## Out of scope

- Trait drops from bosses and events (needs the backpack — not built)
- Found traits as inventory items and their wipe eligibility (same)
- Pre-levelled deep drops
- Puzzles
- Non-stat trait effects in combat
- Removing the `isBreedReady` field (needs a save bump; another agent owns the save version right now)
