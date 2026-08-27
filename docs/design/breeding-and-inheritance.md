# **Hollow Kin — Breeding & Inheritance System**

> **Owns:** star ratings and level caps, breed-readiness, offspring star calculation, stat inheritance, parent retirement, essence carry-over, and trait inheritance.
> **Defers to the GDD on:** currency, progression model, and what persists across runs. How trait slots unlock and how traits are acquired lives in `traits-system.md`.
> **Last verified:** 2026-07-26.

---

## **Stars and Level Caps**

Each star rating represents a creature's genealogy depth and determines its maximum level — the **level ceiling**. Level caps follow a sigmoid curve — rising slowly, accelerating through the middle stars, then flattening again at the high end.

**Stars set the ceiling; essence fills toward it.** Invested essence raises a creature's permanent level *toward* this cap but can never exceed it. Breeding is still what raises stars, and thus what unlocks a higher potential ceiling.

> **Stars are staying (decided 2026-07-26).** An earlier note listed removing stars as the favored long-term direction. That is **off the table.** Stars now also gate **trait capacity** — slots unlock at permanent levels 5/10/20/30, so a creature's star cap decides how many traits it can ever hold.
>
> **Why:** stars exist to stop players settling on one roster permanently. The goal is that players keep breeding and finding new creatures rather than maxing three favourites and never changing them. A capacity ceiling only breeding can raise is the mechanism that produces that behaviour.

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

> **Why there is a level gate at all.** Stats pass down through generations, so a creature bred too early founds a weak line — and the weakness compounds with every generation after it. The gate forces a minimum investment before a creature can become a parent. **A 0★ creature caps at level 5, so level 5 is the floor for the starters every player begins with**; higher stars must reach their own, higher cap. A freshly captured creature arrives at **level 1** and is therefore a long way from breedable — capture gives you a bloodline candidate, not a parent.

A creature is **breed-ready** when its **permanent level** reaches its level cap. This is a derived state, not something earned and stored — a creature at its cap is breed-ready, always, and one below it is not. Temporary in-run levels do not count; only the permanent essence-bought floor does.

**Hitting the cap does not increase a creature's star rating** — stars only increase through breeding. When two breed-ready creatures are bred, the offspring's star is calculated from the parents' stars (see Offspring Star Rating below). That is the only way stars increase.

Reaching the cap also opens the creature's **last reachable trait slot**, since slot thresholds (5/10/20/30) are pinned to the star level caps. So a creature arrives at one combined beat: fully grown, final slot open, ready to breed. Slots open **empty** — see `traits-system.md` for how traits are acquired.

---

## **Breeding Rules**

### **Offspring Star Rating**

Offspring star is calculated as: **(Parent A star \+ Parent B star) / 2, rounded down.**

**Breed-ready bonus:** If both parents are breed-ready (permanent level at their cap) and are the **same star rating**, the offspring receives **+1 star** on top of the formula result. This is the primary incentive to equalize parents before breeding.

Examples:

* Star 2 \+ Star 2 (both breed-ready) \= Star 3 offspring (formula gives 2, +1 bonus)
* Star 3 \+ Star 1 \= Star 2 offspring (no bonus — different stars)
* Star 4 \+ Star 3 \= Star 3 offspring (no bonus — different stars)
* Star 1 \+ Star 1 (both breed-ready) \= Star 2 offspring (formula gives 1, +1 bonus)

### **Parent Retirement**

Both parent creatures are retired upon breeding and can no longer go on runs. Their base forms can be summoned at any time but will not retain accumulated progress.

### **Essence Carry-Over (Jump-Start)**

Although both parents are retired, the essence and permanent levels invested in them **partially carry over to the offspring** as a jump-start. Players do **not** restart a bloodline from zero — a portion of a parent's accumulated essence/levels seeds the newborn, so breeding is a real trade rather than a reset. This keeps breeding meaningful (you still lose the parents) while removing the "back to square one" penalty that would otherwise discourage it.

### **Stat Inheritance**

Offspring base stats are calculated as: (**(Parent A stat \+ Parent B stat) / 6), but never lower than the base stats for the creature type.** 

### **Ability Inheritance**

Players choose at creation time whether to include parent abilities in the offspring's ability slots. Parent abilities can override the offspring's default species abilities. Up to four abilities total.

---

## **Trait Resolution**

All four slots are resolved **at breeding**. There are three cases — with slots unlocking empty, there is no random pool to arbitrate against, so the old four-case model is gone.

| What the parents had in that slot | Resolution |
| ----- | ----- |
| **Both** had a trait | Player **chooses one** of the two |
| **One** had a trait | That trait **passes** |
| **Neither** did | Slot stays **empty** — the player must find or buy a trait for it later |

### **Escrow**

Resolution covers all four slots, but a newborn's carried-over permanent level may only open slot 1 or 2. A trait inherited into a **not-yet-open** slot waits in the bloodline and lands the instant permanent level opens that slot. Nothing is lost — it just arrives late.

### **Inherited traits arrive at Level 1**

A Trait Level 4 trait inherited by an offspring starts at **Level 1** and must be re-upgraded with Essence at the Trait-keeper. The identity of the trait carries; the strength does not. The bloodline remembers the trait — the creature has to earn its power back.

---

## **Guarantee and Risk**

Because inheritance resolves entirely at breeding, the player knows exactly what an offspring will carry before confirming the pairing. The risk is not randomness — it is **opportunity cost**. Where both parents contributed to a slot, one of the two traits is lost forever; where neither did, the offspring starts that slot empty and the player must supply it from drops or the Trait-keeper.

Cross-star breeding remains a valid strategy when a high-star parent carries a desirable trait: that trait passes cleanly to a lower-star offspring, making developed creatures useful as trait donors even in downward pairings. The trade is that the offspring's star — and therefore how many slots it can ever open — comes from the star formula, not from the donor's quality.

**Marks are never inherited** — there is nothing to inherit. A mark is a player-level discovery that unlocks content, not a creature property; only the record of the deed (and any title it granted) shows in the line's history. See `marks-system.md`.

---

## **Breeding Remnants** *(cut)*

> **Status: cut.** Breeding Remnants (originally named for a concept that no longer exists in the game) depended on two systems that no longer exist — the **longevity counter** (removed) and the **Enhancer** (removed; town is now an essence hub, with the **Breeder** handling breeding). Longevity no longer forces a creature to breed or retire, so there is no solo-retirement event to leave a remnant behind. The concept is shelved and may return in a reworked, essence-based form later.
>
> *Original mechanic, retained for reference:* a creature that retired solo left behind a Breeding Remnant — a distillation of its current traits that could inject one trait into a future breeding event, substituting for a parent contribution in trait resolution.