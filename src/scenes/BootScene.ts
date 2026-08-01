import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { STARTER_TRIO_A, getTemplate } from '../data/creatures';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, footer, header,
  panel, screenFrame, spritePlate, stars,
} from '../ui/Theme';
import { sanitizePlayerName, validPlayerName } from '../systems/PlayerName';

export class BootScene extends Phaser.Scene {
  private mode: 'name' | 'starter' = 'name';
  private playerName = '';
  private onKeyDown = (event: KeyboardEvent) => this.handleKey(event);

  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const loaded = gameState.loadFromLocalStorage();
    if (loaded && gameState.creatureBox.length > 0) {
      this.scene.start('TownScene');
      return;
    }
    this.mode = 'name';
    this.playerName = '';
    this.draw();
    this.input.keyboard?.off('keydown', this.onKeyDown);
    this.input.keyboard?.on('keydown', this.onKeyDown);
  }

  private draw(): void {
    this.children.removeAll(true);
    screenFrame(this);
    if (this.mode === 'name') {
      this.drawNameEntry();
      return;
    }
    header(this, 'YOUR FIRST THREE', `KEEPER ${this.playerName.toUpperCase()}  ·  THE TOWER TAKES ALL COMERS`, 'NEW BLOODLINE');

    this.drawHand(480, 314, STARTER_TRIO_A, 'THE FOUNDING HAND',
      'One of each shape, so the first descent teaches all three.',
      'FIGHTER • TANK • MAGE');

    button(this, 480, 570, 260, 50, 'START GAME', () => this.startSelected());
    footer(this, 'ENTER CONFIRM', 'THE ONLY HAND ON OFFER');
  }

  private drawNameEntry(): void {
    header(this, 'WHO KEEPS THIS VILLAGE?', 'NAME THE ADVENTURER AT THE GATE', 'NEW BLOODLINE');
    panel(this, 480, 300, 620, 260, true);
    this.add.text(480, 210, 'YOUR NAME', {
      fontFamily: DISPLAY_FONT, fontSize: '11px', color: UI.hi,
    }).setOrigin(0.5);
    this.add.rectangle(480, 286, 430, 72, UI.void).setStrokeStyle(3, UI.gold);
    this.add.text(480, 286, this.playerName ? `${this.playerName}_` : 'TYPE NAME_', {
      fontFamily: DISPLAY_FONT, fontSize: '18px', color: UI.text,
    }).setOrigin(0.5);
    this.add.text(480, 344, 'TYPE A NAME  ·  12 CHARACTERS MAX', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    }).setOrigin(0.5);
    button(this, 480, 410, 240, 52, 'CONTINUE', () => this.confirmName(), UI.gold,
      validPlayerName(this.playerName));
    footer(this, 'TYPE  ·  BACKSPACE ERASE  ·  ENTER CONTINUE', 'THIS NAME APPEARS IN CONVERSATIONS');
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.mode === 'starter') {
      if (event.key === 'Enter') this.startSelected();
      return;
    }
    if (event.key === 'Enter') { this.confirmName(); return; }
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.playerName = this.playerName.slice(0, -1);
      this.draw();
      return;
    }
    if (event.key.length === 1) {
      const next = sanitizePlayerName(this.playerName + event.key);
      if (next !== this.playerName) {
        this.playerName = next;
        this.draw();
      }
    }
  }

  private confirmName(): void {
    if (!validPlayerName(this.playerName)) return;
    this.playerName = sanitizePlayerName(this.playerName).trim();
    this.mode = 'starter';
    this.draw();
  }

  private drawHand(
    x: number, y: number, ids: string[], title: string,
    pitch: string, shape: string,
  ): void {
    panel(this, x, y, 438, 444, true);

    this.add.text(x - 199, y - 202, title, {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
    });
    this.add.text(x - 199, y - 178, pitch, {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    });

    ids.forEach((id, i) => {
      const t = getTemplate(id);
      const cy = y - 112 + i * 108;
      this.add.rectangle(x, cy, 398, 98, UI.void).setStrokeStyle(2, UI.line);
      this.add.rectangle(x - 196, cy, 6, 98, archetypeColor(t.archetype));
      spritePlate(this, x - 154, cy, 62, 62, archetypeColor(t.archetype));
      this.add.text(x - 111, cy - 34, t.name, {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.text,
      });
      this.add.text(x + 180, cy - 34, 'LV 1', {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
      }).setOrigin(1, 0);
      this.add.text(x - 111, cy - 15, `${t.archetype.toUpperCase()}  ${stars(0)}`, {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.goldCss,
      });
      const s = t.baseStats;
      this.add.text(x - 111, cy + 9, `HP ${s.hp}   STR ${s.str}   DEF ${s.def}`, {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
      });
      this.add.text(x - 111, cy + 27, `INT ${s.int}   SPD ${s.spd}   WIS ${s.wis}`, {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
      });
    });

    this.add.rectangle(x, y + 194, 398, 32, 0x182619).setStrokeStyle(2, 0x3e6e3e);
    this.add.text(x, y + 194, shape, {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.greenCss,
    }).setOrigin(0.5);
  }

  private startSelected(): void {
    if (this.mode !== 'starter') return;
    gameState.initializeNewGame(STARTER_TRIO_A, this.playerName);
    // The hand is the party, not merely three creatures added to an empty box.
    // This also keeps the first transition from landing in town with a broken
    // default-party dock that immediately asks the player to choose the same trio.
    gameState.setDefaultParty(gameState.creatureBox.map(c => c.instanceId));
    gameState.saveToLocalStorage();
    this.scene.start('TownScene');
  }
}
