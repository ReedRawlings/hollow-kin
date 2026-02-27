# **Hollow Kin — Economy & Balancing Framework**

*Working Document — Subject to Change*

---

## **Overview**

This document defines the resource economy, progression pacing, and balancing targets for Hollow Kin. Every resource, drop rate, and cost should ultimately serve one goal: the player should always feel like they have a meaningful next step without feeling stuck or overwhelmed. The economy is the invisible hand that paces the breeding loop, town upgrades, and run-to-run progression.

---

## **Core Resources**

### **Plasm**

The capture resource. Accumulated during runs from winning battles.

* Plasm is spent to attempt creature captures during a run
* More Plasm held = higher base capture chance
* Plasm is **lost on run failure** (anything not in a safe inventory slot)
* Plasm does not persist between runs — it is earned and spent within a single run

### **Breeding Stones**

The Enhancer's primary consumable. Used to influence breeding outcomes.

* Dropped from combat encounters and zone boss rewards
* Single-use — consumed when applied at the Enhancer
* Different stone types influence different aspects of breeding (specific types TBD)
* Breeding Stones **survive run failure** if stored in a safe inventory slot
* Scarcity target: a player should accumulate enough stones for one meaningful Enhancer use every 2–3 runs

### **Breeding Relics**

Produced when a creature retires without a breeding partner.

* One relic per retired creature
* Based on either the creature's active trait or active mark (player chooses)
* Used at the Enhancer to inject a trait into a future breeding event
* Relics are stored in town and are not at risk during runs

### **Town Resources**

Generic building materials used to upgrade town buildings.

* Gathered as loot from combat encounters during runs
* Distinct from Breeding Stones — different drop pool
* Town Resources **survive run failure** if in a safe inventory slot
* Multiple resource types may exist per building (TBD during building upgrade tree design)

---

## **Progression Pacing Targets**

These are rough benchmarks to anchor design decisions. All numbers are subject to playtesting.

### **Early Game (Runs 1–10)**

* Player is learning combat, breeding, and the run loop
* Starting creatures have low longevity (2 runs) — breeding pressure kicks in almost immediately
* First breeding event should happen by run 3–4
* First town upgrade (Creature Box expansion) should be affordable by run 5–6
* Player should have captured 2–3 wild creatures and completed 1–2 successful breedings

### **Mid Game (Runs 11–30)**

* Player has a stable roster of Star 2–3 creatures
* Breeding becomes more strategic — trait selection and star matching matter
* Town buildings are partially upgraded
* The Enhancer is unlocked and the player has used stones 3–5 times
* First breed-only creature discovery is likely in this range
* Players should be clearing zone 2 consistently and attempting zone 3

### **Late Game (Runs 31+)**

* Star 4–5 creatures with curated trait loadouts
* Breeding is about optimization — maximizing trait inheritance, targeting specific abilities
* Town buildings are mostly maxed
* The player is pushing for full tower clears and mark collection
* Longevity pressure is lower (10+ runs per creature) so the player has more freedom to experiment

---

## **Drop Rate Framework**

| Resource | Source | Approximate Rate |
| ----- | ----- | ----- |
| Plasm | Every combat encounter | Scales with zone depth. Zone 1: low, Zone 3: high |
| Breeding Stones | Combat encounters, boss rewards | ~1 stone per 3–4 encounters |
| Town Resources | Combat encounters, event rewards | ~1 resource bundle per 2–3 encounters |
| Capture opportunity | Enemy creature in encounter | Every combat encounter has capturable enemies |

### **Boss Rewards**

Zone bosses drop significantly better loot:

* 2–3x the Plasm of a standard encounter
* Guaranteed Breeding Stone (higher quality than random drops)
* Town Resources
* Access to the boss creature for breeding

---

## **Capture Economy**

* Plasm accumulates across a run — the player gets stronger capture chances as they progress deeper
* Capture probability: `base_chance = (plasm_held / plasm_threshold) * (1 - target_hp_percent)`
* This means more Plasm and lower target HP both increase the chance
* `plasm_threshold` is a tuning constant per zone — higher zones require more Plasm per capture
* Failed captures consume a portion of Plasm (proposed: 25% of the attempt cost)
* This creates tension: capture early with lower odds, or save Plasm for a better attempt later

---

## **Town Building Costs**

Rough framework for upgrade pacing:

| Building | Upgrades | Cost Curve | Target Full Upgrade |
| ----- | ----- | ----- | ----- |
| Creature Box | 5–6 tiers (2 slots → 12+ slots) | Linear early, steeper late | ~20 runs |
| Leathersmith | 4–5 tiers | Linear | ~15 runs |
| Enhancer | 5+ tiers (unlocks new stone types and options) | Steep — this is the prestige building | ~30+ runs |

The Enhancer is intentionally the most expensive building because its upgrades have the most impact on breeding quality and long-term progression.

---

## **Inventory and Risk**

* The player's inventory has limited slots (upgraded via Leathersmith)
* Some slots are **safe** — items stored here survive run failure
* Most slots are **at-risk** — items here are lost if the run ends in failure
* Safe slots are limited (proposed: 1–2 at base, up to 4–5 fully upgraded)
* This creates meaningful risk/reward decisions: carry more items for flexibility, or play safe and protect key resources?

---

## **Balancing Levers**

Key variables that can be tuned during playtesting:

* **Plasm per encounter** — controls capture frequency
* **Plasm threshold per zone** — controls capture difficulty scaling
* **Stone drop rate** — controls breeding enhancement frequency
* **Town resource drop rate** — controls town upgrade pacing
* **Longevity values** — controls breeding pressure
* **Level cap per star** — controls how long a creature is useful per run
* **Safe slot count** — controls risk tolerance
* **Revival HP percentage** — controls encounter-to-encounter attrition

---

## **Open Questions**

* Specific Breeding Stone types and their effects
* Whether Plasm should persist partially between runs or reset completely
* Exact safe slot progression per Leathersmith upgrade
* Whether there are any premium or rare resources beyond the four core types
* How the economy adjusts for players who consistently fail runs — is there a pity system or catch-up mechanic?
* Whether town upgrades should have prerequisite chains or be freely purchasable in any order
