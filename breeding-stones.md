# **Hollow Kin — Breeding Stones Reference**

*Balancing Document — Subject to Change*

---

## **Overview**

Breeding Stones are single-use consumables applied at the Enhancer during a breeding event. Each stone influences one aspect of the breeding outcome. Only one stone (or one Breeding Relic) can be used per breeding event — they do not stack with each other.

Stones are found as loot during runs (combat drops and boss rewards). They survive run failure if stored in a safe inventory slot.

---

## **Stone Rules**

* One stone OR one relic per breeding event — never both
* Stones are consumed on use
* Stone effects apply during trait resolution, stat inheritance, or ability inheritance depending on stone type
* Higher-tier stones become available as the Enhancer is upgraded
* Stones are stored in town after a successful run — they are not at risk once banked

---

## **Stone Catalog**

### **Tier 1 — Available at Enhancer Level 1**

| ID | Name | Effect | Drop Source | Notes |
| --- | --- | --- | --- | --- |
| stone_001 | Trait Shard | When a trait slot would roll from the random pool, reroll once and pick the better option | Combat drop | Reduces bad RNG on unfilled slots |
| stone_002 | Stat Seed | Offspring base stats receive a +5% bonus across all stats | Combat drop | Small but universal |
| stone_003 | Ability Lock | Guarantee one specific parent ability transfers to the offspring | Combat drop | Removes uncertainty from ability inheritance |

### **Tier 2 — Available at Enhancer Level 2**

| ID | Name | Effect | Drop Source | Notes |
| --- | --- | --- | --- | --- |
| stone_004 | Trait Magnet | For one trait slot, convert a Case 2 resolution (50/50 parent vs. random) into a guaranteed parent trait | Boss drop | Eliminates one random roll |
| stone_005 | Vigor Stone | Offspring gains +2 longevity beyond the star rating default | Combat drop (rare) | Extends useful life of the creature |
| stone_006 | Stat Focus | Choose one stat — offspring receives +15% bonus to that stat's base value | Boss drop | Targeted stat shaping |

### **Tier 3 — Available at Enhancer Level 3**

| ID | Name | Effect | Drop Source | Notes |
| --- | --- | --- | --- | --- |
| stone_007 | Bloodline Crystal | Offspring inherits both parent traits for one slot (Case 1 resolution) even if only one parent had the slot filled | Boss drop (rare) | Upgrades a Case 2 to a Case 1 — player chooses |
| stone_008 | Star Shard | If offspring would be Star N, it becomes Star N+1 instead | Boss drop (rare) | Extremely powerful — bypasses normal star math |
| stone_009 | Dual Ability | Offspring can inherit up to two additional parent abilities beyond the normal four-slot limit for selection purposes (still limited to four equipped) | Boss drop | More options at creation, not more slots |

### **Tier 4 — Available at Enhancer Level 4**

| ID | Name | Effect | Drop Source | Notes |
| --- | --- | --- | --- | --- |
| stone_010 | Trait Ascension | One inherited trait starts at one trait level higher than normal for the offspring's star rating | Boss drop (rare) | Powerful for early slot investment |
| stone_011 | Perfect Bond | All Case 2 and Case 4 trait resolutions for this breeding become Case 1 (player chooses from parent traits or curated pool) | Boss drop (very rare) | Eliminates all randomness from one breed |
| stone_012 | TBD | TBD | TBD | Placeholder for additional high-tier stone |

---

## **Scarcity Targets**

* A player should accumulate enough stones for one meaningful Enhancer use every 2–3 runs
* Tier 1 stones are common — the player should always have a few available
* Tier 2 stones appear roughly every 3–4 runs
* Tier 3 stones are rare — one every 5–8 runs
* Tier 4 stones are very rare — one every 10+ runs or from specific boss clears only

---

## **Design Guidelines**

* Stones should reduce randomness or provide targeted bonuses — never bypass core systems entirely
* Star Shard is the most powerful stone and should be the rarest — it shortcuts the entire breeding star ladder by one step
* No stone should make breeding feel automatic — the player should still make meaningful choices
* Stone variety should cover all three breeding outputs: traits, stats, and abilities

---

## **Open Questions**

* Whether stones should be tradeable or giftable in any future multiplayer context
* Whether there should be negative/cursed stones (powerful upside with a drawback)
* Full Enhancer upgrade tree — how many levels, what unlocks at each
* Whether stone effects should be visible in the breeding preview screen before committing
