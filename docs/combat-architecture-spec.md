# Hollow Kin — Combat Architecture Specification

> **Status:** Approved implementation target  
> **Authority:** Governs the combat rewrite until its decisions are reconciled into `game-design-document.md` and `combat-system.md`.  
> **Purpose:** Define the stable combat foundation, extension points for encounter-specific rules, and boundaries required before implementation planning.

## Decision Labels

- **Confirmed:** Explicitly accepted and safe to plan against.
- **Provisional:** Strong direction supported by discussion, awaiting its architecture question.
- **Open:** Must be decided before implementation.
- **Deferred:** Deliberately excluded from the first combat prototype.

## Executive Summary

Hollow Kin should have a **stable, learnable combat core** that players can master across a long tower ascent. Selected elites and bosses then add one encounter-specific rule that bends this core without replacing it. Late-game bosses may combine rules the player has already learned.

The current direction is:

- **Pack Tempo** as the universal combat foundation;
- exact enemy moves and targets revealed at round start;
- move sequencing and persistent MP management as the ordinary battle challenge;
- **Omen**, **Break**, and **Weave** as optional encounter-rule modules rather than permanent cognitive load;
- normal encounters that reward system mastery instead of continually threatening to end a run;
- bosses that teach unfamiliar rules in survivable, legible ways before demanding mastery.

This structure is intended to create the rhythm:

> Familiar combat → encounter bends a known rule → player experiments → feedback explains the result → knowledge becomes mastery.

## Existing Constraints to Preserve

These are inherited from the current game and prior discussion unless explicitly reopened:

- Combat is pure turn-based. A grid is not part of the universal combat foundation.
- The expedition party contains three Kin and does not swap members during the run.
- Captured Kin are cargo, not reinforcements.
- The player-facing root actions remain `FIGHT / MAGIC / ITEM`.
- Basic Attack remains a reliable zero-MP action.
- Moves consume MP, and MP persists between encounters.
- HP, knockout state, items, and recovery create expedition-level attrition.
- Smoke Husk and other escape behavior remain item-driven.
- Auto-combat remains a supported way to clear understood or low-risk encounters.
- Run-scoped boons already exist; run-long relics should extend the same modifier layer.
- Traits are permanent creature properties.
- Marks are unresolved and no combat architecture may depend on one of the competing Mark models.
- Alpha values are tuning parameters, not architectural requirements.

## Architecture Goals

1. Make the best move change because of timing, party sequence, enemy behavior, or encounter rule.
2. Let skilled players clear ordinary encounters efficiently without the game countering mastery by making fodder tedious.
3. Make bosses memorable through authored rules rather than inflated HP and damage alone.
4. Keep unfamiliar mechanics legible and recoverable on their first appearance.
5. Preserve expedition-level decisions about HP, MP, items, recovery, and departure.
6. Give move learning and advancement meaningful tactical consequences beyond larger coefficients.
7. Support manual play and understandable auto-combat through the same combat rules.
8. Allow new boss mechanics to be added without rewriting the base turn engine.

## Non-Goals

- Every encounter does not need the same mechanical complexity.
- Every boss mechanic does not need to be active in ordinary combat.
- The system does not need positional tactics to create battlefield variation.
- Normal encounters do not need to threaten a full-party wipe whenever the player makes one imperfect decision.
- The first implementation does not need the complete move, relic, Mark, Instinct, Afterform, Omen, Break, and Weave catalogs.
- Encounter rules should not silently invalidate a legal party composition.

## Proposed Complexity Tiers

| Encounter tier | Expected rules | Purpose | Status |
| --- | --- | --- | --- |
| Normal | Stable core only; occasional gentle preview of a future rule | Efficient mastery, attrition, move practice | Confirmed |
| Elite / mini-boss | Stable core plus one simplified encounter rule | Teach and test a mechanic | Confirmed |
| Major boss | Stable core plus one fully expressed encounter contract | Authored mastery test | Confirmed |
| Late major boss | Stable core plus one advanced rule or two previously learned rules | Synthesis without surprise overload | Confirmed |

## Stable Core: Pack Tempo

Pack Tempo is a small party-wide combat resource earned through skillful actions and spent to manipulate the order of actions the party already owns. It does not grant unlimited turns or turn ordinary battles into a long resource-combo ceremony.

### Confirmed turn structure

- every living combatant receives one action per round;
- SPD creates the initial interleaved order;
- exact enemy moves and targets are selected and revealed when the round is built;
- enemy intentions remain locked for that round unless a clearly described move or encounter rule changes them;
- deterministic critical conditions replace random critical rolls;
- formerly high-crit moves become **Keen**, with easier or broader critical conditions;
- Pack Tempo may reorder unused allied actions but may never create an additional action;
- when an ally is pulled forward, its original timeline entry is removed.

Exact intentions serve two purposes: they make Pack Tempo a planning tool, and they teach the player how advanced mechanics such as Omens or weather disruption relate to an incoming action.

### Full Pack Tempo rules

The intended system must be specified in full before a reduced prototype is planned. The current complete proposal is:

#### Resource lifecycle

- Pack Tempo begins at zero and caps at three;
- Tempo persists between rounds of the same battle;
- Tempo clears at battle end;
- Traits, relics, boons, Instincts, Afterforms, items, or encounter rules may explicitly change starting Tempo, the cap, generation, or legal spending, but the base engine assumes none of them do.

The cap may be tuned, but no modifier may violate action conservation: **a player-controlled Kin can never receive more than one action in the same round**. A rule may reorder, strengthen, transform, redirect, or add effects to that action; it may not create a second action. Bosses that need multiple beats should use a multi-effect move, multiple targetable parts, or multiple combatants rather than granting a player Kin another turn.

#### Generation

- A Kin may contribute no more than one Tempo per round, regardless of how many triggers the same action satisfies.
- A successful action may generate Tempo by exploiting a known weakness or authored status interaction.
- A successful conditional critical may generate Tempo.
- A move or Instinct may carry an explicit Tempo-generation condition.
- An encounter rule may award Tempo for accomplishments such as fully disrupting an Omen or Breaking a target.
- Misses, passive damage ticks, post-action damage-over-time, and ordinary item effects do not generate Tempo unless their data explicitly says otherwise.
- The command preview must disclose when a selected move is expected to generate Tempo from currently known information.

#### Universal spend: Relay

- After an allied action and all of its immediate effects resolve, the player may spend one Tempo to **Relay**.
- Relay pulls any living ally that has not acted this round to the front of the timeline.
- The pulled ally still receives exactly one action, and its old timeline position is removed.
- A pulled ally may generate Tempo and Relay again, allowing a chain when the party has enough Tempo.
- Relay cannot select an ally that already acted, is knocked out, or has no remaining timeline action.
- If every ally has acted, Tempo remains banked for a later round.
- Encounter modules, relics, and Afterforms may add authored alternative spends, but Relay is the only universal spend.

#### Sequence safeguards

- Ordinary encounters do not secretly counter an efficient player sequence. Mastery should make understood fodder fast.
- Elites and bosses may use visible safeguards such as Pattern Hunter, reactive wards, changing forms, or Omen requirements.
- Safeguards respond through authored and telegraphed rules rather than hidden difficulty adjustment.
- No safeguard may erase an already-earned action without communicating that risk before the player commits the relevant move.

The initial values are a cap of three, a cost of one for Relay, and at most one Tempo generated by each Kin per round. Magnitudes may be revisited through an explicit architecture revision, while action conservation is an invariant.

### Enemy sequencing

Enemies use the same SPD timeline and one-action-per-round rule. Their exact move and target are committed at round start. They do not require a universal player-style Tempo meter to participate in the core flow.

This is not a declaration that enemies can never use Tempo. Enemy moves may alter SPD or the future timeline, and authored encounters may steal, block, react to, generate, or spend Tempo through clearly telegraphed module rules. A particular boss may even own an enemy sequencing resource. The boundary is that ordinary enemy turns do not depend on a second hidden Tempo economy.

The turn structure, critical model, Tempo generation, and Relay rules are **Confirmed**.

## Encounter-Rule Modules

Encounter rules are optional modules layered over the stable core. A module may own additional state, telegraphs, UI, AI considerations, move interactions, and metrics, but it may not replace basic action legality or independently run a second combat engine.

### Omen

A dangerous enemy action telegraphs both its consequence and the move tags that weaken or cancel it. Partial answers matter. Intended primarily for elites and bosses.

Omen owns **action prevention**, not the general vulnerable state:

- the exact incoming action and target are already visible through the stable intent system;
- an Omen adds a short set of move-tag requirements to that action;
- satisfying some requirements weakens the action proportionally;
- satisfying every requirement before resolution cancels the action;
- solving an Omen contributes substantial Break pressure when Break is also active;
- only one Omen may be active across the enemy party at a time;
- an Omen initially carries no more than three pips;
- each allied action removes at most one pip unless its move or augment explicitly says otherwise;
- each removed pip proportionally weakens the action, while removing all pips cancels it;
- the exact partial-effect curve and final tag vocabulary remain content and tuning questions.

#### Omen timing modes

Omen supports two authored timing modes. The mode is part of the visible telegraph.

**Charged Omen — standard:**

- the enemy spends its current action declaring and charging the Omen;
- the Omen resolves instead of taking a new action on that enemy's next turn;
- the natural timeline therefore gives every living Kin one opportunity to answer between declaration and resolution.

**Immediate Omen — deadly boss variant:**

- the boss begins charging during the round-start intent phase rather than spending its previous turn;
- every living Kin receives its one action for that round;
- the boss resolves the Omen after those allied actions in the same round;
- this does not grant the boss an additional action, but it allows the boss to threaten an Omen every round instead of every other turn;
- Immediate timing must be identified before the player commits any action and is reserved for encounters authored around the higher pressure.

### Break

Coordinated actions deplete a target’s guard or resolve and create a temporary vulnerable window. Break may be coupled to Omen or used independently on particular encounters.

Break owns **the damage opportunity**, not action prevention:

- qualifying moves apply Break pressure to a visible enemy resource;
- reaching its threshold creates a temporary Exposed window;
- Break does not automatically cancel the currently telegraphed action;
- Omen completion may contribute heavily to Break without guaranteeing it;
- Exposed lasts through the end of the following round and then the Break resource resets;
- the first damaging move from each Kin against that Exposed target is a guaranteed critical;
- later damaging moves during the same Exposed window receive a modest universal damage bonus but must satisfy their authored condition to critical;
- guaranteed Break criticals are tracked per attacking Kin and target for that Exposed window;
- the enemy continues acting normally unless Omen, status, knockout, or another explicit rule stops it;
- the threshold, pressure values, later-hit damage bonus, and whether all module-bearing enemies can be Broken remain tuning and content questions.

The Omen/Break separation is approved as the starting architecture but carries a mandatory balance checkpoint. If playtesting shows that two visible progress systems are redundant, cognitively expensive, or always completed together, they may be merged or one may be removed from an encounter. Future agents must treat that as a planned validation point rather than assuming the first implementation is final.

### Weave

Moves contribute Echoes to a short recipe that creates a Field Reaction. Weave is used on selected encounters rather than all combat.

- the player and enemy sides each own a separate three-slot Weave;
- hostile moves generally add Echoes to the target side;
- support, stall, cleanse, and manipulation moves generally affect the user's side;
- the player can build harmful reactions against enemies while clearing, delaying, or transforming reactions forming against the party;
- Echo recipes are unordered;
- seven Echo types produce 84 possible three-Echo combinations with repetition, and the complete target catalog gives every combination a reaction;
- an augment, Instinct, Trait, Afterform, or other authored modifier may add one bonus Echo to an action and thereby unlock a curated subset of secret four-Echo reactions;
- the architecture does not require content for all 210 possible unordered four-Echo combinations;
- an action ordinarily adds one Echo regardless of hit count or number of targets;
- modifiers may add at most one bonus Echo to that action, for a maximum contribution of two; multiple eligible bonus-Echo sources do not stack;
- Basic Attack contributes Force; an item contributes an Echo only when its definition explicitly says so;
- the action's base and bonus Echo are contributed atomically, then the completed recipe resolves;
- three Echoes produce the ordinary reaction and clear those slots;
- when an action would bring the field from two Echoes to four, the game checks the curated secret four-Echo catalog. A match resolves all four; otherwise the two existing Echoes plus the action's base Echo resolve normally and the bonus Echo becomes the first slot of the next Weave;
- moves and augments may add, remove, replace, preserve, or suppress Echoes, so there is no universal Stall command;
- undiscovered recipes preview as `???`; once discovered, their exact reaction is permanently recorded in the Monsterpedia;
- there is no universal Attune command and no ability that pauses a completed recipe merely to wait for a fourth Echo.

#### Weather boundary

Weather is not a default output or required layer of the Weave system. Echoes already provide the short-lived field manipulation and reaction puzzle.

Weather remains available as an optional, encounter-authored mini-boss or boss rule:

- Weather is one visible global condition that persists across multiple actions or rounds;
- it changes one clearly stated part of the encounter, such as empowering an Echo family, transforming one reaction, or altering how a boss intent may be disrupted;
- selected Field Reactions may dispel, replace, or exploit that Weather when the encounter teaches the interaction;
- ordinary Weave encounters do not generate Weather from every recipe;
- only one Weather may be active, and a new Weather replaces the old one.

This keeps the jobs distinct: **Echoes are the party's short recipe; Weather is the encounter's persistent rule.**

### Teaching and permanent knowledge

A new encounter module first appears in a survivable elite or mini-boss context before a major boss demands mastery.

- the first demonstration uses the stable exact-intent system and additional module-specific telegraphs;
- failure to answer the new rule may hurt, but must not create an unavoidable run-ending result from information the player could not possess;
- cause and effect are explained in the combat log and UI immediately;
- discovered Omen rules, Break behavior, Weave recipes, weather interactions, and similar mechanics enter the Monsterpedia permanently;
- later encounters may assume recorded knowledge and demand stronger execution;
- late bosses may combine at most two previously taught modules unless a future architecture revision raises that limit.

### Other Candidate Modules

- Pattern Hunter: telegraphed safeguards against repeating the same party sequence.
- Breakable Parts: optional targets disable boss capabilities.
- Changing Forms: behavior changes in response to player actions.
- Tempo Thief: an authored boss contests the Tempo resource.
- Echo Boss: repeats or transforms the party’s previous sequence.
- Ritual Clock: a visible threat advances unless delayed by particular actions.
- Linked Enemies: multiple bodies share or transfer capabilities.
- Escalating Grudge: the boss adapts to the Kin currently dominating it.
- Resource Bargain: the player chooses a cost or grants the boss a new advantage.
- Weather: a persistent, visible mini-boss or boss condition that selected reactions can exploit or disrupt.

These candidates are **Deferred** until the stable core and the first two modules have been proven.

## Combat Layers and Cognitive Budget

The architecture must give each progression system a distinct job. The current hypothesis is:

| Layer | Intended cognitive role | Status |
| --- | --- | --- |
| Moves | Active tactical decisions | Confirmed |
| Pack Tempo | Universal sequencing resource | Confirmed |
| Encounter rule | Temporary fight-specific puzzle | Confirmed |
| Traits | Mostly quiet, permanent power and identity | Confirmed |
| Instincts | One memorable authored trigger per Kin | Confirmed |
| Timed boons | Short-duration run modifiers, usually simple | Confirmed as an existing system; future effect scope open |
| Relics | Run-long build rules, more conditional than boons but summarized by the UI | Confirmed |
| Marks | Mystery, accomplishment, or permanent unlock layer; never required for base Tempo | Confirmed boundary; catalog deferred |
| Afterform | Rare battle climax that changes move or Tempo rules without adding actions | Confirmed boundary; catalog deferred |

The player should not need to mentally recompute several conditional bonuses before every ordinary action. Traits remain mostly passive and easily summarized. Instincts get one visible trigger per Kin; relics may be more conditional, but the command preview must summarize any currently relevant change. Timed boons stay simple. Marks and Afterforms are optional extension points rather than dependencies of the stable core.

## Move Architecture

The current game equips up to four Abilities plus Basic Attack. The new architecture keeps that capacity but changes how the loadout develops.

### Confirmed loadout shape

- Every Kin begins an expedition with exactly two equipped moves plus Basic Attack.
- One starting move comes from the Kin's **role** pool and one from its **archetype** pool rather than from a species-exclusive signature system.
- Before departure, the player selects one unlocked compatible augment and attaches it to either starting move at no run-resource cost.
- The departure augment lasts only for that expedition. The catalog of available augment options is permanent; the attachment is not.
- Two move slots begin empty and are filled during the expedition.
- A Kin may equip no more than four moves. Basic Attack remains outside those slots.
- Each equipped move may carry at most one augment. A full party may therefore eventually carry up to twelve move augments.
- A move learned during the expedition begins unaugmented. A later Growth choice may attach an augment to it.
- Move selection UI must present the attached augment as part of the move, not as a separate passive the player must remember elsewhere.

Species identity does not require a unique signature move. It may instead emerge through base stats, role/archetype combination, Traits, Instinct, move-pool weighting, and Afterform.

### Confirmed growth grammar

A Growth choice performs one of three operations:

1. **Learn:** place a new move into an empty slot, or replace an equipped move when all four slots are full.
2. **Advance:** replace a move with the next authored member of its line, such as Bash → Smash → Thrash, in the same slot.
3. **Augment:** attach or replace the move's single augment.

An augment follows its move when that move Advances. Advancing changes the move itself; it does not leave both Bash and Smash in the same slot or grant an additional combat action.

### Confirmed growth cadence

Temporary level-ups may occur too frequently to own move growth. They continue to affect temporary statistics unless separately redesigned.

After every five-floor guardian—mini-boss or major boss—**each Kin receives one guaranteed Growth choice**. The UI should present this as one party-growth sequence rather than mixing three required drafts into the ordinary three-card recovery/reward offer.

This produces a dependable build cadence tied to the tower's existing boss breaks. Rare Training rewards, events, or relics may grant additional Growth later, but the ordinary post-battle offer is not responsible for delivering the core move system.

### Growth Draft construction

Each Kin receives three distinct, legal choices when Growth occurs:

- while the Kin has fewer than four equipped moves, at least one choice is **Learn**;
- when a legal advancement or open augment attachment exists, at least one choice is **Advance** or **Augment**;
- the remaining choice is a wildcard drawn from legal Learn, Advance, and Augment options;
- role and archetype define the natural pool;
- explicit Breeder biases modify offer weights;
- duplicate, incompatible, already-owned, and otherwise unusable choices are removed before the draw.

The player may decline Growth without compensation. Declining is preferable to forcing an unwanted replacement or build direction.

#### Offer fatigue

The run records when a specific Advance or Augment option is shown and not selected. After the same option has been rejected three times, it is substantially deprioritized in later Growth Drafts for that Kin.

This is a soft weight reduction, not a permanent ban. A rejected option may still appear when guarantees or a small legal pool require it. The threshold and exact multiplier are tuning values; the architectural rule is that repeated rejection becomes offer-generation input.

Offer fatigue is tracked only for the current expedition. It does not permanently teach the game that the player dislikes an option, and it does not reduce the weight of a different augment merely because it belongs to the same move.

### Advancement graphs

Move advancement is represented as a graph rather than assuming every line is permanently linear. Initial content may primarily use simple lines such as Bash → Smash → Thrash, but a move may eventually offer multiple authored successors such as Smash → Thrash or Quake.

Advance replaces the current move in its slot and carries its attached augment when compatible. An incompatible augment must be clearly identified before confirmation and either replaced through the same choice or prevent that advancement from being offered; it may not silently disappear.

### Learning at full capacity

When a Kin with four equipped moves selects Learn, the player chooses one equipped move to forget and confirms the replacement. The forgotten expedition move and its attached augment disappear from the current run. Permanent move and augment unlocks remain untouched.

The newly learned move begins unaugmented. Basic Attack is outside the move slots and can never be selected for replacement.

### Permanent knowledge versus expedition expression

The architecture distinguishes between **what options have been permanently unlocked** and **what the current expedition has done with them**. The exact contents of the permanent side are still being resolved.

| Permanent knowledge | Expedition expression |
| --- | --- |
| Role and archetype eligibility | The two starting moves selected for this expedition |
| Move roots unlocked through an approved permanent source | Moves learned into the third and fourth slots |
| Compatible augment options unlocked through an approved permanent source | The free augment selected before departure and augments gained during the run |
| Breeder-authored move-draft biases | Bash → Smash → Thrash advancements |
| — | Replacements made after all four slots are full |

At expedition end, learned moves, advancements, and selected augments reset. Permanent eligibility and unlocked options remain. The creature does not permanently retain Thrash merely because Bash advanced during one descent.

### Breeder influence over move offers

Breeding does not automatically force an inherited move into the starting pair or silently give it a permanent weight bonus. The starting pair always preserves role and archetype identity.

Instead, a future Breeder service lets the player deliberately influence which moves a bloodline is likely to encounter in Growth Drafts. This converts inheritance from an automatic rule into player agency over the run's offer distribution.

The exact service remains deferred: number of moves that can be favored, strength of the bias, compatibility limits, cost, whether the bias belongs to the individual or bloodline, and how it is changed. The architecture requirement is that Growth offer weighting accepts explicit player-authored move biases rather than baking breeding weights directly into every inherited move.

### Permanent augment catalog

The player owns a permanent catalog of unlocked augment definitions. A Kin may select only augments compatible with its current move. Departure and Growth attach an unlocked augment for the current expedition; they do not consume or remove the permanent unlock.

Baseline augments are available from the beginning. Candidate sources that may expand the catalog later include:

- hidden Mark accomplishments or discoveries;
- first-time elite and boss victories;
- Omen, Break, Weave, weather, or other encounter-rule discoveries;
- Monsterpedia research milestones;
- town progression or a dedicated trainer/vendor;
- breeding and bloodline milestones;
- rare tower events and puzzles;
- Afterform mastery or creature-specific achievements.

This list records extension points, not confirmed reward assignments. Exact sources belong to a later progression pass.

### Auto-combat contract

Auto-combat uses the same committed intents, action legality, Tempo state, and Relay operation as manual combat. It receives no hidden resistance or encounter-module information. The first policy is intentionally legible: preserve a legal survival action when one is urgent; otherwise prefer a move that defeats a target, exploits known weakness, or generates Tempo, and Relay when doing so moves an unused ally ahead of an enemy action. More sophisticated sequence planning may replace this policy without adding a second rules path.

Auto-combat must never spend Tempo after every ally has acted, target an ally that has already acted, or create an action that was absent from the round timeline.

### Combat metrics and acceptance criteria

The combat rules emit structured facts independently of animation timing. The first metrics vocabulary is:

- rounds, actions, Basic Attack uses, Magic uses, items used, HP and MP spent or restored;
- Tempo generated, generation reason, Tempo spent, Tempo wasted at cap, and Relay chain length;
- repeated party sequences and the timeline position changed by each Relay;
- enemy actions prevented, Kin knocked out, revivals, and battle outcome;
- module-specific fields added later for Omen pips, Break pressure/Exposed hits, and Weave recipes.

The Pack Tempo vertical slice is accepted when exact enemy moves and targets are visible at round start, the Tempo meter is visible, manual and auto combat can Relay, every original timeline action occurs at most once, Tempo carries between rounds but not battles, the text-state hook exposes the same facts as the screen, and existing combat/economy/recovery behavior has no regressions.

These questions must not be silently answered by the implementation plan.

## Expected Technical Shape

The architecture is expected to separate combat rules from Phaser scene presentation:

- an explicit combat state and turn state machine;
- deterministic rule functions where practical;
- injected RNG where randomness remains intentional;
- a stable event or hook vocabulary for encounter modules;
- module-owned state that is visible to UI and AI through typed summaries;
- one source of action legality and resolution for manual and auto-combat;
- a fixed-seed Combat Lab for isolated encounters;
- structured combat metrics emitted independently of animation timing.

### Prototype discipline

The implementation plan may define a small vertical slice, but it must first cite a fully described target architecture. Prototype shortcuts must be labeled as omissions from that target rather than left for future agents to infer from the code. Where practical, types and interfaces should preserve the approved extension point even when the first content slice supplies only one implementation.

The code is evidence of what currently exists, not authority to narrow an approved design merely because a prototype implemented less of it.

Exact interfaces will be designed after the gameplay questions are resolved. Prematurely defining a generic hook for every imagined boss mechanic would make the engine abstract before its needs are known.

## Decision Log

| ID | Decision | Status | Notes |
| --- | --- | --- | --- |
| CA-01 | Pack Tempo is the universal core | Confirmed | Stable core beneath encounter modules |
| CA-02 | Base turn-order model | Confirmed | Interleaved SPD timeline; one action per combatant per round |
| CA-03 | Enemy-intent granularity | Confirmed | Exact move and target committed and revealed at round start |
| CA-04 | Tempo cap, generation, spending, and persistence | Confirmed | Start 0; cap 3; one generated per Kin per round; Relay costs 1; carries between rounds; clears after battle |
| CA-05 | Random versus conditional criticals | Confirmed | Remove random crits; use authored deterministic conditions and Keen moves |
| CA-06 | Normal/elite/boss complexity tiers | Confirmed | Core-only normals; simplified module elites; one full-module bosses; late bosses may combine two learned modules |
| CA-07 | Permanent versus run-scoped move growth | Confirmed | Eligibility, unlocked roots/augments, and Breeder bias persist; selected loadout, advancements, and attachments reset |
| CA-08 | Responsibilities of Traits, Instincts, relics, Marks, and Afterform | Confirmed boundary | Traits quiet; one Instinct trigger; relics summarized; Marks/Afterforms optional extensions |
| CA-09 | Omen and Break relationship | Confirmed with validation gate | Omen prevents an action; Break creates Exposed; Omen adds Break pressure; revisit if redundant or overly complex |
| CA-10 | Weave topology and catalog | Confirmed | Separate three-slot fields; unordered recipes; all 84 three-Echo combinations; curated secret four-Echo subset |
| CA-11 | Auto-combat and boss-AI behavior | Confirmed | Same rules and information as manual combat; initially greedy, legible Relay policy |
| CA-12 | Combat metrics and acceptance criteria | Confirmed | Structured action/attrition/Tempo facts; visible and text-state parity; no duplicate actions |
| CA-13 | Enemy sequencing resources | Confirmed | No universal hidden enemy Tempo; authored encounters may explicitly interact with Tempo or own a visible resource |
| CA-14 | Player action conservation | Confirmed | No system may grant a player Kin more than one action in the same round |
| CA-15 | Starting move count and capacity | Confirmed | Start with 2 role/archetype moves; learn toward 4; Basic Attack is separate |
| CA-16 | Move growth grammar | Confirmed | Learn, Advance, or Augment; one augment per move; augment follows advancement |
| CA-17 | Guaranteed move-growth cadence | Confirmed | Every Kin receives one Growth choice after each five-floor mini or major boss |
| CA-18 | Species-exclusive signature moves | Confirmed | Not required; starting move identity comes from role and archetype |
| CA-19 | Starting move composition | Confirmed | Exactly one role move and one archetype move |
| CA-20 | Departure augment | Confirmed | Attach one unlocked compatible augment to either starting move for the expedition |
| CA-21 | Learned-move augment state | Confirmed | Newly learned moves begin unaugmented |
| CA-22 | Breeder move influence | Confirmed | Player-authored Growth-offer bias; no automatic inherited starting move or default weighting |
| CA-23 | Permanent augment sources | Deferred | Baseline catalog plus future discoveries, progression, encounters, breeding, events, and mastery systems |
| CA-24 | Growth Draft construction | Confirmed | 3 legal choices per Kin with Learn and Advance/Augment guarantees when applicable |
| CA-25 | Growth decline | Confirmed | May skip without compensation |
| CA-26 | Offer fatigue | Confirmed | Rejected Advance/Augment options are softly deprioritized after 3 offers; resets each expedition |
| CA-27 | Move advancement shape | Confirmed | Architecture supports branches even if initial content is mostly linear |
| CA-28 | Learning at full capacity | Confirmed | Confirmed replacement; forgotten run move/augment disappear; permanent unlocks remain |
| CA-29 | First-contact teaching | Confirmed | Survivable elite/mini introduction, explicit feedback, then permanent Monsterpedia record |
| CA-30 | Encounter-module combination limit | Confirmed | One full module normally; late bosses may combine at most two previously taught modules |
| CA-31 | Omen timing modes | Confirmed | Charged uses declaration and next enemy action; Immediate boss variant declares at round start and resolves after allied actions that round |
| CA-32 | Omen pip rules | Confirmed | Maximum 3 initially; one removed per allied action by default; partial weakens and full completion cancels |
| CA-33 | Simultaneous Omen limit | Confirmed | One active Omen across the enemy party |
| CA-34 | Exposed duration | Confirmed | Through end of following round, then Break resets |
| CA-35 | Break critical payoff | Confirmed | First damaging move from each Kin guarantees a crit; later Exposed hits gain damage but use normal critical conditions |
| CA-36 | Weave action contribution | Confirmed | One base Echo; one non-stacking bonus Echo may come from an augment, Instinct, Trait, Afterform, or authored modifier |
| CA-37 | Weave resolution | Confirmed | Echo bundle resolves after the action; ordinary three-Echo reactions clear; no universal Stall or Attune command |
| CA-38 | Bonus-Echo fallback | Confirmed | Secret four-Echo match resolves all four; otherwise existing two plus base resolve and bonus carries forward |
| CA-39 | Weather boundary | Confirmed | Not a default Weave output; optional persistent mini-boss/boss rule with one visible state |

## Q&A Sequence

1. **Core flow:** turn order, intent, Tempo, and criticals.
2. **Moves:** starting loadout, learning, advancement, augments, and reset rules.
3. **Encounter contracts:** complexity tiers, Omen, Break, Weave, and first-contact teaching.
4. **Supporting layers:** Traits, Instincts, relics, Marks, Afterform, items, and auto-combat.
5. **Architecture validation:** UI contract, technical boundaries, metrics, Combat Lab, and prototype acceptance criteria.
6. **Red-team review:** exploits, perfect sequences, invalid parties, cognitive overload, recovery economy, and content burden.

## Implementation State

The design Q&A is complete. Phase 1—the stable Pack Tempo vertical slice with round-start intents, battle-local Tempo, action-conserving Relay, manual and auto use, UI/text-state visibility, deterministic tests, metrics hooks, and conditional criticals—was implemented on 2026-07-31. Move Growth follows after the stable turn engine. Omen/Break and Weave remain described target modules, not prototype shortcuts inside the core.

---

*Tuning values and content catalogs remain revisable. Action conservation, exact intents, layer responsibilities, and module boundaries require an explicit architecture revision to change.*
