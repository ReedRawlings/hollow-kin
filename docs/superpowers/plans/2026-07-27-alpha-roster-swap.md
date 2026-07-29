# Alpha Roster Swap — Implementation Plan

**Date:** 2026-07-27
**Status:** Ready to implement
**Scope:** Replace the 36-creature alpha roster in `src/data/creatures.ts` with the 30 Tower ID 1,2 creatures from the master spreadsheet. Expand archetypes 8 → 11. Derive encounter pools from `towerIds`. Collapse the starter picker to one hand. Wipe saves.

---

## Guiding principle

**Ship the roster without resistances and weaknesses.** They are not authored yet and this does not wait on them. Every creature gets `resistances: []` and `weaknesses: []`, the type chart goes flat, and the columns get filled in later without touching any of the code below. What that costs is spelled out in §6 — it is real but it is all recoverable, and none of it blocks alpha.

This is a data swap plus three small structural changes. It is not a redesign.

---

## 1. The 30 creatures

Rows in `Hollow Kins` / sheet `Kin` where `Tower_ID = 1,2`. Two or three per archetype across all eleven.

| # | id | Name | Archetype | Role |
|---|---|---|---|---|
| 1 | 2 | Hunger | Spirits | Mage Buff |
| 2 | 7 | Grampskin | Spirits | Mage |
| 3 | 11 | Little Light | Spirits | Mage Debuff |
| 4 | 13 | Cherry Punch | Food | Fighter |
| 5 | 17 | Butterfly | Food | Mage |
| 6 | 20 | Tofu Slime | Food | Healer Buff |
| 7 | 29 | Weeping Willow | Flora | Mage Debuff |
| 8 | 37 | Turnimp | Flora | Mage |
| 9 | 38 | Bound Book | Devils | Mage |
| 10 | 46 | Squishims | Devils | Mage |
| 11 | 50 | Triple Stack | Slimes | Healer Debuff |
| 12 | 54 | Teddy | Slimes | Fighter |
| 13 | 59 | Golem Grimace | Rock | Fighter |
| 14 | 61 | Pebble Fairy | Rock | Mage |
| 15 | 64 | Rubble | Rock | Mage |
| 16 | 70 | Cat | Fauna | Fighter |
| 17 | 75 | Egg | Fauna | Tank |
| 18 | 80 | Girafficorn | Fauna | Healer Debuff |
| 19 | 87 | Garbage Gary | Kami | Fighter |
| 20 | 91 | Pencilvester | Kami | Fighter |
| 21 | 92 | Geta | Kami | Tank |
| 22 | 98 | Fleschat | Human | Mage Buff |
| 23 | 99 | Trumpet Ted | Human | Mage Debuff |
| 24 | 107 | BellyFul | Human | Tank |
| 25 | 110 | Bomb Beetle | Mecha | Mage |
| 26 | 116 | Routergeist | Mecha | Healer Debuff |
| 27 | 118 | Glitch Goblin | Mecha | Tank |
| 28 | 123 | Wiggledrake | Dragon | Mage |
| 29 | 124 | Vinewyrm | Dragon | Fighter |
| 30 | 125 | Eggnition | Dragon | Healer Buff |

Applied corrections: Triple Stack `Healer` → `Healer Debuff`; Fleschat `Mage Buffs` → `Mage Buff`. Archetype names follow the `Roles & Archetypes` sheet, so sheet `Golem` → code `Rock`, `Spirit` → `Spirits`, `Humans` → `Human`, `Slime` → `Slimes`.

Role spread: Mage 9, Fighter 7, Tank 4, Mage Debuff 3, Healer Debuff 3, Mage Buff 2, Healer Buff 2.

---

## 2. Archetype expansion — 8 to 11

`Archetype` in `src/types.ts` is a union of eight. Devils, Dragon, and Slimes are new.

`ARCHETYPE_COLORS` is **not** decorative and cannot be skipped. `template.spriteColor` is drawn as a coloured rectangle in `BestiaryScene` (two places), `LevelerScene`, `RestScene`, and `BreedingScene` (three places). No creature sprites exist — these blocks are the art. A missing entry is a type error, and a wrong one is an invisible creature.

```ts
export const ARCHETYPE_COLORS: Record<Archetype, number> = {
  Kami:    0x88ccff,   // existing
  Spirits: 0x9966cc,   // existing
  Flora:   0x66cc66,   // existing
  Fauna:   0xcc8833,   // existing
  Rock:    0x888888,   // existing
  Mecha:   0xcc3333,   // existing
  Food:    0xcccc33,   // existing
  Human:   0xccaa77,   // existing
  Devils:  0xcc3366,   // new — crimson, distinct from Mecha red
  Dragon:  0x338866,   // new — deep teal-green, distinct from Flora's brighter green
  Slimes:  0x66ddcc,   // new — pale aqua
};
```

Placeholder values. Dragon and Slimes are the closest pair — worth an eyeball check against a dark background before committing to them.

---

## 3. Generated fields

Nothing below is hand-authored. All of it derives from `archetype`, `role`, and `towerIds`.

### 3.1 Base stats

```
base_stat = round(tier_budget[lowest towerId] × role_weight[base_profile][stat])
```

**Tier budget is read from the creature's lowest Tower ID.** All 30 alpha creatures are `[1, 2]`, so all draw budget 118. Stat totals are therefore uniform across the roster and differentiation comes entirely from role.

| Tier | Budget |
|---|---|
| 1 | 118 |
| 2 | 128 |

The nine roles collapse to **four stat profiles**. The Buff/Debuff modifier does not change stats — it selects the second ability (§3.2).

| Role | Profile |
|---|---|
| Tank, Tank Buff, Tank Debuff | Tank |
| Mage, Mage Buff, Mage Debuff | Mage |
| Healer Buff, Healer Debuff | Healer |
| Fighter | Fighter |

**Role weights** — fraction of the budget per stat. Each row sums to 1.

| Profile | HP | MP | STR | DEF | WIS | SPD | INT |
|---|---|---|---|---|---|---|---|
| Tank | .4642 | .1306 | .1099 | .1477 | .0719 | .0341 | .0416 |
| Mage | .2812 | .2418 | .0640 | .0605 | .1032 | .1190 | .1303 |
| Healer | .3780 | .2186 | .0626 | .0841 | .1200 | .0569 | .0799 |
| Fighter | .3578 | .1757 | .1359 | .0943 | .0827 | .0886 | .0651 |

Reverse-engineered from the mean stat distribution of the superseded 36-creature roster, so generated values land close to what was previously hand-tuned.

**Resulting stat blocks at budget 118 — all four, in full:**

| Profile | HP | MP | STR | DEF | WIS | SPD | INT | Total |
|---|---|---|---|---|---|---|---|---|
| Tank | 55 | 15 | 13 | 17 | 8 | 4 | 5 | 117 |
| Mage | 33 | 29 | 8 | 7 | 12 | 14 | 15 | 118 |
| Healer | 45 | 26 | 7 | 10 | 14 | 7 | 9 | 118 |
| Fighter | 42 | 21 | 16 | 11 | 10 | 10 | 8 | 118 |

Rounding puts Tank one point under. Not worth correcting.

**Consequence worth naming:** with four profiles and one tier, the alpha roster has **four distinct stat blocks across 30 creatures**. Nine Mages are numerically identical. That is expected at this stage — identity comes from archetype, ability, and rite — but it is the first thing to revisit if fights feel samey, and the per-creature nudge column exists for exactly that.

### 3.2 Abilities

Ability 1 from archetype. Ability 2 from role.

| Archetype | Ability 1 (tier 1) | Ability 1 (tier 2) |
|---|---|---|
| Spirits | `phantom` | `shadow_claw` |
| Food | `jab` | `smash` |
| Flora | `gust` | `gale` |
| Fauna | `jab` | `slash` |
| Kami | `frost` | `chill` |
| Rock | `smash` | `seismic_slam` |
| Mecha | `crackle` | `spark` |
| Devils | `phantom` | `spook` |
| Human | `jab` | `cross_counter` |
| Dragon | `ember` | `smolder` |
| Slimes | `smash` | `thrash` |

Alpha creatures use the tier-1 column, matching their lowest Tower ID.

| Role | Ability 2 |
|---|---|
| Tank | `harden` |
| Tank Buff | `steel_skin` |
| Tank Debuff | `scold` |
| Fighter | `bold` |
| Mage | `focus` |
| Mage Buff | `overdrive` |
| Mage Debuff | `weaken` |
| Healer Buff | `soothe` |
| Healer Debuff | `mend` |

> **Known weakness.** `Healer Debuff` gets `mend`, which expresses the heal half of the role and none of the debuff half. Two ability slots and a 32-ability library cannot carry both. Three alpha creatures are affected — Triple Stack, Girafficorn, Routergeist. Fix by writing a heal-plus-debuff ability, not by changing the mapping.

### 3.3 Capture price

One value per band the creature appears in, drawn from that band's range and then fixed. All 30 are `[1, 2]`, so each carries two.

```ts
captureBasePrice: { 1: 20–40, 2: 41–60 }
```

Generate once at import. Do not recompute at encounter time — look up the current floor's band and read the value.

### 3.4 Trait pools

`naturalTraitPool` is authored, not generated — but the generation rule previously sketched drew half its entries from `resist_<type>` traits keyed off resistances and weaknesses. With those columns empty, that half produces nothing.

For alpha, pools are **role staples plus archetype flavour**:

| Profile | Staples |
|---|---|
| Tank | `hp_up`, `def_up`, `opening_ward`, `opening_block` |
| Mage | `int_up`, `mp_up`, `wis_up` |
| Healer | `wis_up`, `hp_up`, `resist_status` |
| Fighter | `str_up`, `hp_up`, `opening_buff` |

Archetype flavour: Kami `resist_status` · Spirits `evasion_up` · Flora `kin_bond` · Fauna `kin_bond` · Rock `resist_physical` · Mecha `initiative_boost` · Food `kin_bond` · Human `kami_slayer` · Devils `evasion_up` · Dragon `initiative_boost` · Slimes `resist_physical`.

Pool width lands at 4–5, against 5–8 on the old roster. Narrower than intended; it widens when resistances and weaknesses arrive.

---

## 4. Encounter pools

`ZONE_CREATURE_POOLS` is the Tower ID system under an older name. `poolForFloor` in `src/systems/RunGenerator.ts` already computes the right thing:

```ts
const band = Math.min(3, Math.floor((floor - 1) / 10) + 1);
```

Two changes:

1. **Cap 3 → 10.** The formula is already correct for a 100-floor tower; only the clamp is wrong.
2. **Derive the pool rather than hand-maintaining it.** Replace the literal `ZONE_CREATURE_POOLS` map with a filter over `towerIds`:

```ts
export function poolForBand(band: number): string[] {
  return Object.values(CREATURE_TEMPLATES)
    .filter(t => t.towerIds.includes(band))
    .map(t => t.id);
}
```

A creature in bands 1 and 2 appears in both pools with no duplication of intent, and adding a creature to a band becomes a spreadsheet edit rather than a code edit.

Alpha populates bands 1 and 2 only. Bands 3–10 return empty; `poolForFloor` should fall back to band 1 rather than returning `[]`, since an empty pool would break encounter generation if a run ever reaches floor 21.

---

## 5. Starter trio

`BootScene` currently draws two selectable hands — `THE KENNEL HAND` (recommended) and `THE STONE HAND` (harder start) — reading `STARTER_TRIO_A` and `STARTER_TRIO_B`, both of which reference species that cease to exist.

**Alpha ships one fixed trio, no choice.** Collapse the picker: one hand, centred, no `this.selected` state, no comparison layout, confirm-only.

The trio wants one of each stat profile so the tutorial covers the shape of combat. Any Fighter, Tank, and Mage from §1 works; the Tank pool is the constraint at four candidates (Egg, Geta, BellyFul, Glitch Goblin).

Keep `STARTER_TRIO_A` as the exported name and delete `STARTER_TRIO_B`, so the second hand can return later without renaming.

---

## 6. What shipping without resistances and weaknesses costs

All recoverable. Listed so none of it is a surprise in playtest.

**Type effectiveness does nothing.** `RESISTANCE_MULTIPLIER` never applies — every hit is neutral. Combat runs; it is just flatter.

**Auto-combat's knowledge fog goes inert.** `TacticsAI.chooseAction` applies type multipliers only for species in `seenSpecies`. With no type data there is no multiplier to withhold, so the fog withholds nothing and the "blind on first encounter" promise is invisible. The mechanic is intact and untestable.

**Trait pools narrow to 4–5** (§3.4).

**Family rites still work.** Flora, Kami, and Slimes rites trigger on `damage_type_taken` — the damage type of the incoming attack, which is a property of the ability, not of the target's weakness list. Unaffected.

**The type chart imbalance from the old roster is gone**, because there is no type chart. When these columns get filled, check the distribution before committing — the superseded roster had Ghost as a weakness on 12 creatures and a resistance on 5.

---

## 7. Alpha floor cap

Alpha stops at floor 20 — the deepest the roster reaches.

`TOWER_FLOORS = 30 → 20` in `types.ts` does nearly all of it. `buildDescent` generates `startFloor..TOWER_FLOORS`, the Gatekeeper's granted-floor loop is already bounded by it, `RunGenerator.test` asserts descent length against it, and the run-results ledger row reads "floor N of 20" without touching the string.

It also retires the §4 fallback concern: bands 3–10 are never reached, so an empty `poolForBand` cannot break encounter generation. Keep the fallback anyway — it costs one line and the cap will move.

**The completion screen is genuinely new.** There is no end-of-descent path in the codebase today. `RunScene` has two terminal states tracked by a single boolean, `resultIsWipe`: wiped, or fled. Clearing the final encounter is undefined behaviour — nobody has ever reached floor 30, so `generatePickNextChoices` returns nothing and the run sits with no legal move.

What it needs:

- A third terminal state alongside wipe and flee. `resultIsWipe: boolean` becomes an outcome enum.
- Detection: the last encounter in `run.encounters` resolves in the player's favour.
- The screen itself — reuse the existing run-results ledger layout with a different header and copy. "Thanks for playing" is alpha-only text and gets replaced when the tower extends to 100 floors.

**Rewards need no change.** `gameState.endRun(!this.resultIsWipe, run.obols)` takes *survived* as its flag, and a completed descent survives exactly as a flee does. Obols and Essence already resolve correctly; only presentation differs.

---

## 8. Saves

Wipe. No migration.

Every persisted creature references a species id that no longer exists, and `starRating`, `traitSlots`, and `statBaseline` all hang off templates that are gone. Bump the save version and discard anything older on load.

---

## 9. Order of work

1. `Archetype` union + three colours — everything else is a type error until this lands
2. Regenerate `creatures.ts` from the sheet: 30 templates, stats/abilities/prices/pools generated per §3
3. `poolForBand` + `poolForFloor` clamp; delete `ZONE_CREATURE_POOLS`
4. One starter trio; collapse the `BootScene` picker
5. `TOWER_FLOORS` → 20
6. Run-outcome enum + completion screen
7. Save version bump, discard-on-old
8. Update `testFixtures.ts` and `Capture.test.ts` — both build inline `CreatureTemplate` literals that will need `towerIds` and the new `captureBasePrice` shape

Steps 1–5 are mechanical. Step 6 is the only one with real design in it.

---

## 10. Open

* `towerIds` and `role` are new fields on `CreatureTemplate` and do not exist in `types.ts` yet.
* `captureBasePrice` changes from `number` to `Record<number, number>`; `Capture.ts` reads it in `capturePrice` and `isUncapturable` and both need updating.
* Seven of eleven family rites need `RiteCondition` kinds that do not exist — tracked in the capture spec §12, not blocking this work.
* Signature rites unwritten for all species.
* Boss and breed-only creatures do not exist; `availability` is `wild` for all 30.
