# **Hollow Kin — Traits System**

> **Owns:** trait effects, trait levels, trait categories, how slots unlock, and how traits are acquired.
> **Defers to the GDD on:** currency, progression model, and what persists across runs. Breeding inheritance lives in `breeding-and-inheritance.md`.
> **Last verified:** 2026-07-26. **Not yet built** — design settled in `docs/superpowers/specs/2026-07-26-traits-system-design.md`.

---

## **Overview**

Traits are passive or triggered effects attached to a creature's stat object. Each creature can hold up to four traits, one per trait slot. Traits have four strength levels — a trait at Level 1 is a minor effect, the same trait at Level 4 is substantially more powerful.

The system splits cleanly three ways, with no overlap:

| Source | Supplies |
| ----- | ----- |
| **Permanent level** | Slot **capacity** — how many traits a creature can hold |
| **Adventuring and the Trait-keeper** | Slot **content** — the actual traits |
| **Breeding** | Content **passed down** — inherited traits, placed at birth |

Traits are stored on the creature as IDs. The ID references coded logic in the TraitLibrary. The creature object holds the trait ID and its current level — the library handles what that combination actually does in combat.

---

## **Slots Unlock by Permanent Level**

A trait slot unlocks when a creature's **permanent level** crosses a threshold:

| Slot | Permanent level | First reachable at |
| ----- | ----- | ----- |
| 1 | 5 | 0★ |
| 2 | 10 | 1★ |
| 3 | 20 | 2★ |
| 4 | 30 | 3★ |

**Permanent level only.** Temporary in-run levels affect stats and nothing else — they never unlock a slot. An unlock therefore always happens in town, at the moment the player buys the level at the Leveler. Unlocks are predictable, a slot can never flicker open and closed across a run boundary, and there is no way to grind in-run XP into trait capacity without spending Essence.

These thresholds are **pinned to the star level caps** (0★=5, 1★=10, 2★=20, 3★=30). Each star tier through 3★ buys exactly one more slot, and a creature's final reachable slot opens on the same beat it hits its cap and becomes breed-ready. If either table is retuned, they move together.

From 4★ up (cap 40+) all four slots are already open — the rest of the climb funds trait **levels** instead.

> **Stars gate trait capacity, deliberately.** A 0★ creature reaches one slot and no more, forever, until breeding raises its star. This is the point: stars exist so players keep breeding and finding new creatures rather than maxing three favourites and never changing them. Breeding is what buys trait capacity. (This reverses an earlier note that traits were decoupled from stars so stars could be removed later — **stars are staying.**)

---

## **Slots Unlock Empty — Traits Are Found, Not Rolled**

A slot opening gives capacity, not content. **There is no random trait roll.** A newly opened slot sits empty until the player puts something in it.

### **Where traits come from**

| Source | Notes |
| ----- | ----- |
| **Trait-keeper stock** | A small variety of baseline traits, bought with Essence. This is the reliable floor — a player is never locked out of traits by bad luck |
| **Boss drops** | Rarer traits, at a **small chance**, from mini and major bosses |
| **Random events** | Rarer traits as a risk/reward outcome |
| **Puzzles** | A later system — not yet designed |
| **Breeding** | Inherited traits, already placed at birth (see `breeding-and-inheritance.md`) |

Ordinary combat encounters do **not** drop traits, and traits are **not** sold in in-run shops for Obols.

### **Found traits are inventory items**

A found trait occupies a backpack slot for the rest of the descent and is **eligible for the wipe's single random loss** unless it sits in guaranteed inventory space — exactly like a consumable or a captured creature. Carrying a floor-20 boss trait deeper is a real gamble: push on and risk it, or leave and bank it.

### **Species compatibility**

A creature can only be imbued with traits its species accepts — its `naturalTraitPool`. This is a **compatibility rule, not a roll table**: no species has access to the entire trait library, and a strong trait you cannot use on the creature you wanted is a real (and intended) outcome.

---

## **The Trait-keeper**

The town vendor that handles everything to do with trait content. All four services cost or return **Essence**:

* **Sells** a small variety of baseline traits
* **Imbues** a held trait into an open slot. Imbuing into an *occupied* slot replaces what was there, destroying the old trait — no refund, and there is no un-imbue
* **Upgrades** a trait from Level 1 toward Level 4
* **Buys duplicates** — a repeat of a trait a creature already holds sells back for a small amount, so a duplicate drop is never dead loot

---

## **Persistence Between Runs**

Everything about traits is permanent. An unlocked slot stays unlocked, an imbued trait stays imbued at whatever level it holds, and both are active from the start of every subsequent run.

This is the primary answer to the Azure Dreams problem of retained levels. Traits, like permanent essence levels, are progress a creature carries between runs.

**Bred creatures** are born with their inherited traits already placed, so they are stronger than wild creatures from run one. **Wild creatures** start with empty slots and are equipped over time from drops and the Trait-keeper's stock — slower, but fully under the player's control, which inheritance is not.

---

## **Trait Levels**

Every trait exists at four levels of strength.

| Trait Level | Description |
| ----- | ----- |
| 1 | Minor effect — noticeable but modest |
| 2 | Moderate effect |
| 3 | Strong effect |
| 4 | Maximum effect — meaningfully powerful |

The specific stat values or effect magnitudes for each level are defined per trait in the TraitLibrary and tuned during balancing.

### **Raising a trait's level**

Traits are found at **Level 1** and raised with Essence at the Trait-keeper.

| Upgrade | Essence (placeholder) |
| ----- | ----- |
| L1 → L2 | 240 |
| L2 → L3 | 540 |
| L3 → L4 | 960 |

> **The relationship to preserve:** a trait upgrade costs roughly **one mid-game permanent level**. The level curve is `10·L^1.5`, so level 10→11 costs ~365 and 20→21 ~962. If the level curve is retuned, retune these alongside it. The point is that raising a trait is a comparable investment to raising a level — not a rounding error against it.

**Higher-level drops, later in the game.** Deep in the tower, traits can drop already at Level 2–4, skipping some or all of the Essence cost. This makes depth a direct trait-power lever and turns a deep high-level drop into a genuine windfall. The depth-to-drop-level mapping is a tuning question, not yet fixed.

**Duplicates do not merge.** A second copy of a trait a creature already holds is sold back to the Trait-keeper for a small amount of Essence — a consolation, not an income stream.

---

## **Trait Categories**

Each species accepts a curated subset of the trait library — its `naturalTraitPool` — which determines what it can be imbued with. Bred creatures may also arrive with inherited traits already placed; see the Breeding and Inheritance document.

### **Stat Increase Traits**

Passive bonuses to a specific stat. Scale with trait level.

* HP Up  
* MP Up  
* STR Up  
* DEF Up  
* WIS Up  
* SPD Up  
* INT Up

### **Start of Battle Traits**

Triggered once at the beginning of combat.

* Opening Buff (ATK raise on first turn)  
* Opening Ward (DEF raise on first turn)  
* Initiative Boost (SPD raise at battle start)  
* Opening Block (Negate the first instance of damage each battle)

### **Resistance Traits**

Passive reduction to incoming damage of a specific type. Trait level determines resistance magnitude.

* Resist Fire  
* Resist Ice  
* Resist Lightning  
* Resist Physical  
* Resist Status (reduces chance of debuffs landing)  
* others per damage type TBD

### **Party Affinity Traits**

Triggered buffs based on who else is in the active party. Trait level scales the buff magnitude.

* Kin Bond (buff when partied with same archetype)  
* Archetype-specific affinities TBD per archetype pairing

### **Evasion Traits**

Passive increase to dodge chance. Scales with trait level.

* Evasion Up  
* Counter Evade (chance to counterattack on dodge) TBD

### **Type Traits**

Increases damage against certain archetypes or decreases the damage they deal

* Increase damage to Archetype (one trait per archetype)  
* Reduce damage received vs Archetype (one trait per archetype)

### **Economy Traits**

Affect the run's currency rather than combat directly. Scale with trait level.

* Essence Distiller (boosts the Obols→Essence conversion rate on tower exit, so more of each run's leftover Obols becomes permanent Essence)

---

## **Trait Inheritance at Breeding**

See the Breeding and Inheritance document for the full rules. In summary — three cases, because with slots unlocking empty there is no random pool to arbitrate against:

* **Both parents had a trait in that slot** → player chooses one, at breeding
* **One parent had a trait in that slot** → that trait passes
* **Neither did** → the slot stays empty; go find something for it

**Escrow.** Inheritance is resolved for all four slots at breeding, but a newborn's carried-over permanent level may only open slot 1 or 2. A trait inherited into a not-yet-open slot waits in the bloodline and lands the instant permanent level opens that slot. Nothing is lost — it arrives late.

**Inherited traits arrive at Level 1.** A Trait Level 4 trait inherited by an offspring starts at Level 1 and must be re-upgraded with Essence at the Trait-keeper. The identity of the trait is preserved, the strength is not. This is intentional — the bloodline carries the memory of the trait; the creature has to earn its full power back.

---

## **Endgame Trait Unlock**

An endgame trait reward sits above the standard four-slot progression, gated behind a top-tier permanent level (previously pegged to Star 12; re-home the exact gate during tuning). Not yet defined. Candidates to consider:

* A fifth trait slot that breaks the four-slot rule as a true endgame reward
* A passive that upgrades all traits by one additional level beyond their cap
* A unique legendary trait only accessible at this tier
* A meta effect that interacts with the breeding system itself