# Essence Progression Pivot — Design Spec

**Date:** 2026-07-23
**Status:** Approved design, docs being updated
**Scope:** Replaces the "creatures reset to level 1 every run" pillar with a permanent, essence-driven progression system; flattens the tower into one continuous descent; consolidates town into an essence hub.

---

## Guiding Principle

**One currency only.** Essence is the single permanent spend for everything in the game. There are no parallel "almost-currencies." Plasm and Breeding Stones are removed; essence absorbs their roles.

---

## 1. Essence — the new spine

- Harvested from **every fight**. Total earned per run scales with the **number of battles completed**, weighted: `normal < mini-boss < major boss`.
- **Permanent and non-refundable.** Once spent on a pet, essence is locked to that pet — no reclaiming it for future pets.
- Essence is spent on: permanent levels, trait unlocks, permanent marks, depth-jumps, backpack capacity, and **in-run survival** (heals, revives, capture).

### Same wallet, two demands (the run's new heartbeat)

Essence earned in a run can be spent *right now* to survive the descent (heals, revives, capture) **or** banked and carried back to town for *permanent* upgrades. One pool, real tradeoff — every heal is a level you didn't buy. This spend-now-vs-bank decision is the core run tension that replaces the old plasm economy.

> **Open for review:** design assumes a *single* essence pool shared between in-run and permanent spends. If separate in-run vs. permanent pools are wanted instead, flag before implementation.

---

## 2. Levels — Model A (permanent floor + temporary in-run leveling)

- Essence raises a pet's **permanent starting-level floor**. A pet with enough invested essence begins each run at (e.g.) level 8 instead of 1.
- Pets **still gain temporary levels within a run** on top of the floor; those temporary levels vanish at run end.
- The essence **cost per level rises classically** (each level costs more than the last), so leveling naturally decelerates.
- **Target pace:** a strong run (clearing to ~floor 10) nets roughly **2–3 permanent levels** early on — enough that a run feels rewarding, and enough for enemies to scale against, without trivializing progression.

**Backup B (playtest fallback, do not build yet):** remove in-run temporary leveling entirely; a pet's level is *only* its permanent essence-driven level. Note this in the docs as the fallback if Model A doesn't feel good.

---

## 3. Stars — Model A now, C on deck

- **Now:** star rating **stays** as the level ceiling (the existing sigmoid cap). Essence fills *toward* that cap but cannot exceed it. Breeding is still what raises stars and thus unlocks higher potential.
- **Backup C (strongly favored long-term):** remove stars entirely and let essence own the level cap directly. The slow essence gain takes over the role stars played. Docs should note this as the likely future direction so nothing is built that hard-couples to stars.

---

## 4. Breeding — Model B (jump-start carry-over)

- Both parents are **still retired** when they breed.
- Invested essence/levels **partially carry over to the offspring** as a jump-start, so players don't restart a bloodline from zero.
- This keeps breeding meaningful (a real trade) while removing the "back to square one" penalty that would otherwise discourage breeding.

---

## 5. Traits — Model C (essence thresholds)

- Trait slots and trait levels unlock at **essence thresholds**, not star thresholds.
- The **star-based trait-progression table is deleted.**
- This is intentionally forward-compatible with removing stars (Stars backup C).

---

## 6. Marks — Model A (earn-then-lock)

- Marks are **still earned through in-run accomplishments** (hit the accomplishment threshold during a run). By default an earned mark is **temporary**.
- Spending essence is the **optional step that makes an earned mark permanent** on that pet. Essence buys *permanence*, not the mark itself — you still have to do the deed.
- All mark thresholds that referenced zones/old floor numbers are **re-pegged** to the new single-descent floor numbering.

---

## 7. Longevity — removed

- The longevity system is **removed entirely.** Permanent progression is the new pressure; a death clock on top is unnecessary and fights the "invest in your bloodline" theme. Pets live until you choose to breed (retire) them.

---

## 8. Tower — one long descent

- **30 floors** for the vertical slice. **Bounded now, endless later** (Model C): design the 30-floor tower so an endless mode can bolt on afterward.
- **Mini-boss every 5 floors; major boss every 10 floors.**
- **Purchasable start point at each 5-floor break**, bought with essence. Buying a break starts you at the floor *after* it:
  - Buy floor 5 → start at floor 6
  - Buy floor 10 → start at floor 11
- Depth-jumps are gated by having cleared that break's boss (you can only buy jumps to breaks you've reached).
- **Floor Marks** are re-homed onto the mini/major bosses (they were tied to zone bosses before).
- Zones as hard walls are **gone** — enemy pools/visual identity can still shift by depth band, but there are no discrete "3 zones."

---

## 9. Town — Essence Hub

The Enhancer and Leathersmith are **removed.** Town becomes a hub of "folks" who turn essence into things:

| Station | Function | Essence? |
|---|---|---|
| **Creature Box** | View available creatures, manage party | No — management only |
| **Leveler** | Buy permanent levels | Yes |
| **Trait-keeper** | Unlock trait slots / levels | Yes |
| **Mark-binder** | Make an earned mark permanent | Yes |
| **Gatekeeper** | Unlock depth-jumps | Yes |
| **Quartermaster** | Increase backpack capacity (hold items to use on the descent) | Yes |
| **Breeder** | Breed a pair (retire parents, carry-over to offspring) | Yes |

The Quartermaster preserves the Leathersmith's old job (inventory/backpack capacity for descent items) as an essence vendor.

---

## Removed / Cut

- **Plasm** — collapsed into essence.
- **Breeding Stones** — cut for now (`breeding-stones.md` retired). They were Enhancer consumables; the Enhancer no longer exists.
- **Longevity** — removed.
- **Zone walls** (3 zones) — replaced by one continuous descent.

---

## Docs to update

| Doc | Change |
|---|---|
| `game-design-document.md` | Rewrite Core Philosophy pillar, run structure, add essence system |
| `economy-balancing.md` | Essence resource, earn/spend, level cost curve, depth-jump prices, remove plasm |
| `breeding-and-inheritance.md` | Carry-over, star/essence relationship |
| `traits-system.md` | Trait unlocks → essence thresholds; delete star table |
| `marks-system.md` + `marks-catalog.md` | Earn-then-lock permanence via essence; re-peg thresholds |
| `tower-structure.md` | Single 30-floor descent, boss cadence, essence depth-jumps |
| `town.md` | Essence hub + vendors |
| `breeding-stones.md` | Retire / mark as cut |
| `CLAUDE.md` | Revise "Key Design Rules"; update state notes |
| `MEMORY.md` | Reflect the pivot |

---

## Notes for later playtest tuning

- Essence earn weights (normal / mini-boss / major-boss values).
- Level cost curve steepness and the 2–3-levels-per-strong-run target.
- Depth-jump prices per 5-floor break.
- Whether Model A (temporary in-run leveling) survives or we fall back to Model B.
- Whether stars survive (Model A) or get removed (Model C).
- Single vs. split essence pool for in-run vs. permanent spends.
