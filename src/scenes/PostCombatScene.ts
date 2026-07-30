import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import {
  RecoveryKind, applyTargetedRecovery, canReceiveRecovery, eligibleRecoveryTargets,
} from '../systems/Recovery';
import { generateOffer, RewardCard, RewardTier } from '../systems/RewardOffer';
import { grantBoon } from '../systems/Boons';
import { getBoon } from '../data/boons';
import { getItem } from '../data/items';
import { add as addToBackpack, isFull } from '../systems/Backpack';
import { RunState } from '../types';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, footer, header, hpColor,
  panel, screenFrame, spritePlate,
} from '../ui/Theme';

interface PostCombatData {
  floor: number;
  tier: RewardTier;
  obolGain: number;
  xpPerCreature: number;
  levelUpMessage: string;
}

export class PostCombatScene extends Phaser.Scene {
  private rewardData!: PostCombatData;
  private offer: RewardCard[] = [];
  private selected = 0;
  private selectingTarget = false;
  private targetIndex = 0;
  private keyboardBound = false;
  /** No behaviour until Task 5's item-swap overlay. Guards hover/click while an
   *  overlay sits over the (still-interactive) cards underneath it. */
  private swappingFor: string | null = null;

  constructor() {
    super({ key: 'PostCombatScene' });
  }

  init(data: PostCombatData): void {
    this.rewardData = data;
    this.selected = 0;
    this.selectingTarget = false;
    this.targetIndex = 0;
    this.swappingFor = null;

    // Generated exactly once per battle. This scene redraws on every hover
    // (draw() rebuilds the whole display list) — regenerating the offer inside
    // draw() would reshuffle the cards under the player's cursor mid-choice.
    const run = gameState.currentRun!;
    const party = gameState.runParty;
    this.offer = generateOffer({
      tier: data.tier,
      floor: data.floor,
      anyHurt: party.some(c => canReceiveRecovery('hp', c, run)),
      anyMpMissing: party.some(c => canReceiveRecovery('mp', c, run)),
    }, Math.random);
  }

  create(): void {
    this.draw();
    if (!this.keyboardBound) {
      this.keyboardBound = true;
      this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
      this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
      this.input.keyboard?.on('keydown-ENTER', () => this.takeSelected());
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
    else this.drawOfferSelection();
  }

  private drawOfferSelection(): void {
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

    if (this.offer.length === 0) {
      // Nothing viable to offer (possible only if the party is untouched and the
      // draw yields nothing) — a single CONTINUE affordance, never an empty band.
      this.add.text(24, 158, 'NOTHING TO OFFER THIS TIME', {
        fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
      });
      panel(this, 480, 315, 912, 286);
      this.add.text(480, 315, 'ONWARD.', {
        fontFamily: DISPLAY_FONT, fontSize: '14px', color: UI.mutedBright,
      }).setOrigin(0.5);
    } else {
      this.add.text(24, 158, 'CHOOSE ONE', {
        fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
      });
      const count = this.offer.length;
      const gap = 12;
      const cardW = (912 - gap * (count - 1)) / count;
      this.offer.forEach((card, i) => {
        const x = 24 + cardW / 2 + i * (cardW + gap);
        this.drawCard(card, x, 315, cardW, i === this.selected, i);
      });
    }

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

    if (this.offer.length > 0) {
      const card = this.offer[this.selected];
      const face = this.cardFace(card);
      button(this, 824, 506, 200, 72, this.ctaLabel(card, run), () => this.takeSelected(), UI.gold);
      footer(this, '← → CHOOSE  ·  ENTER CONFIRM', face.label);
    } else {
      button(this, 824, 506, 200, 72, 'CONTINUE', () => this.continueRun(), UI.gold);
      footer(this, 'ENTER CONTINUE', '');
    }
  }

  /** The primary action button's label — derived from the card, not its id. */
  private ctaLabel(card: RewardCard, run: RunState): string {
    if (card.kind === 'heal' || card.kind === 'mana') {
      const kind: RecoveryKind = card.kind === 'heal' ? 'hp' : 'mp';
      const hasTarget = eligibleRecoveryTargets(kind, gameState.runParty, run).length > 0;
      return hasTarget ? 'CHOOSE TARGET' : 'CONTINUE';
    }
    return 'TAKE';
  }

  /** Display copy for a card. Derived from the card, never from a hard-coded id. */
  private cardFace(card: RewardCard): { label: string; value: string; body: string; color: number } {
    switch (card.kind) {
      case 'heal':
        return {
          label: 'MEND WOUNDS', value: `${Math.round(card.fraction * 100)}%`,
          body: 'Restore one living creature by that share of its maximum HP.',
          color: UI.green,
        };
      case 'mana':
        return {
          label: 'CLEAR THE MIND', value: `${Math.round(card.fraction * 100)}%`,
          body: 'Restore one living creature by that share of its maximum MP.',
          color: UI.teal,
        };
      case 'obols':
        return {
          label: 'SPOILS', value: `+${card.amount}`,
          body: 'Take the coin now. It converts to Essence when you leave.',
          color: UI.gold,
        };
      case 'item': {
        const def = getItem(card.itemId);
        return { label: def.name.toUpperCase(), value: 'SUPPLY', body: def.description, color: UI.amber };
      }
      case 'boon': {
        const def = getBoon(card.boonId);
        return {
          label: def.name.toUpperCase(), value: `${def.battles} FIGHTS`,
          body: def.description, color: UI.orange,
        };
      }
    }
  }

  /** The one line under a card that says what taking it will cost or need. */
  private cardFootnote(card: RewardCard): string {
    if (card.kind === 'heal' || card.kind === 'mana') return 'CHOOSE A TARGET';
    if (card.kind === 'item') return isFull(gameState.backpack) ? 'BAG IS FULL — SWAP' : 'INTO THE BAG';
    if (card.kind === 'boon') return 'TAKES HOLD AT ONCE';
    return 'TAKEN IMMEDIATELY';
  }

  private drawCard(
    card: RewardCard, x: number, y: number, w: number, selected: boolean, index: number,
  ): void {
    const face = this.cardFace(card);
    const bg = panel(this, x, y, w, 286, selected);
    spritePlate(this, x, y - 55, w - 30, 116, face.color, selected ? UI.gold : UI.line);
    this.add.text(x, y - 55, face.value, {
      fontFamily: DISPLAY_FONT, fontSize: face.value.length > 6 ? '11px' : '20px',
      color: Phaser.Display.Color.IntegerToColor(face.color).rgba,
    }).setOrigin(0.5);
    this.add.text(x, y + 30, face.label, {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: selected ? UI.hi : UI.text,
    }).setOrigin(0.5);
    this.add.text(x, y + 69, face.body, {
      fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
      align: 'center', wordWrap: { width: w - 54 },
    }).setOrigin(0.5);
    this.add.text(x, y + 111, this.cardFootnote(card), {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
    }).setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (this.swappingFor !== null || this.selectingTarget) return;
      if (this.selected !== index) { this.selected = index; this.draw(); }
    });
    bg.on('pointerdown', () => {
      if (this.swappingFor !== null || this.selectingTarget) return;
      this.selected = index;
      this.takeSelected();
    });
  }

  private drawTargetSelection(): void {
    const run = gameState.currentRun!;
    const card = this.offer[this.selected];
    if (!card || (card.kind !== 'heal' && card.kind !== 'mana')) {
      // Shouldn't happen — target selection is only entered for heal/mana — but
      // fall back to the offer screen rather than render against nothing.
      this.selectingTarget = false;
      this.draw();
      return;
    }
    const kind: RecoveryKind = card.kind === 'heal' ? 'hp' : 'mp';
    const face = this.cardFace(card);
    screenFrame(this);
    header(this, kind === 'hp' ? 'WHO SHOULD RECOVER HP?' : 'WHO SHOULD RECOVER MP?',
      `${face.label}  ·  CHOOSE ONE LIVING CREATURE`, `${run.obols} OBOLS`, UI.goldCss);

    gameState.runParty.forEach((creature, i) => {
      const t = getTemplate(creature.speciesId);
      const x = 180 + i * 300;
      const eligible = canReceiveRecovery(kind, creature, run);
      const selected = i === this.targetIndex;
      const current = kind === 'hp'
        ? (run.partyHp[creature.instanceId] ?? 0)
        : (run.partyMp[creature.instanceId] ?? 0);
      const max = kind === 'hp' ? creature.currentStats.hp : creature.currentStats.mp;
      const recovered = eligible ? Math.max(1, Math.floor(max * card.fraction)) : 0;

      const bg = panel(this, x, 300, 276, 326, selected && eligible);
      spritePlate(this, x, 235, 104, 104, eligible ? archetypeColor(t.archetype) : UI.line);
      this.add.text(x, 314, creature.nickname ?? t.name, {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: eligible ? UI.text : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 346, `${kind.toUpperCase()} ${current} / ${max}`, {
        fontFamily: BODY_FONT, fontSize: '11px',
        color: eligible ? (kind === 'hp' ? UI.greenCss : UI.tealCss) : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 385, eligible ? `+${Math.min(recovered, max - current)} ${kind.toUpperCase()}` :
        run.partyKO[creature.instanceId] ? 'DOWN · NO EFFECT' : 'ALREADY FULL', {
        fontFamily: DISPLAY_FONT, fontSize: '8px', color: eligible ? UI.hi : UI.muted,
      }).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: eligible });
      bg.on('pointerover', () => {
        if (this.swappingFor !== null) return;
        if (eligible && this.targetIndex !== i) {
          this.targetIndex = i;
          this.draw();
        }
      });
      bg.on('pointerdown', () => {
        if (this.swappingFor !== null) return;
        if (eligible) {
          this.targetIndex = i;
          this.takeSelected();
        }
      });
    });

    const targetEligible = canReceiveRecovery(kind, gameState.runParty[this.targetIndex], run);
    button(this, 480, 520, 240, 56, 'TAKE', targetEligible ? () => this.takeSelected() : null,
      UI.gold, targetEligible);
    footer(this, '← → TARGET  ·  ENTER TAKE  ·  ESC BACK', face.label);
  }

  private move(delta: number): void {
    if (this.swappingFor !== null) return;
    if (this.selectingTarget) {
      const n = gameState.runParty.length;
      if (n === 0) return;
      this.targetIndex = (this.targetIndex + delta + n) % n;
    } else {
      if (!this.offer.length) return;
      this.selected = (this.selected + delta + this.offer.length) % this.offer.length;
    }
    this.draw();
  }

  /**
   * Take the selected card. `heal` and `mana` need a target first; everything
   * else resolves immediately.
   *
   * The item path is deliberately the only one that can fail — a full bag is
   * handled in Task 5. Until then it refuses without consuming the offer.
   */
  private takeSelected(): void {
    const run = gameState.currentRun!;
    const card = this.offer[this.selected];
    if (!card) { this.continueRun(); return; }

    switch (card.kind) {
      case 'heal':
      case 'mana': {
        const kind = card.kind === 'heal' ? 'hp' : 'mp';
        if (!this.selectingTarget) {
          const first = gameState.runParty.findIndex(c => canReceiveRecovery(kind, c, run));
          if (first === -1) { this.continueRun(); return; }
          this.targetIndex = first;
          this.selectingTarget = true;
          this.draw();
          return;
        }
        const target = gameState.runParty[this.targetIndex];
        if (!target || !canReceiveRecovery(kind, target, run)) return;
        applyTargetedRecovery(kind, card.fraction, target, run);
        break;
      }
      case 'obols':
        run.obols += card.amount;
        break;
      case 'boon':
        run.activeBoons = grantBoon(run.activeBoons, card.boonId);
        break;
      case 'item': {
        if (isFull(gameState.backpack)) return;   // Task 5 replaces this with a swap
        const result = addToBackpack(gameState.backpack, { kind: 'item', itemId: card.itemId });
        if (!result) return;
        gameState.backpack = result.bag;
        break;
      }
    }
    this.continueRun();
  }

  private continueRun(): void {
    gameState.saveToLocalStorage();
    this.scene.start('RunScene', { continueRun: true });
  }
}
