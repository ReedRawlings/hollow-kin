import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { resolvePartyStatus } from '../systems/PartyStatus';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, footer, header, panel,
  screenFrame, spritePlate, stars, backButton,
} from '../ui/Theme';

export class DepartureScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DepartureScene' });
  }

  create(): void {
    this.draw();
    this.input.keyboard?.on('keydown-ENTER', () => this.depart());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TownScene'));
    this.input.keyboard?.on('keydown-LEFT', () => this.shiftFloor(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.shiftFloor(1));
  }

  private draw(): void {
    this.children.removeAll(true);
    screenFrame(this);
    header(this, 'THE TOWER GATE', 'CHOOSE WHERE THE DESCENT BEGINS',
      `${gameState.essence} ESSENCE`, UI.tealCss);
    backButton(this, () => this.scene.start('TownScene'));
    const status = resolvePartyStatus(gameState.defaultParty, gameState.creatureBox);
    if (status.kind !== 'ready') {
      panel(this, 480, 300, 620, 230);
      this.add.text(480, 270, 'THE PARTY IS NOT READY', {
        fontFamily: DISPLAY_FONT, fontSize: '12px', color: UI.redCss,
      }).setOrigin(0.5);
      this.add.text(480, 310, 'Return to the Roost and choose three standing creatures.', {
        fontFamily: BODY_FONT, fontSize: '12px', color: UI.body,
      }).setOrigin(0.5);
      button(this, 480, 370, 220, 52, 'CHANGE PARTY', () => this.scene.start('PartySelectScene'));
      footer(this, 'ESC BACK TO TOWN');
      return;
    }

    this.add.text(146, 96, 'BRINGING DOWN', {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
    });
    status.members.forEach((c, i) => {
      const t = getTemplate(c.speciesId);
      const x = 180 + i * 300;
      panel(this, x, 194, 276, 136);
      this.add.rectangle(x - 135, 194, 6, 136, archetypeColor(t.archetype));
      spritePlate(this, x - 88, 194, 72, 96, archetypeColor(t.archetype));
      this.add.text(x - 40, 146, c.nickname ?? t.name, {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.text,
      });
      this.add.text(x - 40, 170, `LV ${c.permanentLevel}  ${stars(c.starRating)}`, {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.goldCss,
      });
      this.add.text(x - 40, 194, `HP ${c.currentStats.hp}  MP ${c.currentStats.mp}`, {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
      });
      this.add.text(x - 40, 217, t.archetype.toUpperCase(), {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
      });
    });

    this.add.text(24, 276, 'STARTING DEPTH', {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
    });
    const floors = gameState.unlockedStartFloors();
    const spacing = Math.min(170, 780 / Math.max(1, floors.length));
    const startX = 480 - ((floors.length - 1) * spacing) / 2;
    floors.forEach((floor, i) => {
      const selected = floor === gameState.selectedStartFloor;
      const affordable = gameState.canAffordStartFloor(floor);
      const x = startX + i * spacing;
      const bg = panel(this, x, 350, 150, 104, selected);
      this.add.text(x, 329, `FLOOR ${floor}`, {
        fontFamily: DISPLAY_FONT, fontSize: '10px',
        color: affordable ? selected ? UI.hi : UI.text : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 363, floor === 1 ? 'FREE' : `${gameState.deepStartFee(floor)} ESSENCE`, {
        fontFamily: BODY_FONT, fontSize: '10px',
        color: affordable ? UI.tealCss : UI.redCss,
      }).setOrigin(0.5);
      if (affordable) {
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          gameState.setSelectedStartFloor(floor);
          gameState.saveToLocalStorage();
          this.draw();
        });
      }
    });

    const floor = gameState.selectedStartFloor;
    const canDepart = gameState.canDepartFrom(floor);
    button(this, 480, 485, 280, 62, canDepart ? `DESCEND — FLOOR ${floor}` : 'NOT ENOUGH ESSENCE',
      canDepart ? () => this.depart() : null, UI.gold, canDepart);
    button(this, 480, 553, 200, 38, 'CHANGE PARTY', () => this.scene.start('PartySelectScene'), UI.lineBright);
    footer(this, '← → DEPTH  ·  ENTER DESCEND  ·  ESC TOWN',
      floor === 1 ? 'NO GATE FEE' : `${gameState.deepStartFee(floor)} ESSENCE AT THE GATE`);
  }

  private shiftFloor(delta: number): void {
    const floors = gameState.unlockedStartFloors().filter(f => gameState.canAffordStartFloor(f));
    const current = floors.indexOf(gameState.selectedStartFloor);
    if (!floors.length) return;
    const next = floors[(Math.max(0, current) + delta + floors.length) % floors.length];
    gameState.setSelectedStartFloor(next);
    this.draw();
  }

  private depart(): void {
    const status = resolvePartyStatus(gameState.defaultParty, gameState.creatureBox);
    if (status.kind !== 'ready' || !gameState.canDepartFrom(gameState.selectedStartFloor)) return;
    gameState.setRunParty(gameState.defaultParty);
    this.scene.start('RunScene');
  }
}
