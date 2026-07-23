import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { STARTER_TRIO_A, STARTER_TRIO_B } from '../data/creatures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const loaded = gameState.loadFromLocalStorage();
    if (loaded && gameState.creatureBox.length > 0) {
      this.scene.start('TownScene');
    } else {
      this.showStarterSelect();
    }
  }

  private showStarterSelect(): void {
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 60, 'HOLLOW KIN', {
      fontSize: '40px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(cx, 120, 'Choose your starting trio:', {
      fontSize: '18px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.createTrioButton(cx - 160, 200, 'Trio A — Aggressive',
      'Ironjaw (Fauna)\nEmberwhelp (Mecha)\nBladeknight (Human)',
      STARTER_TRIO_A);
    this.createTrioButton(cx + 160, 200, 'Trio B — Resilient',
      'Stoneguard (Rock)\nThornvine (Flora)\nDuskgeist (Spirits)',
      STARTER_TRIO_B);
  }

  private createTrioButton(x: number, y: number, title: string, desc: string, ids: string[]): void {
    const bg = this.add.rectangle(x, y + 80, 260, 220, 0x222244, 0.9)
      .setStrokeStyle(2, 0x4444aa).setInteractive({ useHandCursor: true });

    this.add.text(x, y, title, {
      fontSize: '16px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(x, y + 60, desc, {
      fontSize: '14px', color: '#cccccc', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);

    bg.on('pointerdown', () => {
      gameState.initializeNewGame(ids);
      gameState.saveToLocalStorage();
      this.scene.start('TownScene');
    });

    bg.on('pointerover', () => bg.setFillStyle(0x333366));
    bg.on('pointerout', () => bg.setFillStyle(0x222244));
  }
}
