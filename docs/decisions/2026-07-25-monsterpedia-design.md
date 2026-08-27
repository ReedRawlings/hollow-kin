# Monsterpedia — Design Spec

**Date:** 2026-07-25
**Status:** Approved — single-tier discovery
**Scope:** A persistent creature catalog that surfaces the `seenSpecies` data auto-combat already collects. Read-only UI over existing state.

---

## Guiding Principle

**Draw the screen, don't build a system.** This ships a catalog over data the game already records. It adds no new persisted state, no save migration, and changes nothing about combat or the auto-combat knowledge fog.

That is a deliberate narrowing. An earlier draft proposed two knowledge tiers — Encountered (met) versus Studied (beaten), with the fog reading the second tier — so that beating a creature, not merely meeting it, taught your AI its weaknesses. That was rejected in favour of the smaller version, and the reasoning holds up: with only 36 creatures in the roster, a graded-knowledge system would add ceremony to a catalog that does not yet have enough content to justify it. The two-tier idea is recorded in §7 as a future option if the roster grows and the fog starts feeling binary.

---

## 1. What already exists

The auto-combat branch shipped the data layer:

- `gameState.seenSpecies: Set<string>` — species the player has met, persisted in save v3.
- Recording happens in `CombatScene.showBattleEnd()`, the single choke point both battle-end paths pass through, so a species is recorded **whether the player won or lost** but *not* during the fight that introduced it. That timing is what makes the fog's "blind on first encounter" promise real.
- `TacticsAI.chooseAction` receives this set as its `known` argument and applies type multipliers only for species in it.

**This spec adds no state.** Everything below reads `seenSpecies` and `CREATURE_TEMPLATES`.

## 2. Discovery model

One state per species: **discovered** or **not**. `seenSpecies.has(speciesId)` is the whole model.

- Not discovered → the entry is a silhouette. No name, no stats. Per `docs/design/ui-ux.md:106`, "no spoilers."
- Discovered → everything: name, archetype, base stats, default abilities, resistances, weaknesses.

There is no partial reveal and no per-entry counter. A species you have met once shows the same as one you have fought twenty times.

## 3. The screen

A new `BestiaryScene`, reached from town.

**Grid**, one cell per species in `CREATURE_TEMPLATES`, ordered by **archetype, then species id**. Stable ordering matters more than it sounds: the player learns where things sit, and the layout must not reshuffle as the roster grows from 36 toward 96.

Each cell shows the sprite colour block and the name (or a dimmed silhouette block and `???` when undiscovered).

**Header counter:** `Discovered 19 / 36`. Completion is the entire reward a catalog offers; it should be readable at a glance.

**Detail on click.** 36 full stat blocks do not fit at 960×640, and 96 certainly will not. Clicking a discovered cell opens a detail panel with the full entry; clicking an undiscovered cell does nothing. This also leaves somewhere for capture counts and breed recipes to live later without a redesign.

**Paging.** 36 cells fit on one screen at a sensible cell size; 96 will not. The grid takes a page size and a page index from the start, with next/previous controls that hide themselves when there is only one page. Retrofitting paging onto a single-screen grid later is more work than accommodating it now, and this is the one piece of forward-thinking worth paying for.

**Town-only.** Not reachable mid-run. In-run access would be a genuine convenience — checking a weakness mid-descent is exactly when you want it — but it needs scene push/pop over `RunScene` and `CombatScene` with run-state care, and it partly defeats the fog if you can look up what your creatures supposedly do not know. Revisit after playtest.

## 4. Architecture

`BestiaryScene` renders; a small pure module holds everything worth testing.

```
src/systems/Bestiary.ts     — pure: entry list construction, progress counts, paging
src/scenes/BestiaryScene.ts — grid + detail panel + paging controls
src/scenes/TownScene.ts     — entry point button
```

`src/systems/Bestiary.ts` exposes:

- `BestiaryEntry` — a view model: `{ speciesId, name, archetype, discovered, template }`.
- `buildBestiary(seen: ReadonlySet<string>): BestiaryEntry[]` — every species in `CREATURE_TEMPLATES`, sorted by archetype then id, each flagged discovered or not.
- `bestiaryProgress(entries): { discovered: number; total: number }`.
- `pageOf(entries, pageIndex, pageSize): BestiaryEntry[]` and `pageCount(total, pageSize): number`.

The scene holds no derivation logic — it takes the entry list and draws it. That is what keeps this testable without a Phaser harness, which the project does not have.

## 5. Element lifecycle — non-negotiable

The auto-combat branch fixed two real bugs caused by the same trap, and `BestiaryScene` is a redrawing scene (paging, opening and closing the detail panel), so it will hit the same trap.

**Phaser's `children.removeAll()` only detaches objects from the display list. It does not call `.destroy()` and does not deregister input handlers.** Detached interactive objects stay live and clickable — invisible hotspots that fire the wrong thing.

`BestiaryScene` must follow the pattern `CombatScene` and `RunScene` now use: track every interactive object it creates, and `.destroy()` them before each redraw. Do not rely on `removeAll()`.

## 6. Testing

`Bestiary.ts` is pure functions over plain data, so it tests under vitest with no Phaser:

- `buildBestiary` returns one entry per species in `CREATURE_TEMPLATES`, with `discovered` matching the passed set, and marks nothing discovered for an empty set.
- Ordering is by archetype then species id, and is stable — assert an exact expected sequence for a small fixture rather than merely "sorted".
- `bestiaryProgress` counts discovered against total.
- `pageOf` / `pageCount`: exact page boundaries, the final partial page, an out-of-range index, and a total that divides evenly (the off-by-one that page maths always gets wrong).

Scene rendering stays untested, consistent with the rest of the project.

## 7. Explicitly out of scope

- **Two-tier knowledge.** Rejected for now (see Guiding Principle). Revisit if the roster grows past ~60 and the fog starts feeling like a formality.
- **Breed-only recipes.** `docs/design/creature-roster-and-generation.md:246` says discovered breed-only creatures record their parent combination here. Breed-only creatures do not exist in the code yet.
- **Capture counts.** The capture system is the next roadmap item; the detail panel has room when it lands.
- **Variant tracking**, per `docs/design/creature-roster-and-generation.md:249`. Not designed.
- **Discovery notifications** (`docs/design/ui-ux.md:152`). Depends on breed-only creatures existing.
- **In-run access.** See §3.

## 8. Known limitation

36 entries is thin for a catalog. It will feel better at 96. This ships slightly ahead of the content that justifies it, which is the right order — it is cheaper to build now than to retrofit onto 96 creatures plus capture plus traits.

## 9. Open question for playtest

Should the Monsterpedia eventually gate anything beyond auto-combat's fog — capture rates, for instance — or stay purely informational? Nothing in this spec depends on the answer.
