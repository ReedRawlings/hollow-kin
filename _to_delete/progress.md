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
- Shared Tempo uses test-only starter loadouts so every Kin has a builder and a
  payoff/setup move; expedition loadouts and resource rules remain unchanged.
- Expanded instrumentation with move-vs-Relay spending, player/enemy action
  counts, saturation waste, and Pack First contested-round frequency to detect
  whether Tempo is erasing meaningful initiative.
- Targeted Pack Tempo/Battle Chamber tests pass (11 tests), and the production
  build succeeds with the existing large-chunk warning.
