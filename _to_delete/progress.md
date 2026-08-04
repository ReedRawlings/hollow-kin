Original prompt: Do a review of our project, look for bugs or open issues that need to be addressed

## Review log

- Baseline: `npm test` passes 185 tests across 9 files.
- Baseline: `npm run build` succeeds; Vite reports a 1.56 MB minified main chunk.
- Known issues from project context are being tracked separately from newly discovered findings.
- Live UI verification: level-1, explicitly “Not breed-ready” parents can still be bred and retired.
- Code review: offspring inherited stats are overwritten by template-derived stats on the next run/level purchase.
- Code review: non-damaging enemy debuffs never perform their configured accuracy roll.
- Browser console showed no errors during the starter → town → breed flow.
- Shop purchases now use an atomic, testable helper: no charge occurs unless the
  party can benefit and the run can afford the item. Full HP/MP and no-KO states
  render their items disabled as `Not needed`.
- Added 7 shop regressions; suite now passes 192 tests across 10 files, and the
  production build still succeeds.
- Live verification reached a generated shop after combat: Revive rendered
  disabled as `Not needed`, clicking it left Obols unchanged, and the browser
  console remained clean.
- Non-damaging hostile abilities now use the same shared accuracy roll as
  damaging attacks. Misses apply no effects; self/ally moves remain guaranteed;
  area effects roll independently because resolution is per target.
- Added 5 combat accuracy regressions. The full suite now passes 197 tests
  across 10 files, and the production build succeeds.
- Live auto-combat completed a two-enemy encounter through the victory/reward
  screen after the resolver change, with no browser console errors.
- Rest-point HP/MP choices and post-combat HP/MP rewards now prompt for one
  eligible living creature. Full and knocked-out creatures are visible but
  disabled; explicitly party-wide recovery remains party-wide.
- Added 4 targeted-recovery regressions. The full suite now passes 201 tests
  across 11 files, and the production build succeeds.
- Live post-combat verification confirmed MP recovery changed only the selected
  creature (18 → 24), while an HP target prompt visibly disabled a knocked-out
  party member. The browser console remained free of warnings and errors.
- Creature instances now persist an instance-specific stat baseline. Offspring
  store inherited stats there, so run resets, XP levels, and permanent level
  purchases no longer replace inheritance with the species template. Save v5
  persists the baseline and migrates pre-v5 creatures.
- Added 4 inherited-stat/save regressions. The full suite now passes 205 tests
  across 11 files, and the production build succeeds.

## TODO

- Add regression coverage and enforce the breed-ready gate in both scene and domain logic.
- Continue migrating the secondary vendor/service screens (shop, rest, breeding,
  leveler, gatekeeper, pedia) onto the shared `src/ui/Theme.ts` primitives.

## Tower-screen redesign (2026-07-26)

- Added a shared high-fidelity UI layer matching the new handoff palette,
  Press Start 2P/Silkscreen typography, hard borders, hatch sprite plates,
  selection states, screen headers, footer hints, and currency accents.
- Rebuilt the first-run hand selection, preferred walkable town map, paged
  creature box + party dock, low-information run map, run-results exchange
  ledger, and combat battlefield/command presentation around real game state.
- Kept source-of-truth rules where the prototypes conflict: 30 floors, current
  starter species, existing Leveler/Gatekeeper/Archive vendors, current combat
  abilities, and the existing targeted recovery reward flow.
- Unbuilt systems referenced by the handoff (inventory, marks, traits) remain
  visibly shuttered or disabled rather than inventing unsupported state.
- Added `window.render_game_to_text` and `window.advanceTime` integration hooks.
- First-run hand selection now also installs that hand as the default party,
  avoiding an immediate broken-party state on arrival in town.
- Visual QA completed in the live browser across Starting Party, Town Map,
  Tower Gate, Run Map, Roost/Creature Box, and active Combat. Ability selection
  advanced the fight correctly and no browser warnings/errors were reported.
- The standalone Playwright client reports correct text state but captures a
  black Phaser canvas in both headless and headed modes; live-browser canvas
  screenshots render correctly, so this is isolated to that capture path.
- Verification: `npm run build` succeeds and all 251 tests pass.
- Split victory recovery into a dedicated `PostCombatScene`; combat now hands
  off to rewards, rewards apply to one eligible target, then return to the
  choose-next-path Run Map scene. Defeat routes through Run Results.
- Run Results now returns to Town with either Enter or the visible button.
- Fleeing from the tower now opens a themed confirmation modal; Enter confirms
  departure and Escape resumes the run.
- Added obvious upper-left back controls to Town destinations while preserving
  immediate building entry. The deeper shop/service redesign remains deferred.
- Shared outlined buttons now switch to dark text when their hover fill is
  active, fixing the low-contrast filled state.
- Bundled Press Start 2P and Silkscreen under `public/fonts/`; the UI no longer
  relies on Google Fonts or another remote stylesheet.
- Live-browser QA covered the flee modal, Run Results → Town, victory →
  Post-Combat Rewards, target selection, reward application, and return to the
  next-floor Run Map. The selected MP recovery changed only its target and the
  browser console remained free of warnings and errors.
- Final verification: `npm run build` succeeds and all 275 tests pass.

## Merchant UI pass (2026-07-26)

- Rebuilt the Tower Merchant in the shared tower-screen language. Immediate
  field services and carryable supplies are visually separated, all five offers
  support keyboard and pointer selection, disabled reasons remain visible, and
  the screen shows live Obols plus every bag slot and its wipe protection.
- Rebuilt the Town Provisioner with two large supply cards, Essence pricing,
  clear affordability/full-bag states, a live protected-slot bag strip, an
  obvious upper-left Town return, and keyboard/pointer purchase controls.
- Kept the new item/shop systems authoritative: Tower services act immediately,
  Tower supplies cost Obols, Provisioner supplies cost Essence, and no purchase
  charges the player when the bag is full or funds are short.
- Expanded `render_game_to_text` with backpack capacity and contents, and added
  opt-in `?test=1` merchant/provisioner scene controls for deterministic UI QA.
- Live-browser QA covered both funded screens, item purchases, a recovery-service
  purchase, protected-slot display, full-bag blocking, Provisioner → Town, and
  Tower Merchant → Run Map. No browser warnings or errors were reported.
- Final verification: `npm run build` succeeds and all 322 tests pass. The
  production build retains the existing large-chunk warning.

## Pack Tempo combat architecture — phase one (2026-07-31)

- Approved and completed the remaining combat-architecture decisions in
  `docs/combat-architecture-spec.md`, including Weave resolution, supporting
  layer boundaries, auto-combat, metrics, and the phase-one acceptance target.
- Added pure Pack Tempo rules with tests for the 3-point cap, within-battle
  round carry, once-per-Kin generation, Relay spending, and timeline action
  conservation.
- Combat now commits and reveals exact enemy moves and targets at round start.
- Authored starting attack roots generate Tempo on hit. Manual play gets a
  post-action Relay/bank prompt; auto-combat uses the same Relay operation and
  legality checks.
- The combat UI and `render_game_to_text` expose Tempo, committed intents,
  Relay candidates, and Tempo metrics.
- Replaced random critical rolls with authored deterministic conditions; the
  former high-crit moves are now Keen moves with visible conditions.
- Added deterministic `?test=1&screen=combat` setup and test-only WebGL buffer
  preservation so the Playwright screenshot loop captures actual game frames.
- Browser QA confirmed manual Relay moved one existing action without copying
  it, auto-combat spent Relay legally, text/UI state agreed, and no browser
  errors were emitted.
- Verification at this checkpoint: all 482 tests pass and the production build
  succeeds; the existing large-chunk warning remains.

## Battle Chamber (2026-07-31)

- Started a test-only Battle Chamber so Pack Tempo and future encounter modules
  can be exercised through repeatable presets without expedition rewards.
- Added an injectable seeded random source and threaded optional RNG through
  damage, effects, non-damaging accuracy, and enemy targeting. Existing callers
  retain `Math.random`; chamber battles can now replay an exact seed.
- Seeded RNG plus combat/tactics regression checkpoint: 73 targeted tests pass.
- Added the Battle Chamber scene with Relay, attrition, and mini-boss presets,
  manual/auto launch, fixed seeds, and a result ledger. Chamber combat returns
  without XP, Obols, Monsterpedia updates, recovery, or save progression.
- Added `?test=1&screen=chamber`, text-state coverage, and browser action bursts
  for the chamber menu, manual launch, attrition launch, and auto completion.
- Chamber integration checkpoint: 75 targeted tests pass and the production
  build succeeds.
- Browser QA covered the chamber menu, manual launch, reduced HP/MP attrition,
  Tempo generation plus Relay, auto completion, result display, and restart.
- Replaying seed 101 initially exposed random creature instance ids leaking into
  auto-combat tie breaks. Chamber actors now receive deterministic ids; two full
  auto simulations produce byte-identical result state (victory in 5 rounds,
  Tempo +7, spent 4, wasted 7, 4 Relays).
- Chamber completion clears its disposable RunState and awards no XP, Obols,
  recovery, Monsterpedia knowledge, or permanent save changes.
- Final verification: all 486 tests pass, the production build succeeds, and
  browser runs emitted no console errors. The existing large-chunk warning remains.

### Battle Chamber follow-ups

- Add editable party/enemy composition after the three presets prove useful.
- Add module toggles only when Omen/Break, Weave, or Weather have real contracts
  to instantiate; do not add fake placeholder toggles.
- Expand the result ledger with HP/MP/item/action metrics as their structured
  combat events are implemented.

## Battle Chamber resource comparison (2026-08-01)

- Replaced the automatic post-action Relay prompt with an explicit fourth root
  command. Relay is now queued before an action, reserves one Tempo, and is paid
  only after that action resolves; ignoring Tempo adds no extra interaction.
- Added a chamber-only resource-model comparison. MP Control preserves individual
  MP, while Shared Tempo makes authored builders free and prices setup/payoff
  moves at 1–2 shared Tempo. Relay competes for that same capped pool.
- Shared Tempo uses the Founding Hand's authored starter loadouts so every Kin has
  a builder and a payoff/setup move; wild and bred species keep their template moves.
- Expanded instrumentation with move-vs-Relay spending, player/enemy action
  counts, saturation waste, and Pack First contested-round frequency to detect
  whether Tempo is erasing meaningful initiative.
- Targeted Pack Tempo/Battle Chamber tests pass (11 tests), and the production
  build succeeds with the existing large-chunk warning.
- A/B ledgers now persist per preset, allowing MP Control and Shared Tempo to be
  run consecutively and compared on the same screen rather than relying on memory.
- Browser QA confirmed: no post-action prompt, queued/cancelable Relay, one-point
  reservation, free builders, disabled unaffordable payoffs, legal auto behavior,
  deterministic replay, and side-by-side fixed-seed results without console errors.
- Seed 101 baseline: MP Control won in 5 rounds (+7 generated, 4 Relay spend,
  7 wasted at cap, Pack First 3/4); Shared Tempo won in 5 rounds (+9 generated,
  4 move + 3 Relay spend, 0 wasted, Pack First 3/4). This already validates the
  concern that initiative pressure remains high even when move costs consume Tempo.
- Final verification: all 513 tests pass and the production build succeeds; the
  existing large-chunk warning remains.

## Relay Window experiment (2026-08-01)

- Relay now requires both one Pack Tempo and a separate Relay Window. Ordinary
  `on hit` builders cannot open initiative access.
- Learned starter attacks no longer generate Tempo merely for hitting. Basic
  Attack is now the universal deliberate builder, trading move potency for one
  Tempo; only the first Basic hit across the pack generates each round, while
  conditional accomplishments continue to award Tempo naturally.
- Conditional criticals, known-weakness exploits, Technicals, and authored
  encounter accomplishments may open a Window. Only one may be used each round;
  unused Windows expire, and a relayed Kin cannot reopen one during that round.
- The Tempo Relay chamber preset starts round one with a test-only Window so the
  full queue/spend UI can be exercised deterministically without weakening the
  production rule.
- Added pure Window lifecycle tests. Pack Tempo/Battle Chamber checkpoint:
  15 targeted tests pass and the production build succeeds with the existing
  large-chunk warning.
- Browser QA confirmed learned attacks generate no automatic Tempo, only the
  first Basic hit across the pack generates each round, Window spending consumes
  one Tempo, a pulled Kin cannot chain, and an unused Window expires next round.
- Seed 101 after the revision: MP Control won in 6 rounds with 2 Tempo, 0 Relays,
  and Pack First 0/5. Shared Tempo won in 8 rounds with 8 generated/8 spent,
  1 Relay, and Pack First 1/7. The previous test produced Pack First 3/4 in both
  models, so the new rules materially restore enemy initiative and SPD relevance.
- Final verification: all 517 tests pass and the production build succeeds; the
  existing large-chunk warning remains.

## Shared Action Pool experiment (2026-08-01)

- Replaced the Battle Chamber's combined Shared Tempo model with a Shared AP
  model: three Action Points refresh each round, learned moves cost 1–2 AP, and
  Basic Attack remains a zero-cost fallback.
- Pack Tempo is now fully separate in this chamber model. Moves never deduct
  Tempo; Tempo is generated by the existing authored conditions and spent only
  when a legal queued Relay resolves.
- Added Action Pool rules tests plus screen/text-state exposure and AP spending
  metrics. Expedition combat remains on individual MP while the model is tested.
- Browser QA confirmed a learned move spends AP without changing Tempo, Basic
  can earn Tempo without changing AP, and a queued Relay spends Tempo while its
  triggering learned move separately spends AP. A four-round auto fight completed
  successfully and returned an AP/Tempo result ledger with no console errors.
- Final verification: all 519 tests pass and the production build succeeds with
  the existing large-chunk warning.

### Follow-up

- Playtest whether three AP creates useful sequencing choices or simply forces
  the third Kin into Basic Attack too often; tune the pool and cost conversion
  from Chamber evidence rather than changing expedition combat prematurely.

## Persistent Relay, Link Arts, and action-slot timeline (2026-08-02)

- Reconciled `docs/combat-architecture-spec.md` around persistent battle-local
  Pack Tempo: cap/cost 3, no expiring Relay Window, once-per-action base
  generation, Weakness/Omen/Break/Rebound triggers, and explicit modifier
  exceptions. Historical pitch documents now point to the authoritative spec.
- Replaced creature-identity timeline entries with unique action slots. Enemy
  intents are committed per slot, enabling separately telegraphed boss actions
  and explicit relic-created allied extra actions.
- Added pure `TurnTimeline` and `LinkArts` systems with tests. The Chamber Link
  catalog currently contains Buff → Flame, Flame → Ice, and Ice → Wind recipes;
  arbitrary pairs do not react and enemy actions clear the sequence.
- Relay now becomes Ready at three Tempo, remains ready across rounds until
  spent, costs all three points, and preserves ordinary action conservation.
- Added an Encore Chamber modifier which may create one relic-extra slot for an
  already-acted Kin once per round. The tested Kin acted exactly twice and the
  ledger recorded one extra action.
- Updated Chamber presets to Relay + Links, Attrition/Encore, and Twin Threat.
  Twin Threat gives its mini-boss two unique timeline slots and two separately
  committed intents; the fixture deliberately selects an alternate legal move
  for the second slot when the AI chose the same action twice.
- Link finishers transform in the move list before confirmation, show the new
  name/effect, receive their prototype damage multiplier, and emit completion,
  interruption, Relay-enabled-Link, and extra-turn metrics.
- Browser QA verified Relay → Ember → relayed Frost previewed and completed
  Thermal Shock, the text state recorded one Relay-enabled Link, Twin Threat
  displayed `EGG` and `EGG II` with Jab and Harden intents, and Encore created
  exactly one additional Wiggledrake action. Captured screenshots were visually
  inspected and no browser console errors were emitted.
- Verification: all 524 tests pass and the production build succeeds with the
  existing large-chunk warning.

### Combat architecture follow-ups

- Implement Omen, Break, and Rebound combat events; only the typed Tempo trigger
  vocabulary and specification exist today.
- Author and test a broad first production Link catalog, including at least one
  trio recipe and encounter conditions that accept categories such as any
  Buff-based Link.
- Playtest the current boss-extra insertion cadence and decide whether each boss
  authors exact slot initiative instead of using the Chamber midpoint rule.
- Keep Shared AP chamber-only until the expedition reward replacement for MP
  recovery is deliberately selected.

## MP Tempo/Relay Chamber update (2026-08-02)

- Made individual expedition-style MP the Battle Chamber default. The shared AP
  experiment remains selectable only as a labeled legacy comparison.
- Applied the fixed Chamber move loadouts under MP as well as AP, so Cat carries
  Jab/Keening, Geta carries Rime/Harden, and Wiggledrake carries
  Ashfall/Pyrewood in every Chamber run.
- Reworked Relay + Links to start at zero Tempo against enemies weak to Iron,
  Ash, and Salt. Chamber knowledge explicitly reveals these weaknesses to the
  player and auto AI without mutating permanent Monsterpedia state.
- Added `WEAK <ward>` target text and `+TEMPO WEAK` move previews. Text state now
  exposes Chamber weaknesses alongside each committed enemy intent.
- Corrected the last stale Link description from Flame to Ash and expanded Link
  tests across Buff→Ash, Ash→Salt, and Salt→Breath.
- Browser QA completed the full MP sequence: Ashfall, Jab, and Rime weakness hits
  generated 3 Tempo; Relay remained ready across the round boundary; Relay moved
  Geta directly after Wiggledrake; Thermal Shock completed; MP was deducted from
  every move. Metrics recorded 4 generated, 3 spent, 1 Relay, 1 completed Link,
  and 1 Relay-enabled Link. No browser console errors were emitted.
- Promoted the Chamber pairs into one canonical Founding Hand mapping used by
  both new-game creation and the Chamber: Cat gets Jab/Keening, Geta gets
  Rime/Harden, and Wiggledrake gets Ashfall/Pyrewood. Wild and bred instances
  retain their species defaults.
- Regression coverage proves the real starters receive those pairs and ordinary
  species creation remains unchanged. Final verification: all 529 tests pass,
  the production build succeeds with the existing large-chunk warning, and a
  live Chamber run still completed Thermal Shock through the shared loadouts.
- Corrected weakness Tempo semantics: a landed weakness hit now generates Tempo
  whether or not the species/weakness was previously known. Knowledge remains a
  preview and tactics-AI concern only.
- Floor one remains a roguelite roll of one or two enemies, but draws from the
  ordinary shallow roster filtered to enemies vulnerable to at least one attack
  in the Founding Hand's loadouts. It does not reuse the Chamber's fixed trio or
  reveal its rolled wards for free.

## Battle Chamber AP interface and contract (2026-08-01)

- Shared AP Test is now the Chamber default; Expedition MP remains an explicitly
  labeled fixed-seed control rather than the screen's implicit starting mode.
- Corrected preset cards to identify their HP/resource values as player-party
  setup, made AP rules visible in the Chamber summary, and labeled Basic/Move
  root commands with their AP relationship during Shared AP combat.
- Shared AP text state now exposes formal resource rules and omits the inactive
  `partyMp` compatibility dictionary. Learned moves visibly deduct AP while
  Tempo remains independent and Relay-only.
- Added `docs/battle-chamber.md` as the development contract covering access,
  controls, shared production systems, test-only branches, and progression
  isolation. The combat architecture spec links to it.
- Replaced the hidden MP-aware tactics decision inside Shared AP auto-combat with
  a deterministic AP-aware Chamber policy. Tests prove it can select a learned
  move at zero MP when AP permits and falls back to Basic at zero AP.
- Browser QA covered the default menu, manual AP UI, learned-move spending,
  full auto completion, and side-by-side Expedition MP/AP results. Screen and
  text state agreed and no console errors were emitted.
- Final verification: all 522 tests pass and the production build succeeds with
  the existing large-chunk warning.

## Relay-ready fixture and reward consequence (2026-08-01)

- The Tempo Relay preset now begins with one Pack Tempo and an open Relay Window,
  so Relay is enabled on the first player turn instead of requiring an obscure
  Basic-then-wait setup before the mechanic can be tested.
- The Chamber card and text state disclose both fixture values. Browser QA queued
  Geta immediately, resolved Relay, spent one Tempo, consumed the Window, and
  preserved every actor's single timeline action without console errors.
- Recorded the unresolved expedition consequence in `docs/battle-chamber.md`:
  adopting Shared AP removes persistent MP attrition and the MP-recovery reward,
  so the reward loop needs an explicit replacement decision rather than an
  accidental substitute meter.
- Final verification: all 523 tests pass and the production build succeeds with
  the existing large-chunk warning.
