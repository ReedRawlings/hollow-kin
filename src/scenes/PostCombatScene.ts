import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import {
  RecoveryKind, applyTargetedRecovery, canReceiveRecovery, eligibleRecoveryTargets,
  runMaxHp,
} from '../systems/Recovery';
import { generateOffer, RewardCard, RewardTier } from '../systems/RewardOffer';
import { grantBoon } from '../systems/Boons';
import { getBoon } from '../data/boons';
import { getItem } from '../data/items';
import { add as addToBackpack, isFull, isProtected, removeAt } from '../systems/Backpack';
import { BackpackSlot, RunState } from '../types';
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
  storyMessage?: string;
}

export class PostCombatScene extends Phaser.Scene {
  private rewardData!: PostCombatData;
  private offer: RewardCard[] = [];
  private selected = 0;
  private selectingTarget = false;
  private targetIndex = 0;
  private keyboardBound = false;
  /** Set when the player took an item card with no room — pick a slot to drop.
   *  Guards hover/click while the swap overlay sits over the (still-interactive)
   *  cards underneath it. */
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
        if (this.swappingFor !== null) {
          // Same outcome as clicking KEEP MY BAG: the card was already taken,
          // so ESC forfeits the reward rather than returning to a live offer.
          this.swappingFor = null;
          this.continueRun();
        } else if (this.selectingTarget) {
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
    if (this.swappingFor !== null) this.drawSwap(this.swappingFor);
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
    if (this.rewardData.storyMessage) {
      this.add.text(480, 151, this.rewardData.storyMessage, {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.goldCss,
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
      const maxHp = runMaxHp(creature, run);
      this.add.text(x + 28, 504, ko ? 'DOWN' : `HP ${hp}/${maxHp}`, {
        fontFamily: BODY_FONT, fontSize: '9px',
        color: ko ? UI.redCss : Phaser.Display.Color.IntegerToColor(hpColor(hp, maxHp)).rgba,
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

  /**
   * Choose what to drop so the new item fits. Deliberately shows the SECURED
   * marking, because which slot the player gives up changes what a wipe can take
   * — that is the whole reason guaranteed slots exist.
   */
  private drawSwap(incomingId: string): void {
    const bag = gameState.backpack;
    this.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
    panel(this, 480, 320, 640, 420, true);

    this.add.text(480, 138, 'THE BAG IS FULL', {
      fontFamily: DISPLAY_FONT, fontSize: '14px', color: UI.hi,
    }).setOrigin(0.5);
    this.add.text(480, 170, `DROP SOMETHING TO MAKE ROOM FOR ${getItem(incomingId).name.toUpperCase()}`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
    }).setOrigin(0.5);

    bag.slots.forEach((slot, i) => {
      const x = 260 + (i % 3) * 148;
      const y = 240 + Math.floor(i / 3) * 92;
      const safe = isProtected(bag, i);
      const cell = this.add.rectangle(x, y, 136, 80, UI.panel)
        .setStrokeStyle(2, safe ? UI.teal : UI.line);
      if (safe) {
        this.add.text(x, y - 28, 'SECURED', {
          fontFamily: BODY_FONT, fontSize: '8px', color: UI.tealCss,
        }).setOrigin(0.5);
      }
      this.add.text(x, y - 4, this.slotLabel(slot), {
        fontFamily: BODY_FONT, fontSize: '8px', color: slot ? UI.body : UI.muted,
        align: 'center', wordWrap: { width: 124 },
      }).setOrigin(0.5);
      if (slot !== null) {
        this.add.text(x, y + 26, 'DROP', {
          fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.redCss,
        }).setOrigin(0.5);
        cell.setInteractive({ useHandCursor: true });
        cell.on('pointerdown', () => this.resolveSwap(i, incomingId));
      }
    });

    button(this, 480, 500, 200, 44, 'KEEP MY BAG', () => {
      this.swappingFor = null;
      this.continueRun();
    }, UI.lineBright);
  }

  private slotLabel(slot: BackpackSlot): string {
    if (!slot) return 'empty';
    switch (slot.kind) {
      case 'creature': return getTemplate(slot.instance.speciesId).name.toUpperCase();
      case 'item': return getItem(slot.itemId).name.toUpperCase();
      case 'mark': return `MARK · ${slot.markId.toUpperCase()}`;
      case 'trait': return `${slot.traitId.toUpperCase()} L${slot.traitLevel}`;
    }
  }

  /** Drop `index`, put the incoming item in its place, and move on. */
  private resolveSwap(index: number, incomingId: string): void {
    const before = gameState.backpack;
    const dropped = removeAt(before, index);
    const result = addToBackpack(dropped, { kind: 'item', itemId: incomingId });
    // Fall back to the UNTOUCHED bag, not the post-removal one: if the add ever
    // failed, committing `dropped` would lose the dropped item and the reward both.
    // Unreachable today — removeAt runs on a verified-occupied index, so a slot is
    // guaranteed free — but a no-op is the right shape for a failure that costs
    // the player something.
    gameState.backpack = result ? result.bag : before;
    this.swappingFor = null;
    this.continueRun();
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
      const max = kind === 'hp' ? runMaxHp(creature, run) : creature.currentStats.mp;
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
   * The item path is deliberately the only one that can fail outright once —
   * a full bag opens the swap overlay instead of silently refusing.
   */
  private takeSelected(): void {
    // While the swap overlay is open, taking a card is never what the player meant.
    // Guarding here rather than at each call site is deliberate: this method is
    // reached from card clicks, the CTA button and the ENTER key, and guarding
    // per-site is what let two of those through in the first place.
    if (this.swappingFor !== null) return;

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
        if (isFull(gameState.backpack)) {
          // The pitch's rule: taking an item with a full bag means using,
          // replacing or abandoning something. Offer the replace.
          this.swappingFor = card.itemId;
          this.draw();
          return;
        }
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
