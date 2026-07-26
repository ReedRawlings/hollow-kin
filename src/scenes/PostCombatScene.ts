import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import {
  RecoveryKind, applyTargetedRecovery, canReceiveRecovery, eligibleRecoveryTargets,
} from '../systems/Recovery';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, footer, header, hpColor,
  panel, screenFrame, spritePlate,
} from '../ui/Theme';

interface PostCombatData {
  floor: number;
  obolGain: number;
  xpPerCreature: number;
  levelUpMessage: string;
}

interface Boon {
  kind: RecoveryKind;
  fraction: number;
  label: string;
  value: string;
  description: string;
  color: number;
}

const BOONS: Boon[] = [
  {
    kind: 'hp',
    fraction: 0.10,
    label: 'MEND WOUNDS',
    value: '10%',
    description: 'Restore one living creature by ten percent of its maximum HP.',
    color: UI.green,
  },
  {
    kind: 'mp',
    fraction: 0.20,
    label: 'CLEAR THE MIND',
    value: '20%',
    description: 'Restore one living creature by twenty percent of its maximum MP.',
    color: UI.teal,
  },
];

export class PostCombatScene extends Phaser.Scene {
  private rewardData!: PostCombatData;
  private selectedBoon = 0;
  private selectingTarget = false;
  private targetIndex = 0;
  private keyboardBound = false;

  constructor() {
    super({ key: 'PostCombatScene' });
  }

  init(data: PostCombatData): void {
    this.rewardData = data;
    this.selectedBoon = 0;
    this.selectingTarget = false;
    this.targetIndex = 0;
  }

  create(): void {
    this.draw();
    if (!this.keyboardBound) {
      this.keyboardBound = true;
      this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
      this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
      this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
      this.input.keyboard?.on('keydown-ESC', () => {
        if (this.selectingTarget) {
          this.selectingTarget = false;
          this.draw();
        }
      });
    }
  }

  private draw(): void {
    this.children.removeAll(true);
    if (this.selectingTarget) this.drawTargetSelection();
    else this.drawBoonSelection();
  }

  private drawBoonSelection(): void {
    const run = gameState.currentRun!;
    screenFrame(this);
    header(this, 'VICTORY', `FLOOR ${this.rewardData.floor}  ·  SPOILS SECURED`,
      `${run.obols} OBOLS`, UI.goldCss);

    panel(this, 480, 116, 912, 54);
    this.add.text(42, 102, 'EARNED', {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.mutedBright,
    });
    this.add.text(152, 102, `FELLED  +${this.rewardData.obolGain}`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.goldCss,
    });
    this.add.text(350, 102, `PARTY XP  +${this.rewardData.xpPerCreature} EACH`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
    });
    this.add.text(916, 102, `TOTAL  +${this.rewardData.obolGain}`, {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.goldCss,
    }).setOrigin(1, 0);
    if (this.rewardData.levelUpMessage) {
      this.add.text(480, 137, this.rewardData.levelUpMessage, {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.greenCss,
      }).setOrigin(0.5);
    }

    this.add.text(24, 158, 'CHOOSE ONE BOON', {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
    });
    BOONS.forEach((boon, i) => this.drawBoon(252 + i * 456, 315, 432, boon, i));

    panel(this, 362, 506, 676, 72);
    gameState.runParty.forEach((creature, i) => {
      const t = getTemplate(creature.speciesId);
      const x = 64 + i * 218;
      const hp = run.partyHp[creature.instanceId] ?? 0;
      const mp = run.partyMp[creature.instanceId] ?? 0;
      const ko = run.partyKO[creature.instanceId];
      spritePlate(this, x, 506, 38, 38, ko ? UI.line : archetypeColor(t.archetype));
      this.add.text(x + 28, 485, creature.nickname ?? t.name, {
        fontFamily: DISPLAY_FONT, fontSize: '7px', color: ko ? UI.muted : UI.text,
      });
      this.add.text(x + 28, 504, ko ? 'DOWN' : `HP ${hp}/${creature.currentStats.hp}`, {
        fontFamily: BODY_FONT, fontSize: '9px',
        color: ko ? UI.redCss : Phaser.Display.Color.IntegerToColor(hpColor(hp, creature.currentStats.hp)).rgba,
      });
      this.add.text(x + 28, 521, `MP ${mp}/${creature.currentStats.mp}`, {
        fontFamily: BODY_FONT, fontSize: '9px', color: ko ? UI.muted : UI.tealCss,
      });
    });

    const hasTarget = eligibleRecoveryTargets(
      BOONS[this.selectedBoon].kind, gameState.runParty, run,
    ).length > 0;
    button(this, 824, 506, 200, 72, hasTarget ? 'CHOOSE TARGET' : 'CONTINUE',
      () => this.confirm(), UI.gold);
    footer(this, '← → CHOOSE  ·  ENTER CONFIRM', BOONS[this.selectedBoon].label);
  }

  private drawBoon(x: number, y: number, w: number, boon: Boon, index: number): void {
    const selected = index === this.selectedBoon;
    const eligible = eligibleRecoveryTargets(
      boon.kind, gameState.runParty, gameState.currentRun!,
    ).length > 0;
    const bg = panel(this, x, y, w, 286, selected);
    spritePlate(this, x, y - 55, w - 30, 116, boon.color, selected ? UI.gold : UI.line);
    this.add.text(x, y - 55, boon.value, {
      fontFamily: DISPLAY_FONT, fontSize: '20px',
      color: Phaser.Display.Color.IntegerToColor(boon.color).rgba,
    }).setOrigin(0.5);
    this.add.text(x, y + 30, boon.label, {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: selected ? UI.hi : UI.text,
    }).setOrigin(0.5);
    this.add.text(x, y + 69, boon.description, {
      fontFamily: BODY_FONT, fontSize: '11px', color: eligible ? UI.body : UI.muted,
      align: 'center', wordWrap: { width: w - 54 },
    }).setOrigin(0.5);
    this.add.text(x, y + 111, eligible ? 'TARGET AVAILABLE' : 'EVERYONE IS FULL', {
      fontFamily: BODY_FONT, fontSize: '9px', color: eligible ? UI.greenCss : UI.muted,
    }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (this.selectedBoon !== index) {
        this.selectedBoon = index;
        this.draw();
      }
    });
    bg.on('pointerdown', () => {
      this.selectedBoon = index;
      this.confirm();
    });
  }

  private drawTargetSelection(): void {
    const run = gameState.currentRun!;
    const boon = BOONS[this.selectedBoon];
    screenFrame(this);
    header(this, boon.kind === 'hp' ? 'WHO SHOULD RECOVER HP?' : 'WHO SHOULD RECOVER MP?',
      `${boon.label}  ·  CHOOSE ONE LIVING CREATURE`, `${run.obols} OBOLS`, UI.goldCss);

    gameState.runParty.forEach((creature, i) => {
      const t = getTemplate(creature.speciesId);
      const x = 180 + i * 300;
      const eligible = canReceiveRecovery(boon.kind, creature, run);
      const selected = i === this.targetIndex;
      const current = boon.kind === 'hp'
        ? (run.partyHp[creature.instanceId] ?? 0)
        : (run.partyMp[creature.instanceId] ?? 0);
      const max = boon.kind === 'hp' ? creature.currentStats.hp : creature.currentStats.mp;
      const recovered = eligible ? Math.max(1, Math.floor(max * boon.fraction)) : 0;

      const bg = panel(this, x, 300, 276, 326, selected && eligible);
      spritePlate(this, x, 235, 104, 104, eligible ? archetypeColor(t.archetype) : UI.line);
      this.add.text(x, 314, creature.nickname ?? t.name, {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: eligible ? UI.text : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 346, `${boon.kind.toUpperCase()} ${current} / ${max}`, {
        fontFamily: BODY_FONT, fontSize: '11px',
        color: eligible ? (boon.kind === 'hp' ? UI.greenCss : UI.tealCss) : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 385, eligible ? `+${Math.min(recovered, max - current)} ${boon.kind.toUpperCase()}` :
        run.partyKO[creature.instanceId] ? 'DOWN · NO EFFECT' : 'ALREADY FULL', {
        fontFamily: DISPLAY_FONT, fontSize: '8px', color: eligible ? UI.hi : UI.muted,
      }).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: eligible });
      bg.on('pointerover', () => {
        if (eligible && this.targetIndex !== i) {
          this.targetIndex = i;
          this.draw();
        }
      });
      bg.on('pointerdown', () => {
        if (eligible) {
          this.targetIndex = i;
          this.confirm();
        }
      });
    });

    button(this, 480, 520, 240, 56, 'TAKE BOON', () => this.confirm(), UI.gold,
      canReceiveRecovery(boon.kind, gameState.runParty[this.targetIndex], run));
    footer(this, '← → TARGET  ·  ENTER TAKE  ·  ESC BACK', boon.label);
  }

  private move(delta: number): void {
    if (this.selectingTarget) {
      this.targetIndex = (this.targetIndex + delta + gameState.runParty.length) % gameState.runParty.length;
    } else {
      this.selectedBoon = (this.selectedBoon + delta + BOONS.length) % BOONS.length;
    }
    this.draw();
  }

  private confirm(): void {
    const run = gameState.currentRun!;
    const boon = BOONS[this.selectedBoon];
    const targets = eligibleRecoveryTargets(boon.kind, gameState.runParty, run);
    if (!this.selectingTarget) {
      if (!targets.length) {
        this.continueRun();
        return;
      }
      const firstEligible = gameState.runParty.findIndex(c => canReceiveRecovery(boon.kind, c, run));
      this.targetIndex = Math.max(0, firstEligible);
      this.selectingTarget = true;
      this.draw();
      return;
    }
    const target = gameState.runParty[this.targetIndex];
    if (!target || !canReceiveRecovery(boon.kind, target, run)) return;
    applyTargetedRecovery(boon.kind, boon.fraction, target, run);
    this.continueRun();
  }

  private continueRun(): void {
    gameState.saveToLocalStorage();
    this.scene.start('RunScene', { continueRun: true });
  }
}
