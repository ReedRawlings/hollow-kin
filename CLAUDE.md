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

Each section has a corresponding detailed doc:

| File | Covers |
|------|--------|
| `game-design-document.md` | **Source of truth** — all systems, what persists vs. resets, specs index |
| `combat-system.md` | Turn-based combat, damage formula, buffs/debuffs, auto-combat tactics, enemy AI |
| `creature-roster-and-generation.md` | Full roster of 134 creatures across 11 archetypes; alpha's 30; the authored-vs-generated split, stat generation, capture pricing, generation pipeline |
| `breeding-and-inheritance.md` | Star ratings, level caps (0–12), stat inheritance, essence carry-over, trait inheritance |
| `traits-system.md` | 4 slots unlocked by permanent level, traits found & imbued, Trait-keeper, 4 trait levels — *not built* |
| `marks-system.md` | ⚠️ **PAUSED, two competing designs, zero code.** Describes the earn-then-lock model; `expedition-items-pitch.md` proposes replacing it with marks-as-discoveries. Pick one before building |
| `marks-catalog.md` | All mark entries with thresholds |
| `tower-structure.md` | One continuous descent (100 floors in 10 bands; alpha capped at 20), the band→floor mapping, depth-jumps, boss cadence, procgen rules |
| `town.md` | Essence hub — Creature Box, Leveler, Trait-keeper, Mark-binder, Gatekeeper, Quartermaster, Breeder |
| `economy-balancing.md` | Obols→Essence, level cost curve, depth-jump prices, pacing targets (all placeholders) |
| `relics.md` | Run-only temporary power-ups — *not built*, but **half of it exists as `Boons.ts`**; extend that layer rather than duplicating it |
| `onboarding.md` | Tutorial sequence (Phase 1: combat/Obols/capture, Phase 2: marks/breeding) — *not built* |
| `ui-ux.md` | Screen designs, visual language, accessibility |
| `Abilities.csv` | 72 abilities with stats, types, archetypes |
| `expedition-items-pitch.md` | ⚠️ **Partly shipped, remainder paused.** Historical record — where it disagrees with the code, the code wins. Departure, the item pool and post-battle offers are built; Preparations were superseded by timed boons; Heirlooms and Marks-as-unlocks are paused |
| `breeding-stones.md` | ⚠️ **RETIRED/CUT** — preserved for reference only; nothing depends on it |

## Current State — Essence Pivot Implemented (Phases 1–4a)

The **essence-progression pivot is built and merged to `main`.** The full core loop runs on the new model: town (essence hub) → party select → tower descent → combat → return → spend Essence / breed → repeat. Implementation history lives in `docs/superpowers/plans/` and `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md`.

### The Roster (swapped 2026-07-28)

The 36 placeholder creatures invented to have something to fight are **gone**. In their place are the **30 Tower ID 1,2 creatures** from the master spreadsheet (`Hollow Kins`, sheet `Kin`) — the actual authored content. Plan: `docs/superpowers/plans/2026-07-27-alpha-roster-swap.md`.

- **11 archetypes**, up from 8. `Devils`, `Dragon` and `Slimes` are new.
- **Species ids are `kin_NNN`**, zero-padded from the sheet's row id — `kin_070` is Cat. Ids are opaque; never parse meaning out of the number.
- **Identity is authored; everything else is generated.** `id`, `name`, `archetype`, `role`, `towerIds` are content decisions. Base stats (tier budget × role weights), both default abilities (archetype + role), capture prices (one per band) and trait pools (role staples + archetype flavour) are all derived. **Do not hand-tune a generated value in `creatures.ts`** — change the table and regenerate, or the spreadsheet stops being the source of truth.
- **`role` is the second content axis**, orthogonal to archetype: nine roles collapsing to four stat profiles (Tank/Mage/Healer/Fighter) plus a Buff/Debuff modifier that picks the second ability without touching stats. Alpha has four distinct stat blocks across 30 creatures — nine Mages are numerically identical. Expected at this stage; the first thing to revisit if fights feel samey.
- **`resistances` and `weaknesses` are deliberately empty.** The type chart is flat: `RESISTANCE_MULTIPLIER` never applies, and auto-combat's knowledge fog has nothing to withhold, so the "blind on first encounter" promise is intact but invisible. Filling these in touches `creatures.ts` only.
- **Encounter pools are derived from `towerIds`**, not hand-maintained. `poolForBand` filters the templates; moving a creature between bands is a data edit. All 30 sit in bands 1 and 2, so the two pools are currently identical — depth changes enemy *level*, not enemy *variety*.
- **Family rites are authored for all eleven archetypes**, and the five `RiteCondition` kinds the unsupported ones needed now exist. Combat does not populate the new `RiteLog` fields yet — those rites read false, which means full freight, never a crash. Signature rites are unwritten.
- **One fixed starting hand**, no choice: Cat (Fauna/Fighter), Geta (Kami/Tank), Wiggledrake (Dragon/Mage). `STARTER_TRIO_A` kept its name so a second hand can return without a rename.
- **`getTemplate` throws on an unknown id.** It used to return `undefined` typed as `CreatureTemplate`, which disarmed TypeScript at every call site.

### What's Built

**Source structure:**
```
src/
  main.ts                    — Phaser game config, scene registry, opt-in ?test= hooks
  types.ts                   — Interfaces, enums, economy/tower/capture constants
  data/
    abilities.ts             — 31 abilities (subset of 72; MP costs tuned)
    creatures.ts             — 30 creatures across 11 archetypes + FAMILY_RITES; pools from towerIds
    traits.ts                — 22-trait library (stat/battle-start/resistance/affinity/type/economy)
    items.ts                 — 9 expedition consumables; `usableIn`/`targeting` drive both UIs
  managers/
    GameState.ts             — Singleton: box, party, essence, permanent levels, backpack,
                               obol→essence conversion, depth-jump, save v7 (discard on mismatch)
  systems/
    CombatEngine.ts          — Damage formula, turn order, buffs, status
    TacticsAI.ts             — One side-agnostic chooseAction driving player tactics AND enemy AI
    BreedingSystem.ts        — Star calc, stat inheritance, essence carry-over, trait inheritance
    RunGenerator.ts          — Descent generation to TOWER_FLOORS + boss-aware pick-next
    Economy.ts               — Obol→Essence conversion, level cost curve, depth costs, carry-over
    Traits.ts                — Slot unlocking, stat bonuses, pool gating, derived breed-readiness
    Backpack.ts              — Slots, protected slots, single-random wipe loss, capture unload
    Departure.ts             — Derived: canDepart / nextDepartureFloor / hasWaystone (no state)
    Items.ts                 — Resolves an item in combat OR on the map; returns outcomes,
                               never consumes and never ends a battle or run itself
    Capture.ts               — Rite evaluation + band-keyed pricing (NOT wired into any scene)
    Bestiary.ts              — Monsterpedia entries, archetype ordering, paging
    Shop.ts / Recovery.ts    — Purchase and heal/revive resolution
    PartyStatus.ts           — Stale-default-party reporting by name
  scenes/
    BootScene (single starter hand), TownScene (essence hub), PartySelectScene,
    DepartureScene (depth + party confirm), RunScene ("TOWER — Floor N/20"),
    CombatScene + combat/BattlefieldRenderer, RunScene + run/BagPanel (usable bag),
    PostCombatScene, ShopScene (tower, Obols),
    TownShopScene (Provisioner, Essence), RestScene, BreedingScene, LevelerScene,
    GatekeeperScene (depth-jumps), BestiaryScene (Monsterpedia)
  ui/
    Theme.ts                 — Shared screen furniture + the archetype palette scenes actually use
```

**Working systems (all merged):**
- **Two-tier currency:** Obols in-run (heals/revives/shops), convert to permanent **Essence** on exit (flee/win = 100%, wipe = 50%)
- **Permanent essence levels:** creatures start each run at their essence-bought level floor (no level-1 reset); bought at the **Leveler** on a rising cost curve
- **One continuous descent, `TOWER_FLOORS` deep — 20 for alpha:** mini-boss every 5 floors, major every 10; rests appear as occasional filler (not guaranteed); boss-aware pick-next never skips a boss. Clearing the last floor lands on a `TOWER CLEARED` ledger, the third run outcome alongside fled and wiped
- **Depth-jumps:** clear a break, buy a deeper start at the **Gatekeeper** (per-run Essence cost)
- **Breeding:** star calc, stat inheritance, parent retirement, + **essence carry-over** jump-start to offspring
- Turn-based combat (abilities, MP, buffs/debuffs, status, player-only crits); **random enemy targeting**; single-enemy auto-target. The player's root menu is **`FIGHT / MAGIC / ITEM`** — damage mitigation is buff stages and items, and escaping a battle is the Smoke Husk rather than a menu verb
- Damage formula: `(ATK - DEF/2) × (Power/50) × TypeMultiplier`; per-creature resistances/weaknesses
- localStorage **save v7**. A version mismatch **discards the save** and removes the blob — there is no migration path and there should not be one. This is alpha: bump `SAVE_VERSION` freely when the shape changes and let players restart
- **Auto-combat / tactics (DQ-style):** per-creature standing tactic (Fight Wisely / All Out / Conserve MP / Heal First / Follow Orders), set in Party Select and persisted; global AUTO toggle in combat and on the run map, with `follow_orders` creatures still prompting manually while AUTO is on. One side-agnostic `TacticsAI.chooseAction()` drives **both** player tactics and enemy AI (`enemy_default` is a literal port of the old `getEnemyAction`, pinned by characterization tests). Knowledge fog: auto only exploits resistances/weaknesses of species already fought — recorded at battle end, so the first encounter with a species is genuinely blind. Persisted **1×/2×/4× battle speed** scales all combat pacing with a 100 ms floor.
- **Departure commitment — free flight is gone.** `FLEE` after every encounter is replaced by a gate that is open **only on a boss floor just cleared**; between bosses the way out is a carried **Waystone**. State is *derived* (`canDepart` reads whether the current encounter is a boss) — committing to a room closes it as a side effect, so nothing is stored and `RunState` gained no field. The map always shows the commitment (`NO WAYSTONE — NEXT GUARANTEED DEPARTURE: FLOOR n`), and picking a room while departure is open raises a **PRESS ON?** confirmation. `nextDepartureFloor` scans the generated descent rather than computing multiples of five, so it can never promise an exit floor that isn't there.
- **9 expedition consumables**, up from 2, with `usableIn`/`targeting` as data so no scene branches on an item id. **Only three are map-usable** — Mending Draught, Moonwater, Hollow Candle — because `RunState` carries only `partyHp`/`partyMp`/`partyKO`; buff stages and statuses die with the battle, so anything else would consume the item and silently do nothing. `applyItemOnMap` *refuses* those rather than no-opping. **Consumption happens only on a non-`refused` outcome**, at every call site.
- **The run-map bag is usable**, not just readable (`run/BagPanel.ts`): USE buttons, a target picker, and a short reason on items that are for fights only. It still shows which slots are `SECURED` — the only lever against the single random wipe loss.
- **Smoke Husk** ends a *battle* as a free action (no enemy acts in response) and deliberately **records no species knowledge** — otherwise "enter, read the enemy, escape, re-enter informed" would be free scouting against the auto-combat fog. Unavailable on boss floors, enforced by `usableIn: 'combat_non_boss'` and structurally unreachable there.
- **Both shops stock the pool:** the town Provisioner sells all nine (so a Waystone is *always* buyable before descending — this is what makes the departure lock fair rather than hostage to map RNG), the tower merchant a deterministic 3 per encounter, derived from the encounter's `floor`/`index` so hovering never reshuffles the stock.
- **Post-battle reward offer — three cards, not the old fixed heal/MP pair.** `PostCombatScene`'s victory screen draws three cards of **distinct kinds** from `heal | mana | obols | item | boon`, weighted per encounter tier (`RewardOffer.generateOffer`); a kind that would do nothing (heal with nobody hurt, mana with nobody short) is filtered out before the draw, so the offer shrinks rather than padding with a dead card. **Boons** (`data/boons.ts`, `systems/Boons.ts`) are timed, run-scoped modifiers — damage dealt, damage taken (with a first-round-only variant), Obol bonus, post-victory heal — that take effect the instant they're chosen: no backpack slot, no arming step. They expire after N battles (`RunState.activeBoons`, ticked in `CombatScene` after every fight), and **one boon per effect kind may be active at once** — re-taking a boon whose effect kind is already held refreshes its duration rather than stacking the magnitude. There is deliberately **no MP-discount boon**: `ability.mpCost` is read raw in roughly thirteen places across `CombatScene` and `TacticsAI` (affordability, menu labels, Conserve MP's ceiling, Heal First's reserve, tiebreaks), and a discount missing any one of them would make auto-combat plan against a cost the player doesn't pay — the full rationale lives in the `data/boons.ts` header. Taking an item card with a full bag opens a swap picker rather than failing silently; both `KEEP MY BAG` and ESC forfeit the reward and continue identically. Active boons show on the run map with a countdown (`activeBoonSummaries`).
- **31 abilities** (MP costs cut ~40% for a healthier MP economy), **30 creatures** across 11 archetypes, all in tower bands 1–2
- vitest test suite — 449 tests across 20 files, including roster authoring invariants in `src/data/creatures.test.ts` (every ability id resolves, every band is priced, every archetype shares one family rite) and pool invariants in `Traits.test.ts`

**Removed in the pivot:** Plasm, Longevity, Breeding Stones, Enhancer, Leathersmith, the 3-zone structure.

**Visuals:** Placeholder colored rectangles per archetype. No sprites yet.

### What's NOT Built Yet

*Audited against `src/` on 2026-07-28. "Built" here means a player can reach it, not that a module exists.*

#### Engine built, no way in — the important category

These are the ones most likely to be misjudged in either direction. The logic exists, is unit-tested, and does nothing, because **nothing in the game can reach it.** Do not plan them as greenfield work, and do not assume they function.

- **Capture** — `src/systems/Capture.ts` is complete and tested: rite evaluation, band-keyed pricing, the HP nudge, bidding, insult/waver reactions, enrage. `Backpack.ts` already carries `kind: 'creature'` slots, `unloadCapturesToBox` moves them into the box on exit, and `applyWipeLoss` puts an unprotected one at risk exactly as the design rule says. **What is missing is every point of contact:** `Capture.ts` is imported by nothing but its own test, `CombatScene` has no capture action, and nothing populates the new `RiteLog` fields (items consumed, damage types *dealt*, struck stat stages, party archetypes, debuffs applied) — so seven of the eleven family rites evaluate false and every creature would sit at full freight. Spec: `docs/superpowers/specs/2026-07-25-capture-system-design.md`.
- **Traits** — `src/systems/Traits.ts` plus a 22-trait library. Slots unlock from `permanentLevel` at 5/10/20/30, `applyStatTraitBonuses` is wired into `calculateStatsForLevel` so a held trait really would change stats, `canSpeciesTakeTrait` gates on `naturalTraitPool` (now authored for all 30), and `resolveInheritedTraitSlots` handles breeding inheritance. **No code path ever writes a non-null `traitId`.** There is no Trait-keeper (the town tile is shuttered), no boss drop, no event reward; `BackpackContents` declares a `kind: 'trait'` slot that nothing ever constructs. Every creature's slots are permanently empty, so the whole system is currently invisible. Acquisition is the only missing piece — and it unblocks the *Essence Distiller* conversion lever, which is authored into three species' pools and equally unreachable. Spec: `docs/superpowers/specs/2026-07-26-traits-system-design.md`.

#### Not built at all — zero code

- **Marks system** — PAUSED 2026-07-30, and there are **two competing designs on file**. Zero code either way: no `earnedMarks` or `activeMarkId` field, the Mark-binder tile is shuttered, and the `kind: 'mark'` backpack slot in `types.ts` is never constructed. `marks-system.md` and the GDD describe the **earn-then-lock** model (creature-specific bonus, one slot, Essence buys permanence); `expedition-items-pitch.md` proposes replacing it with marks as permanent **discoveries** that unlock content for the player (no slot, no Essence, permanent on discovery). Whoever resumes picks one first — and note the pitch's version unlocks Relics and Heirlooms, neither of which exists. Two catalogue issues survive either choice (`marks-catalog.md`): the deepest Floor Mark grants damage "deeper than" a floor with nothing below it, and `mark_physical`/`mark_fighting` are the same mark twice.
- **Run relics** (temporary power-ups) — no code, no data.
- **Onboarding tutorial** (old-man flow in `onboarding.md`) — no code, no data.
- **The rest of `expedition-items-pitch.md`.** Slice 1 (departure commitment + the nine consumables) shipped, then the post-battle reward offer and timed boons (see "What's Built" above). That second shipment is also where the pitch's **Preparations** landed — reshaped during design into the auto-applying timed boons rather than built as originally pitched: no backpack slot, no charges, no pre-battle arming step. That reshaping is deliberate: it makes a boon functionally a short-duration Relic, and `ActiveBoon.battlesLeft` already permits `null` so Relics can reuse this layer rather than duplicate it when they're eventually built. **Heirlooms** and **Marks-as-unlocks** are the two remaining pieces, and both are **PAUSED as of 2026-07-30** — not cancelled, but not queued either. Nothing was built for either and no code references them. Marks is the harder resumption: its reward vocabulary is "unlock a Relic / Heirloom / Preparation", and Relic and Heirloom still don't exist while Preparation no longer means what the pitch meant, so its reward list has to be re-derived from whatever exists at that point. Spec for what did ship: `docs/superpowers/specs/2026-07-29-expedition-commitment-and-consumables-design.md`.
- **Quartermaster vendor** — no town tile. The backpack it would sell against *is* built: `guaranteedSlots` protects the first N slots from wipe loss and `BACKPACK_START_CAPACITY`/`_GUARANTEED` are the placeholders it would raise. Neither capacity nor guaranteed count is purchasable, and the Obols→Essence conversion-rate upgrades are likewise unimplemented — `convertObolsToEssence` applies the flat base rate with no trait, upgrade or depth bonus.

#### Content gaps

- Remaining ~41 abilities from `Abilities.csv` (31 of 72 in code)
- Remaining creatures (30 of 134) and tower bands 3–10 (floors 21–100)
- **`resistances`/`weaknesses` are empty on all 30** — the type chart is flat, so `RESISTANCE_MULTIPLIER` never applies and auto-combat's knowledge fog has nothing to withhold. Biggest live content gap.
- 9 items exist. The pool answers recognisable dangers but has no depth-band variety — the same nine are sold at floor 1 and floor 20
- Signature rites — unwritten for every species (family rites are done)
- Any art/sprites — every creature is a coloured rectangle

#### Corrections — these ARE built, despite older notes saying otherwise

- **Monsterpedia** — `BestiaryScene` is built, registered, and reachable from THE ARCHIVE in town. It renders all 30 species in archetype order with discovered/silhouette states and a detail panel. The old note claiming "nothing shows it to the player" was stale.
- **Auto-combat / tactics** — fully built (`TacticsAI`, per-creature standing tactics, AUTO toggle, battle-speed control). Any roadmap entry listing it as future work is stale.
- **Backpack and shops** — built and reachable: the Tower Merchant (Obols) and the town Provisioner (Essence), carried items usable in combat, the single-random-loss wipe rule, and protected slots.

**Resolved (2026-07-25):** the combat "freeze after one action" is **not** a bug and **not** an HMR artifact. Chrome throttles `requestAnimationFrame` to zero in a backgrounded or unfocused tab, so Phaser's game loop stops stepping and the Scene Clock never advances — every `this.time.delayedCall` in `CombatScene` (which is how turns advance) simply never fires. Measured directly: `document.hidden === true`, `game.loop.frame` advancing 0 frames per second, `scene.time.now` frozen. The canvas still *appears* to update because DOM input events keep dispatching and a screenshot forces a paint, which is exactly what makes it look like a logic hang. **Keep the tab focused and visible when playtesting combat.** Verify before assuming it's a real turn-loop bug.

**Placeholder numbers to tune (playtest)** — a non-exhaustive list; see the alpha note at the top of this file. **Start with the Smoke Husk's price (60 Obols / 30 Essence).** It escapes a battle as a *free action* — the strongest form of the item, chosen deliberately — so its scarcity is the only thing carrying the tension the departure lock is meant to create. If a free-action escape proves too strong, raise the price; do not change the rule. After that: the nine item prices generally, Grave Ash's 0.25 / 0.08 boss split (only `bossFraction < fraction` is real design), and the Waystone at 80/40. Then Obol base rewards 5/25/75 now scaled by depth as `base × SCALAR × floor^EXPONENT` (`OBOL_REWARD_EXPONENT` is derived from `LEVEL_COST_EXPONENT` — retune the pair together, never separately), conversion rate 0.5, wipe penalty 50%, level cost `10·L^1.5`, depth-jump unlock `(floor-1)×40` plus a per-run fee `(floor-1)×5`, breeding carry-over 50%, MP costs across all 31 abilities, the tactic ladder thresholds (Fight Wisely's half-current-MP budget, Conserve MP's ⅓-max-MP ceiling and 50% party-danger gate, Heal First's 60%/2×-cheapest-heal reserve), battle speed steps, and enemy/XP scaling by floor/depth band.

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
- **Stars are staying, and coupling to them is fine** (decided 2026-07-26). Stars are the level ceiling, and via the ceiling they also gate **trait capacity** — slots unlock at permanent levels 5/10/20/30, so a 0★ creature reaches one slot until breeding raises its star. This reverses the old "backup C / do not hard-couple to stars" note. **Why:** stars are what stop players settling on one roster forever — the goal is that they keep breeding and finding new creatures rather than maxing three favourites.
- **Trait slots unlock by `permanentLevel` only** — never by temporary in-run levels — and they unlock **empty**. There is no random trait roll. Traits are found (boss drops, events, puzzles later), bought from the Trait-keeper, or inherited, then imbued. Design: `docs/superpowers/specs/2026-07-26-traits-system-design.md`.
- **Breed-readiness is derived, not stored:** `permanentLevel >= levelCap`. Do not reintroduce a stored `isBreedReady` flag set during a run.
- Both parents are **retired** when breeding, but invested essence **carries over** to the offspring as a jump-start. Retired parents **stay in the creature box as tombstones** — do not delete them. Every box consumer filters `!isRetired`, and keeping them is what lets a stale default party name the creature that left instead of saying "a former party member".
- **Breeding requires a minimum level investment, and this is load-bearing.** A creature is breed-ready only on hitting its star's level cap — **5 for a 0★ starter**, higher for higher stars. Stats pass down through generations, so breeding too early founds a weak line and the weakness compounds every generation after. Never relax this gate casually. A **captured creature arrives at level 1**, so it is far from breedable: capture yields a bloodline candidate, not a parent.
- **Longevity is removed.** No run counter, no forced retirement.
- Tower is **one continuous descent** — no zones. The full game is **100 floors in 10 bands of 10**; **alpha caps it at 20** (`TOWER_FLOORS`), the deepest the current roster reaches. Raising the cap is a one-constant change — descent generation, the Gatekeeper's grant loop, the results ledger and the tests all derive from it. Mini-boss every 5 floors, major every 10. Depth-jumps buyable at cleared 5-floor breaks (buy 5 → start 6).
- **A creature's `towerIds` are the only statement of where it appears.** Encounter pools derive from them; never hand-maintain a parallel pool list, and never read meaning into a pool's ordering — `pool[0]` is not "the strongest".
- First floor (and any post-jump floor) is **combat**. Rests are **occasional random filler** — never guaranteed before a boss.
- Enemies pick a **random** living target (spread damage); single-target attacks **auto-target** when one enemy remains.
- Player crits only — enemies cannot crit.
- Buff/debuff stages cap at **±3**.

## Roadmap / Next Steps

**Done:** essence pivot Phases 1–4a (currency, permanent levels, the continuous descent, Leveler + Gatekeeper vendors, breeding carry-over) + playtest tuning, then the alpha roster swap (30 authored creatures, 11 archetypes, derived pools, 20-floor cap), then expedition slice 1 (boss-gated departure, Waystone/Smoke Husk, the nine-item pool, the usable bag).

**Next, in rough priority:**
1. **Capture — wire the built engine into combat.** Spec: `docs/superpowers/specs/2026-07-25-capture-system-design.md`. `Capture.ts` and the backpack's creature-cargo handling are done and tested; what remains is a capture action on the combat turn, a bidding UI, and **populating the `RiteLog` fields nothing writes yet** — without that last piece seven of the eleven family rites can never be satisfied and every creature prices at full freight. `newRiteLog()` names each missing write site. Note the spec cites `docs/superpowers/research/capture-mechanics-research.md`, which is **not in the repo** — treat the spec as self-contained.

   Two rules from elsewhere in this file that constrain it: a capture **arrives at level 1** and is cargo, not a reinforcement — it cannot be fielded during the run that caught it; and it is **eligible for the single random wipe loss** unless it occupies guaranteed inventory space.

   **Capture is what re-opens breeding — this is the strongest reason it is first.** The box has exactly three write paths: new game (the starter trio), breeding, and `unloadCapturesToBox`. The third is dead code until capture is wired, and breeding is **net −1** (two parents retire, one offspring is born), so today the box can only ever shrink.

   That used to be a **save-bricking soft-lock**, reachable in the first hour on the intended path (`economy-balancing.md` targets a first breed by run 3–4): three starters → breed once → two living creatures → `PartySelectScene`'s `selected.length === PARTY_SIZE` gate never satisfies → the tower is unenterable → nothing can be earned → only NEW GAME recovers it.

   **Guarded 2026-07-31.** `breedingAvailability()` in `BreedingSystem.ts` blocks a breed that would drop the box below `MIN_LIVING_TO_BREED` (`PARTY_SIZE + 1`), counting non-retired creatures only. Enforced at the Hatchery tile *and* in `performBreed`. The town tile now distinguishes **CLOSED** (recoverable state, shows the reason) from **SHUTTERED** (not in this build) via `Place.blockedReason`.

   **The consequence to understand:** since nothing else grants creatures, breeding is now *entirely unreachable on a fresh save*. The guard trades a dead save for a temporarily dead vendor — it is a stopgap, not a fix, and capture is what actually restores breeding. Keep the guard afterwards anyway; breeding into an unfieldable party is never a move anyone means to make.

   **Two decisions already made (2026-07-31), so they do not get relitigated:**
   - **Bosses are not capturable.** Every alpha species currently carries a real `captureBasePrice` in bands 1 and 2 and nothing is zero-priced, so the capture action must gate on `encounter.type === 'boss'` — authoring `0` prices is not enough, since boss encounters draw from the ordinary wild pool.
   - **Enemies act after a failed bid.** A bid is not a free action. This is what gives `CAPTURE_ENRAGE_AFTER` its teeth: probing the price costs turns as well as risking enrage. Contrast the Smoke Husk, which is deliberately free.

   **Both former blockers are resolved (2026-07-31):**
   - **`ally_knocked_out` is now `enemy_party_lost_member`.** The behaviour was always "a creature on the *capturing* party is down" — `CaptureParty` is the player's side — and the old name said the opposite. Renamed rather than reimplemented: the alternative reading ("one of its own kin fell") is nearly free in any multi-enemy fight, whereas losing a party member is a real cost, and a family rite should be a puzzle. Spirits' rite now reads correctly.
   - **The price is shown; the *rite* is the secret.** `reactionFor` returning a word and never a number is about the **rejection feedback**, not about hiding the price. `capturePrice` already reflects satisfied rites, so the UI displays it live and the player watches it drop when a rite latches — that drop is the discovery moment, and it teaches "something I did made this cheaper" without naming what. What stays hidden is which rite. Do not build a price-guessing minigame: with enrage at three rejections and enemies acting after each, probing for the number would be unplayable.

   **`PartySelectScene` is fixed (2026-07-31)** and no longer blocks a growing box: paging is resolved through `ui/paging.ts` (unit-tested, clamps in both directions), the page arrows are pointer-reachable as well as PGUP/PGDN, CONFIRM/BACK no longer overlap, and long names truncate inside their cards. Verified in-browser at 15 creatures.
2. **Trait acquisition — the engine is already built.** Spec: `docs/superpowers/specs/2026-07-26-traits-system-design.md`. Slots, level-gated unlocking, pool gating and breeding inheritance all work. **Two pieces are missing, not one:**

   - **Acquisition** — no code path ever writes a non-null `traitId`. Needs the Trait-keeper vendor plus at least one found source (boss drop or event) writing a `kind: 'trait'` slot into the backpack.
   - **Effects for six of the seven trait categories.** `applyStatTraitBonuses` is the *only* consumer of trait data (via `calculateStatsForLevel`), and it handles `stat` traits alone. `battle_start`, `resistance`, `affinity`, `evasion`, `type` and `economy` traits are inert — Opening Ward, Resist Fire, Kin Bond, Evasion Up and **Essence Distiller** would all imbue successfully and do nothing. Note `evasion_up` is doubly blocked: combat has no evasion term at all.

   So granting a trait is necessary but not sufficient — the Essence Distiller conversion lever needs its effect handler too, not just a way to obtain it.

   *Three blockers this entry used to list are done:* breed-readiness is now derived via `isCreatureBreedReady` (the stored `isBreedReady` field is vestigial and read nowhere), the star-based slot unlock in `BreedingSystem` is deleted, and `naturalTraitPool` is authored for all 30 species.
3. **Quartermaster vendor** — the backpack itself is built; this is the shop that sells capacity, guaranteed slots and Obols→Essence conversion-rate upgrades. Pairs with capture. Note the post-battle swap picker hard-codes a 3-column grid sized for `BACKPACK_START_CAPACITY = 6`; raising capacity past 12 pushes its fourth row through the KEEP MY BAG button, so revisit `PostCombatScene.drawSwap` as part of this.
4. Content & polish: `resistances`/`weaknesses` for the 30 (the flat type chart is the biggest live gap), more creatures (30→134) and tower bands 3–10, more abilities (31→72), onboarding tutorial, sprites.

Each new system (capture/traits/marks/inventory) warrants its own design pass before implementation. Ongoing: tune the placeholder numbers listed above via playtest.

## Running the Project

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

Click "NEW GAME" in town to reset localStorage save if needed.
