import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { Encounter } from '../types';

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

    this.add.text(cx, 80, `Plasm: ${run.plasm}`, {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const items = [
      { name: 'Heal Party (50% HP)', cost: 20, action: () => this.healParty(0.5) },
      { name: 'Restore MP (Full)', cost: 25, action: () => this.restoreMp(1.0) },
      { name: 'Revive Creature', cost: 40, action: () => this.reviveOne() },
    ];

    items.forEach((item, i) => {
      const y = 180 + i * 80;
      const canAfford = run.plasm >= item.cost;
      const bg = this.add.rectangle(cx, y, 300, 55, canAfford ? 0x224466 : 0x222222, 0.9)
        .setStrokeStyle(2, canAfford ? 0x4488aa : 0x444444);

      if (canAfford) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          run.plasm -= item.cost;
          item.action();
          this.scene.restart(data);
        });
        bg.on('pointerover', () => bg.setFillStyle(0x336688));
        bg.on('pointerout', () => bg.setFillStyle(0x224466));
      }

      this.add.text(cx, y - 8, item.name, {
        fontSize: '14px', color: canAfford ? '#ffffff' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.add.text(cx, y + 12, `Cost: ${item.cost} Plasm`, {
        fontSize: '12px', color: canAfford ? '#88ccff' : '#444444', fontFamily: 'monospace',
      }).setOrigin(0.5);
    });

    this.add.text(cx, 520, 'CONTINUE', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'monospace', padding: { x: 20, y: 10 },
      backgroundColor: '#333333',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('RunScene', { continueRun: true });
    });
  }

  private healParty(pct: number): void {
    const run = gameState.currentRun!;
    for (const c of gameState.runParty) {
      if (!run.partyKO[c.instanceId]) {
        const max = c.currentStats.hp;
        run.partyHp[c.instanceId] = Math.min(max, (run.partyHp[c.instanceId] ?? 0) + Math.floor(max * pct));
      }
    }
  }

  private restoreMp(pct: number): void {
    const run = gameState.currentRun!;
    for (const c of gameState.runParty) {
      if (!run.partyKO[c.instanceId]) {
        const max = c.currentStats.mp;
        run.partyMp[c.instanceId] = Math.min(max, (run.partyMp[c.instanceId] ?? 0) + Math.floor(max * pct));
      }
    }
  }

  private reviveOne(): void {
    const run = gameState.currentRun!;
    const ko = gameState.runParty.find(c => run.partyKO[c.instanceId]);
    if (ko) {
      run.partyKO[ko.instanceId] = false;
      run.partyHp[ko.instanceId] = Math.floor(ko.currentStats.hp * 0.25);
      run.partyMp[ko.instanceId] = Math.floor(ko.currentStats.mp * 0.25);
    }
  }
}
