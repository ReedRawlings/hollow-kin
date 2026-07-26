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
if (dpr > 1) {
  const origTextFactory = Phaser.GameObjects.GameObjectFactory.prototype.text;
  (Phaser.GameObjects.GameObjectFactory.prototype as any).text = function (
    x: number, y: number, text: string | string[], style?: any
  ) {
    const s = style ? { ...style, resolution: dpr } : { resolution: dpr };
    if (s.fontFamily === 'monospace') s.fontFamily = 'Silkscreen, monospace';
    return origTextFactory.call(this, x, y, text, s);
  };
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  backgroundColor: '#10121c',
  parent: document.body,
  scene: [BootScene, TownScene, PartySelectScene, RunScene, CombatScene, PostCombatScene, ShopScene, RestScene, BreedingScene, LevelerScene, GatekeeperScene, BestiaryScene, DepartureScene],
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
