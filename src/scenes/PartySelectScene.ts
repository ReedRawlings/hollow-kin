import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';

export class PartySelectScene extends Phaser.Scene {
  private selected: string[] = [];
  private cards: { bg: Phaser.GameObjects.Rectangle; id: string }[] = [];
  private confirmBtn!: Phaser.GameObjects.Rectangle;
  private confirmText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PartySelectScene' });
  }

  create(): void {
    this.selected = [];
    this.cards = [];
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 30, 'SELECT YOUR PARTY (3)', {
      fontSize: '24px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 60, 'Click creatures to select/deselect', {
      fontSize: '14px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const available = gameState.creatureBox.filter(c => !c.isRetired && c.longevity > 0);

    available.forEach((creature, i) => {
      const template = getTemplate(creature.speciesId);
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 180 + col * 260;
      const y = 130 + row * 140;

      const bg = this.add.rectangle(x, y + 30, 230, 120, 0x222244, 0.9)
        .setStrokeStyle(2, 0x444466).setInteractive({ useHandCursor: true });

      // Creature color square
      this.add.rectangle(x - 80, y + 20, 45, 45, template.spriteColor);

      // Info text
      this.add.text(x - 45, y - 10, template.name, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
      });
      this.add.text(x - 45, y + 10, `${template.archetype} | ★${creature.starRating}`, {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
      });
      this.add.text(x - 45, y + 28, `HP:${creature.currentStats.hp} STR:${creature.currentStats.str} DEF:${creature.currentStats.def}`, {
        fontSize: '10px', color: '#888888', fontFamily: 'monospace',
      });
      this.add.text(x - 45, y + 42, `INT:${creature.currentStats.int} SPD:${creature.currentStats.spd} WIS:${creature.currentStats.wis}`, {
        fontSize: '10px', color: '#888888', fontFamily: 'monospace',
      });
      this.add.text(x - 45, y + 58, `Longevity: ${creature.longevity}`, {
        fontSize: '10px', color: creature.longevity <= 1 ? '#ff4444' : '#44ff44', fontFamily: 'monospace',
      });

      bg.on('pointerdown', () => this.toggleSelect(creature.instanceId, bg));
      this.cards.push({ bg, id: creature.instanceId });
    });

    // Confirm button
    this.confirmBtn = this.add.rectangle(cx, 560, 200, 50, 0x336633, 0.5)
      .setStrokeStyle(2, 0x44aa44).setInteractive({ useHandCursor: true });
    this.confirmText = this.add.text(cx, 560, 'CONFIRM (0/3)', {
      fontSize: '16px', color: '#88aa88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.confirmBtn.on('pointerdown', () => {
      if (this.selected.length === 3) {
        gameState.setRunParty(this.selected);
        this.scene.start('RunScene');
      }
    });

    // Back button
    this.add.text(30, 560, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('TownScene');
    });
  }

  private toggleSelect(instanceId: string, bg: Phaser.GameObjects.Rectangle): void {
    const idx = this.selected.indexOf(instanceId);
    if (idx !== -1) {
      this.selected.splice(idx, 1);
      bg.setStrokeStyle(2, 0x444466);
    } else if (this.selected.length < 3) {
      this.selected.push(instanceId);
      bg.setStrokeStyle(3, 0x44ff44);
    }
    this.updateConfirm();
  }

  private updateConfirm(): void {
    this.confirmText.setText(`CONFIRM (${this.selected.length}/3)`);
    if (this.selected.length === 3) {
      this.confirmBtn.setFillStyle(0x336633, 1);
      this.confirmText.setColor('#ffffff');
    } else {
      this.confirmBtn.setFillStyle(0x336633, 0.5);
      this.confirmText.setColor('#88aa88');
    }
  }
}
