import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { ARCHETYPE_COLORS } from '../types';

export class TownScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TownScene' });
  }

  create(): void {
    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;

    // Title
    this.add.text(cx, 30, 'THE TOWN', {
      fontSize: '28px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Resources
    this.add.text(20, 70, `Essence: ${gameState.essence}`, {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    });

    if (gameState.selectedStartFloor > 1) {
      this.add.text(20, 88, `Next descent starts at floor ${gameState.selectedStartFloor}`, {
        fontSize: '12px', color: '#88aacc', fontFamily: 'monospace',
      });
    }

    // Creature Box display
    this.add.text(20, 100, `Creature Box (${gameState.creatureBox.filter(c => !c.isRetired).length})`, {
      fontSize: '16px', color: '#88aacc', fontFamily: 'monospace',
    });

    const activeCreatures = gameState.creatureBox.filter(c => !c.isRetired);
    activeCreatures.forEach((creature, i) => {
      const template = getTemplate(creature.speciesId);
      const x = 40 + (i % 6) * 150;
      const y = 135 + Math.floor(i / 6) * 75;

      this.add.rectangle(x + 20, y + 15, 40, 40, template.spriteColor);
      this.add.text(x + 50, y, `${template.name}`, {
        fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
      });
      this.add.text(x + 50, y + 16, `★${creature.starRating} Lv ${creature.permanentLevel}`, {
        fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
      });
      if (creature.isBreedReady) {
        this.add.text(x + 50, y + 30, 'BREED READY', {
          fontSize: '10px', color: '#ff88cc', fontFamily: 'monospace',
        });
      }
    });

    // Vendors (row 1)
    const vendorY = 430;
    this.createButton(cx - 190, vendorY, 'LEVELER', '#4488aa', () => {
      this.scene.start('LevelerScene');
    });
    this.createButton(cx, vendorY, 'GATEKEEPER', '#aa8844', () => {
      this.scene.start('GatekeeperScene');
    });
    this.createButton(cx + 190, vendorY, 'MONSTERPEDIA', '#6666aa', () => {
      this.scene.start('BestiaryScene');
    });

    // Run / breed / new game (row 2)
    const btnY = 500;
    this.createButton(cx - 200, btnY, 'ENTER TOWER', '#44aa44', () => {
      this.scene.start('PartySelectScene');
    });
    this.createButton(cx, btnY, 'BREED', '#aa44aa', () => {
      if (activeCreatures.length >= 2) {
        this.scene.start('BreedingScene');
      }
    });
    this.createButton(cx + 200, btnY, 'NEW GAME', '#aa4444', () => {
      localStorage.removeItem('hollow_kin_save');
      this.scene.start('BootScene');
    });
  }

  private createButton(x: number, y: number, text: string, color: string, callback: () => void): void {
    const bg = this.add.rectangle(x, y, 160, 50, Phaser.Display.Color.HexStringToColor(color).color, 0.8)
      .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });
    this.add.text(x, y, text, {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setAlpha(1));
    bg.on('pointerout', () => bg.setAlpha(0.8));
    bg.on('pointerdown', callback);
  }
}
