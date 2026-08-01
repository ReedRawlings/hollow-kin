# Gary the Gatekeeper Relationship — Design Spec

**Date:** 2026-07-31  
**Status:** Implemented for the alpha; Garrette's combat definition and visual assets remain open  
**Scope:** The reusable relationship foundation plus Gary's five-stage arc  
**Source:** Character and arc developed in conversation on 2026-07-31

## What this spec covers

Gary is the first complete village relationship and the vertical slice for the
relationship framework. The feature connects town dialogue to facts produced by
ordinary tower play. It does not use daily upkeep, repeatable gifts, or an affinity
grind.

The intended loop is:

```
meet Gary
  -> progress through the tower
  -> encounter evidence or reach a meaningful threshold
  -> return to town
  -> Gary reacts and the relationship advances
  -> Gary's help changes later descents
```

Gary must remain available as the depth-jump vendor throughout the arc. A pending
conversation may be highlighted, but it may never prevent the player from using his
service.

## Character contract

### Gary

Gary built and maintains the gates that protect the village from monsters emerging
from the tower. He was once an adventurer. He retired when his son, Garrette, was born
and devoted himself to raising him and maintaining the village's defenses.

Garrette later followed the same call to adventure and disappeared inside the tower.
By then Gary believed he was too old to search the dangerous depths alone. He has lived
for years between two incompatible hopes: that Garrette is still alive, and that no one
else should be allowed to follow him.

- **Tone reference:** the warmth, capability, grief, and humor of Uncle Iroh from
  *Avatar: The Last Airbender*. This is a tonal reference, not a character blueprint.
- **Fears:** losing the player to the tower; failing to hold the gates; seeing the
  village become wholly abandoned.
- **Goals:** learn what happened to Garrette; keep the player safe; keep the village
  alive; ultimately see the tower defeated.
- **Contradiction:** Gary wants the tower cleansed but cannot bear the possibility that
  the player will pay the same price as his son.
- **Arc:** protective guide -> fearful would-be controller -> active collaborator who
  accepts the player's agency.
- **Gameplay identity:** safe passage, 10% cheaper deep-start fees, occasional
  expedition proceeds, and the run-long relic `Gary's Gift`.

Gary initially stays at the gate because he cannot survive an unrestricted solo
descent. Once the player repairs and proves the old passages, he begins making limited
forays through already-secured routes. At higher stages he may travel with a tamed
monster. He does not independently push the unexplored frontier ahead of the player.

### Garrette

Garrette was an affable young adventurer who inherited Gary's adventurous spirit. He
wanted to cleanse the tower so the village could return to its former glory. He reached
floor 75, where a Warden defeated him. His reanimated remains now haunt the tower.

Garrette must become recognizable through the keepsakes and Gary's memories before the
floor-75 encounter. Those scenes should establish at least one personal habit, one
relationship outside Gary, and why he continued when retreat remained possible. The
floor-75 enemy is explicitly Garrette's reanimated corpse or ghost, not a living man the
player unknowingly kills.

## Non-negotiable relationship rules

- No relationship decay.
- No repeatable talk requirement.
- No generic gifts or gift preferences.
- No hidden affinity-point grind. Gary advances through authored events.
- Required evidence cannot be permanently missed or lost to backpack wipe rules.
- A relationship conversation cannot block depth-jump purchases.
- No required stage depends on the player wiping. A wipe changes dialogue, not
  eligibility.
- Completed stages never replay and their rewards can never be claimed twice.
- Gary continues receiving reactive dialogue after stage 5.

## The five-stage arc

### Stage 1 — The Gate

**Trigger:** first arrival in town on a new game.  
**Location:** town gate.  
**Purpose:** introduce Gary, relationships, and the tower.

Gary opens the gate, explains that he built it to contain the creatures below, and
mentions that he used to descend himself. This is a short, automatic relationship
tutorial. Dialogue choices may establish tone but cannot prevent progression.

**Effects:**

- Set relationship stage to 1.
- Open the tower entrance.
- Add Gary's baseline town and Gatekeeper service dialogue.

### Stage 2 — The Old Passages

**Trigger:** return to town after clearing the floor-5 mini-boss.  
**Location:** Gatekeeper.  
**Purpose:** reveal Gary's history and connect him to the depth-jump system.

Gary explains that he built hidden passages during his adventuring years, but they have
fallen into disrepair. He also reveals that he retired when Garrette was born.

**Effects:**

- Set relationship stage to 2.
- Unlock the existing depth-jump purchasing service.
- Deep runs begun through a purchased passage cost 10% less Essence.
- Add dialogue about repaired passages and the player's choice of starting depth.

### Stage 3 — The Engraved Shortsword

**Trigger:** after stage 2, inject the authored shortsword encounter into an eligible
non-boss tower floor at 15 or deeper. Its exact floor may vary. One room is injected
per eligible run and the event remains eligible on later runs if previously passed over.  
**Location:** tower combat followed by a town conversation.  
**Purpose:** reveal Garrette and turn Gary from observer into collaborator.

A tough monster pack carries a shortsword engraved with Garrette's mark. Defeating the
pack records the shortsword as relationship evidence. The evidence is a permanent story
flag, not a backpack entry, and therefore cannot be lost on a wipe.

On the next return, Gary identifies the blade and tells the player about Garrette. He
asks the player to look for further evidence. The repaired routes now allow Gary to make
limited excursions through depths the player has already secured.

**Effects:**

- Record `gary_garrette_shortsword` evidence.
- Queue `gary_03_shortsword_return` for the next town visit.
- Set relationship stage to 3 after that conversation.
- Activate Gary's periodic Essence-sharing event.
- Add visual and dialogue evidence of Gary preparing for limited expeditions.

### Stage 4 — Another Path

**Trigger:** the first completed run after stage 3 that reaches floor 40 or deeper.  
**Location:** Gatekeeper on return.  
**Purpose:** bring Gary's fear into direct conflict with the player's goal.

Gary asks the player to stop pushing deeper and instead help rebuild the gates and farm
the safer floors. The opening changes with the run outcome:

- **Wipe:** "That was a close one, <player>. I wonder if you wouldn't mind sitting
  with me a moment and discussing the future of our village."
- **Flee:** "It was good you got out of there when you did..."
- **Success:** "It's incredible how far you've made, but I wonder if it isn't time for
  another path."

The player declines to stop. Dialogue choices express why they will continue; they may
set tone flags for later lines but converge on continued descent.

**Effects:**

- Set relationship stage to 4.
- Unlock `Gary's Gift: +10 Health to all Creatures in Party`. Every later tower run
  begins with this run-long relic active.
- Improve Gary's deep-start assistance.
- Add reactive lines keyed to the player's stated reason for continuing.

### Stage 5 — Garrette's Last Watch

**Trigger:** defeat Garrette's reanimated form as the floor-75 mini-boss.  
**Location:** floor 75, followed by the Gatekeeper.  
**Purpose:** resolve the search and Gary's conflict between hope and grief.

The player defeats the thing Garrette became and returns with confirmation of his fate.
Gary is relieved that his son no longer wanders the tower as a ghost, while grieving as
the last possibility of greeting him alive disappears.

**Effects:**

- Set relationship stage to 5/completed.
- Upgrade `Gary's Gift` from +10 to +20 Health for all creatures in every later tower
  run. The +20 version replaces the +10 version; they never stack.
- Apply a permanent discount to future depth-jump unlock purchases. Previously
  purchased jumps are not refunded.
- Upgrade Gary's deep-start boon to its completed form.
- Replace search dialogue with post-relationship dialogue and visible home changes.

## Post-relationship state

Gary remains an active villager and vendor. His repeatable dialogue pool covers:

- Limited adventures through secured passages.
- The monster he has tamed, represented visually at his home.
- Memories of Garrette that are no longer solely about the disappearance.
- The player's recent depth and run outcome.
- Contemplating asking another townsperson out for coffee.

At least one post-relationship line must react to each of: a wipe, a deliberate exit, a
new deepest floor, a deep start, and a return after clearing a Warden.

## Reward semantics

The Essence interval/amount and `Gary's Gift` values below are settled. Any remaining
reward values are alpha tuning. All values must be constants rather than embedded scene
literals.

### Deep-start cost

- From stage 2 onward, `depthRunFee` is reduced by a flat 10%.
- The discounted value is used consistently for display, affordability checks, and
  payment at departure.
- The reduction does not escalate at later relationship stages.

### Periodic Essence share

- Available only from stage 3 onward.
- Represents proceeds from Gary's limited trips through secured routes.
- Each time Gary pays out, roll the next delay as an inclusive integer from **2–5
  homecomings** and the next amount as an inclusive integer from **10–40 Essence**.
- A homecoming is counted when a tower run ends and returns to town, regardless of run
  outcome.
- The delay and amount are rolled through injected RNG, then persisted immediately. The
  player cannot reroll either by reopening a screen or reloading.
- At most one share may be pending.
- After the countdown reaches zero, queue a short Gary interaction awarding the stored
  amount. Claiming it schedules the next 2–5-return interval.

### `Gary's Gift` health relic

- Stage 4 unlocks a run-long effect named `Gary's Gift` that adds **10 flat maximum HP**
  to every creature in the active party.
- Stage 5 upgrades the same effect to **20 flat maximum HP**.
- The gift is derived from Gary's relationship stage at run creation and added to
  `RunState.activeBoons` with `battlesLeft: null`, the existing run-long Relic shape.
- It applies to whichever creatures enter that run; it does not mutate creature stats,
  does not belong to particular instance IDs, and is not inherited through breeding.
- The +10 and +20 definitions share one `max_hp_flat` effect kind, so the boon layer
  replaces rather than stacks them.
- Every HP display, recovery cap, battle constructor, level-up refresh, and run-map
  state must use base max HP plus the active `max_hp_flat` amount.
- Player-facing text is explicit: `Gary's Gift: +10 Health to all Creatures in Party`
  or `Gary's Gift: +20 Health to all Creatures in Party`.

### Depth-jump discount

- Begins after stage 5 and is a flat 10%.
- Modifies `depthUnlockCost` for future purchases only, complementing the recurring
  deep-start fee discount earned at stage 2.
- Does not refund already purchased floors.

## Relationship state

The first slice should establish a generic shape without attempting to simulate
relationships between every NPC:

```ts
export interface RelationshipProgress {
  stage: number;
  completedEventIds: string[];
  flags: string[];
  evidenceIds: string[];
  claimedRewardIds: string[];
  scheduledRewards: Record<string, ScheduledRelationshipReward>;
}

export interface ScheduledRelationshipReward {
  returnsRemaining: number;
  amount: number;
}

export type RunOutcome = 'cleared' | 'fled' | 'wiped';

export interface LastRunSummary {
  outcome: RunOutcome;
  startFloor: number;
  deepestFloor: number;
  bossFloorsCleared: number[];
  partyInstanceIds: string[];
  essenceGained: number;
}
```

`GameStateManager` gains:

```ts
relationships: Record<string, RelationshipProgress>;
pendingStoryEvents: string[];
lastRunSummary: LastRunSummary | null;
homecomings: number;
```

Stable identifiers:

```text
npc:               gary
events:            gary_01_gate
                   gary_02_old_passages
                   gary_03_shortsword_found
                   gary_03_shortsword_return
                   gary_04_another_path
                   gary_05_last_watch
evidence:          gary_garrette_shortsword
rewards:           garys_gift_10
                   garys_gift_20
                   gary_essence_share
                   gary_depth_discount
```

The save shape changes, so implementation bumps `SAVE_VERSION`. Per the current alpha
policy, mismatched saves are discarded; no migration is added.

## Eligibility and event resolution

Relationship eligibility belongs in a pure, Phaser-free system. Scenes ask what is
available and resolve an event through that system; they do not independently modify
stages or rewards.

Required operations:

```ts
relationshipFor(state, npcId): RelationshipProgress
eligibleTownEvents(state, npcId): string[]
completeRelationshipEvent(state, eventId, context): Resolution
hasCompletedRelationshipEvent(state, eventId): boolean
```

Completion must be atomic: mark the event complete, advance the stage, set flags, record
reward claims, and return the effects to present. A repeated completion request returns a
no-op result.

## Scene and routing contract

### Town

- First arrival automatically presents `gary_01_gate` before the tower can be entered.
- The Gatekeeper tile shows a `NEW` marker when Gary has a pending relationship event.
- Entering the Gatekeeper keeps `TALK TO GARY`, `DEPTH JUMPS`, and `TOWN` separate.
- Ordinary service use never consumes or dismisses a pending conversation.

### Dialogue

A reusable `DialogueScene` renders authored nodes and choices. It receives an event ID
and a return destination, then asks the relationship system to resolve the event once.
It must support conditional opening lines for the stage-4 run outcomes.

### Tower story encounters

`Encounter` gains an optional stable `storyEventId`. Gary's shortsword is a combat-backed
story encounter. Winning records the evidence and queues the town follow-up before the
ordinary post-combat reward flow continues.

The floor-75 Garrette encounter is a fixed authored boss encounter, not a random species
draw. It must not be capturable and must route through the same victory/reward lifecycle
as other bosses before the town resolution.

## Alpha delivery split

The current alpha ends at floor 20. Delivery is therefore split without changing the
five-stage design:

### Buildable now

- Generic relationship state and resolver.
- Reusable dialogue presentation.
- Stage 1 first-town introduction.
- Stage 2 floor-5 return and depth-jump connection.
- Stage 3 shortsword encounter, return scene, and Gary's first ongoing assistance.
- Reactive dialogue and post-completion-safe event queuing.

### Deferred until tower expansion

- Stage 4 floor-40 return variants and `Gary's Gift +10`.
- Stage 5 Garrette floor-75 authored boss and ending.
- Final depth discount and post-relationship home transformation.

Debug controls may expose stages 4 and 5 for UI development, but normal alpha saves
cannot reach them while `TOWER_FLOORS` remains 20.

## Acceptance criteria

- A new game introduces Gary and opens the tower exactly once.
- Clearing floor 5 queues the old-passages scene exactly once.
- Gary's vendor remains usable whether or not a conversation is pending.
- The shortsword encounter becomes available after stage 2 and cannot be withheld
  indefinitely by RNG.
- Winning that encounter records permanent evidence even if the later run wipes.
- Returning with the sword queues and completes Gary's stage-3 scene exactly once.
- Deep-start boons are granted only at eligible stages and only on deep starts.
- Stage 4 accepts wipe, flee, and success outcomes and selects the correct opening.
- Gary's Essence delay and amount survive save/load and cannot be rerolled.
- Essence assistance always falls within 10–40 and successive grants are separated by
  2–5 homecomings.
- `Gary's Gift` is +10 at stage 4, +20 at stage 5, run-long, party-wide, and never
  modifies or inherits through creature stats.
- Every one-time relationship reward records a stable claim and cannot duplicate.
- Garrette always occupies floor 75 once eligible and cannot be captured.
- Save/load round-trips relationship progress, pending events, evidence, and claims.
- `render_game_to_text` reports the active scene, Gary's stage, pending relationship
  event, dialogue choice state, and any relationship boon affecting the run.

## Explicitly out of scope

- Romance with Gary or other villagers.
- Generic gifts, birthdays, schedules, or relationship decay.
- A global village reputation meter.
- NPC-to-NPC relationship simulation.
- Procedural dialogue.
- Implementing relationship arcs for the other town vendors.
- Final numeric balancing of deep-start boons or the depth discount. The 2–5-return,
  10–40-Essence assistance and +10/+20 `Gary's Gift` values are fixed by this spec.
