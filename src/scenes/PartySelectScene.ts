import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { TACTIC_LABELS, TACTIC_ORDER, CreatureInstance } from '../types';
import { PARTY_SIZE } from '../systems/PartyStatus';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, footer, header,
  panel, screenFrame, spritePlate, stars, backButton,
} from '../ui/Theme';
import { paging, PAGE_SIZE, GRID_COLS } from '../ui/paging';

/**
 * Card names start right of the sprite plate with ~75px to the card edge, which at
 * the 7px display font is about ten characters. Longer names (Weeping Willow,
 * Golem Grimace) used to run straight over the neighbouring card.
 */
const CARD_NAME_MAX = 10;
function cardName(name: string): string {
  return name.length > CARD_NAME_MAX ? `${name.slice(0, CARD_NAME_MAX - 1)}.` : name;
}

export class PartySelectScene extends Phaser.Scene {
  private selected: string[] = [];
  private candidateIndex = 0;
  private slot = 0;
  private page = 0;

  constructor() {
    super({ key: 'PartySelectScene' });
  }

  create(): void {
    const available = this.available();
    this.selected = gameState.defaultParty.filter(id => available.some(c => c.instanceId === id));
    this.candidateIndex = 0;
    this.slot = 0;
    this.page = 0;
    this.draw();
    this.input.keyboard?.on('keydown-LEFT', () => this.moveCandidate(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.moveCandidate(1));
    this.input.keyboard?.on('keydown-UP', () => this.moveCandidate(-GRID_COLS));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveCandidate(GRID_COLS));
    this.input.keyboard?.on('keydown-PAGE_UP', () => this.changePage(-1));
    this.input.keyboard?.on('keydown-PAGE_DOWN', () => this.changePage(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.swapCandidate());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('TownScene'));
  }

  private available(): CreatureInstance[] {
    return gameState.creatureBox.filter(c => !c.isRetired);
  }

  private draw(): void {
    this.children.removeAll(true);
    const creatures = this.available();
    const candidate = creatures[this.candidateIndex];
    const readyCount = creatures.filter(c => c.permanentLevel >= c.levelCap).length;
    screenFrame(this);
    header(this, 'THE ROOST', `${creatures.length} KEPT  ·  ${this.selected.length} IN PARTY`,
      `${readyCount} BREED-READY`, UI.tealCss);

    backButton(this, () => this.scene.start('TownScene'));
    this.add.text(146, 94, 'CREATURE BOX', {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
    });
    // Resolve through `paging` rather than trusting this.page: the box can shrink
    // under the viewer (breeding retires two parents) and will grow past one page
    // once capture lands.
    const p = paging(creatures.length, this.page);
    this.page = p.page;

    this.add.text(614, 94, `PAGE ${p.page + 1}/${p.pageCount}`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
    }).setOrigin(1, 0);
    // Pointer-reachable paging. Without these the box was keyboard-only past page 1,
    // because a card can only be hovered on the page already being drawn.
    this.drawPageArrow(636, 98, '<', p.hasPrev, () => this.changePage(-1));
    this.drawPageArrow(664, 98, '>', p.hasNext, () => this.changePage(1));

    creatures.slice(p.start, p.end).forEach((creature, i) => {
      const globalIndex = p.start + i;
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = 104 + col * 154;
      const y = 178 + row * 116;
      this.drawCreatureCard(creature, x, y, globalIndex === this.candidateIndex, globalIndex);
    });

    panel(this, 804, 346, 252, 490);
    this.add.text(696, 116, 'BRINGING DOWN', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.hi,
    });
    for (let i = 0; i < PARTY_SIZE; i++) this.drawPartySlot(i, 696, 145 + i * 68);

    if (candidate) this.drawCompare(candidate);

    const canSave = this.selected.length === PARTY_SIZE;
    // Laid out to not overlap: CONFIRM spans 695..845, BACK spans 854..926, both
    // inside the 678..930 panel. The old coords overlapped by 18px and BACK drew
    // on top, clipping the label to "CONFIRM PART".
    button(this, 770, 568, 150, 38, canSave ? 'CONFIRM PARTY' : `${this.selected.length} / ${PARTY_SIZE} CHOSEN`,
      canSave ? () => this.confirm() : null, UI.gold, canSave);
    button(this, 890, 568, 72, 38, 'BACK', () => this.scene.start('TownScene'), UI.lineBright);
    footer(this, p.pageCount > 1
      ? 'ARROWS BROWSE  ·  PGUP/PGDN PAGE  ·  ENTER SWAP  ·  ESC BACK'
      : 'ARROWS BROWSE  ·  ENTER SWAP  ·  ESC BACK',
      candidate ? `${getTemplate(candidate.speciesId).name} SELECTED` : 'BOX EMPTY');
  }

  private drawCreatureCard(creature: CreatureInstance, x: number, y: number, selected: boolean, index: number): void {
    const t = getTemplate(creature.speciesId);
    const inParty = this.selected.includes(creature.instanceId);
    const bg = panel(this, x, y, 142, 102, selected);
    this.add.rectangle(x - 68, y, 6, 102, archetypeColor(t.archetype));
    spritePlate(this, x - 36, y - 8, 46, 46, archetypeColor(t.archetype));
    this.add.text(x - 4, y - 39, t.archetype.toUpperCase(), {
      fontFamily: BODY_FONT, fontSize: '8px', color: UI.muted,
    });
    if (inParty) {
      this.add.text(x + 62, y - 39, 'IN', {
        fontFamily: DISPLAY_FONT, fontSize: '7px', color: UI.goldCss,
      }).setOrigin(1, 0);
    }
    this.add.text(x - 4, y - 20, cardName(creature.nickname ?? t.name), {
      fontFamily: DISPLAY_FONT, fontSize: '7px', color: selected ? UI.hi : UI.text,
    });
    this.add.text(x - 4, y - 2, stars(creature.starRating), {
      fontFamily: BODY_FONT, fontSize: '8px', color: UI.goldCss,
    });
    this.add.text(x - 4, y + 16, `LV ${creature.permanentLevel}`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.body,
    });
    this.add.text(x - 58, y + 36, TACTIC_LABELS[creature.tactic].toUpperCase(), {
      fontFamily: BODY_FONT, fontSize: '7px', color: UI.tealCss,
    });
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => { if (this.candidateIndex !== index) { this.candidateIndex = index; this.draw(); } });
    bg.on('pointerdown', () => { this.candidateIndex = index; this.swapCandidate(); });
  }

  private drawPartySlot(index: number, x: number, y: number): void {
    const id = this.selected[index];
    const creature = this.available().find(c => c.instanceId === id);
    const selectedSlot = this.slot === index;
    const bg = panel(this, x + 108, y + 24, 216, 58, selectedSlot);
    if (!creature) {
      this.add.text(x + 108, y + 24, `SLOT ${index + 1} — EMPTY`, {
        fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.muted,
      }).setOrigin(0.5);
    } else {
      const t = getTemplate(creature.speciesId);
      this.add.rectangle(x + 3, y + 24, 6, 58, archetypeColor(t.archetype));
      spritePlate(this, x + 29, y + 24, 32, 32, archetypeColor(t.archetype));
      this.add.text(x + 52, y + 7, creature.nickname ?? t.name, {
        fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.text,
      });
      this.add.text(x + 52, y + 25, `LV ${creature.permanentLevel} · ATK ${creature.currentStats.str} DEF ${creature.currentStats.def}`, {
        fontFamily: BODY_FONT, fontSize: '8px', color: UI.body,
      });
      const tactic = this.add.text(x + 52, y + 40, TACTIC_LABELS[creature.tactic].toUpperCase(), {
        fontFamily: BODY_FONT, fontSize: '7px', color: UI.tealCss,
      }).setInteractive({ useHandCursor: true });
      tactic.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        const ti = TACTIC_ORDER.indexOf(creature.tactic);
        creature.tactic = TACTIC_ORDER[(ti + 1) % TACTIC_ORDER.length];
        gameState.saveToLocalStorage();
        this.draw();
      });
    }
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.slot = index; this.draw(); });
  }

  private drawCompare(candidate: CreatureInstance): void {
    const t = getTemplate(candidate.speciesId);
    const replaced = this.available().find(c => c.instanceId === this.selected[this.slot]);
    panel(this, 804, 420, 216, 148);
    this.add.text(708, 354, `REPLACES SLOT ${this.slot + 1}`, {
      fontFamily: BODY_FONT, fontSize: '8px', color: UI.muted,
    });
    this.add.text(708, 373, candidate.nickname ?? t.name, {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.hi,
    });
    this.add.text(708, 393, `${stars(candidate.starRating)}  LV ${candidate.permanentLevel}`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.goldCss,
    });
    const rows: Array<['ATK' | 'DEF' | 'SPD', number, number | undefined]> = [
      ['ATK', candidate.currentStats.str, replaced?.currentStats.str],
      ['DEF', candidate.currentStats.def, replaced?.currentStats.def],
      ['SPD', candidate.currentStats.spd, replaced?.currentStats.spd],
    ];
    rows.forEach(([label, value, old], i) => {
      const delta = old === undefined ? 0 : value - old;
      this.add.text(708, 420 + i * 20, `${label} ${value}`, {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
      });
      this.add.text(900, 420 + i * 20, old === undefined ? 'EMPTY SLOT' : `${delta >= 0 ? '+' : ''}${delta} VS ${getTemplate(replaced!.speciesId).name}`, {
        fontFamily: BODY_FONT, fontSize: '8px',
        color: delta > 0 ? UI.greenCss : delta < 0 ? UI.redCss : UI.muted,
      }).setOrigin(1, 0);
    });
    const ready = candidate.permanentLevel >= candidate.levelCap;
    this.add.text(708, 486, ready ? 'BREED-READY' : `NOT READY · LV ${candidate.levelCap} REQUIRED`, {
      fontFamily: BODY_FONT, fontSize: '8px', color: ready ? UI.tealCss : UI.muted,
    });
    const already = this.selected.includes(candidate.instanceId);
    button(this, 804, 515, 192, 28, already ? 'IN PARTY' : 'SWAP IN',
      already ? null : () => this.swapCandidate(), UI.gold, !already);
  }

  private drawPageArrow(x: number, y: number, glyph: string, active: boolean, onClick: () => void): void {
    const t = this.add.text(x, y, glyph, {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: active ? UI.hi : UI.muted,
    }).setOrigin(0.5, 0);
    if (!active) return;
    t.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
  }

  /**
   * Turn the page directly, moving the cursor onto that page's first card so the
   * comparison panel keeps describing something the player can actually see.
   */
  private changePage(delta: number): void {
    const creatures = this.available();
    if (!creatures.length) return;
    const p = paging(creatures.length, this.page + delta);
    if (p.page === this.page) return;
    this.page = p.page;
    this.candidateIndex = p.start;
    this.draw();
  }

  private moveCandidate(delta: number): void {
    const creatures = this.available();
    if (!creatures.length) return;
    this.candidateIndex = Math.max(0, Math.min(creatures.length - 1, this.candidateIndex + delta));
    this.page = paging(creatures.length, Math.floor(this.candidateIndex / PAGE_SIZE)).page;
    this.draw();
  }

  private swapCandidate(): void {
    const candidate = this.available()[this.candidateIndex];
    if (!candidate || this.selected.includes(candidate.instanceId)) return;
    if (this.slot < this.selected.length) this.selected[this.slot] = candidate.instanceId;
    else this.selected.push(candidate.instanceId);
    this.slot = (this.slot + 1) % PARTY_SIZE;
    this.draw();
  }

  private confirm(): void {
    if (this.selected.length !== PARTY_SIZE) return;
    gameState.setDefaultParty(this.selected);
    gameState.saveToLocalStorage();
    this.scene.start('TownScene');
  }
}
