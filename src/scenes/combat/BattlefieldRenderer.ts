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
  /** No root command is disabled today; capture will likely need it. */
  disabled?: boolean;
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
  tempo: number;
  tempoCap: number;
  relayReady: boolean;
  linkLabel: string | null;
  /** Chamber experiment: MP is inactive and a round-refreshing shared pool pays for moves. */
  usesSharedActions: boolean;
  actionPoints: number;
  actionPointCap: number;
  turnOrderChips: ChipSpec[];
  playerParty: CombatCreature[];
  enemyParty: CombatCreature[];
  /** Whose turn it is right now — framed gold on the party row. */
  currentActor: CombatCreature | undefined;
  currentTarget: CombatCreature | null;
  enemyInteractive: boolean;
  onEnemyHover: (enemy: CombatCreature) => void;
  onEnemyClick: (enemy: CombatCreature) => void;
  enemyIntent: (enemy: CombatCreature) => string | null;
  allyInteractive: boolean;
  /** Which allies may be clicked while `allyInteractive`. Defaults to the living. */
  allyTargetable?: (ally: CombatCreature) => boolean;
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

/** Persistent combat view. High-frequency regions update existing objects. */
export class CombatBattlefield {
  private readonly header: Phaser.GameObjects.Container;
  private readonly enemyField: EnemyFieldView;
  private readonly partyStrip: PartyStripView;
  private readonly commandPanel: Phaser.GameObjects.Container;
  private readonly footer: FooterView;

  constructor(private readonly scene: Phaser.Scene) {
    screenFrame(scene);
    this.header = scene.add.container(0, 0);
    this.enemyField = new EnemyFieldView(scene);
    scene.add.existing(this.enemyField);
    this.partyStrip = new PartyStripView(scene);
    scene.add.existing(this.partyStrip);
    this.commandPanel = scene.add.container(0, 0);
    this.footer = new FooterView(scene);
    scene.add.existing(this.footer);
  }

  update(view: BattlefieldView): void {
    rebuildContainer(this.scene, this.header, () => drawHeader(this.scene, view));
    this.enemyField.update(view);
    this.partyStrip.update(view);

    const partyBlockRight = LAYOUT.contentLeft + view.playerParty.length * PARTY_CARD_W
      + Math.max(0, view.playerParty.length - 1) * PARTY_CARD_GAP;
    rebuildContainer(this.scene, this.commandPanel, () => {
      drawCommandPanel(
        this.scene,
        view,
        partyBlockRight + 12,
        LAYOUT.bottomRowTop,
        LAYOUT.contentRight,
        LAYOUT.bottomRowBottom,
      );
    });
    this.footer.update(view);
  }
}

/** Move objects created by the existing drawing helpers into one owned region. */
function rebuildContainer(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  draw: () => void,
): void {
  container.removeAll(true);
  const before = new Set(scene.children.getAll());
  draw();
  const created = scene.children.getAll().filter(object => !before.has(object));
  container.add(created);
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

  const tempoPips = Array.from({ length: view.tempoCap }, (_, i) => i < view.tempo ? '◆' : '◇').join(' ');
  const tempoText = scene.add.text(contentLeft, headerTop + 44, `PACK TEMPO  ${tempoPips}  ${view.tempo}/${view.tempoCap}`, {
    fontFamily: BODY_FONT, fontSize: '11px', color: view.tempo > 0 ? UI.tealCss : UI.muted,
  }).setOrigin(0, 0.5);
  const actionText = view.usesSharedActions
    ? scene.add.text(contentLeft + tempoText.width + 18, headerTop + 44,
      `SHARED AP  ${view.actionPoints}/${view.actionPointCap}`, {
        fontFamily: BODY_FONT, fontSize: '11px',
        color: view.actionPoints > 0 ? UI.hi : UI.muted,
      }).setOrigin(0, 0.5)
    : null;
  const relayX = actionText
    ? actionText.x + actionText.width + 18
    : contentLeft + tempoText.width + 18;
  scene.add.text(relayX, headerTop + 44,
    view.relayReady ? 'RELAY · READY' : 'RELAY · BUILDING', {
      fontFamily: BODY_FONT, fontSize: '11px',
      color: view.relayReady ? UI.goldCss : UI.muted,
    }).setOrigin(0, 0.5);
  if (view.linkLabel) {
    scene.add.text(relayX + 142, headerTop + 44, `LINK · ${view.linkLabel}`, {
      fontFamily: BODY_FONT, fontSize: '11px', color: UI.tealCss,
    }).setOrigin(0, 0.5);
  }

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

const ENEMY_TILE_W = 200;           // preferred width; shrinks when more than 3 share the row
const ENEMY_TILE_MIN_W = 150;       // wide enough for the HP bar and an intent label
const ENEMY_SPRITE_H = 108;
const ENEMY_COL_GAP = 8;
const ENEMY_ROW_GAP = 4;
const ENEMY_TILE_H = ENEMY_SPRITE_H + 5 + 8 + 5 + 14; // sprite + gap + hpbar + gap + status

class EnemyFieldView extends Phaser.GameObjects.Container {
  private readonly tiles = new Map<string, EnemyTile>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const { contentLeft, contentRight, enemyFieldTop, enemyFieldBottom } = LAYOUT;
    const background = scene.add.rectangle(
      (contentLeft + contentRight) / 2,
      (enemyFieldTop + enemyFieldBottom) / 2,
      contentRight - contentLeft,
      enemyFieldBottom - enemyFieldTop,
      UI.panel,
    ).setStrokeStyle(3, UI.plate);
    const scanlines = scene.add.graphics();
    scanlines.lineStyle(2, UI.line, 0.14);
    for (let y = enemyFieldTop + 4; y < enemyFieldBottom; y += 8) {
      scanlines.lineBetween(contentLeft + 2, y, contentRight - 2, y);
    }
    this.add([background, scanlines]);
  }

  update(view: BattlefieldView): void {
    const { contentLeft, contentRight, enemyFieldTop, enemyFieldBottom } = LAYOUT;
    const innerLeft = contentLeft + 15;
    const innerRight = contentRight - 15;
    const innerTop = enemyFieldTop + 15;
    const innerBottom = enemyFieldBottom - 15;
    // Up to five tiles share one row (band 3+ wild fights). Tiles keep their
    // preferred width while it fits and shrink together — never below
    // ENEMY_TILE_MIN_W — before wrapping to a second row.
    const count = Math.max(1, view.enemyParty.length);
    const innerWidth = innerRight - innerLeft;
    const fitsAtMin = Math.max(1, Math.floor((innerWidth + ENEMY_COL_GAP) / (ENEMY_TILE_MIN_W + ENEMY_COL_GAP)));
    const columns = Math.min(count, fitsAtMin);
    const rows = Math.ceil(count / columns);
    const tileW = Math.min(ENEMY_TILE_W, Math.floor((innerWidth - (columns - 1) * ENEMY_COL_GAP) / columns));
    const groupWidth = columns * tileW + (columns - 1) * ENEMY_COL_GAP;
    const groupHeight = rows * ENEMY_TILE_H + (rows - 1) * ENEMY_ROW_GAP;
    const groupLeft = innerLeft + Math.max(0, (innerRight - innerLeft - groupWidth) / 2);
    const groupTop = innerTop + Math.max(0, (innerBottom - innerTop - groupHeight) / 2);
    const liveIds = new Set(view.enemyParty.map(enemy => enemy.instance.instanceId));

    for (const [id, tile] of this.tiles) {
      if (liveIds.has(id)) continue;
      tile.destroy();
      this.tiles.delete(id);
    }

    view.enemyParty.forEach((enemy, index) => {
      const id = enemy.instance.instanceId;
      let tile = this.tiles.get(id);
      if (!tile) {
        tile = new EnemyTile(this.scene);
        this.tiles.set(id, tile);
        this.add(tile);
      }
      const column = index % columns;
      const row = Math.floor(index / columns);
      tile.setPosition(
        groupLeft + column * (tileW + ENEMY_COL_GAP) + tileW / 2,
        groupTop + row * (ENEMY_TILE_H + ENEMY_ROW_GAP),
      );
      tile.update(enemy, view, tileW);
    });
  }
}

class EnemyTile extends Phaser.GameObjects.Container {
  private readonly stripes: Phaser.GameObjects.Graphics;
  private readonly downText: Phaser.GameObjects.Text;
  private readonly intentBg: Phaser.GameObjects.Rectangle;
  private readonly intentText: Phaser.GameObjects.Text;
  private readonly hotspot: Phaser.GameObjects.Rectangle;
  private readonly hpFrame: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly targetMarker: Phaser.GameObjects.Graphics;
  private enemy: CombatCreature | null = null;
  private view: BattlefieldView | null = null;
  private tileWidth = ENEMY_TILE_W;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const barY = ENEMY_SPRITE_H + 9;
    this.stripes = scene.add.graphics();
    this.downText = scene.add.text(0, ENEMY_SPRITE_H / 2, 'DOWN', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.muted,
    }).setOrigin(0.5);
    this.intentBg = scene.add.rectangle(0, ENEMY_SPRITE_H - 11, ENEMY_TILE_W - 12, 17, UI.void, 0.9)
      .setStrokeStyle(1, UI.line);
    this.intentText = scene.add.text(0, ENEMY_SPRITE_H - 11, '', {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
    }).setOrigin(0.5);
    this.hotspot = scene.add.rectangle(0, ENEMY_TILE_H / 2, ENEMY_TILE_W, ENEMY_TILE_H, 0x000000, 0);
    this.hpFrame = scene.add.rectangle(0, barY, 116, 8, UI.void).setStrokeStyle(2, UI.line);
    this.hpFill = scene.add.rectangle(-56, barY, 112, 6, UI.hp).setOrigin(0, 0.5);
    this.statusText = scene.add.text(0, barY + 16, '', {
      fontFamily: BODY_FONT, fontSize: '10px', color: '#de5d3a',
    }).setOrigin(0.5);
    this.targetMarker = scene.add.graphics();
    this.targetMarker.fillStyle(UI.gold, 1);
    this.targetMarker.fillTriangle(-9, 2, 9, 2, 0, 14);
    this.add([
      this.stripes,
      this.downText,
      this.intentBg,
      this.intentText,
      this.hpFrame,
      this.hpFill,
      this.statusText,
      this.targetMarker,
      this.hotspot,
    ]);
    this.hotspot.on('pointerover', () => {
      if (this.enemy && this.view) this.view.onEnemyHover(this.enemy);
    });
    this.hotspot.on('pointerdown', () => {
      if (this.enemy && this.view) this.view.onEnemyClick(this.enemy);
    });
  }

  update(enemy: CombatCreature, view: BattlefieldView, width = ENEMY_TILE_W): void {
    this.enemy = enemy;
    this.view = view;
    if (width !== this.tileWidth) {
      this.tileWidth = width;
      this.intentBg.setSize(width - 12, 17);
      this.hotspot.setSize(width, ENEMY_TILE_H);
      if (this.hotspot.input) this.hotspot.input.hitArea.setSize(width, ENEMY_TILE_H);
    }
    const targeted = view.currentTarget === enemy && !enemy.isKnockedOut;
    const color = archetypeColor(enemy.template.archetype);
    const alpha = enemy.isKnockedOut ? 0.12 : (targeted ? 0.35 : 0.27);

    this.stripes.clear();
    this.stripes.lineStyle(5, color, alpha);
    const tileW = this.tileWidth;
    const left = -tileW / 2;
    const right = tileW / 2;
    for (let d = -ENEMY_SPRITE_H; d < tileW; d += 10) {
      const x1 = Math.max(left, left + d);
      const y1 = Math.max(0, -d);
      const x2 = Math.min(right, left + d + ENEMY_SPRITE_H);
      const y2 = ENEMY_SPRITE_H - Math.max(0, d + ENEMY_SPRITE_H - tileW);
      this.stripes.lineBetween(x1, y1, x2, y2);
    }

    this.downText.setVisible(enemy.isKnockedOut);
    const intent = enemy.isKnockedOut ? null : view.enemyIntent(enemy);
    this.intentBg.setVisible(!!intent);
    this.intentText.setVisible(!!intent).setText(intent ? `INTENT · ${intent}` : '');

    const interactive = view.enemyInteractive && !enemy.isKnockedOut;
    if (interactive) this.hotspot.setInteractive({ useHandCursor: true });
    else this.hotspot.disableInteractive();

    this.hpFrame.setStrokeStyle(2, targeted ? UI.gold : UI.line);
    const hpFraction = enemy.maxHp > 0 ? Math.max(0, enemy.currentHp / enemy.maxHp) : 0;
    this.hpFill
      .setVisible(hpFraction > 0)
      .setDisplaySize(112 * hpFraction, 6)
      .setFillStyle(hpColor(enemy.currentHp, enemy.maxHp));

    const statuses = enemy.statusEffects.map(status => status.type.slice(0, 3).toUpperCase()).join(' ');
    this.statusText.setText(statuses).setVisible(!!statuses);
    this.targetMarker.setVisible(targeted);
  }
}

// ---------- Bottom row: party cards + command panel ----------

const PARTY_CARD_W = 128;
const PARTY_CARD_GAP = 8;

class PartyStripView extends Phaser.GameObjects.Container {
  private readonly cards = new Map<string, PartyCardView>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
  }

  update(view: BattlefieldView): void {
    const liveIds = new Set(view.playerParty.map(creature => creature.instance.instanceId));
    for (const [id, card] of this.cards) {
      if (liveIds.has(id)) continue;
      card.destroy();
      this.cards.delete(id);
    }

    view.playerParty.forEach((creature, index) => {
      const id = creature.instance.instanceId;
      let card = this.cards.get(id);
      if (!card) {
        card = new PartyCardView(this.scene);
        this.cards.set(id, card);
        this.add(card);
      }
      card.setPosition(
        LAYOUT.contentLeft + PARTY_CARD_W / 2 + index * (PARTY_CARD_W + PARTY_CARD_GAP),
        LAYOUT.bottomRowTop,
      );
      card.update(creature, view);
    });
  }
}

class PartyCardView extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly sprite: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly resourceLabel: Phaser.GameObjects.Text;
  private readonly resourceText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly hotspot: Phaser.GameObjects.Rectangle;
  private creature: CombatCreature | null = null;
  private view: BattlefieldView | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const height = LAYOUT.bottomRowBottom - LAYOUT.bottomRowTop;
    const innerLeft = -PARTY_CARD_W / 2 + 7;
    const innerWidth = PARTY_CARD_W - 14;

    this.background = scene.add.rectangle(0, height / 2, PARTY_CARD_W, height, UI.plate)
      .setStrokeStyle(3, UI.lineBright);
    this.sprite = scene.add.graphics();
    this.nameText = scene.add.text(innerLeft, 74, '', {
      fontFamily: DISPLAY_FONT,
      fontSize: '9px',
      color: UI.text,
      wordWrap: { width: innerWidth },
    });
    const hpLabel = scene.add.text(innerLeft, 92, 'HP', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.muted,
    });
    this.hpText = scene.add.text(innerLeft + innerWidth, 92, '', {
      fontFamily: BODY_FONT, fontSize: '11px', color: UI.greenCss,
    }).setOrigin(1, 0);
    this.resourceLabel = scene.add.text(innerLeft, 112, 'MP', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.muted,
    });
    this.resourceText = scene.add.text(innerLeft + innerWidth, 112, '', {
      fontFamily: BODY_FONT, fontSize: '11px', color: UI.tealCss,
    }).setOrigin(1, 0);
    this.statusText = scene.add.text(innerLeft, 132, '', {
      fontFamily: BODY_FONT, fontSize: '10px', color: '#de5d3a',
    });
    this.hotspot = scene.add.rectangle(0, height / 2, PARTY_CARD_W, height, 0x000000, 0);
    this.add([
      this.background,
      this.sprite,
      this.nameText,
      hpLabel,
      this.hpText,
      this.resourceLabel,
      this.resourceText,
      this.statusText,
      this.hotspot,
    ]);
    this.hotspot.on('pointerover', () => {
      if (this.creature && this.view) this.view.onAllyHover(this.creature);
    });
    this.hotspot.on('pointerdown', () => {
      if (this.creature && this.view) this.view.onAllyClick(this.creature);
    });
  }

  update(creature: CombatCreature, view: BattlefieldView): void {
    this.creature = creature;
    this.view = view;
    const knockedOut = creature.isKnockedOut;
    const active = view.currentActor === creature;
    const frame = knockedOut ? UI.plate : (active ? UI.gold : UI.lineBright);
    const plate = knockedOut ? 0x1a1a26 : (active ? UI.line : UI.plate);
    this.background.setFillStyle(plate).setStrokeStyle(3, frame);

    const innerLeft = -PARTY_CARD_W / 2 + 7;
    const innerWidth = PARTY_CARD_W - 14;
    const color = archetypeColor(creature.template.archetype);
    this.sprite.clear();
    this.sprite.lineStyle(2, UI.line, 1);
    this.sprite.strokeRect(innerLeft, 7, innerWidth, 62);
    this.sprite.lineStyle(4, color, knockedOut ? 0.12 : 0.35);
    const right = innerLeft + innerWidth;
    for (let d = -62; d < innerWidth; d += 8) {
      const x1 = Math.max(innerLeft, innerLeft + d);
      const y1 = 7 + Math.max(0, -d);
      const x2 = Math.min(right, innerLeft + d + 62);
      const y2 = 69 - Math.max(0, d + 62 - innerWidth);
      this.sprite.lineBetween(x1, y1, x2, y2);
    }

    this.nameText
      .setText(creature.template.name.toUpperCase())
      .setColor(knockedOut ? UI.muted : UI.text);
    this.hpText
      .setText(`${creature.currentHp}/${creature.maxHp}`)
      .setColor(Phaser.Display.Color.IntegerToColor(
        hpColor(creature.currentHp, creature.maxHp),
      ).rgba);
    this.resourceLabel.setText(view.usesSharedActions ? 'AP POOL' : 'MP');
    this.resourceText
      .setText(view.usesSharedActions
        ? `${view.actionPoints}/${view.actionPointCap}`
        : `${creature.currentMp}/${creature.maxMp}`)
      .setColor(view.usesSharedActions || creature.currentMp > 0 ? UI.tealCss : '#5e5b8c');
    const statuses = creature.statusEffects
      .map(status => status.type.slice(0, 3).toUpperCase())
      .join(' ');
    this.statusText
      .setText(knockedOut ? 'FAINTED' : statuses)
      .setColor(knockedOut ? UI.muted : '#de5d3a');

    const targetable = view.allyTargetable ? view.allyTargetable(creature) : !knockedOut;
    if (view.allyInteractive && targetable) {
      this.hotspot.setInteractive({ useHandCursor: true });
    } else {
      this.hotspot.disableInteractive();
    }
  }
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
      // Hover works even when disabled so a greyed row's footer detail can explain
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

class FooterView extends Phaser.GameObjects.Container {
  private readonly detail: Phaser.GameObjects.Text;
  private readonly target: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.detail = scene.add.text(LAYOUT.contentLeft, LAYOUT.footerY, '', {
      fontFamily: BODY_FONT, fontSize: '12px', color: UI.body,
    }).setOrigin(0, 0.5);
    this.target = scene.add.text(LAYOUT.contentRight, LAYOUT.footerY, '', {
      fontFamily: BODY_FONT, fontSize: '12px', color: UI.mutedBright,
    }).setOrigin(1, 0.5);
    this.add([this.detail, this.target]);
  }

  update(view: BattlefieldView): void {
    this.detail.setText(view.footerDetail);
    this.target.setText(view.footerTarget);
  }
}
