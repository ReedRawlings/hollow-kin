import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { getBoon } from '../data/boons';
import { getItem } from '../data/items';
import { EventId } from '../data/events';
import { Encounter } from '../types';
import {
  EventContext, EventOffer, EventResolution,
  diceDonors, diceRecipients, pickEvent, prepareEvent,
  resolveBloodBoon, resolveDiceTransfer, resolveMercyWell, resolveTinkersTrade,
  resolveWardenWager,
} from '../systems/Events';
import { effectiveMaxHp } from '../systems/Boons';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, compactPartyCard, footer,
  header, itemAccent, panel, screenFrame, spritePlate,
} from '../ui/Theme';

interface EventSceneData {
  encounter: Encounter;
  /** Test-only: skip the draw and prepare this event regardless of viability. */
  forceEventId?: EventId;
}

type Step = 'offer' | 'donor' | 'recipient' | 'result';

/**
 * The `?` room. Shows an offer prepared ONCE in `init` (never re-rolled on a
 * redraw — draw() rebuilds the display list on every hover), walks any sub-step
 * the event needs, applies the resolver's output onto the run, and hands back
 * to the map. The wager is the one exit that goes to a fight instead.
 */
export class EventScene extends Phaser.Scene {
  private encounter!: Encounter;
  private offer: EventOffer | null = null;
  private step: Step = 'offer';
  /** Highlighted card: item index on the offer step, party index on the pickers. */
  private selected = 0;
  private donorId: string | null = null;
  private resultMessage = '';
  private done = false;
  /**
   * Bumped on every draw(). Pointer handlers capture the value they were drawn
   * under and ignore events that arrive after the display list was rebuilt —
   * Phaser still delivers pointerover/out to objects destroyed during the same
   * pointer event, and a stale card's handler would otherwise overwrite
   * `selected` with an index from the previous step.
   */
  private generation = 0;

  constructor() {
    super({ key: 'EventScene' });
  }

  init(data: EventSceneData): void {
    this.encounter = data.encounter;
    this.step = 'offer';
    this.selected = 0;
    this.donorId = null;
    this.resultMessage = '';
    this.done = false;
    this.offer = null;

    const ctx = this.context();
    const id = data.forceEventId ?? pickEvent(ctx, Math.random)?.id ?? null;
    if (id) this.offer = prepareEvent(id, ctx, Math.random);
  }

  create(): void {
    if (!this.offer) {
      // Nothing viable — the room is a no-op and the map carries on.
      this.continueRun();
      return;
    }
    // Bound on every create, not once: Phaser's KeyboardPlugin drops all of its
    // listeners in shutdown(), so a "bind once" guard would leave the scene deaf
    // from its second visit onward.
    this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    this.draw();
  }

  // ---------- state ----------

  private context(): EventContext {
    return {
      run: gameState.currentRun!,
      party: gameState.runParty,
      backpack: gameState.backpack,
    };
  }

  private continueRun(): void {
    if (this.done) return;
    this.done = true;
    this.scene.start('RunScene', { continueRun: true });
  }

  private walkAway(): void {
    this.continueRun();
  }

  /** How many cards the current step cycles through with ← →. */
  private cardCount(): number {
    if (this.step === 'offer') return this.offer?.id === 'tinkers_trade' ? this.offer.itemIds.length : 0;
    if (this.step === 'donor' || this.step === 'recipient') return gameState.runParty.length;
    return 0;
  }

  private move(delta: number): void {
    if (this.done) return;
    const n = this.cardCount();
    if (n === 0) return;
    this.selected = (this.selected + delta + n) % n;
    this.draw();
  }

  private back(): void {
    if (this.done) return;
    switch (this.step) {
      case 'offer': this.walkAway(); break;
      case 'donor': this.step = 'offer'; this.selected = 0; this.draw(); break;
      case 'recipient': this.step = 'donor'; this.selected = this.partyIndex(this.donorId); this.donorId = null; this.draw(); break;
      case 'result': this.continueRun(); break;
    }
  }

  private partyIndex(instanceId: string | null): number {
    const i = gameState.runParty.findIndex(c => c.instanceId === instanceId);
    return i === -1 ? 0 : i;
  }

  private confirm(): void {
    if (this.done || !this.offer) return;
    switch (this.step) {
      case 'offer': this.accept(); break;
      case 'donor': this.pickDonor(); break;
      case 'recipient': this.pickRecipient(); break;
      case 'result': this.continueRun(); break;
    }
  }

  private accept(): void {
    const offer = this.offer!;
    const ctx = this.context();
    switch (offer.id) {
      case 'mercy_well':
        this.apply(resolveMercyWell(offer, ctx));
        break;
      case 'blood_boon':
        this.apply(resolveBloodBoon(offer, ctx));
        break;
      case 'dice_transfer': {
        const donors = diceDonors(ctx);
        if (donors.length === 0) { this.walkAway(); return; }
        this.step = 'donor';
        this.selected = this.partyIndex(donors[0].instanceId);
        this.draw();
        break;
      }
      case 'tinkers_trade': {
        const itemId = offer.itemIds[this.selected];
        if (!itemId) return;
        this.apply(resolveTinkersTrade(offer, ctx, itemId));
        break;
      }
      case 'warden_wager': {
        const resolution = resolveWardenWager(offer, ctx);
        if (!resolution.encounter) { this.walkAway(); return; }
        this.done = true;
        this.scene.start('CombatScene', { encounter: resolution.encounter });
        break;
      }
    }
  }

  private pickDonor(): void {
    const ctx = this.context();
    const creature = gameState.runParty[this.selected];
    if (!creature || !diceDonors(ctx).some(c => c.instanceId === creature.instanceId)) return;
    this.donorId = creature.instanceId;
    const recipients = diceRecipients(ctx, this.donorId);
    if (recipients.length === 0) return;
    this.step = 'recipient';
    this.selected = this.partyIndex(recipients[0].instanceId);
    this.draw();
  }

  private pickRecipient(): void {
    const offer = this.offer;
    if (!offer || offer.id !== 'dice_transfer' || !this.donorId) return;
    const ctx = this.context();
    const creature = gameState.runParty[this.selected];
    if (!creature || !diceRecipients(ctx, this.donorId).some(c => c.instanceId === creature.instanceId)) return;
    this.apply(resolveDiceTransfer(offer, ctx, this.donorId, creature.instanceId));
  }

  /** Copy every defined field of the resolution onto live state, save, show the line. */
  private apply(resolution: EventResolution): void {
    const run = gameState.currentRun!;
    if (resolution.partyHp) run.partyHp = resolution.partyHp;
    if (resolution.partyMp) run.partyMp = resolution.partyMp;
    if (resolution.obols !== undefined) run.obols = resolution.obols;
    if (resolution.activeBoons) run.activeBoons = resolution.activeBoons;
    if (resolution.backpack) gameState.backpack = resolution.backpack;
    gameState.saveToLocalStorage();
    this.resultMessage = resolution.message;
    this.step = 'result';
    this.draw();
  }

  // ---------- drawing ----------

  private draw(): void {
    this.generation++;
    this.children.removeAll(true);
    switch (this.step) {
      case 'offer': this.drawOffer(); break;
      case 'donor': this.drawPicker('donor'); break;
      case 'recipient': this.drawPicker('recipient'); break;
      case 'result': this.drawResult(); break;
    }
  }

  private drawOffer(): void {
    const offer = this.offer!;
    const run = gameState.currentRun!;
    screenFrame(this);
    header(this, offer.def.name.toUpperCase(), `FLOOR ${this.encounter.floor}  ·  AN OFFER`,
      `${run.obols} OBOLS`, UI.goldCss);

    panel(this, 480, 128, 912, 78);
    this.add.text(480, 112, offer.def.flavour, {
      fontFamily: BODY_FONT, fontSize: '11px', color: UI.mutedBright, align: 'center',
      wordWrap: { width: 860 },
    }).setOrigin(0.5);
    this.add.text(480, 144, offer.def.terms, {
      fontFamily: BODY_FONT, fontSize: '11px', color: UI.body, align: 'center',
      wordWrap: { width: 860 },
    }).setOrigin(0.5);

    this.drawOfferDetail(offer);

    const acceptLabel = 'ACCEPT';
    button(this, 360, 540, 220, 56, acceptLabel, () => this.accept(), UI.gold);
    button(this, 600, 540, 220, 56, 'WALK AWAY', () => this.walkAway(), UI.teal);
    const nav = offer.id === 'tinkers_trade' ? '← → CHOOSE  ·  ' : '';
    footer(this, `${nav}ENTER ${acceptLabel}  ·  ESC WALK AWAY`, 'WALKING AWAY COSTS NOTHING');
  }

  /** The pre-resolved detail: what the player sees before agreeing to it. */
  private drawOfferDetail(offer: EventOffer): void {
    const run = gameState.currentRun!;
    switch (offer.id) {
      case 'mercy_well': {
        panel(this, 480, 330, 912, 260);
        this.add.text(480, 250, 'THE PRICE', {
          fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.mutedBright,
        }).setOrigin(0.5);
        this.add.text(480, 292, offer.cost > 0 ? `${offer.cost} OBOLS` : 'FREE', {
          fontFamily: DISPLAY_FONT, fontSize: '28px', color: UI.goldCss,
        }).setOrigin(0.5);
        this.add.text(480, 338,
          `+${Math.round(offer.hpFraction * 100)}% HEALTH  ·  +${Math.round(offer.mpFraction * 100)}% MANA  ·  EVERY STANDING KIN`, {
            fontFamily: BODY_FONT, fontSize: '11px', color: UI.greenCss,
          }).setOrigin(0.5);
        this.drawPartyRow(392);
        break;
      }
      case 'blood_boon': {
        const boon = getBoon(offer.boonId);
        const victim = gameState.runParty.find(c => c.instanceId === offer.victimId);
        panel(this, 480, 330, 912, 260);
        this.add.text(480, 240, 'THE BOON', {
          fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.mutedBright,
        }).setOrigin(0.5);
        this.add.text(480, 272, boon.name.toUpperCase(), {
          fontFamily: DISPLAY_FONT, fontSize: '18px', color: UI.goldCss,
        }).setOrigin(0.5);
        this.add.text(480, 302, boon.description, {
          fontFamily: BODY_FONT, fontSize: '11px', color: UI.body, align: 'center',
          wordWrap: { width: 840 },
        }).setOrigin(0.5);
        if (victim) {
          const t = getTemplate(victim.speciesId);
          const hp = run.partyHp[victim.instanceId] ?? 0;
          const loss = Math.min(Math.floor(hp * offer.hpFraction), Math.max(0, hp - 1));
          this.add.text(480, 346, 'THE ALTAR ASKS OF', {
            fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.mutedBright,
          }).setOrigin(0.5);
          spritePlate(this, 400, 400, 56, 56, archetypeColor(t.archetype), UI.red);
          this.add.text(440, 388, victim.nickname ?? t.name, {
            fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.text,
          });
          this.add.text(440, 408, `HP ${hp} → ${hp - loss}   (−${loss})`, {
            fontFamily: BODY_FONT, fontSize: '11px', color: UI.redCss,
          });
        }
        break;
      }
      case 'dice_transfer': {
        panel(this, 480, 330, 912, 260);
        this.add.text(480, 236, 'THE DIE SHOWS', {
          fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.mutedBright,
        }).setOrigin(0.5);
        this.add.rectangle(480, 300, 96, 96, UI.plate).setStrokeStyle(3, UI.gold);
        this.add.text(480, 300, `${offer.roll}`, {
          fontFamily: DISPLAY_FONT, fontSize: '36px', color: UI.hi,
        }).setOrigin(0.5);
        this.add.text(480, 366, 'ACCEPT, THEN CHOOSE WHO GIVES AND WHO TAKES', {
          fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
        }).setOrigin(0.5);
        this.drawPartyRow(410);
        break;
      }
      case 'tinkers_trade': {
        this.add.text(24, 186, `THE WARES  ·  ${offer.cost > 0 ? `${offer.cost} OBOLS` : 'FREE'}`, {
          fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
        });
        const count = offer.itemIds.length;
        const gap = 12;
        const cardW = (912 - gap * (count - 1)) / count;
        offer.itemIds.forEach((itemId, i) => {
          const item = getItem(itemId);
          const accent = itemAccent(item.effect.kind);
          const x = 24 + cardW / 2 + i * (cardW + gap);
          const y = 350;
          const selected = i === this.selected;
          const bg = panel(this, x, y, cardW, 280, selected);
          spritePlate(this, x, y - 70, 84, 84, accent.color, selected ? UI.gold : UI.line);
          this.add.text(x, y - 70, accent.glyph, {
            fontFamily: DISPLAY_FONT, fontSize: '18px', color: UI.hi,
          }).setOrigin(0.5);
          this.add.text(x, y + 4, item.name.toUpperCase(), {
            fontFamily: DISPLAY_FONT, fontSize: '10px', color: selected ? UI.hi : UI.text,
            align: 'center', wordWrap: { width: cardW - 30 },
          }).setOrigin(0.5);
          this.add.text(x, y + 56, item.description, {
            fontFamily: BODY_FONT, fontSize: '10px', color: UI.body, align: 'center',
            wordWrap: { width: cardW - 40 },
          }).setOrigin(0.5);
          if (selected) {
            this.add.text(x, y + 120, 'CHOSEN', {
              fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.goldCss,
            }).setOrigin(0.5);
          }
          const gen = this.generation;
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerover', () => {
            if (gen !== this.generation) return;
            if (this.selected !== i) { this.selected = i; this.draw(); }
          });
          bg.on('pointerdown', () => {
            if (gen !== this.generation) return;
            this.selected = i;
            this.accept();
          });
        });
        break;
      }
      case 'warden_wager': {
        const e = offer.encounter;
        panel(this, 480, 330, 912, 260);
        this.add.text(480, 250, 'THE STAKES', {
          fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.mutedBright,
        }).setOrigin(0.5);
        this.add.text(480, 292, `A FIGHT ON FLOOR ${e.floor}`, {
          fontFamily: DISPLAY_FONT, fontSize: '18px', color: UI.redCss,
        }).setOrigin(0.5);
        this.add.text(480, 334, 'OBOLS AND XP DOUBLED', {
          fontFamily: DISPLAY_FONT, fontSize: '12px', color: UI.goldCss,
        }).setOrigin(0.5);
        const count = e.enemies?.length ?? 0;
        this.add.text(480, 366,
          `${count} FOE${count === 1 ? '' : 'S'} WAIT${count === 1 ? 'S' : ''}  ·  LEVEL ${e.enemyLevels ?? '?'}  ·  NO TELLING WHAT`, {
            fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
          }).setOrigin(0.5);
        this.drawPartyRow(410);
        break;
      }
    }
  }

  /** The party as it stands, so the player can weigh the terms against it. */
  private drawPartyRow(y: number): void {
    const run = gameState.currentRun!;
    gameState.runParty.forEach((creature, i) => {
      compactPartyCard(this, creature, 200 + i * 280, y, 260,
        run.partyHp[creature.instanceId], run.partyMp[creature.instanceId],
        !!run.partyKO[creature.instanceId],
        effectiveMaxHp(creature.currentStats.hp, run.activeBoons));
    });
  }

  private drawPicker(role: 'donor' | 'recipient'): void {
    const offer = this.offer;
    if (!offer || offer.id !== 'dice_transfer') { this.step = 'offer'; this.draw(); return; }
    const run = gameState.currentRun!;
    const ctx = this.context();
    const eligibleIds = new Set(
      (role === 'donor' ? diceDonors(ctx) : diceRecipients(ctx, this.donorId ?? '')).map(c => c.instanceId),
    );
    screenFrame(this);
    header(this, role === 'donor' ? 'WHO GIVES?' : 'WHO TAKES?',
      `THE DIE SHOWS ${offer.roll}  ·  ${role === 'donor' ? 'CHOOSE THE KIN THAT PAYS' : 'CHOOSE THE KIN THAT HEALS'}`,
      `${run.obols} OBOLS`, UI.goldCss);

    gameState.runParty.forEach((creature, i) => {
      const t = getTemplate(creature.speciesId);
      const x = 180 + i * 300;
      const eligible = eligibleIds.has(creature.instanceId);
      const selected = i === this.selected;
      const hp = run.partyHp[creature.instanceId] ?? 0;
      const max = effectiveMaxHp(creature.currentStats.hp, run.activeBoons);
      const ko = !!run.partyKO[creature.instanceId];
      const isDonor = creature.instanceId === this.donorId;

      let reason: string;
      if (ko) reason = 'DOWN';
      else if (isDonor) reason = 'THE GIVER';
      else if (role === 'donor' && hp <= 1) reason = 'AT 1 HP';
      else if (role === 'recipient' && hp >= max) reason = 'ALREADY FULL';
      else if (role === 'donor') reason = `GIVES UP TO ${Math.min(offer.roll, hp - 1)} HP`;
      else reason = `TAKES UP TO ${Math.min(offer.roll, max - hp)} HP`;

      const bg = panel(this, x, 300, 276, 326, selected && eligible);
      spritePlate(this, x, 235, 104, 104, eligible ? archetypeColor(t.archetype) : UI.line);
      this.add.text(x, 314, creature.nickname ?? t.name, {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: eligible ? UI.text : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 346, `HP ${hp} / ${max}`, {
        fontFamily: BODY_FONT, fontSize: '11px', color: eligible ? UI.greenCss : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 385, reason, {
        fontFamily: DISPLAY_FONT, fontSize: '8px', color: eligible ? UI.hi : UI.muted,
      }).setOrigin(0.5);
      const gen = this.generation;
      bg.setInteractive({ useHandCursor: eligible });
      bg.on('pointerover', () => {
        if (gen !== this.generation) return;
        if (eligible && this.selected !== i) { this.selected = i; this.draw(); }
      });
      bg.on('pointerdown', () => {
        if (gen !== this.generation || !eligible) return;
        this.selected = i;
        this.confirm();
      });
    });

    const current = gameState.runParty[this.selected];
    const canConfirm = !!current && eligibleIds.has(current.instanceId);
    button(this, 480, 520, 240, 56, role === 'donor' ? 'GIVE' : 'TAKE',
      canConfirm ? () => this.confirm() : null, UI.gold, canConfirm);
    footer(this, `← → CHOOSE  ·  ENTER ${role === 'donor' ? 'GIVE' : 'TAKE'}  ·  ESC BACK`, offer.def.name.toUpperCase());
  }

  private drawResult(): void {
    const offer = this.offer!;
    const run = gameState.currentRun!;
    screenFrame(this);
    header(this, offer.def.name.toUpperCase(), `FLOOR ${this.encounter.floor}  ·  DONE`,
      `${run.obols} OBOLS`, UI.goldCss);
    panel(this, 480, 300, 912, 300);
    this.add.text(480, 250, this.resultMessage, {
      fontFamily: BODY_FONT, fontSize: '14px', color: UI.text, align: 'center',
      wordWrap: { width: 840 },
    }).setOrigin(0.5);
    this.drawPartyRow(360);
    button(this, 480, 520, 240, 56, 'CONTINUE', () => this.continueRun(), UI.gold);
    footer(this, 'ENTER CONTINUE', '');
  }
}
