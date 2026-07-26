import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { Encounter } from '../types';
import {
  SHOP_ITEMS, canBenefitFromShopItem, tryPurchaseShopItem,
} from '../systems/Shop';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data: { encounter: Encounter }): void {
    const cx = this.cameras.main.centerX;
    const run = gameState.currentRun!;

    this.add.text(cx, 40, 'SHOP', {
      fontSize: '28px', color: '#88ccff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 80, `Obols: ${run.obols}`, {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    SHOP_ITEMS.forEach((item, i) => {
      const y = 180 + i * 80;
      const useful = canBenefitFromShopItem(item.id, run, gameState.runParty);
      const enabled = useful && run.obols >= item.cost;
      const bg = this.add.rectangle(cx, y, 300, 55, enabled ? 0x224466 : 0x222222, 0.9)
        .setStrokeStyle(2, enabled ? 0x4488aa : 0x444444);

      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          if (tryPurchaseShopItem(item, run, gameState.runParty)) {
            this.scene.restart(data);
          }
        });
        bg.on('pointerover', () => bg.setFillStyle(0x336688));
        bg.on('pointerout', () => bg.setFillStyle(0x224466));
      }

      this.add.text(cx, y - 8, item.name, {
        fontSize: '14px', color: enabled ? '#ffffff' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const detail = useful ? `Cost: ${item.cost} Obols` : 'Not needed';
      this.add.text(cx, y + 12, detail, {
        fontSize: '12px', color: enabled ? '#88ccff' : '#444444', fontFamily: 'monospace',
      }).setOrigin(0.5);
    });

    this.add.text(cx, 520, 'CONTINUE', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace', padding: { x: 20, y: 10 },
      backgroundColor: '#333333',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('RunScene', { continueRun: true });
    });
  }

}
