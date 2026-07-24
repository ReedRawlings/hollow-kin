# **Hollow Kin — Economy & Balancing Framework**

*Working Document — Subject to Change*

---

## **Overview**

This document defines the resource economy, progression pacing, and balancing targets for Hollow Kin. Every resource, drop rate, and cost should ultimately serve one goal: the player should always feel like they have a meaningful next step without feeling stuck or overwhelmed. The economy is the invisible hand that paces the breeding loop, permanent progression, and run-to-run growth.

**All numbers below are starting placeholders for playtest tuning.**

---

## **Core Resource — Essence**

Essence is the **single permanent currency** in Hollow Kin. There are no parallel currencies; essence absorbs every economic role the old plasm/stones system split apart.

### **Earning Essence**

Essence is harvested from **every fight**. The total earned per run scales with the **number of battles completed**, weighted by fight type:

| Fight type | Cadence | Essence (placeholder) |
| ----- | ----- | ----- |
| Normal encounter | Most floors | 5 |
| Mini-boss | Every 5 floors | 25 |
| Major boss | Every 10 floors | 75 |

Weighting is always `normal < mini-boss < major boss`. These values are starting placeholders to be tuned against the level-cost curve below.

### **One Wallet, Two Demands**

Essence earned in a run can be spent **right now** to survive the descent (heals, revives, capture) **or** banked and carried back to town for **permanent** upgrades (levels, traits, marks, depth-jumps, backpack). It is one shared pool, so every heal is a permanent level you didn't buy. This spend-now-vs-bank tension is the core heartbeat of a run and replaces the old plasm economy entirely.

* Essence is **permanent and non-refundable.** Once spent on a pet (a permanent level, trait, or bound mark), it is locked to that pet — it cannot be reclaimed for a future pet.
* Essence banked back to town persists across runs. Essence spent in-run on survival is simply gone.

> **Open for playtest:** the design assumes a *single* essence pool shared between in-run survival and permanent town spends. A split (separate in-run vs. permanent pools) is the fallback if the shared pool feels bad.

---

## **Permanent Level Cost Curve**

Essence raises a pet's **permanent starting-level floor** — the level it begins each run at instead of level 1. (Pets may still gain temporary levels within a run on top of this floor; those vanish at run end. See the breeding/progression docs for Model A vs. the no-temp-leveling fallback.)

The **cost per level rises classically** so leveling naturally decelerates. Starting placeholder formula:

```
essence_cost(next_level) = base * next_level^exponent
base = 10, exponent = 1.5
```

| Level bought | Cost (placeholder) | Cumulative |
| ----- | ----- | ----- |
| 1 → 2 | 10 | 10 |
| 2 → 3 | 28 | 38 |
| 3 → 4 | 52 | 90 |
| 4 → 5 | 80 | 170 |
| 5 → 6 | 112 | 282 |

**Target pace:** a strong early run (clearing to ~floor 10) should net roughly **2–3 permanent levels** — enough that a run feels rewarding and enemies have something to scale against, without trivializing long-term progression. The `base`/`exponent` values are tuned against the essence earn weights above to hit this target.

A pet's level is still ceilinged by its **star rating** (the existing sigmoid cap). Essence fills *toward* that cap but cannot exceed it; breeding still raises stars. (Longer-term the design may remove stars and let essence own the cap directly — nothing should hard-couple to stars.)

---

## **Depth-Jumps**

The tower is one continuous 30-floor descent with a **mini-boss every 5 floors** and a **major boss every 10 floors**. At each 5-floor break the player can purchase a **permanent start point** with essence. Buying a break starts future runs at the floor *after* it:

* Buy floor 5 → start at floor 6
* Buy floor 10 → start at floor 11
* …and so on up the tower.

Depth-jumps are **gated by having cleared that break's boss** — you can only buy a jump to a break you've already reached. Cost rises with depth (deeper starts skip more essence-earning fights, so they must cost more than they'd yield):

| Break cleared | Start floor unlocked | Cost (placeholder) |
| ----- | ----- | ----- |
| Floor 5 | 6 | 150 |
| Floor 10 | 11 | 400 |
| Floor 15 | 16 | 800 |
| Floor 20 | 21 | 1400 |
| Floor 25 | 26 | 2200 |

Prices are starting placeholders to be tuned so a jump is a real bank-vs-spend decision, not an obvious purchase.

---

## **Progression Pacing Targets**

These are rough benchmarks to anchor design decisions. All numbers are subject to playtesting.

### **Early Game (Runs 1–10)**

* Player is learning combat, breeding, and the run loop
* First permanent levels bought within the first few runs; a strong run nets 2–3 levels
* First breeding event should happen by run 3–4
* First depth-jump (floor 5 break) becomes affordable once the player is banking rather than spending everything on survival
* Player should have captured 2–3 wild creatures and completed 1–2 successful breedings

### **Mid Game (Runs 11–30)**

* Player has a stable roster of Star 2–3 creatures with several permanent levels each
* Breeding becomes more strategic — trait selection and star matching matter, and essence/level carry-over to offspring softens the retirement cost
* Multiple depth-jumps unlocked; player routinely starts deeper
* First breed-only creature discovery is likely in this range
* Players should be reaching the floor-15/20 bosses consistently

### **Late Game (Runs 31+)**

* Star 4–5 creatures with curated trait loadouts and high permanent-level floors
* Breeding is about optimization — maximizing trait inheritance, targeting specific abilities
* Depth-jumps mostly purchased; runs focus on the deepest floors and boss marks
* The player is pushing for full 30-floor clears and mark collection

---

## **Essence Earn Framework**

| Source | Essence (placeholder) | Notes |
| ----- | ----- | ----- |
| Normal encounter | 5 | Most floors |
| Mini-boss (every 5 floors) | 25 | |
| Major boss (every 10 floors) | 75 | Also gates the depth-jump for that break |
| Capture opportunity | — | Every combat encounter has capturable enemies |

Total run yield scales with how many battles the player completes, so pushing deeper is the main way to earn more essence.

---

## **Capture Economy**

Capture is now an **in-run essence spend** (the same wallet used for heals, revives, and banked permanent upgrades).

* Spending more essence on a capture attempt raises its odds — the player weighs capture against survival and against banking for town
* Capture probability: `base_chance = (essence_spent / capture_threshold) * (1 - target_hp_percent)`
* This means more essence committed and lower target HP both increase the chance
* `capture_threshold` is a tuning constant that rises with depth — deeper floors demand more essence per capture
* Failed captures consume a portion of the essence committed (proposed: 25%)
* This creates tension: spend essence to capture now, heal to survive, or bank it for permanent progression

---

## **Town — Essence Sinks**

Town is an **essence hub**: a set of "folks" who turn banked essence into permanent progress. The old Enhancer and Leathersmith are gone. Rough framework for spend pacing:

| Station | Function | Essence? | Cost shape |
| ----- | ----- | ----- | ----- |
| Creature Box | View creatures, manage party | No | — (management only) |
| Leveler | Buy permanent levels | Yes | Classical rising curve (above) |
| Trait-keeper | Unlock trait slots / levels | Yes | Rising per unlock |
| Mark-binder | Make an earned mark permanent | Yes | Flat-ish per mark |
| Gatekeeper | Unlock depth-jumps | Yes | Rising with depth (above) |
| Quartermaster | Increase backpack capacity for descent items | Yes | Linear early, steeper late |
| Breeder | Breed a pair (retire parents, carry-over to offspring) | Yes | Per breed |

The Quartermaster inherits the Leathersmith's old job — backpack/inventory capacity for items carried on the descent — as an essence vendor. Because every station draws from the same essence pool, the town itself competes with in-run survival spending for the player's attention.

---

## **Inventory and Risk**

* The player's inventory (backpack) has limited slots, upgraded via the **Quartermaster** with essence
* The backpack holds items to use on the descent; more capacity means more flexibility per run
* Banked essence carried back to town is never at risk — it is committed only when spent
* This creates meaningful risk/reward decisions on the descent: spend essence on survival to push deeper for more essence, or play safe and bank what you have

---

## **Balancing Levers**

Key variables that can be tuned during playtesting:

* **Essence earn weights** — normal / mini-boss / major-boss values; controls total run yield
* **Level cost curve steepness** (`base`, `exponent`) — controls how fast permanent leveling decelerates and whether a strong run hits the 2–3-level target
* **Depth-jump prices per 5-floor break** — controls how eagerly players skip early floors
* **Capture threshold per depth** — controls capture difficulty scaling
* **Level cap per star** — controls how high essence can raise a pet before breeding is needed (until/unless stars are removed)
* **Backpack capacity curve** — controls descent-item flexibility
* **Revival HP percentage** — controls encounter-to-encounter attrition
* **Single vs. split essence pool** — whether in-run and permanent spends share one wallet

---

## **Open Questions**

* Exact essence earn weights and how they interact with the level cost curve to hit the 2–3-levels-per-strong-run target
* Whether in-run temporary leveling (Model A) survives, or we fall back to permanent-only levels (Model B)
* Whether stars survive as the level cap (Model A) or get removed so essence owns the cap directly (Model C)
* Whether a single essence pool (in-run + permanent) holds up, or in-run vs. permanent pools should be split
* How much invested essence/levels carry over to offspring on breeding
* How the economy adjusts for players who consistently fail runs — is there a pity system or catch-up mechanic?
* Whether town stations should have prerequisite chains or be freely purchasable in any order
