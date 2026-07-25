# Hollow Kin — Project Context

## What This Is

Hollow Kin is a browser-based creature collector roguelite. The player descends a procedurally generated tower with a party of 3 bred creatures, gathering resources, capturing new creatures, and earning genealogy progress that persists across runs. Inspired by Dragon Quest Monsters (breeding), Azure Dreams (tower/run structure), and Slay the Spire (roguelite pacing).

## Tech Stack

- **Engine:** Phaser 3 (v3.80+)
- **Language:** TypeScript
- **Build:** Vite
- **Save:** localStorage (Supabase planned for later)
- **Canvas:** 960×640 logical resolution, `zoom: devicePixelRatio` for crisp rendering on HiDPI displays

## Design Documents

The project root contains the full game design documentation. **The GDD is the source of truth.** Each section has a corresponding detailed doc:

| File | Covers |
|------|--------|
| `game-design-document.md` | Primary GDD — overview of all systems |
| `combat-system.md` | Turn-based combat, damage formula, buffs/debuffs, auto-combat |
| `creature-roster-and-generation.md` | Target 96 creatures (12×8 archetypes), data objects, generation pipeline |
| `breeding-and-inheritance.md` | Star ratings, level caps (0-12), trait resolution cases 1-4 |
| `breeding-stones.md` | Consumables for enhancer, 4 tiers |
| `marks-system.md` | Run-earned bonuses, 1 slot per creature |
| `marks-catalog.md` | All mark entries with thresholds |
| `traits-system.md` | 4 trait slots, 4 levels, star progression table |
| `tower-structure.md` | 3 zones, 15 encounters each, procedural generation rules |
| `town.md` | Creature Box, Leathersmith, Enhancer buildings |
| `economy-balancing.md` | Resources, progression pacing, drop rates |
| `relics.md` | Run-only temporary power-ups |
| `onboarding.md` | Tutorial flow (Phase 1: combat/capture, Phase 2: breeding) |
| `ui-ux.md` | Screen designs, visual language, accessibility |
| `Abilities.csv` | 72 abilities with stats, types, archetypes |

## Current State — Essence Pivot Implemented (Phases 1–4a)

The **essence-progression pivot is built and merged to `main`.** The full core loop runs on the new model: town (essence hub) → party select → 30-floor descent → combat → return → spend Essence / breed → repeat. Implementation history lives in `docs/superpowers/plans/` and `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md`.

### What's Built

**Source structure:**
```
src/
  main.ts                    — Phaser game config, scene registry
  types.ts                   — Interfaces, enums, economy/tower constants
  data/
    abilities.ts             — 31 abilities (subset of 72; MP costs tuned)
    creatures.ts             — 36 creatures across 8 archetypes + depth-band pools
  managers/
    GameState.ts             — Singleton: box, party, essence, permanent levels,
                               obol→essence conversion, depth-jump, save v2 + migration
  systems/
    CombatEngine.ts          — Damage formula, turn order, buffs, status, enemy AI (random target)
    BreedingSystem.ts        — Star calc, stat inheritance, essence carry-over to offspring
    RunGenerator.ts          — 30-floor descent generation + boss-aware pick-next
    Economy.ts               — Obol→Essence conversion, level cost curve, depth-jump cost, carry-over
  scenes/
    BootScene, TownScene (essence hub), PartySelectScene, RunScene ("TOWER — Floor N/30"),
    CombatScene, ShopScene (Obols), RestScene, BreedingScene (shows carry-over),
    LevelerScene (buy permanent levels + stat preview), GatekeeperScene (depth-jumps)
```

**Working systems (all merged):**
- **Two-tier currency:** Obols in-run (heals/revives/shops), convert to permanent **Essence** on exit (flee/win = 100%, wipe = 50%)
- **Permanent essence levels:** creatures start each run at their essence-bought level floor (no level-1 reset); bought at the **Leveler** on a rising cost curve
- **One continuous 30-floor descent:** mini-boss every 5 floors, major every 10; rests appear as occasional filler (not guaranteed); boss-aware pick-next never skips a boss
- **Depth-jumps:** clear a break, buy a deeper start at the **Gatekeeper** (per-run Essence cost)
- **Breeding:** star calc, stat inheritance, parent retirement, + **essence carry-over** jump-start to offspring
- Turn-based combat (abilities, MP, buffs/debuffs, status, player-only crits, defend); **random enemy targeting**; single-enemy auto-target
- Damage formula: `(ATK - DEF/2) × (Power/50) × TypeMultiplier`; per-creature resistances/weaknesses
- localStorage **save v2** with migration from old (townResources→essence, drop longevity/plasm)
- **Auto-combat / tactics (DQ-style):** per-creature standing tactic (Fight Wisely / All Out / Conserve MP / Heal First / Follow Orders), set in Party Select and persisted; global AUTO toggle in combat and on the run map, with `follow_orders` creatures still prompting manually while AUTO is on. One side-agnostic `TacticsAI.chooseAction()` drives **both** player tactics and enemy AI (`enemy_default` is a literal port of the old `getEnemyAction`, pinned by characterization tests). Knowledge fog: auto only exploits resistances/weaknesses of species already fought — recorded at battle end, so the first encounter with a species is genuinely blind. Persisted **1×/2×/4× battle speed** scales all combat pacing with a 100 ms floor.
- **31 abilities** (MP costs cut ~40% for a healthier MP economy), **36 creatures** distributed across 3 depth bands
- vitest test suite (Economy, GameState, RunGenerator, BreedingSystem, CombatEngine, TacticsAI, types) — 121 tests

**Removed in the pivot:** Plasm, Longevity, Breeding Stones, Enhancer, Leathersmith, the 3-zone structure.

**Visuals:** Placeholder colored rectangles per archetype. No sprites yet.

### What's NOT Built Yet

- **Capture system** — the "collect" pillar; Obols-based capture during combat is not implemented (only data hooks exist)
- **Traits system** + Trait-keeper vendor (traits unlock at essence thresholds; enables the *Essence Distiller* conversion lever)
- **Marks system** + Mark-binder vendor (earn-then-lock; Floor Marks on bosses)
- **Inventory / Quartermaster** vendor (backpack capacity; pairs with capture) + Obols→Essence conversion-rate levers
- Run relics (temporary power-ups)
- **Monsterpedia / bestiary UI** — `gameState.seenSpecies` now collects the data, but nothing shows it to the player. Design drafted in `docs/superpowers/specs/2026-07-25-monsterpedia-design.md` (awaiting review).
- Onboarding tutorial (old-man flow in `onboarding.md`)
- Remaining ~41 abilities from `Abilities.csv` (31 of 72)
- Remaining creatures (36 of target 96)
- Any art/sprites

**Open thread:** a combat "freeze after one action" was seen while hot-reloading mid-edit — likely an HMR artifact, unconfirmed on a fresh load. Verify before assuming it's a real turn-loop bug.

**Placeholder numbers to tune (playtest):** Obol rewards 5/25/75, conversion rate 0.5, wipe penalty 50%, level cost `10·L^1.5`, depth-jump `(floor-1)×15`, breeding carry-over 50%, enemy/XP scaling by floor/depth band.

## Key Design Rules (Don't Violate These)

> **Essence pivot is implemented (Phases 1–4a merged).** Progression is permanent and essence-driven in the code, not just the docs. Full design: `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md`.

- **Two-tier currency: Obols → Essence.** Obols are the in-run token earned from fights, spent during the descent on heals/revives/capture/shops. On leaving the tower, **leftover Obols convert to Essence** (leftover-only; conversion rate boostable by traits/upgrades/depth). Essence is the permanent currency, spent on levels/traits/marks/depth-jumps/backpack. Essence is the only permanent store of value; Obols never persist. Plasm is removed. **A full wipe loses 50% of leftover Obols; the other 50% still converts** (a deliberate exit/win converts 100%).
- Creatures keep a **permanent essence-driven level floor** between runs. Temporary in-run levels vanish at run end (Model A). Do NOT hard-code a level-1 reset.
- **No archetype-level type chart.** Resistances/weaknesses are per-creature.
- Stars are the **level ceiling** for now (essence fills toward it); breeding still raises stars. Do NOT hard-couple to stars — removing them entirely (essence owns the cap) is the favored future direction.
- Both parents are **retired** when breeding, but invested essence **carries over** to the offspring as a jump-start.
- **Longevity is removed.** No run counter, no forced retirement.
- Tower is **one continuous 30-floor descent** — no zones. Mini-boss every 5 floors, major every 10. Depth-jumps buyable at cleared 5-floor breaks (buy 5 → start 6).
- First floor (and any post-jump floor) is **combat**. Rests are **occasional random filler** — never guaranteed before a boss.
- Enemies pick a **random** living target (spread damage); single-target attacks **auto-target** when one enemy remains.
- Player crits only — enemies cannot crit.
- Buff/debuff stages cap at **±3**.

## Roadmap / Next Steps

**Done:** essence pivot Phases 1–4a (currency, permanent levels, 30-floor descent, Leveler + Gatekeeper vendors, breeding carry-over) + playtest tuning.

**Next, in rough priority:**
1. **Capture system** — Obols-based capture in combat; completes the "collect" pillar (most important missing gameplay). Design first, then build.
2. **Traits system** + Trait-keeper vendor + Essence Distiller conversion lever.
3. **Marks system** + Mark-binder vendor + Floor Marks on bosses.
4. **Inventory / Quartermaster** vendor (backpack) — pairs with capture.
5. Content & polish: more creatures (36→96), more abilities (31→72), onboarding tutorial, auto-combat, sprites.

Each new system (capture/traits/marks/inventory) warrants its own design pass before implementation. Ongoing: tune the placeholder numbers listed above via playtest.

## Running the Project

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

Click "NEW GAME" in town to reset localStorage save if needed.
