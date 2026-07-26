import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { Encounter } from '../types';
import {
  RecoveryKind, applyTargetedRecovery, canReceiveRecovery,
  eligibleRecoveryTargets,
} from '../systems/Recovery';

export class RestScene extends Phaser.Scene {
  private choiceMade = false;

  constructor() {
    super({ key: 'RestScene' });
  }

  create(data: { encounter: Encounter }): void {
    this.choiceMade = false;
    this.drawRewardChoices(data);
  }

  private drawRewardChoices(data: { encounter: Encounter }): void {
    this.children.removeAll(true);
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 40, 'REST POINT', {
      fontSize: '28px', color: '#44aa44', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 80, 'Choose one:', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const options = [
      {
        name: 'Restore HP (50% for one)',
        targeted: { kind: 'hp' as RecoveryKind, fraction: 0.5 },
      },
      {
        name: 'Restore MP (Full for one)',
        targeted: { kind: 'mp' as RecoveryKind, fraction: 1 },
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
        targeted: undefined,
      },
    ];

    options.forEach((opt, i) => {
      const y = 180 + i * 80;
      const useful = !opt.targeted || eligibleRecoveryTargets(
        opt.targeted.kind, gameState.runParty, gameState.currentRun!,
      ).length > 0;
      const bg = this.add.rectangle(cx, y, 340, 55, useful ? 0x224422 : 0x222222, 0.9)
        .setStrokeStyle(2, useful ? 0x44aa44 : 0x444444);

      this.add.text(cx, y, opt.name, {
        fontSize: '14px', color: useful ? '#ffffff' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);

      if (useful) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x336633));
        bg.on('pointerout', () => bg.setFillStyle(0x224422));
        bg.on('pointerdown', () => {
          if (this.choiceMade) return;
          this.choiceMade = true;
          if (opt.targeted) {
            this.drawTargetSelection(opt.targeted.kind, opt.targeted.fraction, data);
            return;
          }
          opt.action?.();
          bg.setStrokeStyle(3, 0x88ff88);
          this.time.delayedCall(800, () => {
            this.scene.start('RunScene', { continueRun: true });
          });
        });
      }
    });
  }

  private drawTargetSelection(
    kind: RecoveryKind,
    fraction: number,
    data: { encounter: Encounter },
  ): void {
    this.children.removeAll(true);
    const cx = this.cameras.main.centerX;
    const run = gameState.currentRun!;

    this.add.text(cx, 55, kind === 'hp' ? 'WHO SHOULD RECOVER HP?' : 'WHO SHOULD RECOVER MP?', {
      fontSize: '24px', color: kind === 'hp' ? '#66cc66' : '#6699ff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(cx, 90, 'Choose one creature:', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    gameState.runParty.forEach((creature, i) => {
      const template = getTemplate(creature.speciesId);
      const x = 200 + i * 280;
      const y = 280;
      const eligible = canReceiveRecovery(kind, creature, run);
      const current = kind === 'hp'
        ? (run.partyHp[creature.instanceId] ?? 0)
        : (run.partyMp[creature.instanceId] ?? 0);
      const max = kind === 'hp' ? creature.currentStats.hp : creature.currentStats.mp;

      const bg = this.add.rectangle(x, y, 230, 150, eligible ? 0x223344 : 0x222222, 0.95)
        .setStrokeStyle(2, eligible ? 0x66aacc : 0x444444);
      this.add.rectangle(x, y - 30, 44, 44, eligible ? template.spriteColor : 0x444444);
      this.add.text(x, y + 10, creature.nickname ?? template.name, {
        fontSize: '14px', color: eligible ? '#ffffff' : '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.add.text(x, y + 35, `${kind.toUpperCase()} ${current} / ${max}`, {
        fontSize: '12px', color: eligible ? '#aaccff' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);

      if (eligible) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x334466));
        bg.on('pointerout', () => bg.setFillStyle(0x223344));
        bg.on('pointerdown', () => {
          const recovered = applyTargetedRecovery(kind, fraction, creature, run);
          this.choiceMade = true;
          this.children.removeAll(true);
          this.add.text(cx, 300,
            `${creature.nickname ?? template.name} recovered ${recovered} ${kind.toUpperCase()}!`, {
              fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
            }).setOrigin(0.5);
          this.time.delayedCall(650, () => {
            this.scene.start('RunScene', { continueRun: true });
          });
        });
      }
    });

    this.add.text(30, 600, '← Back to rewards', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.choiceMade = false;
      this.drawRewardChoices(data);
    });
  }
}
