# Expedition Commitment & Consumables — Design

**Date:** 2026-07-29
**Status:** Approved for implementation
**Source pitch:** `expedition-items-pitch.md`

## What this spec covers

This is **slice 1 of the expedition-items pitch**. The pitch spans six subsystems; this
spec implements two of them:

- **Departure commitment** — free `FLEE` between every encounter is removed. Guaranteed
  departure happens on boss floors; between them, extraction is an item you carried.
- **The consumable pool** — the backpack's two placeholder items become nine, and items
  become usable on the run map as well as in battle.

### Explicitly out of scope

These are named so nobody mistakes their absence for an oversight. Each gets its own spec.

| Deferred | Why not now |
|---|---|
| Post-battle reward offer (relief-vs-future-value cards) | Depends on the item pool existing first. The two-boon `PostCombatScene` is untouched by this slice. |
| Charged Preparations | New `BackpackContents` kind with mutable charges plus a pre-battle commit step — a save-format change and a new UI flow of its own. |
| Heirlooms | Permanent equipment with a town tile and its own persistence. |
| Marks-as-unlocks | Its reward vocabulary is "unlock an Heirloom / Relic / Preparation." Relics do not exist in code at all, and the other two are deferred above, so Marks has nothing to point at until the rest lands. |

### Decisions taken from the pitch's open list

The pitch closes with eight "Decisions Needed Before Implementation." Those bearing on
this slice were settled during design:

2. **Boss departure cadence — confirmed.** Every five-floor boss, and nothing else.
3. **Waystone supply — both shops.** Town Provisioner (Essence) and Tower Merchant (Obols).
8. **Tuning deferred**, per the alpha note at the top of `CLAUDE.md`. Every number in this
   spec is a placeholder.

Decisions 1, 4, 5, 6 and 7 concern Marks, the post-battle offer, Preparations and
Heirlooms. They stay open and belong to the later specs.

## Design rules this slice must not break

From `CLAUDE.md`:

- **A wipe costs exactly one thing, at random, from unprotected slots.** Unchanged here.
  New items ride the same slots and are equally losable. Nothing in this slice may make an
  item categorically safe from the wipe roll — protection is positional, bought from
  guaranteed capacity, and that is the only hedge.
- **The three creatures you entered with can never be lost.** Untouched.
- **Obols never persist; Essence is the only permanent store of value.** A deliberate exit
  converts 100%, a wipe 50%. Waystone departure is a deliberate exit and pays full rate.
- **Numbers are placeholders.** Tests assert shape, never a magic value.

## Save impact: none

`GameStateManager.currentRun` is **not** included in `saveToLocalStorage`, so run-scoped
state may be added freely. New items reuse the existing `{ kind: 'item'; itemId: string }`
slot shape, so `Backpack` is unchanged on disk.

**`SAVE_VERSION` stays at 7. No migration is required.** This is unusual for work in this
repo and is a deliberate constraint on the design: anything that would have forced a bump
was pushed into a later slice.

---

## Part 1 — Departure commitment

### The rule

Departure is open **exactly when the party has just cleared a boss floor and has not yet
committed to the next room.** Otherwise the only way out is a Waystone, or a wipe.

Entering the tower is itself a commitment: a run begins with departure closed, whether it
starts at floor 1 or at a depth-jumped floor.

### Derived, not stored

Departure state is computed, never persisted:

```
canDepart(run) === run.currentEncounterIndex >= 0
                  && run.encounters[run.currentEncounterIndex].type === 'boss'
```

Committing to a room advances `currentEncounterIndex`, which closes departure as a side
effect of the move the player already makes. No new `RunState` field, no flag to keep in
sync, and a fresh run reads closed for free because the index starts at `-1`.

This follows the codebase's existing precedent — breed-readiness is derived from
`permanentLevel >= levelCap` rather than stored, for the same reason.

### New module: `src/systems/Departure.ts`

Pure, no Phaser import, no RNG. Roughly forty lines.

```ts
/** Departure is open only on the boss floor just cleared. */
export function canDepart(run: RunState): boolean

/** Floor of the next boss ahead in the descent; null when none remains. */
export function nextDepartureFloor(run: RunState): number | null

/** Does the bag hold anything that can end the expedition? */
export function hasWaystone(bag: Backpack): boolean
```

`nextDepartureFloor` scans `run.encounters` forward from `currentEncounterIndex + 1` for
the first `type === 'boss'` entry and returns its `floor`. It does **not** compute the next
multiple of five arithmetically — the descent is the authority on where bosses actually
are, and the two must never be able to disagree.

### `RunScene` changes

The existing `FLEE` button becomes `DEPART`, in one of three states:

| Situation | Button | Header line |
|---|---|---|
| Boss just cleared | `DEPART` — live, gold | `SAFE PASSAGE OUT — TAKE IT OR PRESS ON` |
| Committed, carrying a Waystone | `DEPART (WAYSTONE)` — live, teal | `WAYSTONE READY — NEXT FREE EXIT: FLOOR n` |
| Committed, no Waystone | dimmed, not clickable | `NO WAYSTONE — NEXT GUARANTEED DEPARTURE: FLOOR n` |

The third line is the pitch's required commitment display and must be visible on the run
map at all times, not only inside a modal.

`ESC` keeps invoking the same path, so the keybinding never changes meaning. When
departure is locked and no Waystone is held, `ESC` flashes the header line rather than
opening a modal — an unusable modal reads as a broken button.

### The commitment modal

Today's flee-confirm modal is repurposed and inverted. When `canDepart(run)` is true and
the player selects a room, confirm before advancing:

> **PRESS ON?**
> Committing to floor 6. The next guaranteed way out is floor 10.
> *(if carrying one)* You carry a Waystone — one exit, any time.

Buttons: `PRESS ON` / `DEPART INSTEAD`.

When departure is already locked, rooms commit with no modal, exactly as they do today.
The modal marks the moment a choice exists; showing it otherwise would train players to
dismiss it.

### Routing

Boss departure and Waystone departure both route into the existing
`showRunEnd('fled')`, which already converts leftover Obols at the full rate and runs
the existing ledger. Waystone departure consumes the item first, so the bag shown on the
results screen is accurate.

Smoke Husk never touches this path — it ends a battle, not an expedition.

### Interaction with existing systems

- **Depth-jumps.** A run started at floor 11 reads its next departure as floor 15,
  because `nextDepartureFloor` reads the generated descent rather than assuming floor 1.
- **Tower cleared.** Clearing the final floor still lands on the `TOWER CLEARED` ledger
  via the empty-`choices` path. Departure gating never fires there.
- **Wipe.** Unchanged: 50% conversion and one unprotected slot lost.
- **The known soft-lock** (breeding is net −1 creature, and with no capture the box can
  fall to 2 actives) is untouched by this slice and remains capture's problem.

---

## Part 2 — The consumable pool

### `ItemDefinition` gains two fields

Both UIs must decide what to offer without hard-coding item ids, so the definition
carries that information:

```ts
usableIn: 'combat' | 'combat_non_boss' | 'map' | 'both'
targeting: 'living_ally' | 'downed_ally' | 'enemy' | 'none'
```

`combat_non_boss` exists solely for Smoke Husk. Encoding it as data rather than as a
special case in `CombatScene` keeps the boss restriction testable and keeps the scene
free of item-specific branches.

### The nine items

Eight from the pitch, plus `power_increase`, which already exists and is already stocked
in both shops. It is kept rather than removed — it works, and dropping a stocked item is
churn this slice does not need.

`power_increase` is **combat-only** even though the other recovery items are usable on the
map: buff stages live on `CombatCreature` and do not survive a battle, so a map use would
silently do nothing. The same reasoning makes Grave Ash and Null Salt combat-only — they
target an enemy, and there is no enemy on the run map.

| Item | Effect kind | `usableIn` | `targeting` | Answers |
|---|---|---|---|---|
| Mending Draught | `heal` *(exists)* | both | living ally | HP recovery |
| Moonwater | `restore_mp` | both | living ally | MP recovery |
| Hollow Candle | `revive` | both | downed ally | a knockout |
| Clearroot | `cure_status` | both | living ally | any negative status |
| Power Increase | `buff` *(exists)* | combat | living ally | a stat stage |
| Grave Ash | `percent_damage` | combat | enemy | MP-free emergency damage |
| Null Salt | `strip_buffs` | combat | enemy | a buffed elite |
| Smoke Husk | `escape_battle` | combat_non_boss | none | escaping a losing fight |
| Waystone | `depart` | map | none | banking the take |

### Four new `CombatEngine` primitives

Added alongside the existing `applyHeal` and `applyBuffDebuff`, in the same style —
mutate the passed `CombatCreature`, return what happened:

```ts
revive(target, hpFraction, mpFraction): boolean        // false if not knocked out
clearNegativeStatuses(target): StatusType[]            // what was removed
stripPositiveStages(target): StatName[]                // stages > 0 reset to 0
applyPercentDamage(target, fraction): number           // ignores DEF and the type chart
```

`stripPositiveStages` clears **only** positive stages. It is a counter to a buffed enemy,
not a cleanse — leaving an enemy's debuffs in place is the point.

`applyPercentDamage` deliberately bypasses `calculateDamage`. Ignoring DEF and the type
chart is what earns Grave Ash a backpack slot when the party's abilities are being
resisted, and is why it may not simply be a zero-MP ability.

### Grave Ash and bosses

Grave Ash carries **two fractions** — one for ordinary enemies and a lower one used
against `boss` encounters.

A flat numeric cap was rejected: boss HP grows with depth, so a fixed cap makes the item
dead weight by the bottom of the tower — exactly the failure the pitch warns about. Two
fractions deliver the same "reduced against bosses" intent while scaling on their own,
with no floor lookup anywhere.

Both fractions are placeholders. The invariant that matters, and the one the tests pin,
is `bossFraction < fraction`.

### Smoke Husk as a free action

Free-action escape is the strongest form of the item, and it is what was chosen. It is
implemented without touching the turn loop:

- It is still selected from the `ITEM` submenu during a player creature's turn — the only
  time that menu exists.
- Resolving it **ends the battle immediately** rather than passing the turn, so no enemy
  acts in response.
- The party forfeits the encounter's Obols and XP, keeps everything carried, and returns
  to the run map. The floor counts as visited; `currentEncounterIndex` is already set, so
  the next rooms are offered normally.
- It is unavailable in `boss` encounters, enforced by `usableIn: 'combat_non_boss'`.

**Escaping records no species knowledge.** Auto-combat's fog is recorded at battle end,
and a free-action escape would otherwise allow "enter, read the enemy, escape, re-enter
informed" as a no-cost scouting loop — defeating the promise that a first encounter is
genuinely blind.

Because it is a free action, its scarcity and price carry the tension this slice is
trying to create. **Smoke Husk's price is the first number to revisit in playtest**, and
if a free-action escape proves too strong, the smallest correction is raising its cost,
not changing its rule.

### New module: `src/systems/Items.ts`

Item resolution lives here rather than in either scene. Combat operates on
`CombatCreature`; the run map operates on `CreatureInstance` plus `RunState.partyHp` /
`partyMp` / `partyKO`. These are genuinely different state shapes, and the codebase
already splits along exactly that line — `CombatEngine` for one, `Recovery` for the
other. `Items.ts` follows the same seam rather than introducing an adapter layer to
paper over it.

```ts
/** Where a use is being attempted from. `isBoss` is only meaningful in combat. */
export interface ItemContext {
  where: 'combat' | 'map';
  isBoss: boolean;
}

export type ItemOutcome =
  | { kind: 'applied'; message: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'escape_battle' }
  | { kind: 'depart' }

/** Is this item offerable in this context at all? */
export function canUseItem(def: ItemDefinition, ctx: ItemContext): boolean

/** Resolve against combat state, delegating to CombatEngine primitives. */
export function applyItemInCombat(def, target: CombatCreature | null): ItemOutcome

/** Resolve against run state, delegating to Recovery. */
export function applyItemOnMap(def, target: CreatureInstance | null, run: RunState): ItemOutcome
```

Extraction items resolve to an **outcome the scene acts on**, not to a mutation. `Items.ts`
never ends a battle or a run itself — it reports that one should end, and the scene owns
the transition. This keeps the module pure and unit-testable with no Phaser dependency.

Consumption is the **caller's** job, and only on an `applied`/`escape_battle`/`depart`
outcome. A `refused` outcome must never consume the item — the existing purchase code
follows the same "don't take payment if it can't be delivered" rule, and this mirrors it.

### The interactive bag

`RunScene`'s bag modal is currently read-only. It gains, per slot holding a map-usable
item, a `USE` button, then a target picker for targeted effects.

The modal moves to **`src/scenes/run/BagPanel.ts`**, following the existing
`src/scenes/combat/BattlefieldRenderer.ts` precedent. `RunScene` is 425 lines and this
slice adds departure gating on top; the bag is a self-contained panel with its own
selection state and is the natural thing to lift out.

The panel keeps its existing job of showing which slots are `SECURED`, since that remains
the only thing a player can do about the single random wipe loss.

### The combat item submenu

The `ITEM` submenu currently lists up to four unique item ids. With nine items that cap
becomes reachable, so it gains paging.

It also needs two targeting modes it does not have:

- **enemy targeting** for Grave Ash and Null Salt — the ability path already has this and
  it can be reused, including single-enemy auto-target.
- **downed-ally targeting** for Hollow Candle — new. Living-ally targeting today filters
  knocked-out creatures out; revive needs the inverse list.

Items that resolve with `targeting: 'none'` skip target selection entirely.

### Shops

**Tower Merchant** keeps its three services and stocks **three** of the item pool per shop
encounter. The draw is derived deterministically from the encounter's existing `floor` and
`index` fields — `Encounter` carries no seed, and adding one is avoidable: a pure function
of those two values gives a stock list that is stable across redraws of the scene without
any new state. This makes finding a market meaningful and avoids overflowing the scene's
fixed layout with nine offers.

**Town Provisioner** stocks the full pool in a 3×3 grid, so a Waystone is always buyable
before descending. This is the guarantee that makes the departure lock fair: a player who
prepares is never trapped by map RNG.

Prices are placeholders. The relationships that matter:

- Extraction (Waystone, Smoke Husk) is the **most expensive** tier — these buy safety.
- Tower prices in Obols exceed town prices in Essence, preserving the existing pattern
  that preparation is cheaper than improvisation.

| Item | Tower (Obols) | Town (Essence) |
|---|---|---|
| Mending Draught | 15 | 8 |
| Moonwater | 15 | 8 |
| Power Increase | 15 | 8 |
| Clearroot | 20 | 10 |
| Grave Ash | 25 | 12 |
| Null Salt | 30 | 15 |
| Hollow Candle | 45 | 22 |
| Smoke Husk | 60 | 30 |
| Waystone | 80 | 40 |

`tryBuyItem` is unchanged — it is already currency-agnostic and already refuses without
charging when the bag is full.

---

## Testing

Per the alpha rule, tests assert **shape and relationships**, never placeholder values.

**`src/systems/Departure.test.ts`** (new)
- A fresh run reads departure closed, at floor 1 and at a depth-jumped start.
- Clearing a boss opens departure; committing to the next room closes it.
- `nextDepartureFloor` returns the next boss's floor from the generated descent, and
  `null` once none remain.
- `hasWaystone` reflects bag contents.

**`src/systems/Items.test.ts`** (new)
- Every item in the pool resolves through `canUseItem` in at least one context — no item
  is unreachable.
- A refused outcome reports a reason and signals no consumption.
- Smoke Husk is refused in a boss encounter and permitted otherwise.
- Waystone is refused in combat and permitted on the map.
- Grave Ash deals strictly less to a boss than to a non-boss of identical max HP.
- Revive is refused on a living target and succeeds on a downed one.

**`src/systems/CombatEngine.test.ts`** (additions)
- `stripPositiveStages` clears positive stages and leaves negative ones intact.
- `clearNegativeStatuses` empties the status list and reports what it removed.
- `applyPercentDamage` scales with the target's max HP and ignores DEF.

**`src/systems/Shop.test.ts`** (additions)
- Every item id in both catalogs resolves in `ITEMS` — the same authoring invariant
  `creatures.test.ts` enforces for abilities.
- The Tower Merchant's random draw is a subset of the pool and never repeats an item
  within one shop.

## Risks

- **Free-action Smoke Husk may blunt the commitment this slice creates.** Accepted
  deliberately. Price is the correction lever; the rule stays.
- **The departure lock makes an unlucky early run unwinnable and unleavable.** That is the
  intended tension, and the wipe penalty is mild — half the leftover Obols, one unprotected
  item. Worth watching in playtest at floors 1–4, where no boss has yet been cleared and a
  town-bought Waystone is the only hedge.
- **Nine items in a six-slot backpack is tight.** Intended — the backpack is the point of
  tension. The Quartermaster, which sells capacity, is not built, so slot pressure cannot
  yet be relieved by progression. Flagged, not solved here.
