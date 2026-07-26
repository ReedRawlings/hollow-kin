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
