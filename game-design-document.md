# **Hollow Kin — Game Design Document**

*Working Document — Subject to Change*

> **Last verified:** 2026-07-30 — full sweep against `src/`. Corrected in that pass: save
> version and contents, archetype count, the scene registry, the Ability object fields,
> the capture pricing model, the trait/ability architecture claims, crits, evasion, run
> seeding, and several "designed" features marked as though they shipped. Systems that are
> designed but unbuilt are now flagged inline where they appear.

---

## **Overview**

Hollow Kin is a browser-based **permanent-progression creature collector** built on a roguelite run structure. Players descend a procedurally generated tower with a party of three bred creatures, harvest **Obols** from every fight, and convert what they carry back out into **Essence** — the permanent currency that buys levels, traits, marks, and deeper starting floors.

**A run is a harvesting trip, not the unit of progress.** Creatures do not reset. They keep an essence-bought level floor, their bloodline, and anything permanence has been paid for. What a run risks is the *take* — the Obols you were carrying and one item from your pack — not the creatures themselves.

The core loop draws its breeding from Dragon Quest Monsters, its tower from Azure Dreams, and its run pacing from Slay the Spire. The roguelite inheritance is the **shape of a descent** — procedural floors, push-your-luck depth, run-only relics. It is not the progression model.

---

## **Core Philosophy**

* **One permanent currency — Essence.** Essence is the single permanent store of value and the only thing spent on permanent progression. **Obols** are a run-scoped token (in-run fuel) earned from fights and spent during the descent; leftover Obols convert to Essence when you leave the tower. No competing permanent currencies.
* Creatures **keep a permanent essence-driven level floor** between runs — progress persists rather than resetting. Any temporary levels gained within a run vanish at run end; the essence-bought floor remains.
* Essence (permanent) is spent on levels, trait unlocks, permanent marks, depth-jumps, and backpack capacity. Obols (in-run) are spent on heals, revives, capture, and shop items.
* Persistent progress lives in **essence investment and the breeding genealogy** — bloodlines, stars (for now), and permanent marks
* No archetype-level rock-paper-scissors matchups to avoid run-ruining matchup problems  
* Individual creature resistances and weaknesses provide tactical depth without hard counters  
* Breeding is a natural rhythm, not a wall the player hits — retiring parents carries essence forward to the offspring as a jump-start

---

## **What Persists, What Resets**

Progression is permanent. A handful of things are still deliberately run-scoped, and **those four are the ones that get mistaken for leftovers from the old roguelite design.** Each is intentional. Do not "fix" them into persistence.

| Resets at run end | Why it resets — and what not to change |
| ----- | ----- |
| **Temporary in-run levels** | Deliberate (Model A). The essence-bought level *floor* persists; levels gained on top of it during a descent do not. Do not remove in-run leveling as a reset leftover — dropping it (Model B) is a playtest fallback, not the current design. |
| **Obols** | Deliberate. Obols are run-scoped fuel. Leftover Obols convert to Essence on exit; spent Obols are simply gone. Do not make Obols persist — a second permanent currency was explicitly rejected. |
| **Relics** | Deliberate, and this is the roguelite element the design keeps on purpose. Run-only power-ups are the intended shape. |
| **Unbound marks** | Deliberate (earn-then-lock). A mark earned in a run must be purchased to activate for each creature, otherwise they remain unbound and their effects don't affect creatures' |

Everything else persists: Essence, permanent levels, stars, bloodline, bound marks, unlocked trait slots, purchased depth-jumps, backpack capacity, and creatures themselves.

### **The one asymmetric case**

**A wipe costs exactly one thing, chosen at random from unprotected inventory — never the whole inventory.** That one thing may be a consumable, an item, a **found trait**, or a **captured creature** — all of them ride in inventory slots. Only the **guaranteed inventory space** protects against it.

**The three creatures the player entered the tower with can never be lost, under any circumstance.** That is absolute and separate from inventory entirely.

> **This table is the single normative statement of what is run-scoped.** The Currency, Levels, Marks, and Relics sections below describe how each system *works* and refer back here rather than restating what survives a run. If another document disagrees with this table, this table wins.

---

## **Currency — Obols (in-run) → Essence (permanent)**

Two tiers, one flow. **Obols** fuel the descent; **Essence** is the permanent store of value they convert into.

### **Obols — In-Run Currency**

* **Earned** from every fight; total per run scales with the **number of battles completed**, weighted `normal < mini-boss < major boss`
* **Spent during the run** on survival: heals, revives, capture, shop items
* Run-scoped — they do not persist as Obols

### **Essence — Permanent Currency**

* On leaving the tower, **leftover Obols convert to Essence** at a conversion rate
* **Leftover-only conversion** — Obols you spent in-run are gone; only what you didn't spend converts. So the tension is: *spend this Obol now to survive, or keep it to convert into permanent power*
* The **conversion rate is a progression lever** — raised by traits (e.g. an "Essence Distiller" trait), Quartermaster upgrades, and/or descending deeper
* **Permanent and non-refundable** — once spent on a creature, essence is locked to it. Spent on permanent levels, trait unlocks, permanent marks, depth-jumps, backpack capacity

### **The Run's Heartbeat**

Every Obol is a fork: **survive now, or bank for permanent power.** Spending keeps you alive deeper (deeper = more Obols, better conversion); hoarding banks more Essence but risks a wipe that ends the run early. Gentler and more legible than spending permanent currency directly — you're weighing a run-local token, not your savings. (Replaces the old Plasm economy.)

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

* Harvest **Obols** from every fight — the more battles completed, the more Obols (weighted toward mini/major bosses)  
* Decide whether to spend Obols *now* on survival (heals, revives, capture) or **hoard them** so more convert to Essence on exit  
* Earn **Marks** for creatures through specific accomplishments (spend essence later to make them permanent)  
* Push deeper to unlock **depth-jumps**, earn more Obols, and improve conversion  
* Capture new creatures by spending Obols

### **Auto-Combat**

* Player combat is active and turn-based  
* Players can set auto-rules similar to Dragon Quest to handle low-difficulty encounters  
* The auto toggle can be switched on or off at any time — during battle or from the map overview  
* Players are never locked into a choice, preserving full agency

---

## **Run Structure**

### **Run Length**

* The tower is **one continuous descent** — no discrete zones. **100 floors in 10 bands of 10** (bounded now, endless later)
* **Alpha caps the descent at floor 20**, the deepest the authored roster reaches — one constant, `TOWER_FLOORS`. The cap is a content limit, not a structural one
* **Mini-boss every 5 floors; major boss every 10 floors** — derived from the floor number, so the cadence holds at any depth
* Clearing the deepest floor is a distinct run outcome alongside fleeing and wiping, and converts Obols at the full non-wipe rate
* Roughly half of floors are combat — the rest are shops, rest points, and random events
* Enemy pools and visual identity can still shift by **depth band**, but there are no hard zone walls
* Failed runs end earlier; there is no longevity cost (longevity is removed)

### **Depth-Jumps**

* Clearing a 5-floor break's boss unlocks a **purchasable start point** at that break, bought with essence
* Buying a break starts you at the floor *after* it: buy floor 5 → start at floor 6; buy floor 10 → start at floor 11
* Lets veteran bloodlines skip proven-easy content and push their frontier while earning faster (deeper floors = more essence)
* See `tower-structure.md` for full rules

### **Run Shape — Pick-Next (decided and built)**

After each encounter the player chooses between 2–3 offered next encounters. There is no map, just the immediate choice.

* Reduces decision anxiety and keeps pacing tight
* Trade-off options emerge through encounter-type variety (combat vs. shop vs. event)
* Seeds would still work, since what augments a run is earned during it. ⚠️ **Not built** — descent generation calls `Math.random()` directly and takes no seed, so no run layout is reproducible today
* Pick-next is boss-aware — it never offers a path that skips a boss floor

*Considered and rejected: a branching Slay the Spire map (unnecessary strategic overhead at this pacing), linear-with-reward-sets (Monster Train), and non-linear free movement.*

### **Non-Combat Encounters**

* **Shops** — Spend Obols gathered during the run on heals, revives and carryable items. *("Stones" here meant Breeding Stones, which are cut.)*
* **Rest Points** — Restore HP or MP. *(Teaching a random ability was designed and never built.)*
* **Random Events** — Narrative encounters with risk/reward choices

### **Relics**

Run-based relics are earned during a run and provide stackable or conditional bonuses. They do not persist after the run ends.

> **Not built.** See `relics.md` — half of this already exists as `Boons.ts` and relics
> should extend that layer rather than duplicate it. Note the examples below reference
> mechanics that do not exist: **Haste** is not a stat, and **Thorns** has no
> implementation.

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

---

## **Creatures**

### **Creature Object Fields**

| Field | Description |
| ----- | ----- |
| `id` | Unique creature identifier — `kin_NNN`, zero-padded from the master sheet's row id. Opaque; never parse meaning out of the number |
| `name` | Display name |
| `archetype` | One of eleven archetypes. Content decision — authored, never derived |
| `role` | One of nine roles, orthogonal to archetype. **This is what base stats are generated from.** Content decision — authored, never derived |
| `towerIds` | Tower bands this species can be encountered in. The single source of encounter placement — pools derive from it |
| `hp` | Hit points |
| `mp` | Magic points |
| `str` | Physical attack power |
| `def` | Physical defense |
| `wis` | Magic defense / healing power |
| `spd` | Turn order and crit-chance bonus. **Not** evasion — see the Resolved Design Decisions note below |
| `int` | Magic attack power |
| `star_rating` | Genealogy depth indicator, increases under breeding conditions |
| `level_cap` | Maximum level this creature can reach — the ceiling essence fills toward (currently derived from star rating) |
| `permanent_level` | Permanent essence-driven level floor the creature starts each run at |
| `essence_invested` | Total essence permanently spent on this creature |
| `marks` | Array — max one mark slot per creature. ⚠️ **Not on the instance in code** — no mark system exists in any form |
| `traits` | `traitSlots` in code: four `{ traitId, traitLevel, unlocked }` entries. ⚠️ Only `stat`-category traits currently have any effect, and nothing ever grants one |
| `abilities` | Array of up to four ability IDs |
| `lineage` | References to parent creature IDs |
| `resistances` | Array of **wards** this creature resists |
| `weaknesses` | Array of **wards** this creature is weak to |

### **Star Rating**

* Represents genealogy depth and breeding quality  
* Higher star rating **raises the level ceiling** — the cap that essence-bought levels fill toward but cannot exceed (Model A)
* Stars are a breeding output — a creature's star rating only increases through breeding, never during a run
* Two same-star parents produce an offspring one star higher (e.g., two Star 1s produce a Star 2)
* A visible indicator signals breed-readiness to the player
* **Stars also gate trait capacity**, via the level cap — trait slots unlock at permanent levels 5/10/20/30, so a 0★ creature reaches one slot and no more until breeding raises its star

> **Stars are staying (decided 2026-07-26).** An earlier note listed removing stars entirely — "backup C" — as the strongly favored direction. That is **off the table**, and code may now couple to stars.
>
> **Why:** stars exist to stop players settling on one roster permanently. The design goal is that players keep breeding and finding new creatures rather than maxing three favourites and never changing them. A capacity ceiling that only breeding can raise is the mechanism that produces that behaviour — remove stars and the pressure goes with them.

### **Longevity — Removed**

Longevity has been **removed** from the design. Permanent essence progression is the pressure that keeps players engaged; a death clock on top is unnecessary and fights the "invest in your bloodline" theme. Creatures live until the player chooses to breed (retire) them.

---

## **Breeding System**

### **Rules**

* Two creatures are combined to produce one offspring  
* Both parent creatures are **retired** upon breeding  
* **Essence carry-over (jump-start):** the parents' invested essence/levels partially carry to the offspring, so a new bloodline doesn't start from zero. Breeding is still a real trade — you give up two developed creatures — but no longer a hard reset of progress.
* Players may **summon the base form** of any retired creature at any time — you get the shell but not the accumulated progress. ⚠️ **Not built** — there is no summon path in code; retired parents stay in the box as tombstones and nothing can re-instantiate them  
* Offspring inherit abilities from parents — players choose at creation time whether to add inherited abilities  
* Parent abilities can override the offspring's default ability set  
* Since any creature can theoretically learn any ability, a single unified ability library is used  
* Creatures can have a max of four abilities

### **Stars and Marks at Breeding**

* Offspring's star rating is determined by the parents' combined genealogy  
* Breeding two creatures with appropriate star ratings produces higher-quality offspring with a higher level cap  
* Offspring may begin with an ability already unlocked, improved base stats, or an inherited trait depending on breeding quality

### **Trait Inheritance**

* Each creature can hold up to four traits, and how many slots it can ever open is set by its **permanent level**, which stars cap
* Inheritance resolves **entirely at breeding**, in three cases: both parents had a trait in that slot → player chooses one; one did → it passes; neither did → the slot stays empty
* A trait inherited into a slot the newborn's level hasn't opened yet **waits in escrow** and lands when that slot opens
* Inherited traits arrive at **Level 1** — the bloodline carries the trait's identity, not its strength
* Slots the parents didn't fill stay **empty**; the player supplies them from drops or the Trait-keeper
* See `breeding-and-inheritance.md` for the full rules

### **Mismatched Breeding**

* Offspring star = (Parent A star + Parent B star) / 2, rounded down (e.g., Star 3 + Star 1 = Star 2, Star 2 + Star 2 = Star 2)
* Both parents must be **breed-ready** (have hit their level cap during a run) to breed
* Two breed-ready creatures of the same star produce an offspring one star higher than the formula result (e.g., two breed-ready Star 2s = Star 3)
* Strongly rewards equalizing pairs before breeding without hard-blocking mismatched pairs

---

## **Marks System**

> ⚠️ **Not built, and paused as of 2026-07-30. Two competing designs are on file and
> neither is settled.** What follows describes the **earn-then-lock** model.
> `expedition-items-pitch.md` proposes replacing it with marks as permanent *discoveries*
> that unlock content for the player — no creature slot, no Essence payment, permanent on
> discovery. That redesign is paused, partly because its rewards unlock Relics and
> Heirlooms, neither of which exists. See `marks-system.md` for the full comparison and
> what a resumption has to decide first. No code references marks in any form.

### **What Marks Are**

* **Earned** during runs through specific accomplishments — temporary by default  
* Each creature has **one mark slot**  
* **Made permanent by spending essence** at the Mark-binder — essence buys permanence, not the mark itself (you still have to earn it)  
* Mark accomplishment thresholds are pegged to the boss cadence, not to a fixed tower height (e.g., mini-boss at floor 5) — the Floor Mark set extends with the tower  
* See `marks-system.md` and `marks-catalog.md` for the full rules and re-pegged thresholds

### **Mark Types (Examples)**

* **Depth Mark** — earned by surviving to a floor threshold; grants bonus stats on floors beyond that depth  
* **Salt Mark** \- earned by defeating the first section boss with an all-Salt team. Increases Salt damage

### **Marks and Breeding**

* Marks are **not inherited** through breeding — they are personal to the creature that earned them
* A mark's effect can only be brought to a new creature by earning it directly on that creature and binding it with essence
* See the Marks System doc for full rules

---

## **Traits System**

### **What Traits Are**

* Passive or triggered effects that modify the creature object
* **Found in the tower or bought from the Trait-keeper**, then imbued into an open slot — or inherited through breeding. They are never randomly assigned
* Stored as IDs on the creature — the ID references coded logic, not data

### **Trait Categories**

* Stat increases (HP, MP, STR, DEF, WIS, SPD, INT)  
* Start of battle buffs  
* Resistance to specific damage types or creature attacks  
* Buffs when partied with specific archetype types  
* Evasion increases  
* Other conditional effects

### **How Traits Are Acquired**

The system splits three ways with no overlap: **permanent level buys capacity, adventuring supplies content, breeding passes content down.**

* **Slots unlock by permanent level** at 5 / 10 / 20 / 30 — pinned to the star level caps, so each star tier through 3★ buys exactly one more slot. Temporary in-run levels never unlock a slot
* **Slots unlock empty.** There is no random trait roll
* **Traits come from** Trait-keeper stock (Essence), boss drops at a small chance, random events, puzzles (a later system), and inheritance. Not from ordinary combat drops or Obol shops
* **Found traits ride in the backpack** and are eligible for the wipe's single random loss unless in guaranteed inventory space
* **The Trait-keeper** sells stock, imbues traits into open slots, upgrades them L1→L4 with Essence, and buys duplicates back for a small amount
* **Species compatibility:** a creature can only take traits its species accepts — no species reaches the whole library
* Deeper in the tower, traits can drop already at Level 2–4, skipping some of the upgrade cost

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
| `damageType` | One of the ten **wards** — Iron / Bell / Breath / Ash / Salt / Mirror / Bane / Rust / Honey / Thorn — or `None`. ⚠️ No ability deals Bane, Rust, Honey or Thorn yet; those four are resistance/weakness-only. Rationale: `combat-system.md` → *The Wards* |
| `power` | Damage scale, ~50-is-average. **Load-bearing** — the formula divides by 50 |
| `accuracy` | Hit chance percentage, floored globally at `MIN_HIT_CHANCE` (30%) |
| `category` | `Physical` / `Special` / `Status`. **This is what decides stat scaling** — Physical reads STR vs DEF, Special reads INT vs WIS. There is no separate `stat_scaling` field |
| `mpCost` | MP required to use |
| `targeting` | `single_enemy` / `all_enemies` / `self` / `single_ally` / `all_allies` |
| `description` | Player-facing text |
| `highCrit?` | Raises crit rate from 5% to 15% |
| `effects?` | Inline `AbilityEffect[]` — buff / debuff / status / heal / recoil, each with an optional `chance`. **Not** an id pointing at a logic library; the effects are data, resolved by `applyAbilityEffects` |

### **Ability Count**

* \~72 abilities spanning attacks, buffs, debuffs, and heals across multiple types  
* Creatures share abilities across archetypes — roughly 80-120 abilities is the target range  
* Every ability must be assigned to at least one creature as a default to avoid orphaned abilities

### **Balancing Note**

* No single ability should be an automatic pick at all times

---

## **Archetypes**

**Eleven** archetypes define a creature's **ward** identity, trait pool, and first default ability. There is no archetype-level rock-paper-scissors — archetype biases which ward a creature *deals*; what it *resists* is authored per creature. Individual resistances and weaknesses provide the tactical variation.

Archetype is one of **two** content axes. The other is **role**, which is orthogonal to it and is what stats are generated from — see `creature-roster-and-generation.md`.

| Archetype | Signature ward | Combat Identity |
| ----- | ----- | ----- |
| **Kami** | Salt, Bell | Debuffs and cold |
| **Spirits** | Mirror, Breath | Spectral attacks and debuffs |
| **Flora** | **Thorn** | Heals and buffs |
| **Fauna** | Iron | Physical attacks, high speed |
| **Rock** | *(generalist — Iron)* | High defense, low speed, physical attacks |
| **Mecha** | **Rust** | Corrosion and shock, low HP, high speed |
| **Food** | **Honey** | Buffs and binding — buffs are stronger but shorter duration than Flora |
| **Human** | Iron, Bell | Physical attacks and shock |
| **Devils** | Ash | Burning |
| **Dragon** | **Bane** | Venom and lingering damage |
| **Slimes** | *(generalist)* | Combat identity TBD |

> **Rock and Slimes have no signature ward** and draw from the generalists. Rock had two
> candidates (Chalk, Lodestone), both dropped on 2026-08-02 — that is where to look if it
> needs its own identity later.

> Devils, Dragon and Slimes arrived with the 2026-07-28 alpha roster swap without an
> authored combat identity. The 2026-08-02 ward decision gave Devils (Ash) and Dragon
> (Bane) one; **Slimes is still open.** Full per-archetype counts for the 134-creature
> roster live in `creature-roster-and-generation.md`.

---

## **Capture System**

* Players capture creatures during runs by spending **Obols** as the capture resource
* Capture is an in-run Obol spend — it competes with hoarding Obols for conversion to permanent Essence (spend-vs-bank)
* Capture is a **price you bid against**, not a probability curve over Obols. `capturePrice = captureBasePrice[towerBand] × riteBandMultiplier × hpNudge`; bidding the full price is a certainty, and bidding under it gives exactly that fraction as your chance
* **Rites are the dominant lever, not coins.** Satisfying a rite *replaces* the multiplier rather than stacking it: unsatisfied 1.0 → family 0.4 → signature 0.1. HP is only a nudge (at most +25% at full HP), and depth is priced by which tower band you meet the creature in rather than by a continuous exponent
* **The price is shown; the rite is the secret.** The displayed price already folds in any satisfied rite, so it visibly drops the moment one latches — the player learns *that* something they did helped, never *what*. Bidding is not a price-guessing game
* **Bosses cannot be captured**, gated at the encounter rather than by pricing (`captureRefusal`). Boss fights draw from the ordinary wild pool, so the same species is a legitimate catch a floor earlier; zeroing its band price would wrongly make it uncapturable everywhere. A price of `0` still means "never takeable here", and no alpha species has one
* **A failed bid is not a free action** — the enemy still acts. Combined with enrage, that is what makes probing expensive rather than merely slow
* A rejected bid is not consumed — it counts toward an **enrage** at three rejections, after which only satisfying a rite will clear it. That is what stops brute-force probing. See `economy-balancing.md` for the full economy
* Captured creatures are held in the item inventory during the run, forcing resource constraints
* **A capture is cargo, not a reinforcement.** Captured creatures arrive at level 1 and cannot be fielded — not in the battle they were caught in, and not later in that run. They ride in the backpack until you leave the tower. This replaces the earlier mid-run substitution rule, which assumed captures arrived strong enough to fight; they arrive at level 1, so swapping one in to displace a creature you have invested Essence in was never a decision worth offering. Revisit only if captures are ever given a usable arrival level
* **The three creatures you entered the tower with can never be lost**, under any circumstance
* **Captured creatures held in ordinary inventory slots CAN be lost on a wipe.** They are protected only while occupying the **guaranteed inventory space**. A creature you caught and left in an unprotected slot is a candidate for the wipe's random loss like any other carried thing
* Upon successfully leaving the tower, captured creatures move to the Creature Box if space is available

Full capture design — duplicate Essence grant, box capacity, pending-capture queue — is specified in `docs/superpowers/specs/2026-07-25-capture-system-design.md`. That spec predates the rite/band-price model above and describes an earlier threshold model; where the two disagree, **`src/systems/Capture.ts` is the authority.**

**Engine built, no way in.** `Capture.ts` is complete and tested — rite evaluation, band pricing, the HP nudge, bidding, insult/waver reactions, enrage — and is imported by nothing but its own test. There is no capture action on the combat turn, and nothing populates the `RiteLog` fields that seven of the eleven family rites read, so those rites currently evaluate false and every creature would price at full freight.

---

## **Run Failure**

* A run ends when all three active creatures are knocked out
* The player returns to town — active battle creatures are always safe and return to the Creature Box
* The three creatures you entered with always return to the Creature Box — they are never at risk
* **Obols on a wipe:** a full wipe loses **50%** of leftover Obols — the other 50% still converts to Essence. Winning or exiting deliberately converts **100%**. This keeps "push deeper vs. bank now" a real push-your-luck gamble without wiping out an entire run's gains. (Essence already spent is always safe.)
* **Losses on a wipe:** a full wipe costs **exactly one thing, chosen at random** from unprotected inventory — **never the entire inventory**. That one thing may be a consumable, an item, **or a captured creature**, since captured creatures ride in inventory slots like anything else.
* **What is safe:** the three creatures you entered the tower with, always. Anything occupying the **guaranteed inventory space**, always. Everything else in the backpack is eligible for the single random loss.
* This is what makes capture a live gamble rather than free value: catching something deep and having no guaranteed space left means carrying it home is a risk you chose. Losing the whole backpack would push players to descend empty rather than risk anything worth carrying; losing exactly one thing keeps the sting real without making the backpack a liability.

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

* Browser-based using **Phaser 3** (canvas framework), TypeScript, built with Vite
* 960×640 logical resolution, `zoom: devicePixelRatio` for crisp HiDPI rendering
* Scene registry as built: **Boot, Town, PartySelect, Departure, Run, Combat, PostCombat, Shop, TownShop, Rest, Breeding, Leveler, Gatekeeper, Bestiary**
* Shared state lives in the `GameState` singleton; per-scene data is passed via Phaser's scene manager

### **Data-Driven Design**

* All creature stats live in a master spreadsheet (`Hollow Kins`, sheet `Kin`), which is the source of truth for numeric balance  
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

> ⚠️ **Steps 2–3 are the intended pipeline, not what exists.** There is no exported JSON
> in the repo and no importer script — `src/data/creatures.ts` is checked-in TypeScript,
> generated from the spreadsheet by hand at roster-swap time. The authored-vs-generated
> split is still real and still binding (**do not hand-tune a generated value in
> `creatures.ts`** — change the table and regenerate), but "regenerate" is currently a
> manual step. See `creature-roster-and-generation.md`.

### **Trait and Ability Architecture**

* Traits and abilities are stored as IDs on the creature object
* `ABILITIES` and `TRAIT_LIBRARY` map IDs to their definitions
* Resistances and weaknesses are arrays of ward strings on each creature object

> ⚠️ **"Map IDs to their logic functions" overstates both.** Each is a plain data record,
> not a dispatch table. Ability effects are inline data interpreted by one `switch` in
> `applyAbilityEffects`. Traits are worse: `applyStatTraitBonuses` is the only consumer of
> trait data anywhere, and it handles the `stat` category alone — `battle_start`,
> `resistance`, `affinity`, `evasion`, `type` and `economy` traits have no logic behind
> them at all. See `traits-system.md`.

### **Save System**

**As built:** player data persists to **localStorage** at **save v7**. A version mismatch discards the save outright — there is no migration path and there should not be one. Saves are disposable during alpha: bump `SAVE_VERSION` freely when the shape changes and let players restart.

**Planned:** migrate to **Supabase** (hosted PostgreSQL + auth + realtime) so saves tie to authenticated accounts and players can resume on any browser. Not built.

Under either backend:

* Save data as actually written (`GameState.saveToLocalStorage`): `creatureBox` (every instance, including retired tombstones), `essence`, `backpack`, `defaultParty`, `seenSpecies` (bestiary progress), `unlockedFloors`, `deepestBreakCleared`, `selectedStartFloor`, `hasCompletedFirstRun`, and `battleSpeed`
* ⚠️ Previously listed here and **not** saved, because none of them exist: town upgrade levels, marks, and breeding history. Breed-only recipe discovery depends on the last of those, so it is blocked on more than just the breeding rules
* Game state syncs on key events: end of run, breeding, town upgrades, party changes
* Species templates and ability/trait libraries are read-only client-side data loaded from exported JSON — never stored in the save

---

## **Resolved Design Decisions**

* Progression is **permanent and essence-driven** (2026-07-23 pivot) — creatures no longer reset to level 1; they keep an essence-bought level floor. Plasm, Breeding Stones, and Longevity are removed. See `docs/superpowers/specs/2026-07-23-essence-progression-pivot-design.md`.
* Tower is **one continuous descent** (no zones) — 100 floors in 10 bands of 10, capped at 20 for alpha. Depth-jumps let veterans buy a start point at any cleared 5-floor break.
* Marks — consolidated into separate reference docs (marks-catalog.md); breeding-stones.md is retired/cut
* Save architecture — Supabase (see Technical Architecture)
* Ability archetype distribution — DQM-style wide overlap with basic abilities available across all archetypes
* Tension / Psyche Up — cut. Existing buff abilities (Bold, Overdrive, Focus) already cover the "spend a turn to hit harder" dynamic without adding a separate system
* Accuracy — uses the Accuracy column from the ability CSV. SPD does not affect evasion; it handles turn order and crit chance only. ⚠️ **Evasion does not exist in code at all** — there is no target term in the hit roll, so the Evasion Up trait and the Blind status both have no effect. See `combat-system.md`
* Buff/debuff stages — capped at ±3, ranging from 0.75x to 1.5x. Tighter than Pokémon's system to prevent snowballing
* Critical hits — player-only (enemies cannot crit). 5% base rate, 15% for high-crit abilities, SPD scaling, 1.5x damage. ⚠️ The "ignores the target's defensive buffs" clause was specified and **never built** — `calculateDamage` crits off the target's buffed stats. See `combat-system.md`
* Damage formula terminology — standardized on STR/INT/DEF/WIS throughout combat doc

## **Open Questions**

### **Combat**

* **Boss phase mechanics** — do bosses have multiple phases or unique mechanics beyond stat inflation?

### **Economy & Progression**

* Essence tuning — earn weights (normal/mini/major), level cost-curve steepness, depth-jump prices (all placeholders pending playtest)
* Whether Model A (temporary in-run leveling) survives or we fall back to Model B (essence-only levels)
* Single vs. split essence pool for in-run vs. permanent spends
* Catch-up / pity mechanics for players who consistently fail runs

### **Content**

* Star 12 special unlock (traits doc lists candidates but no decision)
* Bestiary / Monsterpedia design — referenced in combat (auto-combat needs it) and UI/UX but no dedicated doc
* Ability count — currently 72, target range is 80–120. Flora-flavored damage abilities (thorns, spores, vine attacks) would fill the gap
* Trait drop rates for bosses and events; how large the Trait-keeper's stock is and whether it rotates; the depth-to-drop-level mapping for pre-levelled trait drops

---

---

## **Design Specs — Index**

Specs in `docs/superpowers/specs/` record **how a decision was reached**, including rejected alternatives. They are historical records, not authorities: **this document is the source of truth.** Where a spec and the GDD disagree, that is a bug in the GDD to be fixed — not a ranking to apply.

| Spec | What it decided | Built? |
| ----- | ----- | ----- |
| `2026-07-23-essence-progression-pivot-design.md` | The permanent-progression model itself — Obols→Essence, permanent level floors, 30-floor descent, essence-hub town | Yes (Phases 1–4a) |
| `2026-07-24-auto-combat-tactics-design.md` | Tactic ladders, knowledge fog, persisted battle speed | Yes |
| `2026-07-25-departure-flow-design.md` | Standing default party, pre-run departure screen | Yes |
| `2026-07-25-capture-system-design.md` | Capture threshold model, duplicate Essence grant, box capacity, pending-capture queue | **Designed only** |
| `2026-07-25-monsterpedia-design.md` | Bestiary UI over `gameState.seenSpecies` | Yes — `BestiaryScene`, reachable from THE ARCHIVE |
| `2026-07-26-doc-realignment-design.md` | Documentation pass — GDD re-promotion and contradiction sweep | — |
| `2026-07-26-traits-system-design.md` | Trait slots by permanent level, traits found-and-imbued, Trait-keeper's role, stars kept | **Designed only** |
| `2026-07-29-expedition-commitment-and-consumables-design.md` | Departure earned at boss floors or bought as a Waystone; the item pool 2 → 9; the run-map bag made usable | Yes |
| *(no spec — design agreed in conversation; rationale inline in* `docs/superpowers/plans/2026-07-29-post-battle-offers-and-boons.md`*)* | The post-battle three-card reward offer, and **timed boons** replacing the pitch's charged Preparations | Yes |

> **Note:** the capture spec cites `docs/superpowers/research/capture-mechanics-research.md`, which is **not in this repo**. Treat that spec as self-contained.

---

*Document version: working draft. All systems subject to revision.*
