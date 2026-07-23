import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TownScene } from './scenes/TownScene';
import { PartySelectScene } from './scenes/PartySelectScene';
import { RunScene } from './scenes/RunScene';
import { CombatScene } from './scenes/CombatScene';
import { ShopScene } from './scenes/ShopScene';
import { RestScene } from './scenes/RestScene';
import { BreedingScene } from './scenes/BreedingScene';

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
    return origTextFactory.call(this, x, y, text, s);
  };
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  backgroundColor: '#1a1a2e',
  parent: document.body,
  scene: [BootScene, TownScene, PartySelectScene, RunScene, CombatScene, ShopScene, RestScene, BreedingScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);
