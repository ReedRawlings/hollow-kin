# **Hollow Kin — Combat System**

*Working Document — Subject to Change*

> **Owns:** the turn timeline and action slots, enemy intents, the root command set, damage formula, **the damage types (the wards)**, accuracy, conditional criticals, **Pack Tempo and Relay**, buffs & debuffs, status effects, MP, knockout, items and boons in battle, the knowledge fog, auto-combat tactics, enemy AI.
> **Defers to the GDD on:** currency, progression model, capture rules, and what persists across runs. Encounter placement and boss cadence live in `tower-structure.md`. Battle Chamber-only experiments are described here only far enough to say they are not production; their contract is `../dev/battle-chamber.md`.
> **Last verified:** 2026-08-27 — every section re-checked against `src/systems/CombatEngine.ts`, `src/systems/combat/Battle.ts`, `src/systems/TurnTimeline.ts`, `src/systems/PackTempo.ts`, `src/systems/LinkArts.ts`, `src/systems/TacticsAI.ts`, `src/systems/BattleChamber.ts`, `src/data/abilities.ts` and `src/scenes/CombatScene.ts`.
> **Reconciled 2026-08-27:** `combat-architecture-spec.md` (now `../archive/research/combat-architecture-spec.md`) claimed to govern combat "until reconciled into combat-system.md". That reconciliation is this revision. **This file is the single live combat doc.** Everything the spec proposed that shipped is folded in below; everything it proposed that did not ship is listed under *Not built* or *Superseded decisions*. Where the spec and the code disagreed, **the code won**, and each such case is called out inline.
>
> **Decided 2026-08-27 (owner review):** four questions this doc had carried as open are now resolved — buff/debuff stages keep their whole-battle, stacking, ±3-capped behavior deliberately for alpha (*Buff and Debuff System*); enemies crit under the same conditional rules as players (*Critical Hits*); enemy count is 1–3 in tower bands 1–2 and widens to up to 5 from band 3 onward, mid-implementation (*Enemy Encounters*); Pack Tempo keeps its single generation source until Relay itself is validated by playtest (*Pack Tempo and Relay*). None of these remain in *Open Questions*.

---

> ## **How to read this document**
>
> This started as a V1 spec, drifted into being read as a description of the shipped game,
> and then had a second spec layered over it. It is now meant to be a report on the code,
> and **every section carries a status tag** so no claim here can be mistaken for a plan.
>
> | Tag | Meaning |
> | ----- | ----- |
> | **BUILT** | Matches the code today. Safe to rely on. |
> | **PARTLY BUILT** | Some of it is live. The delta is spelled out explicitly — read it before assuming. |
> | **CHAMBER ONLY** | Exists in `src/`, but only the Battle Chamber (`/?test=1&screen=chamber`) can switch it on. Expedition combat never sees it. |
> | **NOT BUILT** | Designed or proposed, zero code. |
>
> The rule this document is meant to enforce: **if you are about to write code against a
> claim in here, check its tag first.** Several claims in earlier revisions turned out to be
> inverted from what the code did, not merely incomplete.

---

## **Overview**

Combat in Hollow Kin is turn-based and active by default. The player controls a party of three creatures against enemy encounters in the tower. Combat is the moment-to-moment gameplay loop that everything else — breeding, traits, marks, boons — exists to support. The system must be deep enough to reward investment in creature builds while simple enough to auto-battle through low-difficulty floors.

The shape the combat rewrite settled on, and which is live in expedition combat today:

- a round is a **timeline of action slots**, not a list of creatures;
- **enemy moves and targets are committed at round start and shown on the enemy tiles**, so the player plans against known intents;
- **Pack Tempo** is the one party-wide resource, earned by exploiting weaknesses and spent on **Relay** to pull an unused ally's action forward;
- **criticals are authored conditions**, never a random roll;
- encounter-specific rules (Omen, Break, Weave, Link Arts) are optional modules layered on top — and, apart from the Chamber's Link Arts prototype, none of them exist yet.

The combat rules live in `src/systems/combat/Battle.ts`, which is Phaser-free; `CombatScene.ts` supplies timing, menus, drawing and navigation. `Battle.snapshot()` exposes the same facts the screen shows as a text state, which is what the browser playtest harness reads.

---

## **Turn Timeline**

> **BUILT.** Action slots, per-round SPD recalculation and knockout exclusion are live. Random tiebreaks, Haste and Initiative-trait modifiers are not. The `boss_extra` slot source is engine-complete but **CHAMBER ONLY** in practice.

* At the start of each round `buildTurnSlots` (`TurnTimeline.ts`) sorts every living combatant by **effective SPD**, highest first, and gives each one a `standard` slot. Order is **recalculated every round**, so SPD stages reorder turns — **BUILT**
* **Slots, not creatures, are the timeline identity.** Every slot carries a unique `slotId` (`r{round}:standard:{instanceId}:{index}`). Enemy intents, Tempo generation and Relay all key on the slot id, which is what lets the same actor legally appear twice in one round — **BUILT**
* Knocked-out combatants are excluded when the round is built; a creature knocked out mid-round has its remaining slot skipped when it comes up — **BUILT**
* A creature that is frozen, stunned or asleep when its slot arrives **spends the slot** doing nothing (its statuses tick, the turn ends) — **BUILT**
* **`boss_extra`** — a second, separately identified slot for one enemy, inserted around the middle of the order rather than adjacent to its standard slot so the two beats are spaced apart. The engine and the intent system both support it, but the only thing that ever requests one is the Battle Chamber's `bossDoubleAction` preset (TWIN THREAT). **Production bosses get exactly one slot per round** — **CHAMBER ONLY**
* **Player action conservation:** each Kin receives exactly one standard slot per round. Relay *moves* a slot; nothing *adds* one. The allied extra-action slot that was prototyped alongside Relay (`relic_extra`, "Encore") was removed on 2026-08-27 — see *Superseded decisions* — **BUILT**
* Ties are broken randomly — **NOT BUILT.** The sort is a plain numeric comparator, so ties resolve deterministically by array position (player party first, then enemies). Whether this needs fixing is genuinely open — deterministic ties may be preferable to random ones.
* Haste buffs and Initiative traits modify effective SPD without changing the base stat — **NOT BUILT.** There is no `haste` stat (`StatName` is hp/mp/str/def/wis/spd/int) and the `initiative_boost` trait exists in the library but nothing reads it.

---

## **Enemy Intents**

> **BUILT.** Every enemy action for the round is chosen when the round is built and shown before the player acts.

* `commitEnemyIntents` runs immediately after the timeline is built. For every enemy slot it calls `getEnemyAction` (the `enemy_default` tactic, with **no** knowledge of the party's resistances) and stores the resulting `{ ability, target }` against the **slot id** — **BUILT**
* Intents are drawn on the enemy tiles as `ABILITY → TARGET` (`ALL KIN` for area moves). When one enemy owns two slots the tiles number them `1:` / `2:` — **BUILT**
* **Intents are locked for the round.** Nothing re-plans them: a debuff, a knockout on the enemy side, or a Relay does not change what an enemy will do. *(The spec allowed "a clearly described move or encounter rule" to change a committed intent. No such move exists; the code has no path for it.)*
* **Fizzle on a downed target — BUILT.** If a single-target intent's target is already knocked out when the enemy's slot arrives, the move **fizzles**: the turn is spent, the log says so, and **no MP is deducted**. Area moves never fizzle — they resolve against whoever is still standing. This is the deliberate cost of committing intents early: the player can make an enemy waste its turn by changing who is standing where the intent points.
* MP is deducted **when the intent resolves**, not when it is committed — **BUILT**
* A `boss_extra` slot tries not to repeat the standard slot's ability: if the boss has another affordable move it commits that one instead — **BUILT** (only reachable in the Chamber, see above)
* If a slot somehow has no committed intent the enemy passes with a log line rather than crashing — **BUILT**

---

## **Actions Per Turn**

> **BUILT.** The player's root menu is `FIGHT / MAGIC / ITEM / RELAY`. Capture is designed but unreachable.

Each creature takes one action in its slot:

* **Basic Attack** — free fallback, always available, 0 MP — **BUILT.** This is the `FIGHT` root option, backed by the `basic_attack` ability (Power 20, Accuracy 100, **Iron**). It is deliberately excluded from the `MAGIC` submenu so it never appears twice. Because it is Iron, free and always available, no party can ever be walled — protect that property.
* **Ability** — select from up to four equipped abilities, costs MP — **BUILT** (`MAGIC`). Each row shows MP cost, Power, `· KEEN` where the move carries the tag, and `· +TEMPO` when the current target's weakness is **known** (see *Knowledge fog*).
* **Item** — use one thing from the shared backpack — **BUILT** (`ITEM`). Item behaviour is data-driven via `usableIn`/`targeting`; see `../archive/pitches/expedition-items-pitch.md` and `systems/Items.ts`.
* **Relay** — spend all three Pack Tempo to move an unused ally's slot directly after the current one — **BUILT** (`RELAY`). Disabled until Tempo reaches three *and* a legal candidate exists. Relay is queued alongside a normal action, not instead of one; see *Pack Tempo and Relay*.
* **Capture** — spend the turn attempting a capture — **NOT BUILT.** `systems/Capture.ts` is complete and tested but is imported by nothing except its own test; there is no capture action on the combat turn, and the `RiteLog` fields are populated by `RiteRecorder` only for the deeds the rewrite happened to touch. See the capture entry in `CLAUDE.md` and `../decisions/2026-07-25-capture-system-design.md`.

In the Battle Chamber's shared-AP economy the first two labels read `BASIC · 0 AP / MOVES · AP` instead. Same commands, different currency — **CHAMBER ONLY**.

There is **no swap action.** A captured creature is cargo, not a reinforcement — it arrives at level 1 and cannot be fielded during the run that caught it. The party is the three creatures the player entered with, for the whole descent.

---

## **Damage Formula**

> **BUILT** — the formula matches exactly, and **the type multiplier is live**: all 30 creatures carry one authored resistance and one weakness.

```
damage = max(1, (STR or INT) − (DEF or WIS) / 2) × (Power / 50) × TypeMultiplier
```

Key points:

* Physical abilities scale off STR vs DEF, special abilities scale off INT vs WIS — **BUILT**
* Defense doesn't fully cancel attack — it's halved before subtraction, and the result is floored at 1, so there's always minimum damage — **BUILT**
* Skills have a built-in Power value. **The `/ 50` divisor is load-bearing** — Power is expressed on a ~50-is-average scale, so dropping it multiplies all damage by fifty — **BUILT**
* The deterministic core lives in `baseDamage`, shared by `calculateDamage` (which layers the accuracy roll and the critical condition on top) and the AI's `estimateDamage` (which layers accuracy only, and can be told to ignore the type multiplier — that is how the knowledge fog is enforced) — **BUILT**
* After the engine result, `Battle.resolveAbility` applies the **boon multipliers** — `damage_dealt` when the attacker is player-owned, `damage_taken` when the target is player-owned — and, in the Chamber only, a completed Link Art's finisher multiplier. The product is rounded and floored at 1 — **BUILT**
* Some skills deal fixed damage or scale off MP/level rather than STR/INT — **NOT BUILT.** No ability in `abilities.ts` does this. Items do have a fixed-damage path (`applyPercentDamage`), deliberately bypassing DEF and the type chart — that is what earns a fixed-damage item a backpack slot when the party's abilities are being resisted.

### **The Wards — damage types** — **BUILT** *(decided and renamed in code 2026-08-02)*

The type chart in Hollow Kin is not physics — it is folk remedy. Every damage type is named
for a thing people have carried against the dark, and that framing is load-bearing: it is
*why* resistances are per-creature and hidden. There is no rule that fire beats ghosts.
There is only the specific knowledge that this specific kin cannot abide iron, and someone
had to find that out first.

Ten wards. The first six are renames of the original `DamageType` values; the last four were added with them.

| Ward | What it is | Archetype signature | Old identifier |
| ----- | ----- | ----- | ----- |
| **Iron** | Physical force. Horseshoes over the door, nails in the lintel, a blade in the cradle so nothing swaps the child | Fauna, Human, Rock | `Fighting` |
| **Bell** | Shock and concussion — pressure that arrives all at once and clears the air. *Bell, book and candle* | Kami, Human | `Electric` |
| **Breath** | Wind and air. *Anima*, *pneuma*, *ruach*, *ki* — the soul built from the word for breath. A **hollow** kin is one the breath has left | Kami, Spirits | `Wind` |
| **Ash** | Fire and burning. Scattered on thresholds overnight to read the prints of what walked through | Devils | `Fire` |
| **Salt** | Cold, preservation, stillness. It does not burn a thing, it stops it | Kami | `Ice` |
| **Mirror** | Spectral. Covered in a house with a body in it, so the soul does not catch on the way out | Spirits | `Ghost` |
| **Bane** | Venom and rot in the blood. Wolfsbane, henbane, dragonsbane — the suffix names a plant by what it kills. The only ward that waits | Dragon | *new* |
| **Rust** | Corrosion and entropy. Iron wants to go back to being ore; the made thing carries the terms of its own coming-apart | Mecha | *new* |
| **Honey** | Sticky, slowing, cloying. What you leave out for whatever keeps the house. Tears nothing — things adhere and thicken until they cannot move | Food | *new* |
| **Thorn** | Piercing and entangling. Laid over fresh graves to keep what is in them from walking. Never one wound; forty small ones, and then it holds on | Flora | *new* |

**Iron ↔ Rust is the one explicit opposition in the set** — the only relationship a player can
reason about on sight, and deliberately the only one. There is still no global type chart.

**Rock and Slimes have no signature ward** and draw from the generalists. Rock's candidates
(Chalk, Lodestone) were considered and dropped on 2026-08-02; if it needs its own identity
later, that is where to look.

> **All ten wards are dealable.** `abilities.ts` holds **45** moves: fourteen added for Bane,
> Rust, Honey and Thorn, and sixteen older moves renamed so their display names read as wards
> rather than elements (`Ember` → `Ashfall`, `Frost` → `Rime`, `Spark` → `Toll`). **Ability ids
> were deliberately left alone** — they are opaque handles referenced ~86 times across tests,
> fixtures and Link Art recipes, and the player never sees them, so `id: 'ember'` carries
> `name: 'Ashfall'`. Do not "fix" this mismatch without a reason.
>
> Every ward needs a low-tier move in **both** categories, or an archetype carrying it cannot
> serve both STR and INT roles. Salt already worked this way (`frost` Physical 35 / `chill`
> Special 40); `combfall` and `thicket` were added to give Honey and Thorn the same.
>
> The **Old identifier** column is retained as the migration record.

### **Resistance and Weakness Multipliers**

* **Resistant:** 0.5× · **Neutral:** 1.0× · **Weak:** 1.5× — **BUILT** (`RESISTANCE_MULTIPLIER` / `WEAKNESS_MULTIPLIER`)

Resistances and weaknesses are per-creature, not per-archetype. There is no global type chart. Every alpha species carries **one resistance and one weakness**, imported from the master sheet. Iron is the standout — 8 weaknesses, 0 resistances — and Bane has no weakness anywhere, so it is Dragon flavour only for now.

⚠️ `resistances`/`weaknesses` are **snapshotted onto the creature instance** at creation (`GameState.createCreatureInstance`, `BreedingSystem.breed`, and `Battle.initializeCombatants` for enemies), and combat reads `instance.resistances`, never the template. Editing the type chart does nothing for a creature already in a save — bump `SAVE_VERSION` or start a new game.

A landed weakness hit takes the multiplier **and generates one Pack Tempo**, whether or not the species has been seen before. Monsterpedia knowledge controls the `+TEMPO` preview and auto-combat's targeting; it never suppresses the damage or the Tempo reward.

---

## **Accuracy and Evasion**

> **PARTLY BUILT.** Ability accuracy rolls and the minimum hit chance are live. **Evasion does not exist in any form.**

### **What is built**

* Each ability has an Accuracy value, rolled per attack — **BUILT** (`rollAbilityHit`). The hit roll is always the **first** RNG draw of a resolution, which keeps seeded Chamber runs reproducible.
* Minimum hit chance is **30%** (`MIN_HIT_CHANCE`) — **BUILT**
* A miss deals zero damage, applies no secondary effects, and generates no Tempo — **BUILT**
* Hostile zero-power abilities (status, debuff) roll accuracy too; self- and ally-targeted abilities are guaranteed — **BUILT** (`resolveNonDamagingAbility`). Area effects roll independently per target, because resolution is per target.

### **What is not**

`hit_chance = ability_accuracy − target_evasion_modifier` is **NOT BUILT.** There is no target term in the roll at all — `rollAbilityHit` takes only the ability. Consequently:

* The **Evasion Up** trait exists in the trait library and has no effect anywhere.
* The **Blind** status exists in `StatusType` and has no effect anywhere — it is the only status that does literally nothing.
* SPD does not affect evasion. *(It no longer affects crits either — see below — so SPD is purely turn order. The GDD's Creature Object Fields table still calls it a "crit-chance bonus"; that is stale.)*

### **Design intent (unchanged)**

Most combat plays out at full accuracy. Evasion is meant to be a bonus that procs occasionally on trait-invested creatures, not a strategy you build teams around. The real accuracy tension is meant to come from powerful-but-inaccurate abilities — Absolute Zero at 70, Cataclysm at 80. **Both exist in `Abilities.csv` and neither is in `abilities.ts`**, so at present accuracy is nearly a non-system: of the 45 implemented abilities, **31 sit at accuracy 100** and the lowest in the game is 85. Nothing yet trades accuracy for power, and `MIN_HIT_CHANCE` has never once been the binding constraint.

---

## **Critical Hits**

> **BUILT** — as **conditional criticals**. The random-roll model (`BASE_CRIT_RATE` 5%, `HIGH_CRIT_RATE` 15%, +1% per 10 SPD, player-only) is gone from the code; see *Superseded decisions*.

* A hit is a critical **if and only if** the ability's authored `critCondition` is true of the target at the moment of resolution — **BUILT** (`meetsCriticalCondition`). There is **no random roll** and **no SPD term**.
* The three conditions in `CriticalCondition` — **BUILT**:

  | `critCondition` | Crits when |
  | ----- | ----- |
  | `target_statused` | the target carries any status effect |
  | `target_debuffed` | any of the target's stat stages is negative |
  | `target_below_half` | the target is under half its max HP |

  An ability without a `critCondition` **can never crit**. Most of the 45 cannot.
* Critical hits deal **1.5×** damage — **BUILT** (`CRIT_MULTIPLIER`)
* **`keen` is a display tag, nothing more** — **BUILT.** It renders as `· KEEN` in the MAGIC menu to flag a move whose condition is broad or easy to set up. It has no mechanical effect; the condition is what crits. Four moves currently carry it.
* **Enemies crit — decided, 2026-08-27.** `meetsCriticalCondition` takes no side argument and `calculateDamage` no longer checks `isPlayerOwned`, so an enemy move that carries a `critCondition` crits under the same conditions a player's does. The old "player crits only" rule existed to keep run-ending RNG off the enemy side; conditional crits are not a roll — a conditional enemy crit is something the player can see coming and prevent (cleanse the status, heal above half) — so the owner reviewed the rewrite's default and confirmed it rather than reverting it. This is no longer an open question. Note the alpha roster gives enemies the same generated moves as players, so any enemy carrying a `critCondition` move crits today.
* Crits **ignore the target's stat buffs** — **NOT BUILT.** `calculateDamage` computes from the target's *buffed* effective stats and multiplies by 1.5. There is no unbuffed recomputation.
* A crit does **not** generate Pack Tempo — **BUILT.** `resolveAbility` records `conditionalCritical` but `tempoReasonForAction` ignores it. The spec's Relay-Window draft had crits generating Tempo; the persistent-Relay revision dropped that, and the code follows the revision.

---

## **Pack Tempo and Relay**

> **BUILT** in expedition combat — this is the one piece of the combat rewrite that is fully production. Only **one** generation source exists.

Pack Tempo is a small party-wide resource, earned by skilful actions and spent to reorder the actions the party already owns. It never grants an additional action. Rules live in `PackTempo.ts` (pure) and `Battle.ts` (wiring); the meter shows in the combat HUD as `PACK TEMPO n/3`.

### **Lifecycle**

* Starts at **0**, caps at **3** (`BASE_TEMPO_CAP`) — **BUILT.** The Chamber may seed a fixture with `initialTempoPoints`; nothing in production does.
* **Carries between rounds** of the same battle; **clears at battle end** (the `Battle` object is rebuilt per encounter, so nothing persists into the next fight) — **BUILT**
* Reaching three makes **Relay Ready**, which **never expires** — it waits until Relay is used or the battle ends. There is no expiring Relay Window (that prototype is superseded) — **BUILT**
* While full, further generation is **wasted** (counted in metrics) and the UI never forces a spend — **BUILT**

### **Generation**

* **The only live generation source is a landed weakness hit** by a player-owned Kin's ability — **BUILT** (`tempoReasonForAction` returns `'weakness'` or `null`, nothing else). A weakness hit grants Tempo **whether or not that weakness was previously known**; knowledge controls previews and auto-combat, not the reward.
* **At most one Tempo per action slot** — **BUILT.** `generateTempo` records the slot id and refuses a second award for the same slot, so an area move that hits three weaknesses still yields one. *(The Relay-Window draft phrased this as "one per Kin per round"; the code's invariant is per slot, which is stricter in the presence of a Relay and is what the spec's final revision asked for.)*
* Enemies never generate Tempo. Items never generate Tempo. Misses, crits, statuses, Basic Attack and ordinary hits do not generate merely for occurring — **BUILT**
* `Ability.tempoGeneration: 'on_hit'` exists on the type and is **set by no ability**. The only reader is the Chamber's shared-AP fallback ordering. It is vestigial; do not build against it — **PARTLY BUILT (dead field)**
* `TempoGenerationReason` also enumerates `omen_resolved | break | rebound | trait | boon | encounter_rule`. **Nothing emits any of them** — they are typed extension points, not behaviour. **Decided 2026-08-27: Omen, Break and Rebound stay deferred until playtests validate Relay itself as a combat system.** They remain the intended future Tempo sources, not cancelled — but adding them before Relay's single-source version is proven would be building on an unproven foundation. The RELAY tooltip's promise of "Weakness, Omen, Break, or Rebound" is being removed to match, since only the first word is currently true — **NOT BUILT** for the other three, and deliberately not next.

### **Relay**

* Costs **all three Tempo** (`RELAY_TEMPO_COST`) — **BUILT**
* **Queue, then pay.** From the root menu the player opens `RELAY`, picks an ally's unused slot, and is returned to the menu to take a normal action (FIGHT, MAGIC or ITEM). When that action finishes, the queued slot is moved to **directly after the current slot** and the Tempo is spent. Choosing `RELAY` again lets the player change or cancel the target without cost — **BUILT**
* **Nothing is spent if the Relay never resolves** — the queue is cleared every turn, and `performRelay` refuses (silently, leaving Tempo intact) when the target is knocked out, is no longer in the timeline, or every enemy is already down — **BUILT**
* **Legal candidates:** living, player-owned slots at least two positions after the current one — the slot immediately next is already next, so pulling it would change nothing. A knocked-out ally is never offered — **BUILT** (`relayCandidatesForCurrentTurn`)
* Relay **moves** a slot and removes its old position; it never creates an action and never crosses the battle boundary — **BUILT** (`relayTimeline`)
* The moved Kin's own action can itself generate Tempo and is a normal action in every respect — **BUILT**
* **Auto-combat's Relay heuristic** — **BUILT** (`queueAutoRelayIfUseful`): when Relay is Ready and **the next slot is an enemy's**, auto queues the first legal candidate before choosing its move, so the ally jumps ahead of that enemy action. If the next slot is already an ally's, auto banks the Tempo. Spec's contract — same rules and information as manual combat, never spend after every ally has acted, never target a KO'd ally, never create an action — holds because auto goes through the same `Battle` methods.
* Enemies have no Tempo economy, hidden or otherwise — **BUILT**

### **Metrics**

`Battle.tempoMetrics` records generated / spent / wasted-at-cap / relays, player and enemy action counts, rounds where the pack acted before any pending enemy, rounds where Relay was held Ready, and Link Art counts. They are surfaced in `snapshot()` and returned to the Chamber as its result card — **BUILT**. Outside the Chamber nothing reads them yet.

---

## **Link Arts** — **CHAMBER ONLY**

> Engine and recipes exist (`LinkArts.ts`), gated entirely on `chamberContext.linkArts`. **Expedition combat never evaluates a Link.** Contract and presets: `../dev/battle-chamber.md`.

What the prototype does, for orientation only:

* Three authored **duo** recipes (`CHAMBER_LINK_RECIPES`), each an ordered pair of broad move styles — a buff then an Ash attack, Ash then Salt, Salt then Breath — with a damage multiplier on the finisher.
* A move's style is **derived** from its data (`power > 0` → attack; else buff / debuff-or-status / heal). The `guard` role is declared in the type but no ability ever derives it.
* Participants must be **different Kin**; **any enemy action interrupts** the chain; an item use clears it; the chain clears at round end. Relay is what creates the adjacency, and is not itself a link component.
* A finisher that completes a recipe is announced in the log (`LINK ART — name!`) and its multiplier applied. There is no pre-confirmation preview of the transformed move in the menu yet.

Nothing here is a production commitment. Promoting it means: a real recipe catalogue, the preview UI the spec asked for, trio recipes, and a decision on whether enemies interrupting is fair against two-slot bosses.

---

## **Battle Chamber-only knobs**

> **CHAMBER ONLY.** Listed so nobody mistakes them for production rules. Details in `../dev/battle-chamber.md`.

| Knob | What it does |
| ----- | ----- |
| `resourceModel: 'shared_actions'` | Replaces individual MP with a **shared Action Point pool** (3 per round, no banking, Basic Attack free, learned moves 1–2 AP) and uses `chooseSharedAction` for auto. Kept as a comparison model; **stays**, per `progress.md` 2026-08-27 — do not propose cutting it again. |
| `revealWeaknesses` | Treats every enemy species as known: `+TEMPO` previews, `WEAK …` on the target line, and auto-combat's type multiplier all switch on immediately. |
| `initialTempoPoints` | Seeds spendable Tempo for a fixture. |
| `bossDoubleAction` | Schedules a `boss_extra` slot for the first living enemy. |
| `linkArts` | Enables the Link Art recipes above. |
| seeded RNG | Every Chamber battle is deterministic from its preset seed. |

Combat must never *depend* on Chamber state — the Chamber consumes the combat rules, it does not fork them. Every knob above is a `chamberContext` read inside `Battle`, and `chamberContext` is `null` on every expedition.

---

## **Buff and Debuff System**

> **PARTLY BUILT — and the two rules below that are *not* built are both inverted from what the code actually does.** Read this section carefully; it has misled work before.

### **Stages**

Buffs and debuffs modify stats in stages. Stages cap at **±3**. — **BUILT** exactly:

| Stage | Multiplier |
| ----- | ----- |
| -3 | 0.75× |
| -2 | 0.85× |
| -1 | 0.9× |
| 0 (base) | 1.0× |
| +1 | 1.1× |
| +2 | 1.25× |
| +3 | 1.5× |

`BUFF_MULTIPLIERS` in `types.ts` matches this table value for value, and `applyBuffDebuff` clamps to ±3.

### **Duration — decided: no duration, by design**

> The old text read: *"Buffs and debuffs last a fixed number of turns (not rounds).
> Default duration: 3 turns unless the ability specifies otherwise."*

**There is no duration on a buff stage, and that is deliberate for alpha (decided
2026-08-27).** `CombatCreature.buffStages` is a bare `Partial<Record<StatName, number>>` —
a number per stat, nothing else. Nothing decrements it. **A stage applied on turn one
persists for the entire battle,** and reapplying stacks rather than refreshing (see
*Stacking* below), capped at ±3. Stages reset only because the whole `CombatCreature` is
rebuilt for the next encounter.

This is not silence — it is a choice, not a gap. The counter-play is **Null Salt**
(`systems/Items.ts`, `strip_buffs` → `stripPositiveStages`), which strips an enemy's
positive stages outright, and the ±3 cap is the bound on how far stacking can run in
either direction. **Revisit after playtest data** — like every number in this file, the
cap and the lack of decay are alpha placeholders for feel, not settled balance.

Do not confuse this with **status effects**, which *do* carry `turnsRemaining` and *are*
ticked down. Statuses expire; stat stages do not. The two systems look parallel in this
document and are not parallel in the code.

This is also why `ui-ux.md`'s "buff/debuff icons with remaining turn count" cannot be
built as specified — there is no count to render.

Note the interaction with conditional crits: a `target_debuffed` crit condition stays
satisfied for the rest of the battle once any debuff lands, because the debuff never wears
off. That makes debuff-then-Keen a strong, permanent setup — expected, given the decision
above, not a bug.

### **Stacking — the doc had this backwards**

> The old text read: *"The same buff/debuff does not stack with itself — reapplying
> refreshes the duration."*

**Reapplying stacks.** `applyBuffDebuff(target, stat, stages)` *adds* to the current
stage and clamps to ±3. Casting a +1 ATK buff three times gets you to +3 ATK — permanently,
for the battle. Combined with the missing durations, this means buff stacking is currently
a dominant and entirely un-costed strategy, bounded only by MP.

What **is** true:

* Different buffs affecting different stats stack freely — **BUILT** (one stage per stat)
* Positive and negative stages on the same stat net out — **BUILT** (+2 and −1 = +1), and it falls out of there being a single signed number per stat rather than a list

### **Buff/Debuff Types**

| Effect | Status |
| ----- | ----- |
| ATK Up/Down (STR) | **BUILT** |
| INT Up/Down | **BUILT** |
| DEF Up/Down | **BUILT** |
| WIS Up/Down | **BUILT** |
| SPD Up/Down | **BUILT** — and it genuinely reorders turns, since the timeline is rebuilt each round |
| Haste | **NOT BUILT** — no such stat |
| RES Up/Down | **NOT BUILT** — no such stat; resistance is a per-creature array, not a stage |

Also built, and previously undocumented: **`stripPositiveStages`** zeroes a target's
positive stages only, leaving negatives alone. It is a counter to a buffed elite, not a
cleanse — clearing debuffs too would hand the enemy a favour.

---

## **Status Effects**

> **PARTLY BUILT.** Poison, Burn, Stun and Sleep now match the code, described below as the
> code behaves rather than against an older spec. Freeze is still simplified from what it
> was specified to do. Blind does nothing at all.

| Status | Effect (what the code does) |
| ----- | ----- |
| Poison | **BUILT** — 8% of max HP damage at the end of each turn, 3 turns |
| Burn | **BUILT** — 6% of max HP damage at the end of each turn, 3 turns |
| Freeze | **PARTLY** — skips the turn, 1-turn duration. Documented to also increase Salt weakness; that bump is **not built**. |
| Stun | **BUILT** — skip next turn, 1-turn duration |
| Sleep | **BUILT** — skips turns for a flat 3-turn duration. Mechanically a longer Stun: it does not wake on being hit and carries no waking-hit bonus. |
| Blind | **NOT BUILT** — nothing reads it. Applying Blind does nothing whatsoever. |

Burn's damage-over-time was originally specified as flat fire damage plus an ATK
reduction, and Sleep as waking on the first hit taken for 1.5× damage. Neither extra
clause was ever built. **Decided 2026-08-27: drop both clauses rather than build them** —
the table above is now a description of the shipped behavior, not a comparison against
the old spec. See *Superseded decisions*.

Any status also satisfies the `target_statused` crit condition for as long as it lasts — including Blind, which is currently its only observable effect.

### **Status Resolution**

* Status effects are applied at the end of the action that caused them — **BUILT**
* The same status cannot be reapplied while active — it must expire first — **BUILT** (`applyAbilityEffects` checks for an existing entry)
* A creature can carry multiple different statuses simultaneously — **BUILT**
* Effects roll their configured `chance` — **BUILT**
* Statuses tick at the end of the affected creature's own slot (or when a skip-status consumes the slot) — **BUILT**
* Resist Status trait reduces the chance of a status landing — **NOT BUILT.** The trait exists in the library; nothing reads it. *(Only `stat`-category traits have any effect at all — see `traits-system.md`.)*
* Freeze and Stun get a 1-turn duration; everything else gets 3 — **BUILT**, hard-coded in `applyAbilityEffects` rather than authored per ability.

---

## **MP System**

> **BUILT.**

* Abilities cost MP as defined on the ability object — **BUILT**
* MP does **not** regenerate naturally between turns — **BUILT.** This is a genuine attrition economy: MP is managed across a descent, not within a fight.
* MP stays drained after each encounter — **BUILT** (`RunState.partyMp`)
* Running out of MP limits a creature to Basic Attack (0 MP) — **BUILT.** A creature with no MP has exactly one option.
* Ability MP costs were cut ~40% across the board (max cost 7) for a healthier MP economy — **BUILT**
* Enemies pay MP too, at intent resolution; `getEnemyAction` never commits a move the enemy cannot afford — **BUILT**

**Recovery sources:**

* **Rest points** — **BUILT**: a rest offers three choices — 50% HP to one creature, **full MP** to one creature, or 20% HP + 20% MP to the whole party.
* **Tower shops** — **BUILT** — full MP restore for Obols, alongside party heal and revive.
* **Items** — **BUILT** — Moonwater and others; see `systems/Items.ts`.
* **Event rooms** — Mercy Well restores 10% HP+MP to all for 10% of current Obols; see `../decisions/2026-08-27-event-rooms-design.md`.
* **Traits (MP Up)** — a larger pool, not regen — **PARTLY BUILT.** `mp_up` is a `stat`-category trait, so it *would* work — but no code path ever grants a trait, so no creature holds one.
* **A boon granting per-battle MP recovery** — **NOT BUILT.** No such effect kind exists in `data/boons.ts`; if one is added it belongs in the boon layer, the only run-scoped modifier system.

The Battle Chamber's shared Action Point pool is the one alternative to individual MP, and it is **CHAMBER ONLY** — see above.

---

## **Knockout and Revival**

> **BUILT.**

* At 0 HP a creature is **knocked out** for the remainder of that encounter — **BUILT**
* Knocked-out creatures stay down until revived by item, shop, or rest — **BUILT**
* A knocked-out Kin is never a Relay candidate, and an enemy intent aimed at it fizzles — **BUILT**
* If all three active creatures are knocked out, the **run ends** — **BUILT** (see Run Failure in the GDD)
* Revival restores a fraction of max HP, floored at 1 HP — **BUILT.** The floor matters: a low fraction against a low-HP creature otherwise rounds to 0, reviving someone straight back into a knockout.
* Revival **never lowers MP** — **BUILT.** A knockout only zeroes HP, so a creature felled at full MP keeps it; a revive must not become a penalty for whoever was carrying the most MP.
* Knocked-out creatures cannot accomplish a mark deed — **NOT BUILT.** Marks (Design B, permanent discoveries — decided 2026-08-27) have no code yet; see `marks-system.md`.

---

## **Items in Combat**

> **BUILT.**

* The `ITEM` submenu draws from the **shared backpack**, not per-creature inventories
* `usableIn` and `targeting` are **data on the item**, so no scene branches on an item id
* Consumption happens **only on a non-`refused` outcome** — an item that cannot do anything is refused rather than silently eaten, and the player is returned to the menu with the turn intact
* Using an item is an action: it ends the slot, ticks statuses, and can carry a queued Relay like any other action. It never generates Tempo — **BUILT**
* **Smoke Husk** ends a battle as a **free action** (no enemy acts in response) and deliberately **records no species knowledge** — otherwise "enter, read the enemy, escape, re-enter informed" would be free scouting against the auto-combat fog. `Battle.settleEscape` ticks boon durations, saves party HP/MP, and returns to the map with **no rewards**. It is unavailable on boss floors, enforced structurally by `usableIn: 'combat_non_boss'`.
* **Power Increase** is party-wide (+1 STR stage to every living ally) — the one thing the MAGIC menu cannot do, since no ability targets all allies.

Escaping a battle lives here, and any future escape mechanic stays in this channel rather than becoming a menu verb.

Full item rules live in `../archive/pitches/expedition-items-pitch.md` (historical — the code wins where they differ) and `systems/Items.ts`.

---

## **Boons in Combat**

> **BUILT.** Boons are the **only** run-scoped modifier layer. Relics were removed as a concept on 2026-08-27; a boon with `battlesLeft: null` *is* a run-long boon (Gary's Gift already uses it).

Timed, run-scoped modifiers chosen at the post-battle reward offer or granted by events. They take effect immediately — no backpack slot, no arming step — and expire after N battles.

* Effect kinds (`data/boons.ts`): **damage dealt** (player attackers only), **damage taken** (player targets only, with a first-round-only variant keyed on `Battle.roundNumber`), **Obol bonus**, **post-victory heal**, **flat max HP** (`effectiveMaxHp`, applied when combatants are built and again on level-up)
* **One boon per effect kind** may be active at once; re-taking a held kind refreshes duration rather than stacking magnitude
* Ticked down in `Battle.settle` after every fight and in `settleEscape` after a Smoke Husk; surfaced on the run map with a countdown

There is deliberately **no MP-discount boon.** `ability.mpCost` is read raw in many places across `Battle`, `CombatScene` and `TacticsAI` — affordability, menu labels, Conserve MP's ceiling, Heal First's reserve, tiebreaks — and a discount missing any one of them would make auto-combat plan against a cost the player doesn't pay. Full rationale in the `data/boons.ts` header.

Boons do not touch Tempo. `TempoGenerationReason` reserves `'boon'` for a future boon that adds Tempo triggers; none exists.

---

## **Knowledge Fog**

> **BUILT** — and now visible, since the type chart is authored.

* `gameState.seenSpecies` is the Monsterpedia's record of species fought. It is written in `Battle.settle` — **at battle end, win or lose** — never at battle start, and **never on a Smoke Husk escape** — **BUILT**
* What knowledge gates:
  * **auto-combat's damage estimate** — `estimateDamage` applies the type multiplier only for known species, so auto cannot aim at a weakness it has not learned;
  * the **`· +TEMPO` preview** in the MAGIC menu (`isKnownWeakness`).
* What knowledge does **not** gate: the damage multiplier itself, and Tempo generation. A blind weakness hit is still a weakness hit. The *first* fight against a species is genuinely blind for the AI and the preview, and the fog lifts for the rest of the save afterwards.
* Enemy AI is permanently blind (`NO_KNOWLEDGE`) — it never exploits the party's weaknesses on purpose — **BUILT**
* The Chamber's `revealWeaknesses` bypasses all of this for lab work — **CHAMBER ONLY**

---

## **Auto-Combat**

> **BUILT** — the most complete system in this document.

### **Overview**

Players toggle auto-combat on or off at any time, during battle or from the run map. Auto is a full-featured option for players who want to take a back seat and only make strategic decisions between battles.

### **Tactics Rules**

The player assigns a standing behaviour to each creature, set in Party Select and persisted across runs.

| Tactic | Behavior |
| ----- | ----- |
| **Fight Wisely** | Balanced — uses abilities efficiently within a half-current-MP budget, targets known weaknesses |
| **All Out** | Prioritizes highest damage regardless of MP cost |
| **Conserve MP** | Prefers Basic Attack; spends only above a ⅓-max-MP ceiling or past a 50% party-danger gate |
| **Heal First** | Prioritizes healing and support, holding a reserve of 60% / 2× cheapest heal |
| **Follow Orders** | Manual control only — auto skips this creature and prompts normally |

One side-agnostic `TacticsAI.chooseAction()` drives **both** player tactics and enemy AI. `enemy_default` is a literal port of the old `getEnemyAction`, pinned by characterization tests. The type system makes it impossible to hand `follow_orders` to the AI.

`chooseAction` returns **null** when the actor has no legal move — in practice only when every foe is already down, meaning the battle is ending anyway. Callers end the turn rather than inventing an action.

**Relay under auto** is decided in `Battle`, not in `TacticsAI`: the heuristic in *Pack Tempo and Relay* runs before the tactic picks a move. `TacticsAI` knows nothing about Tempo.

### **Auto-Combat Limitations**

* Auto does not use items from inventory — **BUILT**
* Auto does not use the Capture action — **N/A**, capture is not wired into combat at all
* Auto does not know enemy resistances until that species has been fought before — **BUILT**; see *Knowledge fog*
* Auto plans against the committed enemy intents only through the Relay heuristic; the tactics themselves do not read intents — **BUILT** (a limitation worth revisiting — Heal First could read an incoming area move)
* The player can toggle Auto off mid-battle and take manual control — **BUILT**
* **Battle speed** is a persisted preference (1×/2×/4×) scaling all combat pacing, with a 100 ms floor so animations and the message log cannot collapse into a single frame — **BUILT**

---

## **Enemy Encounters**

> **PARTLY BUILT.**

* Enemies use the same creature stat system as player creatures — **BUILT**
* Enemies have **variable ATK and HP** relative to their standard version — **BUILT**: normal enemies get **STR/INT × 0.6** and **HP × 1.2**; bosses get **HP × 1.8** and **STR/INT × 1.15**. This is what keeps ordinary fights from being life-or-death.
* Enemy creatures do not have traits or marks — **BUILT** (trivially — neither system grants anything to anyone)
* Enemy AI targets a **random living party member**, spreading damage rather than focusing the lowest-HP creature — **BUILT**, chosen at intent commit
* Single-target attacks **auto-target** when one enemy remains; target selection is only presented at 2+ enemies — **BUILT**
* Enemy difficulty scales by depth — **BUILT**, as `enemyLevels` from the encounter (`floor × 0.8` for combat; `floor × 1.0` or `× 1.2` plus 2 for mini/major bosses)
* **Enemy count — decided 2026-08-27: 1–3 in tower bands 1–2, up to 5 from band 3 onward.** This resolves the old mismatch with `tower-structure.md` (which had said "1–5" while the code never exceeded three) by making both true at different depths. **BUILT** — `maxEnemiesForBand` / `maxEnemiesForFloor` in `src/types.ts` drive `makeEncounter`; a band with no authored creatures draws from the deepest populated band, so a band-3 fight today is 1–5 of the existing thirty. `tower-structure.md` carries the authoritative band-by-band table. Within bands 1–2: early floors generate 1–2 enemies; deeper floors 1–3; bosses 2–3.
* Boss creatures have **unique abilities not available to player creatures** and higher stat pools — **PARTLY BUILT.** The stat pools are real. The unique abilities are not — bosses are drawn from the same band pool as wild encounters and use the same generated `defaultAbilities`. A dedicated mini-boss roster is planned; until then their buff/debuff/heal casting is intended.
* Bosses with **two telegraphed action slots** per round — engine-ready, **CHAMBER ONLY** in practice (see *Turn Timeline*)
* **Warden's Wager** (event room) doubles a fight's Obols and XP via `Encounter.rewardMultiplier` — **BUILT** (`victoryRewards`)

> ⚠️ **The difficulty curve was tuned against a 30-floor tower.** It needs re-checking
> against the alpha cap of 20 and the eventual 100. A run now ends roughly a third of the
> way up the curve it was designed for.

---

## **Not built**

Proposals from the archived combat-architecture spec that have **no code** in expedition combat. One line each; the archived spec has the full reasoning.

* **Omen, Break and Rebound as Tempo sources** — `TempoGenerationReason` names them; nothing emits them. Omen (action prevention with pips), Break (Exposed window, guaranteed first crit) and authored deflection do not exist. Deliberately deferred until Relay is validated by playtest, not just unbuilt — see *Pack Tempo and Relay*.
* **Buff and debuff durations** — stages last the whole battle and stack, by decision, not by omission; see *Buff and Debuff System*.
* **Accuracy vs evasion** — no target term in the hit roll; Evasion Up and Blind are inert.
* **Link Arts in production** — Chamber prototype only; no catalogue, no preview UI, no trio recipes.
* **Weave / Echoes / Weather** — described encounter module, no code.
* **Encounter-rule modules generally** (complexity tiers, Pattern Hunter, Breakable Parts, Tempo Thief, …) — no module system; every encounter runs the stable core.
* **Move growth** (two-move start, Learn / Advance / Augment, Growth Drafts after guardians, offer fatigue, departure augment) — creatures still carry their generated `defaultAbilities` and up to four slots; nothing changes a loadout during a run.
* **Instincts and Afterforms** — named layers with no type, data, or code.
* **Trait, boon and encounter modifiers to Tempo** (starting Tempo, cap, cost, extra triggers) — reserved enum values only.
* **Multi-hit moves** — Thorn's "forty small wounds" lands as keen crits instead.

---

## **Open Questions**

### **Carried over, still open**

* Exact damage formula constants and scaling curves — requires playtesting
* Whether Heal First should hold its MP reserve across its buff/debuff rules, not just its damage rule — today it can spend on a debuff and then be unable to afford the heal the reserve exists to protect
* Whether Fight Wisely's "half current MP" budget drains too fast across a full descent
* Whether bosses have multiple phases or unique mechanics beyond stat inflation — the two-slot boss is the first candidate, and it only needs a production trigger
* Specific crit-related trait effects and balancing

### **Raised by the V1/reality audit (2026-07-30)**

* **Do crits keep the buff-ignoring clause?** It was specified, never built, and nothing depends on it either way.

### **Raised by the reconciliation (2026-08-27)**

* **Should tactics read intents?** Auto sees committed enemy moves only through the Relay heuristic.

---

## **Superseded decisions**

Rules that were once live — in the code, in this doc, or in the archived spec — and have since been reversed. Kept so nobody re-derives them.

* **Random critical hits** (`BASE_CRIT_RATE` 5% / `HIGH_CRIT_RATE` 15% / +1% per 10 SPD, `ability.highCrit`) — replaced by authored `critCondition` checks and the `keen` display tag. Spec decision CA-05; landed in code with the Pack Tempo slice (2026-08-01/02).
* **Player-only crits** — the `isPlayerOwned` gate went with the random roll. Enemies now crit on the same conditions, confirmed as the intended rule 2026-08-27 (see *Critical Hits*); `CLAUDE.md`'s Key Design Rules line has been updated to match.
* **Burn's ATK-down clause and Sleep's wake-on-damage + 1.5× waking bonus** — both specified, neither ever built. Decided 2026-08-27 to drop both rather than build them: Burn is a flat 6%-max-HP tick and Sleep is a plain 3-turn skip (mechanically a longer Stun). See *Status Effects*.
* **Relics as a separate run-scoped layer**, and the **Encore / extra-action Relay** chamber prototype (`relic_extra` turn slots, `createExtraTurnSlot`, the `encoreRelay` flag) — removed 2026-08-27 (`progress.md`). Boons are the only run-scoped modifier layer; `battlesLeft: null` is a run-long boon. If an "extra action" is ever wanted, it is a boon effect kind, not a slot source.
* **The expiring Relay Window** (spend one Tempo plus a per-round Window opened by a crit/weakness/Technical) — the 2026-08-01 prototype, superseded on 2026-08-02 by persistent three-Tempo Relay Ready.
* **Basic Attack as the deliberate Tempo builder** ("the pack's first Basic hit each round generates one Tempo") — Relay Window era; Basic Attack generates nothing now.
* **Crits generate Tempo** — Relay Window era; dropped with it.
* **"One Tempo per Kin per round"** — replaced by once per action slot.
* **Enemy intents changeable mid-round by a described move** — spec allowance; no code path, and none planned until an encounter module needs it.
* **`FIGHT / MAGIC / ITEM` as the whole root menu** — `RELAY` was added as the fourth root command.
* **"The type multiplier is inert"** — true until 2026-08-02; the alpha roster has been authored since.
* **Free `FLEE` after every encounter** — replaced by the departure lock, Waystone and Smoke Husk (2026-07-29, `../decisions/2026-07-29-expedition-commitment-and-consumables-design.md`).
* **Shared Action Points as a production candidate** — stays a Chamber-only comparison (decided 2026-08-27; do not propose cutting it, and do not propose shipping it without a new design pass).
