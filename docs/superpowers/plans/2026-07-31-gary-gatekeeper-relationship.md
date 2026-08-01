# Gary the Gatekeeper Relationship — Implementation Plan

**Goal:** Ship the reusable relationship framework and Gary stages 1–3 under the current
20-floor alpha, while leaving stages 4–5 fully specified for the expanded tower.

**Architecture:** Persistent relationship progress and the last completed run live on
`GameStateManager`. A pure `Relationships` module owns eligibility and atomic completion.
One reusable `DialogueScene` presents authored events. Town and tower scenes only route
into that layer. Combat-backed story encounters use stable `storyEventId` values and
queue their town follow-ups after victory.

**Tech stack:** TypeScript, Phaser 3, Vite, vitest.

**Source spec:**
`docs/superpowers/specs/2026-07-31-gary-gatekeeper-relationship-design.md`

## Implementation status — 2026-07-31

The alpha implementation is complete. It includes player naming, persisted generic
relationship state, authored Gary dialogue, the floor-15+ shortsword combat payload,
10–40 Essence assistance every 2–5 returns, the 10% deep-start fee discount, and
generic run-long `max_hp_flat` relic support for Gary's +10/+20 Gift. Stage 4, stage 5,
and the future `gary_garrette_boss` event hook are implemented in state/content but are
not naturally reachable under the 20-floor cap. Garrette's actual combat definition
and character visuals remain intentionally unimplemented.

## Global constraints

- Preserve Gary's five authored stages; do not add affinity points, gifts, schedules,
  or decay.
- Stage completion and reward claims are idempotent.
- Keep `TALK TO GARY` separate from the depth-jump service.
- Story evidence is persistent state, never backpack cargo.
- Inject RNG into pure relationship/reward functions; do not call `Math.random()` inside
  them.
- The alpha save policy is discard-on-mismatch. Bump `SAVE_VERSION`; add no migration.
- Unspecified relationship numbers are tuning constants. Tests must pin the settled
  2–5-return, 10–40-Essence boundaries and +10/+20 `Gary's Gift` values; placeholder
  boon and discount numbers are tested by relationships rather than magic values.
- Stages 4–5 are not reachable in normal play until the tower extends past floor 20.
- Update `window.render_game_to_text` for every new player-facing state.
- Use the existing shared UI primitives in `src/ui/Theme.ts`.

---

## Task 1 — Persistent relationship and run-summary state

**Files:**

- Modify `src/types.ts`
- Modify `src/managers/GameState.ts`
- Modify `src/managers/GameState.test.ts`
- Modify `src/scenes/RunScene.ts`

**Work:**

- [ ] Add `RelationshipProgress`, `ScheduledRelationshipReward`, `RunOutcome`, and
  `LastRunSummary`.
- [ ] Add `relationships`, `pendingStoryEvents`, `lastRunSummary`, and `homecomings` to
  `GameStateManager`.
- [ ] Initialize them on a new game.
- [ ] Include them in `saveToLocalStorage` and `loadFromLocalStorage`.
- [ ] Bump `SAVE_VERSION`.
- [ ] Capture `LastRunSummary` before `endRun()` clears `currentRun`.
- [ ] Preserve the party instance IDs from the completed run for later health rewards.

**Tests:**

- [ ] Fresh games receive empty relationship state and no last-run summary.
- [ ] All new fields round-trip through save/load.
- [ ] Mismatched save versions are discarded under the existing policy.
- [ ] Cleared, fled, and wiped runs create the correct summary.
- [ ] Ending a run increments `homecomings` exactly once.

---

## Task 2 — Pure relationship definitions and resolver

**Files:**

- Create `src/data/relationships.ts`
- Create `src/data/dialogue/gary.ts`
- Create `src/systems/Relationships.ts`
- Create `src/systems/Relationships.test.ts`

**Work:**

- [ ] Define Gary and the six stable event IDs from the source spec.
- [ ] Represent event requirements and effects as typed data.
- [ ] Implement `relationshipFor`, `eligibleTownEvents`,
  `hasCompletedRelationshipEvent`, and `completeRelationshipEvent`.
- [ ] Make completion atomic and idempotent.
- [ ] Support conditional dialogue branches based on `LastRunSummary.outcome`.
- [ ] Keep dialogue text separate from Phaser scene code.

**Tests:**

- [ ] Gary's intro is eligible only at stage 0.
- [ ] Old Passages requires stage 1 and a cleared floor-5 break.
- [ ] Shortsword Return requires its evidence flag.
- [ ] Stage 4 accepts all three run outcomes once floor 40 has been reached.
- [ ] Stage 5 requires the Garrette victory flag.
- [ ] Completing any event twice applies its effects and rewards once.
- [ ] Events cannot skip required stages.

---

## Task 3 — Reusable dialogue scene

**Files:**

- Create `src/scenes/DialogueScene.ts`
- Modify `src/main.ts`
- Modify `src/main.ts` text-state renderer

**Work:**

- [ ] Register `DialogueScene`.
- [ ] Render speaker name, portrait/sprite plate, body text, and 1–3 choices.
- [ ] Support keyboard and pointer navigation.
- [ ] Resolve the event only when its concluding node is confirmed.
- [ ] Save immediately after resolution.
- [ ] Return to a caller-supplied scene (`TownScene`, `GatekeeperScene`, or `RunScene`).
- [ ] Expose active event ID, node ID, choice labels, and selection in
  `render_game_to_text`.

**Verification:**

- [ ] A test-only route can open each Gary event without mutating prerequisites.
- [ ] Reopening a completed event cannot reapply it.
- [ ] ESC behavior is explicit: either advance/close when safe or remain disabled during
  an unresolved consequential choice.

---

## Task 4 — First-town introduction and tower gate

**Files:**

- Modify `src/scenes/TownScene.ts`
- Modify `src/scenes/BootScene.ts` if required for first-arrival routing
- Modify `src/data/dialogue/gary.ts`

**Work:**

- [ ] On the first town arrival, route once into `gary_01_gate`.
- [ ] Keep tower entry unavailable until the event concludes.
- [ ] Complete stage 1 and return to the town map.
- [ ] Show Gary's name on the Gatekeeper location after introduction.
- [ ] Ensure dialogue choices cannot refuse or break the critical path.

**Verification:**

- [ ] New game -> Gary intro -> Town -> Departure works end-to-end.
- [ ] Reloading after the intro does not replay it.
- [ ] Existing debug/test entry points can deliberately mark the intro complete.

---

## Task 5 — Gatekeeper talk/service hub and stage 2

**Files:**

- Modify `src/scenes/GatekeeperScene.ts`
- Modify `src/scenes/TownScene.ts`
- Modify `src/data/dialogue/gary.ts`

**Work:**

- [ ] Rebuild the Gatekeeper screen with `TALK TO GARY`, `DEPTH JUMPS`, and `TOWN`.
- [ ] Show `NEW` on the town tile and talk action when an event is pending.
- [ ] Keep depth-jump purchases available independently of pending dialogue.
- [ ] Queue `gary_02_old_passages` after the first return with
  `deepestBreakCleared >= 5`.
- [ ] Completing it advances Gary to stage 2 and opens the depth-jump view.
- [ ] Add stage-specific ambient lines when no event is pending.

**Verification:**

- [ ] Clearing floor 5 queues the event once.
- [ ] Buying a depth jump before or after talking cannot consume the story event.
- [ ] Pointer and keyboard flows can both reach talk, service, and town.

---

## Task 6 — Gary's deep-start boon

**Files:**

- Modify `src/scenes/RunScene.ts`
- Modify `src/data/boons.ts` only if a bespoke final boon is needed
- Modify `src/systems/Boons.test.ts`
- Add relationship integration tests in `src/systems/Relationships.test.ts`

**Work:**

- [ ] At run creation, query Gary's stage and chosen start floor.
- [ ] Grant no Gary boon at floor 1.
- [ ] Grant `warding_thread` or the tuned Gary boon on eligible deep starts.
- [ ] Use `grantBoon` so same-kind effects refresh rather than stack.
- [ ] Include the relationship source in the run-start presentation or boon summary.

**Tests:**

- [ ] Stage below the threshold grants nothing.
- [ ] Floor 1 grants nothing at every stage.
- [ ] An eligible deep start grants exactly one boon.
- [ ] Existing same-kind boons do not multiply.

---

## Task 7 — Combat-backed shortsword story encounter

**Files:**

- Modify `src/types.ts` (`Encounter.storyEventId?`)
- Modify `src/systems/RunGenerator.ts`
- Modify `src/systems/RunGenerator.test.ts`
- Modify `src/scenes/RunScene.ts`
- Modify `src/scenes/CombatScene.ts`
- Modify `src/scenes/PostCombatScene.ts` or add a small story continuation router

**Work:**

- [ ] Add optional `storyEventId` to encounters.
- [ ] Once Gary is at stage 2, inject `gary_03_shortsword_found` into a non-boss combat
  opportunity in the eligible floor band.
- [ ] Never replace a boss or the forced first encounter.
- [ ] Bound eligibility so RNG cannot withhold the encounter indefinitely.
- [ ] If the player passes it over, leave it eligible for a later offer/run.
- [ ] On victory, record `gary_garrette_shortsword` evidence before the run may wipe.
- [ ] Queue `gary_03_shortsword_return` for town.
- [ ] Continue through the normal post-combat reward and next-room flow.

**Tests:**

- [ ] The story encounter never appears before stage 2.
- [ ] It never occupies a boss floor.
- [ ] It appears within the configured bound.
- [ ] It stops appearing after the evidence is recorded.
- [ ] Evidence survives a later wipe.
- [ ] Encounter offers remain boss-aware.

---

## Task 8 — Stage 3 return and periodic Essence assistance

**Files:**

- Modify `src/data/dialogue/gary.ts`
- Modify `src/systems/Relationships.ts`
- Modify `src/managers/GameState.ts`
- Modify `src/scenes/GatekeeperScene.ts`

**Work:**

- [ ] Present the shortsword return scene on the next visit to Gary.
- [ ] Advance to stage 3 once.
- [ ] On reaching stage 3, schedule the first share with injected RNG: an inclusive
  **2–5 homecoming** countdown and an inclusive **10–40 Essence** stored amount.
- [ ] Decrement the countdown exactly once whenever a run returns to town, regardless
  of outcome.
- [ ] At zero, queue a short Gary interaction for the already-stored amount.
- [ ] Persist countdown and amount immediately so scene reloads cannot reroll either.
- [ ] Claiming the share awards the stored Essence exactly once, schedules the next
  independently rolled 2–5-return/10–40-Essence share, and saves.
- [ ] Add Gary's expedition dialogue and visual preparation changes.

**Tests:**

- [ ] The share cannot occur before stage 3.
- [ ] At most one share is pending.
- [ ] Generated intervals are always 2–5 inclusive.
- [ ] Generated amounts are always 10–40 inclusive.
- [ ] Both lower and upper RNG boundaries map correctly.
- [ ] Every run outcome decrements the return counter once; reopening town does not.
- [ ] Claiming cannot duplicate Essence.
- [ ] Reloading cannot change a previously decided outcome.

---

## Task 9 — Stage 4 floor-40 return and `Gary's Gift +10` (deferred content)

**Blocked in normal play by:** `TOWER_FLOORS === 20`.

**Files:**

- Modify `src/data/dialogue/gary.ts`
- Modify `src/systems/Relationships.ts`
- Modify `src/data/boons.ts`
- Modify `src/systems/Boons.ts`
- Modify `src/systems/Boons.test.ts`
- Modify `src/systems/CombatEngine.ts`
- Modify `src/scenes/RunScene.ts`
- Modify `src/scenes/CombatScene.ts`
- Modify `src/scenes/PostCombatScene.ts`
- Modify `src/systems/Recovery.ts`
- Modify `src/systems/Shop.ts`
- Modify `src/systems/Items.ts`

**Work:**

- [ ] Select wipe/flee/success opening from `LastRunSummary.outcome`.
- [ ] Record the player's reason-for-continuing dialogue flag.
- [ ] Add `max_hp_flat` to `BoonEffect` and a neutral-valued `maxHpBonus(active)` query.
- [ ] Allow a boon definition to use the run-long `battlesLeft: null` Relic shape.
- [ ] Define `garys_gift_10`: `Gary's Gift: +10 Health to all Creatures in Party`.
- [ ] Derive the gift from Gary's stage at run creation and add it to
  `RunState.activeBoons`; never mutate a `CreatureInstance`.
- [ ] Centralize effective run max HP as creature max HP plus `maxHpBonus(active)`.
- [ ] Use effective max HP during run initialization, combatant construction, level-up
  refresh, recovery, revival, healing services/items, HUD ratios, and post-combat UI.
- [ ] Keep `battlesLeft: null` gifts when ordinary timed boons tick after battle.
- [ ] Add stage-4 ambient reactions.

**Tests:**

- [ ] With no gift, max HP queries return the creature's normal value.
- [ ] Stage 4 starts every run with exactly +10 max HP for all party members.
- [ ] The gift lasts the full run and disappears when the run ends.
- [ ] The gift never modifies `statBaseline`, `currentStats`, or breeding output.
- [ ] Healing and recovery cap at the boosted maximum rather than the base maximum.
- [ ] Leveling during a run preserves the +10 bonus.

---

## Task 10 — Garrette floor-75 boss and completion (deferred content)

**Blocked in normal play by:** tower length and the lack of authored unique-boss
infrastructure.

**Files:**

- Add Garrette's enemy/boss data and any unique abilities
- Modify `src/systems/RunGenerator.ts`
- Modify `src/scenes/CombatScene.ts`
- Modify `src/data/dialogue/gary.ts`
- Modify `src/systems/Economy.ts`
- Modify `src/managers/GameState.ts`

**Work:**

- [ ] Replace the ordinary floor-75 mini-boss with Garrette once stage 4 is complete.
- [ ] Mark Garrette uncapturable.
- [ ] Record the victory and queue `gary_05_last_watch`.
- [ ] Define `garys_gift_20` and upgrade all later runs from +10 to +20 maximum HP for
  every active party member.
- [ ] Ensure the +20 gift replaces the +10 gift rather than stacking to +30.
- [ ] Apply Gary's future `depthUnlockCost` discount without refunding old purchases.
- [ ] Upgrade the deep-start boon.
- [ ] Add completed relationship dialogue and home/tamed-monster visual state.

**Tests:**

- [ ] Eligible floor 75 always contains Garrette.
- [ ] Garrette cannot appear early or randomly elsewhere.
- [ ] Garrette cannot be captured.
- [ ] Final rewards apply exactly once.
- [ ] Stage 5 runs receive +20 HP, not +10 or +30.
- [ ] Depth unlocks bought after completion are discounted; existing unlocks are not
  refunded; run fees are unchanged.

---

## Task 11 — Consolidated verification

- [ ] Run targeted relationship, run-summary, generator, boon, economy, and save tests.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run the standard Playwright client through new game -> Gary intro -> first descent
  -> floor-5 clear -> Gary stage 2 -> deep-start boon -> shortsword encounter -> return.
- [ ] Inspect every captured screenshot and `render_game_to_text` state.
- [ ] Confirm keyboard and pointer operation for dialogue, talk/service selection, and
  tower story encounters.
- [ ] Confirm no new console errors.
- [ ] Confirm a pending Gary conversation never blocks depth-jump purchases or departure.

## Recommended delivery boundary

The first production change should end after Task 6: framework, dialogue scene, Gary's
introduction, floor-5 event, Gatekeeper talk/service split, and the deep-start boon. It
is a complete vertical slice with low coupling.

Tasks 7–8 add the first combat-backed relationship quest after that foundation is stable.
Tasks 9–10 remain planned until their tower floors exist.
