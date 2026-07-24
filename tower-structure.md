# **Hollow Kin — Tower Structure**

*Working Document — Subject to Change*

---

## **Overview**

The tower is the procedurally generated environment where all runs take place. Players descend the tower with a party of three creatures, progressing through encounters until they reach a boss or are wiped out. The tower's structure determines pacing, difficulty curves, and the cadence of meaningful decisions within a run.

---

## **Run Length**

* A run is **one continuous descent** — there are no discrete zones or zone walls.
* The vertical slice is **30 floors** deep. This is **bounded now, endless later**: the 30-floor tower is designed so an endless mode can bolt on afterward without restructuring the descent.
* Each floor is a single encounter — combat, shop, rest point, or random event.
* **Boss cadence:** a **mini-boss every 5 floors** and a **major boss every 10 floors** punctuate the descent (see Boss Design).
* Of the non-boss floors, roughly a third to a half are combat — the rest are shops, rest points, and random events.
* Failed runs end earlier. Every fight drops **Obols** (the in-run currency); leftover Obols convert to permanent **Essence** on exit, so even a short run banks something — provided you didn't spend it all surviving.

---

## **Depth Bands & Descent Identity**

There are no hard zone walls. Instead, the enemy pool and visual identity **shift gradually by depth band** as the player descends.

* Enemy composition draws from **2–3 archetypes at a time**, and the mix rotates as the player goes deeper, adding variability to each run.
* Deeper floors present stronger enemies with more complex ability sets, representing higher stats and tiers.
* Early floors ease the player in: the first few combat floors of a run present just 1–3 enemy creatures, giving time to build up momentum before full-scale fights.

### **Depth-Jumps (Purchasable Start Points)**

Rather than starting a later run in a pre-cleared zone, players buy a deeper **start point** with **essence**.

* At each **5-floor break** (floor 5, 10, 15, 20, 25) the player can purchase a depth-jump from the Gatekeeper in town.
* **Buying a break starts you at the floor *after* it:** buy floor 5 → start at floor 6; buy floor 10 → start at floor 11.
* Depth-jumps are **gated by having cleared that break's boss** — you can only buy jumps to breaks you have already reached and beaten.
* This replaces the old "start in a later zone by beating the previous zone boss" rule. There is no forced re-fight of a prior boss on entry; the gate is the essence purchase plus prior clear.

---

## **Encounter Types**

Each encounter on the run map is one of the following:

### **Combat**

* The majority of encounters — fight a group of 1-5 enemy creatures
* Enemy composition is drawn from the current depth band's creature pool
* Deeper floors have stronger enemies and more complex ability sets. Stronger enemies will be present at higher tiers representing higher stats.

### **Shops**

* Abilities to train your creatures
* MP Recovery
* HP Recovery
* Revives
* Shops are paid for in **Obols**, the in-run currency earned from every fight.
* Obols spent here on survival (heals, revives, capture, items) are Obols that won't convert to Essence on exit — the run's core spend-now-vs-keep tension: spend now to survive deeper, or keep Obols to convert into permanent Essence when you leave.

### **Rest Points**

* Restore some HP 
* Restore MP to full for one pet
* Learn a random ability for a single pet
* No mark progress or XP is earned at rest points

### **Random Events**

* Narrative encounters with risk/reward choices
* Examples: a trapped creature that can be freed (joins inventory) or left, a cursed shrine that offers a powerful relic but debuffs the party, a merchant with a rare item at an inflated price
* Events should create memorable run moments and give the player agency outside of combat

---

## **Run Shape**

How the player navigates between encounters. The leading options under consideration:

### **Pick-Next (Current Lead)**

After each encounter, the player chooses between 2–3 offered next encounters. No map, just the immediate choice.

* Reduces decision anxiety and keeps pacing tight
* Trade-off options can emerge through encounter type variety (shop vs. combat vs. event)
* The next 2–3 encounters could be previewed during reward selection, letting the player plan one step ahead
* This is also the moment where players could swap creatures in and out of the active party

### **Alternatives Under Consideration**

* **Branching Map (Slay the Spire style)** — See the whole act, pick a path. May add unnecessary strategic overhead.

---

## **Floor Navigation**

Within a single floor/encounter, the structure is minimal:

* Each encounter is a single event — one combat, one shop, one rest, one event
* No room exploration, grid movement, or dungeon crawling within an encounter
* The tower's depth comes from the sequence of encounters, not from spatial navigation
* This keeps the pacing tight and the focus on combat and party management

---

## **Boss Design**

Bosses punctuate the single descent on a fixed cadence: a **mini-boss every 5 floors** (floors 5, 15, 25) and a **major boss every 10 floors** (floors 10, 20, 30).

## **Mini-Bosses**

* Appear every 5 floors (on the 5-floor breaks that are not major-boss floors)
* Stronger than standard enemies, specific creatures in variant colors
* Can be captured during runs; reverts to base stats when captured but unlocks the variant color option
* A source of Floor Marks (see below)

### **Major Bosses**

* Appear every 10 floors — unique creatures not found in the wild
* Higher stat pools and unique abilities
* Defeating a major boss unlocks that boss creature for breeding (it cannot be captured during the fight)
* The primary source of Floor Marks

### **Floor Marks**

* Floor Marks are **re-homed onto the mini and major bosses** — they were previously tied to zone bosses, which no longer exist.
* Clearing a mini-boss or major boss is the accomplishment that grants Floor Mark progress. (Making an earned mark permanent is a separate essence spend, handled in town.)

### **Final Boss**

* The floor-30 major boss caps the bounded vertical slice
* Significantly harder than the earlier major bosses
* Final boss design and mechanics are TBD — whether it has phases, unique mechanics, or is simply a stat-check is an open question
* In endless mode, floor 30 becomes just another major boss and the descent continues

---

## **Procedural Generation Rules**

* Boss floors are fixed by the cadence (mini-boss every 5 floors, major boss every 10); the floors between are generated procedurally.
* Encounter order is randomized within constraints: at least one shop and two rest points in each 5-floor stretch
* The last floor before any boss (mini or major) is always a rest point
* Combat encounters never appear more than three times consecutively
* Rest and shop encounters should never appear more than twice consecutively
* The first floor of a run (or the first floor after a depth-jump start) is always combat (to set the tone and difficulty)
* Random events have a lower spawn rate than combat or shops — roughly 1–2 per 5-floor stretch
* Seeds can be used to reproduce a specific run layout for sharing or challenge purposes

---

## **Open Questions**

* Visual and thematic identity for each depth band, and where the bands transition along the 30-floor descent
