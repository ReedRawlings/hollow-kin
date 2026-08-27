# Hollow Kin Combat Pitch 3 — The Living Battlefield Weave

> Historical pitch. The authoritative distinction between interruptible Link Arts and encounter-authored Weaves is maintained in `../combat-architecture-spec.md`.

> **Summary:** Every move leaves an elemental or conceptual **Echo** on a shared three-slot Battlefield Weave. Allies and enemies contribute to the same Weave. Completing a recognizable combination triggers a Field Reaction and temporarily changes the rules of the encounter. The player can build a reaction, steal one the enemy began, or deny an enemy’s expected recipe. Moves learned and upgraded during the expedition gain different ways to seed, bend and harvest the battlefield, while creatures earn Afterform by expressing their Instinct through reactions.

> **Status:** Competing design pitch, not a change to the GDD. Numbers, recipes and terminology are illustrative. “Move” is the player-facing term used here for the current Ability object.

## Why This Combat Loop Is Unique

The history of the battle becomes a shared object both sides can manipulate.

There is no grid and no positioning, but the environment still feels alive because the last few actions alter what the next action will do. An enemy Fire move is not only incoming damage—it may be the second Echo in a reaction the player can complete. A low-power Wind move may be correct because it turns lingering Fire into Wildfire before an enemy can convert it into something worse.

This changes the central question from “what is my strongest move?” to:

- What Echo will this move leave?
- What reaction will it complete?
- Am I creating a field my party can exploit?
- Is the enemy about to steal or corrupt that setup?
- Is this reaction worth its persistent MP cost?

The battlefield also provides a natural bridge between combat and mystery. Recipes can be discovered through play, Marks can remember unusual reactions, run-long boons can rewrite recipe rules, and different encounters can begin with different environmental seeds.

## Design Pillars

1. **Every move affects both its target and the shared battlefield.**
2. **Enemies obey and contribute to the same reaction rules as the player.**
3. **The environment creates opportunity, not hard immunity; an unfavorable field is a problem to bend, not a reason the party cannot win.**
4. **Recipes are predictable once discovered and previewed before commitment.**
5. **Move growth expands how the party manipulates the Weave rather than only raising power.**

## The Battlefield Weave

The center of the combat UI contains three visible Echo slots. When a move resolves, it may add one Echo to the rightmost open slot.

Initial Echo families can map directly to existing move data:

- **Force** — Fighting and heavy physical moves;
- **Flame** — Fire;
- **Frost** — Ice;
- **Current** — Wind and Electric, separated later if the first prototype needs more depth;
- **Veil** — Ghost;
- **Vital** — selected healing, buff and cleanse moves;
- **Blight** — selected affliction and debuff moves.

Basic Attack adds a weak Force Echo, allowing an MP-starved party to participate in the system without matching the potency of specialized Magic.

When three Echoes form a known recipe, they resolve into a **Field Reaction**. The Weave then clears and the reaction leaves either an immediate effect, a temporary Field State, or both.

Order may matter for advanced recipes, but the initial prototype should treat the three Echoes as an unordered set. That makes the system teachable and sharply limits the recipe count.

### Illustrative reactions

| Recipe | Reaction | Result |
| --- | --- | --- |
| Flame + Flame + Current | Wildfire | Immediate Fire damage; the field becomes Scorching for two rounds |
| Frost + Force + Force | Shatter | Heavy buildup against one enemy; Broken targets take a conditional critical |
| Current + Current + Flame | Tempest | The next round’s timeline is recalculated with amplified SPD differences |
| Veil + Blight + Veil | Haunting | Afflictions on enemies last longer; healing is slightly reduced for both sides |
| Vital + Frost + Vital | Sanctuary | Clear one party affliction and soften the next enemy area attack |
| Flame + Frost + Current | Mist | Accuracy falls for hostile moves and Ghost effects become stronger |

Recipes are examples, not a proposed final table. The important structure is **seed → complete → live under the resulting field → bend it again**.

## Turn Flow

### 1. Seed the encounter

The room begins with zero to two environmental Echoes based on encounter, depth band, enemy family or random event.

Examples:

- a furnace room begins with Flame;
- a flooded chamber begins with Frost or Current;
- a haunted room begins with Veil;
- a neutral corridor begins empty.

The seed is visible before the first command and is part of the encounter preview when practical.

### 2. Build the round timeline

Combat otherwise retains the current individual SPD turn structure: every living combatant acts once, the order recalculates each round, and the current actor chooses or executes one action.

Enemies reveal only the Echo family their next move is likely to contribute, not their exact move and target. This **Field Tell** gives the player enough information to plan around the Weave without turning the entire encounter into the full-intent puzzle used by the Omen pitch.

### 3. Resolve a move and add its Echo

The move resolves normally first: damage, healing, stages, statuses and item effects. It then adds its Echo unless it missed or its data says otherwise.

Before the player confirms a move, the UI previews:

- the Echo it will add;
- whether it completes a known reaction;
- the known reaction result;
- `???` when the combination has never been discovered.

Unknown recipes may still be attempted. Discovery should be exciting, not dependent on reading an external table.

### 4. Resolve a Field Reaction

After the move, its full Echo bundle is added atomically. Three Echoes resolve the ordinary reaction. An authored augment, Instinct, Trait, Afterform, or similar modifier may add one non-stacking bonus Echo; when that creates four, it can discover a curated secret reaction. The Kin or enemy that completed the recipe is considered the **Catalyst**, which matters for Instincts, Afterform and some boons.

Any resulting Field State lasts for a short number of rounds or until another reaction replaces it. Only one major Field State is active at a time to keep the UI readable.

### 5. Continue under the changed field

Moves may receive different conditional effects while a Field State is active. Enemies use those rules too. The next recipe may exploit, overturn or cleanse the current state.

At the end of the round, statuses tick normally. The incomplete Weave remains; it is battle history, not a round resource. The Weave and Field State clear when combat ends.

## Conditional Criticals

Random player criticals are replaced by field-dependent conditions.

Examples:

- **Slash:** critical if it is the first move used after a Current reaction.
- **Smolder:** critical while the field is Scorching.
- **Frost:** critical when it converts Flame into a mixed recipe.
- **Shadow Claw:** critical while Veil is present in the Weave or Field State.
- **Thrash:** critical when it consumes a Force-heavy recipe, retaining recoil.

Formerly `highCrit` moves become **Resonant**: they critical whenever they personally complete or harvest a compatible reaction. Crits are therefore earned and previewable.

## How Moves Enter and Grow During an Expedition

Each Kin enters with permanent starting move roots from species, role, breeding and other lasting progression. Temporary in-run growth turns those roots into a field-manipulation kit for this expedition.

Temporary level or Training choices offer:

1. **Learn** a move from a role/archetype-weighted pool.
2. **Advance** a move along its authored line, such as Bash → Smash → Thrash.
3. **Augment** a move with one run-only Weave modification.

### Example move line

| Move | Combat growth | Weave identity |
| --- | --- | --- |
| Bash | Cheap physical hit | Seeds one Force Echo |
| Smash | More power and buildup | Seeds Force and may strengthen an existing Force Echo |
| Thrash | High power with recoil | Harvests a Force-heavy Weave for bonus damage, then clears those Echoes |

The stronger move is not merely the same button with a larger coefficient. Smash builds the environment faster; Thrash cashes it out.

Possible run-only Weave augments include:

- **Seed:** adds one bonus Echo to the action. An action can receive at most one bonus Echo even if several sources qualify.
- **Echo:** repeats the most recent compatible Echo instead of its default one.
- **Bend:** replaces one existing Echo with the move’s family.
- **Preserve:** completes a reaction without clearing one chosen Echo.
- **Harvest:** consumes a matching Echo for an immediate move bonus instead of adding one.
- **Invert:** uses an alternate Echo family when a specified Field State is active.

An augment follows the move when it advances. The four equipped move limit can remain, with Kin filling or revising those slots as the expedition develops.

Run-learned moves, advancements and augments reset to the permanent starting loadout at expedition end unless a future permanent system records one.

## Traits, Instincts, Marks, Boons and Afterform

- **Traits** are permanent foundations: begin battle with an Echo, resist a harmful field, empower a certain reaction family, or change one move’s default Echo.
- **Instincts** are proposed personal behaviors tied to being a Catalyst: a Flora Kin may awaken by completing Vital reactions, while a Devil may seek Blight or Flame reactions.
- **Timed boons** continue to last a fixed number of battles and may increase reaction rewards, protect the party from the first hostile reaction, or heal after a specified field victory.
- **Run-long boons** rewrite the expedition’s recipe grammar: Current counts as Flame for one recipe, Wildfire heals Fauna slightly, or the first reaction each battle preserves its final Echo.
- **Marks** are particularly natural as mysterious discoveries. Completing an unusual recipe, allowing an enemy to create a field and then reversing it, or winning under a hostile state can permanently reveal a new reaction, augment, boon or Afterform possibility. This pitch does not require Marks to be equipped percentage bonuses.
- **Afterform** is earned by acting according to a Kin’s Instinct. Completing compatible reactions grants that Kin Resonance symbols. At a small threshold, it may enter Afterform for the remainder of the encounter.

Afterform changes how the Kin participates in the Weave:

- its signature move contributes two different Echoes;
- it may become Catalyst even when an ally completes its preferred recipe;
- it can preserve one Echo when a reaction resolves;
- it gains a unique Field Reaction unavailable in normal form.

This makes transformation an expression of creature identity rather than a generic limit break.

## Items in the Weave

Damage and status items gain additional value by supplying an Echo the party’s moves may lack. This reinforces the current rule that an item should offer unavailable coverage, reliability or a meaningful secondary effect.

Examples:

- Grave Ash deals its current fixed damage and supplies Flame or Blight.
- Clearroot clears afflictions and supplies Vital.
- Null Salt strips enemy buffs and removes one hostile Blight Echo.

These are pitch-specific extensions, not changes required for the first prototype. Recovery and escape items can remain outside the Weave.

## Overall Combat Loop

1. Read the room’s initial Echoes and the enemies’ Field Tells.
2. Decide whether to complete the available recipe, deny it, or seed a different plan.
3. Use moves that both solve the immediate HP/status problem and shape the Weave.
4. Complete a reaction and fight under the resulting Field State.
5. Exploit deterministic critical conditions, Instincts and Afterform created by that state.
6. Watch the enemy contribute to or hijack the next recipe.
7. Bend or harvest the battlefield before it becomes hostile.
8. Win while preserving the persistent HP, MP and items needed for later encounters.
9. Choose post-battle survival, currency, boon, item or move growth informed by what occurred.

## Post-Battle and Expedition Integration

Training enters the existing three-card offer as an occasional reward kind. When selected, its three move choices are weighted by the reactions the party actually created:

- repeatedly completing Force recipes increases the chance of a Harvest augment;
- using mixed recipes increases Bend or Invert offers;
- allowing enemies to control the field may produce defensive Field options.

The offer should respond to play without becoming deterministic. The player is encouraged to express a build during battle, and the run answers with compatible possibilities.

The expedition loop becomes:

> Discover a field vocabulary → develop moves that manipulate it → find boons that rewrite it → encounter rooms that seed different problems → risk scarce MP to create favorable reactions → leave before the temporary ecology and carried rewards disappear.

Capture rites can later read combat history from the Weave. A family rite might ask the player to capture under Mist, after reversing an enemy reaction, or with a particular Echo present. Capture remains an Obol bid and the captured Kin remains cargo.

## Example Sequence

The battle begins in a furnace room with one Flame Echo. The next enemy shows a Current Field Tell.

1. Cat can use Slash, adding Current. That would leave Flame + Current and allow the enemy’s Current move to complete a Tempest-like recipe.
2. Instead, Cat uses Bash and adds Force.
3. The enemy adds Current, forming Flame + Force + Current and unexpectedly revealing **Forge Wind**: physical moves gain buildup for two rounds.
4. The recipe is now permanently recorded in the player’s reaction journal.
5. Geta uses Smash under Forge Wind, adding Force and dealing additional buildup.
6. Wiggledrake can now add Frost to begin Shatter, or add Flame to steer toward another Forge reaction.

The enemy changed the battlefield, but the player decided how to use what it created.

## Risks and Safeguards

| Risk | Safeguard |
| --- | --- |
| Recipe count becomes combinatorial | Use broad Echo families; begin with unordered three-Echo sets; author a small explicit table |
| Players must memorize recipes | Preview known reactions on move selection and keep a discovered-reaction journal |
| Enemies accidentally give the player free power | Enemies benefit from Field States too and can forecast dangerous completions |
| Field effects overwhelm basic move comprehension | One Weave, one active Field State, and one line of preview text per move |
| The best recipe becomes universal | Encounter seeds, enemy kits, boons and Instincts change the value of recipes by run |
| Auto-combat cannot plan recipes | Initially use a one-step heuristic: complete a favorable known recipe, deny a harmful predicted recipe, otherwise use the normal tactic |
| Visual effects slow combat | Resolve reactions with a short overlay compatible with the existing 1×/2×/4× battle speeds |

## Minimum Alpha Prototype

1. Add a visible three-slot Weave.
2. Collapse current damage types into only three prototype Echo families.
3. Give every current move one Echo; Basic Attack supplies the neutral physical family.
4. Author four unordered recipes: one offensive, one defensive, one status-oriented and one timeline-oriented.
5. Add Field Tells to two enemy moves.
6. Preview known reactions before the player confirms a move.
7. Convert three moves to field-dependent deterministic criticals.
8. Give Bash, Smash and Thrash Seed, Strengthen and Harvest identities.
9. Test one run-long boon that changes a recipe and one encounter that starts with an Echo.

If players still choose moves by damage-per-MP while ignoring the Weave, the reactions are not consequential enough—or the interface is not communicating them.
