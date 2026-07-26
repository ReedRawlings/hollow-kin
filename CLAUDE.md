# Hollow Kin — Project Context

## What This Is

Hollow Kin is a browser-based **permanent-progression creature collector** built on a roguelite run structure. The player descends a procedurally generated tower with a party of 3 bred creatures, harvesting Obols from fights and converting what they carry out into Essence — the permanent currency behind levels, traits, marks, and deeper starting floors.

**A run is a harvesting trip, not the unit of progress.** Creatures do not reset. Inspired by Dragon Quest Monsters (breeding), Azure Dreams (tower/run structure), and Slay the Spire (run pacing). The roguelite inheritance is the *shape of a descent* — procedural floors, push-your-luck depth, run-only relics — not the progression model.

## ⚠️ This Game Is In Alpha — Numbers Are Not Settled

**Assume every gameplay number in this project is a placeholder until proven otherwise.** Costs, rewards, drop rates, stat curves, scaling exponents, thresholds, and timings are all set by feel and are expected to move repeatedly as the game is played. They are testing values, not balance decisions.

What this means in practice:

- **Do not treat a number as a requirement.** If a number makes a system behave badly, say so — proposing a different value is useful, not out of scope.
- **Do not write tests that pin a specific magic number** unless the exact value is the point. Test the *shape* — that cost rises with level, that a fee is free at floor 1, that rewards scale with depth — so retuning doesn't turn the suite red for no reason. Tests that assert `=== 75` make numbers expensive to change, which is exactly backwards during alpha.
- **Do pin relationships between numbers.** Where two constants must move together (e.g. `OBOL_REWARD_EXPONENT` is derived from `LEVEL_COST_EXPONENT`), that invariant is real design and worth enforcing even though the values themselves are not.
- **Structure and rules are firmer than values.** The design rules below are decisions; the numbers scattered through the docs mostly are not.

## Tech Stack

- **Engine:** Phaser 3 (v3.80+)
- **Language:** TypeScript
- **Build:** Vite
- **Save:** localStorage (Supabase planned for later)
- **Canvas:** 960×640 logical resolution, `zoom: devicePixelRatio` for crisp rendering on HiDPI displays

## Design Documents

The project root contains the game design documentation.

> ### How to read the docs
>
> **`game-design-document.md` is the design source of truth.** It was realigned to the permanent-progression model on 2026-07-26 and is current.
>
> Each topic doc **owns its own subject** and carries a header saying what it owns, what it defers to the GDD on, and when it was last verified.
>
> Specs in `docs/superpowers/specs/` are **point-in-time records** of how a decision was reached, including rejected alternatives. They are *not* authorities. If a spec and the GDD disagree, that is a bug in the GDD to fix — not a ranking to apply. The GDD carries an index of all specs and what each decided.
>
> **One open exception — traits.** `traits-system.md` and `breeding-and-inheritance.md` describe two incompatible trait-unlock models (essence thresholds bought in town vs. level-cap unlocks resolved in-run). Both docs and the GDD's trait sections carry a warning banner. **Do not implement trait unlock or trait resolution from any of them until this is settled.** Trait *effects* and *categories* are unaffected.

Each section has a corresponding detailed doc:

| File | Covers |
|------|--------|
| `game-design-document.md` | **Source of truth** — all systems, what persists vs. resets, specs index |
| `combat-system.md` | Turn-based combat, damage formula, buffs/debuffs, auto-combat tactics, enemy AI |
| `creature-roster-and-generation.md` | Target 96 creatures (12×8 archetypes), data objects, generation pipeline |
| `breeding-and-inheritance.md` | Star ratings, level caps (0–12), stat inheritance, essence carry-over ⚠️ *trait sections under revision* |
| `traits-system.md` | 4 trait slots, 4 levels, trait categories ⚠️ *unlock model under revision* |
| `marks-system.md` | Run-earned bonuses, earn-then-lock permanence, 1 slot per creature |
| `marks-catalog.md` | All mark entries with thresholds |
| `tower-structure.md` | One continuous 30-floor descent, depth bands, depth-jumps, boss cadence, procgen rules |
| `town.md` | Essence hub — Creature Box, Leveler, Trait-keeper, Mark-binder, Gatekeeper, Quartermaster, Breeder |
| `economy-balancing.md` | Obols→Essence, level cost curve, depth-jump prices, pacing targets (all placeholders) |
| `relics.md` | Run-only temporary power-ups — *not built* |
| `onboarding.md` | Tutorial sequence (Phase 1: combat/Obols/capture, Phase 2: marks/breeding) — *not built* |
| `ui-ux.md` | Screen designs, visual language, accessibility |
| `Abilities.csv` | 72 abilities with stats, types, archetypes |
| `breeding-stones.md` | ⚠️ **RETIRED/CUT** — preserved for reference only; nothing depends on it |

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

**Resolved (2026-07-25):** the combat "freeze after one action" is **not** a bug and **not** an HMR artifact. Chrome throttles `requestAnimationFrame` to zero in a backgrounded or unfocused tab, so Phaser's game loop stops stepping and the Scene Clock never advances — every `this.time.delayedCall` in `CombatScene` (which is how turns advance) simply never fires. Measured directly: `document.hidden === true`, `game.loop.frame` advancing 0 frames per second, `scene.time.now` frozen. The canvas still *appears* to update because DOM input events keep dispatching and a screenshot forces a paint, which is exactly what makes it look like a logic hang. **Keep the tab focused and visible when playtesting combat.** Verify before assuming it's a real turn-loop bug.

**Placeholder numbers to tune (playtest)** — a non-exhaustive list; see the alpha note at the top of this file. Obol base rewards 5/25/75 now scaled by depth as `base × SCALAR × floor^EXPONENT` (`OBOL_REWARD_EXPONENT` is derived from `LEVEL_COST_EXPONENT` — retune the pair together, never separately), conversion rate 0.5, wipe penalty 50%, level cost `10·L^1.5`, depth-jump `(floor-1)×15`, breeding carry-over 50%, MP costs across all 31 abilities, the tactic ladder thresholds (Fight Wisely's half-current-MP budget, Conserve MP's ⅓-max-MP ceiling and 50% party-danger gate, Heal First's 60%/2×-cheapest-heal reserve), battle speed steps, and enemy/XP scaling by floor/depth band.

## Key Design Rules (Don't Violate These)

> **Essence pivot is implemented (Phases 1–4a merged).** Progression is permanent and essence-driven in the code, not just the docs. Full design: `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md`.

- **Two-tier currency: Obols → Essence.** Obols are the in-run token earned from fights, spent during the descent on heals/revives/capture/shops. On leaving the tower, **leftover Obols convert to Essence** (leftover-only; conversion rate boostable by traits/upgrades/depth). Essence is the permanent currency, spent on levels/traits/marks/depth-jumps/backpack. Essence is the only permanent store of value; Obols never persist. Plasm is removed. **A full wipe loses 50% of leftover Obols; the other 50% still converts** (a deliberate exit/win converts 100%).
- **A wipe costs exactly ONE thing, at random — never the whole inventory.** This is the rule most likely to be got wrong from intuition, in both directions:
  - **Not "you lose everything."** The genre default is that death empties your bags. It does not here. A wipe takes one item from unprotected inventory and nothing else.
  - **Not "captured creatures are safe."** They ride in inventory slots like any other carried thing, so a captured creature in an *unprotected* slot is a candidate for that single random loss. Only the **guaranteed inventory space** protects a capture.
  - **The three creatures you entered the tower with can never be lost**, under any circumstance. That is absolute and separate from inventory entirely.
  - This is what keeps capture a real gamble: catching something deep with no guaranteed space left means carrying it home is a risk you chose.
- Creatures keep a **permanent essence-driven level floor** between runs. Temporary in-run levels vanish at run end (Model A). Do NOT hard-code a level-1 reset.
- **No archetype-level type chart.** Resistances/weaknesses are per-creature.
- Stars are the **level ceiling** for now (essence fills toward it); breeding still raises stars. Do NOT hard-couple to stars — removing them entirely (essence owns the cap) is the favored future direction.
- Both parents are **retired** when breeding, but invested essence **carries over** to the offspring as a jump-start. Retired parents **stay in the creature box as tombstones** — do not delete them. Every box consumer filters `!isRetired`, and keeping them is what lets a stale default party name the creature that left instead of saying "a former party member".
- **Breeding requires a minimum level investment, and this is load-bearing.** A creature is breed-ready only on hitting its star's level cap — **5 for a 0★ starter**, higher for higher stars. Stats pass down through generations, so breeding too early founds a weak line and the weakness compounds every generation after. Never relax this gate casually. A **captured creature arrives at level 1**, so it is far from breedable: capture yields a bloodline candidate, not a parent.
- **Longevity is removed.** No run counter, no forced retirement.
- Tower is **one continuous 30-floor descent** — no zones. Mini-boss every 5 floors, major every 10. Depth-jumps buyable at cleared 5-floor breaks (buy 5 → start 6).
- First floor (and any post-jump floor) is **combat**. Rests are **occasional random filler** — never guaranteed before a boss.
- Enemies pick a **random** living target (spread damage); single-target attacks **auto-target** when one enemy remains.
- Player crits only — enemies cannot crit.
- Buff/debuff stages cap at **±3**.

## Roadmap / Next Steps

**Done:** essence pivot Phases 1–4a (currency, permanent levels, 30-floor descent, Leveler + Gatekeeper vendors, breeding carry-over) + playtest tuning.

**Next, in rough priority:**
1. **Capture system — DESIGNED, ready to plan.** Spec: `docs/superpowers/specs/2026-07-25-capture-system-design.md` (threshold model, duplicate Essence grant, box capacity + pending-capture queue, combat-turn interaction). Next step is an implementation plan, not another design pass. Note the spec cites `docs/superpowers/research/capture-mechanics-research.md`, which is **not in the repo** — the survey it draws on either lives outside version control or was never committed, so treat the spec as self-contained.

   Two rules from elsewhere in this file that constrain it: a capture **arrives at level 1** and is cargo, not a reinforcement — it cannot be fielded during the run that caught it; and it is **eligible for the single random wipe loss** unless it occupies guaranteed inventory space.

   **Two open issues capture work will collide with, both currently unreachable but not for long:**
   - **A soft-lock.** Breeding is net −1 creature (two parents in, one offspring out). From the 3-creature starting box that leaves 2 actives, and with no capture there is no way back to 3 — `CONFIRM` sticks at 2/3 and `ENTER TOWER` stays permanently dimmed. Capture is the fix, but decide whether breeding also needs a guard.
   - **`PartySelectScene` breaks past 12 creatures.** Cards lay out 3-per-row at 140px; creatures 10–12 overlap the CONFIRM button and 13+ render off-canvas, unselectable. The box only shrinks today, so it is unreachable — until capture makes it grow. Tighter than the town box's 18-row display cap.
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
