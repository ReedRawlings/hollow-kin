Original prompt: We also have access to phaser editor I'd like to migrate to phaser 4.2.1 and get ready to use phaser editor where possible

## 2026-08-23

- Started migration audit. The project is a Vite + TypeScript Phaser 3.90 application with handwritten scenes and a browser playtest harness.
- Existing unrelated worktree change: `.DS_Store` is modified; preserve it.
- Initial API scan found no custom pipelines, shaders, masks, FX, or renderer internals. The main migration-sensitive customization is the global Text factory wrapper in `src/main.ts`.
- Baseline before migration: 31 test files / 531 tests passed; production build succeeded on Phaser 3.90.0.
- Pinned `phaser` to `4.2.1` and regenerated `package-lock.json` with `npm install`.
- Phaser 4.2.1 compiles without source changes. All 531 tests still pass and the production build succeeds.
- `npm install` reports 4 transitive audit findings (2 moderate, 2 high); no automatic audit fix was run because it is outside the engine migration and could broaden dependency changes.
- Browser validation on Phaser 4.2.1 covered the new-game screen, name-to-dialogue transition, and multi-step combat input. Text, pixel scaling, input, scene transitions, and combat rendering matched the pre-migration layout with no console errors.
- Added Phaser Editor v5 project configuration, a `public/` root marker, an Asset Pack manifest loaded by `BootScene`, an isolated 960×640 `EditorSandbox.scene`, and workflow documentation.
- Verified all Editor JSON files parse, all tests/build pass after integration, and the installed Phaser Editor v5.0.3 reads the project config and serves the project successfully. The configured Vite play URL returned HTTP 200.
- Browser screenshots/state logs were reviewed and moved out of the worktree to `/private/tmp/hollow-kin-phaser4-migration-20260823/`.

## TODO / suggestions

- Open `src/editor/scenes/EditorSandbox.scene` in Phaser Editor and use it as a disposable visual-design scratchpad.
- Add future images/audio/atlases under `public/assets/` through `asset-pack.json`.
- Convert existing handwritten scenes only when a scene has enough visual layout work to justify a deliberate one-at-a-time conversion.
- Review the 4 npm audit findings separately; do not run `npm audit fix --force` as part of the Phaser migration.

## 2026-08-26

- Began the combat architecture refactor requested after the Phaser 4 migration.
- Added `src/systems/combat/Battle.ts`, a Phaser-free owner for combatants, turn order, phases, enemy intents, action resolution, items, auto combat, Tempo/Relay/Link state, rite records, and the deterministic browser snapshot.
- Reduced `CombatScene.ts` from about 1,700 lines to 971 lines. It now connects the battle model to Phaser timing, menus/target selection, drawing, and scene transitions/rewards.
- Production TypeScript/Vite build passes after the extraction.
- All 31 test files / 531 tests pass after the extraction.
- Browser regression covered manual combat actions and an auto-combat sequence; rendered HP/MP, intents, turn order, rites, Tempo, and the text-state snapshot remained synchronized with no console errors.
- A seeded Battle Chamber auto run completed to victory and returned to the chamber with its round/action/Tempo/Relay metrics intact.
- Finished the thin-scene pass: `Battle.playerAct(...)` is now called directly from targeting/menu callbacks, and obsolete forwarding methods were removed from `CombatScene`.
- Moved all normal victory/defeat, Battle Chamber result, and Smoke Husk settlement rules into `Battle.settle(...)` / `Battle.settleEscape()`. Scene exit methods now only destroy the view and navigate to the returned destination.
- `CombatScene.ts` is now about 750 lines; its remaining responsibilities are Phaser lifecycle/timing, menu and target state, command-panel view construction, rendering/HUD, and scene navigation.
- Revalidated all 531 tests and the production build after the completed thin-scene pass.
- Browser validation covered direct manual player actions, seeded Battle Chamber victory settlement, and normal expedition victory settlement into `PostCombatScene`; XP, level-ups, Obols, HP/MP, metrics, rendering, and text snapshots were intact with no console errors.

## Combat refactor TODO / suggestions

- Consider extracting `buildCommandPanel()` into a separately tested view-model builder after the persistent renderer settles.

## 2026-08-26 — persistent combat rendering

- Replaced `renderBattlefield(...)` with a persistent `CombatBattlefield` owner.
- Enemy tiles now persist for the battle and update intent, HP width/color, status text, target marker, KO state, and input enablement in place.
- Party cards now persist and update active/KO framing, HP/MP or shared AP text, status text, and ally-targeting input in place.
- Footer text persists and updates in place. Header, command panel, and the four-object AUTO/SPEED HUD are bounded rebuild regions; the full scene is no longer destroyed during `redraw()`.
- Production build passes after the first persistent-renderer implementation.
- Browser validation covered manual Magic actions, pointer target changes, repeated turn updates, persistent target/HP/status rendering, command-panel shape changes, and a complete seeded auto battle back to the Chamber with no console errors.
- Final production build passes, and the combat-focused logic subset passes 96/96 tests across CombatEngine, Tempo, timeline, Links, Chamber, shared actions, and tactics.
- The full suite currently has five unrelated economy/breeding expectation failures because concurrent workspace edits changed `LEVEL_COST_BASE` from 10 to 14 without updating older GameState/Breeding assertions. Those concurrent changes were preserved and not folded into the rendering task.

## 2026-08-27 — mechanics audit and first cuts

Four parallel auditors classified every mechanic in `src/` and the design docs (finished / rough / engine-only / docs-only / vestigial). Full ledger: https://claude.ai/code/artifact/687334e2-7365-4633-8837-00bfa5f87c13. Decisions taken from it so far:

- **Relics are removed as a concept.** Boons (`Boons.ts`, `data/boons.ts`) already deliver everything relics promised — run-scoped, auto-applied, neutral-valued queries — and a `battlesLeft: null` boon is a run-long boon (Gary's Gift already uses it). Keeping a second name for the same layer only invited duplicate code. `relics.md` is deleted; every live doc and every `src/` mention is rewritten, not commented out. The Encore Relay chamber prototype (`relic_extra` turn slots, `createExtraTurnSlot`, the `encoreRelay` chamber flag) existed only as a relic prototype and goes with it. If an "extra action" modifier is ever wanted, build it as a boon effect kind.
- **THE ORACLE and NOTICE BOARD town tiles are removed.** The Oracle was shuttered, undesigned and referenced by no doc; the Notice Board was a one-line tooltip with no scene and a permanently disabled action button. The bottom town row is re-laid around THE ROOST / HATCHERY / THE ARCHIVE.
- Point-in-time records under `docs/superpowers/` and the retired `breeding-stones.md` are deliberately left as written — they are history, not guidance.
- Added `docs/tools/level-calculator.xlsx`: an exact in-run level model (per-encounter log + expected-value scenario) built from `Battle.ts` XP rules and `GameState.tryLevelUp`; verified against the game loop. Finding: a full 1→20 descent yields ~296 XP → level 7 from level 1, so a 0★ starter caps at 5 by mid-run.

Still open from the audit (not yet acted on): Shared Action Pool cut, event-room payout, Power Increase item, dead fields (`isBreedReady`, `xpEarned`, `hasCompletedFirstRun`, `kind:'mark'`, `tempoGeneration`, `blind`), the unenforced breed-readiness gate, the undocumented Gary stage-2 gate on depth-jumps, and CLAUDE.md/GDD staleness (Phaser 4, save v10, RELAY, intents, Tempo, Gary).
- **Shared Action Pool stays.** It is Battle Chamber-only (`resourceModel === 'shared_actions'`) and may be revisited; do not propose cutting it again. The audit's "legacy comparison" label describes its current role, not a decision to remove it.
- **Random event rooms stay** through alpha. They are meant to be the Slay-the-Spire-style small gamble — a reprieve or a run-altering find — and the current placeholder payout (free Obols/XP/heal, no choice) is acknowledged as strictly better than a fight. Design pass pending; do not cut.
- **Event rooms get a real design** (spec: `docs/superpowers/specs/2026-08-27-event-rooms-design.md`). Every event is an offer with ACCEPT / WALK AWAY; events grant no XP (only a triggered fight does); Obol-priced events cost 10% of current Obols; no event can KO. Five events: Mercy Well (10% HP+MP to all for 10% Obols), Blood Boon (random boon, a random creature loses 20% current HP), The Dice (d12 HP transfer, player picks donor and recipient), Tinker's Trade (10% Obols for one of three items), Warden's Wager (a fight with Obols and XP ×2). The placeholder free-payout branch in `RunScene` is deleted, along with the dead `RunState.xpEarned`.
- **Power Increase becomes party-wide** (every living ally +1 STR stage) rather than being cut. No ability targets all allies, so this is the one thing the MAGIC menu cannot do — that is its niche. Deliberately STR-only: item specificity is a feature, and an INT sibling is the answer if Mage-heavy parties never buy it. Price moves up to sit between Clearroot and Grave Ash. Id stays `power_increase`.
- **Keyboard regression from the Phaser 4 migration, found while building EventScene.** Phaser 4's `KeyboardPlugin.shutdown()` calls `removeAllListeners()` on every scene stop, so the bind-once `keyboardBound` guard in RunScene, ShopScene, PostCombatScene, TownShopScene and BattleChamberScene left those scenes deaf from their second visit. Fix: bind in every `create()`. Do not reintroduce a bind-once guard in any scene.
