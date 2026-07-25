# Auto-Combat & Tactics — Design Spec

**Date:** 2026-07-24
**Status:** Approved design, ready for implementation planning
**Scope:** Adds a Dragon Quest–style tactics layer so the player assigns a standing behavior to each creature and hands combat to the AI. Unifies player and enemy AI behind one decision module, adds a persistent seen-species memory, and adds a battle speed control.

---

## Guiding Principle

**Auto-combat is a strategic layer, not a skip button.** The player's decision is made *between* fights — which tactic each creature carries — and the payoff is watching a well-composed party clear an encounter without input. This framing drives three consequences that shape everything below:

1. **Legibility beats cleverness.** Each tactic is an explicit, ordered rule ladder, not a weight vector. A player must be able to predict what their tactic will do, and to explain a surprising action after the fact. An emergent utility-scoring AI would be more elegant and strictly worse for this goal.
2. **Tactics are a property of the creature**, persisting across runs, not a per-battle chore.
3. **The AI proposes; the scene disposes.** The AI is pure and returns an action. It never mutates combat state and never consumes RNG.

---

## 1. Decisions locked during design

| Question | Decision |
|---|---|
| Primary purpose | Strategic set-and-forget layer. AI quality and tactic differentiation are the priority. |
| Control model | Global AUTO toggle **plus** per-creature override. A creature on `follow_orders` still prompts manually while AUTO is on. |
| Enemy knowledge | Minimal persistent seen-species memory. Auto exploits weaknesses only on species already met. Blind on first encounter, per `combat-system.md`. |
| Tactic roster | The five in `combat-system.md`, unchanged. |
| Architecture | One unified `TacticsAI` module serving both sides, with explicit rule ladders. |
| Speed control | Included. A persistent 1× / 2× / 4× battle speed preference. |

---

## 2. Architecture: one AI, both sides

A single pure module, `src/systems/TacticsAI.ts`, written side-agnostically. It never says "player" or "enemy" — only "the actor, its own side, the opposing side":

```ts
export function chooseAction(
  actor: CombatCreature,
  allies: CombatCreature[],   // actor's own side, including actor
  foes: CombatCreature[],     // the opposing side
  profile: TacticProfile,     // 'fight_wisely' | 'all_out' | 'conserve_mp' | 'heal_first' | 'enemy_default'
  known: KnownSpecies,        // species whose weaknesses this side may exploit
): CombatAction

export type CombatAction =
  | { kind: 'ability'; abilityId: string; target: CombatCreature }
  | { kind: 'defend' };
```

`CombatScene` remains the only thing that drives turns. On an enemy turn it calls `chooseAction(enemy, enemyParty, playerParty, profileFor(enemy), NO_KNOWLEDGE)`. On an auto player turn it calls `chooseAction(creature, playerParty, enemyParty, creature.tactic, gameState.seenSpecies)`. Both return the same shape and run through the same execution path. `getEnemyAction` in `CombatEngine.ts` becomes a thin wrapper or is deleted.

Three distinct ownership questions, kept separate:

- **Decision logic** — `TacticsAI`, shared by both sides.
- **Turn driving** — `CombatScene`, unchanged.
- **Profile assignment** — player creatures carry a player-chosen tactic; enemies get theirs from data. Default `enemy_default` for everything, with an optional `aiProfile?` field on `CreatureTemplate` so a boss can opt into something sharper later without touching AI code.

### Asymmetries enforced by inputs, not by branching

- **Knowledge.** Player creatures receive the seen-species set; enemies receive an empty one, so they never exploit weaknesses. This reproduces current behavior exactly, and a boss could later be made cunning by handing it a populated set — a data change, not a code change.
- **Crits.** Already player-only inside `calculateDamage`. The AI has no part in it.

### Why not keep enemy AI separate

Leaving `getEnemyAction` alone would eliminate any risk of shifting enemy balance, at the cost of two AIs that drift apart and enemies that permanently keep their current blind spots. The same safety is available more cheaply: `enemy_default` is a literal port of the current ladder, pinned by a characterization test written *before* the merge. Enemies get smarter only if we later decide they should, as a deliberate tuning pass.

---

## 3. Data model & persistence

**Tactic lives on the creature.** `CreatureInstance` gains `tactic: TacticId`, defaulting to `'fight_wisely'`. It is a persistent property like abilities or traits — set it once, and that creature descends with it forever.

> **Two distinct types, deliberately.** `TacticId` is what the *player* can assign — the five in `combat-system.md`, including `'follow_orders'`. `TacticProfile` is what the *AI* can execute — the four thinking tactics plus `'enemy_default'`, and it excludes `'follow_orders'` because that value means "do not call the AI." The scene is responsible for the narrowing, and the type system enforces that `chooseAction` can never be handed `'follow_orders'`.

**AUTO toggle lives on the run.** `RunState` gains `autoCombat: boolean`, defaulting off, persisting across encounters within a descent so it need not be re-enabled every floor. Resets to off on a new run.

**Seen-species memory is global.** `GameState` gains `seenSpecies: Set<string>`, populated in `initBattle` the moment an encounter is generated — the player has *met* the species whether or not they win. Persists across runs; losing it on a wipe would only be annoying.

**Battle speed is a global preference.** `GameState` gains `battleSpeed: 1 | 2 | 4`, defaulting to `1`. Persists across runs like any settings value.

**Save migration — v2 → v3.** All three additions are additive with safe defaults: `tactic` defaults to `'fight_wisely'` on any creature lacking it, `seenSpecies` to empty, `battleSpeed` to `1`.

> **Known consequence:** a blank `seenSpecies` on migration means auto-combat plays blind against all 36 creatures on an existing save until each is met again. This is the correct semantic — we genuinely do not know what has been fought — and it self-corrects within a run or two, but auto will look dumber than it is immediately after the update.

---

## 4. Shared helpers

Two helpers do the heavy lifting so the ladders stay short.

**`estimateDamage(actor, foe, ability, known)`** — a deterministic expected-damage figure: the existing formula multiplied by accuracy, with no RNG. This requires refactoring `calculateDamage` (`CombatEngine.ts`) into a pure core plus the hit and crit rolls layered on top. **The AI must not call `calculateDamage`** — doing so would consume RNG and roll phantom misses while merely thinking.

It applies the type multiplier **only if the foe's species is in `known`**. This is where the fog lives, and it means weakness-seeking falls out of the arithmetic — no tactic needs an explicit "target weaknesses" rule.

**`bestTarget(actor, foes, known)` / `killable(actor, foes, known)`** — highest expected damage, tie-broken toward the lowest-HP foe so kills get finished.

---

## 5. Tactic ladders

First matching rule wins. "Affordable" means `mpCost <= currentMp`.

**"Reaching heal"** means a heal whose targeting can reach the intended recipient. Resolving this precisely, since the two existing heals differ:

- `mend` (`targeting: 'self'`) reaches **only the actor**.
- `soothe` (`targeting: 'single_ally'`) reaches **any living ally including the actor** — a creature may soothe itself.

So a rule like "an ally at ≤30% HP" scans the actor's whole side, self included, and then filters to heals that can actually reach the chosen recipient. A creature holding only `mend` will therefore ignore a dying teammate and is expected to; that is a roster limitation, not an AI bug.

Where a ladder rule names a threshold, HP is compared as a **fraction of max HP**, not an absolute value.

### Fight Wisely — balanced and efficient
1. An ally (including self) is at ≤30% HP and the actor has an affordable reaching heal → heal the lowest.
2. A foe is killable this turn → use the **cheapest** ability that still kills.
3. Two or more foes alive and an affordable `all_enemies` ability's total expected damage exceeds the best single-target hit → use it.
4. Otherwise → best expected damage per MP, treating 0-MP abilities as cost 1 so basic attack competes without dividing by zero.
5. Out of MP → basic attack.

### All Out — maximum damage, MP ignored
1. A foe is killable → the **highest-damage** option against it.
2. Otherwise → highest raw expected damage available, cost disregarded entirely. `all_enemies` included when its total exceeds the best single hit.
3. Out of MP → basic attack.

Never heals, buffs, or defends.

### Conserve MP — basic attack by default, spend only under pressure
1. Self at ≤35% HP with an affordable self-heal → heal.
2. An ally at ≤25% HP with `soothe` affordable → heal them. Emergencies beat thrift.
3. Basic attack kills a foe → basic attack.
4. **Only if any ally is at ≤50% HP** → the cheapest ability that kills a foe; failing that, the best damage-per-MP ability costing no more than ⅓ of max MP.
5. Otherwise → basic attack.

Rule 4's gate is what keeps this tactic faithful to "only uses abilities when HP is threatened." Without it, Conserve MP would quietly become a strictly-better Fight Wisely.

### Heal First — healing and support, damage last
1. An ally at ≤60% HP with an affordable reaching heal → heal the lowest.
2. Nobody hurt and an affordable self-buff is below +2 stages → cast it.
3. An affordable debuff exists and the strongest foe is not already at −2 on that stat → cast it.
4. Otherwise → best damage per MP — **but** if remaining MP is less than twice its cheapest heal, hold reserve and basic-attack instead.
5. Basic attack.

Rules 2 and 3 are where the five self-buffs and two debuffs finally get an AI home. Under every other tactic they are dominated by damage, which is correct — they are support tools.

### Follow Orders
Not an AI profile. `chooseAction` is never called; the scene shows the manual menu even while AUTO is on.

### enemy_default
Random living foe; strongest affordable non-Status ability by raw `power`; else basic attack. A literal port of the existing `getEnemyAction`, deliberately dumb, pinned by a characterization test.

---

## 6. Known content gap: Heal First is thin

Only 4 of 36 creatures have any heal, and all four are Flora:

| Creature | Heal | Reach |
|---|---|---|
| Petalward | `soothe` | Cross-ally |
| Mossgolem | `soothe` | Cross-ally |
| Thornvine | `mend` | Self only |
| Bloomwarden | `mend` | Self only |

So Heal First does something genuinely interesting on two creatures, something modest on two more, and on the remaining 32 it degrades straight to its buff, debuff, and damage rules. The ladder is written to degrade gracefully, so this is not a reason to cut the tactic — but it will not feel like it earns its slot until the ability roster grows past its current 31. This is a content problem, not a design problem, and it resolves as abilities are added toward the 72 in `Abilities.csv`.

---

## 7. No tactic defends

No ladder includes a Defend rule. Defending trades a full action for half damage on a single hit, which is nearly always worse than attacking. The narrow case where it is correct — no MP, HP ≤20%, no foe killable — is rare enough that shipping without it beats having players watch a creature "waste" a turn and conclude the AI is broken.

`CombatAction` still models `{ kind: 'defend' }` so the option is reachable without a type change if playtest disagrees.

---

## 8. Prerequisite fix: ally targeting

`CombatScene` currently hard-codes `single_ally` abilities to target self, with a `// For now, self-heal` comment. **This is a real bug in manual play** — `soothe` cannot currently heal anyone but its caster — and it makes Heal First meaningless.

Fix it first, as a standalone change before any AI code: add `showAllyTargetSelection` mirroring the existing `showTargetSelection`, including the same auto-target shortcut when only one ally is alive. The AI then has a working action to emit.

---

## 9. Battle speed control

**Setting:** `battleSpeed: 1 | 2 | 4`, persisted globally, default `1`.

**Mechanism:** `CombatScene` currently hard-codes its pacing delays inline — roughly 800 ms after an action resolves, 400 ms after a turn finishes, 1000 ms on a status-skip message. Extract these to named constants and divide each by `battleSpeed` at call time, with a **100 ms floor** so tweens and message rendering cannot collapse into an unreadable frame.

**Scope:** speed scales *all* combat pacing, not just auto turns. Manual turns block on player input anyway, so in practice the setting governs auto turns and enemy turns — but applying it uniformly avoids a jarring tempo change when a `follow_orders` creature's turn arrives mid-battle.

**UI:** a cycling `SPEED 1×/2×/4×` button in the battle HUD beside the AUTO toggle, available at all times.

**Accepted trade-off:** at 4× the message log turns over faster than it can be read. That is the explicit purpose of the setting — the player choosing 4× has decided they are no longer reading. The default stays 1× precisely because reading the log is how a player evaluates whether their tactics are working, which is the core loop of this feature.

---

## 10. Scene wiring & UI

**Turn dispatch.** In `nextTurn`: if the actor is player-owned **and** `run.autoCombat` **and** its tactic is not `follow_orders`, ask the AI and execute after a short beat; otherwise show the manual menu. Everything downstream is unchanged.

**Execution.** The AI returns a `CombatAction`; the scene runs it through `executePlayerAction` — the exact path a click takes. One execution path means auto and manual cannot diverge in their effects.

**Three UI touchpoints:**
- **AUTO toggle** — persistent button in the battle HUD, live during both manual menus and AI turns, so control can be seized mid-fight. A matching toggle in `RunScene`, per `combat-system.md`'s "during battle or from the map overview."
- **Tactic assignment** — in `PartySelectScene`, cycling through the five per creature. A between-runs decision, matching the set-and-forget framing.
- **Tactic readout** — each creature's tactic shown beside its name in the battle HUD, so a surprising AI action can be traced to the ladder that produced it.

**Deliberately out of scope this pass:** mid-battle tactic switching. It contradicts set-and-forget, and the AUTO toggle already covers the "take back control now" need. Easy to add if playtest disagrees.

**Unchanged:** the post-victory reward choice still prompts under AUTO. Auto covers combat only; `combat-system.md` is explicit that the player continues to "make strategic decisions between battle."

---

## 11. Ride-along cleanup

`CombatScene.ts` is 572 lines and already the largest file in the project; this feature adds roughly 110 more between the toggle UI, the speed button, ally target selection, and the AI branch.

Extract `drawBattlefield` and `drawCreature` — about 100 lines of pure rendering with no state dependencies — into `src/scenes/combat/BattlefieldRenderer.ts`. Low risk, keeps the scene under 600 lines after the feature, and touches no combat logic.

No other refactoring. Everything else in `CombatScene` stays where it is.

---

## 12. Test plan

`TacticsAI` is pure functions over plain data, so it tests under vitest with no Phaser involvement.

**Ladder coverage** — one test per rung per tactic: a fixture party in a state that should trip exactly that rung, asserting the returned action. Roughly 20 cases. Each test must also assert that *earlier* rungs did not fire, or a bug that makes rule 1 always match would pass every test below it.

**Fog** — the same board evaluated with the foe's species known versus unknown, asserting the weakness-exploiting choice appears only when known.

**Reserve behavior** — Heal First holds MP once below twice its cheapest heal; Conserve MP declines to spend above its ⅓-max-MP threshold while the party is healthy.

**Determinism** — `chooseAction` called twice on an identical board returns an identical action and consumes no RNG. This is what guarantees the AI cannot desync the combat RNG stream.

**Characterization test for `enemy_default`** — under a seeded RNG, assert it produces identical choices to today's `getEnemyAction` across a spread of boards. Written **before** the code paths merge. This is the safety net for the whole unification.

**Persistence** — `seenSpecies` and `battleSpeed` survive save and load; a v2 save migrates with the default tactic, an empty bestiary, and 1× speed.

**Speed** — delay scaling produces the expected values at 1×, 2×, and 4×, and never returns below the 100 ms floor.

---

## 13. Implementation order

1. Ally targeting fix (standalone bug fix, manual play only).
2. `BattlefieldRenderer` extraction (no behavior change).
3. Characterization test pinning current `getEnemyAction` behavior.
4. `estimateDamage` refactor out of `calculateDamage`.
5. `TacticsAI` module with all five profiles plus `enemy_default`, fully unit-tested.
6. Data model, save v3 migration, `seenSpecies` recording.
7. Scene wiring, AUTO toggle, tactic readout, `PartySelectScene` assignment.
8. Battle speed constants, scaling, and HUD button.

Steps 1–4 are safe preparatory work that ships no behavior change beyond the ally-targeting bug fix.

---

## 14. Open questions for playtest

- Do the ladders differentiate enough in practice, or do Fight Wisely and Conserve MP converge once MP costs are this low after the ~40% cut?
- Is the ≤30% / ≤25% / ≤60% heal-threshold spread right, or does Heal First over-heal?
- Should any tactic defend after all?
- Should `enemy_default` stay dumb, or do enemies need the knowledge set at deeper floors to keep pressure up?
- Does 4× need a 8× sibling, or does the 100 ms floor make higher multipliers meaningless?
