# **Hollow Kin — Marks Catalog**

*Balancing Document — Subject to Change*

---

## **Overview**

This document catalogs all marks in the game with their earn thresholds and effects. For mark system rules (earning, equipping, retirement, breeding interaction), see the Marks System doc. This doc is the balancing reference for individual mark entries.

---

## **Mark Rules Summary**

* Earned by hitting a threshold within a single run
* One mark active at a time per creature — player swaps freely outside of runs
* Earned marks are permanent — the full collection is always available
* Marks are not inherited through breeding — they transfer only via the retirement relic system

---

## **Floor Marks**

| ID | Name | Earn Condition | Effect | Stacking Notes |
| --- | --- | --- | --- | --- |
| mark_floor_z1 | Floor Mark — Zone 1 | Defeat the Zone 1 boss | +5% damage to all enemies in Zone 2 and beyond | Stacks additively with other Floor Marks |
| mark_floor_z2 | Floor Mark — Zone 2 | Defeat the Zone 2 boss | +5% damage to all enemies in Zone 3 and beyond | Stacks additively |
| mark_floor_z3 | Floor Mark — Zone 3 | Defeat the Zone 3 boss | +5% damage to all enemies (applies everywhere) | Stacks additively |

*Note: Whether multiple Floor Marks stack or a creature can only hold one is TBD during balancing.*

---

## **Combat Threshold Marks — Damage Type**

| ID | Name | Earn Condition | Effect | Notes |
| --- | --- | --- | --- | --- |
| mark_fire | Pyromaniac | Deal 1000 fire damage in a single run | +10% fire damage dealt | Natural fit for Mecha |
| mark_ice | Frostbite | Deal 1000 ice damage in a single run | +10% ice damage dealt | Natural fit for Human, Kami |
| mark_electric | Conductor | Deal 1000 electric damage in a single run | +10% electric damage dealt | Natural fit for Mecha |
| mark_ghost | Specter | Deal 1000 ghost damage in a single run | +10% ghost damage dealt | Natural fit for Spirits |
| mark_wind | Gale Runner | Deal 1000 wind damage in a single run | +10% wind damage dealt | TBD primary archetype |
| mark_physical | Brawler | Deal 1500 physical damage in a single run | +10% physical damage dealt | Natural fit for Fauna, Rock, Human |
| mark_fighting | Pugilist | Deal 1000 fighting damage in a single run | +10% fighting damage dealt | Threshold TBD based on ability availability |

---

## **Combat Threshold Marks — Role**

| ID | Name | Earn Condition | Effect | Notes |
| --- | --- | --- | --- | --- |
| mark_healer | Mender | Heal 500 HP to allies in a single run | Restore 2 HP to the team at the start of each battle | Natural fit for Flora |
| mark_tank | Bulwark | Take 2000 damage in a single run without being KO'd | +10% DEF | Natural fit for Rock |
| mark_debuffer | Hexer | Successfully land 10 debuffs in a single run | Debuffs applied by this creature last 1 extra turn | Natural fit for Spirits, Kami |
| mark_buffer | Catalyst | Successfully apply 10 buffs to allies in a single run | Buffs applied by this creature are 10% stronger | Natural fit for Flora, Food |
| mark_speed | Quicksilver | Act first in 10 or more turns in a single run | +5% SPD | Natural fit for Fauna, Mecha |
| mark_survivor | Last Stand | Win a battle as the last creature standing | +10% damage when sole surviving party member | Situational / any archetype |

---

## **Thresholds Balancing Notes**

* Damage thresholds (1000/1500) are calibrated against a mid-game run where a focused creature deals roughly 100–150 damage per combat encounter across 5–7 combats per zone
* Healing threshold (500) assumes a dedicated healer uses 2–3 heals per combat
* Debuff/buff thresholds (10) assume 1–2 applications per combat across a zone
* All thresholds are subject to playtesting — they should feel achievable in a good run but not automatic

---

## **Open Questions**

* Exact damage thresholds per type — should rare damage types (ghost, wind) have lower thresholds?
* Whether there should be "hidden" marks discoverable only through unusual play
* Whether mark effects should scale with star rating or remain flat
* Threshold values for any marks not yet assigned numbers
