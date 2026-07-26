import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { ARCHETYPE_COLORS } from '../types';
import { resolvePartyStatus } from '../systems/PartyStatus';

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
    const activeCreatures = gameState.creatureBox.filter(c => !c.isRetired);
    this.add.text(20, 100, `Creature Box (${activeCreatures.length})`, {
      fontSize: '16px', color: '#88aacc', fontFamily: 'monospace',
    });

    // The list below lays out at `135 + floor(i / 6) * 75`. A 4th row starts at
    // y=360, which collides with the party panel at y=330. Cap to 3 rows (18
    // creatures) so the box can never grow into it; the header count above still
    // shows the true total, and we note the overflow beside it.
    const MAX_VISIBLE_BOX = 18;
    const visibleBoxCreatures = activeCreatures.slice(0, MAX_VISIBLE_BOX);
    if (activeCreatures.length > MAX_VISIBLE_BOX) {
      this.add.text(230, 100, `(+${activeCreatures.length - MAX_VISIBLE_BOX} more not shown)`, {
        fontSize: '11px', color: '#666688', fontFamily: 'monospace',
      });
    }

    visibleBoxCreatures.forEach((creature, i) => {
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

    // Party panel — the standing party, or why it cannot descend.
    //
    // NOTE ON PLACEMENT: the creature-box list above lays out at
    // `135 + floor(i / 6) * 75`, so it reaches y=360 once the box holds 19+
    // creatures and would collide with this panel. Checked: the box list is capped
    // to MAX_VISIBLE_BOX (18, i.e. 3 rows) above, so the last box row ends at
    // y=285 and never reaches this panel at y=330.
    const status = resolvePartyStatus(gameState.defaultParty, gameState.creatureBox);
    this.add.text(20, 330, 'Descent Party', {
      fontSize: '15px', color: '#88ccff', fontFamily: 'monospace',
    });

    if (status.kind === 'ready') {
      status.members.forEach((c, i) => {
        const template = getTemplate(c.speciesId);
        const x = 30 + i * 230;
        this.add.rectangle(x + 16, 372, 30, 30, template.spriteColor);
        this.add.text(x + 38, 362, c.nickname ?? template.name, {
          fontSize: '12px', color: '#ffffff', fontFamily: 'monospace',
        });
        this.add.text(x + 38, 378, `Lv ${c.permanentLevel}`, {
          fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
        });
      });
    } else if (status.kind === 'incomplete') {
      this.add.text(30, 365, `Choose ${3 - status.have} more — set your party in PARTY.`, {
        fontSize: '13px', color: '#ffaa66', fontFamily: 'monospace',
      });
    } else {
      // Name the creature that left. "Party invalid" would make the player open the
      // editor just to work out what changed — breeding retires parents constantly.
      this.add.text(30, 365, `${status.missingNames.join(' and ')} is no longer available.`, {
        fontSize: '13px', color: '#ffaa66', fontFamily: 'monospace',
      });
      this.add.text(30, 383, 'Set a new party in PARTY.', {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
      });
    }

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

    // Run / party / breed / new game (row 2)
    const btnY = 500;
    const canDescend = status.kind === 'ready';
    this.createButton(cx - 285, btnY, 'ENTER TOWER', canDescend ? '#44aa44' : '#2a4a2a', () => {
      if (canDescend) this.scene.start('DepartureScene');
    });
    this.createButton(cx - 95, btnY, 'PARTY', '#4488aa', () => {
      this.scene.start('PartySelectScene');
    });
    this.createButton(cx + 95, btnY, 'BREED', '#aa44aa', () => {
      if (activeCreatures.length >= 2) {
        this.scene.start('BreedingScene');
      }
    });
    this.createButton(cx + 285, btnY, 'NEW GAME', '#aa4444', () => {
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
