import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { resolvePartyStatus, describePartyStatus } from '../systems/PartyStatus';
import { breedingAvailability, breedingBlockedReason } from '../systems/BreedingSystem';
import { TOWER_FLOORS } from '../types';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button,
  footer, header, panel, screenFrame, spritePlate,
} from '../ui/Theme';

interface Place {
  name: string;
  tag: string;
  pitch: string;
  x: number; y: number; w: number; h: number;
  color: number;
  scene?: string;
  enabled?: () => boolean;
  /**
   * Why this tile is closed *right now*, when that is a recoverable game state rather
   * than "not in this build". Distinguishes CLOSED from SHUTTERED so a player is never
   * left guessing whether a tile is unfinished or just unavailable to them today.
   */
  blockedReason?: () => string | null;
}

export class TownScene extends Phaser.Scene {
  private selected = 0;
  private avatar?: Phaser.GameObjects.Rectangle;
  private readonly places: Place[] = [
    { name: 'THE TOWER', tag: 'ENTER TOWER', pitch: 'Choose a depth and begin the next descent.', x: 460, y: 132, w: 170, h: 72, color: UI.gold, scene: 'DepartureScene' },
    { name: 'THE LEVELER', tag: 'PERMANENT LEVELS', pitch: 'Turn essence into strength that survives every run.', x: 104, y: 222, w: 148, h: 78, color: 0x5e91b4, scene: 'LevelerScene' },
    { name: 'GATEKEEPER', tag: 'DEPTH JUMPS', pitch: 'Unlock a deeper place to begin future descents.', x: 264, y: 222, w: 140, h: 78, color: UI.gold, scene: 'GatekeeperScene' },
    { name: 'PROVISIONER', tag: 'SUPPLIES', pitch: 'Buy carryable items — used later, in the tower.', x: 460, y: 222, w: 140, h: 78, color: 0x8fae55, scene: 'TownShopScene' },
    { name: 'MARK-BINDER', tag: 'SHUTTERED', pitch: 'Marks are not available in this build yet.', x: 656, y: 222, w: 148, h: 78, color: UI.amber, enabled: () => false },
    { name: 'TRAIT-KEEPER', tag: 'SHUTTERED', pitch: 'Trait imbuing is not available in this build yet.', x: 816, y: 222, w: 142, h: 78, color: UI.teal, enabled: () => false },
    { name: 'THE ROOST', tag: 'PARTY', pitch: 'Review the box and choose the three going down.', x: 100, y: 342, w: 140, h: 86, color: 0xe98537, scene: 'PartySelectScene' },
    { name: 'HATCHERY', tag: 'BREED', pitch: 'Pair ready creatures and carry their line forward.', x: 252, y: 342, w: 140, h: 86, color: UI.teal, scene: 'BreedingScene',
      enabled: () => breedingAvailability(gameState.creatureBox).kind === 'available',
      blockedReason: () => breedingBlockedReason(breedingAvailability(gameState.creatureBox)) },
    { name: 'NOTICE BOARD', tag: 'RUN NEWS', pitch: `The tower has ${TOWER_FLOORS} floors. Wardens wait every fifth.`, x: 404, y: 342, w: 140, h: 86, color: UI.lineBright },
    { name: 'THE ARCHIVE', tag: 'PEDIA', pitch: 'Read what your party has learned about tower creatures.', x: 556, y: 342, w: 140, h: 86, color: 0x8c78a5, scene: 'BestiaryScene' },
    { name: 'THE ORACLE', tag: 'SHUTTERED', pitch: 'The Oracle opens after a deeper milestone.', x: 708, y: 342, w: 140, h: 86, color: 0x5e5b8c, enabled: () => false },
  ];

  constructor() {
    super({ key: 'TownScene' });
  }

  create(): void {
    this.selected = 0;
    if (gameState.nextGaryDialogue() === 'gary_intro') {
      this.scene.start('DialogueScene', { eventId: 'gary_intro', returnScene: 'TownScene' });
      return;
    }
    this.draw();
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard?.on('keydown-UP', () => this.move(-2));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(2));
    this.input.keyboard?.on('keydown-ENTER', () => this.enterSelected());
    this.input.keyboard?.on('keydown-T', () => { this.selected = 0; this.enterSelected(); });
    this.input.keyboard?.on('keydown-N', () => {
      localStorage.removeItem('hollow_kin_save');
      this.scene.start('BootScene');
    });
  }

  private draw(): void {
    this.children.removeAll(true);
    screenFrame(this);
    header(this, 'THE TOWN', `DEEPEST BREAK ${gameState.deepestBreakCleared || '—'}  ·  ${gameState.creatureBox.filter(c => !c.isRetired).length} KIN KEPT`,
      `${gameState.essence} ESSENCE`, UI.tealCss);

    // Map ground and roads.
    this.add.rectangle(480, 278, 912, 390, UI.panel).setStrokeStyle(2, UI.line);
    const grid = this.add.graphics().lineStyle(1, UI.line, 0.32);
    for (let x = 24; x <= 936; x += 24) grid.lineBetween(x, 84, x, 472);
    for (let y = 86; y <= 470; y += 24) grid.lineBetween(24, y, 936, y);
    this.add.rectangle(480, 282, 912, 28, UI.plate).setStrokeStyle(2, UI.line);
    this.add.rectangle(460, 208, 16, 120, UI.plate);

    this.places.forEach((place, i) => this.drawPlace(place, i));
    const selected = this.places[this.selected];
    this.avatar = this.add.rectangle(selected.x, 282, 20, 20, UI.gold).setStrokeStyle(2, 0xf7f3b7);

    this.drawDetail(selected);
    footer(this, 'ARROWS WALK  ·  ENTER GO IN  ·  T TOWER  ·  N NEW GAME', selected.name);
  }

  private drawPlace(place: Place, index: number): void {
    const selected = index === this.selected;
    const enabled = place.enabled?.() ?? true;
    spritePlate(this, place.x, place.y, place.w, place.h, enabled ? place.color : UI.line, selected ? UI.gold : UI.line);
    this.add.rectangle(place.x, place.y + place.h / 2 - 19, place.w - 4, 34, UI.void, 0.96);
    const tag = place.name === 'GATEKEEPER' && gameState.nextGaryDialogue()
      ? 'NEW CONVERSATION'
      : place.tag;
    this.add.text(place.x, place.y + place.h / 2 - 31, tag, {
      fontFamily: BODY_FONT, fontSize: '8px', color: enabled ? UI.mutedBright : UI.muted,
    }).setOrigin(0.5, 0);
    this.add.text(place.x, place.y + place.h / 2 - 17, place.name, {
      fontFamily: DISPLAY_FONT, fontSize: place.name.length > 12 ? '7px' : '8px',
      color: selected ? UI.hi : enabled ? UI.text : UI.muted,
    }).setOrigin(0.5, 0);
    const hit = this.add.rectangle(place.x, place.y, place.w, place.h, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: enabled });
    hit.on('pointerover', () => { if (this.selected !== index) { this.selected = index; this.draw(); } });
    hit.on('pointerdown', () => { this.selected = index; this.enterSelected(); });
  }

  private drawDetail(place: Place): void {
    const y = 529;
    panel(this, 312, y, 568, 88);
    const enabled = place.enabled?.() ?? true;
    const blocked = enabled ? null : place.blockedReason?.() ?? null;
    this.add.rectangle(31, y, 6, 88, enabled ? place.color : UI.line);
    this.add.text(48, y - 30, place.name, {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: enabled ? UI.hi : UI.muted,
    });
    this.add.text(48, y - 8, enabled ? 'OPEN' : blocked ? 'CLOSED' : 'SHUTTERED', {
      fontFamily: BODY_FONT, fontSize: '9px', color: enabled ? UI.greenCss : UI.redCss,
    });
    this.add.text(48, y + 13, blocked ?? place.pitch, {
      fontFamily: BODY_FONT, fontSize: '11px', color: blocked ? UI.redCss : UI.body,
      wordWrap: { width: 520 },
    });

    panel(this, 725, y, 246, 88);
    const status = resolvePartyStatus(gameState.defaultParty, gameState.creatureBox);
    if (status.kind === 'ready') {
      status.members.forEach((c, i) => {
        const t = getTemplate(c.speciesId);
        const x = 624 + i * 76;
        spritePlate(this, x, y - 8, 34, 34, archetypeColor(t.archetype));
        this.add.text(x, y + 18, (c.nickname ?? t.name).slice(0, 9), {
          fontFamily: BODY_FONT, fontSize: '8px', color: UI.text,
        }).setOrigin(0.5);
      });
    } else {
      this.add.text(725, y, describePartyStatus(status) ?? 'Choose a party.', {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.redCss,
        align: 'center', wordWrap: { width: 210 },
      }).setOrigin(0.5);
    }

    const actionLabel = enabled
      ? place.name === 'THE TOWER' ? 'ENTER TOWER'
        : place.name === 'THE ROOST' ? 'PARTY'
          : place.name === 'HATCHERY' ? 'BREED'
            : place.name === 'THE ARCHIVE' ? 'PEDIA' : place.scene ? 'GO IN' : 'READ'
      : blocked ? 'CLOSED' : 'SHUTTERED';
    button(this, 874, y, 112, 88, actionLabel, enabled ? () => this.enterSelected() : null,
      place.name === 'HATCHERY' ? UI.teal : UI.gold, enabled && !!place.scene);
  }

  private move(delta: number): void {
    this.selected = (this.selected + delta + this.places.length) % this.places.length;
    this.draw();
  }

  private enterSelected(): void {
    const place = this.places[this.selected];
    if ((place.enabled?.() ?? true) && place.scene) {
      this.scene.start(place.scene);
    }
  }
}
