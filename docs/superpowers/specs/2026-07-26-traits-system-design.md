# Traits System — Design Spec

**Date:** 2026-07-26
**Status:** Approved design, not yet implemented
**Supersedes:** the essence-threshold trait model in `2026-07-23-essence-progression-pivot-design.md` §5, and the star-based trait table it replaced.

**Resolves** the open trait question flagged in `2026-07-26-doc-realignment-design.md` §5.

---

## Starting position

Traits were specified three incompatible ways and built none of them:

| Source | Model |
|---|---|
| `traits-system.md` | Slots unlock at **cumulative essence thresholds** paid at the Trait-keeper (town) |
| `breeding-and-inheritance.md` | Slots unlock on **hitting the level cap**, resolved **in-run** |
| `src/systems/BreedingSystem.ts:73–76` | Slots unlock by **star rating** (`starRating >= 2/3/4/5`) |

In code, traits are empty scaffolding: `traitSlots` initialised to `{ traitId: null, traitLevel: 0, unlocked: false }` and never written. There is no trait library, no effects, no Trait-keeper scene, and no `naturalTraitPool` authored on any creature. **Nothing is load-bearing**, so this design is unconstrained by existing behaviour.

---

## 1. Slots unlock by permanent level

A trait **slot** unlocks when a creature's `permanentLevel` crosses a threshold:

| Slot | Permanent level | First reachable at |
|---|---|---|
| 1 | 5 | 0★ |
| 2 | 10 | 1★ |
| 3 | 20 | 2★ |
| 4 | 30 | 3★ |

**Permanent level only.** Temporary in-run levels affect stats and nothing else — they never unlock a slot. An unlock therefore always happens in town, at the moment the player buys the level at the Leveler. This makes unlocks predictable, prevents a slot from flickering open and closed across a run boundary, and closes the door on grinding in-run XP to unlock traits without spending Essence.

Thresholds are placeholders, but the **relationship is not**: they are pinned to `STAR_LEVEL_CAPS` (`0★=5, 1★=10, 2★=20, 3★=30`). If either table moves, they move together.

### Why these values

Each star tier through 3★ buys exactly one more slot, so breeding has a concrete payoff beyond a larger number. A creature's final reachable slot opens exactly when it hits its cap — the same moment it becomes breed-ready — collapsing two beats into one: *fully grown, gains its last trait, ready to breed.*

A 0★ starter therefore runs its whole early life with no traits, which is what `creature-roster-and-generation.md` already assumes: *"The first few runs are naturally tutorial-paced since no traits are active yet."*

From 4★ up (cap 40+) all four slots are already open; the remaining climb funds **trait levels** (§4).

---

## 2. Stars are re-coupled to traits — deliberately

Traits gate on level, and stars cap level, so **stars now gate trait capacity.** A 0★ creature reaches one slot and no more, forever, until breeding raises its star.

**This reverses a standing note.** `traits-system.md` claimed the trait table was "deliberately decoupled from star rating" so stars could be removed later, and the GDD listed star removal as "backup C, strongly favored." **Backup C is now off the table.** Stars are staying.

**Rationale (this is the part not to re-litigate):** stars exist to stop the player settling on one roster permanently. The design goal is that players keep breeding and keep finding new creatures rather than maxing three favourites and never changing them. A hard capacity ceiling that only breeding can raise is the mechanism that produces that behaviour. Removing stars would remove the pressure.

Both docs' "do not hard-couple to stars" warnings are to be deleted, not softened.

---

## 3. Slots unlock **empty** — traits are found, not rolled

A slot opening gives **capacity, not content**. There is no random trait roll.

| Source | Supplies | Cost |
|---|---|---|
| **Permanent level** | Slot capacity | Essence, at the Leveler |
| **Trait-keeper stock** | A small variety of baseline traits | Essence |
| **Boss drops** | Rarer traits, **small chance** | Risk of the descent |
| **Random events** | Rarer traits, as a reward outcome | Risk/reward choice |
| **Puzzles** | TBD — a later system | TBD |
| **Breeding** | Inherited traits, already placed at birth | Retiring both parents |
| **Trait-keeper imbuing** | Puts a held trait into an open slot | Essence |

This gives the player agency over *which* trait a creature carries — the previous design had none for wild creatures — and gives runs a trait payoff they previously lacked entirely.

**Not chosen as sources:** ordinary combat drops, and shop purchase with Obols. Traits come from bosses, events, the Trait-keeper, and later puzzles.

Because the Trait-keeper sells a baseline selection, traits have a **reliable floor** with luck and exploration supplying the good ones. A player is never locked out of traits by bad drops.

### Found traits are inventory items

A found trait occupies a backpack slot for the rest of the descent and is **eligible for the wipe's single random loss** unless it sits in guaranteed inventory space — exactly like a consumable or a captured creature.

This is what makes a floor-20 boss trait a real decision: push deeper and risk it, or leave and bank it. It also gives Quartermaster capacity upgrades something concrete to protect, which they currently lack.

### Species compatibility

`naturalTraitPool` stops being a random-roll table and becomes a **compatibility rule**: a creature can only be imbued with traits its species accepts. This preserves *"no species has access to the entire trait library"* from `creature-roster-and-generation.md` and makes loot a light puzzle — a strong trait you cannot use on the creature you wanted.

Pools must be authored per species; none exist today.

---

## 4. Trait levels 1–4

Every trait is found at **Level 1** unless dropped at a higher level (below). Essence at the Trait-keeper raises it:

| Upgrade | Essence (placeholder) |
|---|---|
| L1 → L2 | 240 |
| L2 → L3 | 540 |
| L3 → L4 | 960 |

**The relationship to preserve:** a trait upgrade costs roughly **one mid-game permanent level**. `essenceCostForLevel` is `10·L^1.5`, so level 10→11 is ~365 and 20→21 is ~962. If the level curve is retuned, retune these with it — the point is that raising a trait is a comparable investment to raising a level, not a rounding error against it.

**Higher-level drops, later in the game.** Deep in the tower, traits can drop already at Level 2–4, skipping some or all of the essence cost. This makes depth a direct trait-power lever and turns a deep high-level drop into a genuine windfall. Depth-to-drop-level mapping is a tuning question, deferred to implementation.

### Duplicates

A duplicate of a trait a creature already holds does **not** merge or upgrade. Duplicates are **sold to the Trait-keeper for a small amount of Essence**, so a repeat drop is never dead loot. The sale value is deliberately small — this is a consolation, not an income stream.

### Replacing a trait

Imbuing into an **occupied** slot replaces the existing trait, which is destroyed. Essence cost, no refund. There is no un-imbue.

---

## 5. Breeding inheritance — three cases, not four

The old four Trait Resolution cases existed to arbitrate against a random pool. With slots unlocking empty there is no pool, so the cases collapse:

| Situation | Resolution | When |
|---|---|---|
| Both parents had a trait in that slot | Player **chooses one** | At breeding |
| One parent had a trait in that slot | **That trait passes** | At breeding |
| Neither parent did | Slot stays **empty** | — |

**Inherited traits escrow.** A newborn's carried-over permanent level may only open slot 1 or 2, but inheritance is resolved for all four at breeding. A trait inherited into a not-yet-open slot waits in the bloodline and lands the instant permanent level opens that slot. Nothing is lost; it arrives late.

**Inherited trait level.** Preserved from `traits-system.md`: the trait's identity carries, its strength does not. An inherited trait arrives at Level 1 and must be re-upgraded with Essence. The bloodline remembers the trait; the creature earns its power back.

**Marks remain non-inheritable.** Unchanged.

---

## 6. Two live bugs this fixes

Both stem from `isBreedReady` being a **stored flag set only by in-run XP leveling** (`GameState.tryLevelUp`). `spendEssenceOnLevel` never sets it.

**Bug 1 — buying a creature to its cap locks it out of breeding permanently.** When `permanentLevel == levelCap`, every run starts with `currentLevel` already at the cap, so `tryLevelUp` returns at its guard (`currentLevel >= levelCap`) and `isBreedReady` is never set. Max a 0★ starter at the Leveler and it can never become a parent. Reachable today.

**Bug 2 — breed-readiness is wiped at the start of every run.** `GameState.startRun()` sets `isBreedReady = false`. Earn it, start another run before breeding, and it is gone. A pure roguelite leftover inside the permanent-progression model.

**Fix:** make breed-readiness **derived, not stored** — `permanentLevel >= levelCap`. Remove the stored field, the `tryLevelUp` assignment, and the `startRun` reset. One rule then governs both breeding and trait slots: **permanent level is what gates things.**

---

## 7. Code changes required

| File | Change |
|---|---|
| `src/types.ts` | Add `TRAIT_SLOT_LEVELS = [5, 10, 20, 30]`, pinned to `STAR_LEVEL_CAPS`. Add trait item / trait definition types. Remove `isBreedReady` from `CreatureInstance`. |
| `src/managers/GameState.ts` | Derive breed-readiness; drop the `tryLevelUp` assignment and the `startRun` reset. Unlock slots off `permanentLevel` in `spendEssenceOnLevel`. |
| `src/systems/BreedingSystem.ts` | **Delete the star-based slot unlock at lines 73–76** — it is a third model and wrong. Implement the three-case inheritance and escrow. |
| `src/systems/Traits.ts` *(new)* | Trait library, effect logic, compatibility check, upgrade costs, duplicate sale value. |
| `src/scenes/TraitKeeperScene.ts` *(new)* | Sell stock, imbue, upgrade, buy duplicates. |
| `src/scenes/TownScene.ts` | Add the Trait-keeper entry. |
| `src/scenes/BreedingScene.ts` | Show inheritance resolution and the player's choice where both parents contributed. |
| `src/data/creatures.ts` | Author `naturalTraitPool` per species — none exist. |
| Save | Trait slots already persist in the instance; a save version bump is needed for the `isBreedReady` removal and trait inventory. |

**A test invariant worth pinning** (per the alpha rule — shape, not values): every entry in `TRAIT_SLOT_LEVELS` equals the level cap of some star tier. That relationship is design; the numbers are not.

---

## 8. Dependencies and sequencing

**Traits depend on inventory.** Found traits ride in the backpack and are wipe-eligible, but the inventory/Quartermaster system is not built. Either build a minimal inventory first, or ship the Trait-keeper's *stock and upgrades* (pure town, no carrying) ahead of *found traits*.

**Traits lean on the experimentation loop, which is currently soft-locked.** Breeding is net −1 creature and with no capture there is no way back to three, so `ENTER TOWER` dims permanently at 2/3. This design's rationale (§2) is that players keep breeding — which today costs them the ability to run at all. **Capture should land before or alongside traits.**

**`PartySelectScene` breaks past 12 creatures** — cards overlap CONFIRM at 10–12 and render off-canvas beyond. Unreachable while the box only shrinks; reachable the moment capture lands.

---

## 9. Docs to update

| Doc | Change |
|---|---|
| `traits-system.md` | Replace the essence-threshold table with level thresholds. Delete the "decoupled from stars" note. Rewrite acquisition around found-and-imbued. Remove the warning banner. |
| `breeding-and-inheritance.md` | Replace Cases 1–4 with the three cases + escrow. Fix the breed-ready paragraph (derived from permanent level, not earned in-run). Remove the warning banner. |
| `game-design-document.md` | Update both trait sections; remove the banners; change Star Rating "backup C strongly favored" to **stars are staying**, with the §2 rationale. Add trait items to the wipe-eligible list. |
| `town.md` | Give the Trait-keeper its real job: sells stock, imbues, upgrades, buys duplicates. |
| `economy-balancing.md` | Add trait upgrade costs, duplicate sale value, and the "≈ one mid-game level" relationship. |
| `creature-roster-and-generation.md` | `naturalTraitPool` becomes a compatibility rule, not a roll table. |
| `marks-system.md` | Fix "traits strengthen over stars" → strengthen with Essence. |
| `CLAUDE.md` | Remove the trait exception from the docs-reading note. Add the star decision to Key Design Rules. |

---

## 10. Open questions

* Depth-to-drop-level mapping for higher-level trait drops
* Drop rates for bosses and events; how large the Trait-keeper's rotating stock is and whether it refreshes per run
* Duplicate sale value
* Whether trait *rarity* tiers exist, and whether the GDD's "low quality monsters can only hold low quality traits" survives as a rule or is fully replaced by species compatibility
* The endgame trait unlock (fifth slot / all-traits-+1 / legendary trait) — previously pegged to Star 12, still undefined
* Whether the Trait-keeper can move a trait between creatures, or only destroy and re-imbue
