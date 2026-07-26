import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { STARTER_TRIO_A, STARTER_TRIO_B, getTemplate } from '../data/creatures';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, footer, header,
  panel, screenFrame, spritePlate, stars,
} from '../ui/Theme';

export class BootScene extends Phaser.Scene {
  private selected = 0;
  private handCards: Phaser.GameObjects.Rectangle[] = [];

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
    this.input.keyboard?.on('keydown-LEFT', () => this.select(0));
    this.input.keyboard?.on('keydown-RIGHT', () => this.select(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.startSelected());
  }

  private draw(): void {
    this.children.removeAll(true);
    this.handCards = [];
    screenFrame(this);
    header(this, 'CHOOSE YOUR THREE', 'THE OTHER HAND IS SET FREE', 'NEW BLOODLINE');

    this.drawHand(248, 314, STARTER_TRIO_A, 'THE KENNEL HAND', 'RECOMMENDED',
      'Strong fronts and a forgiving first descent.', 'BALANCED • FORGIVING', 0);
    this.drawHand(712, 314, STARTER_TRIO_B, 'THE STONE HAND', 'HARDER START',
      'Slow, sturdy, and built to outlast trouble.', 'DEFENSIVE • STEADY', 1);

    button(this, 480, 570, 260, 50, 'START GAME', () => this.startSelected());
    footer(this, '← → CHOOSE  ·  ENTER CONFIRM', `HAND ${this.selected + 1} OF 2`);
  }

  private drawHand(
    x: number, y: number, ids: string[], title: string, badge: string,
    pitch: string, shape: string, index: number,
  ): void {
    const selected = this.selected === index;
    const bg = panel(this, x, y, 438, 444, selected)
      .setInteractive({ useHandCursor: true });
    this.handCards.push(bg);
    bg.on('pointerover', () => this.select(index));
    bg.on('pointerdown', () => this.select(index));

    this.add.text(x - 199, y - 202, title, {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: selected ? UI.hi : UI.text,
    });
    this.add.text(x + 199, y - 202, badge, {
      fontFamily: BODY_FONT, fontSize: '9px',
      color: index === 0 ? UI.greenCss : UI.redCss,
    }).setOrigin(1, 0);
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

    this.add.rectangle(x, y + 194, 398, 32, index === 0 ? 0x182619 : 0x26171d)
      .setStrokeStyle(2, index === 0 ? 0x3e6e3e : 0x94493a);
    this.add.text(x, y + 194, shape, {
      fontFamily: DISPLAY_FONT, fontSize: '8px',
      color: index === 0 ? UI.greenCss : UI.redCss,
    }).setOrigin(0.5);
  }

  private select(index: number): void {
    if (this.selected === index) return;
    this.selected = index;
    this.draw();
  }

  private startSelected(): void {
    const starterIds = this.selected === 0 ? STARTER_TRIO_A : STARTER_TRIO_B;
    gameState.initializeNewGame(starterIds);
    // The hand is the party, not merely three creatures added to an empty box.
    // This also keeps the first transition from landing in town with a broken
    // default-party dock that immediately asks the player to choose the same trio.
    gameState.setDefaultParty(gameState.creatureBox.map(c => c.instanceId));
    gameState.saveToLocalStorage();
    this.scene.start('TownScene');
  }
}
