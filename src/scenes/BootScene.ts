import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { STARTER_TRIO_A, getTemplate } from '../data/creatures';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, footer, header,
  panel, screenFrame, spritePlate, stars,
} from '../ui/Theme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const loaded = gameState.loadFromLocalStorage();
    if (loaded && gameState.creatureBox.length > 0) {
      this.scene.start('TownScene');
      return;
    }
    this.draw();
    this.input.keyboard?.on('keydown-ENTER', () => this.startSelected());
  }

  private draw(): void {
    this.children.removeAll(true);
    screenFrame(this);
    header(this, 'YOUR FIRST THREE', 'THE TOWER TAKES ALL COMERS', 'NEW BLOODLINE');

    this.drawHand(480, 314, STARTER_TRIO_A, 'THE FOUNDING HAND',
      'One of each shape, so the first descent teaches all three.',
      'FIGHTER • TANK • MAGE');

    button(this, 480, 570, 260, 50, 'START GAME', () => this.startSelected());
    footer(this, 'ENTER CONFIRM', 'THE ONLY HAND ON OFFER');
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
    gameState.initializeNewGame(STARTER_TRIO_A);
    // The hand is the party, not merely three creatures added to an empty box.
    // This also keeps the first transition from landing in town with a broken
    // default-party dock that immediately asks the player to choose the same trio.
    gameState.setDefaultParty(gameState.creatureBox.map(c => c.instanceId));
    gameState.saveToLocalStorage();
    this.scene.start('TownScene');
  }
}
