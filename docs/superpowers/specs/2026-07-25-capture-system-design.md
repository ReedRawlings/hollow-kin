# Capture System — Design Spec

**Date:** 2026-07-25
**Status:** Approved design, ready for implementation planning
**Scope:** Obols-based creature capture during runs. Covers the threshold model, the duplicate Essence grant, Creature Box capacity and the pending-capture queue, and the combat-turn interaction. Background survey: `docs/superpowers/research/capture-mechanics-research.md`.

---

## Guiding Principle

**Capture is a price, not a slot machine.** Below the threshold a spend buys a probability; at or above it, the capture is guaranteed. The player always knows what certainty costs, and can choose to gamble under it. This is Monster Crown's reachable determinism rather than Pokémon's asymptote, and it avoids the failure mode the survey is clearest about: a permanently scarce guaranteed-capture item (the Master Ball) that players hoard and never use.

Two consequences shape everything below:

1. **The threshold is the design.** Odds, safe slots and backpack size are all downstream of it. Getting the threshold curve right is the whole balance problem.
2. **Duplicates are bounded by systems that already exist.** The Essence grant is *invested* into a species line rather than added to the player's pool, so it cannot be redirected to whatever the player is optimising, and `levelCap` from stars caps how much a line can absorb. No escalating price, no lifetime counter, no per-species decay.

---

## 1. Decisions locked during design

| Question | Decision |
|---|---|
| Cost model | Obols. Below the threshold, a gamble; at or above it, a guaranteed capture. |
| Threshold inputs | Per-species base × depth × the target's current HP. Commoner species, shallower floors and hurt targets are cheaper. |
| Failure cost | Obols spent are consumed, and the attempt costs the acting creature's turn. |
| Duplicates | Invest a small amount of Essence into that species' line, scaled by capture depth. |
| Line eligibility | Only if a member of that species sits in the Creature Box or the active party. A species held only in the run inventory does not qualify. |
| Box full on exit | The capture waits in the run inventory, occupying a slot, until Box space frees. |
| Box capacity | Becomes bounded and Essence-expandable, with a release mechanic added separately. Storage, not a pressure system. |
| Uncapturable creatures | Expressed as a species threshold of 0 — covers boss-exclusive and breed-only creatures with no special-casing. |
| Arrival state | A capture arrives as `createCreatureInstance(speciesId, 0)` — level 1, 0 stars, no Essence invested. It is cargo for the rest of the run and cannot be fielded. |
| Auto-combat | A standing capture policy the player sets between fights, executed by an explicit rule ladder. AUTO buys the guarantee or skips; it never gambles. |

---

## 2. The threshold

```ts
/** Obols required to guarantee a capture of this target, right now. */
export function captureThreshold(
  template: CreatureTemplate,
  floor: number,
  hpCurrent: number,
  hpMax: number,
): number
```

```
threshold = base × depthMult(floor) × hpMult

base       = template.captureThreshold        // 0 = uncapturable
depthMult  = floor ^ CAPTURE_DEPTH_EXPONENT
hpMult     = (3·hpMax) / (3·hpMax − 2·hpCurrent)      // 1× at 1 HP, 3× at full HP
```

`hpMult` is the genre's one shared constant, inverted into a price. Pokémon has used `(3·HPmax − 2·HPcurrent)/(3·HPmax)` as a probability multiplier since Gen III, and Temtem and Cassette Beasts both mirror it; expressed as a price it means **a full-HP target costs exactly 3× a nearly-dead one, and never more.** That cap is the point — without it capture collapses into a false-swipe minigame where the only question is whether you can avoid overkilling.

`CAPTURE_DEPTH_EXPONENT` should match `OBOL_REWARD_EXPONENT`. Obol income now grows as `floor^0.5` per encounter; if capture prices grew more slowly, captures would get relatively cheaper the deeper you went, drifting toward deep floors being the farmable ones. Keying both to the same exponent keeps the ratio flat. **These constants move together** — the same coupling rule already documented on `OBOL_REWARD_EXPONENT` in `types.ts`.

### Resolution

```ts
export function captureChance(obolsSpent: number, threshold: number): number
// → clamp01(obolsSpent / threshold);  threshold 0 → always 0
```

Linear, so "half the price, half the chance" is true and checkable. Any curve here would make the displayed percentage harder to reason about for no gain.

**Display the number, live**, updating as the target takes damage and as the player adjusts the spend. The survey is clear that transparency only works when the number is *engineerable* — Dragon Quest Monsters prints its scout percentage and it reads fine because buffs and debuffs move it, while Palworld shows a number the player cannot influence and drew accusations of lying. Here the player moves it two ways: by spending more, and by hurting the target.

---

## 3. Failure

Obols spent on a failed attempt are consumed, and the attempt costs the acting creature's turn.

The survey's clearest single finding is that whether the resource survives failure matters more than the odds do — World of Final Fantasy, Monster Sanctuary and Tactics Ogre all read as deterministic despite being probabilistic, purely because retries are free. If a failed capture refunded, the player would spend the minimum repeatedly and the threshold would stop meaning anything.

**Auto-combat interaction.** Capture is available to AUTO through a standing capture policy — see §10.

---

## 4. Duplicates

A capture of a species the player already owns grants **invested Essence to that species' line** rather than a creature.

```
essenceGrant(floor) = round(DUP_ESSENCE_BASE × floor ^ OBOL_REWARD_EXPONENT)
```

Applied as `essenceInvested` on the recipient, with `permanentLevel` recomputed through the existing `levelFromEssence` path so the Leveler invariant holds.

**Eligibility.** The line qualifies only if a member of that species is in the Creature Box or the active party. A species whose only member is a capture sitting in the run inventory does not qualify — so the first capture of a species gives you the creature, and subsequent ones feed the line.

**Why this needs no anti-abuse machinery.** Three existing systems bound it:

- The grant is **invested, not liquid.** It cannot be redirected to whatever the player is optimising. Farming shallow duplicates of one species only ever pumps that species.
- **`levelCap` from stars is a hard ceiling.** Once a line is capped, further investment is inert.
- **The level cost curve is convex** (`10·L^1.5`), so a fixed grant is automatically trivial at high level. A grant worth 5% of a level at level 3 is worth 0.2% at level 25 with no rule written. Scaling the grant by capture depth — deep captures stay meaningful, shallow ones fade — is the only lever needed on top.

**The one case to check against the model:** early game, at low level, a shallow duplicate is worth the most it will ever be worth. Farming floors 1–3 could out-earn banking for the first few levels. It is self-correcting, but `DUP_ESSENCE_BASE` should be picked by checking that crossover rather than by feel.

---

## 5. Arrival state — a capture is cargo

A capture is created by the existing `createCreatureInstance(speciesId, 0)`: level 1, `starRating` 0, `levelCap` 5, `essenceInvested` 0. It **cannot be fielded** — not in the battle it was caught in, and not later in the run.

This is deliberate and it keeps two invariants intact. The Leveler invariant (`essenceInvested == cumulative cost of permanentLevel`) would break if captures arrived above level 1 without credited Essence, and the amount is not decorative — a capture arriving at level 20 would represent about 6,700 Essence of free investment, roughly eight full descents. Handing that out for an Obol spend would make capture strictly better than the Leveler.

So a capture's value is entirely downstream: a species for the collection, breeding stock, and a body to invest Essence into later. Its immediate combat value is zero by design.

`tower-structure.md:115` already applies the same rule to variants — captured variants revert to base stats and unlock the colour option rather than arriving strong.

**This supersedes the GDD's former mid-run substitution rule**, which assumed captures arrived strong enough to fight. That rule is removed from `game-design-document.md`; `combat-system.md:29` still describes a Swap action that pulls captured creatures from inventory and needs the same correction.

---

## 6. The Creature Box and the pending queue

`creatureBox` is currently an unbounded array, so capacity is new state rather than a tuning change.

On a successful exit, each captured creature moves to the Box if there is room. If the Box is full, the capture stays in the inventory until room frees, and moves across automatically the next time it can. Box space is freed by the release mechanic and by Essence-purchased capacity expansion.

That is the whole rule. This is storage, not a pressure system — the failure mode to avoid is the player being nagged or losing things to bookkeeping, not the player having it too easy.

---

## 7. Architecture

Decision logic is pure and testable; the scene owns turn driving and presentation, matching the split `TacticsAI` already uses.

```
src/systems/Capture.ts       — pure: captureThreshold, captureChance, essenceGrant, captureIntent
src/scenes/CombatScene.ts    — the capture action, spend UI, live percentage, turn consumption
src/managers/GameState.ts    — Box capacity, pending-capture queue, line-investment application
```

`Capture.ts` never mutates state and never consumes RNG — it returns numbers, and `CombatScene` rolls. This preserves the invariant the auto-combat spec relies on, that nothing outside the scene can desync the combat RNG stream.

---

## 8. Data model & persistence

**New on `CreatureTemplate`:**
- `captureThreshold: number` — base Obol threshold. `0` means uncapturable in the wild.

**New on `GameState` (persisted, save version 3 → 4):**
- `creatureBoxCapacity: number`
- `pendingCaptures: CreatureInstance[]` — captures waiting for Box room
- `capturePolicy: CapturePolicyId` — defaults to `'unowned'`

**Migration from v3:** default `creatureBoxCapacity` to a value at or above the existing `creatureBox.length` so no save is retroactively over capacity, `pendingCaptures` to `[]`, and `capturePolicy` to `'unowned'`.

`RunState.capturedCreatures` already exists and is unchanged. Runs are not persisted, so nothing about in-run capture state needs migrating.

---

## 9. Open questions

1. **Which line member receives the grant?** Applying it to every owned instance of the species would multiply the reward by ownership count, which is farmable. Applying it once to the lowest-`permanentLevel` member pulls up the weakest and does not scale with ownership — proposed, but not yet decided.
2. **`DUP_ESSENCE_BASE`** — pick against the early-game crossover in §4, not by feel.
3. **Starting Box capacity and Quartermaster pricing**, and whether Box capacity and backpack capacity are one purchase or two.
4. **The release mechanic** — out of scope here, but the Box-full rule leans on it existing.
5. **Does the capture policy persist across runs or reset?** See §10.2.
6. **The Obol reserve floor** for auto-capture — a fixed fraction, an explicit player setting, or a constant. See §10.4.

---

## 10. Auto-capture policy

Auto-combat is a strategic layer, not a skip button — the decision is made *between* fights. Capture follows the same shape: the player sets a standing capture policy, and AUTO executes it.

### 10.1 The policies

| Id | Label | Fires on |
|---|---|---|
| `never` | Don't Capture | nothing |
| `unowned` | New Species Only | a species with no member in the Box, party, or pending queue |
| `shiny_only` | Variants Only | a variant-skinned target, owned or not |
| `unowned_or_shiny` | New or Variant | either of the above |
| `always` | Capture Anything | any capturable target, duplicates included |

Ordered narrow to broad, mirroring `TACTIC_ORDER`. `always` is the policy that deliberately farms the §4 Essence grant; `unowned` is the collection-completion policy and is the sensible default.

**`unowned` must not read `seenSpecies`.** That set tracks species *met*, which is what the auto-combat fog needs and the Monsterpedia displays. The capture predicate needs species *owned* — derived from `creatureBox`, the active party, and `pendingCaptures`. The two are easy to confuse because `seenSpecies` is already sitting there and would compile.

**The two variant policies are inert until variants exist.** Nothing in `src/` implements variants or shinies, and `creature-roster-and-generation.md:248` has them appearing in the wild only after a species has been bred. Ship `never` / `unowned` / `always` first; add the variant policies alongside the variant system. Monsterpedia variant tracking (listed as not-designed in that spec's §7) becomes a dependency at that point.

### 10.2 Where the policy lives

On `GameState`, persisted, like `battleSpeed` — not per-creature and not per-run.

Per-creature was considered and rejected. Tactics are per-creature because each creature *fights* differently; a capture policy expresses what the player wants out of the descent, not how a creature behaves. Per-creature would imply a designated-catcher role, which is complexity with no payoff.

Whether it should reset per run like `RunState.autoCombat`, or persist like `battleSpeed`, is open — persisting matches its "standing preference" character, but a player who set `always` for an Essence-farming run may not want it still on next descent.

### 10.3 Architecture — a gate in front of the AI, not inside it

```ts
export type CaptureIntent = { target: CombatCreature; obols: number } | null;

export function captureIntent(
  actor: CombatCreature,
  foes: CombatCreature[],
  allies: CombatCreature[],
  policy: CapturePolicyId,
  ctx: {
    floor: number;
    obolsAvailable: number;
    obolReserve: number;
    ownedSpecies: ReadonlySet<string>;
  },
): CaptureIntent
```

Pure: no mutation, no RNG, same contract as `TacticsAI.chooseAction`. On an auto player turn `CombatScene` calls `captureIntent` first; a non-null result becomes the turn's action, and null falls through to `chooseAction` as today.

**Why not a new `CombatAction` variant inside `chooseAction`.** That function is deliberately side-agnostic — it takes only `(actor, allies, foes, profile, known)` and never knows which side it serves, which is what lets one module drive both parties. Capture is player-only and needs player-only state: the run's Obol balance, the Box contents, the policy. Threading that through would either force enemy-side nulls into the signature or leak player state into a module built not to have it. A separate gate keeps both modules clean and keeps `chooseAction`'s determinism guarantee intact.

### 10.4 The rule ladder

Explicit and ordered, in the same style as the tactic ladders — a player must be able to predict what it will do and explain a surprising action afterwards.

1. Policy is `never` → no capture.
2. Target's species threshold is `0` (uncapturable) → no capture.
3. Target does not match the policy predicate → no capture.
4. **Any ally is knocked out, or any ally is below one third HP** → no capture. Don't spend a turn shopping while the party is dying.
5. **More than one foe still alive** → no capture.
6. `obolsAvailable − captureThreshold(target) < obolReserve` → no capture.
7. Otherwise → capture, spending exactly `captureThreshold(target)`.

**Rule 5 is the load-bearing one.** Restricting auto-capture to the last living foe means it fires at the natural end of a fight, when no other enemy gets a free turn out of it — and it composes with the existing rule that single-target attacks auto-target when one enemy remains. It also means the target has usually been worn down by then, so `hpMult` sits near its 1× floor and auto-capture is naturally close to its cheapest.

**Rule 7: AUTO always buys the guarantee, never gambles.** Legibility beats cleverness. An AI that gambles the player's Obols produces losses that can't be explained after the fact, which is exactly what the auto-combat spec's guiding principle rules out. If the guarantee isn't affordable within the reserve, AUTO skips rather than taking a partial shot — the player can still gamble manually.

`obolReserve` is what stops a policy from leaving the player broke at floor 28. Its form is open (§9).

---

## 11. Explicitly rejected

- **Undisclosed pity rules.** Palworld suppresses the first capture failure at ≤30% HP or ≥50% rate; it makes the shake animation a dishonest readout and players noticed.
- **Hidden rates with no failure feedback** (Yo-kai Watch). A failed roll is indistinguishable from having done nothing; reviewers reported 49 of 200+ befriended after 30 hours.
- **A fixed per-species rate that ignores player investment** (Ni no Kuni). The canonical example of capture that responds to nothing the player does.
- **A permanently scarce guaranteed-capture item** (Master Ball). Players hoard it and it changes nothing. A reachable price does the same job without the trap.
