import Phaser from 'phaser';
import { CombatCreature } from '../../types';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, hpColor, screenFrame,
} from '../../ui/Theme';

/**
 * Presentation-only combat screen layout, matching
 * `design_handoff_tower_screens/screens/Combat Screen.dc.html` pixel-for-pixel
 * where the mockup gives an explicit value, and filling in reasonable values
 * for what the mockup leaves to CSS flex (row heights etc).
 *
 * 960x640 frame, 4px border, 16px padding -> content box x:20-940, y:20-620.
 * Column layout, computed top-down:
 *   header      y 20-92   (72 tall: mockup's row + our AUTO/SPEED toggle row)
 *   gap 12
 *   enemy field y 105-417 (312 tall)
 *   gap 12
 *   bottom row  y 429-589 (160 tall: party cards + command panel)
 *   gap 12
 *   footer      y ~608 (single baseline)
 */
export const LAYOUT = {
  contentLeft: 20,
  contentRight: 940,
  headerTop: 20,
  headerBorderY: 91,
  enemyFieldTop: 105,
  enemyFieldBottom: 417,
  bottomRowTop: 429,
  bottomRowBottom: 589,
  footerY: 608,
} as const;

export interface ChipSpec {
  label: string;
  color: string;
  border: number;
  bg: number;
}

export interface RootCommandSpec {
  label: string;
  selected: boolean;
  disabled: boolean;
  onHover: () => void;
  onClick: () => void;
}

export interface SubRowSpec {
  label: string;
  meta: string;
  selected: boolean;
  disabled: boolean;
  onHover: () => void;
  onClick: () => void;
}

export interface CommandPanelView {
  headline: string;
  showBack: boolean;
  onBack: () => void;
  /** true = show the 4-command root grid; false = show subRows. */
  rootOpen: boolean;
  rootCommands: RootCommandSpec[];
  subRows: SubRowSpec[];
  /** Whether pointer handlers should be attached at all (false during EXECUTING etc). */
  interactive: boolean;
}

export interface BattlefieldView {
  floorLabel: string;
  round: number;
  turnOrderChips: ChipSpec[];
  playerParty: CombatCreature[];
  enemyParty: CombatCreature[];
  /** Whose turn it is right now — framed gold on the party row. */
  currentActor: CombatCreature | undefined;
  currentTarget: CombatCreature | null;
  enemyInteractive: boolean;
  onEnemyHover: (enemy: CombatCreature) => void;
  onEnemyClick: (enemy: CombatCreature) => void;
  allyInteractive: boolean;
  onAllyHover: (ally: CombatCreature) => void;
  onAllyClick: (ally: CombatCreature) => void;
  command: CommandPanelView;
  footerDetail: string;
  footerTarget: string;
}

/** Create-then-measure-then-destroy: the only reliable way to right-align text of unknown width. */
function measureWidth(scene: Phaser.Scene, text: string, fontFamily: string, fontSize: string): number {
  const t = scene.add.text(-9999, -9999, text, { fontFamily, fontSize });
  const w = t.width;
  t.destroy();
  return w;
}

export function renderBattlefield(scene: Phaser.Scene, view: BattlefieldView): void {
  screenFrame(scene);
  drawHeader(scene, view);
  drawEnemyField(scene, view);
  drawBottomRow(scene, view);
  drawFooter(scene, view);
}

// ---------- Header ----------

function drawHeader(scene: Phaser.Scene, view: BattlefieldView): void {
  const { contentLeft, contentRight, headerTop, headerBorderY } = LAYOUT;
  const rowY = headerTop + 14;

  const title = scene.add.text(contentLeft, rowY, view.floorLabel, {
    fontFamily: DISPLAY_FONT, fontSize: '13px', color: UI.hi,
  }).setOrigin(0, 0.5);
  scene.add.text(contentLeft + title.width + 16, rowY, `ROUND ${view.round}`, {
    fontFamily: BODY_FONT, fontSize: '12px', color: UI.muted,
  }).setOrigin(0, 0.5);

  // Turn order: right-aligned "TURN ORDER" label + chips, all on one row.
  const chips = view.turnOrderChips.slice(0, 6);
  const labelW = measureWidth(scene, 'TURN ORDER', BODY_FONT, '11px');
  const chipWidths = chips.map(c => measureWidth(scene, c.label, BODY_FONT, '11px') + 12);
  const gap = 8;
  const total = labelW + gap + chipWidths.reduce((a, b) => a + b + gap, 0);
  let x = contentRight - total;
  scene.add.text(x, rowY, 'TURN ORDER', {
    fontFamily: BODY_FONT, fontSize: '11px', color: UI.muted,
  }).setOrigin(0, 0.5);
  x += labelW + gap;
  chips.forEach((chip, i) => {
    const w = chipWidths[i];
    const cx = x + w / 2;
    scene.add.rectangle(cx, rowY, w, 18, chip.bg).setStrokeStyle(2, chip.border);
    scene.add.text(cx, rowY, chip.label, {
      fontFamily: BODY_FONT, fontSize: '11px', color: chip.color,
    }).setOrigin(0.5);
    x += w + gap;
  });

  scene.add.rectangle((contentLeft + contentRight) / 2, headerBorderY, contentRight - contentLeft, 3, UI.plate);
}

// ---------- Enemy field ----------

const ENEMY_TILE_W = 200;
const ENEMY_SPRITE_H = 108;
const ENEMY_COL_GAP = 8;
const ENEMY_ROW_GAP = 4;
const ENEMY_TILE_H = ENEMY_SPRITE_H + 5 + 8 + 5 + 14; // sprite + gap + hpbar + gap + status

function drawEnemyField(scene: Phaser.Scene, view: BattlefieldView): void {
  const { contentLeft, contentRight, enemyFieldTop, enemyFieldBottom } = LAYOUT;
  const w = contentRight - contentLeft;
  const h = enemyFieldBottom - enemyFieldTop;
  const cx = (contentLeft + contentRight) / 2;
  const cy = (enemyFieldTop + enemyFieldBottom) / 2;

  scene.add.rectangle(cx, cy, w, h, UI.panel).setStrokeStyle(3, UI.plate);
  // Horizontal scanlines, approximating the mockup's repeating-linear-gradient.
  const scan = scene.add.graphics();
  scan.lineStyle(2, UI.line, 0.14);
  for (let y = enemyFieldTop + 4; y < enemyFieldBottom; y += 8) {
    scan.lineBetween(contentLeft + 2, y, contentRight - 2, y);
  }

  const innerLeft = contentLeft + 3 + 12;
  const innerRight = contentRight - 3 - 12;
  const innerTop = enemyFieldTop + 3 + 12;
  const innerBottom = enemyFieldBottom - 3 - 12;
  const innerW = innerRight - innerLeft;
  const innerH = innerBottom - innerTop;

  const n = view.enemyParty.length;
  const cols = Math.min(3, Math.max(1, n));
  const rows = Math.ceil(n / 3);
  const groupW = cols * ENEMY_TILE_W + (cols - 1) * ENEMY_COL_GAP;
  const groupH = rows * ENEMY_TILE_H + (rows - 1) * ENEMY_ROW_GAP;
  const groupLeft = innerLeft + Math.max(0, (innerW - groupW) / 2);
  const groupTop = innerTop + Math.max(0, (innerH - groupH) / 2);

  view.enemyParty.forEach((enemy, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const tileX = groupLeft + col * (ENEMY_TILE_W + ENEMY_COL_GAP) + ENEMY_TILE_W / 2;
    const tileTop = groupTop + row * (ENEMY_TILE_H + ENEMY_ROW_GAP);
    drawEnemyTile(scene, view, enemy, tileX, tileTop);
  });
}

function drawEnemyTile(
  scene: Phaser.Scene, view: BattlefieldView, enemy: CombatCreature, x: number, tileTop: number,
): void {
  const targeted = view.currentTarget === enemy && !enemy.isKnockedOut;
  const color = archetypeColor(enemy.template.archetype);
  const spriteCenterY = tileTop + ENEMY_SPRITE_H / 2;

  // Diagonal-stripe tint, no border (the mockup's sprite plate has none).
  const g = scene.add.graphics();
  const alpha = enemy.isKnockedOut ? 0.12 : (targeted ? 0.35 : 0.27); // dim when unselected
  g.lineStyle(5, color, alpha);
  const left = x - ENEMY_TILE_W / 2;
  const top = tileTop;
  const right = x + ENEMY_TILE_W / 2;
  const bottom = tileTop + ENEMY_SPRITE_H;
  for (let d = -ENEMY_SPRITE_H; d < ENEMY_TILE_W; d += 10) {
    const x1 = Math.max(left, left + d);
    const y1 = top + Math.max(0, -d);
    const x2 = Math.min(right, left + d + ENEMY_SPRITE_H);
    const y2 = bottom - Math.max(0, d + ENEMY_SPRITE_H - ENEMY_TILE_W);
    g.lineBetween(x1, y1, x2, y2);
  }

  if (enemy.isKnockedOut) {
    scene.add.text(x, spriteCenterY, 'DOWN', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.muted,
    }).setOrigin(0.5);
  }

  // Targeting hotspot covers the whole tile (sprite + bars).
  if (view.enemyInteractive && !enemy.isKnockedOut) {
    const hotspot = scene.add.rectangle(x, tileTop + ENEMY_TILE_H / 2, ENEMY_TILE_W, ENEMY_TILE_H, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hotspot.on('pointerover', () => view.onEnemyHover(enemy));
    hotspot.on('pointerdown', () => view.onEnemyClick(enemy));
  }

  // HP bar: 116x8, 2px border, gold when targeted.
  const barY = tileTop + ENEMY_SPRITE_H + 5 + 4;
  scene.add.rectangle(x, barY, 116, 8, UI.void).setStrokeStyle(2, targeted ? UI.gold : UI.line);
  const pct = enemy.maxHp > 0 ? Math.max(0, enemy.currentHp / enemy.maxHp) : 0;
  if (pct > 0) {
    scene.add.rectangle(x - 56, barY, 112 * pct, 6, hpColor(enemy.currentHp, enemy.maxHp)).setOrigin(0, 0.5);
  }

  // Status text.
  const statusY = barY + 4 + 5 + 7;
  const statusLabel = enemy.statusEffects.map(s => s.type.slice(0, 3).toUpperCase()).join(' ');
  if (statusLabel) {
    scene.add.text(x, statusY, statusLabel, {
      fontFamily: BODY_FONT, fontSize: '10px', color: '#de5d3a',
    }).setOrigin(0.5);
  }

  // Gold downward triangle above the targeted enemy.
  if (targeted) {
    const tri = scene.add.graphics();
    tri.fillStyle(UI.gold, 1);
    const triTop = tileTop + 2;
    tri.fillTriangle(x - 9, triTop, x + 9, triTop, x, triTop + 12);
  }
}

// ---------- Bottom row: party cards + command panel ----------

const PARTY_CARD_W = 128;
const PARTY_CARD_GAP = 8;

function drawBottomRow(scene: Phaser.Scene, view: BattlefieldView): void {
  const { contentLeft, bottomRowTop, bottomRowBottom } = LAYOUT;
  const cardTop = bottomRowTop;
  view.playerParty.forEach((creature, i) => {
    const x = contentLeft + PARTY_CARD_W / 2 + i * (PARTY_CARD_W + PARTY_CARD_GAP);
    drawPartyCard(scene, view, creature, x, cardTop, bottomRowBottom - bottomRowTop);
  });

  const partyBlockRight = contentLeft + view.playerParty.length * PARTY_CARD_W
    + Math.max(0, view.playerParty.length - 1) * PARTY_CARD_GAP;
  drawCommandPanel(scene, view, partyBlockRight + 12, bottomRowTop, LAYOUT.contentRight, bottomRowBottom);
}

function drawPartyCard(
  scene: Phaser.Scene, view: BattlefieldView, creature: CombatCreature, x: number, top: number, h: number,
): void {
  const ko = creature.isKnockedOut;
  const active = view.currentActor === creature;
  const frame = ko ? UI.plate : (active ? UI.gold : UI.lineBright);
  const plateColor = ko ? 0x1a1a26 : (active ? UI.line : UI.plate);
  const cy = top + h / 2;

  scene.add.rectangle(x, cy, PARTY_CARD_W, h, plateColor).setStrokeStyle(3, frame);

  if (view.allyInteractive && !ko) {
    const hotspot = scene.add.rectangle(x, cy, PARTY_CARD_W, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hotspot.on('pointerover', () => view.onAllyHover(creature));
    hotspot.on('pointerdown', () => view.onAllyClick(creature));
  }

  const innerLeft = x - PARTY_CARD_W / 2 + 7;
  const innerW = PARTY_CARD_W - 14;
  let y = top + 7;

  const color = archetypeColor(creature.template.archetype);
  const spriteCy = y + 31;
  const sg = scene.add.graphics();
  sg.lineStyle(2, UI.line, 1);
  sg.strokeRect(innerLeft, y, innerW, 62);
  sg.lineStyle(4, color, ko ? 0.12 : 0.35);
  const left = innerLeft, spTop = y, right = innerLeft + innerW, bottom = y + 62;
  for (let d = -62; d < innerW; d += 8) {
    const x1 = Math.max(left, left + d);
    const y1 = spTop + Math.max(0, -d);
    const x2 = Math.min(right, left + d + 62);
    const y2 = bottom - Math.max(0, d + 62 - innerW);
    sg.lineBetween(x1, y1, x2, y2);
  }
  void spriteCy;
  y += 62 + 5;

  scene.add.text(innerLeft, y, creature.template.name.toUpperCase(), {
    fontFamily: DISPLAY_FONT, fontSize: '9px', color: ko ? UI.muted : UI.text,
    wordWrap: { width: innerW },
  });
  y += 13 + 5;

  scene.add.text(innerLeft, y, 'HP', { fontFamily: BODY_FONT, fontSize: '10px', color: UI.muted });
  scene.add.text(innerLeft + innerW, y, `${creature.currentHp}/${creature.maxHp}`, {
    fontFamily: BODY_FONT, fontSize: '11px',
    color: Phaser.Display.Color.IntegerToColor(hpColor(creature.currentHp, creature.maxHp)).rgba,
  }).setOrigin(1, 0);
  y += 15 + 5;

  scene.add.text(innerLeft, y, 'MP', { fontFamily: BODY_FONT, fontSize: '10px', color: UI.muted });
  scene.add.text(innerLeft + innerW, y, `${creature.currentMp}/${creature.maxMp}`, {
    fontFamily: BODY_FONT, fontSize: '11px', color: creature.currentMp === 0 ? '#5e5b8c' : UI.tealCss,
  }).setOrigin(1, 0);
  y += 15 + 5;

  const statuses = creature.statusEffects.map(s => s.type.slice(0, 3).toUpperCase()).join(' ');
  scene.add.text(innerLeft, y, ko ? 'FAINTED' : statuses, {
    fontFamily: BODY_FONT, fontSize: '10px', color: ko ? UI.muted : '#de5d3a',
  });
}

// ---------- Command panel ----------

const CELL_W = 241;
const CELL_H = 56;
const CELL_GAP = 7;

function drawCommandPanel(
  scene: Phaser.Scene, view: BattlefieldView, left: number, top: number, right: number, bottom: number,
): void {
  const w = right - left;
  const h = bottom - top;
  const cx = left + w / 2;
  const cy = top + h / 2;
  const cmd = view.command;

  scene.add.rectangle(cx, cy, w, h, UI.plate).setStrokeStyle(3, UI.lineBright);

  const innerLeft = left + 9;
  const innerRight = right - 9;
  const headY = top + 9 + 6;

  scene.add.text(innerLeft, headY, cmd.headline, {
    fontFamily: BODY_FONT, fontSize: '11px', color: UI.muted,
  }).setOrigin(0, 0.5);

  if (cmd.showBack) {
    const backW = measureWidth(scene, 'BACK', BODY_FONT, '10px') + 12;
    const backX = innerRight - backW / 2;
    const backBg = scene.add.rectangle(backX, headY, backW, 16, UI.void).setStrokeStyle(2, UI.lineBright);
    scene.add.text(backX, headY, 'BACK', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    }).setOrigin(0.5);
    if (cmd.interactive) {
      backBg.setInteractive({ useHandCursor: true }).on('pointerdown', cmd.onBack);
    }
  }

  const gridTop = top + 9 + 16 + 7;
  const gridBottom = bottom - 9;
  const gridLeft = innerLeft;
  const gridRight = innerRight;
  const gridCx = (gridLeft + gridRight) / 2;
  const gridCy = (gridTop + gridBottom) / 2;

  const cellCenters = [
    { x: gridCx - CELL_W / 2 - CELL_GAP / 2, y: gridCy - CELL_H / 2 - CELL_GAP / 2 },
    { x: gridCx + CELL_W / 2 + CELL_GAP / 2, y: gridCy - CELL_H / 2 - CELL_GAP / 2 },
    { x: gridCx - CELL_W / 2 - CELL_GAP / 2, y: gridCy + CELL_H / 2 + CELL_GAP / 2 },
    { x: gridCx + CELL_W / 2 + CELL_GAP / 2, y: gridCy + CELL_H / 2 + CELL_GAP / 2 },
  ];

  if (cmd.rootOpen) {
    cmd.rootCommands.forEach((c, i) => {
      const { x, y } = cellCenters[i];
      const bg = c.selected ? UI.gold : UI.void;
      const border = c.disabled ? UI.line : (c.selected ? UI.gold : UI.lineBright);
      const rect = scene.add.rectangle(x, y, CELL_W, CELL_H, bg).setStrokeStyle(2, border);
      scene.add.text(x, y, c.label, {
        fontFamily: DISPLAY_FONT, fontSize: '11px',
        color: c.disabled ? UI.muted : (c.selected ? UI.voidCss : UI.text),
      }).setOrigin(0.5);
      // Hover works even when disabled (RUN) so its footer detail can explain
      // why; only the click itself is gated on being enabled.
      if (cmd.interactive) {
        rect.setInteractive({ useHandCursor: !c.disabled });
        rect.on('pointerover', c.onHover);
        if (!c.disabled) rect.on('pointerdown', c.onClick);
      }
    });
  } else {
    cmd.subRows.forEach((r, i) => {
      if (i >= cellCenters.length) return;
      if (!r.label && !r.meta) return; // padding placeholder — render nothing
      const { x, y } = cellCenters[i];
      const bg = r.disabled ? UI.void : (r.selected ? UI.gold : UI.void);
      const border = r.disabled ? UI.line : (r.selected ? UI.gold : UI.line);
      const rect = scene.add.rectangle(x, y, CELL_W, CELL_H, bg).setStrokeStyle(2, border);
      const textColor = r.disabled ? UI.mutedBright : (r.selected ? UI.voidCss : UI.text);
      const metaColor = r.disabled ? UI.mutedBright : (r.selected ? '#2c1e31' : UI.muted);
      scene.add.text(x - CELL_W / 2 + 8, y - 10, r.label, {
        fontFamily: BODY_FONT, fontSize: '12px', color: textColor,
      }).setOrigin(0, 0.5);
      scene.add.text(x - CELL_W / 2 + 8, y + 9, r.meta, {
        fontFamily: BODY_FONT, fontSize: '10px', color: metaColor,
      }).setOrigin(0, 0.5);
      if (cmd.interactive) {
        rect.setInteractive({ useHandCursor: !r.disabled });
        rect.on('pointerover', r.onHover);
        if (!r.disabled) rect.on('pointerdown', r.onClick);
      }
    });
  }
}

// ---------- Footer ----------

function drawFooter(scene: Phaser.Scene, view: BattlefieldView): void {
  const { contentLeft, contentRight, footerY } = LAYOUT;
  scene.add.text(contentLeft, footerY, view.footerDetail, {
    fontFamily: BODY_FONT, fontSize: '12px', color: UI.body,
  }).setOrigin(0, 0.5);
  scene.add.text(contentRight, footerY, view.footerTarget, {
    fontFamily: BODY_FONT, fontSize: '12px', color: UI.mutedBright,
  }).setOrigin(1, 0.5);
}
