# Pack Tempo Phase One Implementation Plan

## Goal

Ship a playable stable-core combat slice without pulling Omen, Break, Weave, Marks, Instincts, or Afterforms into every encounter.

## Sequence

1. Add a pure Pack Tempo rules module and tests for cap, once-per-Kin generation, Relay cost, and action conservation.
2. Commit exact enemy move and target intents when each round timeline is built, then expose them to the combat UI and text-state hook.
3. Add battle-local Tempo state and an authored action-result vocabulary for generation reasons.
4. Offer manual Relay after an allied action and teach auto-combat to use the same operation and legality checks.
5. Replace random critical rolls with authored conditions and convert high-crit moves into Keen moves.
6. Add visible Tempo/intents, structured combat metrics, and a deterministic combat test entry point.
7. Run unit tests and build, then play the browser slice with the Playwright harness and inspect screenshots plus text state.

## Explicit omissions

- Move Growth and departure augments are the next phase.
- Omen/Break and Weave remain encounter modules and are not simulated by placeholder core rules.
- Relic, Mark, Instinct, and Afterform catalogs are not prerequisites for validating Relay.

## Acceptance

- Tempo starts at 0, caps at 3, carries between rounds, and clears between battles.
- One Kin can generate at most one Tempo per round.
- Relay costs 1 and moves an unused living ally to the next timeline position.
- No player Kin acts more than once per round.
- Exact enemy move and target are visible before player decisions.
- Manual and auto combat use the same Relay rules.
- Browser text state agrees with the rendered UI.
