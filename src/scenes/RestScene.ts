import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { Encounter } from '../types';

export class RestScene extends Phaser.Scene {
  private choiceMade = false;

  constructor() {
    super({ key: 'RestScene' });
  }

  create(data: { encounter: Encounter }): void {
    this.choiceMade = false;
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 40, 'REST POINT', {
      fontSize: '28px', color: '#44aa44', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 80, 'Choose one:', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const options = [
      {
        name: 'Restore HP (50% to all)',
        action: () => {
          const run = gameState.currentRun!;
          for (const c of gameState.runParty) {
            if (!run.partyKO[c.instanceId]) {
              const max = c.currentStats.hp;
              run.partyHp[c.instanceId] = Math.min(max, (run.partyHp[c.instanceId] ?? 0) + Math.floor(max * 0.5));
            }
          }
        },
      },
      {
        name: 'Restore MP (Full for one)',
        action: () => {
          const run = gameState.currentRun!;
          const target = gameState.runParty.find(c => !run.partyKO[c.instanceId]);
          if (target) {
            run.partyMp[target.instanceId] = target.currentStats.mp;
          }
        },
      },
      {
        name: 'Rest & Recover (20% HP + 20% MP all)',
        action: () => {
          const run = gameState.currentRun!;
          for (const c of gameState.runParty) {
            if (!run.partyKO[c.instanceId]) {
              run.partyHp[c.instanceId] = Math.min(c.currentStats.hp,
                (run.partyHp[c.instanceId] ?? 0) + Math.floor(c.currentStats.hp * 0.2));
              run.partyMp[c.instanceId] = Math.min(c.currentStats.mp,
                (run.partyMp[c.instanceId] ?? 0) + Math.floor(c.currentStats.mp * 0.2));
            }
          }
        },
      },
    ];

    options.forEach((opt, i) => {
      const y = 180 + i * 80;
      const bg = this.add.rectangle(cx, y, 340, 55, 0x224422, 0.9)
        .setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true });

      this.add.text(cx, y, opt.name, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5);

      bg.on('pointerover', () => bg.setFillStyle(0x336633));
      bg.on('pointerout', () => bg.setFillStyle(0x224422));
      bg.on('pointerdown', () => {
        if (this.choiceMade) return;
        this.choiceMade = true;
        opt.action();
        bg.setStrokeStyle(3, 0x88ff88);

        this.time.delayedCall(800, () => {
          this.scene.start('RunScene', { continueRun: true });
        });
      });
    });
  }
}
