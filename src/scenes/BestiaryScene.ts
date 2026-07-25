import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getAbility } from '../data/abilities';
import {
  buildBestiary, bestiaryProgress, pageOf, pageCount, BestiaryEntry,
} from '../systems/Bestiary';

const PAGE_SIZE = 30;
const COLS = 6;
const CELL_W = 140;
const CELL_H = 70;
const GRID_X = 90;
const GRID_Y = 130;
const COL_SPACING = 145;
const ROW_SPACING = 82;

export class BestiaryScene extends Phaser.Scene {
  private entries: BestiaryEntry[] = [];
  private pageIndex = 0;
  private detailFor: BestiaryEntry | null = null;

  /**
   * Every interactive object this scene creates. Tracked so they can be
   * explicitly destroyed on redraw — children.removeAll() only detaches from
   * the display list and leaves input handlers registered, which turns stale
   * cells into invisible hotspots.
   */
  private uiElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'BestiaryScene' });
  }

  create(): void {
    this.entries = buildBestiary(gameState.seenSpecies);
    this.pageIndex = 0;
    this.detailFor = null;
    this.uiElements = [];
    this.draw();
  }

  private clearUI(): void {
    for (const el of this.uiElements) el.destroy();
    this.uiElements = [];
  }

  private draw(): void {
    this.clearUI();
    this.children.removeAll();

    const cx = this.cameras.main.centerX;
    this.add.rectangle(480, 320, 960, 640, 0x1a1a2e);

    this.add.text(cx, 30, 'MONSTERPEDIA', {
      fontSize: '24px', color: '#e0d0a0', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const { discovered, total } = bestiaryProgress(this.entries);
    this.add.text(cx, 62, `Discovered ${discovered} / ${total}`, {
      fontSize: '14px', color: '#88ccff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.drawGrid();
    this.drawPaging();

    const back = this.add.text(30, 600, '← Back', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true });
    this.uiElements.push(back);
    back.on('pointerdown', () => this.scene.start('TownScene'));

    // The detail panel is drawn last so it sits above the grid, and its
    // backdrop swallows clicks that would otherwise reach cells underneath.
    if (this.detailFor) this.drawDetail(this.detailFor);
  }

  private drawGrid(): void {
    const page = pageOf(this.entries, this.pageIndex, PAGE_SIZE);

    page.forEach((entry, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GRID_X + col * COL_SPACING;
      const y = GRID_Y + row * ROW_SPACING;

      const cell = this.add.rectangle(x, y, CELL_W, CELL_H, 0x222244, 0.9)
        .setStrokeStyle(1, entry.discovered ? 0x445588 : 0x2a2a3a);

      if (entry.discovered) {
        this.add.rectangle(x - 45, y, 38, 38, entry.template.spriteColor);
        this.add.text(x - 20, y - 12, entry.name, {
          fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
        });
        this.add.text(x - 20, y + 4, entry.archetype, {
          fontSize: '10px', color: '#8888aa', fontFamily: 'monospace',
        });

        cell.setInteractive({ useHandCursor: true });
        this.uiElements.push(cell);
        cell.on('pointerover', () => cell.setFillStyle(0x33335a));
        cell.on('pointerout', () => cell.setFillStyle(0x222244));
        cell.on('pointerdown', () => {
          this.detailFor = entry;
          this.draw();
        });
      } else {
        // Silhouette: no name, no archetype, nothing that identifies the species.
        this.add.rectangle(x - 45, y, 38, 38, 0x33334a);
        this.add.text(x - 20, y - 6, '???', {
          fontSize: '12px', color: '#555577', fontFamily: 'monospace',
        });
      }
    });
  }

  private drawPaging(): void {
    const pages = pageCount(this.entries.length, PAGE_SIZE);
    if (pages <= 1) return;

    const cx = this.cameras.main.centerX;
    this.add.text(cx, 560, `Page ${this.pageIndex + 1} / ${pages}`, {
      fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (this.pageIndex > 0) {
      const prev = this.add.text(cx - 110, 560, '← Prev', {
        fontSize: '13px', color: '#88ccff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.uiElements.push(prev);
      prev.on('pointerdown', () => { this.pageIndex--; this.draw(); });
    }

    if (this.pageIndex < pages - 1) {
      const next = this.add.text(cx + 110, 560, 'Next →', {
        fontSize: '13px', color: '#88ccff', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.uiElements.push(next);
      next.on('pointerdown', () => { this.pageIndex++; this.draw(); });
    }
  }

  private drawDetail(entry: BestiaryEntry): void {
    // Full-screen backdrop: dims the grid and, because it is interactive,
    // absorbs clicks so a cell underneath cannot be triggered through it.
    const backdrop = this.add.rectangle(480, 320, 960, 640, 0x000000, 0.6)
      .setInteractive();
    this.uiElements.push(backdrop);
    backdrop.on('pointerdown', () => { this.detailFor = null; this.draw(); });

    const px = 480;
    const py = 320;
    this.add.rectangle(px, py, 560, 380, 0x222244, 0.98).setStrokeStyle(2, 0x6688aa);

    this.add.rectangle(px - 220, py - 130, 56, 56, entry.template.spriteColor);
    this.add.text(px - 175, py - 148, entry.name, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'monospace',
    });
    this.add.text(px - 175, py - 122, entry.archetype, {
      fontSize: '13px', color: '#8888aa', fontFamily: 'monospace',
    });

    const s = entry.template.baseStats;
    this.add.text(px - 220, py - 75, 'BASE STATS', {
      fontSize: '11px', color: '#88ccff', fontFamily: 'monospace',
    });
    this.add.text(px - 220, py - 55,
      `HP:${s.hp}  MP:${s.mp}  STR:${s.str}  DEF:${s.def}`, {
        fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      });
    this.add.text(px - 220, py - 37,
      `INT:${s.int}  WIS:${s.wis}  SPD:${s.spd}`, {
        fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      });

    this.add.text(px - 220, py + 0, 'ABILITIES', {
      fontSize: '11px', color: '#88ccff', fontFamily: 'monospace',
    });
    const abilityNames = entry.template.defaultAbilities
      .map(id => getAbility(id).name)
      .join(', ') || '—';
    this.add.text(px - 220, py + 20, abilityNames, {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
      wordWrap: { width: 440 },
    });

    this.add.text(px - 220, py + 60, 'RESISTS', {
      fontSize: '11px', color: '#88ffaa', fontFamily: 'monospace',
    });
    this.add.text(px - 130, py + 60, entry.template.resistances.join(', ') || 'none', {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
    });

    this.add.text(px - 220, py + 82, 'WEAK TO', {
      fontSize: '11px', color: '#ff8888', fontFamily: 'monospace',
    });
    this.add.text(px - 130, py + 82, entry.template.weaknesses.join(', ') || 'none', {
      fontSize: '12px', color: '#cccccc', fontFamily: 'monospace',
    });

    const close = this.add.text(px, py + 150, '[ CLOSE ]', {
      fontSize: '13px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.uiElements.push(close);
    close.on('pointerdown', () => { this.detailFor = null; this.draw(); });
  }
}
