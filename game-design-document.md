# **Hollow Kin — Game Design Document**

*Working Document — Subject to Change*

---

## **Overview**

Hollow Kin is a browser-based creature collector roguelite. Players descend a procedurally generated tower with a party of bred creatures, gathering resources, capturing new creatures, and earning genealogy progress that persists across runs. The core loop is built around a breeding system inspired by Dragon Quest Monsters, tower progression inspired by Azure Dreams, and roguelite run structure with a hard reset on both player and creature levels each run.

---

## **Core Philosophy**

* Creatures reset to level 1 at the start of every run  
* Persistent progress lives entirely in the breeding genealogy system — bloodlines, stars, and marks  
* No archetype-level rock-paper-scissors matchups to avoid run-ruining matchup problems  
* Individual creature resistances and weaknesses provide tactical depth without hard counters  
* Breeding is a natural rhythm, not a wall the player hits

---

## **The Run**

### **Party Composition**

* Player brings **3 creatures** into the tower each run  
* Creatures start at level 1 and level up during the run  
* Levels do not persist after the run ends

### **Player Goals Each Run**

* Earn **Marks** for creatures through specific accomplishments  
* Push for **Star Rating** increases that raise a creature's level cap through breeding  
* Collect loot and resources to improve the town  
* Capture new creatures using inventory items  
* Farm **Breeding Stones** to enhance breeding outcomes

### **Auto-Combat**

* Player combat is active and turn-based  
* Players can set auto-rules similar to Dragon Quest to handle low-difficulty encounters  
* The auto toggle can be switched on or off at any time — during battle or from the map overview  
* Players are never locked into a choice, preserving full agency

---

## **Run Structure**

### **Run Length**

* A winning run is **14 encounters** with the **15th being the boss**
* Encounters include a mix of combat, shops, rest points, and random events

### **Run Shape**

The current leading options for how players navigate a run:

* **Pick-Next** — After each fight, choose between 2–3 offered encounters. No map, just the immediate choice.
  * Reduces decision anxiety and keeps pacing tight
  * Trade-off options can still emerge through treasures, creature synergies, or path variety
  * Seeds still work since the things that augment them would be earned during runs
* **Branching Map (Slay the Spire style)** — See the whole act and pick a path through different node types
  * May add unnecessary strategic overhead for this game's pacing
  * Could work better as a between-section choice (e.g., telegraphing the next 2–3 fights during reward selection and letting players swap creatures)
* **Linear with Reward Options (Monster Train style)** — Linear progression but players choose between reward sets after encounters
* **Non-Linear** — Players start where they want and move at their own pace. Rushing to the boss risks losing but offers larger token rewards for fast clears

### **Non-Combat Encounters**

* **Shops** — Spend resources gathered during the run on items, stones, or capture supplies
* **Rest Points** — Heal creatures or swap party members in and out of the active roster
* **Random Events** — Narrative encounters with risk/reward choices

### **Relics**

Run-based relics are earned during a run and provide stackable or conditional bonuses. They do not persist after the run ends.

**Relic Pool (Examples)**

* **Chain Lightning** — Damage chains to one extra enemy for 10% (stacks up to 4 times)
* **Red Meat** — Enhances Fauna ATK by 10%
* **Beast Master** — Fauna abilities trigger with one less Fauna in the party
* **Rock Lobster** — Enhances health by 20% for frontline units
* **Phoenix Down** — At the end of battle, automatically revive a creature with 1 HP (3 uses)
* **Touch Grass** — Flora have Thorns 1
* **Mog** — Units that start battle at full health gain 1 Haste
* **Bad Research** — Your Flora are also Fauna
* **Oogy Boogy** — Kami share their passive with Spirits

### **Point-Buy Starter System (Optional)**

*Under consideration — not yet committed to the design.*

Instead of freely choosing any three creatures, players are given a **budget** to spend on their starting party. Higher-star or stronger creatures cost more, creating a pre-run team composition puzzle:

* Take one high-star creature and fill the remaining slots with weaker picks, or spread the budget across a balanced mid-tier team
* Creates meaningful tension at the party select screen — the run starts before the tower does
* Budget could scale with overall account progression, giving veteran players more flexibility without removing the constraint
* Default starters are always available at zero cost to prevent soft-locks

---

## **Creatures**

### **Creature Object Fields**

| Field | Description |
| ----- | ----- |
| `id` | Unique creature identifier |
| `name` | Display name |
| `archetype` | One of eight archetypes |
| `hp` | Hit points |
| `mp` | Magic points |
| `str` | Physical attack power |
| `def` | Physical defense |
| `wis` | Magic defense / healing power |
| `spd` | Turn order and evasion modifier |
| `int` | Magic attack power |
| `star_rating` | Genealogy depth indicator, increases under breeding conditions |
| `level_cap` | Maximum level this creature can reach, derived from star rating |
| `longevity` | Number of runs remaining before the creature must be bred or retired |
| `marks` | Array — max one mark slot per creature |
| `traits` | Array of trait IDs — passive and triggered effects |
| `abilities` | Array of up to four ability IDs |
| `lineage` | References to parent creature IDs |
| `resistances` | Array of damage types this creature resists |
| `weaknesses` | Array of damage types this creature is weak to |

### **Star Rating**

* Represents genealogy depth and breeding quality  
* Higher star rating increases the creature's level cap  
* Stars are a breeding output — a creature's star rating only increases through breeding, never during a run
* When a creature hits its level cap during a run, it unlocks a permanent trait and becomes **breed-ready**
* Two breed-ready creatures of the same star produce an offspring one star higher (e.g., two breed-ready Star 1s produce a Star 2)
* A visible indicator on the creature signals breed-readiness to the player

### **Longevity**

* Every creature has a run counter that ticks down the moment a run starts, regardless of outcome
* When it reaches zero the creature must be bred or retired
* This ensures players engage with the breeding system regularly rather than farming indefinitely with the same roster
* Longevity scales with star rating:

| Star Rating | Longevity (Runs) |
| ----- | ----- |
| 0 (Wild) | 2 |
| Star 1 | 4 |
| Star 2 | 6 |
| Star 3 | 8 |
| Star 4 | 10 |
| Star 5 | 12 |
| +1 star | +2 runs |

* A creature going from 1 to 0 longevity at the start of a run completes that run but is forced into the creature box afterward — it must be bred or retired before the next run

### **What Happens When a Creature Retires Without Breeding**

* The creature leaves behind a **Breeding Relic** based on its current traits and level  
* The relic can be used at the Enhancer to influence future breeding  
* Breeding Relics can offer traits or flat stats  
* Only one relic can be used per breeding event  
* This removes anxiety from the longevity limit and creates a strategic option: intentionally retiring a creature solo to preserve a specific trait for a different bloodline later

---

## **Breeding System**

### **Rules**

* Two creatures are combined to produce one offspring  
* Both parent creatures are **retired** upon breeding  
  * These creatures do not offer Relics  
* Players may **summon the base form** of any retired creature at any time — you get the shell but not the accumulated progress  
* Offspring inherit abilities from parents — players choose at creation time whether to add inherited abilities  
* Parent abilities can override the offspring's default ability set  
* Since any creature can theoretically learn any ability, a single unified ability library is used  
* Creatures can have a max of four abilities

### **Stars and Marks at Breeding**

* Offspring's star rating is determined by the parents' combined genealogy  
* Breeding two creatures with appropriate star ratings produces higher-quality offspring with a higher level cap  
* Offspring may begin with an ability already unlocked, improved base stats, or an inherited trait depending on breeding quality

### **Trait Inheritance**

* Each creature can hold up to four traits  
* Traits are assigned randomly at creature creation (natural traits) or inherited through breeding  
* When breeding, the number of available trait slots on the offspring is determined by star quality up to a max of four.  
* Low quality monsters can only hold low quality traits. Once a breeding genealogy has reached a certain point higher level traits are unlocked  
* Using a Breeding Stone or Relic can influence which traits fill those slots

### **Mismatched Breeding**

* Offspring star = (Parent A star + Parent B star) / 2, rounded down (e.g., Star 3 + Star 1 = Star 2, Star 2 + Star 2 = Star 2)
* Both parents must be **breed-ready** (have hit their level cap during a run) to breed
* Two breed-ready creatures of the same star produce an offspring one star higher than the formula result (e.g., two breed-ready Star 2s = Star 3)
* Strongly rewards equalizing pairs before breeding without hard-blocking mismatched pairs

---

## **Marks System**

### **What Marks Are**

* Earned during runs through specific accomplishments  
* Each creature has **one mark slot**  
* A mark is a small relic-like reward tied to how it was earned  
* Creatures leave their mark behind when retired which can then be added to other creatures in their mark slot  
* If two creatures are bred, both containing marks, the subsequent creature can take over one mark. The other is lost.

### **Mark Types (Examples)**

* **Depth Mark** — earned by surviving to a floor threshold; grants bonus stats on floors beyond that depth  
* **Ice Mark** \- earned by defeating the first section boss with an all ice type based team. Increases ice damage

### **Marks and Breeding**

* Marks are consumed on breeding. They either pass down to the next line or are lost  
* The mark slot on the offspring is inherited at birth and based on the parent(s) earned marks

---

## **Traits System**

### **What Traits Are**

* Passive or triggered effects that modify the creature object  
* Assigned randomly at creature creation or inherited through breeding  
* Stored as IDs on the creature — the ID references coded logic, not data

### **Trait Categories**

* Stat increases (HP, MP, STR, DEF, WIS, SPD, INT)  
* Start of battle buffs  
* Resistance to specific damage types or creature attacks  
* Buffs when partied with specific archetype types  
* Evasion increases  
* Other conditional effects

### **Traits and Stars**

* Creatures can hold **up to four traits**  
* A one-star creature is simple, a four-star creature is more fully realized  
* A one star creature only has one low level trait that it unlocks when reaching its level cap. A two star has two traits one low level and one star 2\. This continues until star 4 unlocking all four traits. At star 5 a creature can have two star 2 traits one star 3 and a star 4

---

## **Ability System**

### **Rules**

* Each creature has a **maximum of four abilities**  
* Creatures have a default ability set based on their species  
* Abilities can be inherited from parents during breeding — players choose whether to include them at creation  
* Parent abilities can override default abilities  
* All abilities come from a single shared library — any creature can theoretically learn any ability

### **Ability Object Fields**

| Field | Description |
| ----- | ----- |
| `id` | Unique ability identifier |
| `name` | Display name |
| `type` | damage / heal / buff / debuff / status |
| `damage_type` | Element or physical type |
| `stat_scaling` | Which stat powers this ability (STR, INT, WIS etc.) |
| `targeting` | single / all\_enemies / self / ally / all |
| `mp_cost` | MP required to use |
| `effect_id` | Reference to conditional logic if applicable |

### **Ability Count**

* \~72 abilities spanning attacks, buffs, debuffs, and heals across multiple types  
* Creatures share abilities across archetypes — roughly 80-120 abilities is the target range  
* Every ability must be assigned to at least one creature as a default to avoid orphaned abilities

### **Balancing Note**

* No single ability should be an automatic pick at all times

---

## **Archetypes**

Eight archetypes define a creature's general identity, combat role, and default ability pool. There is no archetype-level rock-paper-scissors. Individual resistances and weaknesses on each creature provide tactical variation.

| Archetype | Combat Identity |
| ----- | ----- |
| **Kami** | Ghost-type electric attacks. High defense |
| **Spirits** | Ghost-type attacks and debuffs |
| **Flora** | Heals and buffs |
| **Fauna** | Physical attacks, high speed |
| **Rock** | High defense, low speed, physical attacks |
| **Mecha** | Flame and electricity, low HP, high speed |
| **Food** | Buffs and physical attacks — buffs are stronger but shorter duration than Flora |
| **Human** | Physical attacks and ice |

---

## **Capture System**

* \* Players capture creatures during runs using \*\*Plasm\*\* as the capture resource  
* \* Plasm accumulates from winning battles — the more Plasm held, the higher the base capture chance  
* \* Capture probability is based on two factors: total Plasm held and the target creature's current HP — more Plasm and lower HP means a higher capture chance  
* \* Captured creatures are held in the item inventory during the run, forcing resource constraints  
* \* Captured creatures can substitute into the active battle party mid-run — when subbed in, the replaced creature moves to inventory and becomes subject to inventory loss on death  
* \* The three active battle creatures are always protected from loss  
* \* If the player dies, anything in inventory not in a safe slot is lost, including captured creatures  
* \* Upon successfully leaving the tower, captured creatures move to the Creature Box if space is available

## Run Failure

\* A run ends when all three active creatures are knocked out

\* The player returns to town — active battle creatures are always safe and return to the Creature Box

\* Anything in inventory not in a safe slot is lost: captured creatures, consumables, and resources

\* Longevity ticks down at the start of every run regardless of outcome — failed runs still cost longevity

---

## **The Town**

### **Breeding Box**

* Where creatures are stored when not on a run  
* Starts with limited slots, expands over time through upgrades  
* Creatures in the box do not earn marks or levels passively by default  
* Once the breeding box is upgraded enough creatures will earn small passive levels. These reset if brought on a run, but otherwise act as a way for creatures to earn their traits when not on runs

### **Leathersmith**

* Upgrades backpack capacity  
* More inventory space means more plasm, more stones, more capture options per run

### **Enhancer**

* Uses Breeding Stones and Breeding Relics to improve breeding outcomes  
* Single-use stones, not global buffs — every use is a deliberate choice  
* As the Enhancer levels up, new abilities and stone types become available  
* One relic or stone per breeding event maximum to prevent stacking exploits  
* Acts as an active crafting station — players choose specific traits to push into a breed, not a passive upgrade

---

## **Technical Architecture**

### **Engine**

* Browser-based using **Phaser** (canvas framework)  
* Two primary scenes: Map Scene (floor navigation) and Combat Scene (turn-based battle)  
* State is passed between scenes via Phaser's scene manager

### **Data-Driven Design**

* All creature stats live in a master spreadsheet exported as JSON  
* Stats are separated from behavior — the spreadsheet holds numbers, the code holds logic  
* Each creature is a data container (plain JS object/class) instantiated from JSON at runtime  
* A single generic creature class handles all combat behavior, reading from the data container  
* Trait and ability effects are stored as IDs that reference a coded logic library

### **Workflow**

1. Design and balance stats in the master spreadsheet  
2. Export as JSON  
3. Importer script reads JSON and creates creature data objects  
4. Generic creature class initializes from data object at spawn time  
5. Rebalancing means editing the spreadsheet, re-exporting, and re-running the importer

### **Trait and Ability Architecture**

* Traits and abilities are stored as IDs on the creature object  
* A `TraitLibrary` and `AbilityLibrary` map IDs to their logic functions  
* This keeps data containers clean and behavior centralized  
* Resistances and weaknesses are arrays of damage type strings on each creature object

---

## **Open Questions**

* \* Floor scaling for veteran bloodlines — scaling does not occur but players can start in later zones by defeating the boss of the previous zone with their starting generation and earn boss level rewards (run-based relics and plasm)  
* \* Marks/Relics/Stones retirement output — naming and mechanics need consolidation across docs  
* \* Full Enhancer upgrade tree and stone type variety  
* \* Economy balancing framework: drop rates, building costs, Plasm scarcity, progression timelinex

---

*Document version: working draft. All systems subject to revision.*