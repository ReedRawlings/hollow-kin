# **Hollow Kin — Economy & Balancing Framework**

*Working Document — Subject to Change*

> **Owns:** Obol earn weights, the Obols→Essence conversion rate, the permanent level cost curve, depth-jump prices, capture economy, essence sinks, progression pacing targets, and the balancing levers.
> **Defers to the GDD on:** the progression model itself and what persists across runs.
> **Last verified:** 2026-07-28 — conversion rate, wipe penalty, level-cost curve and depth-jump pricing re-checked against `types.ts` / `Economy.ts`.
>
> **Every number in this document is a placeholder for playtest tuning.** Pin relationships between constants, not the values.

---

## **Overview**

This document defines the resource economy, progression pacing, and balancing targets for Hollow Kin. Every resource, drop rate, and cost should ultimately serve one goal: the player should always feel like they have a meaningful next step without feeling stuck or overwhelmed. The economy is the invisible hand that paces the breeding loop, permanent progression, and run-to-run growth.

**All numbers below are starting placeholders for playtest tuning.**

---

## **Two-Tier Currency — Obols (in-run) → Essence (permanent)**

Hollow Kin runs on **two currencies with one direction of flow**. **Obols** are the run-scoped fuel earned and spent *during* a descent; **Essence** is the single permanent store of value. Obols are not a competing permanent currency — on leaving the tower, whatever Obols you *didn't* spend convert to Essence. Together they absorb every economic role the old plasm/stones system split apart.

### **Earning Obols**

Obols are harvested from **every fight**. The total earned per run scales with the **number of battles completed**, weighted by fight type:

| Fight type | Cadence | Obols (placeholder) |
| ----- | ----- | ----- |
| Normal encounter | Most floors | 5 |
| Mini-boss | Every 5 floors | 25 |
| Major boss | Every 10 floors | 75 |

Weighting is always `normal < mini-boss < major boss`. These values are starting placeholders to be tuned against the conversion rate and level-cost curve below.

### **Spend Now vs. Bank for Conversion**

Obols can be spent **right now** to survive the descent (heals, revives, capture, shop items) **or** left unspent so they **convert to Essence on exit** for **permanent** upgrades (levels, traits, marks, depth-jumps, backpack). Because only *leftover* Obols convert, every heal is Essence you didn't bank. This spend-now-vs-bank tension is the core heartbeat of a run and replaces the old plasm economy entirely.

* **Obols never persist.** They are a run-local resource. What you don't spend converts to Essence on exit; what you do spend is simply gone.
* **Essence is permanent and non-refundable.** Once spent on a pet (a permanent level, trait, or bound mark), it is locked to that pet — it cannot be reclaimed for a future pet.
* A **full wipe loses 50% of leftover Obols** — only half converts to Essence if the run ends in a wipe rather than a chosen exit (a deliberate exit — including fleeing the tower via the **FLEE TOWER** button — or a win converts 100%). On a wipe the player also loses **exactly one thing at random from unprotected inventory** — **not the whole inventory**. That one thing may be a consumable, an item, or a **captured creature**; only the guaranteed inventory space protects against it, and the three creatures the player entered with are never at risk. The 50% figure and the one-loss rule are placeholder push-your-luck levers, tunable in playtest.

> **Resolved:** the earlier single-shared-pool model (one essence pool spent both in-run and permanently) was rejected as too punishing. The two-tier Obols→Essence model with leftover-only conversion replaces it.

---

## **Obols → Essence Conversion Rate**

On leaving the tower, leftover Obols convert to Essence at a **conversion rate**. This rate is a **primary progression lever** — it decides how much of a hoarded run actually becomes permanent power, so it is tuned alongside the earn weights and the level-cost curve.

**Base rate (placeholder):** `1 Essence per 2 leftover Obols` (a 0.5 conversion ratio). Deliberately lossy at baseline, so raising the rate feels like a meaningful upgrade.

```
essence_gained = floor(leftover_obols * conversion_rate)
conversion_rate = base_rate + trait_bonus + upgrade_bonus + depth_bonus
base_rate = 0.5   // placeholder
```

The rate is boosted by three stacking levers:

* **Traits** — e.g. an **"Essence Distiller"** trait raises the ratio for the pet carrying it (placeholder: +0.1 per level).
* **Quartermaster upgrades** — a permanent essence spend in town that raises the global conversion rate (see Town — Essence Sinks). This is the natural long-term investment sink for the leftover economy.
* **Depth** — reaching deeper floors improves the rate (placeholder: +0.05 per 5-floor break cleared), rewarding pushes and pairing naturally with the risk that a deep wipe halves that run's leftover Obols.

Because conversion is **leftover-only**, the rate never rewards spending — only what you carry out is multiplied. A high conversion rate makes hoarding more attractive, which sharpens the spend-vs-bank decision rather than removing it.

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

**Target pace:** a strong early run (clearing to ~floor 10) should net roughly **2–3 permanent levels** — enough that a run feels rewarding and enemies have something to scale against, without trivializing long-term progression. Note the essence for these levels no longer comes straight from fights: it is *converted from leftover Obols on exit*. So this target depends on **three** knobs together — the Obol earn weights, how much the player banks rather than spends, and the **conversion rate** — not just the `base`/`exponent` of the curve.

A pet's level is ceilinged by its **star rating** (the existing sigmoid cap). Essence fills *toward* that cap but cannot exceed it; breeding still raises stars. Stars are staying, and because trait slots unlock at permanent levels 5/10/20/30, the star cap also decides how many traits a pet can ever hold — which makes the level curve a **trait**-pacing lever as well as a stat one.

---

## **Trait Costs**

Trait **slots** cost nothing directly — they unlock as permanent level rises (5/10/20/30), so they are already paid for through the level cost curve above. Essence at the Trait-keeper buys trait **content and strength**.

| Spend | Essence (placeholder) |
| ----- | ----- |
| Buy a baseline trait from stock | TBD |
| Imbue a held trait into a slot | TBD |
| Trait Level 1 → 2 | 240 |
| Trait Level 2 → 3 | 540 |
| Trait Level 3 → 4 | 960 |
| Sell back a duplicate | Small — a consolation, not income |

> **Relationship to preserve:** a trait upgrade costs roughly **one mid-game permanent level**. With `essence_cost(level) = 10 · level^1.5`, level 10→11 is ~365 and 20→21 is ~962. If the level curve is retuned, retune the trait upgrades alongside it — the point is that raising a trait is a comparable investment to raising a level, not a rounding error against it.

Deeper in the tower, traits can drop already at Level 2–4, skipping some or all of the upgrade cost. This makes depth a direct trait-power lever; the depth-to-drop-level mapping is not yet fixed.

---

## **Depth-Jumps**

The tower is one continuous descent — 100 floors in 10 bands, capped at 20 for alpha — with a **mini-boss every 5 floors** and a **major boss every 10 floors**. At each 5-floor break the player can purchase a **permanent start point** with essence. Buying a break starts future runs at the floor *after* it (a break with no floor below it is never offered, so the deepest purchasable break under the alpha cap is 15):

* Buy floor 5 → start at floor 6
* Buy floor 10 → start at floor 11
* …and so on up the tower.

Depth-jumps are gated by having cleared that break's boss — you can only buy a start floor for a break you've already reached. The cost comes in **two parts**, both paid in banked Essence and never from in-run Obols:

```
depthUnlockCost(floor) = max(0, (floor - 1) * DEPTH_UNLOCK_COST_PER_FLOOR)   // one-time, 40/floor
depthRunFee(floor)     = max(0, (floor - 1) * DEPTH_RUN_FEE_PER_FLOOR)       // every run, 5/floor
```

(both placeholders). **Unlock** is a one-time permanent purchase at the Gatekeeper. **The run fee** is then charged again at the start of every run that departs from that floor. Floor 1 is always free on both counts. So floor 6 costs 200 to unlock and 25 each time you use it; floor 16 costs 600 and 75 per run.

The split is the point: the unlock is the big bank-vs-spend moment, and the recurring fee stops a bought depth from being a pure free win forever. If the player can't afford the fee when the run begins, the run falls back to floor 1 rather than failing.

> An earlier draft charged a single per-run `(floor - 1) * 15` with no permanent unlock. That model is gone — do not reintroduce it. Anything still quoting ×15 is stale.

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
* The player is pushing for full-depth clears and mark collection — floor 20 under the alpha cap, eventually floor 100

---

## **Obols Earn Framework**

| Source | Obols (placeholder) | Notes |
| ----- | ----- | ----- |
| Normal encounter | 5 | Most floors |
| Mini-boss (every 5 floors) | 25 | |
| Major boss (every 10 floors) | 75 | Also gates the depth-jump for that break |
| Capture opportunity | — | Every combat encounter has capturable enemies |

Total run yield scales with how many battles the player completes, so pushing deeper is the main way to earn more Obols — and, since only leftover Obols convert, the main way to bank more Essence.

---

## **Capture Economy**

Capture is an **in-run Obol spend** (the same run-scoped wallet used for heals, revives, and shop items).

* Spending more Obols on a capture attempt raises its odds — the player weighs capture against survival and against keeping Obols to convert on exit
* Capture probability: `base_chance = (obols_spent / capture_threshold) * (1 - target_hp_percent)`
* This means more Obols committed and lower target HP both increase the chance
* `capture_threshold` is a tuning constant that rises with depth — deeper floors demand more Obols per capture
* Failed captures consume a portion of the Obols committed (proposed: 25%)
* This creates tension: spend Obols to capture now, heal to survive, or hoard them to convert into permanent Essence

---

## **Town — Essence Sinks**

Town is an **essence hub**: a set of "folks" who turn banked essence into permanent progress. The old Enhancer and Leathersmith are gone. Rough framework for spend pacing:

| Station | Function | Essence? | Cost shape |
| ----- | ----- | ----- | ----- |
| Creature Box | View creatures, manage party | No | — (management only) |
| Leveler | Buy permanent levels | Yes | Classical rising curve (above) |
| Trait-keeper | Sell traits, imbue, upgrade trait levels, buy duplicates | Yes | Rising per trait level |
| Mark-binder | Make an earned mark permanent | Yes | Flat-ish per mark |
| Gatekeeper | Unlock depth-jumps | Yes | Rising with depth (above) |
| Quartermaster | Increase backpack capacity for descent items **+ raise Obols→Essence conversion rate** | Yes | Linear early, steeper late |
| Breeder | Breed a pair (retire parents, carry-over to offspring) | Yes | Per breed |

The Quartermaster inherits the Leathersmith's old job — backpack/inventory capacity for items carried on the descent — as an essence vendor, and is also the home for **conversion-rate upgrades**: a permanent essence spend that raises how much of each run's leftover Obols you keep. Town spends draw on banked **Essence**, while in-run survival draws on **Obols**, so the two never compete directly for one wallet — instead, the town competes with your decision to *hoard* Obols for conversion.

---

## **Inventory and Risk**

* The player's inventory (backpack) has limited slots, upgraded via the **Quartermaster** with essence
* The backpack holds items to use on the descent; more capacity means more flexibility per run
* Banked Essence carried back to town is never at risk — it is committed only when spent
* **A wipe costs exactly one thing at random from unprotected inventory — never the whole backpack.** Everything else carried comes home. Losing a full backpack would make carrying anything valuable punishing enough that players hoard in town and descend empty, defeating the point of having one. One loss is a sting, not a catastrophe.
* **Captured creatures are eligible for that loss.** They occupy inventory slots, so a capture sitting in an unprotected slot can be the thing that is taken. This is the tension that makes capture a decision rather than free value — the deeper you catch, the more you are gambling on getting it home.
* **The guaranteed inventory space is the hedge.** Anything in it survives a wipe, which is what makes Quartermaster capacity upgrades worth Essence: they buy certainty, not just room.
* **The three creatures the player entered with are never at risk**, regardless of inventory state.
* The *count* is fixed at one; the selection rule among unprotected contents is random.
* This creates meaningful risk/reward decisions on the descent: spend Obols on survival to push deeper for more Obols, or hoard them and convert on exit — remembering a full wipe loses half your leftover Obols and one item

---

## **Balancing Levers**

Key variables that can be tuned during playtesting:

* **Obol earn weights** — normal / mini-boss / major-boss values; controls total run yield
* **Obols→Essence conversion rate** — base rate plus the trait / Quartermaster-upgrade / depth bonuses; controls how much of a hoarded run becomes permanent power
* **Level cost curve steepness** (`base`, `exponent`) — controls how fast permanent leveling decelerates and whether a strong run hits the 2–3-level target
* **Depth-jump prices per 5-floor break** — controls how eagerly players skip early floors
* **Capture threshold per depth** — controls capture difficulty scaling
* **Level cap per star** — controls how high essence can raise a pet before breeding is needed, and therefore how many trait slots it can ever open
* **Trait upgrade costs** — controls how expensive it is to max a trait vs. hunting a pre-levelled drop
* **Trait drop rates and depth-to-drop-level mapping** — controls how much of trait power comes from luck and depth vs. essence
* **Backpack capacity curve** — controls descent-item flexibility
* **Revival HP percentage** — controls encounter-to-encounter attrition
* **Wipe penalty** — the % of leftover Obols lost on a wipe (placeholder 50%); the main push-your-luck dial

---

## **Open Questions**

* Exact Obol earn weights, the base conversion rate, and how the three interact with the level cost curve to hit the 2–3-levels-per-strong-run target
* How much traits / Quartermaster upgrades / depth should each boost the conversion rate
* Whether the wipe penalty should stay at 50%, or be higher/lower
* How large the **guaranteed inventory space** is at baseline, and how much Quartermaster capacity adds — this is the dial that sets how safe capturing feels
* Whether a captured creature should be weighted differently from an item when the random loss is rolled, or treated as just another slot
* Whether in-run temporary leveling (Model A) survives, or we fall back to permanent-only levels (Model B)
* Trait stock and imbue prices, duplicate sell-back value, and trait drop rates on bosses and events
* How much invested essence/levels carry over to offspring on breeding
* How the economy adjusts for players who consistently fail runs — is there a pity system or catch-up mechanic?
* Whether town stations should have prerequisite chains or be freely purchasable in any order
