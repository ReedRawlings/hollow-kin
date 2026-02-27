# **Hollow Kin — Combat System**

*Working Document — Subject to Change*

---

## **Overview**

Combat in Hollow Kin is turn-based and active by default. The player controls a party of three creatures against enemy encounters in the tower. Combat is the moment-to-moment gameplay loop that everything else — breeding, traits, marks, relics — exists to support. The system must be deep enough to reward investment in creature builds while simple enough to auto-battle through low-difficulty floors.

---

## **Turn Order**

* Turn order is determined by SPD stat
* At the start of each round, all combatants (player creatures and enemies) are sorted by SPD — highest acts first
* Ties are broken randomly
* Haste buffs and Initiative traits modify effective SPD for ordering purposes without changing the base stat
* Turn order is recalculated every round to reflect buffs, debuffs, and status changes

---

## **Actions Per Turn**

Each creature gets one action per turn:

* **Use an Ability** — Select from up to four equipped abilities. Costs MP.
* **Basic Attack** — A free physical attack that scales with STR. No MP cost. Always available.
* **Defend** — Reduce incoming damage until the creature's next turn.
* **Swap** — Replace the active creature with one from inventory (captured creatures mid-run). The swapped-in creature acts next round, not this one.

---

## **Damage Formula**

*Proposed starting formula — subject to playtesting:*

`damage = (ability_power * (attacking_stat / defending_stat)) * type_multiplier * variance`

* `ability_power` — Base power defined on the ability object
* `attacking_stat` — STR for physical, INT for magic, WIS for healing (defined per ability via `stat_scaling`)
* `defending_stat` — DEF for physical attacks, WIS for magic attacks
* `type_multiplier` — Based on the target's resistances and weaknesses (see below)
* `variance` — Small random range (e.g., 0.9–1.1) to prevent fights from feeling deterministic

### **Resistance and Weakness Multipliers**

* **Resistant:** 0.5x damage from that type
* **Neutral:** 1.0x damage
* **Weak:** 1.5x damage

Resistances and weaknesses are per-creature, not per-archetype. There is no global type chart. A Mecha creature might resist fire but be weak to ice — another Mecha might have completely different matchups.

---

## **Buff and Debuff System**

### **Duration**

* Buffs and debuffs last a fixed number of **turns** (not rounds)
* Default duration: 3 turns unless the ability specifies otherwise
* Food archetype buffs are stronger but shorter (2 turns default)
* Flora archetype buffs are weaker but longer (4 turns default)

### **Stacking**

* The same buff/debuff does **not** stack with itself — reapplying refreshes the duration
* Different buffs/debuffs affecting different stats stack freely
* A creature can have both an ATK buff and an ATK debuff simultaneously — they cancel proportionally

### **Buff/Debuff Types**

| Effect | Description |
| ----- | ----- |
| ATK Up/Down | Modifies STR for physical damage |
| MAG Up/Down | Modifies INT for magic damage |
| DEF Up/Down | Modifies DEF for physical defense |
| RES Up/Down | Modifies WIS for magic defense |
| SPD Up/Down | Modifies SPD for turn order |
| Haste | Grants bonus effective SPD (stacks additively with SPD buffs) |

---

## **Status Effects**

| Status | Effect | Duration |
| ----- | ----- | ----- |
| Poison | Deals % max HP damage at end of each turn | 3 turns |
| Burn | Deals flat fire damage at end of each turn, reduces ATK | 3 turns |
| Freeze | Skip next turn, then thaw. Increases ice weakness temporarily | 1 turn |
| Stun | Skip next turn | 1 turn |
| Sleep | Skip turns until hit by damage. Damage that wakes deals 1.5x | Until hit |
| Blind | Reduces accuracy by a flat percentage | 3 turns |

### **Status Resolution**

* Status effects are applied at the end of the action that caused them
* Resist Status trait reduces the chance of a status landing (not the duration)
* A creature can be affected by multiple different statuses simultaneously
* The same status cannot be reapplied while active — it must expire first

---

## **MP System**

* Abilities cost MP as defined on the ability object
* MP does **not** regenerate naturally between turns
* MP regeneration sources:
  * Certain traits (e.g., MP Up trait provides a larger pool, not regen)
  * Rest points between encounters restore MP to full
  * Specific relics may grant per-battle MP recovery
* Running out of MP limits the creature to Basic Attack and Defend
* MP resets to full at the start of each new encounter

---

## **Knockout and Revival**

* When a creature's HP reaches 0, it is **knocked out** for the remainder of that encounter
* Knocked-out creatures are revived with a percentage of max HP at the end of the encounter (proposed: 25%)
* If all three active creatures are knocked out in one encounter, the **run ends** (see Run Failure in the GDD)
* Revival items or relics (e.g., Phoenix Down) can revive during an encounter
* Knocked-out creatures do not earn mark threshold progress for that encounter

---

## **Auto-Combat**

### **Overview**

Players can toggle auto-combat on or off at any time — during battle or from the map overview. Auto is a convenience feature for low-difficulty floors, not a replacement for active play.

### **Tactics Rules**

Inspired by Dragon Quest's tactics system. The player assigns a general behavior to each creature:

| Tactic | Behavior |
| ----- | ----- |
| **Fight Wisely** | Balanced — uses abilities efficiently, targets weaknesses when known |
| **All Out** | Prioritizes highest damage abilities regardless of MP cost |
| **Conserve MP** | Prefers Basic Attack, only uses abilities when HP is threatened |
| **Heal First** | Prioritizes healing and support abilities for the team |
| **Follow Orders** | Manual control only — auto skips this creature |

### **Auto-Combat Limitations**

* Auto does not use items from inventory
* Auto does not swap party members
* Auto does not know enemy resistances until they've been encountered before (first encounter is always blind)
* The player can override auto on any individual turn by selecting an action manually

---

## **Enemy Encounters**

* Enemies use the same creature stat system as player creatures — same base stats, abilities, resistances
* Enemy creatures do not have traits or marks — those are player-only progression systems
* Enemy difficulty scales by zone through higher base stats and more abilities
* Boss creatures have unique abilities not available to player creatures and higher stat pools
* Enemy AI follows simple priority rules: target lowest HP, use strongest available ability, apply status effects when available

---

## **Open Questions**

* Exact damage formula constants and scaling curves — requires playtesting
* Whether critical hits exist and what triggers them
* Whether evasion is a flat miss chance or calculated against accuracy
* Detailed auto-combat AI decision trees per tactic
* Whether bosses have multiple phases or unique mechanics beyond stat inflation
* How party positioning works (front/back row) or if all three creatures are equivalent positionally
* Accuracy formula — is there a hit chance, or do all attacks land unless evaded?
