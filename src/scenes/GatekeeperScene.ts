import Phaser from 'phaser';
import { gameState } from '../managers/GameState';

export class GatekeeperScene extends Phaser.Scene {
  /**
   * Everything drawn, tracked so it can be destroyed on redraw. children.removeAll()
   * only detaches — it leaves interactive objects registered and clickable.
   */
  private tracked: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'GatekeeperScene' });
  }

  create(): void {
    this.tracked = [];
    this.draw();
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TownScene'));
    this.input.keyboard?.on('keydown-ENTER', () => this.talk());
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
    this.track(this.add.text(cx, 30, 'GARY THE GATEKEEPER', {
      fontSize: '26px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(cx, 62, `Relationship ${gameState.garyRelationship().stage}/5`, {
      fontSize: '13px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5));
    this.track(this.add.text(20, 90, `Essence: ${gameState.essence}`, {
      fontSize: '15px', color: '#e0b060', fontFamily: 'monospace',
    }));

    const pending = gameState.nextGaryDialogue();
    const talk = this.track(this.add.text(cx, 112, pending ? 'TALK — SOMETHING NEW' : 'NOTHING NEW TO DISCUSS', {
      fontSize: '14px', color: pending ? '#f7f3b7' : '#666677', fontFamily: 'monospace',
      backgroundColor: pending ? '#3a2b24' : '#20202a', padding: { x: 16, y: 10 },
    }).setOrigin(0.5));
    if (pending) talk.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.talk());

    const owned = gameState.unlockedStartFloors().filter(f => f > 1);
    this.track(this.add.text(20, 112, owned.length > 0
      ? `Unlocked: ${owned.map(f => `Floor ${f}`).join(', ')}`
      : 'Unlocked: none yet — you always begin at Floor 1', {
      fontSize: '12px', color: '#88ccaa', fontFamily: 'monospace',
    }));

    const passagesOpen = gameState.garyRelationship().stage >= 2;
    const purchasable = passagesOpen ? gameState.purchasableFloors() : [];

    if (purchasable.length === 0) {
      this.track(this.add.text(cx, 240, !passagesOpen
        ? 'Gary has not yet offered to repair the old passages.'
        : gameState.deepestBreakCleared === 0
        ? 'Clear the floor-5 mini-boss to earn your first deeper start.'
        : 'Nothing left to unlock at your current depth. Clear another break.', {
        fontSize: '14px', color: '#777777', fontFamily: 'monospace',
      }).setOrigin(0.5));
    }

    purchasable.forEach((floor, i) => {
      const y = 170 + i * 62;
      const cost = gameState.floorUnlockCost(floor);
      const affordable = gameState.essence >= cost;

      const bg = this.track(this.add.rectangle(cx, y, 460, 52, affordable ? 0x222240 : 0x1c1c28, 0.9)
        .setStrokeStyle(2, affordable ? 0x66aaff : 0x333344));
      this.track(this.add.text(cx, y - 9, `Unlock Floor ${floor}  —  ${cost} Essence`, {
        fontSize: '15px', color: affordable ? '#ffffff' : '#666677', fontFamily: 'monospace',
      }).setOrigin(0.5));
      this.track(this.add.text(cx, y + 12, `then ${gameState.deepStartFee(floor)} Essence each run you start there`, {
        fontSize: '11px', color: affordable ? '#8899aa' : '#555566', fontFamily: 'monospace',
      }).setOrigin(0.5));

      if (affordable) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x334466));
        bg.on('pointerout', () => bg.setFillStyle(0x222240));
        bg.on('pointerdown', () => {
          gameState.purchaseFloorUnlock(floor);
          gameState.saveToLocalStorage();
          this.draw();
        });
      }
    });

    const back = this.track(this.add.text(24, 20, '← TOWN', {
      fontSize: '12px', color: '#f7f3b7', fontFamily: 'monospace',
      backgroundColor: '#2c1e31', padding: { x: 10, y: 7 },
    }).setInteractive({ useHandCursor: true }));
    back.on('pointerdown', () => this.scene.start('TownScene'));
  }

  private talk(): void {
    const eventId = gameState.nextGaryDialogue();
    if (!eventId) return;
    this.scene.start('DialogueScene', { eventId, returnScene: 'GatekeeperScene' });
  }
}
