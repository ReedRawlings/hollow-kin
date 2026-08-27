# Hollow Kin Combat Pitch 1 — The Pack Tempo Timeline

> Historical pitch. The authoritative persistent three-Tempo Relay and Link Art rules are maintained in `../combat-architecture-spec.md`.

> **Summary:** Combat uses a visible, interleaved timeline. Every living combatant receives one action per round, but the player earns a small shared resource called **Pack Tempo** and spends it to pull an ally forward before an enemy acts. Moves are learned and strengthened during the expedition, with each move contributing a different way to create or exploit Tempo. The result is a pure turn-based system about arranging a three-creature combination under pressure—not about positioning, extra turns, or repeatedly selecting the highest-damage move.

> **Status:** Competing design pitch, not a change to the GDD. Numbers and terminology are illustrative. “Move” is the player-facing term used here for the current Ability object.

## Why This Combat Loop Is Unique

The timeline is the battlefield.

Most creature battlers ask which move should be used. This pitch also asks **when each Kin should act, who should hand the initiative to whom, and whether the party should spend its limited Tempo now or preserve it for a more dangerous sequence**.

Pack Tempo never creates a bonus action. It only rearranges actions the party already owns. That keeps the system readable and prevents weakness exploitation from turning into an infinite player turn. A creature’s value can come from opening a sequence, advancing an ally, finishing a target, or conserving MP—not merely from its damage output.

The pitch is particularly suited to Hollow Kin because:

- The party is always the same three Kin for the expedition, so players can learn that trio’s preferred sequence.
- MP persists between encounters, so using an expensive combination to seize initiative has an expedition cost.
- SPD, statuses, weaknesses, buffs, items, Instincts and conditional criticals can all interact with the same visible timeline.
- Auto-combat can demonstrate increasing mastery as the Monsterpedia reveals enemy weaknesses.

## Design Pillars

1. **Every action changes the value of the actions after it.**
2. **Turn order is controllable but actions are never created for free.**
3. **A strong combination ends a battle cleanly; an extravagant combination spends MP that may be needed several floors later.**
4. **Move growth changes how a Kin participates in a sequence, not only its damage number.**
5. **Enemy intentions are legible enough for sequencing to be a decision rather than a guess.**

## Turn Flow

### 1. Build the round timeline

At the beginning of each round, every living combatant is placed once on a visible timeline. SPD determines the initial order. Buffs and debuffs to SPD affect the next timeline calculation rather than moving an action that is already resolving.

Enemies choose and reveal their intended actions when the timeline is built. The preview shows:

- the acting enemy;
- the intended move or move category;
- the target, if the action has a target;
- whether the action is ordinary, disruptive, or a charged threat.

The target may still be selected using the game’s current random-enemy-targeting rule; it is simply rolled before the round and revealed to the player.

### 2. Resolve the next combatant

When a Kin reaches the front of the timeline, the player chooses `FIGHT`, `MAGIC`, or `ITEM` as they do today. Basic Attack remains free and reliable. Magic spends persistent MP. Most item uses consume that Kin’s action; Smoke Husk retains its special free-escape behavior.

An enemy executes the intent it revealed unless it has been knocked out, disabled, or displaced by a specific move effect.

### 3. Generate Pack Tempo

Certain successful actions generate one Pack Tempo. The meter is shared by the party and initially caps at three.

Core Tempo triggers should be deliberate and limited. Candidates include:

- exploiting a weakness, known or newly discovered;
- triggering a move’s conditional critical;
- using a status interaction listed on the move;
- satisfying a Kin’s Instinct;
- using a move with the **Lead** or **Relay** augment;
- breaking a charged enemy action with a move designed to interrupt it.

The same trigger should normally award Tempo only once per round. This stops area attacks and damage-over-time ticks from manufacturing the entire meter.

### 4. Spend Tempo to Relay

After a Kin completes its action, the player may spend one Pack Tempo to choose any ally that has not acted this round and pull that ally to the front of the timeline.

This is the universal Tempo spend. It does not grant an extra action; the selected ally’s original timeline entry is removed.

Relaying can be chained if the party has enough Tempo:

> Cat opens a weakness → gains Tempo → relays to Wiggledrake → Wiggledrake exploits the opening → relays to Geta before the boss’s charged move.

Specific moves, run-long boons and Afterforms may introduce rarer Tempo spends, but the base game should teach only Relay.

### 5. End the round

Once every living combatant has acted or lost its action, statuses tick and the next timeline is calculated. Unspent Tempo remains for the battle, but the low cap prevents indefinite hoarding. All Tempo clears when the encounter ends.

## Conditional Criticals

This pitch replaces random critical hits with **move-authored critical conditions**. The critical becomes a result the player can plan around and the enemy can telegraph around.

Examples:

- **Slash:** critical if the user acts before the target this round.
- **Cross Counter:** critical if the target damaged an ally earlier in the round.
- **Smolder:** critical against a target already suffering Burn.
- **Shadow Claw:** critical if another ally targeted this enemy immediately before the user.
- **Thrash:** critical against an enemy below a health threshold, retaining its recoil.

The existing `highCrit` identity can become **Keen**: a Keen move has an easier or broader critical condition rather than a larger random percentage. SPD continues to matter because several conditions reference the timeline.

## How Moves Enter and Grow During an Expedition

Each Kin begins with its permanent starting move roots: species defaults plus any starting choices granted by breeding or other permanent systems. The current `role` field serves as the first version of a combat class; archetype supplies a secondary flavor pool.

Temporary in-run levels or a new Training reward offer three kinds of move development:

1. **Learn** a move from a weighted role/archetype pool.
2. **Advance** a known move along its authored line, such as Bash → Smash → Thrash.
3. **Temper** a move with one run-only augment.

The four equipped move limit can remain. A Kin may begin with fewer than four, fill open slots during the run, and replace a move when full. Between encounters, the player can reorganize learned moves; loadouts do not change in the middle of a battle.

### Example move line

| Move | Core improvement | Timeline identity |
| --- | --- | --- |
| Bash | Low-cost physical hit | Generates Tempo when it acts before the target |
| Smash | More power and buildup | May pull the target one position later on the next timeline |
| Thrash | High power with recoil | Conditionally critical against a target already hit by two allies |

Possible run-only augments include:

- **Lead:** the first successful use each battle generates Tempo.
- **Relay:** the ally pulled after this move gains a modest effect.
- **Patient:** stronger when the user was moved later rather than earlier.
- **Pursuing:** stronger against a target whose action has not resolved.
- **Conserving:** refunds a small amount of MP when its critical condition succeeds.

An augment follows the move when it advances from Bash to Smash or Thrash. This makes an upgrade feel like the continuation of the same move rather than a replacement that deletes the run’s build.

Unless a future permanent system explicitly records one, learned moves, advancements and augments above the creature’s permanent starting loadout reset at expedition end. Permanent progression determines **what a Kin can begin with and what can appear**; the expedition determines what that possibility becomes this time.

## Traits, Instincts, Marks, Boons and Afterform

These systems occupy different layers:

- **Traits** are permanent passive foundations: opening Tempo, SPD behavior, MP efficiency, resistance, or party affinity.
- **Instincts** are proposed creature-specific combat triggers: “gain Tempo the first time an ally is hurt,” or “your Relay target gains one STR stage.”
- **Timed boons** continue to offer short expedition stretches of power and recovery.
- **Run-long boons** last for the expedition and alter the party’s sequencing rules: the first Relay each battle is free, a three-Kin chain adds buildup, or unused Tempo heals a small amount after victory.
- **Marks** are optional discovery hooks. A strange timeline accomplishment can unlock a new augment, Instinct or boon for future runs without requiring this pitch to settle whether Marks are slotted bonuses or permanent discoveries.
- **Afterform** is a battle climax. A Kin that has satisfied its Instinct may spend a full Tempo meter at the start of its turn to transform for the rest of the battle. Afterform changes a sequencing rule or signature move rather than only increasing stats.

Only one Afterform should normally be activated per encounter because all three Kin compete for the same Tempo.

## Overall Combat Loop

1. Read the enemy intentions and initial timeline.
2. Identify which Kin can safely open the sequence.
3. Use inexpensive setup, weakness and status interactions to generate Tempo.
4. Relay the party into a deliberate order before the most dangerous enemy actions.
5. Spend MP to finish a target, interrupt a threat, or preserve HP—and decide whether that expenditure is worth the remaining descent.
6. Trigger an Instinct or Afterform if the encounter warrants it.
7. Win with as little lasting HP and MP loss as possible.
8. Choose a post-battle reward: immediate recovery, Obols, an item, a timed boon, or occasional Training.
9. Carry the evolving move build into the next encounter, where a different timeline asks for a different sequence.

## Post-Battle and Expedition Integration

The existing three-card offer remains the survival-versus-growth decision. **Training** becomes an additional reward kind rather than an automatic reward after every fight. Taking it means declining recovery, currency, a consumable, or a boon.

Training choices are weighted by the Kin’s role, archetype, current moves and party synergies. The generator should prefer offers that are usable but should not guarantee a perfect engine.

The broader expedition loop becomes:

> Build a temporary sequencing engine → spend HP and MP to keep it alive → choose survival or further specialization → push toward the next guaranteed departure floor → leave with permanent progress before the engine and its cargo are lost.

Capture can later integrate cleanly: Capture consumes the acting Kin’s turn, while Tempo lets the party deliberately pull the capturer ahead of a dangerous target. Captured Kin remain cargo and never join the current expedition party.

## Example Round

The timeline reads:

> Cat → enemy caster preparing Inferno → Wiggledrake → Geta → enemy bruiser

The caster intends to hit the wounded Wiggledrake.

1. Cat uses a Lead-augmented Slash and satisfies its “act before the target” critical condition.
2. The critical generates one Tempo.
3. The player spends it to Relay Geta ahead of the caster.
4. Geta uses Scold, reducing the caster’s relevant attack stage.
5. The caster’s action resolves for less damage.
6. Wiggledrake exploits the caster’s new debuffed state with a move that generates Tempo from a Technical interaction.

Nothing acted twice. The player survived because the pack was ordered correctly.

## Risks and Safeguards

| Risk | Safeguard |
| --- | --- |
| Tempo snowballs into permanent player control | No bonus actions; cap Tempo at three; award each trigger once per round |
| Intent display removes suspense | Reveal actions and targets, not damage rolls or secondary-effect outcomes |
| SPD becomes irrelevant because Relay overrides it | SPD still determines the starting timeline and several critical conditions; Relay is scarce |
| Every good party uses the same opener | Role-weighted move pools and encounter-specific intentions create different openings |
| Auto-combat cannot reason about sequencing | Start with a greedy rule: generate Tempo, prevent a predicted knockout, then relay to the highest-value legal move |
| UI becomes crowded | Show one timeline, one three-segment Tempo meter, and intent icons; avoid a second universal resource |

## Minimum Alpha Prototype

Test the identity of the pitch before building its content breadth:

1. Reveal enemy move and target at round start.
2. Keep the current one-action-per-combatant SPD timeline.
3. Add a three-point Pack Tempo meter.
4. Generate Tempo from any landed weakness hit and one prototype move condition; knowledge only controls previews and auto-combat targeting.
5. Spend one Tempo only to Relay an unused ally.
6. Convert three existing moves to deterministic critical conditions.
7. Add one Learn, one Advance and one Temper offer for a single role.
8. Add one elite whose intent makes correct Relaying visibly valuable.

If changing the order does not repeatedly change the best move, this pitch has failed even if the interface works.
