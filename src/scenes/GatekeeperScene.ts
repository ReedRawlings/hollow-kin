import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { depthJumpCost } from '../systems/Economy';

export class GatekeeperScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GatekeeperScene' });
  }

  create(): void {
    this.draw();
  }

  private draw(): void {
    this.children.removeAll();
    const cx = this.cameras.main.centerX;

    this.add.text(cx, 30, 'THE GATEKEEPER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(cx, 62, 'Choose where your next descent begins (Essence charged at run start)', {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    });

    const floors = gameState.unlockedStartFloors();
    floors.forEach((floor, i) => {
      const y = 140 + i * 60;
      const isSel = floor === gameState.selectedStartFloor;
      const cost = depthJumpCost(floor);
      const label = floor === 1 ? 'Floor 1  (free)' : `Floor ${floor}  —  ${cost} Essence / run`;

      const bg = this.add.rectangle(cx, y, 420, 48, isSel ? 0x334466 : 0x222240, 0.9)
        .setStrokeStyle(2, isSel ? 0x66aaff : 0x444466).setInteractive({ useHandCursor: true });
      this.add.text(cx, y, `${isSel ? '▶ ' : ''}${label}`, {
        fontSize: '15px', color: isSel ? '#ffffff' : '#cccccc', fontFamily: 'monospace',
      }).setOrigin(0.5);
      bg.on('pointerdown', () => {
        gameState.setSelectedStartFloor(floor);
        gameState.saveToLocalStorage();
        this.draw();
      });
    });

    if (floors.length === 1) {
      this.add.text(cx, 220, 'Clear a mini-boss (floor 5) to unlock deeper starts.', {
        fontSize: '13px', color: '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      gameState.saveToLocalStorage();
      this.scene.start('TownScene');
    });
  }
}
