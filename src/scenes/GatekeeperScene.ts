import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { depthUnlockCost, depthRunFee } from '../systems/Economy';

export class GatekeeperScene extends Phaser.Scene {
  /**
   * Everything drawn, tracked so it can be destroyed on redraw. children.removeAll()
   * only detaches — it leaves interactive objects registered and clickable.
   */
  private tracked: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'GatekeeperScene' });
  }

  create(): void {
    this.tracked = [];
    this.draw();
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.tracked.push(obj);
    return obj;
  }

  private destroyTracked(): void {
    for (const o of this.tracked) o.destroy();
    this.tracked = [];
  }

  private draw(): void {
    this.destroyTracked();
    const cx = this.cameras.main.centerX;

    this.track(this.add.rectangle(480, 320, 960, 640, 0x1a1a2e));
    this.track(this.add.text(cx, 30, 'THE GATEKEEPER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(cx, 62, 'Unlock a deeper starting point. Permanent, bought once.', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    }));

    const owned = gameState.unlockedStartFloors().filter(f => f > 1);
    this.track(this.add.text(20, 112, owned.length > 0
      ? `Unlocked: ${owned.map(f => `Floor ${f}`).join(', ')}`
      : 'Unlocked: none yet — you always begin at Floor 1', {
      fontSize: '12px', color: '#88ccaa', fontFamily: 'monospace',
    }));

    const purchasable = gameState.purchasableFloors();

    if (purchasable.length === 0) {
      this.track(this.add.text(cx, 240, gameState.deepestBreakCleared === 0
        ? 'Clear the floor-5 mini-boss to earn your first deeper start.'
        : 'Nothing left to unlock at your current depth. Clear another break.', {
        fontSize: '14px', color: '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5));
    }

    purchasable.forEach((floor, i) => {
      const y = 170 + i * 62;
      const cost = depthUnlockCost(floor);
      const affordable = gameState.essence >= cost;

      const bg = this.track(this.add.rectangle(cx, y, 460, 52, affordable ? 0x222240 : 0x1c1c28, 0.9)
        .setStrokeStyle(2, affordable ? 0x66aaff : 0x333344));
      this.track(this.add.text(cx, y - 9, `Unlock Floor ${floor}  —  ${cost} Essence`, {
        fontSize: '15px', color: affordable ? '#ffffff' : '#666677', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.track(this.add.text(cx, y + 12, `then ${depthRunFee(floor)} Essence each run you start there`, {
        fontSize: '11px', color: affordable ? '#8899aa' : '#555566', fontFamily: 'monospace',
      }).setOrigin(0.5));

      if (affordable) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x334466));
        bg.on('pointerout', () => bg.setFillStyle(0x222240));
        bg.on('pointerdown', () => {
          gameState.purchaseFloorUnlock(floor);
          gameState.saveToLocalStorage();
          this.draw();
        });
      }
    });

    const back = this.track(this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }));
    back.on('pointerdown', () => this.scene.start('TownScene'));
  }
}
