import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { depthRunFee } from '../systems/Economy';
import { resolvePartyStatus } from '../systems/PartyStatus';

export class DepartureScene extends Phaser.Scene {
  private tracked: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'DepartureScene' });
  }

  create(): void {
    this.tracked = [];
    this.draw();
  }

  private track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.tracked.push(obj);
    return obj;
  }

  private destroyTracked(): void {
    for (const o of this.tracked) o.destroy();
    this.tracked = [];
  }

  private draw(): void {
    this.destroyTracked();
    const cx = this.cameras.main.centerX;

    this.track(this.add.rectangle(480, 320, 960, 640, 0x1a1a2e));
    this.track(this.add.text(cx, 40, 'DESCEND', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(20, 20, `Essence: ${gameState.essence}`, {
      fontSize: '14px', color: '#e0b060', fontFamily: 'monospace',
    }));

    const status = resolvePartyStatus(gameState.defaultParty, gameState.creatureBox);

    // The party this run takes. Town blocks departure on a bad party, so reaching
    // this screen with one is not expected — but render it rather than crash.
    if (status.kind !== 'ready') {
      this.track(this.add.text(cx, 200, 'Your party is not ready to descend.', {
        fontSize: '16px', color: '#ff8888', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.drawButton(cx, 300, 220, 'CHANGE PARTY', '#4488aa', () => {
        this.scene.start('PartySelectScene');
      });
      this.drawBack();
      return;
    }

    status.members.forEach((c, i) => {
      const x = 160 + i * 240;
      const template = getTemplate(c.speciesId);
      this.track(this.add.rectangle(x, 130, 48, 48, template.spriteColor));
      this.track(this.add.text(x + 34, 112, c.nickname ?? template.name, {
        fontSize: '13px', color: '#ffffff', fontFamily: 'monospace',
      }));
      this.track(this.add.text(x + 34, 132, `Lv ${c.permanentLevel}  HP ${c.currentStats.hp}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'monospace',
      }));
    });

    this.drawFloorChips();

    const floor = gameState.selectedStartFloor;
    const canDepart = gameState.canDepartFrom(floor);

    if (canDepart) {
      this.drawButton(cx, 470, 220, floor > 1 ? `DESCEND — Floor ${floor}` : 'DESCEND', '#44aa44', () => {
        gameState.setRunParty(gameState.defaultParty);
        this.scene.start('RunScene');
      });
    } else {
      // Never substitute a cheaper floor: the player picked this one.
      this.track(this.add.rectangle(cx, 470, 220, 50, 0x333333, 0.7).setStrokeStyle(2, 0x555555));
      this.track(this.add.text(cx, 470, 'DESCEND', {
        fontSize: '15px', color: '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.track(this.add.text(cx, 508,
        `Not enough Essence for Floor ${floor} (${depthRunFee(floor)} needed) — choose another floor`, {
          fontSize: '12px', color: '#ff8888', fontFamily: 'monospace',
        }).setOrigin(0.5));
    }

    this.drawButton(cx, 545, 220, 'CHANGE PARTY', '#4488aa', () => {
      this.scene.start('PartySelectScene');
    });

    this.drawBack();
  }

  private drawFloorChips(): void {
    const cx = this.cameras.main.centerX;
    const floors = gameState.unlockedStartFloors();

    this.track(this.add.text(cx, 250, 'Start from:', {
      fontSize: '13px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5));

    const spacing = 130;
    const startX = cx - ((floors.length - 1) * spacing) / 2;

    floors.forEach((floor, i) => {
      const x = startX + i * spacing;
      const selected = floor === gameState.selectedStartFloor;
      const affordable = gameState.canAffordStartFloor(floor);
      const fee = depthRunFee(floor);

      const fill = !affordable ? 0x1c1c28 : selected ? 0x334466 : 0x222240;
      const stroke = !affordable ? 0x333344 : selected ? 0x66aaff : 0x444466;
      const chip = this.track(this.add.rectangle(x, 300, 116, 52, fill, 0.95)
        .setStrokeStyle(2, stroke));

      this.track(this.add.text(x, 290, `Floor ${floor}`, {
        fontSize: '14px', color: affordable ? '#ffffff' : '#666677', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.track(this.add.text(x, 310, floor === 1 ? 'free' : `${fee} Essence`, {
        fontSize: '10px', color: affordable ? '#8899aa' : '#555566', fontFamily: 'monospace',
      }).setOrigin(0.5));

      // Unaffordable chips stay visible but unselectable — hiding a floor the player
      // bought would make them wonder where their purchase went.
      if (affordable && !selected) {
        chip.setInteractive({ useHandCursor: true });
        chip.on('pointerdown', () => {
          gameState.setSelectedStartFloor(floor);
          gameState.saveToLocalStorage();
          this.draw();
        });
      }
    });
  }

  private drawButton(x: number, y: number, w: number, label: string, color: string, cb: () => void): void {
    const bg = this.track(this.add.rectangle(x, y, w, 50,
      Phaser.Display.Color.HexStringToColor(color).color, 0.85)
      .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true }));
    this.track(this.add.text(x, y, label, {
      fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5));
    bg.on('pointerover', () => bg.setAlpha(1));
    bg.on('pointerout', () => bg.setAlpha(0.85));
    bg.on('pointerdown', cb);
  }

  private drawBack(): void {
    const back = this.track(this.add.text(30, 600, '← Back to town', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true }));
    back.on('pointerdown', () => this.scene.start('TownScene'));
  }
}
