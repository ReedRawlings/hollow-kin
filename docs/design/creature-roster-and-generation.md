# **Hollow Kin — Creature Roster & Generation**

> **Owns:** roster targets and distribution, the species template and creature instance data objects, the role axis, stat generation, capture pricing, the generation pipeline, starters, breed-only creatures.
> **Defers to the GDD on:** currency, progression model, and what persists across runs. Star/level-cap rules live in `breeding-and-inheritance.md`; trait acquisition in `traits-system.md`; floor layout in `tower-structure.md`.
> **Last verified:** 2026-07-28 — roster, starters, rites and capture pricing re-checked against `src/data/creatures.ts`.

---

## **Overview**

Hollow Kin's full-game roster is **134 creatures across 11 archetypes**. The roster lives in the master spreadsheet (`Hollow Kins`, sheet `Kin`), which is the single source of truth. Attribute definitions — roles, archetypes, tower bands, capture price ranges — live on the `Roles & Archetypes` sheet of the same workbook.

Creatures are **not hand-authored individually**. Identity is authored per creature; stats and abilities are generated from that identity. This document covers how the roster is structured, what is authored versus generated, and how the pipeline works.

**Alpha scope is Tower ID 1,2 — 30 creatures.** This replaces the previous 36-creature alpha roster in `src/data/creatures.ts` entirely. The old roster is superseded, not extended.

---

## **Roster Structure**

### **Archetypes**

Eleven archetypes. Distribution is intentionally uneven — archetype size is a content decision, not a balance lever. No archetype is inherently rarer than another; rarity exists at the individual creature level.

| Archetype | Count | Notes |
| ----- | ----- | ----- |
| Dragon | 15 | |
| Fauna | 15 | |
| Flora | 15 | |
| Human | 14 | |
| Kami | 13 | |
| Devils | 12 | |
| Mecha | 12 | |
| Spirits | 12 | |
| Rock | 11 | Authored as "Golem" on the Kin sheet; `Rock` is canonical |
| Food | 10 | |
| Slimes | 5 | Smallest archetype — expand or accept as a deliberate rarity |

Archetype determines **ward identity, trait pool, and ability set**. It does not determine stats.

> ⚠️ **Corrected 2026-08-02.** This line previously claimed archetype determines resistances
> and weaknesses. It does not, and never did — that contradicted both the GDD and
> `combat-system.md`, and the code has always read `resistances`/`weaknesses` off the
> individual creature. Archetype biases which **ward** a creature *deals* (via its default
> abilities); what it *resists* is authored per creature and is deliberately not inferable
> from appearance. The ward vocabulary and per-archetype signatures live in
> `combat-system.md` → *The Wards*.

### **Roles**

Nine roles. Role is a separate axis from archetype and it is what **stats are generated from**.

| Role | Base profile | Modifier |
| ----- | ----- | ----- |
| Tank | Tank | — |
| Tank Buff | Tank | Buff |
| Tank Debuff | Tank | Debuff |
| Mage | Mage | — |
| Mage Buff | Mage | Buff |
| Mage Debuff | Mage | Debuff |
| Healer Buff | Healer | Buff |
| Healer Debuff | Healer | Debuff |
| Fighter | Fighter | — |

The nine roles decompose into **four stat profiles** (Tank, Mage, Healer, Fighter) and a **modifier** (none / Buff / Debuff). The base profile drives the stat distribution. The modifier drives the creature's second ability — a Mage and a Mage Debuff share a stat shape and differ in what they do with it.

There is no plain `Healer` role and no Buff/Debuff variant of Fighter. Both are deliberate.

### **Tower Bands**

The full game is a **100-floor descent in 10 bands of 10 floors**. A creature's `Tower ID` is a list of the bands it can be encountered in.

| Tower ID | Floors | Capture price range |
| ----- | ----- | ----- |
| 1 | 1–10 | 20–40 |
| 2 | 11–20 | 41–60 |
| 3 | 21–30 | 61–80 |
| 4 | 31–40 | 81–100 |
| 5 | 41–50 | 101–120 |
| 6 | 51–60 | 121–140 |
| 7 | 61–70 | 141–160 |
| 8 | 71–80 | 161–180 |
| 9 | 81–90 | 181–200 |
| 10 | 91–100 | 201–220 |

A creature with `Tower ID = 1,2` appears anywhere on floors 1–20.

> The sheet lists band 10 as `200-220`, overlapping band 9's ceiling by one. Treated as `201-220` here.

The tower has no hard zone walls — enemy pools and visual identity shift by band as the player descends. Alpha ships bands 1 and 2 only; the remaining eight bands are full-game scope.

---

## **Alpha Roster — Tower ID 1,2**

Thirty creatures, two to three per archetype across all eleven.

| Archetype | Creatures |
| ----- | ----- |
| Devils | Bound Book, Squishims |
| Dragon | Wiggledrake, Vinewyrm, Eggnition |
| Fauna | Cat, Egg, Girafficorn |
| Flora | Weeping Willow, Turnimp |
| Food | Cherry Punch, Butterfly, Tofu Slime |
| Human | Fleschat, Trumpet Ted, BellyFul |
| Kami | Garbage Gary, Pencilvester, Geta |
| Mecha | Bomb Beetle, Routergeist, Glitch Goblin |
| Rock | Golem Grimace, Pebble Fairy, Rubble |
| Slimes | Triple Stack, Teddy |
| Spirits | Hunger, Grampskin, Little Light |

Role spread: 9 Mage, 7 Fighter, 4 Tank, 3 Mage Debuff, 3 Healer Debuff, 2 Mage Buff, 2 Healer Buff.

### **Availability**

* **Wild-catchable** — the majority, available within their Tower ID bands
* **Boss-exclusive** — unique, uncapturable during runs, breedable after defeat. Homed on mini-bosses (every 5 floors) and major bosses (every 10)
* **Breed-only** — obtainable only by breeding specific combinations

---

## **Authored vs Generated**

This split is the core of the system. Get it wrong and the spreadsheet stops being useful.

### **Authored per creature — nothing derives these**

| Field | Why it must be authored |
| ----- | ----- |
| `id`, `name` | Identity |
| `archetype` | Content decision |
| `role` | Content decision |
| `towerIds` | Encounter placement |
| `resistances` | Which **wards** this kin shrugs off. Permanent — breeding never changes it |
| `weaknesses` | Which **wards** it cannot abide. This is the one thing a player can never breed away from, and it is deliberately not inferable from the creature's appearance or archetype |
| `naturalTraitPool` | Curated compatibility list, not a roll table |
| `rites` | The capture puzzle. Universal per creature — the same rite applies at every depth |
| `availability` | wild / boss / breed_only |
| `signature` | One line: what this creature is uniquely best at. If it can't be filled, the creature is filler |

### **Generated — do not hand-author these**

| Field | Derived from |
| ----- | ----- |
| `baseStats` (all seven) | tier budget × role weights |
| `defaultAbilities[0]` | archetype + tier |
| `defaultAbilities[1]` | role modifier (Buff / Debuff / none) |
| `captureBasePrice` | one value per tower band, drawn from that band's range |

---

## **The Creature Data Object**

```
{
  id: "kin_070",
  name: "Cat",
  archetype: "Fauna",
  role: "Fighter",
  towerIds: [1, 2],            // bands this creature appears in
  baseStats: { hp, mp, str, def, wis, spd, int },   // generated
  naturalLevelCap: 5,          // wild-caught cap before earning stars
  defaultAbilities: [...],     // generated
  naturalTraitPool: [...],     // authored
  resistances: [...],          // authored
  weaknesses: [...],           // authored
  rites: [...],                // authored
  captureBasePrice: { 1: 32, 2: 47 },   // generated, one per band in towerIds
  availability: "wild",
  spriteId: "cat"
}
```

This is the **species template** — static data. It is distinct from a **creature instance**, which is what a player owns. See the Creature Instance Object section below.

> **Three fields above are design-ahead-of-code.** `naturalLevelCap`, `availability` and `spriteId` do not exist on `CreatureTemplate` in `src/types.ts`. Level caps currently come from `STAR_LEVEL_CAPS`, every alpha creature is wild so nothing yet reads `availability`, and there are no sprites. They are kept here as the intended shape, not as a description of what ships — the rest of the object is accurate.

---

## **The Creature Instance Object**

```
{
  instanceId: "uuid",
  speciesId: "kin_070",
  nickname: null,
  starRating: 0,
  permanentLevel: 1,          // essence-driven floor; run leveling stacks temporarily
  currentLevel: 1,
  essenceInvested: 0,
  statBaseline: { ... },      // instance-specific; survives run resets and recalculation
  currentStats: { ... },      // statBaseline + level scaling + trait bonuses
  traitSlots: [ {traitId, traitLevel, unlocked} x4 ],
  abilities: [a, b, null, null],
  lineage: { parentA: null, parentB: null },
  resistances: [...],         // copied from template, permanent
  weaknesses: [...],          // copied from template, permanent
  isRetired: false
}
```

---

## **Stat Generation**

### **The formula**

```
base_stat = round(tier_budget[tier] × role_weight[base_profile][stat]) + nudge
```

Two lookup tables carry all numeric balance:

* **Tier budget** — total stat points a creature at each tower band receives
* **Role weights** — how those points split across the seven stats, per base profile

`nudge` is an optional per-creature offset, defaulting to zero. It exists so a handful of creatures can break their pattern deliberately. Without it, every tier-2 Fighter is the same creature with a different name. Use it sparingly — if most rows carry a nudge, the role weights are wrong.

### **Stat scaling per level**

```
current_stat = base_stat + ((max_stat - base_stat) × (current_level / level_cap))
```

`max_stat` derives from the species template modified by star rating.

> **Unresolved:** no `max_stat` field exists in the template spec or in code. This formula currently references data that was never defined.

### **Bred stat inheritance**

```
offspring_base_stat = max(species_base_stat, (parentA_scaled + parentB_scaled) / 6)
```

The inherited term is **species-agnostic** — it does not care what the offspring is. Once parents are levelled, the inherited term dominates and the species floor stops mattering.

This is the mechanism that makes every creature viable long-term. A weak early-tower creature bred from strong parents converges on the same stats as anything else. It is also why the species base must be a **stable authored number** rather than rolled at spawn: if the floor moves, the punishment for breeding too early stops being legible.

**What breeding cannot fix:** resistances and weaknesses are copied from the template and never change. Ward vulnerability is the one permanent difference between creatures. Keep the distribution balanced — a ward that is a weakness on many creatures and a resistance on few is a tax no amount of breeding removes. With ten wards and only thirty creatures, the thin ones will skew easily; check the spread before committing the columns.

---

## **Capture Pricing**

**This replaces the previous fixed per-species base price.**

Price depends on **the band the player is currently standing in**. The same creature costs more when met deeper.

Each species gets **one price per band it can be encountered in**, drawn from that band's range at generation time and then fixed. A creature with `towerIds: [1, 2]` gets two values — one from 20–40, one from 41–60:

```
captureBasePrice: { 1: 32, 2: 47 }
```

At runtime, look up the band of the current floor and read the value. No calculation at encounter time.

Existing modifiers still apply on top: the HP nudge, and the rite band multiplier.

> **Naming collision, partly resolved.** The code's `CAPTURE_BAND_MULTIPLIER` still uses "band" to mean *rite tier* (signature / family / unsatisfied), which is a different thing from a tower band. `capturePrice` now names its parameters `towerBand` and `riteBand` so the two cannot be confused at a call site, but the constant itself is unrenamed.

### **Rites**

Rites are **universal per creature** — the same conditions apply on floor 3 and floor 93. Depth changes the price, never the puzzle.

A base price of exactly `0` means the species cannot be taken in the wild.

**Family rites are authored for all eleven archetypes** and every creature carries its archetype's. Signature rites are still unwritten for every species.

> **Authored but not yet evaluable.** Seven of the eleven family rites read `RiteLog` fields — items consumed, damage types *dealt*, a struck enemy's stat stages, party composition, debuffs applied — that combat does not populate, because capture is not wired into `CombatScene` yet. Those rites read false rather than throwing, so the creature sits at full freight. Populating the log is the capture-wiring task's job; the condition vocabulary and evaluator already exist.

---

## **Trait Pools**

Each species has a `naturalTraitPool` — a curated subset of the trait library, **authored per species**.

**This is a compatibility rule, not a roll table.** Traits are never randomly assigned. The pool defines which traits a species *can be imbued with* at the Trait-keeper; a creature cannot take a trait outside its pool. A strong trait you cannot use on the creature you wanted is a real and intended outcome — it makes trait loot a light puzzle rather than a pure upgrade.

Pools are curated to feel appropriate for the species. No species has access to the entire library.

Inherited traits come through breeding and **bypass the pool entirely** — `resolveInheritedTraitSlots` does not check it. That is deliberate: breeding is the escape valve for a narrow pool. See `breeding-and-inheritance.md`.

---

## **The Generation Pipeline**

**Step 1 — Master spreadsheet.** All identity authored in `Hollow Kins`. Stat and ability columns are formulas reading the tier-budget and role-weight tables. The spreadsheet is the single source of truth for numeric balance.

**Step 2 — Export** as JSON.

**Step 3 — Importer script.** A Node script reads the JSON and produces species templates.

**Step 4 — Runtime instantiation.** Spawning an enemy, hatching an offspring, or initialising a starter loads the template and creates an instance from it.

### **Rebalancing workflow**

Edit the tier-budget or role-weight table → export → run the importer. All species update. No individual creature files are touched. Instances in player saves recalculate from the updated templates on next load, except `statBaseline`, which is instance-specific by design and survives.

---

## **Starting Creatures**

**Alpha ships one fixed hand, with no choice.** All three start at Star 0 with no traits and default abilities only (marks are player-level discoveries, not creature fields).

| Creature | Archetype | Role | Abilities |
| ----- | ----- | ----- | ----- |
| Cat (`kin_070`) | Fauna | Fighter | `jab`, `bold` |
| Geta (`kin_092`) | Kami | Tank | `frost`, `harden` |
| Wiggledrake (`kin_123`) | Dragon | Mage | `ember`, `focus` |

One of each stat shape, across three archetypes and three damage types, so a first descent meets the whole grammar of combat. **The trio has no healer** — `soothe` is the only ally-target heal and no starter carries it, so early runs lean on shop and rest recovery. That is a deliberate difficulty choice, not an oversight; revisit it if first runs feel punishing rather than tense.

Starters are fixed across all sessions so the early game is consistent and experienced players can give reliable advice. The first few runs are naturally tutorial-paced since no traits are active yet.

> The two-hand picker (an aggressive trio versus a resilient one) is deferred, not cut — the code still exports the hand as `STARTER_TRIO_A` so a second can return without a rename.

---

## **Breed-Only Creatures**

Cannot be found in the wild or captured. Discovered exclusively through breeding.

* Triggered by breeding two specific species — the combination matters, not just the archetypes
* The player is not told which combinations work; discovery is organic
* Once discovered, the recipe is recorded in the bestiary
* All standard breeding rules apply; only the offspring species differs
* Once bred, the creature can appear in the wild with a low chance of being a variant

> Breed-only creatures and variants do not exist in code. Variants have no design behind them beyond the line above.

---

## **Open Questions**

* `max_stat` is referenced by the level-scaling formula but defined nowhere.
* How many creatures per band should be in the encounter pool at once?
* Slimes has 5 creatures against Dragon's 15. Deliberate rarity, or a gap to fill?
* Row 26 of the Kin sheet is a Flora with no name.
* `Stone Plant` (id 62, Rock) is still authored as role `Healer`, which is not a valid role.
