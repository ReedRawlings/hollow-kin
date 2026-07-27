import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TownScene } from './scenes/TownScene';
import { PartySelectScene } from './scenes/PartySelectScene';
import { RunScene } from './scenes/RunScene';
import { CombatScene } from './scenes/CombatScene';
import { ShopScene } from './scenes/ShopScene';
import { TownShopScene } from './scenes/TownShopScene';
import { RestScene } from './scenes/RestScene';
import { BreedingScene } from './scenes/BreedingScene';
import { LevelerScene } from './scenes/LevelerScene';
import { GatekeeperScene } from './scenes/GatekeeperScene';
import { BestiaryScene } from './scenes/BestiaryScene';
import { DepartureScene } from './scenes/DepartureScene';
import { PostCombatScene } from './scenes/PostCombatScene';
import { gameState } from './managers/GameState';
import { capacity, usedSlots } from './systems/Backpack';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 640;

/**
 * Pixel-perfect scaling.
 *
 * The requirement for pixel art is that one game pixel maps onto a whole number of
 * physical device pixels. Phaser's own pixel-art guide puts it plainly: "non-integer
 * scale will produce non-integer pixel positions."
 *
 * `Scale.FIT` breaks that — it picks whatever fraction fills the window. Measured on
 * a 1456x827 viewport at dpr 2 it produced a CSS size of 1252.5x835 and **2.609375
 * device pixels per game pixel**, which smears every glyph edge regardless of what
 * font size is asked for.
 *
 * So instead of letting the window decide, pick the largest INTEGER number of device
 * pixels per game pixel that still fits, and derive the CSS zoom from it. Costs some
 * letterboxing; buys an exact pixel grid.
 */
const dpr = window.devicePixelRatio || 1;

function integerDeviceScale(): number {
  const availableDeviceW = window.innerWidth * dpr;
  const availableDeviceH = window.innerHeight * dpr;
  return Math.max(1, Math.floor(Math.min(
    availableDeviceW / GAME_WIDTH,
    availableDeviceH / GAME_HEIGHT,
  )));
}

/** Whole device pixels per game pixel. The number that must stay an integer. */
const DEVICE_SCALE = integerDeviceScale();

/*
 * NOTE: an automatic font-size snap used to live here and has been removed.
 *
 * Both faces are 8px-grid bitmap fonts, so off-grid sizes are not perfectly crisp.
 * But rewriting sizes centrally breaks layouts either way: rounding pushed 12-15px
 * up to 16px and grew that text by a third (it shoved CombatScene's turn-order chip
 * into the title), and flooring shrank every heading instead.
 *
 * Sizes belong to the layouts that were tuned around them. Making them grid-valid is
 * a per-call-site job with layout adjustments alongside — not something a global
 * interceptor can do blind. Integer device-pixel scaling below is what actually
 * carries crispness, and it costs no layout.
 */

const origTextFactory = Phaser.GameObjects.GameObjectFactory.prototype.text;
(Phaser.GameObjects.GameObjectFactory.prototype as any).text = function (
  x: number, y: number, text: string | string[], style?: any
) {
  const s = { ...(style ?? {}) };
  // Rasterize each Text at exactly the final device-pixel density, so an 8px glyph
  // drawn at DEVICE_SCALE 2 is rasterized at 16px and lands 1:1 on device pixels —
  // no resampling at any stage. Using `dpr` here instead would only be correct when
  // DEVICE_SCALE happens to equal dpr.
  if (DEVICE_SCALE > 1) s.resolution = DEVICE_SCALE;
  // Only rewrite an explicit 'monospace'. Substituting for an unset family changed
  // the metrics of text that never asked for a pixel font, which moved layouts.
  if (s.fontFamily === 'monospace') s.fontFamily = 'Silkscreen, monospace';
  return origTextFactory.call(this, x, y, text, s);
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  backgroundColor: '#10121c',
  parent: document.body,
  scene: [BootScene, TownScene, PartySelectScene, RunScene, CombatScene, PostCombatScene, ShopScene, TownShopScene, RestScene, BreedingScene, LevelerScene, GatekeeperScene, BestiaryScene, DepartureScene],
  // Bitmap fonts and pixel art need the renderer to stop smoothing. `pixelArt: true`
  // is Phaser's shortcut for antialias:false + antialiasGL:false + roundPixels:true.
  render: {
    pixelArt: true,
  },
  scale: {
    // NONE, not FIT — FIT scales by a fraction and destroys the pixel grid.
    // zoom is the CSS multiplier that yields exactly DEVICE_SCALE device pixels
    // per game pixel (e.g. DEVICE_SCALE 2 at dpr 2 → zoom 1 → 960x640 CSS → 1920x1280
    // device). Always an exact ratio of two integers, never a rounded fraction.
    mode: Phaser.Scale.NONE,
    zoom: DEVICE_SCALE / dpr,
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

  // DEVICE_SCALE is chosen once from the window size at boot, so a resize (or dragging
  // the window to a monitor with a different dpr) would otherwise leave the game at a
  // stale zoom — too small, or overflowing. Recompute and re-apply, but only when the
  // integer actually changes; setZoom triggers a full canvas resize.
  let appliedScale = DEVICE_SCALE;
  window.addEventListener('resize', () => {
    const next = integerDeviceScale();
    if (next === appliedScale) return;
    appliedScale = next;
    game.scale.setZoom(next / dpr);
  });

  // Lightweight integration hooks used by the screenshot/playtest loop.
  (window as any).render_game_to_text = () => {
    const active = game.scene.getScenes(true)[0];
    return JSON.stringify({
      coordinateSystem: 'origin top-left; x right; y down; 960x640',
      scene: active?.scene.key ?? 'loading',
      essence: gameState.essence,
      backpack: {
        used: usedSlots(gameState.backpack),
        capacity: capacity(gameState.backpack),
        contents: gameState.backpack.slots.map(slot =>
          slot?.kind === 'item' ? slot.itemId : slot?.kind ?? null),
      },
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

  // Narrow, opt-in test controls for reaching stateful screens without playing
  // through a random tower seed. They are never installed in the normal game.
  const testParams = new URLSearchParams(window.location.search);
  if (testParams.has('test')) {
    const stopActiveScenes = () => {
      game.scene.getScenes(true).forEach(scene => game.scene.stop(scene.scene.key));
    };
    const testControls = {
      openProvisioner: (essence = 24) => {
        gameState.essence = essence;
        stopActiveScenes();
        game.scene.start('TownShopScene');
      },
      openMerchant: (obols = 80) => {
        stopActiveScenes();
        gameState.setRunParty(gameState.defaultParty);
        game.scene.start('RunScene');
        if (gameState.currentRun) {
          const run = gameState.currentRun;
          run.obols = obols;
          const [first, second, third] = gameState.runParty;
          if (first) run.partyHp[first.instanceId] = Math.floor(first.currentStats.hp * 0.5);
          if (second) run.partyMp[second.instanceId] = 0;
          if (third) run.partyKO[third.instanceId] = true;
        }
        game.scene.stop('RunScene');
        game.scene.start('ShopScene', {});
      },
    };
    (window as any).hollowKinTest = testControls;
    window.addEventListener('hollow-kin-test', ((event: CustomEvent<{
      screen: 'provisioner' | 'merchant';
      funds?: number;
    }>) => {
      if (event.detail.screen === 'provisioner') {
        testControls.openProvisioner(event.detail.funds);
      } else if (event.detail.screen === 'merchant') {
        testControls.openMerchant(event.detail.funds);
      }
    }) as EventListener);
    const requestedScreen = testParams.get('screen');
    const requestedFunds = Number(testParams.get('funds'));
    if (requestedScreen === 'provisioner' || requestedScreen === 'merchant') {
      window.setTimeout(() => {
        const funds = Number.isFinite(requestedFunds) ? requestedFunds : undefined;
        if (requestedScreen === 'provisioner') testControls.openProvisioner(funds);
        else testControls.openMerchant(funds);
      }, 100);
    }
  }

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
