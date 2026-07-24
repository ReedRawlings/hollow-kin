# **Hollow Kin — Traits System**

---

## **Overview**

Traits are passive or triggered effects attached to a creature's stat object. Each creature can hold up to four traits, one per trait slot. Slots are unlocked progressively by spending **essence** at the **Trait-keeper** in town — each slot (and each subsequent level upgrade) opens at a defined essence threshold. Traits have four strength levels — a trait at Level 1 is a minor effect, the same trait at Level 4 is substantially more powerful.

Traits are stored on the creature as IDs. The ID references coded logic in the TraitLibrary. The creature object holds the trait ID and its current level — the library handles what that combination actually does in combat.

---

## **Persistence Between Runs**

Trait unlocks are permanent. Once a creature earns a trait slot by spending essence at the Trait-keeper, that trait is active at the start of every subsequent run at whatever level it currently holds. Essence spent on a slot is permanent and locked to that creature — unlocked traits represent the persistent progress that makes each generation meaningfully stronger over time.

This is the primary answer to the Azure Dreams problem of retained levels. Traits, like permanent essence levels, are the progress a creature carries between runs.

**Wild creatures** unlock traits by spending accumulated essence at the Trait-keeper. When a slot is unlocked its trait is randomly assigned from the shared pool at that moment and permanently active from the next run onward. Each further essence threshold either upgrades an existing slot or unlocks a new one.

**Bred creatures** are born with their inherited traits already active — there is no unlock moment because slots were resolved at creation (subject to any essence carry-over from the parents). Their runs are spent earning essence to strengthen traits they already have rather than unlocking new ones from scratch.

This means a bred creature is stronger than a wild creature from run one and gets progressively stronger as essence is invested. Wild creatures start weaker but still accumulate permanent progress each time essence is spent on them.

---

## **Trait Levels**

Every trait exists at four levels of strength. Creatures earn stronger versions of their traits by spending essence at the Trait-keeper — either at slot unlock or through subsequent level-upgrade thresholds.

| Trait Level | Description |
| ----- | ----- |
| 1 | Minor effect — noticeable but modest |
| 2 | Moderate effect |
| 3 | Strong effect |
| 4 | Maximum effect — meaningfully powerful |

The specific stat values or effect magnitudes for each level are defined per trait in the TraitLibrary and tuned during balancing.

---

## **Trait Slot Progression by Essence Threshold**

Slots and level upgrades unlock by spending **essence** at the **Trait-keeper** in town. Each threshold is a cumulative essence investment on that creature. Slots unlock one at a time; each new slot opens at a higher base trait level than the previous — later slots start strong but earlier slots can be refined all the way to max over time. Later thresholds strengthen existing slots rather than adding new ones.

> **Essence values below are placeholders for playtest tuning.** They are cumulative essence invested in a creature's traits, not per-step costs. Slot count (4) and trait level count (4) are fixed; only the numbers move.

| Essence Threshold (placeholder) | Effect |
| ----- | ----- |
| 0 | No traits |
| 50 | Slot 1 unlocked at Trait Level 1 |
| 120 | Slot 2 unlocked at Trait Level 2 |
| 220 | Slot 3 unlocked at Trait Level 3 |
| 350 | Slot 4 unlocked at Trait Level 4 (max) |
| 450 | Slot 1 upgraded to Trait Level 2 |
| 570 | Slot 1 upgraded to Trait Level 3 |
| 710 | Slot 1 upgraded to Trait Level 4 (max) |
| 870 | Slot 2 upgraded to Trait Level 3 |
| 1050 | Slot 2 upgraded to Trait Level 4 (max) |
| 1250 | Slot 3 upgraded to Trait Level 4 (max) |

A fully invested creature has all four slots at Trait Level 4. Slot 4 is the only slot that opens already at max and is never upgraded further — it is a reward for reaching the top slot-unlock threshold that remains constant as other slots catch up.

This progression is deliberately decoupled from star rating. Stars currently still gate a creature's level ceiling, but trait unlocks no longer depend on them — so if stars are removed later, this table needs no restructuring.

---

## **Trait Categories**

Traits are assigned from a shared pool. Wild creatures receive random traits. Bred creatures may have traits chosen or inherited depending on the breeding resolution rules — see the Breeding and Inheritance document.

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

See the Breeding and Inheritance document for the full resolution rules. In summary:

* Both parents with a slot filled at the same star → player chooses at birth
* One parent contributing, one not → 50/50 at run time between parent trait and random pool
* Both parents with above-star traits → player chooses at run time, no random pool
* Neither parent contributing → random pool draw at run time

When a trait is inherited its **trait level resets to whatever level that slot starts at for the offspring's current essence investment** (subject to any essence carry-over granted by the parents — see Breeding and Inheritance). A Trait Level 4 trait inherited into a freshly unlocked Slot 1 starts at Level 1 and upgrades as more essence is spent at the Trait-keeper. The identity of the trait is preserved, the strength is not. This is intentional — the bloodline carries the memory of the trait, the creature has to earn its full power back with essence. A slot that opens already at a higher base level (Slot 2, 3, or 4) starts its inherited trait at that slot's base level.

---

## **Endgame Trait Unlock**

An endgame trait reward sits above the standard four-slot progression, gated behind a top-tier essence threshold (previously pegged to Star 12; re-home the exact gate during tuning). Not yet defined. Candidates to consider:

* A fifth trait slot that breaks the four-slot rule as a true endgame reward
* A passive that upgrades all traits by one additional level beyond their cap
* A unique legendary trait only accessible at this tier
* A meta effect that interacts with the breeding system itself