# **Hollow Kin — Combat System**

*Working Document — Subject to Change*

> **Owns:** turn order, actions, damage formula, **the damage types (the wards)**, accuracy/evasion, crits, buffs & debuffs, status effects, MP, knockout, items and boons in battle, auto-combat tactics, enemy AI.
> **Defers to the GDD on:** currency, progression model, capture rules, and what persists across runs. Encounter placement and boss cadence live in `tower-structure.md`.
> **Last verified:** 2026-07-30 — every section below re-checked line by line against `CombatEngine.ts`, `CombatScene.ts`, `TacticsAI.ts`, `data/abilities.ts` and `data/creatures.ts`.
> **Amended 2026-08-02:** the ward vocabulary was decided and renamed throughout `src/` the same day — `DamageType`, all 31 abilities, the resistance traits and every test. Doc and code agree. The four new wards (Bane, Rust, Honey, Thorn) are **types without abilities** so far; see the caveat under *The Wards*.

---

> ## **How to read this document**
>
> This started as a V1 spec and was drifting into being read as a description of the
> shipped game. It is neither, purely — parts of it are built exactly as written, and
> parts were never built at all. **Every section now carries a status tag**, so no claim
> here can be mistaken for a report on the code.
>
> | Tag | Meaning |
> | ----- | ----- |
> | **BUILT** | Matches the code today. Safe to rely on. |
> | **PARTLY BUILT** | Some of it is live. The delta is spelled out explicitly — read it before assuming. |
> | **NOT BUILT** | Designed here, zero code. |
>
> The rule this document is meant to enforce: **if you are about to write code against a
> claim in here, check its tag first.** The V1/reality gap here was invisible for long
> enough that several claims below turn out to be inverted from what the code does, not
> merely incomplete.

---

## **Overview**

Combat in Hollow Kin is turn-based and active by default. The player controls a party of three creatures against enemy encounters in the tower. Combat is the moment-to-moment gameplay loop that everything else — breeding, traits, marks, boons — exists to support. The system must be deep enough to reward investment in creature builds while simple enough to auto-battle through low-difficulty floors.

---

## **Turn Order**

> **PARTLY BUILT.** SPD sorting and per-round recalculation are live. Random tiebreaks, Haste and Initiative-trait modifiers are not.

* Turn order is determined by SPD stat — **BUILT**
* At the start of each round, all combatants (player creatures and enemies) are sorted by SPD, highest first, and the order is **recalculated every round** so buff and debuff stages take effect — **BUILT** (`CombatEngine.calculateTurnOrder`, called at round start in `CombatScene`)
* Knocked-out combatants are excluded from the order — **BUILT**
* Ties are broken randomly — **NOT BUILT.** The sort is a plain numeric comparator, so ties resolve deterministically by array position (player party first, then enemies). Whether this needs fixing is genuinely open — deterministic ties may be preferable to random ones.
* Haste buffs and Initiative traits modify effective SPD without changing the base stat — **NOT BUILT.** There is no `haste` stat (`StatName` is hp/mp/str/def/wis/spd/int) and the `initiative_boost` trait exists in the library but nothing reads it.

---

## **Actions Per Turn**

> **PARTLY BUILT.** The player's root menu is `FIGHT / MAGIC / ITEM`. Capture is designed but unreachable.

Each creature takes an action per turn:

* **Basic Attack** — free fallback, always available, 0 MP — **BUILT.** This is the `FIGHT` root option, backed by the `basic_attack` ability (Power 20, Accuracy 100, Fighting). It is deliberately excluded from the `MAGIC` submenu so it never appears twice.
* **Ability** — select from up to four equipped abilities, costs MP — **BUILT** (`MAGIC`)
* **Item** — use one thing from the shared backpack — **BUILT** (`ITEM`). Item behaviour is data-driven via `usableIn`/`targeting`; see `expedition-items-pitch.md` and `systems/Items.ts`.
* **Capture** — spend the turn attempting a capture — **NOT BUILT.** `systems/Capture.ts` is complete and tested but is imported by nothing except its own test; there is no capture action on the combat turn, and nothing populates the `RiteLog` fields seven of the eleven family rites read. See the capture entry in `CLAUDE.md`.

There is **no swap action.** A captured creature is cargo, not a reinforcement — it arrives at level 1 and cannot be fielded during the run that caught it. The party is the three creatures the player entered with, for the whole descent.

---

## **Damage Formula**

> **BUILT** — the formula matches exactly. The type-multiplier term is live but currently **inert**, for a content reason.

```
damage = max(1, (STR or INT) − (DEF or WIS) / 2) × (Power / 50) × TypeMultiplier
```

Key points:

* Physical abilities scale off STR vs DEF, special abilities scale off INT vs WIS — **BUILT**
* Defense doesn't fully cancel attack — it's halved before subtraction, and the result is floored at 1, so there's always minimum damage — **BUILT**
* Skills have a built-in Power value. **The `/ 50` divisor is load-bearing** — Power is expressed on a ~50-is-average scale, so dropping it multiplies all damage by fifty — **BUILT**
* Some skills deal fixed damage or scale off MP/level rather than STR/INT — **NOT BUILT.** No ability in `abilities.ts` does this. Items do have a fixed-damage path (`applyPercentDamage`), deliberately bypassing DEF and the type chart — that is what earns a fixed-damage item a backpack slot when the party's abilities are being resisted.

### **The Wards — damage types** — **BUILT** *(decided and renamed in code 2026-08-02)*

The type chart in Hollow Kin is not physics — it is folk remedy. Every damage type is named
for a thing people have carried against the dark, and that framing is load-bearing: it is
*why* resistances are per-creature and hidden. There is no rule that fire beats ghosts.
There is only the specific knowledge that this specific kin cannot abide iron, and someone
had to find that out first.

Ten wards. The first six are renames of the shipped `DamageType` values; the last four are new.

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

> **All ten wards are dealable as of 2026-08-02.** `abilities.ts` went 31 → 45: fourteen new
> moves covering Bane, Rust, Honey and Thorn, and sixteen existing moves renamed so their
> display names read as wards rather than elements (`Ember` → `Ashfall`, `Frost` → `Rime`,
> `Spark` → `Toll`). **Ability ids were deliberately left alone** — they are opaque handles
> referenced ~86 times across tests, fixtures and LinkArts recipes, and the player never
> sees them, so `id: 'ember'` now carries `name: 'Ashfall'`.
>
> Every ward needs a low-tier move in **both** categories, or an archetype carrying it cannot
> serve both STR and INT roles. Salt already worked this way (`frost` Physical 35 / `chill`
> Special 40); `combfall` and `thicket` were added to give Honey and Thorn the same.
>
> The **Old identifier** column is retained as the migration record.

### **Resistance and Weakness Multipliers**

* **Resistant:** 0.5× · **Neutral:** 1.0× · **Weak:** 1.5× — **BUILT** (`RESISTANCE_MULTIPLIER` / `WEAKNESS_MULTIPLIER`)

Resistances and weaknesses are per-creature, not per-archetype. There is no global type chart.

The alpha roster now has authored wards. Any landed weakness hit receives the damage
multiplier and generates one Pack Tempo, even when the species has not been seen before.
Monsterpedia knowledge controls weakness previews and auto-combat targeting; it never
suppresses the underlying damage or Tempo reward.

---

## **Accuracy and Evasion**

> **PARTLY BUILT.** Ability accuracy rolls and the minimum hit chance are live. **Evasion does not exist in any form.**

### **What is built**

* Each ability has an Accuracy value, rolled per attack — **BUILT** (`rollAbilityHit`)
* Minimum hit chance is **30%** (`MIN_HIT_CHANCE`) — **BUILT**
* A miss deals zero damage and applies no secondary effects — **BUILT**
* Hostile zero-power abilities (status, debuff) roll accuracy too; self- and ally-targeted abilities are guaranteed — **BUILT** (`resolveNonDamagingAbility`). Area effects roll independently per target, because resolution is per target.

### **What is not**

`hit_chance = ability_accuracy − target_evasion_modifier` is **NOT BUILT.** There is no target term in the roll at all — `rollAbilityHit` takes only the ability. Consequently:

* The **Evasion Up** trait exists in the trait library and has no effect anywhere.
* The **Blind** status exists in `StatusType` and has no effect anywhere — it is the only status that does literally nothing.
* SPD does not affect evasion. *(This was always the intent, and it is what the code does — but note the GDD's Creature Object Fields table still describes `spd` as an "evasion modifier," which contradicts both.)*

### **Design intent (unchanged)**

Most combat plays out at full accuracy. Evasion is meant to be a bonus that procs occasionally on trait-invested creatures, not a strategy you build teams around. The real accuracy tension is meant to come from powerful-but-inaccurate abilities — Absolute Zero at 70, Cataclysm at 80. **Both exist in `Abilities.csv` and neither is in `abilities.ts`** (31 of 72 abilities are implemented), so at present accuracy is nearly a non-system: of the 31 implemented abilities, **24 sit at accuracy 100** and the lowest in the game is 85. Nothing yet trades accuracy for power, and `MIN_HIT_CHANCE` has never once been the binding constraint.

---

## **Critical Hits**

> **PARTLY BUILT.** Rates and multiplier are exact. The buff-ignoring clause is not implemented.

* **Enemies cannot land critical hits** — **BUILT.** Crits are gated on `attacker.isPlayerOwned`. This prevents run-ending RNG from enemy crits while making crit investment feel like a progression reward.
* Base crit rate **5%**; high-crit abilities **15%** — **BUILT** (`BASE_CRIT_RATE`, `HIGH_CRIT_RATE`, `ability.highCrit`)
* SPD bonus of **+1% per 10 SPD** — **BUILT**, as `getEffectiveStat(spd) / 1000`
* Critical hits deal **1.5×** damage — **BUILT** (`CRIT_MULTIPLIER`)
* Crits **ignore the target's stat buffs** — **NOT BUILT.** `calculateDamage` computes `baseDamage` from the target's *buffed* effective stats and then multiplies by 1.5. There is no unbuffed recomputation. This was a genuine design idea — a way to punch through a turtling enemy without a dedicated debuffer — and it simply never got written.

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

### **Duration — NOT BUILT**

> The old text read: *"Buffs and debuffs last a fixed number of turns (not rounds).
> Default duration: 3 turns unless the ability specifies otherwise."*

**There is no duration on a buff stage.** `CombatCreature.buffStages` is a bare
`Partial<Record<StatName, number>>` — a number per stat, nothing else. Nothing decrements
it. **A stage applied on turn one persists for the entire battle.** Stages reset only
because the whole `CombatCreature` is rebuilt for the next encounter.

Do not confuse this with **status effects**, which *do* carry `turnsRemaining` and *are*
ticked down. Statuses expire; stat stages do not. The two systems look parallel in this
document and are not parallel in the code.

This is also why `ui-ux.md`'s "buff/debuff icons with remaining turn count" cannot be
built as specified — there is no count to render.

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
| SPD Up/Down | **BUILT** — and it genuinely reorders turns, since order recalculates each round |
| Haste | **NOT BUILT** — no such stat |
| RES Up/Down | **NOT BUILT** — no such stat; resistance is a per-creature array, not a stage |

Also built, and previously undocumented: **`stripPositiveStages`** zeroes a target's
positive stages only, leaving negatives alone. It is a counter to a buffed elite, not a
cleanse — clearing debuffs too would hand the enemy a favour.

---

## **Status Effects**

> **PARTLY BUILT.** Three of the six do roughly what this table says. Two are simplified. One does nothing at all.

| Status | Documented effect | Reality |
| ----- | ----- | ----- |
| Poison | % max HP at end of each turn, 3 turns | **BUILT** — 8% of max HP |
| Burn | Flat fire damage each turn, **reduces ATK**, 3 turns | **PARTLY** — 6% of max HP (percentage, not flat). **No ATK reduction.** |
| Freeze | Skip next turn, then thaw. **Increases ice weakness** | **PARTLY** — skips the turn, 1-turn duration. **No ice-weakness bump.** |
| Stun | Skip next turn, 1 turn | **BUILT** |
| Sleep | Skip turns **until hit**; the waking hit deals **1.5×** | **PARTLY** — a plain 3-turn skip. **Does not wake on damage, and there is no 1.5× bonus.** Mechanically it is a longer Stun. |
| Blind | Reduces accuracy | **NOT BUILT** — nothing reads it. Applying Blind does nothing whatsoever. |

### **Status Resolution**

* Status effects are applied at the end of the action that caused them — **BUILT**
* The same status cannot be reapplied while active — it must expire first — **BUILT** (`applyAbilityEffects` checks for an existing entry)
* A creature can carry multiple different statuses simultaneously — **BUILT**
* Effects roll their configured `chance` — **BUILT**
* Resist Status trait reduces the chance of a status landing — **NOT BUILT.** The trait exists in the library; nothing reads it. *(Only `stat`-category traits have any effect at all — see `traits-system.md`.)*
* Freeze and Stun get a 1-turn duration; everything else gets 3 — **BUILT**, hard-coded in `applyAbilityEffects` rather than authored per ability.

---

## **MP System**

> **BUILT**, with the recovery numbers corrected.

* Abilities cost MP as defined on the ability object — **BUILT**
* MP does **not** regenerate naturally between turns — **BUILT.** This is a genuine attrition economy: MP is managed across a descent, not within a fight.
* MP stays drained after each encounter — **BUILT**
* Running out of MP limits a creature to Basic Attack (0 MP) — **BUILT.** A creature with no MP has exactly one option.
* Ability MP costs were cut ~40% across the board (max cost is now 7, was 12) for a healthier MP economy — **BUILT**

**Recovery sources:**

* **Rest points** — **BUILT**, and richer than the old "restore MP by 20%" line: a rest offers three choices — 50% HP to one creature, **full MP** to one creature, or 20% HP + 20% MP to the whole party.
* **Tower shops** — **BUILT** — full MP restore for Obols, alongside party heal and revive.
* **Items** — **BUILT** — Moonwater and others; see `systems/Items.ts`.
* **Traits (MP Up)** — a larger pool, not regen — **PARTLY BUILT.** `mp_up` is a `stat`-category trait, so it *would* work — but no code path ever grants a trait, so no creature holds one.
* **A boon granting per-battle MP recovery** — **NOT BUILT.** No such effect kind exists in `data/boons.ts`; if one is added it belongs in the boon layer, the only run-scoped modifier system.

---

## **Knockout and Revival**

> **BUILT.**

* At 0 HP a creature is **knocked out** for the remainder of that encounter — **BUILT**
* Knocked-out creatures stay down until revived by item, shop, or rest — **BUILT**
* If all three active creatures are knocked out, the **run ends** — **BUILT** (see Run Failure in the GDD)
* Revival restores a fraction of max HP, floored at 1 HP — **BUILT.** The floor matters: a low fraction against a low-HP creature otherwise rounds to 0, reviving someone straight back into a knockout.
* Revival **never lowers MP** — **BUILT.** A knockout only zeroes HP, so a creature felled at full MP keeps it; a revive must not become a penalty for whoever was carrying the most MP.
* Knocked-out creatures do not earn mark threshold progress — **NOT BUILT** (no mark system exists in any form)

---

## **Items in Combat**

> **BUILT.** Previously absent from this document entirely, despite being a root menu action.

* The `ITEM` submenu draws from the **shared backpack**, not per-creature inventories
* `usableIn` and `targeting` are **data on the item**, so no scene branches on an item id
* Consumption happens **only on a non-`refused` outcome** — an item that cannot do anything is refused rather than silently eaten
* **Smoke Husk** ends a battle as a **free action** (no enemy acts in response) and deliberately **records no species knowledge** — otherwise "enter, read the enemy, escape, re-enter informed" would be free scouting against the auto-combat fog. It is unavailable on boss floors, enforced structurally by `usableIn: 'combat_non_boss'`.

Escaping a battle lives here, and any future escape mechanic stays in this channel rather than becoming a menu verb.

Full item rules live in `expedition-items-pitch.md` and `systems/Items.ts`.

---

## **Boons in Combat**

> **BUILT.** Previously absent from this document.

Timed, run-scoped modifiers chosen at the post-battle reward offer. They take effect immediately — no backpack slot, no arming step — and expire after N battles.

* Effect kinds: **damage dealt**, **damage taken** (with a first-round-only variant), **Obol bonus**, **post-victory heal**
* **One boon per effect kind** may be active at once; re-taking a held kind refreshes duration rather than stacking magnitude
* Ticked down in `CombatScene` after every fight; surfaced on the run map with a countdown

There is deliberately **no MP-discount boon.** `ability.mpCost` is read raw in roughly thirteen places across `CombatScene` and `TacticsAI` — affordability, menu labels, Conserve MP's ceiling, Heal First's reserve, tiebreaks — and a discount missing any one of them would make auto-combat plan against a cost the player doesn't pay. Full rationale in the `data/boons.ts` header.

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

### **Auto-Combat Limitations**

* Auto does not use items from inventory — **BUILT**
* Auto does not use the Capture action — **N/A**, capture is not wired into combat at all
* Auto does not know enemy resistances until that species has been fought before — **BUILT.** `gameState.seenSpecies` records a species at **battle end**; recording at encounter start would mean the AI already knew it during the fight that introduced it, and the fog would never fog anything. ⚠️ Currently invisible, because the type chart is flat — there are no resistances to withhold.
* The player can toggle Auto off mid-battle and take manual control — **BUILT**
* **Battle speed** is a persisted preference (1×/2×/4×) scaling all combat pacing, with a 100 ms floor so animations and the message log cannot collapse into a single frame — **BUILT**

---

## **Enemy Encounters**

> **PARTLY BUILT.**

* Enemies use the same creature stat system as player creatures — **BUILT**
* Enemies have **variable ATK and HP** relative to their standard version — **BUILT**, and more aggressively than the old text implied: normal enemies get **STR/INT × 0.6** and **HP × 1.2**; bosses get **HP × 1.8** and **STR/INT × 1.15**. This is what keeps ordinary fights from being life-or-death.
* Enemy creatures do not have traits or marks — **BUILT** (trivially — neither system grants anything to anyone)
* Enemy AI targets a **random living party member**, spreading damage rather than focusing the lowest-HP creature — **BUILT**
* Single-target attacks **auto-target** when one enemy remains; target selection is only presented at 2+ enemies — **BUILT**
* Enemy difficulty scales by depth — **BUILT**, as `enemyLevels` from the encounter (`floor × 0.8` for combat; `floor × 1.0` or `× 1.2` plus 2 for mini/major bosses)
* Encounters field **1–3 enemies** — **BUILT.** Floors 1–3 generate 1–2; deeper floors 1–3; bosses field 2–3. *(`tower-structure.md` still says "1–5"; the code has never generated more than three.)*
* Boss creatures have **unique abilities not available to player creatures** and higher stat pools — **PARTLY BUILT.** The stat pools are real (see the boss multipliers above). The unique abilities are not — bosses are drawn from the same band pool as wild encounters and use the same generated `defaultAbilities`. There are no boss-exclusive species and no boss-exclusive abilities.

> ⚠️ **The difficulty curve was tuned against a 30-floor tower.** It needs re-checking
> against the alpha cap of 20 and the eventual 100. A run now ends roughly a third of the
> way up the curve it was designed for.

---

## **Open Questions**

### **Carried over, still open**

* Exact damage formula constants and scaling curves — requires playtesting
* Whether Heal First should hold its MP reserve across its buff/debuff rules, not just its damage rule — today it can spend on a debuff and then be unable to afford the heal the reserve exists to protect
* Whether Fight Wisely's "half current MP" budget drains too fast across a full descent
* Whether bosses have multiple phases or unique mechanics beyond stat inflation
* Specific crit-related trait effects and balancing

### **Raised by the V1/reality audit (2026-07-30)**

* **Do buff stages get durations?** Right now they last the whole battle and *stack* on reapplication, which makes buff stacking un-costed. Durations, diminishing returns, or an explicit "this is fine" decision — but not silence. This is the largest open mechanical question in combat.
* **Do Blind, Sleep-wake and Burn's ATK cut get built, or do those statuses get redesigned?** Three of six statuses are weaker than specified and one is entirely inert.
* **Is the flat type chart filled in?** It blocks nothing but shapes the next content task, and it is what currently makes the auto-combat knowledge fog invisible.
* **Do crits keep the buff-ignoring clause?** It was specified, never built, and nothing depends on it either way.
* **Does the enemy-count range stay at 1–3?** The code has never exceeded three; `tower-structure.md` promises up to five. Pick one.
