# Hollow Kin — Project Context

## What This Is

Hollow Kin is a browser-based **permanent-progression creature collector** built on a roguelite run structure. The player descends a procedurally generated tower with a party of 3 bred creatures, harvesting Obols from fights and converting what they carry out into Essence — the permanent currency behind levels, traits, and deeper starting floors.

**A run is a harvesting trip, not the unit of progress.** Creatures do not reset. Inspired by Dragon Quest Monsters (breeding), Azure Dreams (tower/run structure), and Slay the Spire (run pacing). The roguelite inheritance is the *shape of a descent* — procedural floors, push-your-luck depth, run-scoped boons — not the progression model.

## ⚠️ This Game Is In Alpha — Numbers Are Not Settled

**Assume every gameplay number in this project is a placeholder until proven otherwise.** Costs, rewards, drop rates, stat curves, scaling exponents, thresholds, and timings are all set by feel and are expected to move repeatedly as the game is played. They are testing values, not balance decisions.

What this means in practice:

- **Do not treat a number as a requirement.** If a number makes a system behave badly, say so — proposing a different value is useful, not out of scope.
- **Do not write tests that pin a specific magic number** unless the exact value is the point. Test the *shape* — that cost rises with level, that a fee is free at floor 1, that rewards scale with depth — so retuning doesn't turn the suite red for no reason. Tests that assert `=== 75` make numbers expensive to change, which is exactly backwards during alpha.
- **Do pin relationships between numbers.** Where two constants must move together (e.g. `OBOL_REWARD_EXPONENT` is derived from `LEVEL_COST_EXPONENT`), that invariant is real design and worth enforcing even though the values themselves are not.
- **Structure and rules are firmer than values.** The design rules below are decisions; the numbers scattered through the docs mostly are not.

## Tech Stack

- **Engine:** Phaser 4 (v4.2.1 — migrated 2026-08-23; see `docs/dev/phaser-editor.md` for the Phaser Editor workflow)
- **Language:** TypeScript
- **Build:** Vite
- **Save:** localStorage (Supabase planned for later)
- **Canvas:** 960×640 logical resolution, `zoom: devicePixelRatio` for crisp rendering on HiDPI displays

## Design Documents

Everything lives under `docs/`. The full map is `docs/README.md`; the short version:

**Precedence: code → CLAUDE.md → docs/design → docs/decisions → docs/archive. Anything lower that disagrees with anything higher is wrong, not a ranking to apply.**

`docs/design/` is the live design — the only place a rule lives. `docs/design/game-design-document.md` is the source of truth; each topic doc owns its own subject and carries a header saying what it owns, what it defers to the GDD on, and when it was last verified.

| File | Covers |
|------|--------|
| `docs/design/game-design-document.md` | **Source of truth** — all systems, what persists vs. resets, specs index |
| `docs/design/combat-system.md` | Turn-based combat, damage formula, the wards, buffs/debuffs, crits, auto-combat tactics, enemy AI, Pack Tempo / Relay |
| `docs/design/creature-roster-and-generation.md` | Full roster of 134 creatures across 11 archetypes; alpha's 30; the authored-vs-generated split, stat generation, capture pricing, generation pipeline |
| `docs/design/breeding-and-inheritance.md` | Star ratings, level caps (0–12), stat inheritance, essence carry-over, trait inheritance |
| `docs/design/traits-system.md` | 4 slots unlocked by permanent level, traits found & imbued, Trait-keeper, 4 trait levels — *not built* |
| `docs/design/marks-system.md` | **Decided 2026-08-27, not built.** Marks are permanent *discoveries* — a recorded deed that unlocks content (boons, items, traits in stock, titles, events). No slot, no Essence, no stat bonus. Includes the starter deed table and the Ledger (town reading place). Waits on capture and boss variety |
| `docs/design/tower-structure.md` | One continuous descent (100 floors in 10 bands; alpha capped at 20), the band→floor mapping, depth-jumps, boss cadence, event rooms, procgen rules |
| `docs/design/town.md` | Essence hub — Creature Box, Leveler, Trait-keeper, the Ledger, Gatekeeper, Quartermaster, Breeder |
| `docs/design/economy-balancing.md` | Obols→Essence, level cost curve, depth-jump prices, pacing targets (all placeholders) |
| `docs/design/onboarding.md` | Tutorial sequence (Phase 1: combat/Obols/capture, Phase 2: marks/breeding) — *not built* |
| `docs/design/ui-ux.md` | Screen designs, visual language, accessibility |
| `docs/design/Abilities.csv` | 72 abilities with stats, types, archetypes |

- **`docs/decisions/`** — dated design specs (formerly `docs/superpowers/specs/`). Point-in-time records of how a decision was reached, including rejected alternatives. Read-only; not authorities. If a spec and the GDD disagree, that is a bug in the GDD to fix.
- **`docs/archive/`** — never authoritative. `plans/` are executed implementation plans; `pitches/` hold the combat-depth pitches and `docs/archive/pitches/expedition-items-pitch.md` (shipped in changed form — where it disagrees with the code, the code wins); `research/` is raw background; `retired/` keeps cut systems such as `docs/archive/retired/breeding-stones.md` for the reasoning only.
- **`docs/dev/`** — developer tooling: `docs/dev/battle-chamber.md`, `docs/dev/phaser-editor.md`, `docs/dev/level-calculator.xlsx`.
- **`progress.md`** at the root is the running decision log.

## Current State — Essence Pivot Implemented (Phases 1–4a)

The **essence-progression pivot is built and merged to `main`.** The full core loop runs on the new model: town (essence hub) → party select → tower descent → combat → return → spend Essence / breed → repeat. Implementation history lives in `docs/archive/plans/` and `docs/decisions/2026-07-23-essence-progression-pivot-design.md`.

### The Roster (swapped 2026-07-28)

The 36 placeholder creatures invented to have something to fight are **gone**. In their place are the **30 Tower ID 1,2 creatures** from the master spreadsheet (`Hollow Kins`, sheet `Kin`) — the actual authored content. Plan: `docs/archive/plans/2026-07-27-alpha-roster-swap.md`.

- **11 archetypes**, up from 8. `Devils`, `Dragon` and `Slimes` are new.
- **Species ids are `kin_NNN`**, zero-padded from the sheet's row id — `kin_070` is Cat. Ids are opaque; never parse meaning out of the number.
- **Identity is authored; everything else is generated.** `id`, `name`, `archetype`, `role`, `towerIds` are content decisions. Base stats (tier budget × role weights), both default abilities (archetype + role), capture prices (one per band) and trait pools (role staples + archetype flavour) are all derived. **Do not hand-tune a generated value in `creatures.ts`** — change the table and regenerate, or the spreadsheet stops being the source of truth.
- **`role` is the second content axis**, orthogonal to archetype: nine roles collapsing to four stat profiles (Tank/Mage/Healer/Fighter) plus a Buff/Debuff modifier that picks the second ability without touching stats. Alpha has four distinct stat blocks across 30 creatures — nine Mages are numerically identical. Expected at this stage; the first thing to revisit if fights feel samey.
- **`resistances` and `weaknesses` are authored for all 30** (imported from the master sheet 2026-08-02, one of each per creature). `RESISTANCE_MULTIPLIER` applies for real and auto-combat's knowledge fog has something to withhold — the first encounter with a species is genuinely blind. Details under *Content gaps → The wards* below. Editing ward data touches `creatures.ts` only, but instances snapshot it at creation, so bump the save afterwards.
- **Encounter pools are derived from `towerIds`**, not hand-maintained. `poolForBand` filters the templates; moving a creature between bands is a data edit. All 30 sit in bands 1 and 2, so the two pools are currently identical — depth changes enemy *level*, not enemy *variety*.
- **Family rites are authored for all eleven archetypes**, and the five `RiteCondition` kinds the unsupported ones needed now exist. `RiteRecorder.ts` now writes every `RiteLog` field from combat, so all eleven family rites can latch — but capture itself is still unwired, so nothing reads them yet. Signature rites are unwritten.
- **One fixed starting hand**, no choice: Cat (Fauna/Fighter), Geta (Kami/Tank), Wiggledrake (Dragon/Mage). `STARTER_TRIO_A` kept its name so a second hand can return without a rename.
- **`getTemplate` throws on an unknown id.** It used to return `undefined` typed as `CreatureTemplate`, which disarmed TypeScript at every call site.

### What's Built

**Source structure:**
```
src/
  main.ts                    — Phaser game config, scene registry, opt-in ?test= hooks
  types.ts                   — Interfaces, enums, economy/tower/capture constants
  data/
    abilities.ts             — 45 abilities (subset of 72; all ten wards dealable; MP costs tuned)
    creatures.ts             — 30 creatures across 11 archetypes + FAMILY_RITES; pools from towerIds
    traits.ts                — 22-trait library (stat/battle-start/resistance/affinity/type/economy)
    items.ts                 — 9 expedition consumables; `usableIn`/`targeting` drive both UIs
  managers/
    GameState.ts             — Singleton: box, party, essence, permanent levels, backpack,
                               obol→essence conversion, depth-jump, save v10 (discard on mismatch)
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
    RiteRecorder.ts          — Per-enemy RiteLog book written during combat; feeds Capture.ts
    Events.ts                — Event-room offers (ACCEPT / WALK AWAY resolution)
    Relationships.ts         — Gary the Gatekeeper's 5-stage arc; gates his passages and gift
    PackTempo.ts / LinkArts.ts / TurnTimeline.ts
                             — Tempo generation, Link Art recipes, the shared turn timeline
    SharedActionPool.ts / SharedActionAI.ts
                             — Party-wide RELAY action pool and the AI that spends it
    BattleChamber.ts         — Dev-lab flags the combat rules are queried through (never branched on)
    SeededRandom.ts          — Deterministic RNG for runs and the chamber
    PlayerName.ts            — Player-name validation/normalisation
    combat/Battle.ts         — Battle state, XP rules, victory/defeat resolution
    Bestiary.ts              — Monsterpedia entries, archetype ordering, paging
    Shop.ts / Recovery.ts    — Purchase and heal/revive resolution
    PartyStatus.ts           — Stale-default-party reporting by name
  scenes/
    BootScene (single starter hand), TownScene (essence hub), PartySelectScene,
    DepartureScene (depth + party confirm), RunScene ("TOWER — Floor N/20"),
    CombatScene + combat/BattlefieldRenderer, RunScene + run/BagPanel (usable bag),
    PostCombatScene, ShopScene (tower, Obols),
    TownShopScene (Provisioner, Essence), RestScene, BreedingScene, LevelerScene,
    GatekeeperScene (depth-jumps), BestiaryScene (Monsterpedia), EventScene (offer rooms),
    DialogueScene (Gary's conversations), BattleChamberScene (combat dev lab)
  ui/
    Theme.ts                 — Shared screen furniture + the archetype palette scenes actually use
```

**Working systems (all merged):**
- **Two-tier currency:** Obols in-run (heals/revives/shops), convert to permanent **Essence** on exit (flee/win = 100%, wipe = 50%)
- **Permanent essence levels:** creatures start each run at their essence-bought level floor (no level-1 reset); bought at the **Leveler** on a rising cost curve
- **One continuous descent, `TOWER_FLOORS` deep — 20 for alpha:** mini-boss every 5 floors, major every 10; rests appear as occasional filler (not guaranteed); boss-aware pick-next never skips a boss. Clearing the last floor lands on a `TOWER CLEARED` ledger, the third run outcome alongside fled and wiped
- **Depth-jumps:** clear a break, buy a deeper start at the **Gatekeeper** (per-run Essence cost)
- **Breeding:** star calc, stat inheritance, parent retirement, + **essence carry-over** jump-start to offspring
- Turn-based combat (abilities, MP, buffs/debuffs, status); **crits are conditional per-ability** — an ability crits when its authored `critCondition` holds, there is no random crit roll; **random enemy targeting**; single-enemy auto-target. The player's root menu is **`FIGHT / MAGIC / ITEM / RELAY`** — damage mitigation is buff stages and items, and escaping a battle is the Smoke Husk rather than a menu verb
- Damage formula: `(ATK - DEF/2) × (Power/50) × TypeMultiplier`; per-creature resistances/weaknesses
- localStorage **save v10** (`SAVE_VERSION` in `GameState.ts`). A version mismatch **discards the save** and removes the blob — there is no migration path and there should not be one. This is alpha: bump `SAVE_VERSION` freely when the shape changes and let players restart
- **Auto-combat / tactics (DQ-style):** per-creature standing tactic (Fight Wisely / All Out / Conserve MP / Heal First / Follow Orders), set in Party Select and persisted; global AUTO toggle in combat and on the run map, with `follow_orders` creatures still prompting manually while AUTO is on. One side-agnostic `TacticsAI.chooseAction()` drives **both** player tactics and enemy AI (`enemy_default` is a literal port of the old `getEnemyAction`, pinned by characterization tests). Knowledge fog: auto only exploits resistances/weaknesses of species already fought — recorded at battle end, so the first encounter with a species is genuinely blind. Persisted **1×/2×/4× battle speed** scales all combat pacing with a 100 ms floor.
- **Departure commitment — free flight is gone.** `FLEE` after every encounter is replaced by a gate that is open **only on a boss floor just cleared**; between bosses the way out is a carried **Waystone**. State is *derived* (`canDepart` reads whether the current encounter is a boss) — committing to a room closes it as a side effect, so nothing is stored and `RunState` gained no field. The map always shows the commitment (`NO WAYSTONE — NEXT GUARANTEED DEPARTURE: FLOOR n`), and picking a room while departure is open raises a **PRESS ON?** confirmation. `nextDepartureFloor` scans the generated descent rather than computing multiples of five, so it can never promise an exit floor that isn't there.
- **9 expedition consumables**, up from 2, with `usableIn`/`targeting` as data so no scene branches on an item id. **Only three are map-usable** — Mending Draught, Moonwater, Hollow Candle — because `RunState` carries only `partyHp`/`partyMp`/`partyKO`; buff stages and statuses die with the battle, so anything else would consume the item and silently do nothing. `applyItemOnMap` *refuses* those rather than no-opping. **Consumption happens only on a non-`refused` outcome**, at every call site.
- **The run-map bag is usable**, not just readable (`run/BagPanel.ts`): USE buttons, a target picker, and a short reason on items that are for fights only. It still shows which slots are `SECURED` — the only lever against the single random wipe loss.
- **Smoke Husk** ends a *battle* as a free action (no enemy acts in response) and deliberately **records no species knowledge** — otherwise "enter, read the enemy, escape, re-enter informed" would be free scouting against the auto-combat fog. Unavailable on boss floors, enforced by `usableIn: 'combat_non_boss'` and structurally unreachable there.
- **Both shops stock the pool:** the town Provisioner sells all nine (so a Waystone is *always* buyable before descending — this is what makes the departure lock fair rather than hostage to map RNG), the tower merchant a deterministic 3 per encounter, derived from the encounter's `floor`/`index` so hovering never reshuffles the stock.
- **Post-battle reward offer — three cards, not the old fixed heal/MP pair.** `PostCombatScene`'s victory screen draws three cards of **distinct kinds** from `heal | mana | obols | item | boon`, weighted per encounter tier (`RewardOffer.generateOffer`); a kind that would do nothing (heal with nobody hurt, mana with nobody short) is filtered out before the draw, so the offer shrinks rather than padding with a dead card. **Boons** (`data/boons.ts`, `systems/Boons.ts`) are timed, run-scoped modifiers — damage dealt, damage taken (with a first-round-only variant), Obol bonus, post-victory heal — that take effect the instant they're chosen: no backpack slot, no arming step. They expire after N battles (`RunState.activeBoons`, ticked in `CombatScene` after every fight), and **one boon per effect kind may be active at once** — re-taking a boon whose effect kind is already held refreshes its duration rather than stacking the magnitude. There is deliberately **no MP-discount boon**: `ability.mpCost` is read raw in roughly thirteen places across `CombatScene` and `TacticsAI` (affordability, menu labels, Conserve MP's ceiling, Heal First's reserve, tiebreaks), and a discount missing any one of them would make auto-combat plan against a cost the player doesn't pay — the full rationale lives in the `data/boons.ts` header. Taking an item card with a full bag opens a swap picker rather than failing silently; both `KEEP MY BAG` and ESC forfeit the reward and continue identically. Active boons show on the run map with a countdown (`activeBoonSummaries`).
- **Event rooms are offers, not windfalls** (`data/events.ts`, `systems/Events.ts`, `EventScene`). Entering an `'event'` room draws one of five events uniformly from the *viable* set (dead offers filtered first, as `RewardOffer` does) and shows its exact terms with **ACCEPT / WALK AWAY**; walking away is free. **Events grant no XP** — the only XP route is Warden's Wager, which starts a combat on the current floor with `Encounter.rewardMultiplier: 2` (applied to Obols and XP in `victoryRewards`, composed with the boon multiplier). Mercy Well and Tinker's Trade cost 10% of *current* Obols (free at 0); Blood Boon and The Dice pay in HP and can never leave anyone below 1. Resolvers are pure and the scene applies the `EventResolution`, the same contract as `Items.ts`. Spec: `docs/decisions/2026-08-27-event-rooms-design.md`.
- **Gary the Gatekeeper has a relationship arc** — a 5-stage progression in `Relationships.ts`, played out through `DialogueScene`. Gatekeeper purchases (depth-jump passages) are gated on stage ≥ 2; stages 4–5 require reaching floor ≥ 40, so they are unreachable at the 20-floor alpha cap. Plan: `docs/archive/plans/2026-07-31-gary-gatekeeper-relationship.md`.
- **45 abilities** (MP costs cut ~40% for a healthier MP economy), **30 creatures** across 11 archetypes, all in tower bands 1–2
- vitest test suite — 562 tests across 34 files, including roster authoring invariants in `src/data/creatures.test.ts` (every ability id resolves, every band is priced, every archetype shares one family rite) and pool invariants in `Traits.test.ts`

**Removed in the pivot:** Plasm, Longevity, Breeding Stones, Enhancer, Leathersmith, the 3-zone structure.

**Visuals:** Placeholder colored rectangles per archetype. No sprites yet.

### What's NOT Built Yet

*Audited against `src/` on 2026-07-28. "Built" here means a player can reach it, not that a module exists.*

#### Engine built, no way in — the important category

These are the ones most likely to be misjudged in either direction. The logic exists, is unit-tested, and does nothing, because **nothing in the game can reach it.** Do not plan them as greenfield work, and do not assume they function.

- **Capture** — `src/systems/Capture.ts` is complete and tested: rite evaluation, band-keyed pricing, the HP nudge, bidding, insult/waver reactions, enrage. `Backpack.ts` already carries `kind: 'creature'` slots, `unloadCapturesToBox` moves them into the box on exit, and `applyWipeLoss` puts an unprotected one at risk exactly as the design rule says. **What is missing is every point of contact:** `Capture.ts` is imported by nothing but its own test, and `CombatScene` has no capture action. The `RiteLog` half is done: `RiteRecorder.ts` writes every field (items consumed, damage types *dealt*, struck stat stages, party archetypes, debuffs applied) during combat, so all eleven family rites can evaluate true — but with no bid UI nothing ever asks. Spec: `docs/decisions/2026-07-25-capture-system-design.md`.
- **Traits** — `src/systems/Traits.ts` plus a 22-trait library. Slots unlock from `permanentLevel` at 5/10/20/30, `applyStatTraitBonuses` is wired into `calculateStatsForLevel` so a held trait really would change stats, `canSpeciesTakeTrait` gates on `naturalTraitPool` (now authored for all 30), and `resolveInheritedTraitSlots` handles breeding inheritance. **No code path ever writes a non-null `traitId`.** There is no Trait-keeper (the town tile is shuttered), no boss drop, no event reward; `BackpackContents` declares a `kind: 'trait'` slot that nothing ever constructs. Every creature's slots are permanently empty, so the whole system is currently invisible. Acquisition is the only missing piece — and it unblocks the *Essence Distiller* conversion lever, which is authored into three species' pools and equally unreachable. Spec: `docs/decisions/2026-07-26-traits-system-design.md`.

#### Not built at all — zero code

- **Marks system** — **decided 2026-08-27, zero code.** Marks are permanent **discoveries**: do a (possibly hidden) deed during a run and content enters the game for good — a new boon in post-battle offers, a new item in shops, a rare trait in the Trait-keeper's stock, a title, an event or boss rematch. No slot, no Essence, no stat bonus, never lost; the accomplishing Kin and run are recorded. The taxonomy to keep straight: *boons are run-scoped modifiers; consumables answer the run's dangers; traits define what a creature is; marks are the player's recorded accomplishments that unlock content.* Nothing exists in code: no `discoveredMarks` field, the mark-vendor town tile (to become **the Ledger**, a reading place for discovered deeds and clues) is shuttered, and the `kind: 'mark'` backpack slot in `types.ts` is never constructed and should be deleted when this is built — a mark is never carried. **Waits on capture and boss variety.** The earlier equipped-bonus model was retired the same day and survives only in git history; `docs/design/marks-system.md` is the authority.
- **Onboarding tutorial** (old-man flow in `docs/design/onboarding.md`) — no code, no data.
- **The rest of `docs/archive/pitches/expedition-items-pitch.md`.** Slice 1 (departure commitment + the nine consumables) shipped, then the post-battle reward offer and timed boons (see "What's Built" above). That second shipment is also where the pitch's **Preparations** landed — reshaped during design into the auto-applying timed boons rather than built as originally pitched: no backpack slot, no charges, no pre-battle arming step. That reshaping is deliberate: boons are the only run-scoped modifier layer, and `ActiveBoon.battlesLeft` permits `null` for a **run-long boon** that lasts the whole descent. The pitch has nothing left pending: **Marks-as-discoveries was adopted on 2026-08-27** (see the Marks bullet above and `docs/design/marks-system.md`, whose reward list is derived from what exists — boons, items, traits, titles, events) and **Heirlooms were cut** the same day — a one-per-party permanent equipable was one equipped build system too many, and their once-per-run effects are better expressed as run-long boons. Spec for what did ship: `docs/decisions/2026-07-29-expedition-commitment-and-consumables-design.md`.
- **Quartermaster vendor** — no town tile. The backpack it would sell against *is* built: `guaranteedSlots` protects the first N slots from wipe loss and `BACKPACK_START_CAPACITY`/`_GUARANTEED` are the placeholders it would raise. Neither capacity nor guaranteed count is purchasable, and the Obols→Essence conversion-rate upgrades are likewise unimplemented — `convertObolsToEssence` applies the flat base rate with no trait, upgrade or depth bonus.

#### Content gaps

- Remaining ~41 abilities from `docs/design/Abilities.csv` (31 of 72 in code)
- Remaining creatures (30 of 134) and tower bands 3–10 (floors 21–100)
- **`resistances`/`weaknesses` are authored on all 30** (one of each, 2026-08-02) — the type chart is no longer flat, `RESISTANCE_MULTIPLIER` applies, and auto-combat's knowledge fog withholds real information on first encounter. `docs/dev/battle-chamber.md` names known-weakness exploitation as the first live Tempo generation source, and it can now fire. What remains thin is coverage, below.
- **The wards — damage types renamed, in docs and code (2026-08-02).** The six `DamageType` values are now a folk-remedy vocabulary, plus four new ones: **Iron** (was `Fighting`), **Bell** (`Electric`), **Breath** (`Wind`), **Ash** (`Fire`), **Salt** (`Ice`), **Mirror** (`Ghost`), and new **Bane** (Dragon), **Rust** (Mecha), **Honey** (Food), **Thorn** (Flora). Rock and Slimes have no signature ward and draw from the generalists. Renamed throughout `src/` — `types.ts`, all 31 abilities, the resistance traits (`resist_ash`, `resist_iron`, …) and every test. `SAVE_VERSION` went 8 → 9. Vocabulary and rationale: `docs/design/combat-system.md` → *The Wards*.
  - **All ten wards are dealable (2026-08-02).** `abilities.ts` is now **45**, up from 31: fourteen new moves for Bane/Rust/Honey/Thorn, plus sixteen existing moves renamed so display names read as wards (`Ember` → `Ashfall`, `Frost` → `Rime`, `Spark` → `Toll`). **Ability ids were left unchanged** — opaque handles referenced ~86 times in tests, fixtures and LinkArts recipes, never shown to the player, so `id: 'ember'` carries `name: 'Ashfall'`. Do not "fix" this mismatch without a reason.
  - **Archetype signature abilities were reassigned to match the GDD table.** Moving Dragon off `ember` and Mecha off `crackle` would have left **Ash and Bell with zero dealers**, so the swap had to cover all ten wards at once: Food→Honey, Flora→Thorn, Mecha→Rust, Dragon→Bane, **Devils→Ash** (fixing a documented mismatch — they dealt Mirror), **Human→Bell** on its two Mages, and one Spirit moved to Breath. Every ward now has ≥1 dealer. **Breath is thinnest at 1 dealer against 3 weaknesses.**
  - **`resistances`/`weaknesses` imported from the master sheet for all 30** (2026-08-02). One resistance and one weakness each. Iron is the standout: **8 weaknesses, 0 resistances** — and since Basic Attack is Iron, free, and always available, no party can ever be walled. Protect that property. Ash is the taxed ward at 3 moves against 7 resistances. **Bane has zero weaknesses anywhere**, so it is currently Dragon flavour only.
  - ⚠️ **`resistances`/`weaknesses` are snapshot onto the creature instance at creation** (`GameState.createCreatureInstance`, `BreedingSystem.breed`) and combat reads `instance.resistances`, never the template. **Authoring ward data onto a template does nothing for a creature already in a save.** This is why the v9 bump was load-bearing rather than hygiene, and it will bite again on every future type-chart edit — bump the save or start a new game after authoring.
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

> **Essence pivot is implemented (Phases 1–4a merged).** Progression is permanent and essence-driven in the code, not just the docs. Full design: `docs/decisions/2026-07-23-essence-progression-pivot-design.md`.

- **Two-tier currency: Obols → Essence.** Obols are the in-run token earned from fights, spent during the descent on heals/revives/capture/shops. On leaving the tower, **leftover Obols convert to Essence** (leftover-only; conversion rate boostable by traits/upgrades/depth). Essence is the permanent currency, spent on levels/traits/depth-jumps/backpack (never on marks — those are discovered). Essence is the only permanent store of value; Obols never persist. Plasm is removed. **A full wipe loses 50% of leftover Obols; the other 50% still converts** (a deliberate exit/win converts 100%).
- **A wipe costs exactly ONE thing, at random — never the whole inventory.** This is the rule most likely to be got wrong from intuition, in both directions:
  - **Not "you lose everything."** The genre default is that death empties your bags. It does not here. A wipe takes one item from unprotected inventory and nothing else.
  - **Not "captured creatures are safe."** They ride in inventory slots like any other carried thing, so a captured creature in an *unprotected* slot is a candidate for that single random loss. Only the **guaranteed inventory space** protects a capture.
  - **The three creatures you entered the tower with can never be lost**, under any circumstance. That is absolute and separate from inventory entirely.
  - This is what keeps capture a real gamble: catching something deep with no guaranteed space left means carrying it home is a risk you chose.
- Creatures keep a **permanent essence-driven level floor** between runs. Temporary in-run levels vanish at run end (Model A). Do NOT hard-code a level-1 reset.
- **No archetype-level type chart.** Resistances/weaknesses are per-creature. Archetype biases which **ward** a creature *deals*; what it *resists* is authored per creature and is deliberately not inferable from its archetype or appearance — that unguessability is what makes the Monsterpedia a tool rather than a trophy case. **Iron ↔ Rust is the one explicit opposition** in the set and is meant to stay the only one.
- **Stars are staying, and coupling to them is fine** (decided 2026-07-26). Stars are the level ceiling, and via the ceiling they also gate **trait capacity** — slots unlock at permanent levels 5/10/20/30, so a 0★ creature reaches one slot until breeding raises its star. This reverses the old "backup C / do not hard-couple to stars" note. **Why:** stars are what stop players settling on one roster forever — the goal is that they keep breeding and finding new creatures rather than maxing three favourites.
- **Trait slots unlock by `permanentLevel` only** — never by temporary in-run levels — and they unlock **empty**. There is no random trait roll. Traits are found (boss drops, events, puzzles later), bought from the Trait-keeper, or inherited, then imbued. Design: `docs/decisions/2026-07-26-traits-system-design.md`.
- **Breed-readiness is derived, not stored:** `permanentLevel >= levelCap`. Do not reintroduce a stored `isBreedReady` flag set during a run.
- Both parents are **retired** when breeding, but invested essence **carries over** to the offspring as a jump-start. Retired parents **stay in the creature box as tombstones** — do not delete them. Every box consumer filters `!isRetired`, and keeping them is what lets a stale default party name the creature that left instead of saying "a former party member".
- **Breeding requires a minimum level investment, and this is load-bearing.** A creature is breed-ready only on hitting its star's level cap — **5 for a 0★ starter**, higher for higher stars. Stats pass down through generations, so breeding too early founds a weak line and the weakness compounds every generation after. Never relax this gate casually. A **captured creature arrives at level 1**, so it is far from breedable: capture yields a bloodline candidate, not a parent.
- **Longevity is removed.** No run counter, no forced retirement.
- Tower is **one continuous descent** — no zones. The full game is **100 floors in 10 bands of 10**; **alpha caps it at 20** (`TOWER_FLOORS`), the deepest the current roster reaches. Raising the cap is a one-constant change — descent generation, the Gatekeeper's grant loop, the results ledger and the tests all derive from it. Mini-boss every 5 floors, major every 10. Depth-jumps buyable at cleared 5-floor breaks (buy 5 → start 6).
- **A creature's `towerIds` are the only statement of where it appears.** Encounter pools derive from them; never hand-maintain a parallel pool list, and never read meaning into a pool's ordering — `pool[0]` is not "the strongest".
- First floor (and any post-jump floor) is **combat**. Rests are **occasional random filler** — never guaranteed before a boss.
- Enemies pick a **random** living target (spread damage); single-target attacks **auto-target** when one enemy remains.
- Crits are authored `critCondition`s (no random roll) and apply to both sides.
- Buff/debuff stages cap at **±3**.

## Roadmap / Next Steps

**Done:** essence pivot Phases 1–4a (currency, permanent levels, the continuous descent, Leveler + Gatekeeper vendors, breeding carry-over) + playtest tuning, then the alpha roster swap (30 authored creatures, 11 archetypes, derived pools, 20-floor cap), then expedition slice 1 (boss-gated departure, Waystone/Smoke Husk, the nine-item pool, the usable bag).

**Next, in rough priority:**
1. **Capture — wire the built engine into combat.** Spec: `docs/decisions/2026-07-25-capture-system-design.md`. `Capture.ts` and the backpack's creature-cargo handling are done and tested; `RiteRecorder.ts` already populates every `RiteLog` field during combat; what remains is a capture action on the combat turn and a bidding UI. Note the spec cites a *capture-mechanics-research* survey which is **not in the repo** — treat the spec as self-contained.

   Two rules from elsewhere in this file that constrain it: a capture **arrives at level 1** and is cargo, not a reinforcement — it cannot be fielded during the run that caught it; and it is **eligible for the single random wipe loss** unless it occupies guaranteed inventory space.

   **Capture is what re-opens breeding — this is the strongest reason it is first.** The box has exactly three write paths: new game (the starter trio), breeding, and `unloadCapturesToBox`. The third is dead code until capture is wired, and breeding is **net −1** (two parents retire, one offspring is born), so today the box can only ever shrink.

   That used to be a **save-bricking soft-lock**, reachable in the first hour on the intended path (`docs/design/economy-balancing.md` targets a first breed by run 3–4): three starters → breed once → two living creatures → `PartySelectScene`'s `selected.length === PARTY_SIZE` gate never satisfies → the tower is unenterable → nothing can be earned → only NEW GAME recovers it.

   **Guarded 2026-07-31.** `breedingAvailability()` in `BreedingSystem.ts` blocks a breed that would drop the box below `MIN_LIVING_TO_BREED` (`PARTY_SIZE + 1`), counting non-retired creatures only. Enforced at the Hatchery tile *and* in `performBreed`. The town tile now distinguishes **CLOSED** (recoverable state, shows the reason) from **SHUTTERED** (not in this build) via `Place.blockedReason`.

   **The consequence to understand:** since nothing else grants creatures, breeding is now *entirely unreachable on a fresh save*. The guard trades a dead save for a temporarily dead vendor — it is a stopgap, not a fix, and capture is what actually restores breeding. Keep the guard afterwards anyway; breeding into an unfieldable party is never a move anyone means to make.

   **Two decisions already made (2026-07-31), so they do not get relitigated:**
   - **Bosses are not capturable.** Every alpha species currently carries a real `captureBasePrice` in bands 1 and 2 and nothing is zero-priced, so the capture action must gate on `encounter.type === 'boss'` — authoring `0` prices is not enough, since boss encounters draw from the ordinary wild pool.
   - **Enemies act after a failed bid.** A bid is not a free action. This is what gives `CAPTURE_ENRAGE_AFTER` its teeth: probing the price costs turns as well as risking enrage. Contrast the Smoke Husk, which is deliberately free.

   **Both former blockers are resolved (2026-07-31):**
   - **`ally_knocked_out` is now `enemy_party_lost_member`.** The behaviour was always "a creature on the *capturing* party is down" — `CaptureParty` is the player's side — and the old name said the opposite. Renamed rather than reimplemented: the alternative reading ("one of its own kin fell") is nearly free in any multi-enemy fight, whereas losing a party member is a real cost, and a family rite should be a puzzle. Spirits' rite now reads correctly.
   - **The price is shown; the *rite* is the secret.** `reactionFor` returning a word and never a number is about the **rejection feedback**, not about hiding the price. `capturePrice` already reflects satisfied rites, so the UI displays it live and the player watches it drop when a rite latches — that drop is the discovery moment, and it teaches "something I did made this cheaper" without naming what. What stays hidden is which rite. Do not build a price-guessing minigame: with enrage at three rejections and enemies acting after each, probing for the number would be unplayable.

   **`PartySelectScene` is fixed (2026-07-31)** and no longer blocks a growing box: paging is resolved through `ui/paging.ts` (unit-tested, clamps in both directions), the page arrows are pointer-reachable as well as PGUP/PGDN, CONFIRM/BACK no longer overlap, and long names truncate inside their cards. Verified in-browser at 15 creatures.
2. **Trait acquisition — the engine is already built.** Spec: `docs/decisions/2026-07-26-traits-system-design.md`. Slots, level-gated unlocking, pool gating and breeding inheritance all work. **Two pieces are missing, not one:**

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
