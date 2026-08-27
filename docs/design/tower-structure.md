# **Hollow Kin — Tower Structure**

*Working Document — Subject to Change*

> **Owns:** run length, the band→floor mapping, depth-jumps, encounter types, run shape, boss cadence and design, procedural generation rules.
> **Defers to the GDD on:** currency, progression model, and what persists across runs. Defers to `creature-roster-and-generation.md` on **which creatures** sit in each band and what they cost to capture there — this doc says where a band starts and ends, that one says what lives in it.
> **Last verified:** 2026-07-28.

---

## **Overview**

The tower is the procedurally generated environment where all runs take place. Players descend the tower with a party of three creatures, progressing through encounters until they reach a boss or are wiped out. The tower's structure determines pacing, difficulty curves, and the cadence of meaningful decisions within a run.

---

## **Run Length**

* A run is **one continuous descent** — there are no discrete zones or zone walls.
* The full tower is **100 floors, in 10 bands of 10**. This is **bounded now, endless later**: the descent is designed so an endless mode can bolt on afterward without restructuring it.
* **Alpha stops at floor 20** — the deepest the authored roster reaches. This is the single constant `TOWER_FLOORS` in `src/types.ts`; descent generation, the Gatekeeper's grant loop, the results ledger and the tests all derive from it, so extending the tower is one edit plus the creatures to fill the new bands.
* Each floor is a single encounter — combat, shop, rest point, or random event.
* **Boss cadence:** a **mini-boss every 5 floors** and a **major boss every 10 floors** punctuate the descent (see Boss Design).
* **Clearing the deepest floor is a real ending.** It is the third run outcome alongside fleeing and wiping, and it converts Obols at the full non-wipe rate exactly as a deliberate exit does. Under the alpha cap that ending arrives at floor 20.
* Of the non-boss floors, roughly a third to a half are combat — the rest are shops, rest points, and random events.
* Failed runs end earlier. Every fight drops **Obols** (the in-run currency); leftover Obols convert to permanent **Essence** on exit, so even a short run banks something — provided you didn't spend it all surviving.

---

## **Depth Bands & Descent Identity**

There are no hard zone walls. Instead, the enemy pool and visual identity **shift gradually by depth band** as the player descends.

**A band is ten floors.** Band N covers floors `(N-1)×10 + 1` through `N×10`, so band 1 is floors 1–10, band 2 is 11–20, and so on to band 10 at floors 91–100. This mapping is the same thing the roster calls a creature's **Tower ID** — a creature with `Tower ID = 1,2` appears anywhere on floors 1–20. There is one function, `bandForFloor`, and both encounter generation and capture pricing read it, so the two can never disagree about where a band starts.

* Enemy composition draws from **2–3 archetypes at a time**, and the mix rotates as the player goes deeper, adding variability to each run.
* Deeper floors present stronger enemies with more complex ability sets, representing higher stats and tiers.
* Group size rises with depth: wild fights in bands 1–2 (floors 1–20) field 1–3 enemies, and from band 3 (floor 21) onward 1–5. The first three floors of the tower are held to at most 2 so the opener stays readable. Boss fights are fixed at 2 species (mini) / 3 (major). (`maxEnemiesForBand` in `types.ts`; the numbers are placeholders.)

**Which creatures are in a band is not a decision this doc makes.** Pools are derived from each species' `towerIds` rather than maintained as a separate list, so moving a creature between bands is a roster edit and nothing here changes. See `creature-roster-and-generation.md`.

> **Alpha caveat.** All 30 authored creatures sit in bands 1 *and* 2, so the two pools are currently identical and the "mix rotates as you descend" promise above is not yet visible — depth changes enemy *level*, not enemy *variety*. That resolves as bands are authored, not by changing anything structural.

### **Depth-Jumps (Purchasable Start Points)**

Rather than starting a later run in a pre-cleared zone, players buy a deeper **start point** with **essence**.

* At each **5-floor break** the player can purchase a depth-jump from the Gatekeeper in town. Breaks run every 5 floors up to the tower's depth — under the alpha cap that means floors 5, 10 and 15.
* **Buying a break starts you at the floor *after* it:** buy floor 5 → start at floor 6; buy floor 10 → start at floor 11.
* A break whose next floor would fall past the bottom of the tower is not offered — there is nothing to descend into. That is why the deepest break under the alpha cap is 15 and not 20.
* Depth-jumps are **gated by having cleared that break's boss** — you can only buy jumps to breaks you have already reached and beaten.
* This replaces the old "start in a later zone by beating the previous zone boss" rule. There is no forced re-fight of a prior boss on entry; the gate is the essence purchase plus prior clear.

---

## **Encounter Types**

Each encounter on the run map is one of the following:

### **Combat**

* The majority of encounters — fight a group of 1–3 enemy creatures in bands 1–2, 1–5 from band 3 on
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
* No mark deed progress or XP is earned at rest points

### **Random Events (built — `data/events.ts`, `systems/Events.ts`, `EventScene`)**

An event room is an **offer**, not a windfall. It shows a name, one line of flavour, the exact terms (what you pay, what you get) and two actions: **ACCEPT** or **WALK AWAY**. Walking away costs nothing and returns to the map. Rules:

* **Events grant no XP.** XP is combat's reward; the only way an event yields XP is by triggering a fight.
* **Viability is filtered before the draw** — an event whose terms could not fire in the current run state is excluded (as `RewardOffer` drops dead cards), and the event is drawn uniformly from the viable set when the room is *entered*, never at descent generation.
* **Obol-priced events cost 10% of current Obols**, floored, free at 0.
* **No event can knock a creature out** — HP costs always leave at least 1.
* Resolvers are pure (`systems/Events.ts` returns an `EventResolution`; the scene applies it), the same contract as `Items.ts`.

The five-event catalogue (all numbers are placeholders):

| Event | Terms | Viable when |
|---|---|---|
| **Mercy Well** | Every living party member recovers 10% max HP and MP. Costs 10% of current Obols. | Obols > 0 and someone is below max HP or MP |
| **Blood Boon** | Grants one random reward boon (named before accepting). A random living creature loses 20% of its current HP. | At least one living creature |
| **The Dice** | A d12 is rolled and shown; pick a donor then a recipient. HP moved = min(roll, donor HP − 1, recipient's missing HP). | At least two living creatures |
| **Tinker's Trade** | Pay 10% of current Obols; choose one of three distinct items from the full pool. | Obols > 0 and the bag has a free slot |
| **Warden's Wager** | Fight a combat encounter on this floor; Obols and XP from the victory are doubled (`Encounter.rewardMultiplier`). The post-battle reward offer is unchanged. | Always |

Design record: `docs/decisions/2026-08-27-event-rooms-design.md`.

---

## **Run Shape — Pick-Next (decided and built)**

After each encounter, the player chooses between 2–3 offered next encounters. No map, just the immediate choice.

* Reduces decision anxiety and keeps pacing tight
* Trade-off options emerge through encounter type variety (shop vs. combat vs. event)
* Pick-next is **boss-aware** — it never offers a path that skips a boss floor
* The next 2–3 encounters could be previewed during reward selection, letting the player plan one step ahead

There is no party swapping mid-run. The player descends with the three creatures they entered with; captures are cargo and cannot be fielded.

*Considered and rejected: a branching Slay the Spire map (unnecessary strategic overhead at this pacing), linear-with-reward-sets, and non-linear free movement.*

---

## **Floor Navigation**

Within a single floor/encounter, the structure is minimal:

* Each encounter is a single event — one combat, one shop, one rest, one event
* No room exploration, grid movement, or dungeon crawling within an encounter
* The tower's depth comes from the sequence of encounters, not from spatial navigation
* This keeps the pacing tight and the focus on combat and party management

---

## **Boss Design**

Bosses punctuate the single descent on a fixed cadence: a **major boss on every 10th floor**, and a **mini-boss on the other 5-floor breaks**. The cadence is derived from the floor number, not a list, so it holds at any tower depth. Under the alpha cap: mini-bosses on 5 and 15, majors on 10 and 20.

## **Mini-Bosses**

* Appear every 5 floors (on the 5-floor breaks that are not major-boss floors)
* Stronger than standard enemies, specific creatures in variant colors
* Can be captured during runs; reverts to base stats when captured but unlocks the variant color option
* An anchor for mark deeds (see below)

### **Major Bosses**

* Appear every 10 floors — unique creatures not found in the wild
* Higher stat pools and unique abilities
* Defeating a major boss unlocks that boss creature for breeding (it cannot be captured during the fight)
* The main anchor for mark deeds

### **Bosses and Marks**

* Mark deeds anchor on the boss cadence rather than on floor numbers, so the deed set extends with the tower. A deed is something unusual done *at* or *on the way to* a boss — all-one-archetype clears, no-Iron clears, no-KO clears — never simply "clear floor N".
* Marks are permanent discoveries that unlock content; see `marks-system.md`. Boss rematch unlocks wait on boss variety.

### **Final Boss**

* The major boss on the **deepest floor** caps the bounded tower — floor 100 in the full game, floor 20 under the alpha cap.
* Significantly harder than the earlier major bosses
* Final boss design and mechanics are TBD — whether it has phases, unique mechanics, or is simply a stat-check is an open question
* **Alpha's floor-20 boss is a terminus, not a designed finale.** It is an ordinary major boss that happens to sit on the last floor. Clearing it reuses the ordinary run-results ledger with a `TOWER CLEARED` header and nothing else changed — there is no bespoke completion screen, no acknowledgement that the tower is *finished* rather than merely exited. Worth writing before anyone plays to the bottom.
* In endless mode, the deepest floor becomes just another major boss and the descent continues

---

## **Procedural Generation Rules**

* Boss floors are fixed by the cadence (mini-boss every 5 floors, major boss every 10); the floors between are generated procedurally.
* Encounter order is randomized within constraints: at least one shop in each 5-floor stretch
* Rest points are **not guaranteed** anywhere in the descent, including the floor before a boss — they appear occasionally as random filler, roughly **~15% of non-boss floors** (removed the guaranteed pre-boss rest after playtest showed it made bosses too predictable/safe)
* Combat encounters never appear more than three times consecutively
* Rest and shop encounters should never appear more than twice consecutively
* The first floor of a run (or the first floor after a depth-jump start) is always combat (to set the tone and difficulty)
* Random events have a lower spawn rate than combat or shops — roughly 1–2 per 5-floor stretch
* Seeds can be used to reproduce a specific run layout for sharing or challenge purposes

---

## **Open Questions**

* Visual and thematic identity for each of the ten depth bands
* **Whether 100 floors is one run.** The band table describes a 100-floor tower, but nothing has settled whether a player is expected to descend all of it in a single sitting or whether depth-jumps make the back half a series of shorter trips. Run-length pacing targets in `economy-balancing.md` were written against 30.
* Enemy and XP scaling were tuned against a 30-floor curve. They need re-checking against 100 — and against 20, since the alpha cap means a run now ends a third of the way up the old curve.
