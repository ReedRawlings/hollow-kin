import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { Encounter } from '../types';
import {
  SHOP_ITEMS, canBenefitFromShopItem, tryPurchaseShopItem,
  MERCHANT_ITEM_OFFERS, tryBuyItem,
} from '../systems/Shop';
import { getItem } from '../data/items';
import { isFull } from '../systems/Backpack';

/**
 * The tower merchant. Two kinds of offer, both paid in Obols (the in-run
 * currency): the original immediate-effect services (heal/MP/revive — the
 * player's mid-run survival options, kept as-is), and carryable items that
 * go into the shared backpack for later use in battle.
 */
export class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data: { encounter: Encounter }): void {
    const cx = this.cameras.main.centerX;
    const run = gameState.currentRun!;
    const bagFull = isFull(gameState.backpack);

    this.add.text(cx, 30, 'SHOP', {
      fontSize: '26px', color: '#88ccff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 58, `Obols: ${run.obols}`, {
      fontSize: '15px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(60, 86, 'SERVICES', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    });
    SHOP_ITEMS.forEach((item, i) => {
      const y = 118 + i * 56;
      const useful = canBenefitFromShopItem(item.id, run, gameState.runParty);
      const enabled = useful && run.obols >= item.cost;
      const bg = this.add.rectangle(cx, y, 340, 48, enabled ? 0x224466 : 0x222222, 0.9)
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
        fontSize: '13px', color: enabled ? '#ffffff' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const detail = useful ? `Cost: ${item.cost} Obols` : 'Not needed';
      this.add.text(cx, y + 11, detail, {
        fontSize: '11px', color: enabled ? '#88ccff' : '#444444', fontFamily: 'monospace',
      }).setOrigin(0.5);
    });

    const itemsTop = 118 + SHOP_ITEMS.length * 56 + 30;
    this.add.text(60, itemsTop, 'ITEMS — CARRIED HOME IN THE BAG', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    });
    MERCHANT_ITEM_OFFERS.forEach((offer, i) => {
      const def = getItem(offer.itemId);
      const y = itemsTop + 40 + i * 56;
      const affordable = run.obols >= offer.cost;
      const enabled = affordable && !bagFull;
      const bg = this.add.rectangle(cx, y, 340, 48, enabled ? 0x224422 : 0x222222, 0.9)
        .setStrokeStyle(2, enabled ? 0x44aa44 : 0x444444);

      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          const result = tryBuyItem(offer, run.obols, gameState.backpack);
          if (result.bought) {
            run.obols -= offer.cost;
            gameState.backpack = result.backpack;
            this.scene.restart(data);
          }
        });
        bg.on('pointerover', () => bg.setFillStyle(0x336633));
        bg.on('pointerout', () => bg.setFillStyle(0x224422));
      }

      this.add.text(cx, y - 8, def.name, {
        fontSize: '13px', color: enabled ? '#ffffff' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);
      const detail = bagFull ? 'Bag is full' : !affordable ? 'Not enough Obols' : `Cost: ${offer.cost} Obols`;
      this.add.text(cx, y + 11, detail, {
        fontSize: '11px', color: enabled ? '#88ccaa' : '#444444', fontFamily: 'monospace',
      }).setOrigin(0.5);
    });

    const continueY = itemsTop + 40 + MERCHANT_ITEM_OFFERS.length * 56 + 30;
    this.add.text(cx, continueY, 'CONTINUE', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace', padding: { x: 20, y: 10 },
      backgroundColor: '#333333',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('RunScene', { continueRun: true });
    });
  }
}
