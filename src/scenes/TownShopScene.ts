import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getItem } from '../data/items';
import { TOWN_ITEM_OFFERS, tryBuyItem } from '../systems/Shop';
import { isFull, usedSlots, capacity } from '../systems/Backpack';

/**
 * The town shop. Sells the same carryable items as the tower merchant
 * (ShopScene), but paid in Essence — Obols don't exist outside a run, and this
 * is where the player stocks up before the next descent.
 */
export class TownShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TownShopScene' });
  }

  create(): void {
    this.draw();
  }

  private draw(): void {
    this.children.removeAll(true);
    const cx = this.cameras.main.centerX;
    const bag = gameState.backpack;
    const bagFull = isFull(bag);

    this.add.text(cx, 30, 'THE PROVISIONER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(cx, 62, 'Spend Essence on supplies to carry into the tower.', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    });
    this.add.text(20, 112, `Bag: ${usedSlots(bag)}/${capacity(bag)} slots used`, {
      fontSize: '12px', color: bagFull ? '#cc7766' : '#88ccaa', fontFamily: 'monospace',
    });

    TOWN_ITEM_OFFERS.forEach((offer, i) => {
      const def = getItem(offer.itemId);
      const y = 175 + i * 96;
      const affordable = gameState.essence >= offer.cost;
      const enabled = affordable && !bagFull;

      const bg = this.add.rectangle(cx, y, 520, 76, enabled ? 0x222240 : 0x1c1c28, 0.9)
        .setStrokeStyle(2, enabled ? 0x66aaff : 0x333344);
      this.add.text(cx, y - 22, `${def.name}  —  ${offer.cost} Essence`, {
        fontSize: '15px', color: enabled ? '#ffffff' : '#666677', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.add.text(cx, y, def.description, {
        fontSize: '11px', color: enabled ? '#8899aa' : '#555566', fontFamily: 'monospace',
      }).setOrigin(0.5);

      const reason = bagFull ? 'Bag is full' : !affordable ? 'Not enough Essence' : '';
      if (reason) {
        this.add.text(cx, y + 22, reason, {
          fontSize: '10px', color: '#aa6666', fontFamily: 'monospace',
        }).setOrigin(0.5);
      }

      if (enabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x334466));
        bg.on('pointerout', () => bg.setFillStyle(0x222240));
        bg.on('pointerdown', () => {
          const result = tryBuyItem(offer, gameState.essence, gameState.backpack);
          if (result.bought) {
            gameState.essence -= offer.cost;
            gameState.backpack = result.backpack;
            gameState.saveToLocalStorage();
            this.draw();
          }
        });
      }
    });

    const back = this.add.text(24, 20, '← TOWN', {
      fontSize: '12px', color: '#f7f3b7', fontFamily: 'monospace',
      backgroundColor: '#2c1e31', padding: { x: 10, y: 7 },
    }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('TownScene'));
  }
}
