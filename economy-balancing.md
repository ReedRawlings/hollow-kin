# **Hollow Kin — Economy & Balancing Framework**

*Working Document — Subject to Change*

> **Owns:** Obol earn weights, the Obols→Essence conversion rate, the permanent level cost curve, depth-jump prices, capture economy, essence sinks, progression pacing targets, and the balancing levers.
> **Defers to the GDD on:** the progression model itself and what persists across runs.
> **Last verified:** 2026-07-30 — conversion rate, wipe penalty, level-cost curve, Obol depth scaling, depth-jump pricing and the capture price model all re-checked against `types.ts` / `Economy.ts` / `Capture.ts`. Corrected in that pass: the removed FLEE TOWER button, the superseded capture-probability formula, the missing Obol depth-scaling term, and two rounding errors in the level-cost table.
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

Obols are harvested from **every fight**. The total earned per run scales with the **number of battles completed**, weighted by fight type — **and with the depth the fight happened at**:

```
obols(kind, floor) = OBOL_REWARDS[kind] × OBOL_REWARD_SCALAR × floor^OBOL_REWARD_EXPONENT
```

| Fight type | Cadence | Base (placeholder) | At floor 1 | At floor 20 |
| ----- | ----- | ----- | ----- | ----- |
| Normal encounter | Most floors | 5 | 5 | 22 |
| Mini-boss | Every 5 floors | 25 | 25 | 112 |
| Major boss | Every 10 floors | 75 | 75 | 335 |

Weighting is always `normal < mini-boss < major boss`. The base values are starting placeholders to be tuned against the conversion rate and level-cost curve below.

> **`OBOL_REWARD_EXPONENT` is not a free parameter — it is derived.**
>
> ```
> OBOL_REWARD_EXPONENT === LEVEL_COST_EXPONENT - 1
> ```
>
> A creature that clears floor F is roughly level F, so the marginal cost of one more
> floor of reach is ~`LEVEL_COST_BASE × F^LEVEL_COST_EXPONENT`. A run to floor F earns the
> sum of its floors, which grows as `F^(OBOL_REWARD_EXPONENT + 1)`. Progression pace holds
> constant only when those match. **Retune the two together, never separately.**
>
> At an exponent of 0 — flat rewards, the behaviour before depth scaling landed — every
> floor of progress costs more runs than the last, floors 1–10 pay exactly what floors
> 21–30 pay, and the EV-optimal exit sits around floor 20, making the deepest third of the
> tower not worth attempting.
>
> `OBOL_REWARD_SCALAR` is the independent knob: it sets total game length and has no
> effect on pace. At 1.0, floor 1 pays exactly the base reward, so the scaling is purely
> additive — no floor pays less than it did before; depth simply pays more. Lower it to
> lengthen the game.

### **Spend Now vs. Bank for Conversion**

Obols can be spent **right now** to survive the descent (heals, revives, capture, shop items) **or** left unspent so they **convert to Essence on exit** for **permanent** upgrades (levels, traits, marks, depth-jumps, backpack). Because only *leftover* Obols convert, every heal is Essence you didn't bank. This spend-now-vs-bank tension is the core heartbeat of a run and replaces the old plasm economy entirely.

* **Obols never persist.** They are a run-local resource. What you don't spend converts to Essence on exit; what you do spend is simply gone.
* **Essence is permanent and non-refundable.** Once spent on a pet (a permanent level, trait, or bound mark), it is locked to that pet — it cannot be reclaimed for a future pet.
* A **full wipe loses 50% of leftover Obols** — only half converts to Essence if the run ends in a wipe rather than a chosen exit (a deliberate departure or a win converts 100%). ⚠️ **Departure is no longer free.** The old FLEE TOWER button that was available after every encounter is gone: the way out is open only on a **boss floor just cleared**, or bought as a carried **Waystone**. See `expedition-items-pitch.md` and `systems/Departure.ts`. On a wipe the player also loses **exactly one thing at random from unprotected inventory** — **not the whole inventory**. That one thing may be a consumable, an item, or a **captured creature**; only the guaranteed inventory space protects against it, and the three creatures the player entered with are never at risk. The 50% figure and the one-loss rule are placeholder push-your-luck levers, tunable in playtest.

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
essence_cost(level -> level + 1) = floor(base * level^exponent)
base = 10, exponent = 1.5
```

Note the cost is keyed on the level you are leaving, **not** the one you are buying — `essenceCostForLevel(level)` in `Economy.ts`. An earlier draft of this formula said `next_level^exponent`, which disagreed with both the table below and the code.

| Level bought | Cost (placeholder) | Cumulative |
| ----- | ----- | ----- |
| 1 → 2 | 10 | 10 |
| 2 → 3 | 28 | 38 |
| 3 → 4 | 51 | 89 |
| 4 → 5 | 80 | 169 |
| 5 → 6 | 111 | 280 |

**Target pace:** a strong early run (clearing to ~floor 10) should net roughly **2–3 permanent levels** — enough that a run feels rewarding and enemies have something to scale against, without trivializing long-term progression. Note the essence for these levels no longer comes straight from fights: it is *converted from leftover Obols on exit*. So this target depends on **three** knobs together — the Obol earn weights, how much the player banks rather than spends, and the **conversion rate** — not just the `base`/`exponent` of the curve.

A pet's level is ceilinged by its **star rating** (`STAR_LEVEL_CAPS` — a lookup table, 0★=5 rising to 12★=99, not a computed curve). Essence fills *toward* that cap but cannot exceed it; breeding still raises stars. Stars are staying, and because trait slots unlock at permanent levels 5/10/20/30, the star cap also decides how many traits a pet can ever hold — which makes the level curve a **trait**-pacing lever as well as a stat one.

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

> ⚠️ **The threshold/probability model below was replaced.** An earlier draft specified
> `base_chance = (obols_spent / capture_threshold) × (1 - target_hp_percent)` with a
> `capture_threshold` constant that rose with depth. **That is not what was built.** The
> shipped model in `systems/Capture.ts` is a **price you bid against**, and depth is
> priced by a per-band table rather than a continuous exponent. Anything still quoting
> `capture_threshold` is stale.

The built model:

```
capturePrice = captureBasePrice[towerBand] × riteBandMultiplier × hpNudge
captureChance(bid, price) = clamp(bid / price, 0, 1)
```

* **Base price is per tower band**, authored once per species per band it appears in (band 1: 20–40, climbing to band 10: 201–220). Depth is priced by *which band you meet the creature in* — there is deliberately no continuous depth exponent on top, because that would count depth twice.
* **Rites are the real lever, not coins.** Satisfying a rite replaces the multiplier rather than stacking: `unsatisfied` 1.0 → `family` 0.4 → `signature` 0.1. A satisfied signature rite is a **90% discount**, which is the point — capture is a puzzle with a price attached, not a purchase.
* **HP is a nudge, not a lever** — at most +25% at full HP (`CAPTURE_HP_NUDGE`). Lower HP still means cheaper, but it cannot substitute for a rite.
* **Bidding the full price is a certainty**; bid under it and you get exactly that fraction as your chance.
* **A rejected bid is not consumed as Obols.** It increments a rejection counter — after `CAPTURE_ENRAGE_AFTER` (3) rejections the creature **enrages** and refuses every further bid. Only satisfying a rite clears enrage, which is what stops brute-force probing. A bid below 50% of the price *insults* rather than tempts.
* A base price of exactly `0` for a band means the species cannot be taken there at all — that is how boss-exclusive and breed-only species are expressed. There is no default fallback price.

This creates the intended tension: spend Obols to capture now, heal to survive, or hoard them to convert into permanent Essence — with the rite puzzle as the way to make capture cheap enough to be worth all three.

> **Not yet reachable.** `Capture.ts` is complete and tested but is wired into no scene.
> See the capture entry in `CLAUDE.md` for what remains.

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

* **Obol earn weights** — normal / mini-boss / major-boss base values; controls total run yield
* **`OBOL_REWARD_SCALAR`** — sets total game length without affecting progression pace. The *exponent* is derived from the level curve and is not independently tunable — see above
* **Obols→Essence conversion rate** — base rate plus the trait / Quartermaster-upgrade / depth bonuses; controls how much of a hoarded run becomes permanent power
* **Level cost curve steepness** (`base`, `exponent`) — controls how fast permanent leveling decelerates and whether a strong run hits the 2–3-level target
* **Depth-jump prices per 5-floor break** — controls how eagerly players skip early floors
* **Capture band price ranges** — the per-band `captureBasePrice` tables; controls how capture cost scales with depth, and has to stay ahead of Obol income at depth
* **Capture rite multipliers** — `family` 0.4 / `signature` 0.1; controls how much a solved rite is worth against raw coin
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
