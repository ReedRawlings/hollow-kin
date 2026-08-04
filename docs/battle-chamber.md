# Battle Chamber Development Contract

## Purpose and access

The Battle Chamber is a disposable, deterministic combat lab for testing proposed combat architecture before changing expedition combat.

- Development URL: `/?test=1&screen=chamber`
- `Left / Right`: select a preset
- `M`: switch player move economy
- `Enter`: start a manual battle
- `A`: run the battle automatically at 4× speed

The Chamber opens on **Expedition MP**, which is now the active Tempo/Relay test economy. The previous Shared AP model remains available as a labeled legacy comparison.

## Active combat prototype

### Pack Tempo and Relay

- Pack Tempo starts at zero except where a fixture explicitly seeds it.
- It caps at three, carries between rounds, and clears after combat.
- Known-weakness exploitation is the first live generation source. Omen, Break, and Rebound have typed extension points but are not yet implemented here.
- One action resolves no more than one base Tempo award.
- At three Tempo, Relay is Ready until used or the battle ends. There is no expiring Relay Window.
- Baseline Relay spends all three Tempo and moves one unused allied action slot directly after the current action.
- Relay does not create a baseline action.

### Link Arts

- Link-enabled presets use a deliberately small authored recipe catalog.
- Recipes match broad move styles rather than arbitrary move pairs.
- The first catalog contains Buff → Ash, Ash → Salt, and Salt → Breath duo Links.
- Participants must be different Kin.
- Enemy actions and round boundaries clear the current Link sequence.
- Before confirmation, a valid finishing move displays the Link Art name and changed effect.
- The finishing damaging move receives the prototype recipe multiplier; completing the Link is reported in the combat log and metrics.

The real Founding Hand loadouts, shared by new games and the Chamber, expose these concrete pairs:

- Geta's Harden → Wiggledrake's Ashfall or Pyrewood = **Rallying Inferno** (+40% Ash-finisher damage)
- Wiggledrake's Ashfall or Pyrewood → Geta's Rime = **Thermal Shock** (+30% Salt-finisher damage)
- Geta's Rime → Cat's Keening = **Shatterwind** (+30% Breath-finisher damage)

The Relay + Links preset is deliberately arranged to demonstrate Thermal Shock after earning Relay from three weakness hits.

### Multiple action slots

- Timeline entries have unique slot ids independent of actor ids.
- The Twin Threat preset gives its mini-boss a standard and a boss-extra slot, each with a separately committed intent.
- The Encore preset allows Relay to create one explicit relic-extra slot for a Kin that already acted.
- Encore can be used once per round, only one allied extra slot can be created, and one Kin can act at most twice.

## Chamber presets

| Preset | Rule under test |
| --- | --- |
| Relay + Links | Starts at zero; Iron, Ash, and Salt weakness hits build Tempo before Relay creates Link adjacency |
| Attrition | Starts wounded with Encore Relay; tests whether one extra action is valuable without being mandatory |
| Twin Threat | Mini-boss has two intent slots and Link Arts are enabled |

## Legacy Shared AP comparison

- The pack starts every round with three shared Action Points.
- Learned moves cost one or two AP according to the current Chamber conversion.
- Basic Attack costs zero AP.
- AP refreshes each round and does not bank.
- AP pays for moves; Pack Tempo pays only for Relay.

The combat header, party cards, commands, move rows, text-state output, and result ledger must expose the active resource model. A feature is not testable if its state exists only in code.

## What is shared with expedition combat

Both modes use the production `CombatScene`, damage and status resolution, SPD ordering, exact enemy intentions, deterministic criticals, item behavior, battle-end detection, and action-slot timeline. Chamber flags instantiate provisional rules through `BattleChamberContext`.

## Intentional differences from expedition combat

| Chamber behavior | Current expedition behavior |
| --- | --- |
| MP is the default move economy; legacy Shared AP remains selectable | Each Kin spends persistent MP |
| The Founding Hand's real starter loadouts expose weakness hits and Link combinations under either economy | Starter Kin use those same loadouts; other Kin retain their own persistent moves |
| Chamber weaknesses are immediately visible and Tempo-eligible | Expedition knowledge follows Monsterpedia discovery rules |
| Selected presets enable Link Arts, boss extra slots, or Encore | These remain Chamber experiments |
| Fixed parties, enemies, levels, health, and seeds | Expedition encounters use run state |
| Results return to a comparison ledger | Victory continues to rewards and path selection |
| No XP, Obols, recovery, knowledge, or saves | Expedition outcomes update progression |

A successful experiment does not become an expedition rule until the combat specification and production flow are deliberately reconciled.

## Metrics

The result ledger records battle length, action counts, initiative order, MP/AP behavior, Tempo generated/spent/wasted, rounds Relay was held, Relays performed, Links completed/interrupted, Links enabled by Relay, and extra turns granted.

The primary playtest questions are:

1. Does Relay become available often enough to matter without becoming routine?
2. Do players hold Relay for meaningful threats or Links rather than spending immediately?
3. Does enemy interruption make Link order readable and valuable?
4. Do two boss intents create prioritization rather than unavoidable damage?
5. Does Encore speed up understood fights without making extra turns mandatory?

## Legacy AP consequence: rewards

Shared AP removes persistent MP attrition and therefore removes MP recovery as a reward and routing decision. The Chamber does not invent a replacement. Before Shared AP becomes production, the expedition reward loop must deliberately choose a charged temporary item, future-round reserve, another expedition resource, or a smaller reward pool.
