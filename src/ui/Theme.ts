import Phaser from 'phaser';
import { Archetype, CreatureInstance } from '../types';
import { getTemplate } from '../data/creatures';

export const UI = {
  void: 0x10121c,
  voidCss: '#10121c',
  panel: 0x14141f,
  plate: 0x2c1e31,
  line: 0x3e3b65,
  lineBright: 0x5e5b8c,
  muted: '#8c78a5',
  mutedBright: '#b0a7b8',
  body: '#deceed',
  text: '#f6e8e0',
  hi: '#f7f3b7',
  gold: 0xf3a833,
  goldCss: '#f3a833',
  teal: 0x6dead6,
  tealCss: '#6dead6',
  tealDeep: 0x14262a,
  green: 0x9de64e,
  greenCss: '#9de64e',
  hp: 0x5ab552,
  red: 0xec273f,
  redCss: '#ec273f',
  orange: 0xde5d3a,
  amber: 0xdab163,
} as const;

export const DISPLAY_FONT = '"Press Start 2P", monospace';
export const BODY_FONT = 'Silkscreen, monospace';

const ARCHETYPE_UI: Record<Archetype, number> = {
  Kami: 0x5e91b4,
  Spirits: 0x8c78a5,
  Flora: 0x9de64e,
  Fauna: 0xe98537,
  Rock: 0xb0a7b8,
  Mecha: 0x6dead6,
  Food: 0xdab163,
  Human: 0xdab163,
  Devils: 0xa8496b,
  Dragon: 0x4f8f6b,
  Slimes: 0x8fd6c4,
};

export function archetypeColor(archetype: Archetype): number {
  return ARCHETYPE_UI[archetype];
}

/**
 * Accent colour and glyph for an item, chosen from its EFFECT rather than its id.
 * Both shop scenes used to test `itemId === 'mending_draught'`, which silently
 * mis-coloured every item added after it.
 */
export function itemAccent(kind: string): { color: number; glyph: string } {
  switch (kind) {
    case 'heal': return { color: UI.green, glyph: '+' };
    case 'restore_mp': return { color: UI.teal, glyph: '~' };
    case 'revive': return { color: UI.amber, glyph: '*' };
    case 'cure_status': return { color: UI.green, glyph: 'C' };
    case 'buff': return { color: UI.gold, glyph: 'STR' };
    case 'percent_damage': return { color: UI.red, glyph: 'X' };
    case 'strip_buffs': return { color: UI.orange, glyph: 'V' };
    case 'escape_battle': return { color: UI.teal, glyph: '<' };
    case 'depart': return { color: UI.gold, glyph: 'W' };
    default: return { color: UI.lineBright, glyph: '?' };
  }
}

export function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));
}

export function hpColor(current: number, max: number): number {
  const pct = max <= 0 ? 0 : current / max;
  if (pct <= 0) return UI.lineBright;
  if (pct < 0.25) return UI.red;
  if (pct <= 0.55) return UI.gold;
  return UI.hp;
}

export function screenFrame(scene: Phaser.Scene): void {
  scene.cameras.main.setBackgroundColor(UI.void);
  scene.add.rectangle(480, 320, 952, 632, UI.void)
    .setStrokeStyle(4, UI.line);
}

export function header(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
  right?: string,
  rightAccent: string = UI.tealCss,
): void {
  scene.add.text(24, 24, title, {
    fontFamily: DISPLAY_FONT, fontSize: '14px', color: UI.hi,
  });
  scene.add.text(24, 48, subtitle, {
    fontFamily: BODY_FONT, fontSize: '11px', color: UI.mutedBright,
  });
  if (right) {
    scene.add.text(936, 30, right, {
      fontFamily: DISPLAY_FONT, fontSize: '11px', color: rightAccent,
      align: 'right',
    }).setOrigin(1, 0);
  }
  scene.add.rectangle(480, 76, 912, 3, UI.plate);
}

export function footer(scene: Phaser.Scene, left: string, right = ''): void {
  scene.add.text(24, 616, left, {
    fontFamily: BODY_FONT, fontSize: '11px', color: '#5e5b8c',
  }).setOrigin(0, 0.5);
  if (right) {
    scene.add.text(936, 616, right, {
      fontFamily: BODY_FONT, fontSize: '11px', color: '#5e5b8c',
    }).setOrigin(1, 0.5);
  }
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  selected: boolean = false,
): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(x, y, w, h, selected ? UI.plate : UI.panel)
    .setStrokeStyle(selected ? 3 : 2, selected ? UI.gold : UI.line);
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: (() => void) | null,
  accent: number = UI.gold,
  enabled: boolean = true,
): Phaser.GameObjects.Rectangle {
  const bg = scene.add.rectangle(x, y, w, h, enabled ? UI.plate : UI.panel)
    .setStrokeStyle(3, enabled ? accent : UI.line);
  const labelText = scene.add.text(x, y, label, {
    fontFamily: DISPLAY_FONT,
    fontSize: '10px',
    color: enabled ? (accent === UI.teal ? UI.tealCss : UI.hi) : UI.muted,
    align: 'center',
  }).setOrigin(0.5);
  if (enabled && onClick) {
    bg.setInteractive({ useHandCursor: true });
    const restingColor = accent === UI.teal ? UI.tealCss : UI.hi;
    bg.on('pointerover', () => {
      bg.setFillStyle(accent);
      labelText.setColor(UI.voidCss);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(UI.plate);
      labelText.setColor(restingColor);
    });
    bg.on('pointerdown', onClick);
  }
  return bg;
}

export function backButton(
  scene: Phaser.Scene,
  onClick: () => void,
  y = 104,
  label = '← TOWN',
): Phaser.GameObjects.Rectangle {
  return button(scene, 76, y, 112, 34, label, onClick, UI.lineBright);
}

export function spritePlate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: number,
  border: number = UI.line,
): void {
  scene.add.rectangle(x, y, w, h, UI.void).setStrokeStyle(2, border);
  const g = scene.add.graphics();
  g.lineStyle(5, tint, 0.38);
  const left = x - w / 2 + 3;
  const top = y - h / 2 + 3;
  const right = x + w / 2 - 3;
  const bottom = y + h / 2 - 3;
  for (let d = -h; d < w; d += 12) {
    const x1 = Math.max(left, left + d);
    const y1 = top + Math.max(0, -d);
    const x2 = Math.min(right, left + d + h);
    const y2 = bottom - Math.max(0, d + h - w);
    g.lineBetween(x1, y1, x2, y2);
  }
}

export function compactPartyCard(
  scene: Phaser.Scene,
  creature: CreatureInstance,
  x: number,
  y: number,
  w: number,
  hp?: number,
  mp?: number,
  ko = false,
  maxHp = creature.currentStats.hp,
): void {
  const t = getTemplate(creature.speciesId);
  const currentHp = hp ?? creature.currentStats.hp;
  const currentMp = mp ?? creature.currentStats.mp;
  scene.add.rectangle(x - w / 2 + 3, y, 6, 54, archetypeColor(t.archetype));
  spritePlate(scene, x - w / 2 + 38, y, 42, 42, archetypeColor(t.archetype), ko ? UI.plate : UI.line);
  scene.add.text(x - w / 2 + 66, y - 20, creature.nickname ?? t.name, {
    fontFamily: DISPLAY_FONT, fontSize: '9px', color: ko ? UI.muted : UI.text,
  });
  scene.add.text(x - w / 2 + 66, y - 2, `LV ${creature.currentLevel}  ${stars(creature.starRating)}`, {
    fontFamily: BODY_FONT, fontSize: '10px', color: ko ? UI.muted : UI.goldCss,
  });
  scene.add.text(x - w / 2 + 66, y + 15,
    ko ? 'DOWN' : `HP ${currentHp}/${maxHp}  MP ${currentMp}/${creature.currentStats.mp}`, {
      fontFamily: BODY_FONT, fontSize: '10px',
      color: ko ? UI.muted : Phaser.Display.Color.IntegerToColor(hpColor(currentHp, maxHp)).rgba,
    });
}
