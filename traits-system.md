# **Hollow Kin — Traits System**

---

## **Overview**

Traits are passive or triggered effects attached to a creature's stat object. Each creature can hold up to four traits, one per trait slot. Slots are unlocked progressively as a creature reaches higher stars. Traits have four strength levels — a trait at Level 1 is a minor effect, the same trait at Level 4 is substantially more powerful.

Traits are stored on the creature as IDs. The ID references coded logic in the TraitLibrary. The creature object holds the trait ID and its current level — the library handles what that combination actually does in combat.

---

## **Persistence Between Runs**

Trait unlocks are permanent. Once a creature earns a trait slot by hitting its level cap during a run, that trait is active at the start of every subsequent run at whatever level it currently holds. The creature resets to level 1 between runs but does not reset to zero — unlocked traits represent the persistent progress that makes each generation meaningfully stronger over time.

This is the primary answer to the Azure Dreams problem of retained levels. Creatures do not keep their levels but they do keep their traits.

**Wild creatures** unlock traits by hitting their level cap for the first time. The trait is randomly assigned at that moment and permanently active from the next run onward. Each subsequent level cap hit either upgrades an existing slot or unlocks a new one.

**Bred creatures** are born with their inherited traits already active — there is no unlock moment because slots were resolved at creation. Their runs are spent earning star upgrades to strengthen traits they already have rather than unlocking new ones from scratch.

This means a bred creature is stronger than a wild creature from run one and gets progressively stronger each run that pushes it to a new level cap. Wild creatures start weaker but still accumulate permanent progress each time they cap out.

---

## **Trait Levels**

Every trait exists at four levels of strength. Higher-star creatures earn stronger versions of their traits either at slot unlock or through star upgrades.

| Trait Level | Description |
| ----- | ----- |
| 1 | Minor effect — noticeable but modest |
| 2 | Moderate effect |
| 3 | Strong effect |
| 4 | Maximum effect — meaningfully powerful |

The specific stat values or effect magnitudes for each level are defined per trait in the TraitLibrary and tuned during balancing.

---

## **Trait Slot Progression by Star Rating**

Slots unlock one at a time from Star 2 through Star 5\. Later stars strengthen existing slots rather than adding new ones. Notably each new slot opens at a higher base trait level than the previous — later slots start strong but earlier slots can be refined all the way to max over time.

| Star | Effect |
| ----- | ----- |
| 1 | No traits |
| 2 | Slot 1 unlocked at Trait Level 1 |
| 3 | Slot 2 unlocked at Trait Level 2 |
| 4 | Slot 3 unlocked at Trait Level 3 |
| 5 | Slot 4 unlocked at Trait Level 4 (max) |
| 6 | Slot 1 upgraded to Trait Level 2 |
| 7 | Slot 1 upgraded to Trait Level 3 |
| 8 | Slot 1 upgraded to Trait Level 4 (max) |
| 9 | Slot 2 upgraded to Trait Level 3 |
| 10 | Slot 2 upgraded to Trait Level 4 (max) |
| 11 | Slot 3 upgraded to Trait Level 4 (max) |
| 12 | TBD — special unlock |

A Star 12 creature has all four slots at Trait Level 4 plus whatever the Star 12 special unlock becomes. Slot 4 is the only slot that opens already at max and is never upgraded further — it is a reward for reaching Star 5 that remains constant as other slots catch up.

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

---

## **Trait Inheritance at Breeding**

See the Breeding and Inheritance document for the full resolution rules. In summary:

* Both parents with a slot filled at the same star → player chooses at birth
* One parent contributing, one not → 50/50 at run time between parent trait and random pool
* Both parents with above-star traits → player chooses at run time, no random pool
* Neither parent contributing → random pool draw at run time

When a trait is inherited its **trait level resets to whatever level that slot starts at for the offspring's star rating.** A Trait Level 4 trait inherited into Slot 1 of a Star 2 creature starts at Level 1 and upgrades as the creature reaches higher stars. The identity of the trait is preserved, the strength is not. This is intentional — the bloodline carries the memory of the trait, the creature has to earn its full power. If a creature has Slot 4 or higher unlocked Trait Levels will start at the corresponding level.

---

## **Star 12 Special Unlock**

Not yet defined. Candidates to consider:

* A fifth trait slot that breaks the four-slot rule as a true endgame reward
* A passive that upgrades all traits by one additional level beyond their cap
* A unique legendary trait only accessible at this star
* A meta effect that interacts with the breeding system itself