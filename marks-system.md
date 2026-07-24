# **Hollow Kin — Marks System**

---

## **Overview**

Marks are run-earned bonuses that occupy a single slot on each creature. They are distinct from traits — traits are inherited through bloodlines and strengthen over stars, while marks are earned through specific in-run accomplishments and reflect what a creature has done rather than what it was born with.

A creature can earn multiple marks over its lifetime across different runs. Only one mark is active at a time. The player chooses which mark is slotted and can swap freely between earned marks at any time outside of a run. Equipping a new mark replaces the active one but does not delete the previous mark — the full collection of earned marks is always available to choose from.

Marks follow an **earn-then-lock** model. Earning a mark is still done through in-run accomplishments, but by default an earned mark is **temporary** — it fades once the run ends. Spending **essence** at the **Mark-binder** in town is the optional step that makes an earned mark **permanent** on that creature. Essence buys permanence, not the mark itself: you still have to do the deed in a run to earn it.

---

## **Earning Marks**

Marks are earned by hitting specific thresholds during a single run. Thresholds reset at the start of each run — they must be achieved within one run to count. A creature that partially meets a threshold carries nothing forward to the next run.

Each mark is earned once per run. There are no upgraded versions or levels. When a creature hits a threshold it earns that mark for the current run, but the mark is **temporary** by default and fades when the run ends unless the player pays to keep it.

### **Making a Mark Permanent**

To keep an earned mark on a creature beyond the run in which it was earned, the player spends **essence** at the **Mark-binder** in town. Binding a mark locks it permanently onto that creature; it then joins the creature's permanent collection and can be slotted or swapped freely like any other permanent mark. Essence pays for *permanence only* — a mark still has to be earned through the in-run accomplishment first, and binding is never available for a mark the creature has not earned.

---

## **Mark Types**

### **Floor Mark**

Earned by defeating a boss in the tower's single continuous descent. Bosses appear on a fixed cadence: a **mini-boss every 5 floors** and a **major boss every 10 floors**.

**Effect:** \+5% damage to all enemies on floors deeper than the boss that granted it.

The Floor Mark is the only mark with persistent cross-run progression implications. It scales naturally with how deep a creature is pushed and rewards players who clear bosses rather than farming early floors. A creature that has earned multiple Floor Marks — one per boss cleared — stacks the bonus additively the deeper it goes.

*Note: Whether multiple Floor Marks stack or whether a creature can only hold one is to be confirmed during balancing.*

### **Combat Threshold Marks**

Earned by meeting a specific combat performance threshold within a single run. These marks reward and reinforce a creature's existing identity — a ghost-damage attacker is naturally positioned to earn the ghost damage mark, for example.

**Examples:**

| Threshold | Mark Effect |
| ----- | ----- |
| Heal 500 damage in a single run | Restore 2 HP to the team at the start of each battle |
| Deal 1000 ghost-type damage in a single run | \+10% ghost damage dealt |
| Others TBD per damage type and playstyle | TBD |

Additional combat marks should be designed to cover the major damage types, healing roles, and defensive playstyles so most creatures have a realistic path to earning something relevant to how they naturally play.

---

## **Marks and Permanence**

A mark only outlives the run it was earned in if the player pays to bind it. Permanence comes from spending **essence** at the **Mark-binder**, not from retirement or relics. Once bound, a mark stays on the creature for the rest of its life.

This gives marks genuine, durable value: a creature with a weak or undesirable trait but a strong earned mark is still worth investing essence into, since binding that mark preserves an effect it earned through play.

---

## **Marks and Breeding**

Marks are not inherited through breeding. They are personal to the creature that earned them and do not pass to offspring, even when bound permanently with essence. A player who wants a mark's effect on a new creature must earn (and, to keep it, bind) that mark on the new creature directly.

This keeps marks as a layer of individual creature identity rather than a genealogy mechanic, and preserves the distinction between what a creature is born with (traits) and what it earns through play (marks).

---

## **Design Intent**

Marks exist to make individual runs feel purposeful beyond pushing depth. A player who notices their creature is close to the 500 healing threshold has a reason to play differently in the next few encounters. A player who almost hit the ghost damage threshold last run has a goal going into the next one. This creates run-to-run narrative without requiring procedural story generation — the player constructs the story themselves through threshold chasing.

Combat threshold marks also naturally filter for creature identity. Hitting 1000 ghost damage in a single run almost requires a ghost-focused build, so the bonus reinforces something the creature already is rather than pushing awkward playstyles.