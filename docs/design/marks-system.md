# **Hollow Kin — Marks System**

> **Owns:** what a mark is, how one is discovered, what discovering it unlocks, the record it leaves on the accomplishing Kin, and the Ledger in town. The deed list below is the starter catalogue; there is no separate catalogue file.
> **Defers to the GDD on:** currency, progression model, and what persists across runs. Marks are permanent from the moment of discovery — they never appear in the GDD's "resets at run end" table, and that is deliberate.
> **Last verified:** 2026-08-27.
>
> **Status (2026-08-27): decided, not built.** Zero code exists for marks. There is no
> `discoveredMarks` field on the save, the Ledger town tile is shuttered (it is the tile
> `TownScene` still labels as a mark vendor), and the `kind: 'mark'` backpack slot
> declared in `types.ts` is never constructed and should be deleted when this is built —
> a mark is never carried, so it has no business in a bag.
>
> **Building this waits on two things:** capture (several starter deeds involve a captured
> Kin, and capture is roadmap item 1) and boss variety (rematch unlocks are meaningless
> while every boss draws from the same wild pool). Do not start it before both exist.
>
> **Retirement note.** The previous design — "Design A", the *earn-then-lock* model, in
> which a mark was a creature-specific stat bonus earned in-run, held in one slot per
> creature, temporary until Essence bought its permanence at a **Mark-binder** — was
> **retired on 2026-08-27**, together with its percentage-bonus catalogue
> (`marks-catalog`, deleted the same day). It survives only in git history and in the
> 2026-07-26 doc-realignment spec under `docs/decisions/`. Nothing in this
> document is compatible with it; if another doc still describes marks as equipped
> bonuses, that doc is stale.

---

## **Where Marks Sit**

Four systems hand the player something that changes how they play, and each owns a different question:

> **Boons are run-scoped modifiers. Consumables answer the run's dangers. Traits define what a creature is. Marks are the player's recorded accomplishments, and they unlock content.**

A mark is therefore **not** a stat bonus, **not** equipped, **not** slotted, and **not** bought. It is the game remembering that something unusual happened, and widening what can happen next.

---

## **What a Mark Is**

* **Discovered by doing a deed during a run.** Deeds may be hidden. Their conditions are hinted at — in the mark's name, in Monsterpedia entries, in event text — but never spelled out before discovery.
* **Permanent the instant it is discovered.** No Essence, no binding step, no slot, no equip. A mark cannot be lost, not even on a wipe — the deed happened, and the game does not un-remember it.
* **Belongs to the player, not the creature.** The unlocked content stays available after the accomplishing Kin retires or is bred away.
* **Records who and when.** Every mark stores the Kin that accomplished it and the run it happened on. This is the line that appears in that Kin's history and, later, in its descendants' lineage view: *Discovered by Cat, third descent, floor 10.*
* **Its reward is content entering the game.** Discovering a mark never changes a number on a creature. It adds something to a pool the player draws from later.

### **What a mark can unlock**

Every reward is one of these, and every one of them is a system that exists or is on the roadmap:

| Unlock kind | Where it appears afterwards | Exists today? |
| ----- | ----- | ----- |
| A new **boon** | Enters the post-battle offer pool (`RewardOffer`) — timed or run-long | Yes — `data/boons.ts` |
| A new **item** | Enters the Provisioner, the Tower Merchant and the post-battle item card | Yes — `data/items.ts` |
| A rare **trait** | Enters the Trait-keeper's stock | Engine only — acquisition is roadmap item 2 |
| A **title / lineage epithet** | Cosmetic; shown on the creature and its descendants | Not built |
| A new **event, breeding option or boss rematch** | Appears in descent generation or at the Hatchery | Not built; rematches wait on boss variety |

Rewards were deliberately kept to this list. Anything a mark unlocks must be something the player then *goes and uses* — a mark that quietly made a creature stronger would be a trait with extra steps.

---

## **Starter Deeds**

Six deeds to build first. Deed conditions are placeholders in the alpha sense — the *shape* (a hidden condition, a content unlock) is the design; the specific thresholds are not. Ward names follow `combat-system.md` → *The Wards*.

| Hidden deed | Mark | Permanent unlock | Waits on |
| ----- | ----- | ----- | ----- |
| Defeat a boss with all three Kin sharing an archetype. | **Kindred Victory** | A run-long **boon**: a party-affinity effect while all three Kin share an archetype. | — |
| Win three battles in one run while the same Kin stays below 20% HP. | **Last Light** | A run-long **boon**: the holder survives lethal damage at 1 HP once per run. | — |
| Fell three Ash-dealing enemies with Salt damage in a single run. | **Temper the Ash** | A new **item** in shops and rewards: a thrown Salt-ward phial. | — |
| Carry a captured Kin through two boss victories before departing. | **Long Road Home** | The **Essence Distiller** trait enters the Trait-keeper's stock. | Capture, trait acquisition |
| Clear a major boss without a single Iron-damage action from the party. | **Unrusted** | A **title**: the accomplishing Kin and its line carry the epithet *the Unrusted*. | — |
| Clear a major boss with no Kin knocked out. | **Warden's Return** | A **boss rematch** event: that warden can be met again, deeper and stronger. | Boss variety |

*Unrusted* is a puzzle on purpose: Basic Attack is Iron, free and always available, so the deed is "win a boss fight without ever falling back on the free option". *Temper the Ash* leans on the type chart — Ash is the taxed ward (three moves against seven resistances), so hunting its dealers with Salt is a real detour.

---

## **Discovery in Play**

* Deed progress is tracked **within a run** and, for deeds that are per-run by nature, resets at run start. A deed that is met partway through a run and then abandoned by fleeing leaves nothing behind — the mark is discovered at the moment the condition completes, or not at all.
* Discovery is announced **in the moment**, not on the results ledger. The player should feel *"what did I just do?"* and then be told. The unlock is named; the deed is described in full only now that it has been done.
* A mark is discovered **once**. There are no levels, tiers or repeat discoveries. A second Kin doing the same deed changes nothing — the content is already unlocked.
* **Bosses are the natural anchor** for most deeds (mini-boss every 5 floors, major every 10), so the deed set extends with the tower rather than with a fixed floor count. Deeds should never name a floor number.
* Knocked-out Kin cannot accomplish a deed. A Kin that is down when the condition completes is not the one recorded.

---

## **The Ledger**

The town tile formerly reserved for a mark vendor is **the Ledger** — a reading place, not a shop. It exists because the tile already does.

* Lists every **discovered** mark: its name, the deed now revealed in full, the accomplishing Kin and run, and what it unlocked.
* Lists **undiscovered** marks as **clues only** — a name and a line of hint text. Never the condition. This is where the player goes to decide what to try next descent.
* Costs nothing. There is nothing to buy here. The Ledger is the only town tile with no Essence interaction, alongside the Creature Box and the Archive.

---

## **Marks and Breeding**

A mark is not inherited, because it is not on the creature to inherit. What breeding *does* carry is the **record**: a Kin's discovered deeds stay in its history, and its descendants' lineage view can show them. Titles and epithets unlocked by a mark are the one visible inheritance — *the Unrusted* is worn by the line, not the individual.

Retiring a Kin never removes a mark or its unlock. The deed contributed to that Kin's story; the content belongs to the player.

---

## **Design Intent**

Marks give a run a second reason to be unusual. Depth and Obols are the steady goals; a mark is the sideways one — the reason to field three Slimes against a warden, to skip Basic Attack for a whole boss fight, or to carry a fresh capture through two bosses instead of turning for home. Because the reward is content rather than power, chasing one never bends the balance of the run it happens in; it changes the *next* run's options.

Hidden conditions carry the mystery, and the Ledger's clues keep the mystery fair. The failure mode to avoid is a condition so opaque nobody discovers it — every deed needs a clue that a curious player can act on, and the Monsterpedia and event text are where those clues live.
