# **Hollow Kin — Run Relics Reference**

*Balancing Document — Subject to Change*

> **Owns:** the relic catalog, relic rules, and design guidelines for new relics.
> **Defers to the GDD on:** the progression model.
> **Last verified:** 2026-07-30. **Not yet built** — but see the note on boons below.
>
> ⚠️ **Relics are run-only by design.** They are lost at the end of every run regardless of outcome. This is the roguelite element the game deliberately keeps — it is **not** an unconverted leftover from the pre-pivot design. Do not make relics persist.
>
> ⚠️ **Half of this system already exists under another name. Read `src/systems/Boons.ts`
> before building relics.**
>
> Slice 2 of `expedition-items-pitch.md` shipped **timed boons** — run-scoped modifiers
> chosen at the post-battle reward screen that take effect immediately and expire after a
> set number of battles. Mechanically a boon *is* a relic with an expiry: same automatic
> application, same run-only lifetime, same neutral-valued query layer feeding the same
> combat hook sites.
>
> The code was written anticipating this. `ActiveBoon.battlesLeft` is typed
> `number | null`, where **`null` means "lasts the whole run"** — nothing produces it
> today, and it exists precisely so a relic is expressible as a boon that never counts
> down. `grantBoon` already enforces one-of-each-effect-kind (re-granting refreshes rather
> than stacks), which is the same anti-stacking rule this document's guidelines want.
>
> So relics should **extend that layer, not duplicate it.** What genuinely needs building
> is the relic-specific part: a catalog, the acquisition points (this document's earning
> rules), any effect kinds boons don't already cover, and whatever UI distinguishes a
> permanent-for-the-run relic from a counting-down boon. Adding a second parallel
> modifier system would mean two places to hook every combat calculation.

---

## **Overview**

Run relics are temporary power-ups earned during a run. They do not persist after the run ends. Relics provide stackable or conditional bonuses that shape how a run plays out and reward specific party compositions or playstyles.

---

## **Relic Rules**

* Relics are earned from combat rewards, random events, shops, and boss drops
* Multiple relics can be held simultaneously — there is no cap
* Some relics stack with themselves (noted in the table)
* Relics are lost at the end of every run regardless of outcome
* Relics are not stored in inventory slots — they have their own dedicated space

---

## **Relic Catalog**

| ID | Name | Effect | Stackable | Source | Notes |
| --- | --- | --- | --- | --- | --- |
| relic_001 | Chain Lightning | Damage chains to one extra enemy for 10% of original damage | Yes (up to 4x) | Combat reward | Scales with AoE builds |
| relic_002 | Red Meat | Fauna creatures gain +10% ATK | Yes (up to 3x) | Combat reward | Archetype-specific |
| relic_003 | Beast Master | Fauna abilities trigger as if one additional Fauna is in the party | No | Boss drop | Enables solo Fauna strategies |
| relic_004 | Rock Lobster | Frontline creature gains +20% max HP | Yes (up to 2x) | Combat reward | Applies to position 1 only |
| relic_005 | Phoenix Down | At end of battle, revive one KO'd creature with 1 HP | No (3 uses total) | Shop / Boss drop | Uses are consumed across encounters |
| relic_006 | Touch Grass | Flora creatures gain Thorns 1 (reflect minor damage on hit) | No | Combat reward | Archetype-specific |
| relic_007 | Mog | Creatures that start battle at full HP gain 1 Haste | No | Random event | Rewards clean play between encounters |
| relic_008 | Bad Research | Flora creatures are treated as both Flora and Fauna for ability triggers | No | Random event | Enables cross-archetype synergies |
| relic_009 | Oogy Boogy | Kami share their equipped passive trait with Spirit creatures in the party | No | Boss drop | Requires Kami + Spirit party |
| relic_010 | TBD | TBD | TBD | TBD | Placeholder |

---

## **Design Guidelines for New Relics**

* Each archetype should have at least 2–3 relics that specifically benefit it
* General-purpose relics (not archetype-locked) should make up roughly half the pool
* No single relic should be an auto-pick — the value should depend on party composition
* Boss-drop relics should be stronger than combat-reward relics
* The total relic pool should be large enough that no two runs feel identical — target 30–40 relics at launch

---

## **Open Questions**

* Relic rarity tiers — should some relics be weighted to appear less often?
* Whether relics can be sold at shops for resources
* Whether there are cursed relics (powerful effect with a drawback)
* Exact drop rates per encounter type
