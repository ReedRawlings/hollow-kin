# **Hollow Kin — Breeding & Inheritance System**

---

## **Stars and Level Caps**

Each star rating represents a creature's genealogy depth and determines its maximum level during a run. Level caps follow a sigmoid curve — rising slowly, accelerating through the middle stars, then flattening again at the high end.

| Star | Level Cap |
| ----- | ----- |
| 0 (Wild) | 5 |
| 1 | 10 |
| 2 | 20 |
| 3 | 30 |
| 4 | 40 |
| 5 | 50 |
| 6 | 60 |
| 7 | 70 |
| 8 | 80 |
| 9 | 90 |
| 10 | 95 |
| 11 | 97 |
| 12 | 99 |

---

## **Breed-Readiness and Star Increases**

A creature becomes **breed-ready** when it hits its level cap during a run. Hitting the cap also permanently unlocks a new trait slot, which carries forward into all future runs. Creatures have a maximum of four trait slots. However, **hitting the level cap does not increase a creature's star rating** — stars only increase through breeding.

When two breed-ready creatures are bred together, the offspring's star rating is calculated from the parents' stars (see Offspring Star Rating below). This is the only way stars increase. The creature that hit its cap is now eligible for breeding but remains at its current star until a breeding event occurs.

Wild-caught creatures receive a random trait when they first hit their level cap and unlock their first trait slot. Bred creatures may have traits chosen or inherited depending on the breeding outcome — see Trait Resolution below.

---

## **Breeding Rules**

### **Offspring Star Rating**

Offspring star is calculated as: **(Parent A star \+ Parent B star) / 2, rounded down.**

Examples:

* Star 2 \+ Star 2 \= Star 2 offspring  
* Star 3 \+ Star 1 \= Star 2 offspring  
* Star 4 \+ Star 3 \= Star 3 offspring

### **Parent Retirement**

Both parent creatures are retired upon breeding and can no longer go on runs. Their base forms can be summoned at any time but will not retain accumulated progress.

### **Stat Inheritance**

Offspring base stats are calculated as: (**(Parent A stat \+ Parent B stat) / 6), but never lower than the base stats for the creature type.** 

### **Ability Inheritance**

Players choose at creation time whether to include parent abilities in the offspring's ability slots. Parent abilities can override the offspring's default species abilities. Up to four abilities total.

---

## **Trait Resolution**

Trait slots on the offspring are resolved in one of four ways depending on what both parents contributed. Resolution happens at different times depending on the case.

### **Case 1 — Both Parents Had the Slot Filled at the Same Star**

**When:** Breeding time. **Resolution:** Player chooses one trait from the two parent traits. Trait is applied at birth and active from the first run.

### **Case 2 — One Parent Had the Slot Filled, the Other Did Not**

**When:** Run time, when the creature hits that star's level cap. **Resolution:** 50/50 roll between the contributing parent's trait and a random pool draw. Player sees the result at that moment. Result is permanent.

### **Case 3 — Both Parents Had Above-Star Traits for That Slot**

**When:** Run time, when the creature hits that star's level cap. **Resolution:** Player chooses between the two parent traits. Random pool is excluded entirely as a reward for having two high-star parents.

### **Case 4 — Neither Parent Had Anything for That Slot**

**When:** Run time, when the creature hits that star's level cap. **Resolution:** Random pool draw. No parental influence.

---

## **Guarantee and Risk**

Players who max out both parents before breeding guarantee chosen traits at birth for every filled slot. Players who breed mismatched or unmaxed creatures introduce randomness into slots that weren't covered, which resolves during runs rather than at creation. The more investment put into parents, the more control the player has over the offspring's final trait composition.

Cross-star breeding is a valid strategy when a high-star parent carries a desirable above-star trait. That trait has a 50% chance of propagating to the lower-star offspring when it earns that slot during a run, making high-star creatures useful as trait donors even in downward breedings. If both parents contributed above-star traits, the player chooses between them at run time with no random pool involvement.

---

## **Breeding Relics**

When a creature exhausts its longevity counter without a breeding partner, it retires solo and leaves behind a Breeding Relic. The relic is a distillation of the creature's current traits. It can be used at the Enhancer to inject one trait into a future breeding event. Only one relic per breeding. The relic substitutes for a parent contribution in trait resolution — a slot with a relic and one parent trait lets the player choose between them at run time rather than rolling against the random pool.