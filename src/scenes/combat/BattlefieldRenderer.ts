import Phaser from 'phaser';
import { CombatCreature, TACTIC_LABELS } from '../../types';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, hpColor, panel,
  screenFrame, spritePlate,
} from '../../ui/Theme';

export interface BattlefieldView {
  playerParty: CombatCreature[];
  enemyParty: CombatCreature[];
  currentActor: CombatCreature | undefined;
  messageLog: string[];
  showTactics: boolean;
}

export function renderBattlefield(scene: Phaser.Scene, view: BattlefieldView): void {
  screenFrame(scene);
  scene.add.text(24, 21, 'COMBAT', {
    fontFamily: DISPLAY_FONT, fontSize: '13px', color: UI.hi,
  });
  scene.add.text(24, 48, 'TURN ORDER', {
    fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
  });
  if (view.currentActor) {
    const actorColor = archetypeColor(view.currentActor.template.archetype);
    scene.add.rectangle(170, 50, 180, 28, UI.plate).setStrokeStyle(2, actorColor);
    scene.add.text(170, 50, `▶ ${view.currentActor.template.name.toUpperCase()}`, {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.hi,
    }).setOrigin(0.5);
  }
  scene.add.rectangle(480, 77, 912, 3, UI.plate);

  scene.add.text(24, 91, 'ENEMY FIELD', {
    fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
  });
  const enemyCount = view.enemyParty.length;
  view.enemyParty.forEach((creature, i) => {
    const x = 480 - ((enemyCount - 1) * 154) / 2 + i * 154;
    drawEnemy(scene, creature, x, 173);
  });

  scene.add.text(24, 265, 'YOUR PARTY', {
    fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
  });
  view.playerParty.forEach((creature, i) => drawParty(scene, creature, 180 + i * 300, 354, view.showTactics));

  scene.add.rectangle(480, 437, 912, 2, UI.plate);
  scene.add.text(24, 448, 'BATTLE LOG', {
    fontFamily: BODY_FONT, fontSize: '8px', color: UI.muted,
  });
  const recent = view.messageLog.slice(-2);
  recent.forEach((msg, i) => {
    scene.add.text(104, 445 + i * 16, msg, {
      fontFamily: BODY_FONT, fontSize: '9px', color: i === recent.length - 1 ? UI.body : UI.muted,
    });
  });
}

function drawEnemy(scene: Phaser.Scene, creature: CombatCreature, x: number, y: number): void {
  const color = archetypeColor(creature.template.archetype);
  spritePlate(scene, x, y, 106, 106, creature.isKnockedOut ? UI.line : color, color);
  if (creature.isKnockedOut) {
    scene.add.rectangle(x, y, 106, 106, UI.void, 0.62);
    scene.add.text(x, y, 'DOWN', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.muted,
    }).setOrigin(0.5);
  }
  // Enemies deliberately have no names or level labels in the field.
  const pct = creature.maxHp > 0 ? creature.currentHp / creature.maxHp : 0;
  scene.add.rectangle(x, y + 64, 106, 5, UI.plate);
  scene.add.rectangle(x - 53, y + 64, 106 * pct, 5, hpColor(creature.currentHp, creature.maxHp)).setOrigin(0, 0.5);
}

function drawParty(scene: Phaser.Scene, creature: CombatCreature, x: number, y: number, showTactic: boolean): void {
  const color = archetypeColor(creature.template.archetype);
  panel(scene, x, y, 276, 128, false).setStrokeStyle(creature.isDefending ? 3 : 2,
    creature.isDefending ? UI.teal : creature.isKnockedOut ? UI.plate : UI.line);
  scene.add.rectangle(x - 135, y, 6, 128, color);
  spritePlate(scene, x - 88, y, 72, 96, creature.isKnockedOut ? UI.line : color);
  scene.add.text(x - 42, y - 50, creature.template.name, {
    fontFamily: DISPLAY_FONT, fontSize: '8px',
    color: creature.isKnockedOut ? UI.muted : UI.text,
  });
  scene.add.text(x - 42, y - 24, `HP ${creature.currentHp} / ${creature.maxHp}`, {
    fontFamily: BODY_FONT, fontSize: '10px',
    color: Phaser.Display.Color.IntegerToColor(hpColor(creature.currentHp, creature.maxHp)).rgba,
  });
  scene.add.text(x - 42, y - 4, `MP ${creature.currentMp} / ${creature.maxMp}`, {
    fontFamily: BODY_FONT, fontSize: '10px', color: UI.tealCss,
  });
  const statuses = creature.statusEffects.map(s => s.type.slice(0, 3).toUpperCase()).join(' · ');
  scene.add.text(x - 42, y + 18, creature.isKnockedOut ? 'DOWN' : statuses || 'READY', {
    fontFamily: DISPLAY_FONT, fontSize: '7px',
    color: creature.isKnockedOut ? UI.redCss : statuses ? '#de5d3a' : UI.greenCss,
  });
  if (showTactic && !creature.isKnockedOut) {
    scene.add.text(x - 42, y + 39, TACTIC_LABELS[creature.instance.tactic].toUpperCase(), {
      fontFamily: BODY_FONT, fontSize: '8px', color: UI.mutedBright,
    });
  }
}
