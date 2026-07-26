# Departure Flow — Design Spec

**Date:** 2026-07-25
**Status:** Approved
**Scope:** A standing default party so the player stops re-picking three creatures before every run, a compact pre-run departure screen that also chooses the start floor, and a split of depth-jump cost into a one-time unlock plus a smaller per-run fee.

---

## Guiding Principle

**The common path should cost one click.** Most runs use the same three creatures at the same depth. Today every run forces a full party-selection screen, and depth lives behind a separate vendor visit. After this, the player sets a party once, and departing is: click ENTER TOWER, glance at who's coming and how deep, click DESCEND.

The pre-run screen is deliberately *not* skipped entirely. Descending is the one irreversible commitment in the game — creatures can be knocked out, Obols spent, Essence charged — and the player should always see what they are committing before it happens. One glance, one click.

---

## 1. What changes, at a glance

| Today | After |
|---|---|
| ENTER TOWER → pick 3 creatures → run starts | ENTER TOWER → departure screen → DESCEND |
| Party choice is in-memory, re-made every run | `defaultParty` persists; changed only when the player wants |
| Start floor chosen at the Gatekeeper vendor | Start floor chosen on the departure screen |
| Cleared break → deep start available, charged **every run** | Cleared break → floor becomes *purchasable*; buy once at the Gatekeeper, then a **smaller per-run fee** |

---

## 2. Data model

Three values on `GameState`, save **v3 → v4**:

- **`defaultParty: string[]`** — instance IDs of the standing party. Empty on a new game.
- **`unlockedFloors: number[]`** — floors purchased from the Gatekeeper. Floor 1 is always available and is never stored.
- **`selectedStartFloor: number`** — already exists; unchanged in meaning.

`runParty` stays in-memory and is still populated by `setRunParty` at departure. `defaultParty` is the persisted intent; `runParty` is the resolved roster for the current descent. Keeping them separate matters because a party member can be retired between runs, and we must not silently mutate the player's stated intent when that happens.

**Migration.** `defaultParty` defaults to empty. `unlockedFloors` is **granted for every break already cleared** — a save with `deepestBreakCleared: 10` migrates to `unlockedFloors: [6, 11]`. Without that grant, existing players would lose access to depths they already earned and be asked to buy them again, which would be a straightforward regression.

## 3. The departure screen

A new `DepartureScene`, shown when ENTER TOWER is clicked.

**Party line** — the three creatures, with name, level, and HP, so the player sees at a glance that everyone is healthy and who they are taking.

**Floor chips** — one compact chip per available floor: Floor 1 plus everything in `unlockedFloors`, ascending. The selected chip is highlighted; clicking one sets `selectedStartFloor`. With nothing unlocked there is exactly one chip, which is the correct early-game state — the row grows as the player buys depth, so the screen teaches its own progression without explanation.

Each chip beyond Floor 1 shows its per-run fee, because that fee is charged on DESCEND and must not be a surprise.

**DESCEND** — resolves the party, charges the per-run fee, starts the run.
**CHANGE PARTY** — opens `PartySelectScene`.

## 4. Town changes

Town gains a **party display** — the current default party, or a prompt to set one — and a **PARTY** button opening `PartySelectScene`.

`PartySelectScene` keeps its existing job of picking exactly three, with two changes: it **pre-selects** `defaultParty` on open, and on confirm it **writes `defaultParty` and returns to town** rather than starting a run. It becomes a party editor rather than a run gate.

## 5. Stale parties

Breeding retires both parents, and a retired creature is filtered out of the box everywhere. So a default party going stale is not an edge case — it is the ordinary consequence of the breeding loop, and it will happen to every player repeatedly.

**Behavior:** ENTER TOWER is blocked. Town's party display names the specific missing creature — "Ironjaw is no longer available" — and points at PARTY. A generic "party invalid" would make the player open the editor to work out what changed; naming it means they already know before they click.

The same rule covers a party of fewer than three, which is the state on a brand-new game.

## 6. Depth cost split

The Gatekeeper's job changes from *charging for a deep start* to *selling a permanent unlock*.

- **Purchasable** = floors whose 5-floor break has been cleared but which are not yet in `unlockedFloors`. Derived from the existing `deepestBreakCleared`, so nothing about how breaks are earned changes.
- **Buying** deducts a one-time cost and adds the floor to `unlockedFloors`, permanently.
- **Departing** from a floor above 1 charges a smaller per-run fee at run start.

`depthJumpCost` splits into two functions in `Economy.ts`:

```ts
/** One-time Essence cost to permanently unlock `floor` as a start point. */
export function depthUnlockCost(floor: number): number;

/** Per-run Essence fee for departing from an already-unlocked `floor`. */
export function depthRunFee(floor: number): number;
```

**Placeholder numbers, for playtest tuning like the rest of the economy:**

| | Formula | Floor 6 | Floor 11 | Floor 26 |
|---|---|---|---|---|
| One-time unlock | `(floor − 1) × 40` | 200 | 400 | 1000 |
| Per-run fee | `(floor − 1) × 5` | 25 | 50 | 125 |
| *(today's per-run)* | *`(floor − 1) × 15`* | *75* | *150* | *375* |

The recurring cost drops to a third of today's and the difference moves into the one-time gate. These are guesses. They interact with the depth-scaled Obol rewards that just landed — deeper floors now pay more, which makes a deep start more attractive and argues for the unlock cost carrying real weight.

**Affordability.** A floor the player cannot currently afford the per-run fee for is still shown on the departure screen, but greyed and unselectable, with the fee visible. Hiding it would make the player wonder where their purchase went.

**A previously-selected floor can become unaffordable** — the player picks Floor 11, spends Essence at the Leveler, and comes back with too little for the fee. `selectedStartFloor` is persisted, so this state is reachable.

**There is no substitution.** The chip stays selected and is drawn as unaffordable, DESCEND is disabled, and the screen says why: "Not enough Essence for Floor 11 — choose another floor." The player picks a different floor themselves. Departing from somewhere the player did not choose would read as a bug, and it is the same mistake as auto-filling a retired party slot — rejected in §9 for the same reason.

`GameState.resolveRunStartFloor()` currently deducts `depthJumpCost` and returns the floor; it changes to deduct `depthRunFee`. It never falls back: if the selected floor is unaffordable it is a programming error for departure to have been reached at all, so it throws rather than silently starting somewhere else. The departure screen is the gate that prevents it.

## 7. Architecture

```
src/types.ts                    — no new types; two economy constants
src/systems/Economy.ts          — depthUnlockCost / depthRunFee replace depthJumpCost
src/managers/GameState.ts       — defaultParty, unlockedFloors, save v4, party resolution
src/systems/PartyStatus.ts      — pure: resolve a default party against the box
src/scenes/DepartureScene.ts    — the pre-run screen
src/scenes/PartySelectScene.ts  — becomes a party editor
src/scenes/TownScene.ts         — party display + PARTY button
src/scenes/GatekeeperScene.ts   — sells unlocks instead of setting a selection
```

`src/systems/PartyStatus.ts` exists so the stale-party rule is testable without Phaser. It exposes:

```ts
export type PartyStatus =
  | { kind: 'ready'; members: CreatureInstance[] }
  | { kind: 'incomplete'; have: number }
  | { kind: 'missing'; missingNames: string[]; remaining: CreatureInstance[] };

export function resolvePartyStatus(
  defaultParty: string[],
  box: CreatureInstance[],
): PartyStatus;
```

Both town and the departure screen render from this one function, so they cannot disagree about whether a party is usable — which is exactly the kind of drift that produces a screen saying "ready" next to a button that refuses to work.

## 8. Testing

Pure modules under vitest; scenes untested, as elsewhere in this project.

**`PartyStatus`:** a full healthy party resolves `ready` with members in the stored order; fewer than three resolves `incomplete` with the count; a retired member resolves `missing` naming that creature and keeping the survivors; several missing members are all named; a party referencing an instance ID absent from the box entirely (a stale save) resolves `missing` rather than throwing.

**`Economy`:** `depthUnlockCost` and `depthRunFee` are free at floor 1 and rise with depth; the per-run fee is strictly below today's `(floor − 1) × 15` at every unlocked floor, which is the property the split is supposed to deliver.

**No substitution:** `resolveRunStartFloor()` returns exactly the selected floor and deducts exactly its fee, for every affordable selection. Given an unaffordable selection it throws rather than returning a different floor — pin that, because "returns some other floor" is the failure mode this rule exists to prevent.

**`GameState`:** `defaultParty` and `unlockedFloors` round-trip through save/load; a v3 save migrates with `unlockedFloors` granted for every cleared break; buying a floor deducts Essence, is idempotent (buying twice does not double-charge), and refuses when unaffordable.

## 9. Out of scope

- **Multiple saved party presets.** One default is what was asked for. Presets are a natural follow-up if swapping teams becomes common.
- **Reordering party members.** Turn order is speed-derived, so slot order carries no meaning today.
- **Auto-substituting a retired member, or a floor the player cannot afford.** Explicitly rejected in both cases: descending with a creature or at a depth you did not choose is worse than being told to fix it. Blocked, named, and left to the player.
- **Removing the Gatekeeper.** It keeps a real job — selling unlocks.

## 10. Open question for playtest

Does the departure screen earn its click, or does it become a speed bump the player clicks through without reading? If the latter, the fallback is to move the party and floor display into town and let ENTER TOWER descend directly — the data model here supports that without change.
