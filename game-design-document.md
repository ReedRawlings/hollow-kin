# **Hollow Kin — Game Design Document**

*Working Document — Subject to Change*

---

## **Overview**

Hollow Kin is a browser-based creature collector roguelite. Players descend a procedurally generated tower with a party of bred creatures, harvesting **Essence** from every fight and spending it to permanently strengthen their creatures, capturing new creatures, and earning genealogy progress that persists across runs. The core loop is built around a breeding system inspired by Dragon Quest Monsters, tower progression inspired by Azure Dreams, and roguelite run structure — but progression is permanent and essence-driven rather than reset each run.

---

## **Core Philosophy**

* **One currency only — Essence.** Essence is the single permanent spend for everything in the game. There are no parallel "almost-currencies."
* Creatures **keep a permanent essence-driven level floor** between runs — progress persists rather than resetting. Any temporary levels gained within a run vanish at run end; the essence-bought floor remains.
* Essence is harvested from every fight and spent on permanent levels, trait unlocks, permanent marks, depth-jumps, backpack capacity, and in-run survival (heals, revives, capture).
* Persistent progress lives in **essence investment and the breeding genealogy** — bloodlines, stars (for now), and permanent marks
* No archetype-level rock-paper-scissors matchups to avoid run-ruining matchup problems  
* Individual creature resistances and weaknesses provide tactical depth without hard counters  
* Breeding is a natural rhythm, not a wall the player hits — retiring parents carries essence forward to the offspring as a jump-start

---

## **Essence — The Progression Spine**

Essence is the single permanent currency and the engine of all progression.

* **Earned** from every fight; total per run scales with the **number of battles completed**, weighted `normal < mini-boss < major boss`
* **Permanent and non-refundable** — once spent on a creature, essence is locked to that creature (no reclaiming it for future creatures)
* **Spent on:** permanent levels, trait unlocks, permanent marks, depth-jumps, backpack capacity, and in-run survival (heals, revives, capture)

### **Same Wallet, Two Demands**

Essence earned in a run can be spent *right now* to survive the descent, **or** banked and carried back to town for *permanent* upgrades. One shared pool, one real tradeoff — every heal is a level you didn't buy. This spend-now-vs-bank decision is the heartbeat of a run (it replaces the old Plasm economy).

### **Levels From Essence**

* Essence raises a creature's **permanent starting-level floor**
* The essence **cost per level rises classically** — each level costs more than the last, so leveling decelerates naturally
* Target pace: a strong run (~floor 10) nets roughly **2–3 permanent levels** early on — enough to feel rewarding and to let enemies scale, without trivializing progression

---

## **The Run**

### **Party Composition**

* Player brings **3 creatures** into the tower each run  
* Creatures start each run at their **permanent essence-driven level floor** and can gain temporary levels during the run  
* Temporary in-run levels do not persist; the permanent essence floor does (Model A)  
* *Playtest fallback (Model B, not built): if temporary in-run leveling feels bad, remove it entirely and let essence be the only level source*

### **Player Goals Each Run**

* Harvest **Essence** from every fight — the more battles completed, the more essence (weighted toward mini/major bosses)  
* Decide whether to spend essence *now* on in-run survival (heals, revives, capture) or **bank it** for permanent upgrades in town  
* Earn **Marks** for creatures through specific accomplishments (spend essence later to make them permanent)  
* Push deeper to unlock **depth-jumps** and to earn essence faster  
* Capture new creatures using essence

### **Auto-Combat**

* Player combat is active and turn-based  
* Players can set auto-rules similar to Dragon Quest to handle low-difficulty encounters  
* The auto toggle can be switched on or off at any time — during battle or from the map overview  
* Players are never locked into a choice, preserving full agency

---

## **Run Structure**

### **Run Length**

* The tower is **one continuous descent** — no discrete zones. **30 floors** for the current slice (bounded now, endless later)
* **Mini-boss every 5 floors; major boss every 10 floors**
* Roughly half of floors are combat — the rest are shops, rest points, and random events
* Enemy pools and visual identity can still shift by **depth band**, but there are no hard zone walls
* Failed runs end earlier; there is no longevity cost (longevity is removed)

### **Depth-Jumps**

* Clearing a 5-floor break's boss unlocks a **purchasable start point** at that break, bought with essence
* Buying a break starts you at the floor *after* it: buy floor 5 → start at floor 6; buy floor 10 → start at floor 11
* Lets veteran bloodlines skip proven-easy content and push their frontier while earning faster (deeper floors = more essence)
* See `tower-structure.md` for full rules

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
| `level_cap` | Maximum level this creature can reach — the ceiling essence fills toward (currently derived from star rating) |
| `permanent_level` | Permanent essence-driven level floor the creature starts each run at |
| `essence_invested` | Total essence permanently spent on this creature |
| `marks` | Array — max one mark slot per creature |
| `traits` | Array of trait IDs — passive and triggered effects |
| `abilities` | Array of up to four ability IDs |
| `lineage` | References to parent creature IDs |
| `resistances` | Array of damage types this creature resists |
| `weaknesses` | Array of damage types this creature is weak to |

### **Star Rating**

* Represents genealogy depth and breeding quality  
* Higher star rating **raises the level ceiling** — the cap that essence-bought levels fill toward but cannot exceed (Model A)
* Stars are a breeding output — a creature's star rating only increases through breeding, never during a run
* Two same-star parents produce an offspring one star higher (e.g., two Star 1s produce a Star 2)
* A visible indicator signals breed-readiness to the player
* **Future direction (backup C, strongly favored):** remove stars entirely and let essence own the level cap directly. Nothing should be built that hard-couples to stars.

### **Longevity — Removed**

Longevity has been **removed** from the design. Permanent essence progression is the pressure that keeps players engaged; a death clock on top is unnecessary and fights the "invest in your bloodline" theme. Creatures live until the player chooses to breed (retire) them.

---

## **Breeding System**

### **Rules**

* Two creatures are combined to produce one offspring  
* Both parent creatures are **retired** upon breeding  
* **Essence carry-over (jump-start):** the parents' invested essence/levels partially carry to the offspring, so a new bloodline doesn't start from zero. Breeding is still a real trade — you give up two developed creatures — but no longer a hard reset of progress.
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

* **Earned** during runs through specific accomplishments — temporary by default  
* Each creature has **one mark slot**  
* **Made permanent by spending essence** at the Mark-binder — essence buys permanence, not the mark itself (you still have to earn it)  
* Mark accomplishment thresholds are pegged to the single 30-floor descent (e.g., mini-boss at floor 5)  
* See `marks-system.md` and `marks-catalog.md` for the full rules and re-pegged thresholds

### **Mark Types (Examples)**

* **Depth Mark** — earned by surviving to a floor threshold; grants bonus stats on floors beyond that depth  
* **Ice Mark** \- earned by defeating the first section boss with an all ice type based team. Increases ice damage

### **Marks and Breeding**

* Marks are **not inherited** through breeding — they are personal to the creature that earned them
* A mark's effect can only be brought to a new creature by earning it directly on that creature and binding it with essence
* See the Marks System doc for full rules

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

### **Traits and Essence**

* Creatures can hold **up to four traits**, one per slot
* Trait slots and trait levels now unlock at **essence thresholds** (spent at the Trait-keeper), not star thresholds
* The old star-based trait table is retired — see the Traits System doc for the essence-threshold progression table
* This is intentionally forward-compatible with removing stars entirely (see Star Rating, backup C)

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
| **Kami** | Debuffs and ice |
| **Spirits** | Ghost-type attacks and debuffs |
| **Flora** | Heals and buffs |
| **Fauna** | Physical attacks, high speed |
| **Rock** | High defense, low speed, physical attacks |
| **Mecha** | Flame and electricity, low HP, high speed |
| **Food** | Buffs and physical attacks — buffs are stronger but shorter duration than Flora |
| **Human** | Physical attacks and ice |

---

## **Capture System**

* \* Players capture creatures during runs by spending **Essence** as the capture resource  
* \* Capture is an in-run essence spend — it competes with banking essence for permanent upgrades (spend-now-vs-bank)  
* \* Capture probability is based on two factors: essence spent on the attempt and the target creature's current HP — more essence and lower HP means a higher capture chance  
* \* Captured creatures are held in the item inventory during the run, forcing resource constraints  
* \* Captured creatures can substitute into the active battle party mid-run — when subbed in, the replaced creature moves to inventory and becomes subject to inventory loss on death  
* \* The three active battle creatures are always protected from loss  
* \* If the player dies, anything in inventory not in a safe slot is lost, including captured creatures  
* \* Upon successfully leaving the tower, captured creatures move to the Creature Box if space is available

## Run Failure

\* A run ends when all three active creatures are knocked out

\* The player returns to town — active battle creatures are always safe and return to the Creature Box

\* Anything in inventory not in a safe slot is lost: captured creatures, consumables, and unbanked resources

\* Essence already spent on permanent upgrades is safe; essence carried but not yet banked follows the inventory-loss rules — a reason to convert it before risking the deeper floors

---

## **The Town — Essence Hub**

Town is a hub of "folks" who turn essence into permanent upgrades. The Enhancer and Leathersmith are removed. See `town.md` for the full detail.

| Station | Function | Essence? |
| ----- | ----- | ----- |
| **Creature Box** | View available creatures, manage party | No — management only |
| **Leveler** | Buy permanent levels | Yes |
| **Trait-keeper** | Unlock trait slots / levels | Yes |
| **Mark-binder** | Make an earned mark permanent | Yes |
| **Gatekeeper** | Unlock depth-jumps | Yes |
| **Quartermaster** | Increase backpack capacity (hold items for the descent — inherits the old Leathersmith role) | Yes |
| **Breeder** | Breed a pair (retire parents, carry essence to offspring) | Yes |

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

### **Save System**

* Player data is persisted via **Supabase** (hosted PostgreSQL + auth + realtime)
* Save data includes: creature box contents, creature instances (stats, traits, marks, lineage), town upgrade levels, resource counts, bestiary progress, and breeding history
* Saves are tied to authenticated accounts — players can resume on any browser
* Game state syncs on key events: end of run, breeding, town upgrades, party changes
* Species templates and ability/trait libraries are read-only client-side data loaded from exported JSON — not stored in Supabase

---

## **Resolved Design Decisions**

* Progression is **permanent and essence-driven** (2026-07-23 pivot) — creatures no longer reset to level 1; they keep an essence-bought level floor. Plasm, Breeding Stones, and Longevity are removed. See `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md`.
* Tower is **one continuous 30-floor descent** (no zones). Depth-jumps let veterans buy a start point at any cleared 5-floor break.
* Marks — consolidated into separate reference docs (marks-catalog.md); breeding-stones.md is retired/cut
* Save architecture — Supabase (see Technical Architecture)
* Ability archetype distribution — DQM-style wide overlap with basic abilities available across all archetypes
* Tension / Psyche Up — cut. Existing buff abilities (Bold, Overdrive, Focus) already cover the "spend a turn to hit harder" dynamic without adding a separate system
* Accuracy — uses the Accuracy column from the ability CSV. Evasion is trait-driven only (Evasion Up trait + Blind status). SPD does not affect evasion — it handles turn order and crit chance only
* Buff/debuff stages — capped at ±3, ranging from 0.75x to 1.5x. Tighter than Pokémon's system to prevent snowballing
* Critical hits — player-only (enemies cannot crit). 5% base rate, 15% for high-crit abilities, SPD scaling. 1.5x damage that ignores target's defensive buffs
* Damage formula terminology — standardized on STR/INT/DEF/WIS throughout combat doc

## **Open Questions**

### **Combat**

* **Boss phase mechanics** — do bosses have multiple phases or unique mechanics beyond stat inflation?

### **Economy & Progression**

* Essence tuning — earn weights (normal/mini/major), level cost-curve steepness, depth-jump prices (all placeholders pending playtest)
* Whether Model A (temporary in-run leveling) survives or we fall back to Model B (essence-only levels)
* Whether stars survive (Model A) or are removed entirely (Model C, favored)
* Single vs. split essence pool for in-run vs. permanent spends
* Catch-up / pity mechanics for players who consistently fail runs

### **Content**

* Star 12 special unlock (traits doc lists candidates but no decision)
* Bestiary / Monsterpedia design — referenced in combat (auto-combat needs it) and UI/UX but no dedicated doc
* Ability count — currently 72, target range is 80–120. Flora-flavored damage abilities (thorns, spores, vine attacks) would fill the gap
* Visual and thematic identity for each tower zone

---

*Document version: working draft. All systems subject to revision.*