# **Hollow Kin — Tower Structure**

*Working Document — Subject to Change*

---

## **Overview**

The tower is the procedurally generated environment where all runs take place. Players descend the tower with a party of three creatures, progressing through encounters until they reach the boss or are wiped out. The tower's structure determines pacing, difficulty curves, and the cadence of meaningful decisions within a run.

---

## **Run Length**

* A winning run is **14 encounters** with the **15th being the boss** this will be expanded beyond once we've finished playtesting combat, capture, and breeding mechanics
* Failed runs end earlier but still consume longevity
* Each zone will be roughly 14 encounters with 3 zone occurring over an entire rune

---

## **Zones**

The tower is divided into zones. Each zone has its own enemy pool, visual identity, and boss.

### **Zone Structure**

* The exact number of zones is TBD, but the proposed structure is **3 zones per run**
* Each zone contains roughly 5-7 encounters before a zone boss
* Zone bosses are mandatory — clearing a zone boss unlocks the next zone
* The final boss of the run appears after all zone bosses are cleared
* Consist of 2-3 archetypes of creatures. Adding variability to each run. 
* In the first zone of every run players will encounter 1-3 creatures per combat for the first 3 combat events giving them some time to build up experience before going into a full scale fight

### **Zone Progression Across Runs**

* Players who defeat a zone boss with their starting generation can begin future runs in that zone
* Starting in a later zone skips easier content but still costs full longevity
* Later zone starts offer higher-quality rewards (more Plasm, better stones, rarer creature encounters)
* This gives veteran players a reason to push forward rather than farming early zones repeatedly
* To enter a higher zone players must immediately face a random prior zone boss. They earn rewards from that boss for their run. This makes sure they're ready to face the higher zone. 

---

## **Encounter Types**

Each encounter on the run map is one of the following:

### **Combat**

* The majority of encounters — fight a group of 1-5 enemy creatures
* Enemy composition is drawn from the current zone's creature pool
* Higher floors within a zone have stronger enemies and more complex ability sets. Stronger enemies will be present at higher tiers representing higher stats.

### **Shops**

* Abilities to train your creatures
* MP Recovery
* HP Recovery
* Revives
* Plasm

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

## **Mini Boss**

* 1-2 per zone
* Stronger than standard enemies, specific creatures in variant colors
* Can be captured during runs, reverts to base stats when captured bu unlocks the variant color option


### **Zone Bosses**

* One per zone — a unique creature not found in the wild
* Zone bosses have higher stat pools and unique abilities
* Defeating a zone boss unlocks that boss creature for breeding (it cannot be captured during the fight)
* Zone bosses are the primary source of Floor Marks

### **Final Boss**

* Appears as encounter 15 after all zones are cleared
* Significantly harder than zone bosses
* Final boss design and mechanics are TBD — whether it has phases, unique mechanics, or is simply a stat-check is an open question

---

## **Procedural Generation Rules**

* Encounter order is randomized within constraints: at least one shop and two rest point per zone
* The last event before the boss is always a rest point
* Combat encounters never appear more than three times consecutively
* Rest and shop encounters should never appear more than twice consecutively
* The first encounter of each zone is always combat (to set the tone and difficulty)
* Random events have a lower spawn rate than combat or shops — roughly 1–2 per zone
* Seeds can be used to reproduce a specific run layout for sharing or challenge purposes

---

## **Open Questions**

* Exact number of zones (3 is proposed but untested) - A run will have three zones but zones are comprised of a random combination of 2-3 archetypes each with its own boss. 
* Visual and thematic identity for each zone
