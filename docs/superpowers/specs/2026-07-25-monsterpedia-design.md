# Monsterpedia — Design Spec

**Date:** 2026-07-25
**Status:** Draft for review — decisions marked below need your sign-off
**Scope:** A persistent creature catalog. Turns the `seenSpecies` data auto-combat already collects into something the player can see, and gives auto-combat's knowledge fog a progression curve instead of a binary flip.

> **Read this first.** You asked for a plan to review, so unlike the auto-combat spec this one was written without a back-and-forth. I made the calls I'd have asked about and marked each one **[DECISION]** with the alternative I rejected and why. Overturn any of them and I'll revise — §9 says which plan tasks each one moves.

---

## Why This One, Now

Three things point at it:

- `game-design-document.md:435` lists "Bestiary / Monsterpedia design" as referenced by two systems but having no dedicated doc. It is the last undesigned dependency of work already shipped.
- `combat-system.md:212` says auto-combat "does not know enemy resistances until they've been encountered before... We'll need to develop a monsterpedia to track creature strength/weaknesses we can leverage here." The auto-combat branch built the *storage* for this (`gameState.seenSpecies`) but nothing reads it except the AI, and nothing shows it to the player.
- `ui-ux.md:101-107` already sketches the screen. Most of the design work is deciding what knowledge means, not what the screen looks like.

It is also genuinely small: one new scene, one data-model change, one save migration. No new combat mechanics.

---

## 1. The core design question: what does "knowing" a creature mean?

Today `seenSpecies` is a flat `Set<string>` — you have met a species or you have not, and meeting it once tells auto-combat everything about its resistances. That is the cheapest possible model and it wastes the interesting part.

**[DECISION 1] Two knowledge tiers, not one.**

| Tier | Earned by | Unlocks |
|---|---|---|
| **Encountered** | The species appears in a battle you enter | Name, archetype, sprite colour, the fact that it exists. Entry stops being a silhouette. |
| **Studied** | You defeat at least one of that species | Base stats, default abilities, resistances and weaknesses. **Auto-combat's fog reads this tier.** |

Why two rather than one: meeting a creature and understanding it are different things, and the gap is where the Monsterpedia earns its place. Under a binary model the catalog is a checklist you never revisit. Under two tiers, "I've seen it but haven't beaten it" is a real state with a real consequence — your Fight Wisely creatures swing blind at it until you win once.

Why not three or more (e.g. "defeat 5 times → full stat block"): grind for information is a tax, not a decision. Two tiers is the smallest model that makes the distinction meaningful.

**Consequence for already-merged work, flagged explicitly:** the auto-combat branch records `seenSpecies` at *encounter start*. Under this design the fog moves to the Studied tier, so `TacticsAI` gets its knowledge set from defeats instead. That is a real behavior change to code that just shipped — auto-combat becomes blind slightly longer. I think that is the correct behavior and it is a two-line change, but it is a change, and you should know it is on the table before approving.

## 2. Data model

Replace the flat set with a record keyed by species id:

```ts
export interface BestiaryEntry {
  speciesId: string;
  encountered: boolean;
  studied: boolean;      // implies encountered
  defeatCount: number;   // displayed; also the studied trigger
  capturedCount: number; // reserved for the capture system; 0 until then
}
```

`GameState` gains `bestiary: Record<string, BestiaryEntry>` and drops `seenSpecies`.

**[DECISION 2] Replace `seenSpecies` rather than keeping both.** Keeping a set alongside a record would be two sources of truth for the same fact, and they would drift. The AI's `KnownSpecies` type is already `ReadonlySet<string>`, so `GameState` exposes a derived getter — `studiedSpecies(): ReadonlySet<string>` — and `TacticsAI` needs no change at all beyond what it is handed.

**Save migration v3 → v4.** A v3 save has `seenSpecies: string[]`. Each entry migrates to `{ encountered: true, studied: true, defeatCount: 0, capturedCount: 0 }`.

**[DECISION 3] Migrate existing `seenSpecies` to Studied, not Encountered.** Those species were met *and* almost certainly beaten — you don't survive to save otherwise. Migrating them to Encountered-only would silently make auto-combat dumber for a player who did nothing wrong. `defeatCount: 0` is a small lie (the real count is unknown and unrecoverable), so the UI shows "—" rather than "0" for entries with `studied: true && defeatCount === 0`.

## 3. Recording

Two hooks in `CombatScene`:

- **Encountered** — in `initBattle`, per enemy species. This is where `recordSeenSpecies` already lives; it becomes `recordEncountered`.
- **Studied** — on victory, per *distinct* enemy species in that encounter. Increments `defeatCount` and sets `studied`.

**[DECISION 4] Fleeing or wiping records Encountered but not Studied.** You saw it; you didn't beat it. This is what makes the tier gap real.

**[DECISION 5] Species-level, not instance-level.** Beating one Emberwhelp teaches you about Emberwhelp generally. Tracking per-instance would be noise — the player never meets the same instance twice.

## 4. The screen

A new `BestiaryScene`, reached from town.

**Grid of entries**, one per species in `CREATURES` (36 today, 96 eventually), ordered by archetype then species id so the layout is stable as the roster grows and a player can learn where things sit.

- **Undiscovered:** dark silhouette, archetype-tinted, no name. Per `ui-ux.md:106` — "no spoilers."
- **Encountered:** sprite colour, name, archetype. Stats and resistances shown as `???`.
- **Studied:** everything — base stats, default abilities, resistances, weaknesses, defeat count.

A header counter: `Studied 12 / Encountered 19 / 36`. Completion is the whole reward for a catalog; it should be legible at a glance.

**[DECISION 6] Detail-on-click, not everything-inline.** 36 full stat blocks will not fit at 960×640, and 96 certainly won't. The grid shows sprite, name, and tier; clicking opens a detail panel. This also gives the future capture and breed-recipe content somewhere to live without a redesign.

**[DECISION 7] Town-only for now, not accessible mid-run.** In-run access is a genuine convenience — checking a weakness mid-descent is exactly when you want it — but it means a scene push/pop over `RunScene` and `CombatScene` with save-state care, and it makes the fog partially pointless if you can look up what your creatures supposedly don't know. Town-only first; revisit after playtest. I'd rather ship the catalog and learn whether you miss it in-run than build the harder version blind.

## 5. What this deliberately does NOT include

- **Breed-only recipes.** `creature-roster-and-generation.md:246` says discovered breed-only creatures record their parent combination here. Breed-only creatures do not exist in the code yet. The `BestiaryEntry` shape leaves room (a `discoveredVia` field is an additive migration later), but building recipe display for content that does not exist is speculative.
- **Capture counts as a real feature.** `capturedCount` is in the shape because the capture system is the next roadmap item and adding a field later is a migration; populating it is not this task's job.
- **Variant tracking.** `creature-roster-and-generation.md:249` mentions wild variants of bred creatures. Not designed yet; out of scope.
- **Notifications.** `ui-ux.md:152` asks how the player learns about a breed-only discovery. Depends on breed-only creatures existing. Deferred.

## 6. Testing

- `GameState`: `recordEncountered` / `recordDefeated` set the right tiers; defeating implies encountered; `defeatCount` increments per victory, not per enemy instance of the same species in one fight.
- `studiedSpecies()` returns only studied entries — the fog must not leak encountered-but-unbeaten species.
- Migration: a v3 save's `seenSpecies` array becomes studied entries; a v4 save round-trips; a save with neither field yields an empty bestiary.
- A pure `bestiaryProgress(bestiary)` helper returning `{ studied, encountered, total }` — tested directly rather than through the scene.

Scene rendering stays untested, consistent with the rest of the project (no Phaser test harness exists).

## 7. Files

```
src/types.ts                  — BestiaryEntry interface
src/managers/GameState.ts     — bestiary record, record/query methods, save v4
src/systems/Bestiary.ts       — pure helpers (progress counts, tier resolution)
src/scenes/BestiaryScene.ts   — grid + detail panel
src/scenes/TownScene.ts       — entry point button
src/scenes/CombatScene.ts     — swap recordSeenSpecies for the two hooks
src/systems/TacticsAI.ts      — unchanged; receives studiedSpecies() from the caller
```

`BestiaryScene` is the only substantial new file. If the grid and detail panel together push past ~250 lines, the detail panel splits out — the auto-combat branch already established `src/scenes/combat/` as the pattern for that.

## 8. Risks

- **The fog change is the only thing here that alters existing behavior.** Everything else is additive. If Decision 1 is rejected, the whole spec collapses to "draw a screen over the existing set" — much smaller, and honestly still worth doing.
- **36 entries is not enough content for a catalog to feel good.** At 96 it will. This ships slightly ahead of the content that justifies it, which is fine — it is cheaper to build now than to retrofit onto 96 creatures plus capture plus traits.

## 9. If you overturn a decision

| Decision | If rejected | Plan impact |
|---|---|---|
| 1 — two tiers | Keep binary discovery | Drops the `studied` field, the victory hook, and the fog change. Tasks 1, 3, 5 shrink; roughly halves the work. |
| 2 — replace `seenSpecies` | Keep both | Adds a sync concern; I'd argue against it, but it is a smaller diff. |
| 3 — migrate to Studied | Migrate to Encountered | One line, but existing saves lose auto-combat knowledge until re-earned. |
| 6 — detail on click | Everything inline | Only viable at 36 creatures; would need redesign before 96. |
| 7 — town-only | In-run access too | Adds a task for scene push/pop and run-state preservation. |

---

## Open questions for you

1. **Decision 1 is the one that matters.** Two tiers, or keep it binary and just draw the screen?
2. Does `defeatCount` belong on the entry at all, or is it stat-tracking you don't want to commit to displaying?
3. Should the Monsterpedia eventually gate anything besides auto-combat's fog — capture rates, for instance — or is it purely informational plus the fog?
