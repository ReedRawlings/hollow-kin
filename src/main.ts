import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TownScene } from './scenes/TownScene';
import { PartySelectScene } from './scenes/PartySelectScene';
import { RunScene } from './scenes/RunScene';
import { CombatScene } from './scenes/CombatScene';
import { ShopScene } from './scenes/ShopScene';
import { RestScene } from './scenes/RestScene';
import { BreedingScene } from './scenes/BreedingScene';
import { LevelerScene } from './scenes/LevelerScene';
import { GatekeeperScene } from './scenes/GatekeeperScene';
import { BestiaryScene } from './scenes/BestiaryScene';
import { DepartureScene } from './scenes/DepartureScene';
import { PostCombatScene } from './scenes/PostCombatScene';
import { gameState } from './managers/GameState';

// Fix blurry text on HiDPI displays.
// Phaser Text renders to an internal canvas. We inject `resolution: dpr` into the
// style object BEFORE construction so the internal canvas is sized correctly from
// the start. Patching after construction (setResolution) is too late — the first
// render already happened at 1x.
const dpr = window.devicePixelRatio || 1;

/**
 * Both UI faces are 8px-grid bitmap fonts — Press Start 2P is documented as
 * "8px, 16px and other multiples of 8", and Silkscreen is drawn on the same grid.
 * A bitmap font has no curves to re-fit, so at any size that is not an integer
 * multiple of its grid the rasterizer invents partial pixels and the glyphs turn
 * to mush.
 *
 * Sizes are hardcoded at ~190 call sites across the scenes, so this snaps them
 * centrally at the one chokepoint every Text object passes through. Scenes may
 * still ask for 11px; they just get 8px. Fixing the call sites to use a real type
 * scale is the proper cleanup — this keeps the render correct meanwhile.
 */
const FONT_GRID = 8;
function snapToGrid(fontSize: unknown): string | undefined {
  if (typeof fontSize !== 'string') return undefined;
  const px = parseFloat(fontSize);
  if (!Number.isFinite(px)) return undefined;
  return `${Math.max(FONT_GRID, Math.round(px / FONT_GRID) * FONT_GRID)}px`;
}

const origTextFactory = Phaser.GameObjects.GameObjectFactory.prototype.text;
(Phaser.GameObjects.GameObjectFactory.prototype as any).text = function (
  x: number, y: number, text: string | string[], style?: any
) {
  const s = { ...(style ?? {}) };
  // Bitmap glyphs must land on whole device pixels, so draw at DPR and let the
  // browser map 1 font pixel onto an integer number of screen pixels.
  if (dpr > 1) s.resolution = dpr;
  if (s.fontFamily === 'monospace' || s.fontFamily === undefined) {
    s.fontFamily = 'Silkscreen, monospace';
  }
  const snapped = snapToGrid(s.fontSize);
  if (snapped) s.fontSize = snapped;
  return origTextFactory.call(this, x, y, text, s);
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  backgroundColor: '#10121c',
  parent: document.body,
  scene: [BootScene, TownScene, PartySelectScene, RunScene, CombatScene, PostCombatScene, ShopScene, RestScene, BreedingScene, LevelerScene, GatekeeperScene, BestiaryScene, DepartureScene],
  // Bitmap fonts and pixel art need the renderer to stop smoothing. `pixelArt: true`
  // is Phaser's shortcut for antialias:false + antialiasGL:false + roundPixels:true.
  render: {
    pixelArt: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

// Phaser rasterizes text into its own canvas, so the bundled fonts must be
// ready before any scene creates Text objects or the fallback face can become
// baked into that object for the rest of the session.
Promise.all([
  document.fonts.load('12px "Press Start 2P"'),
  document.fonts.load('12px Silkscreen'),
  document.fonts.load('700 12px Silkscreen'),
]).catch(() => {
  // The game remains playable with the CSS fallbacks if a bundled font fails
  // to decode or is unavailable in an older browser.
}).then(() => {
  const game = new Phaser.Game(config);

  // Lightweight integration hooks used by the screenshot/playtest loop.
  (window as any).render_game_to_text = () => {
    const active = game.scene.getScenes(true)[0];
    return JSON.stringify({
      coordinateSystem: 'origin top-left; x right; y down; 960x640',
      scene: active?.scene.key ?? 'loading',
      essence: gameState.essence,
      run: gameState.currentRun ? {
        floor: gameState.currentRun.currentEncounterIndex >= 0
          ? gameState.currentRun.encounters[gameState.currentRun.currentEncounterIndex]?.floor
          : gameState.currentRun.startFloor,
        obols: gameState.currentRun.obols,
        auto: gameState.currentRun.autoCombat,
        partyHp: gameState.currentRun.partyHp,
        partyMp: gameState.currentRun.partyMp,
        partyKO: gameState.currentRun.partyKO,
      } : null,
    });
  };

  // The Playwright harness installs a deterministic version before this module
  // runs. Keep it when present; this fallback makes the hook available in normal
  // browser sessions without manually driving Phaser's internal RAF loop.
  if (!(window as any).advanceTime) {
    (window as any).advanceTime = (ms: number) => new Promise<void>((resolve) => {
      const started = performance.now();
      const step = (now: number) => {
        if (now - started >= ms) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
});
