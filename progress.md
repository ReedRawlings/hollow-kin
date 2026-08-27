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
