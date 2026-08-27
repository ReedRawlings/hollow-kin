# Event Rooms — Design

**Date:** 2026-08-27
**Status:** Approved for implementation
**Supersedes:** the placeholder `'event'` branch in `RunScene.selectEncounter` (free +15 Obols / +10 XP / +10% HP on entry, no choice)

## Why

Event rooms are meant to be the Slay-the-Spire-style small gamble: a reprieve, or a find that alters the run, at a price. The placeholder had no choice and no downside, so it was strictly better than a fight and dominated pick-next. This design keeps the room and gives it terms.

## Rules

1. **An event is an offer.** The room shows a name, one line of flavour, the exact terms (what you pay, what you get), and two actions: **ACCEPT** and **WALK AWAY**. Walking away costs nothing and returns to the map.
2. **Events grant no XP.** XP is combat's reward. The only way an event yields XP is by triggering a fight.
3. **Viability is filtered before the draw.** An event whose terms could not fire in the current run state is excluded, exactly as `RewardOffer` drops dead cards. If nothing is viable (cannot happen with `warden_wager` always viable), the room is a no-op.
4. **Obol-priced events cost 10% of *current* Obols, floored, free at 0.** Both priced events share this rule.
5. **No event can knock a creature out.** Costs paid in HP always leave at least 1.
6. **Resolvers are pure.** `systems/Events.ts` returns an `EventResolution`; the scene applies it. Same contract as `Items.ts`: return outcomes, never mutate, never end a run.

## Catalogue — `src/data/events.ts`

| id | Name | Terms | Viable when |
|---|---|---|---|
| `mercy_well` | Mercy Well | Every living party member recovers 10% max HP and 10% max MP. Costs 10% of current Obols. | Obols > 0 and at least one living creature is below max HP or max MP |
| `blood_boon` | Blood Boon | Grants one boon drawn at random from `REWARD_BOON_LIST` (named in the offer before accepting, via `grantBoon`). A random living creature loses 20% of its *current* HP (floored, never below 1). | At least one living creature |
| `dice_transfer` | The Dice | A d12 is rolled and shown. The player picks a donor, then a recipient (both living, distinct). HP moved = `min(roll, donorHp − 1, recipientMaxHp − recipientHp)`. | At least two living creatures |
| `tinkers_trade` | Tinker's Trade | Pay 10% of current Obols; choose one of three distinct items drawn from the full item pool. Added to the bag. | Obols > 0 and the bag has a free slot |
| `warden_wager` | Warden's Wager | Fight a combat encounter on this floor. Obols and XP from the victory are doubled; the post-battle reward offer is unchanged. | Always |

Events are drawn uniformly from the viable set.

## Types

- `Encounter.rewardMultiplier?: number` — applied to `obolGain` and `xpPerCreature` in `Battle.settle`. Absent means 1.
- `Encounter.eventId?: string` — **not** stored; the event is chosen when the room is entered because viability depends on live state.
- `RunState.xpEarned` — removed. Its only writer was the placeholder branch and nothing read it.

## `src/systems/Events.ts`

```ts
interface EventContext {
  run: RunState;
  party: CreatureInstance[];   // gameState.runParty
  backpack: Backpack;
}
interface EventResolution {
  partyHp?: Record<string, number>;
  partyMp?: Record<string, number>;
  obols?: number;
  activeBoons?: ActiveBoon[];
  backpack?: Backpack;
  encounter?: Encounter;       // warden_wager only
  message: string;             // one result line for the scene
}
```

- `viableEvents(ctx): EventDefinition[]`
- `pickEvent(ctx, roll): EventDefinition | null`
- `obolCost(obols): number` — the shared 10% rule
- `prepareEvent(id, ctx, roll): EventOffer` — resolves anything the player must see before accepting (the d12 roll, the named boon, the three items, the wager's encounter preview) so the offer and the resolution agree
- One resolver per event taking the `EventOffer` plus any player choices (donor/recipient ids, chosen item id) and returning `EventResolution`.

The wager's encounter is built with `RunGenerator`'s existing `makeEncounter` (export it) for the current floor and `index`, with `rewardMultiplier: 2`.

## `src/scenes/EventScene.ts`

Theme furniture (`screenFrame`, `header`, `panel`, `button`, `compactPartyCard`). Flow:

1. **Offer** — name, flavour, terms, any pre-resolved detail (roll / boon name / three item cards). ACCEPT · WALK AWAY. ESC = walk away.
2. **Sub-step** (only where needed) — donor then recipient picker for `dice_transfer` (ineligible cards greyed with a reason: KO, already donor, at 1 HP for donors, full HP for recipients); item choice for `tinkers_trade`.
3. **Result** — one line, then CONTINUE → `RunScene` with `continueRun: true`. An accepted `warden_wager` starts `CombatScene` directly with the prepared encounter.

`RunScene.selectEncounter` routes `'event'` to `EventScene` and its old inline branch is deleted.

## Tests — shape, not numbers

`src/systems/Events.test.ts`:
- viability: each event is excluded exactly when its condition fails; `warden_wager` is always present
- `obolCost` scales with Obols and is 0 at 0
- `mercy_well`: every living member's HP/MP rises and never exceeds max; KO'd members untouched; Obols drop by the cost
- `blood_boon`: the boon is in `activeBoons` afterwards; exactly one living member lost HP; no member is at 0
- `dice_transfer`: donor never below 1; recipient never above max; total party HP unchanged; amount never exceeds the roll
- `tinkers_trade`: three distinct offered ids; bag gains exactly one slot; Obols drop by the cost
- `warden_wager`: encounter is `combat` on the same floor with `rewardMultiplier > 1`; nothing else in the resolution changes

`src/systems/combat/Battle.test.ts` (new): a settled victory with `rewardMultiplier: 2` grants more Obols and XP than the same encounter without it, by that factor.

`src/data/events.test.ts`: every id is unique; every event has non-empty name/flavour/terms.

## Docs

- `tower-structure.md` — replace the events section with the offer model and the catalogue
- `CLAUDE.md` — one line under What's Built; remove "random events … no code" wording if present
- `progress.md` — decision entry
