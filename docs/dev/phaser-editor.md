# Phaser Editor workflow

Hollow Kin runs on Phaser 4.2.1 and is configured for Phaser Editor v5. Open the repository root as the Editor project.

## Start the game from Phaser Editor

1. Run `npm install` once.
2. Run `npm run editor:dev` in a terminal.
3. Open this repository folder in Phaser Editor v5.
4. Use Play in Phaser Editor. The project configuration opens `http://127.0.0.1:5173/?editor=1`.

The Editor project configuration filters generated output, dependencies, automated-test artifacts, and design documents. Its Scene Editor uses pixel-art rendering by default.

## Assets

Put new runtime images, atlases, audio, tilemaps, and similar files under `public/assets/`. The empty `public/publicroot` marker tells Phaser Editor that `public/` maps to the website root, so an asset stored at `public/assets/example.png` receives the runtime URL `assets/example.png`.

Add assets to `public/assets/asset-pack.json` with the Asset Pack Editor. `BootScene.preload()` loads this pack once for the game, so scenes can use its keys after boot. The existing fonts remain under `public/fonts/` because they are loaded through CSS rather than Phaser's Loader.

## Visual scenes

The existing scenes in `src/scenes/` are handwritten and should stay that way unless there is a deliberate conversion plan. Phaser Editor cannot reconstruct a visual `.scene` source from arbitrary scene code.

Create new visual scenes and prefabs under `src/editor/`. `src/editor/scenes/EditorSandbox.scene` is a safe starting canvas with Hollow Kin's 960×640 dimensions. Its paired `.ts` file demonstrates the generated-code boundary.

For new Scene files, use these compiler settings:

- Output Language: TypeScript
- Export Class: enabled
- Auto Import (ES Module): enabled
- Create Method: `editorCreate`
- Border: 960 × 640

Keep visual construction inside the Editor-managed compiled section. Put gameplay logic inside the generated user-code markers or, for larger systems, in regular handwritten modules under `src/systems/` and `src/managers/`.

To ship an Editor-created scene, import its generated TypeScript class in `src/main.ts` and add it to the Phaser game configuration's `scene` array. Do not register `EditorSandbox` for production; it is an isolated design scratchpad.
