import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { essenceCostForLevel } from '../systems/Economy';
import { CreatureInstance, BaseStats } from '../types';

export class LevelerScene extends Phaser.Scene {
  private selectedId: string | null = null;

  constructor() {
    super({ key: 'LevelerScene' });
  }

  create(): void {
    this.selectedId = null;
    this.draw();
  }

  private draw(): void {
    this.children.removeAll();
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 30, 'THE LEVELER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(cx, 62, 'Spend Essence to raise a creature\'s permanent level', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    });

    const creatures = gameState.creatureBox.filter(c => !c.isRetired);
    creatures.forEach((creature, i) => {
      const template = getTemplate(creature.speciesId);
      const x = 40 + (i % 4) * 230;
      const y = 130 + Math.floor(i / 4) * 70;
      const isSel = creature.instanceId === this.selectedId;

      const bg = this.add.rectangle(x + 100, y + 15, 210, 55, isSel ? 0x334466 : 0x222240, 0.9)
        .setStrokeStyle(2, isSel ? 0x66aaff : 0x444466).setInteractive({ useHandCursor: true });
      this.add.rectangle(x + 20, y + 15, 34, 34, template.spriteColor);
      this.add.text(x + 45, y, template.name, {
        fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      });
      this.add.text(x + 45, y + 18, `Lv ${creature.permanentLevel} / cap ${creature.levelCap}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      });
      bg.on('pointerdown', () => { this.selectedId = creature.instanceId; this.draw(); });
    });

    // Selected-creature action panel
    const selected = creatures.find(c => c.instanceId === this.selectedId);
    if (selected) {
      this.drawActionPanel(selected, cx);
    }

    this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      gameState.saveToLocalStorage();
      this.scene.start('TownScene');
    });
  }

  private drawActionPanel(creature: CreatureInstance, cx: number): void {
    const y = 430;
    const atCap = creature.permanentLevel >= creature.levelCap;
    const cost = essenceCostForLevel(creature.permanentLevel);
    const canAfford = gameState.essence >= cost;

    const label = atCap
      ? `${getTemplate(creature.speciesId).name} is at its level cap (${creature.levelCap})`
      : `Next level: ${creature.permanentLevel} → ${creature.permanentLevel + 1}  |  Cost: ${cost} Essence`;
    this.add.text(cx, y, label, {
      fontSize: '14px', color: atCap ? '#888888' : (canAfford ? '#e0d0a0' : '#aa6666'), fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Current stats (at the permanent level), with a → preview of the post-level-up values.
    const statNames: (keyof BaseStats)[] = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'];
    const cur = gameState.calculateStatsForLevel({ ...creature, currentLevel: creature.permanentLevel });
    const nxt = atCap ? null : gameState.calculateStatsForLevel({ ...creature, currentLevel: creature.permanentLevel + 1 });
    const fmt = (s: keyof BaseStats): string =>
      nxt && nxt[s] !== cur[s] ? `${s.toUpperCase()} ${cur[s]}→${nxt[s]}` : `${s.toUpperCase()} ${cur[s]}`;
    this.add.text(cx, y + 26, statNames.slice(0, 4).map(fmt).join('   '), {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(cx, y + 44, statNames.slice(4).map(fmt).join('   '), {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (!atCap) {
      const enabled = canAfford;
      const bg = this.add.rectangle(cx, y + 85, 200, 46, enabled ? 0x336633 : 0x333333, enabled ? 0.9 : 0.6)
        .setStrokeStyle(2, enabled ? 0x44aa44 : 0x555555);
      this.add.text(cx, y + 85, 'BUY LEVEL', {
        fontSize: '15px', color: enabled ? '#ffffff' : '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5);
      if (enabled) {
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (gameState.spendEssenceOnLevel(creature)) {
            gameState.saveToLocalStorage();
            this.draw();
          }
        });
      }
    }
  }
}
