import Phaser from 'phaser';
import { CombatCreature, TACTIC_LABELS } from '../../types';

export interface BattlefieldView {
  playerParty: CombatCreature[];
  enemyParty: CombatCreature[];
  currentActor: CombatCreature | undefined;
  messageLog: string[];
  showTactics: boolean;
}

/**
 * Draws the whole battlefield: background, both parties, and the message log.
 * Pure rendering — reads the view and touches no combat state. The caller is
 * responsible for clearing the display list first.
 */
export function renderBattlefield(scene: Phaser.Scene, view: BattlefieldView): void {
  // Background
  scene.add.rectangle(480, 320, 960, 640, 0x1a1a2e);

  // Battle area divider
  scene.add.line(480, 0, 0, 70, 0, 460, 0x333355, 0.5);

  // Turn indicator
  if (view.currentActor) {
    scene.add.text(480, 15, `Turn: ${view.currentActor.template.name}`, {
      fontSize: '14px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  view.playerParty.forEach((creature, i) => {
    drawCreature(scene, creature, 140, 120 + i * 120, true, view.showTactics);
  });

  view.enemyParty.forEach((creature, i) => {
    drawCreature(scene, creature, 700, 120 + i * 110, false, false);
  });

  // Message log
  const logY = 400;
  const recentMessages = view.messageLog.slice(-4);
  recentMessages.forEach((msg, i) => {
    scene.add.text(20, logY + i * 18, msg, {
      fontSize: '11px', color: '#aaaacc', fontFamily: 'monospace',
    });
  });
}

function drawCreature(
  scene: Phaser.Scene,
  creature: CombatCreature,
  x: number,
  y: number,
  isPlayer: boolean,
  showTactic: boolean,
): void {
  const alpha = creature.isKnockedOut ? 0.3 : 1;

  const rect = scene.add.rectangle(x, y, 70, 55, creature.template.spriteColor, alpha);
  if (creature.isDefending) rect.setStrokeStyle(2, 0x8888ff);

  const labelX = isPlayer ? x + 50 : x - 50;
  const origin = isPlayer ? 0 : 1;

  scene.add.text(labelX, y - 30, `${creature.template.name}`, {
    fontSize: '11px', color: creature.isKnockedOut ? '#666666' : '#ffffff', fontFamily: 'monospace',
  }).setOrigin(origin, 0.5);

  // HP bar
  const hpPct = creature.currentHp / creature.maxHp;
  const hpColor = hpPct > 0.5 ? 0x44aa44 : hpPct > 0.25 ? 0xaaaa44 : 0xaa4444;
  const barX = isPlayer ? x + 50 : x - 120;
  scene.add.rectangle(barX, y - 14, 70, 6, 0x333333).setOrigin(0);
  scene.add.rectangle(barX, y - 14, 70 * hpPct, 6, hpColor).setOrigin(0);

  scene.add.text(barX, y - 5, `${creature.currentHp}/${creature.maxHp}`, {
    fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
  }).setOrigin(0);

  // MP bar (player only)
  if (isPlayer) {
    const mpPct = creature.currentMp / creature.maxMp;
    scene.add.rectangle(barX, y + 8, 70, 4, 0x333333).setOrigin(0);
    scene.add.rectangle(barX, y + 8, 70 * mpPct, 4, 0x4466aa).setOrigin(0);
    scene.add.text(barX, y + 15, `MP:${creature.currentMp}/${creature.maxMp}`, {
      fontSize: '8px', color: '#6688aa', fontFamily: 'monospace',
    }).setOrigin(0);
  }

  // Status effects
  const statuses = creature.statusEffects.map(s => s.type.substring(0, 3).toUpperCase()).join(' ');
  if (statuses) {
    scene.add.text(x, y + 35, statuses, {
      fontSize: '9px', color: '#ff8888', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  if (showTactic && isPlayer && !creature.isKnockedOut) {
    scene.add.text(labelX, y + 30, TACTIC_LABELS[creature.instance.tactic], {
      fontSize: '9px', color: '#88aacc', fontFamily: 'monospace',
    }).setOrigin(origin, 0.5);
  }

  // KO marker
  if (creature.isKnockedOut) {
    scene.add.text(x, y, 'KO', {
      fontSize: '18px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
  }
}
