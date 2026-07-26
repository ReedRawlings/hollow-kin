# Documentation Realignment — Design Spec

**Date:** 2026-07-26
**Status:** Approved design, not yet executed
**Scope:** Re-promote `game-design-document.md` to source of truth; reframe the game as permanent-progression rather than roguelite; repair contradictions between topic docs; retire the four-level authority ranking in `CLAUDE.md`.

**Explicitly out of scope:** the traits system and everything that depends on how trait slots unlock and resolve. That is a separate design conversation. See §5.

---

## Problem

Nothing about the game's direction is changing. The problem is that the documentation still reads like the game it used to be, and agents reading it draw the wrong conclusions.

Two distinct failures:

**1. Framing.** The GDD opens by calling Hollow Kin a "creature collector roguelite." The essence pivot replaced runs-as-the-unit-of-progress with permanent progression, but the framing, section ordering, and several undecided-looking sections still describe the earlier direction. A reader who stops at the overview gets the wrong model of the game.

**2. Arbitration cost.** `CLAUDE.md` currently demotes the GDD and hands agents a four-level authority ranking (CLAUDE.md → pivot spec → later specs → topic docs) plus an instruction to treat roguelite-flavoured claims as suspect. Every agent must re-derive which document wins on which subject before it can act. That is a recurring tax paid on every session, and it does not converge — the ranking gets longer each time a spec lands.

The fix for both is the same: make one document trustworthy and delete the ranking.

---

## 1. Target hierarchy

```
CLAUDE.md                       — what is actually built; the binding design rules
game-design-document.md         — SOURCE OF TRUTH for the design
  ├── combat-system.md          — owns combat
  ├── breeding-and-inheritance.md
  ├── tower-structure.md
  ├── economy-balancing.md
  ├── town.md · marks-*.md · traits-system.md · relics.md · ui-ux.md · onboarding.md
  └── creature-roster-and-generation.md
docs/superpowers/specs/         — point-in-time records of decisions, NOT authorities
```

The rule agents get: **the GDD is current; each topic doc owns its own subject; specs record how a decision was reached but do not override the GDD.** When a spec and the GDD disagree, that is a bug in the GDD to be fixed, not a ranking to be applied.

Specs stay in the repo. They hold reasoning and rejected alternatives that the GDD deliberately does not carry.

---

## 2. `game-design-document.md`

### 2.1 Reframe the Overview

Lead with **permanent-progression creature collector with a roguelite run structure**. Keep the Dragon Quest Monsters / Azure Dreams / Slay the Spire lineage — the influences are still accurate. Remove the implication that a run is the unit of progress; a run is a harvesting trip.

### 2.2 Add "What Persists, What Resets"

Placed immediately after Core Philosophy. Scoped as a **disambiguation table, not an inventory** — it lists only the things that reset, because those are the only things an agent gets wrong.

Rationale: `CLAUDE.md` currently states the rule negatively ("do not restore run-reset behaviour"), which tells an agent what to avoid without telling it where the boundary sits. An agent that finds run-scoped code has to guess whether it is a deliberate design element or an unconverted leftover. Four cases are genuinely ambiguous:

| Resets at run end | Why — and what not to "fix" |
|---|---|
| Temporary in-run levels | Deliberate (Model A). The essence-bought floor persists; levels gained on top of it do not. Do not delete in-run leveling as a reset leftover — Model B (essence-only levels) is a playtest fallback, not the current design. |
| Obols | Deliberate. Obols are run-scoped fuel; leftover Obols convert to Essence on exit. Do not make Obols persist — a second permanent currency was explicitly rejected in the pivot spec. |
| Relics | Deliberate, and this is the roguelite element the design keeps. Run-only power-ups are the intended shape, not an unconverted leftover. |
| Unbound marks | Deliberate (earn-then-lock). A mark earned in a run fades unless Essence is spent at the Mark-binder to bind it. Do not make earned marks automatically permanent. |

Plus the one asymmetric case, stated in the same place:

> **A wipe costs exactly one thing, chosen at random from unprotected inventory — never the whole inventory.** A captured creature riding in an unprotected slot is eligible for that loss. The three creatures the player entered the tower with are never at risk, under any circumstance.

**Sync discipline:** this table is the *only* normative statement of what is run-scoped. The Currency, Levels, Marks, and Relics sections cross-reference it instead of restating the claim. This is a net reduction in duplicated assertions, not a fifth copy.

### 2.3 Run Shape — collapse to a decision

Currently four navigation options presented as open. Pick-Next is built and shipped. Rewrite as **"Pick-Next — decided and built"** with a single line noting branching-map / linear-with-rewards / non-linear were considered and rejected. Mirror the same collapse in `tower-structure.md` §"Run Shape".

### 2.4 Point-Buy Starter System — delete

Remove the section entirely. The direction is abandoned; the standing default party and pre-run departure screen supersede it. Not shelved, not moved to a rejected list — deleted. Revisit only if the party-select direction changes drastically.

### 2.5 Technical Architecture — correct to match the code

- **Scenes:** replace "two primary scenes: Map Scene and Combat Scene" with the actual registry — Boot, Town, PartySelect, Run, Combat, Shop, Rest, Breeding, Leveler, Gatekeeper.
- **Save:** localStorage save v2 with migration is what exists. Supabase is planned, not built. State the current reality first and the plan second.

### 2.6 Point fixes

| Line | Change |
|---|---|
| 213 | Remove the "Using a Breeding Stone or Relic can influence which traits fill those slots" clause. Stones are cut. **Clause only** — the surrounding Trait Inheritance text is out of scope (§5). |
| 443 | Delete the open question "Visual and thematic identity for each tower zone." Zones do not exist. The equivalent depth-band question already lives in `tower-structure.md`. |
| 325–350 | Repair the escaped `\*` bullets in the Capture System and Run Failure sections (Google Docs paste artifact). Content is correct; only the markdown is broken. |

### 2.7 Add a specs index

A short section listing each spec with a one-line statement of what it decided, so agents find them by subject rather than by reading the directory:

- `2026-07-23-essence-progression-pivot-design.md` — the permanent-progression model itself
- `2026-07-24-auto-combat-tactics-design.md` — tactic ladders, knowledge fog, battle speed
- `2026-07-25-capture-system-design.md` — threshold model, duplicate Essence grant, box capacity (designed, not built)
- `2026-07-25-departure-flow-design.md` — standing default party, pre-run departure screen
- `2026-07-25-monsterpedia-design.md` — bestiary UI over `seenSpecies` (designed, not built)

Note in the same section that the capture spec cites `docs/superpowers/research/capture-mechanics-research.md`, which is **not in the repo** — treat that spec as self-contained.

---

## 3. Topic-doc contradiction fixes

Only contradictions outside the trait system. Each one is a case where an agent following the doc would build something the rest of the design forbids.

| File | Current text | Fix |
|---|---|---|
| `combat-system.md:29` | Swap action — "replace the active creature with one from inventory (captured creatures mid-run)" | **Delete the Swap action.** It contradicts the capture spec (a capture is cargo, arrives at level 1, cannot be fielded during the run that caught it) and it does not exist in code — `CombatScene` offers abilities, basic attack, and defend only. The Capture action on the next line is correct and stays. |
| `game-design-document.md:115` and `tower-structure.md:88` | Rest points / pick-next let the player "swap party members in and out of the active roster" | Same root cause. The player brings exactly three creatures and captures are cargo, so there is no reserve to swap from — the feature has no contents. Remove the swap clause from both; rest points restore HP/MP and can teach an ability. Revisit only if a reserve party is ever designed. |
| `onboarding.md:35` | Breeding — "marks optionally carry" | Marks are **never** inherited through breeding (`marks-system.md`, GDD). Remove the clause. |
| `onboarding.md:1` | Title reads "Hollow Kin — UI/UX & Player Information Design" | Copy-paste from `ui-ux.md`. Retitle to "Hollow Kin — Onboarding" and rewrite the Overview paragraph, which is also `ui-ux.md`'s. |
| `ui-ux.md:65` | Breeding screen — "Optional: Breeding Relic or Stone slot" | Both cut. Remove the line. |
| `ui-ux.md:133` | Visual Language table — "Stones · Rough gem shape · Blue" | Remove the row. |
| `ui-ux.md:90` | Post-Encounter — "XP gained and level-up notifications" | Correct but ambiguous under Model A. Clarify that these are temporary in-run levels and cross-reference the persists/resets table. |

---

## 4. Status headers on topic docs

Each topic doc gets a short header stating three things: **what it owns**, **what it defers to the GDD on**, and **last verified** date. This replaces per-doc guessing about currency.

Docs whose subject is under active revision say so in the header — see §5.

---

## 5. Deferred: the traits system

Trait progression is contradictory across four documents, and the contradiction is **not** a wording problem. `traits-system.md` says slots and levels unlock at essence thresholds paid at the Trait-keeper (in town). `breeding-and-inheritance.md` says a slot unlocks when a creature hits its level cap, and that inherited traits resolve "at run time." Those describe two different systems with two different resolution moments — town-at-purchase versus in-run-at-cap. Choosing between them is a design decision with real consequences for when the player sees a trait roll, so it belongs in its own conversation rather than in a cleanup pass.

**Left untouched, deliberately:**

- `breeding-and-inheritance.md:35` — trait slot unlocked by hitting the level cap
- `breeding-and-inheritance.md:84–94` — Trait Resolution Cases 2/3/4 resolving at run time on hitting the star's level cap
- `traits-system.md:138–140` — inheritance summary restating the star/run-time model
- `creature-roster-and-generation.md:153` — natural trait pool rolling "when a wild creature earns a new star"
- `marks-system.md:7` — "traits are inherited through bloodlines and strengthen over stars"
- GDD "Trait Inheritance" and "Traits and Essence" sections, beyond the Stone clause removal in §2.6

**Handling in the interim.** Rather than leaving these silently wrong, `traits-system.md`, `breeding-and-inheritance.md`, and the GDD's trait sections get a visible header:

> ⚠️ **Trait progression is under active revision (as of 2026-07-26).** This document and `breeding-and-inheritance.md` describe two incompatible unlock models — essence thresholds paid in town versus level-cap unlocks resolved in-run. Do not implement trait unlock or trait resolution from these docs until the open design question is settled.

This is strictly better than a silent contradiction: an agent is warned off the exact section that would mislead it, and the warning is scoped to one subject rather than applied to the whole corpus.

---

## 6. `CLAUDE.md`

**Remove:** the boxed demotion warning, the four-level authority ranking, and the instruction to treat roguelite-flavoured claims in older docs as suspect.

**Replace with:** a short statement that the GDD is current and each topic doc owns its subject — plus one named live exception:

> The GDD is the design source of truth. Topic docs own their own subjects. Specs in `docs/superpowers/specs/` record how decisions were reached; they do not override the GDD.
>
> **One open exception:** trait progression is under revision — `traits-system.md` and `breeding-and-inheritance.md` disagree on how trait slots unlock. Do not implement traits from either until that is settled.

**Also fix:** line 5's "browser-based creature collector roguelite" opener, to match the GDD's reframed overview.

**Keep unchanged:** the alpha/placeholder-numbers warning, the Key Design Rules list, the What's Built / What's Not Built inventory, and the roadmap. Those are accurate and are the most load-bearing part of the file.

---

## 7. Files with no changes

- `relics.md` — correctly run-scoped. Relics resetting is the design, not a leftover.
- `breeding-stones.md` — already carries a clear RETIRED/CUT banner.
- `economy-balancing.md`, `town.md`, `tower-structure.md` — fully converted to the essence model, apart from the Run Shape collapse in `tower-structure.md` (§2.3).
- `Abilities.csv` — data, not prose.

---

## Success criteria

1. An agent reading only the GDD overview describes the game as permanent-progression, not run-reset.
2. No agent needs an authority ranking to decide which document wins.
3. The four deliberate resets (temp levels, Obols, relics, unbound marks) are each positively documented as intentional, so none is "fixed" away.
4. Every remaining known contradiction is either repaired or carries a visible warning naming it.
5. No gameplay numbers change. This is a documentation pass — per the alpha note in `CLAUDE.md`, values stay where they are.
