# **Hollow Kin — Run Texture: Events, Puzzles, Floor Themes, Combat Depth**

*Working Document — Subject to Change. Drafted 2026-07-29.*

> **Owns:** the event taxonomy (stated and unstated), the puzzle system, the Aspect/Condition floor-theme layer, and the shortlist of combat-depth mechanics.
> **Defers to the GDD on:** currency, what persists, capture rules. Defers to `tower-structure.md` on floor generation and boss cadence. Defers to `combat-system.md` on the damage formula and the existing status/buff sets.
> **Companions:** `docs/combat-depth-research.md` (prior art behind §4) and `docs/puzzles-in-roguelites-research.md` (prior art behind §2).

---

## **0. The problem this doc is answering**

Four of the project's own notes point at the same hole:

* `tower-structure.md`: *"depth changes enemy **level**, not enemy **variety**"* — bands 1 and 2 share an identical pool.
* `combat-system.md`: every creature's best turn is the same turn. There is no window to create, no state to exploit, no reason the order of three actions matters.
* `CLAUDE.md`: nine Mages are numerically near-identical.
* The Party Select screen is not yet a decision, because nothing about the coming run is known before you commit to it.

All four are the same bug: **the run has no texture.** Nothing about *this* descent is different from the last one except numbers. Events, puzzles and floor themes are three cheap textures; combat depth is the expensive one. This doc treats them as one design problem, because they share the same fix — **give the player something knowable in advance that changes what the right play is.**

The unifying rule for everything below:

> **Randomness in the setup, determinism in the resolution.** Vary what the fight *is* — pool, theme, composition, enemy intent — and stop varying how the fight *resolves*. A generic JRPG does the opposite: the same encounter every time, resolved with hit rolls.

---

## **1. Events — Stated and Unstated**

Today `RunGenerator.fillerType()` emits `'event'` at ~15% and nothing consumes it. That empty slot is the cheapest content surface in the game. Before filling it, the category needs splitting, because "event" is currently doing three unrelated jobs.

### **1.1 The five event classes**

| Class | Stated? | Player sees | Fires from | Example |
| ----- | ----- | ----- | ----- | ----- |
| **Choice** | Yes | A card, 2–3 options, costs and outcomes named | Floor is type `event` | A caged Kin: free it (uses a backpack slot) or leave it |
| **Wager** | Yes | Visible odds, one button | Floor is type `event` | Cursed shrine: 60% a relic, 40% the party starts the next fight at −1 DEF stage |
| **Condition** | Yes, passively | An icon on the floor card, before you commit | Drawn per floor / per band | *Conductive* — electric damage +30% for everyone (see §3) |
| **Latent** | **No** | An unexplained line in the log, then an effect | Run state crossing a threshold | Descend five floors without resting → *"Something below has noticed you."* Next combat floor adds one enemy |
| **Reactive** | No, then yes | A callback to a thing you did earlier | A flag set by a prior event | The Kin you freed on floor 4 arrives on the boss floor and takes one hit for you |

**Choice and Wager are the ones that go on the run map.** Condition is the floor-theme layer in §3. Latent and Reactive are the unstated layer — and they are where the game gets a personality, so they deserve the rules below.

### **1.2 Rules for unstated events**

Unstated events fail in one specific way: the player never notices them, and the design work evaporates. Three rules stop that.

1. **Observable, not explained.** Every latent event must produce a visible artefact — a log line, a sprite tint, an extra enemy, a sound. The player must be able to *tell that something happened* and be unable to tell *why*. That gap is the whole appeal. The combat log already exists; one unattributed line is the entire implementation cost.
2. **Unstated gives; stated takes.** A latent event may grant, re-flavour, escalate, or add an enemy. It may **never** silently remove Obols, items, creatures, or a run. Anything that costs the player something they were carrying must be a stated Choice or Wager, so the loss is attributable. This is the Slay-the-Spire perfect-information principle applied selectively: hide the *cause*, never hide the *bill*.
3. **Legible on the second run, not the first.** A latent trigger should be something a player can eventually name in a Discord post — "don't skip rests" — after three or four runs. If the trigger is unguessable, it is noise. Aim for triggers built from things the player is already tracking: floors since rest, Obols hoarded, captures carried, archetype monoculture in the party, MP left in the party, boss kills without a knockout.

### **1.3 Latent trigger candidates**

Each of these reads state that already exists. None needs new save fields.

| Trigger (existing state) | Effect | Reads as |
| ----- | ----- | ----- |
| 5+ floors since a rest | Next combat adds one enemy | The tower gets bolder when you don't stop |
| Obols hoarded past a threshold by floor 10 | A thief event replaces the next shop; it wants Obols, not items | Greed is noticed |
| Carrying a captured creature | Wild members of that species appear at a higher rate for two floors | The kin are looking for it |
| Party is single-archetype | That archetype's wild members open combat with one buff stage | Monoculture is legible to the tower |
| Party average MP under 25% | Enemy AI switches to its status-first priority | The tower can smell exhaustion |
| Boss cleared with zero knockouts | Next floor's shop stocks one item above its band | Competence is rewarded quietly |
| A species defeated 20+ times ever (persists) | That species sometimes flees on sight instead of fighting | The bestiary is a reputation, not a checklist |

That last row is the interesting one, because it is **cross-run** and reuses `gameState.seenSpecies`. It gives the game an unstated memory, which is exactly the flavour a permanent-progression collector wants and a roguelite normally cannot have.

### **1.4 What a Choice event should cost**

Obols are the obvious currency and the wrong default — they make every event a shop with a story attached. The interesting event currencies are the ones with no other market:

* **A backpack slot** — and therefore exposure to the wipe's single random loss.
* **A creature's HP or MP**, chosen by the player, spent before the next fight.
* **A status effect carried into the next combat** (one of the existing six).
* **A buff stage owed** — start the next fight at −1 of a stat.
* **A turn** — the next combat begins with the enemy acting first.
* **The floor itself** — skip this floor's reward to skip its fight.

Rule of thumb: **an event that only moves Obols is a shop. An event that moves combat state is an event.**

### **1.5 Recommended alpha scope**

Twelve Choice events and four Wagers, authored as data with a small effect vocabulary (grant relic / grant item / grant trait / set combat-start flag / modify next encounter / adjust Obols). Three latent triggers, chosen from the table above. Reactive events wait until Choice events exist to set flags.

---

## **2. Point-and-Click Puzzles**

The pitch is right, and the constraint — **never a progression gate** — is the correct one. The design risk is not the obvious one.

> **Correction, 2026-07-29.** An earlier draft of this section claimed that games attempting authored puzzles in a roguelite end up with either a novelty dead after one evening, or generated puzzles that are all the same puzzle with different numbers. That was asserted without evidence and **both halves are wrong.** The sourced record is in `docs/puzzles-in-roguelites-research.md`; the corrected version is below.

### **2.1 What actually goes wrong**

Authored puzzles in a run-based game do not die of staleness. *Blue Prince* (2025) is a roguelite made almost entirely of hand-authored puzzles: 92 on Metacritic, two million players, 15–25 hours to credits and roughly double that for full content. *Spelunky*'s hand-authored Hell chain — arbitrary, undiscoverable, identical every run — became its most durable content and still has speedrun categories a decade on. Authored puzzles inside roguelites work.

Two other things go wrong instead, and they are both directly relevant here.

**Failure 1 — solution-lookup collapse.** When a puzzle's answer is a global constant, the puzzle is consumed once *per community*, not once per player. Blue Prince's safe codes are identical in every save file for every player, which is why there are dozens of "all safe codes" guides. The puzzle does not die; it degrades into a completion checklist. Dodge Roll's fix in *Enter the Gungeon* is the cheapest known counter: the Resourceful Rat maze route is fixed for a given player forever, but **different for every installation of the game** — unspoilable once, rote afterwards.

**Failure 2 — knowledge/access desync, and this is the inverse of the intuitive worry.** The fear is that knowledge trivialises later runs. What actually happens in Blue Prince is that the player *has* the knowledge and the run generation will not hand them the chance to use it. Mark Brown's formulation: *"you've got A, but your house doesn't have a B."* One critic describes the phase change precisely — early randomness is protective, because a daily reset means you can never be permanently stuck, but *"the longer you play, the more likely it is that you know exactly what you want to accomplish, but the game simply prevents you from being able to do it until you have an unusually lucky run."*

**The critical property is that desync gets worse the more the player knows,** because the constraint migrates from cognition to luck. Any rare, randomly-offered puzzle encounter has this failure built into it. §2.6 is the mitigation, and it is not optional.

**On the procedural side, the accurate line is not authored-versus-generated.** Into the Breach is hundreds of hours of generated puzzles that are not the same puzzle twice. Generation works for **combinatorial** difficulty, which a solver can verify and score. It fails for **insight** difficulty — an unstated rule the player must intuit — because that rule *is* the authored content, and generating a new rule means generating a new game. The academic case is blunt about the mechanism: a puzzle generator optimises a proxy metric, and in "Baba is Y'all" the fitness function actively strips the decorative tiles human authors add for thematic reasons. The generator deletes precisely what makes a puzzle feel made.

### **2.2 The mechanism that works**

Every durable case in the record does the same thing:

> **Author the puzzle's *form*. Derive its *answer* from run state.**

* **NetHack, 1987.** Item appearances are randomised per game, so identity must be re-deduced every run. Price identification is a real procedure — sell, read the quote, cross-reference base-price tables, narrow, test. Forty years of wikis have not solved it, because there is nothing to write down except the method.
* **Caves of Qud.** Five procedural sultans per playthrough, each with procedurally composed histories, and that lore is the *key* to authored secrets. Note their anti-desync rule: the generator guarantees at least one history event per region, so the clue needed to open a given secret always exists somewhere in the run.
* **Noita.** Alchemy recipes are generated per world seed. The community defeated it out-of-band with seed calculators — but only by opting out of the game to do so.
* **Enter the Gungeon.** Per-install answer randomisation (above).

There is a **second** working pattern, from Spelunky: make the knowledge *free* and randomise the **execution**. The Hell chain is one wiki page; what never repeats is the terrain you have to perform it on.

And one cautionary miniature: Slay the Spire's **"Match and Keep!"** memory-match event is trivially defeatable by matching the same two cards five times, and it became a solved ritual almost immediately. A shallow authored minigame with **no run-state input** decays within a handful of encounters. The rest of Slay the Spire's combats — puzzles assembled from run state — hold up over thousands of hours. Same game, opposite outcomes, and the difference is exactly the run-state input.

### **2.3 Family A — Discoveries (finite, authored, permanent)**

A fixed set of hand-made puzzles. Each exists **once in the save file**, not once per run. Solving it removes it from the pool forever and records it in a collection screen.

* **Reward:** the permanent, cosmetic, identity-flavoured tier — variant/shiny palettes, a bound-mark voucher, a trait, a Creature Box decoration, a Monsterpedia entry.
* **Why it works:** it is a **collectible**, not a mechanic. Zero balance risk, zero farming, and the cost is pure authoring — 15–20 puzzles is a real feature for about the work of one boss.
* **Accept lookup collapse here.** Discoveries will be wikified, and that is fine: Blue Prince shipped two million players with globally-constant answers. If the appetite exists, the Gungeon trick is cheap insurance — derive a Discovery's answer from a hash of the **save file's seed**, so the puzzle is fixed forever for one player and different for the next.
* **Failure state:** none. Close it and it returns to the pool.

### **2.4 Family B — Reading Puzzles (repeatable, run-fed)**

The higher-value family, and the one the record actually endorses. A repeatable puzzle whose **inputs come from the run's own state** — so it is a different puzzle every time without being generated.

1. **Cipher plaque.** A sealed door shows a creature silhouette and asks for its weakness. The answer is only *available* if that species is in the player's bestiary. This is the NetHack pattern applied to `seenSpecies`: the method is learnable, the answer is not writable-down, and it makes the Monsterpedia a tool rather than a trophy case.
2. **Statue offering.** A statue wants a specific archetype, damage type, or a creature above a star threshold. The answer depends on **which trio was brought**, so it is re-solvable across runs and it makes Party Select matter.
3. **Sigil lock.** A rotating-ring or plate-order puzzle whose clues are drawn from the floors already descended — the Conditions passed, the bosses beaten, the order of archetypes fought. Rewards attention to the run rather than to the puzzle.

All three are **combinatorial, not insight-based**, which is the side of the line that survives repetition.

### **2.5 Design constraints for both families**

* **Never gate progression.** Reinforce it in the reward table: puzzles award cosmetics, relics, items and traits. They **never** award Essence, permanent levels, or depth-jumps. Blue Prince's own developer applies the same rule — *no individual puzzle is necessary to reach the ending* — and it is the reason its desync problem is survivable rather than fatal.
* **No time pressure and no fail state.** The game is turn-based; twitch and timers contradict the product. A puzzle abandoned mid-solve must be safe.
* **Zero combat cost.** Puzzles consume no HP, MP, or turns. Own encounter, always skippable, skip button on the first screen.
* **Respect the auto-battle player.** A real slice of the audience chose this game to *not* pay attention. Puzzles must be opt-in and must never be the cheapest source of any power.
* **Wide, not tall.** Broaden what a player can do or how their creatures look. Never a stat advantage unreachable by other means.

### **2.6 Anti-desync rules — non-negotiable**

This is the correction that costs the most and matters the most. A rare, randomly-offered puzzle encounter reproduces the Blue Prince failure exactly: the player knows what they want and the RNG will not offer it.

* **A found-but-unsolved Discovery moves to town and stays there.** Finding it in the tower is the random part; *solving* it must never be. This single rule removes the failure mode outright, and it gives town a reason to exist beyond shopping.
* **Guarantee the clue, Qud-style.** If a Reading Puzzle needs a bestiary entry the player does not have, either do not generate it, or have it ask about a species already in `seenSpecies`. Never author a dead puzzle.
* **Pity the offer.** If Discoveries are offered randomly, guarantee one within N runs of the last. Rare should mean *scarce*, never *withheld*.
* **Never make a Reading Puzzle the only source of anything.** Its answer depends on the trio brought, so it is by construction sometimes unanswerable. That is fine only while the reward is optional.

### **2.7 Where they live**

* **In the tower** — a new encounter type (`puzzle`), generated like an event. Rewards are **run-scoped**: a relic, an item, a trait drop. Short — 30 to 90 seconds. Reading Puzzles live here.
* **In town** — a persistent place holding the Discovery collection and any puzzle found but not yet solved. Rewards are **permanent and cosmetic**.

### **2.8 Open questions**

* Does a tower puzzle consume the floor, or sit on top of a shop/rest floor as a side door?
* Do puzzle rewards ride in the backpack (and risk the wipe's random loss), or bypass it? Recommendation: **bypass** — a cosmetic lost to a wipe is pure irritation with no interesting decision attached.
* Is per-save-seed answer randomisation on Discoveries worth the authoring constraint it imposes? It defeats wikis; it also means every puzzle must be *generated from a template*, which pushes Family A toward Family B and may make Family A redundant.
* Alpha Discovery count: 6 proves the shape, 15–20 is a shipping feature.

## **3. Floor Themes — Aspects and Conditions**

This is Reed's "the environment changed and that changes your encounters," and it is the highest variety-per-line-of-code available to the project. The prior art is Pokémon Mystery Dungeon's floor weather (symmetric, per-floor, type-keyed) and Siralim Ultimate's Realm Properties (drawn, previewed, deliberately *tilted* rather than symmetric). See `combat-depth-research.md` §9.2.

### **3.1 Two tiers, two jobs**

| Tier | Scope | Drawn | Shown | Job |
| ----- | ----- | ----- | ----- | ----- |
| **Aspect** | One depth band (10 floors) | At run start, for every band | On the **Departure screen**, before the party is locked | Make Party Select a real decision |
| **Condition** | One floor | Per floor at generation | On the **pick-next card**, before commitment | Make pick-next a real decision |

An Aspect does two things: it **weights the band's encounter pool** toward 2–3 archetypes, and it applies one broad rule for the band. A Condition is a single sharp rule for one floor. A floor can carry a Condition, no Condition, or (rarely) two.

Crucially, both are **previewed before the player commits.** That is where the gameplay is. A theme the player discovers on arrival is a difficulty spike; a theme the player sees on a card and chooses around is a decision.

### **3.2 The symmetry question**

Reed's instinct — the theme buffs the creatures *both* in your party and against you — is right, and it needs one safeguard. A symmetric buff is only interesting if the two sides can exploit it **unequally**. "Fire +30% for everyone" against a trio with one Fire creature and a room with three is not a decision; it's a tax.

Four safety valves, in order of value:

1. **Preview before commitment.** Non-negotiable. Both tiers.
2. **The player exploits better than the AI by construction.** A theme buffs a *damage type*; the player picks which of four abilities to use, the enemy picks from a fixed kit. That asymmetry is built in and is what makes symmetry fair.
3. **Pair the buff with a cost the player can dodge and the enemy can't** — chip damage that spares specific archetypes, so the trio can be built immune while the room bleeds.
4. **Cap magnitude well below "unwinnable," and never zero out a kit.** With a locked party and no mid-run swap, a floor that nullifies a trio's only damage type is a run-ender the player did not choose. `±30%` and `+1 stage` are the right order of magnitude. Hard nullification is banned.

### **3.3 Condition candidates**

Every one of these is expressible with systems that already exist — type multipliers, buff stages, the six statuses, MP costs, turn order. No new combat state.

| Condition | Rule | What it changes about the fight |
| ----- | ----- | ----- |
| **Conductive** | Electric damage ×1.3 both sides; Mecha act first regardless of SPD | Turn order becomes archetype-dependent |
| **Grave-Chill** | Ice ×1.3 both sides; Freeze lasts +1 turn; all healing −25% | Punishes heal-reliance, rewards ice trios |
| **Static Bloom** | All MP costs −1 (floor 1); **crits disabled** | A rest floor in disguise — and it prices the player's crit investment |
| **Iron Rain** | Physical ×1.25, magic ×0.75, both sides | The clearest party-comp answer in the set |
| **Sour Air** | No status effects can be applied by either side | Kills status builds for one floor; raw damage shines |
| **Thin Air** | SPD buff/debuff stages count double | Makes the ±3 SPD stage the most valuable stage on this floor |
| **Hollow Hunger** | End of each round, every combatant loses 5% max HP; Rock and Mecha immune | Chip damage the player can build immune to (valve 3) |
| **Echoing** | The first ability each creature uses in a fight costs 0 MP, but that creature may not repeat it this fight | Forces kit variety; directly feeds the MP economy |
| **Gilded** | Enemies drop +50% Obols and start at +1 DEF stage | Push-your-luck at the floor scale |
| **Rot** | Poison ticks twice per round; Flora immune | Same shape as Hollow Hunger, different answer |

### **3.4 Aspect candidates**

Aspects are coarser and pool-facing.

* **Kin-Sworn** — every enemy in this band is a single archetype. Instantly turns eight archetypes into eight distinct band flavours from the existing roster, and makes the pre-run party choice sharp. (Risk of Rain 2's *Artifact of Kin*.)
* **Swarm** — enemy counts run 3–5 instead of 1–3, at ~60% HP. Multi-target abilities become the pick; single-target trios struggle. No new content.
* **Hollow Court** — every combat includes one support enemy (heals or buffs) that must be killed first. Turns "kill in any order" into "kill in the right order."
* **Rimebound / Emberbound / Stormbound** — pool weighted to two archetypes, plus that band's matching damage type ×1.2 for both sides. This is Reed's original "next run is electric, ghost, golem" example, expressed as a draw.
* **Thin Veil** — mini-bosses appear on every 5th *and* every 3rd floor; Obols and Floor-Mark progress up accordingly. (Hades' *Middle Management*.)

### **3.5 Where themes plug into what already exists**

* **Marks get a source of specific accomplishments.** The Ice Mark already reads *"defeat the first section boss with an all-ice team."* Conditions generalise that pattern for free: *clear a Conductive floor with no Mecha in the party*, *clear a Sour Air boss*. `marks-catalog.md` can grow without new mechanics.
* **Relics get conditional text.** *"+20% damage on Conductive floors"* is a new relic axis at zero engine cost.
* **Traits get a reason to be situational** rather than flat stat bumps.
* **The Gatekeeper gets a second product.** Sell a **descent modifier** — the player chooses a harder Aspect set for a better Obol→Essence conversion. Player-authored difficulty is the pattern with the best track record (Hades' Pact, Risk of Rain's Artifacts) because it sidesteps the "modifiers feel imposed on me" complaint entirely, and it slots straight into the existing Essence economy.

### **3.6 Band composition — the free half of this section**

Separate from themes and even cheaper: **stop letting depth be a pure stat multiplier.** `RunGenerator.makeEncounter` currently varies enemy count by `floor <= 3` and nothing else. Band-level composition rules cost nothing and produce genuinely different fights from the same 30 creatures:

* Band 1: 1–2 enemies. Teaching.
* Band 2: 3–5 weaker enemies. Multi-target abilities become relevant for the first time.
* Band 3: paired enemies with a support that must die first.
* Band 4: one high-HP enemy plus adds that respawn.

This is pure data, it is the single cheapest item in this entire document, and it addresses the exact complaint in `tower-structure.md`.

---

## **4. Making Combat Non-Generic**

Full survey with sources: `combat-depth-research.md`. This section is the recommendation.

### **4.1 The diagnosis**

Generic turn-based combat has one signature: **every turn's best action is the same action.** Hollow Kin currently has that signature, and for a specific reason — there is no *state* on the enemy or the queue for the player to create and then exploit. Damage, accuracy, crits, buff stages and statuses are all present and all independent. Nothing compounds.

Two existing rules are unusually strong assets and are both under-used:

* **MP does not regenerate.** This is a genuine attrition economy and almost no turn-based game commits to it. Today it has exactly one interaction: *spend it or don't.* An attrition resource only generates decisions when there are competing ways to **convert** it and to **recover** it.
* **Per-creature, non-inferable resistances with no archetype type chart.** This is validated prior art — Monster Sanctuary (same party size, same genre) does exactly this, and the stated reason it stays fresh is that weaknesses are *not* guessable from appearance, which makes the bestiary the reward for engagement.

One existing rule is a liability: **crits are pure variance with no decision attached.** In a roguelite whose randomness budget is already spent on floor generation, encounter pools, shops and the wipe loss, in-fight variance is the wrong place to spend more.

### **4.2 Recommended spine — three additions, alpha**

Chosen for impact ÷ cost against the existing architecture, and chosen so they compose rather than compete.

**1. Technical damage — a `(status, damageType) → bonus` table.**
Hitting a creature that is *already* suffering a status with a specific damage type deals bonus damage. Burn hit by wind. Freeze hit by physical. Sleep hit by anything. Persona 5 Royal's system.

* It makes the six existing statuses **non-redundant** overnight. They stop being chip damage and become **setup**.
* It supplies exploitable weakness **today**, authored once as a rule, without filling in a 30-creature resistance matrix. That matrix should *not* be the next content task.
* It gives a trio a reason to act in a particular order — the debuffer before the striker — which is the thing a locked three-creature party most needs.
* Auto-battle can play it well (*"if any enemy has a status my kit exploits, exploit it"*), so it improves trash pacing too.
* **Requires a UI tell.** P5R prints `TECHNICAL` on the ability list. Without that the depth is invisible.

**2. Turn-queue bonus slots, MP-flavoured.** *(Trails / Kiseki's battle-order bonuses.)*
Decorate the existing sorted turn queue: future slots carry visible bonuses — **restore 30 MP**, guaranteed status, reduced capture cost, bonus Obols. Both sides can land on them.

* This is the only mechanic on the list that converts the no-regen MP rule **from a restriction into a puzzle.** Today MP scarcity has one strategy: cast less. Bonus slots give it a second: *fight for the refill.*
* It makes the ±3 SPD stages and Haste strategically live — an SPD debuff is no longer "slightly worse," it's "you lose the MP slot to their healer."
* It gives the capture action a timed window instead of a spam.
* It is legible under auto-battle, which matters more than it sounds: the player *watching* auto grab an MP slot reads the AI as intelligent. That is the actual requirement for "auto-battle that still feels like a decision."
* Implementation is a decoration on the existing queue plus a few position-swap effects. No new state machine.

**3. Enemy intent display.** *(Slay the Spire.)*
Show each enemy's next action before the player acts — attack and its damage, buff, status, heal.

* It is what makes **Defend** and the **±3 debuff stages** worth using. A −ATK debuff is an abstract good today; with intent it becomes *"that 40 becomes 28, which my Rock survives."* Same code, far better decision.
* It moves the loss from "the black box killed me" to "I misplayed," which is the whole reason Slay the Spire's combat holds up.
* It upgrades `TacticsAI` visibly: *Fight Wisely* can heal **before** the hit instead of after.
* **One conflict to resolve.** Enemy AI currently targets a random living party member. Showing "will attack" but not whom is incoherent with intent. Recommendation: **commit the target when the intent is displayed** — random *selection*, telegraphed *result*. Randomness stays, but it happens before the decision instead of after it.

### **4.3 Then, in order**

4. **Locks on elites and bosses only.** *(Sea of Stars.)* A charging boss attack displays required damage types plus a turn countdown; breaking all of them cancels it, breaking some weakens it proportionally. This is what makes the 5/10-floor boss cadence **structurally** different rather than statistically different — which the cadence currently promises and does not deliver. It also monetises MP scarcity as a real decision: *spend three casts to cancel this, or eat it and keep MP for four more floors.* Authoring lock sets for six bosses is trivial next to a 30-creature resistance matrix. Copy the partial-break scaling as the safety valve, and guarantee any lock set is at least partly defusable by any legal trio.

5. **Band composition rules** (§3.6). Pure data. Do this first if the appetite for engine work is low.

6. **Intra-round combo counter.** *(Monster Sanctuary — same party size, same genre.)* Actions within a round build a counter that multiplies later actions in the same round; buffs and heals also build it, so defensive play still participates. It is the cheapest way to make **ordering** matter with only three creatures.

7. **A `Conserve for the Descent` tactic.** Never cast above X% of remaining MP; prefer basics; accept longer fights. Every Dragon Quest tactic optimises the *current battle*; none of them expresses the *roguelite* layer. This one does, it costs almost nothing, and it is a genuine differentiator for the auto system.

### **4.4 Do not build**

* **Do not stack turn-economy systems.** Press Turn, Octopath's Boost, Bravely's Brave and Baton Pass all solve the same problem. Two at most; ideally one. Straight Press Turn is also arithmetically hostile here — three creatures against up to five enemies means being outnumbered in *actions*.
* **Do not add timed inputs.** They are irreconcilable with the auto-battle pillar: mandatory makes auto a trap, optional makes them pointless. Shadow Hearts shipped an auto-ring accessory and a large share of players used it. If any of this family is ever wanted, the only clean version is upside-only timing on the **basic attack** with auto taking the average result — which at least buffs the MP-free action.
* **Do not gate statuses behind matched physical/magic resources** (Divinity: Original Sin 2). It forces mono-damage parties and makes alpha-strike lockdown the only strategy. A locked trio makes that known flaw strictly worse than it was in the game that shipped it.
* **Do not implement Bravely's BP debt.** Trash fights degenerate into turn-one alpha strikes, and a four-action turn is a savage MP spike in a no-regen economy.
* **Do not fill in the 30-creature resistance matrix as the next content task.** A rule-driven axis (Technical, Locks) delivers exploitable weakness sooner and does not need rebalancing thirty times.

### **4.5 One change to something already built**

**Make crits conditional and deterministic instead of probabilistic.** Crit when the target is suffering a Technical-eligible status; crit at the end of a combo chain; crit against a locked-out boss. Same feel, full accountability, and it converts a random number into **a thing the player does** — which is the entire trick. It also preserves the player-only asymmetry, which is a good rule worth keeping.

---

## **5. Sequencing**

Ordered by value ÷ cost. Everything in tier 1 is data or near-data.

**Tier 1 — data and content, no engine risk**

1. Band composition rules (§3.6)
2. Condition and Aspect data, plus one modifier hook in `CombatEngine` and one badge on the pick-next card (§3)
3. Twelve Choice events and four Wagers over a small effect vocabulary (§1.5)
4. The `Conserve for the Descent` tactic (§4.3.7)

**Tier 2 — the combat spine**

5. Technical damage table plus its UI tell (§4.2.1)
6. Turn-queue bonus slots (§4.2.2)
7. Enemy intent, with committed targeting (§4.2.3)
8. Conditional crits (§4.5)

**Tier 3 — depth and flavour**

9. Locks on bosses and elites (§4.3.4)
10. Three latent event triggers (§1.3)
11. Puzzle encounter type plus six authored Discoveries, with the §2.6 anti-desync rules (§2)
12. Gatekeeper descent modifiers (§3.5)

---

## **6. Open Questions**

* **Aspect draw visibility.** Are all ten band Aspects shown at departure, or only the band being entered? Showing all makes the run plannable and Party Select decisive; showing one preserves discovery. Recommendation: show the next **two** bands.
* **Can a Condition apply to a boss floor?** A Sour Air boss is a great fight and also a possible unwinnable one. Recommendation: yes, but from a restricted, non-nullifying subset.
* **Does Technical grant a bonus action, or only bonus damage?** P5R grants both. Bonus damage alone is far safer with three creatures against up to five enemies.
* **Do bonus turn-queue slots apply to enemies?** Symmetry is more interesting; asymmetry is safer. Recommendation: yes for enemies, but enemies never draw the MP-restore slot — they have no attrition economy to relieve.
* **How does intent interact with the 1–5 enemy range?** Five intent badges on a 960×640 canvas is a real UI problem. It may force smaller encounter sizes, which is not obviously bad.
* **Puzzle rewards and the wipe loss** (§2.6).
* **Do latent events ever surface an explanation?** A "Tower Lore" page in town that unlocks the trigger text after it fires three times would convert an unstated event into a discovery. Tempting; also the exact thing that turns mystery into a checklist.
