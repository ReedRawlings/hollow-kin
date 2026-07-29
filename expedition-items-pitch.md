# Hollow Kin — Expedition Items & Heirloom Pitch

> **Status:** Pitch for discussion — not yet an approved design.
>
> **Direction proposed here:** Keep **Marks**, but reshape them into mysterious permanent discoveries rather than another equipped combat-bonus system. **Breeding Stones are already formally cut.** Traits, breeding inheritance, and run-only Relics remain.

## Current-System Check

The surrounding progression systems currently divide as follows:

| System | Current role | Decision for this pitch |
| --- | --- | --- |
| **Traits** | Permanent, intrinsic Kin effects. Up to four slots unlock through permanent levels; traits are found, imbued, upgraded, and inherited at breeding. | **Keep.** Permanent items must not duplicate trait progression or inheritance. |
| **Marks** | Unbuilt, creature-specific bonuses earned through run thresholds, then made permanent with Essence. Still present in the GDD. | **Keep the discovery fantasy, redesign the reward.** Hidden or unusual run accomplishments permanently unlock content for the player. |
| **Breeding Stones** | Former consumables that modified breeding outcomes through the removed Enhancer. | **Already cut.** Do not revive them as part of the item system. |
| **Relics** | Automatically affect the whole party for one expedition and disappear when it ends. They do not occupy backpack slots. | **Keep.** Relics make each expedition mechanically different. |
| **Backpack items** | Carried, manually used, compete with captures and found traits for space, and may be lost on a wipe when unprotected. | **Expand.** This becomes the expedition's tactical resource layer. |

This leaves five clean identities:

> **Traits are what a Kin is. Relics define this expedition. Consumables answer immediate danger. Preparations are charged advantages saved for chosen battles. Marks remember unusual deeds and unlock new possibilities. A Heirloom is the one permanent object the party brings with it.**

## Pitch

Make entering a tower stretch a real commitment. Free departure after every encounter is replaced by limited extraction opportunities, and the post-battle screen becomes a choice between help now and resources saved for later.

The backpack becomes the center of expedition tension:

* Recovery supplies compete with captured Kin and found traits.
* A Waystone provides an early safe exit, but consumes a slot until used.
* Status cures and revival supplies protect against specific kinds of collapse.
* Damage items let a struggling party trade a finite resource for a battle swing.
* Charged Preparations can be spent on the next encounter or preserved for a more dangerous fight.
* Pushing deeper means risking both the expedition's take and the supplies needed to bring it home.

## Departure and Commitment

Remove the free **FLEE TOWER** action between every encounter.

### Safe departure

* Defeating each five-floor boss creates a free, guaranteed opportunity to **depart or continue**.
* Continuing past that screen commits the party to the next five-floor stretch unless it carries a Waystone.
* A wipe retains its existing penalty: half of leftover Obols convert and one unprotected backpack object is lost.

### Extraction items

**Waystone**  
Single use outside combat. Successfully end the expedition after any completed encounter, receiving full Obol conversion and keeping carried cargo.

**Smoke Husk**  
Single use during a non-boss battle. Escape without that encounter's rewards and return to the run path. It does not end the expedition.

The UI must show the commitment before the player advances:

> **NO WAYSTONE — NEXT GUARANTEED DEPARTURE: FLOOR 10**

This creates risk without trapping a visibly doomed party for an arbitrary number of encounters. Boss breaks remain the guaranteed safety valve; Waystones provide control between them.

## Post-Battle Choice: Relief Now or Power Later

Replace the guaranteed two-option recovery screen with a small reward offer. The exact number of cards can be tuned, but each offer should mix two kinds of value:

* **Immediate relief:** heal HP or restore MP now without using backpack space.
* **Future value:** take a consumable or charged Preparation into the backpack.

The player may use a newly taken item immediately when its effect permits, but doing so still consumes it or one of its charges. Otherwise, it remains available for a later fight. If the backpack is full, taking an item requires using, replacing, or abandoning something.

The offer does not need to guarantee the same recovery amounts after every victory. A simple initial model is:

* ordinary battles offer modest immediate recovery alongside one or two future-value choices;
* mini-bosses and major bosses offer stronger, rarer, or higher-charge items;
* shops remain the reliable source of specific supplies;
* rest encounters remain the strongest source of immediate recovery.

This preserves the readable HP-versus-MP decision from the current screen while adding a new question: take certainty now, or carry an advantage toward the boss?

## Initial Expedition Item Pool

Keep the first pool small and make every item answer a recognizable danger.

| Item | Effect | Purpose |
| --- | --- | --- |
| **Mending Draught** | Restore a percentage of one living Kin's maximum HP. | Core HP recovery |
| **Moonwater** | Restore a percentage of one living Kin's maximum MP. | Core ability-resource recovery |
| **Hollow Candle** | Revive one Kin with low HP and MP. | Recovery from a knockout |
| **Clearroot** | Remove all negative statuses from one living Kin. | Universal status answer |
| **Waystone** | Leave successfully after an encounter. | Extraction and push-your-luck control |
| **Smoke Husk** | Escape a non-boss battle without rewards. | Emergency combat escape |
| **Grave Ash** | Deal reliable fixed damage to one enemy. | MP-free emergency offense |
| **Null Salt** | Remove positive stat stages from one enemy. | Boss and elite counterplay |

Start with one universal status cure. Split it into cheaper specialized cures only if poison, burn, sleep, and similar effects become common enough that preparing for a particular depth band is an informed decision.

### Damage-item rule

Using a combat item consumes the acting Kin's turn. Damage items therefore need a reason to beat a normal ability: they should be reliable, cost no MP, provide otherwise unavailable damage coverage, or carry a useful secondary effect.

Fixed damage should scale enough to remain relevant across tower bands while dealing reduced percentage-based damage to bosses. It should rescue a strained party, not replace Kin abilities.

## Charged Preparations

Preparations are temporary, multi-use backpack items offered primarily after battle. They do not trigger merely because they are carried. Before committing to an encounter, the player may spend one charge to prepare that effect for the next battle.

This activation model lets the player save charges deliberately and avoids silently wasting a damage bonus on an easy encounter. A Preparation remains in its backpack slot until its final charge is spent, then disappears.

Initial examples:

| Preparation | Effect | Charges |
| --- | --- | --- |
| **Distiller's Seal** | Increase Obols earned from the next victorious battle by 10%. Because only leftover Obols convert, this indirectly increases potential Essence rather than minting permanent currency immediately. | 3 |
| **War Chorus** | All allied Kin deal 10% more damage during the next battle. | 2 |
| **Mender's Incense** | After the next victorious battle, restore 10% maximum HP to each living Kin. | 3 |
| **Quiet Bell** | Reduce all allied MP costs by 1 during the next battle, to a minimum of 1. | 2 |
| **Warding Thread** | Reduce party damage received during the first round of the next battle. | 2 |

Only one Preparation should be committed to an encounter initially. That produces a clear choice and prevents several modest bonuses from multiplying into an automatic boss deletion. Relics may still interact with the prepared battle because they are the expedition's broader build layer.

Preparations differ from Relics in four important ways:

| Preparations | Relics |
| --- | --- |
| Occupy backpack space | Use dedicated Relic space |
| Activate only when the player chooses | Apply automatically |
| Have limited charges | Last for the expedition |
| Solve a chosen future encounter | Shape the overall run |

The first example should technically award **10% more Obols**, not “10% more Essence after battle.” Essence is only created when leftover Obols convert on departure, so preserving that wording keeps the currency model coherent.

## One Permanent Item: The Heirloom

Add a collection of permanent **Heirlooms**, but allow the active party to equip only **one Heirloom total per expedition**. A specific Kin carries it, giving the object provenance without adding three more simultaneous passive builds.

Heirlooms:

* persist between expeditions;
* do not occupy backpack space;
* are manually equipped in town;
* provide a small rule change or a once-per-expedition effect, not a large stat bonus;
* are physical objects, so breeding does not copy or destroy them;
* return to the collection when their holder retires and may later be carried by an offspring.

Example effects:

| Heirloom | Effect |
| --- | --- |
| **Lastlight Charm** | Once per expedition, its holder survives lethal damage at 1 HP. |
| **Field Flask** | Once per expedition, restore a modest amount of HP to one Kin. |
| **Null Bell** | Once per expedition, clear all party statuses. |
| **Wayfinder's Locket** | Acts as a rechargeable Waystone once per expedition, earned only in later progression. |
| **Binder's Needle** | Protect the first found trait in an otherwise vulnerable backpack slot. |

Heirlooms should record notable ownership:

> *Carried by Ember when the Floor 20 Warden fell. Later carried by Ember's daughter, Cinder.*

Marks can be one of the principal ways Heirlooms are discovered. This connects permanent objects to memorable feats rather than placing them in an ordinary shop.

## Marks as Mysterious Permanent Discoveries

Keep the part of Marks that creates mystery: unusual things can happen during an expedition, and discovering them permanently changes what the player can find or use.

Change the current model in three ways:

1. A discovered Mark is permanent immediately; it does not fade and requires no Essence payment.
2. A Mark is a recorded deed and content unlock, not another equipped percentage bonus.
3. Conditions may remain hidden until discovered, with clues in their names, descriptions, bestiary entries, or world events.

Possible Mark rewards include:

* unlock an Heirloom;
* add a new Relic to future expedition pools;
* add a new Preparation or consumable to post-battle rewards and shops;
* unlock a cosmetic variant, title, or lineage epithet;
* add a rare Trait to the Trait-keeper's stock;
* reveal a new event, breeding option, or boss rematch.

Examples:

| Hidden deed | Mark discovered | Permanent unlock |
| --- | --- | --- |
| Defeat a boss with all three Kin sharing an archetype. | **Kindred Victory** | Unlock a party-affinity Relic. |
| Win three battles in one expedition while a Kin remains below 20% HP. | **Last Light** | Unlock the Lastlight Charm Heirloom. |
| Defeat a burning enemy using ice damage. | **Temper the Flame** | Add Frost Phials to the reward pool. |
| Carry a captured Kin through two boss victories before departing. | **Long Road Home** | Unlock a capture-protection Heirloom or town upgrade. |

The accomplishing Kin and expedition should still be recorded so the deed contributes to that Kin's history. The unlocked content belongs to the player permanently, so retirement does not erase the accomplishment.

This preserves the “what did I just discover?” feeling without asking Marks, Traits, and Heirlooms to compete as three equipped permanent combat-build systems. The Mark-binder would no longer be necessary unless it is repurposed as a place for viewing clues and discovered deeds.

## Expected Expedition Rhythm

1. Prepare a party, one Heirloom, and a limited backpack.
2. Enter the tower knowing the next guaranteed departure point.
3. Spend HP, MP, and consumables in battle.
4. Choose immediate relief or carryable future power after a victory.
5. Commit a Preparation to a dangerous encounter or save its charges for later.
6. Choose between supplies, captures, and found traits as the backpack fills.
7. Use a Waystone to bank the take or continue toward the next boss departure.
8. Occasionally discover a hidden Mark that permanently expands future possibilities.
9. Return with permanent Kin progress, bloodline opportunities, and a story about what was risked.

The intended result is not simply a harsher tower. It is a tower in which leaving safely is something the player prepares for, earns, and chooses.

## Decisions Needed Before Implementation

1. Confirm the redesigned Mark model: permanent discoveries and unlocks, not bindable equipped bonuses.
2. Confirm the five-floor boss departure cadence.
3. Decide whether Waystones can be purchased in town, found only in the tower, or both.
4. Decide the number and composition of post-battle reward choices.
5. Confirm one committed Preparation per battle and whether unused active effects can be cancelled.
6. Confirm one active Heirloom per **party**, rather than one per Kin.
7. Decide whether the Mark-binder is removed or repurposed as a discovery journal.
8. Tune item strengths, prices, drop rates, and boss resistance only after the loop is playable.
