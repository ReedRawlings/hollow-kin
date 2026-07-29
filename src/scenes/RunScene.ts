import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { getItem } from '../data/items';
import { generateDescent, generatePickNextChoices } from '../systems/RunGenerator';
import { usedSlots, capacity, isProtected, removeAt } from '../systems/Backpack';
import { convertObolsToEssence } from '../systems/Economy';
import { canDepart, hasWaystone, nextDepartureFloor } from '../systems/Departure';
import { BackpackSlot, Encounter, RunState, TOWER_FLOORS } from '../types';
import {
  UI, BODY_FONT, DISPLAY_FONT, archetypeColor, button, compactPartyCard,
  footer, header, hpColor, panel, screenFrame, spritePlate,
} from '../ui/Theme';

export class RunScene extends Phaser.Scene {
  private selected = 0;
  private keyboardBound = false;
  private ending = false;
  private confirmingDeparture = false;
  /** Set when the player picked a room while departure was open — the commit modal. */
  private confirmingCommit: Encounter | null = null;
  private resultIsWipe = false;
  private showingBag = false;

  constructor() {
    super({ key: 'RunScene' });
  }

  init(data?: { continueRun?: boolean }): void {
    this.ending = false;
    this.confirmingDeparture = false;
    this.confirmingCommit = null;
    this.showingBag = false;
    if (!data?.continueRun || !gameState.currentRun) {
      const startFloor = gameState.resolveRunStartFloor();
      gameState.startRun();
      const encounters = generateDescent(startFloor);
      gameState.currentRun = {
        startFloor, currentEncounterIndex: -1, encounters, choices: [],
        obols: 0, partyHp: {}, partyMp: {}, partyKO: {},
        xpEarned: 0, autoCombat: false,
      };
      for (const c of gameState.runParty) {
        gameState.currentRun.partyHp[c.instanceId] = c.currentStats.hp;
        gameState.currentRun.partyMp[c.instanceId] = c.currentStats.mp;
        gameState.currentRun.partyKO[c.instanceId] = false;
      }
    }
    this.refreshChoices();
  }

  create(): void {
    this.selected = 0;
    this.draw();
    if (!this.keyboardBound) {
      this.keyboardBound = true;
      this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
      this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
      this.input.keyboard?.on('keydown-ENTER', () => {
        if (this.ending) this.returnToTown();
        else if (this.confirmingCommit) {
          const staged = this.confirmingCommit;
          this.confirmingCommit = null;
          this.selectEncounter(staged);
        }
        else if (this.confirmingDeparture) this.confirmDeparture();
        else this.commitSelected();
      });
      this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => { e.preventDefault(); this.toggleAuto(); });
      this.input.keyboard?.on('keydown-ESC', () => {
        if (this.ending) return;
        if (this.showingBag) { this.showingBag = false; this.draw(); return; }
        if (this.confirmingCommit) {
          this.confirmingCommit = null;
          this.draw();
        } else if (this.confirmingDeparture) {
          this.confirmingDeparture = false;
          this.draw();
        } else {
          this.requestDeparture();
        }
      });
    }
  }

  private refreshChoices(): void {
    const run = gameState.currentRun;
    if (run) run.choices = generatePickNextChoices(run.encounters, run.currentEncounterIndex);
  }

  private draw(): void {
    this.children.removeAll(true);
    const run = gameState.currentRun!;
    const currentFloor = run.currentEncounterIndex >= 0
      ? run.encounters[run.currentEncounterIndex].floor
      : run.startFloor;
    const allKO = gameState.runParty.every(c => run.partyKO[c.instanceId]);
    if (allKO) { this.showRunEnd('wiped'); return; }
    if (!run.choices.length) { this.showRunEnd('cleared'); return; }

    screenFrame(this);
    const offeredFloor = run.choices[0]?.floor ?? currentFloor;
    header(this, `FLOOR ${offeredFloor}`,
      `${Math.max(0, run.currentEncounterIndex + 1)} ROOMS BEHIND  ·  WARDEN EVERY 5`,
      `${run.obols} OBOLS`, UI.goldCss);

    button(this, 700, 42, 106, 34, run.autoCombat ? 'AUTO ON' : 'AUTO OFF',
      () => this.toggleAuto(), run.autoCombat ? UI.green : UI.lineBright);
    // Label stays 'BAG' at the designed width — a count here overruns the button and
    // collides with the OBOLS readout. The count belongs inside the bag screen.
    const carried = usedSlots(gameState.backpack);
    button(this, 812, 42, 92, 34, 'BAG',
      () => { this.showingBag = true; this.draw(); },
      carried > 0 ? UI.gold : UI.lineBright);

    this.drawTrail(run);
    this.add.text(24, 143, 'CHOOSE THE NEXT ROOM', {
      fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
    });

    const count = run.choices.length;
    const gap = 12;
    const cardW = (912 - gap * (count - 1)) / count;
    run.choices.forEach((encounter, i) => {
      const x = 24 + cardW / 2 + i * (cardW + gap);
      this.drawOffer(encounter, x, 318, cardW, i === this.selected, i);
    });

    panel(this, 370, 510, 692, 72);
    gameState.runParty.forEach((creature, i) => {
      compactPartyCard(this, creature, 138 + i * 226, 510, 210,
        run.partyHp[creature.instanceId], run.partyMp[creature.instanceId],
        run.partyKO[creature.instanceId]);
    });

    const standing = gameState.runParty.filter(c => !run.partyKO[c.instanceId]).length;
    button(this, 836, 510, 176, 72, 'ENTER', () => this.commitSelected());
    this.add.text(836, 535, `${standing} OF ${gameState.runParty.length} STANDING`, {
      fontFamily: BODY_FONT, fontSize: '8px', color: UI.muted,
    }).setOrigin(0.5);
    const open = canDepart(run);
    const waystone = hasWaystone(gameState.backpack);
    const nextFloor = nextDepartureFloor(run);
    const nextText = nextFloor === null ? 'NONE — THE BOTTOM IS THE ONLY WAY OUT' : `FLOOR ${nextFloor}`;

    if (open) {
      button(this, 862, 573, 124, 28, 'DEPART', () => this.requestDeparture(), UI.gold);
    } else if (waystone) {
      button(this, 862, 573, 124, 28, 'USE WAYSTONE', () => this.requestDeparture(), UI.teal);
    } else {
      button(this, 862, 573, 124, 28, 'NO WAY OUT', () => this.flashLock(), UI.line, false);
    }

    this.add.text(24, 573,
      open ? 'SAFE PASSAGE OUT — TAKE IT OR PRESS ON'
        : waystone ? `WAYSTONE READY  ·  NEXT FREE EXIT: ${nextText}`
          : `NO WAYSTONE  ·  NEXT GUARANTEED DEPARTURE: ${nextText}`, {
      fontFamily: BODY_FONT, fontSize: '9px',
      color: open ? UI.goldCss : waystone ? UI.tealCss : UI.mutedBright,
    }).setOrigin(0, 0.5);
    footer(this, '← → CHOOSE  ·  ENTER COMMIT  ·  TAB AUTO  ·  ESC DEPART',
      this.offerName(run.choices[this.selected]));
    if (this.showingBag) this.drawBag(run);
    if (this.confirmingDeparture) this.drawDepartureConfirmation();
    if (this.confirmingCommit) this.drawCommitConfirmation(this.confirmingCommit);
  }

  /**
   * The bag. Shows Obols alongside the carried slots because offering Obols to an enemy
   * will happen from here during the combat pass, rather than as a separate action.
   *
   * Guaranteed slots are drawn distinctly: their contents survive a wipe, and that is
   * the only thing the player can do about the single random loss.
   */
  private drawBag(run: RunState): void {
    this.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
    panel(this, 480, 320, 620, 420, true);

    this.add.text(480, 138, 'THE BAG', {
      fontFamily: DISPLAY_FONT, fontSize: '16px', color: UI.hi,
    }).setOrigin(0.5);
    const bag = gameState.backpack;
    this.add.text(480, 174, `${run.obols} OBOLS  ·  ${usedSlots(bag)}/${capacity(bag)} SLOTS USED`, {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.goldCss,
    }).setOrigin(0.5);

    bag.slots.forEach((slot, i) => {
      const x = 260 + (i % 3) * 148;
      const y = 232 + Math.floor(i / 3) * 84;
      const safe = isProtected(bag, i);
      this.add.rectangle(x, y, 136, 72, UI.panel)
        .setStrokeStyle(2, slot ? (safe ? UI.teal : UI.line) : UI.line);
      if (safe) {
        this.add.text(x, y - 26, 'SECURED', {
          fontFamily: BODY_FONT, fontSize: '8px', color: UI.tealCss,
        }).setOrigin(0.5);
      }
      this.add.text(x, y + 6, this.slotLabel(slot), {
        fontFamily: BODY_FONT, fontSize: '8px',
        color: slot ? UI.body : UI.muted, align: 'center', wordWrap: { width: 124 },
      }).setOrigin(0.5);
    });

    this.add.text(480, 452,
      'SECURED SLOTS SURVIVE A WIPE. EVERYTHING ELSE RISKS ONE RANDOM LOSS.', {
        fontFamily: BODY_FONT, fontSize: '8px', color: UI.mutedBright, align: 'center',
      }).setOrigin(0.5);
    button(this, 480, 500, 170, 44, 'CLOSE',
      () => { this.showingBag = false; this.draw(); }, UI.lineBright);
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

  private drawTrail(run: RunState): void {
    const y = 106;
    this.add.text(24, y, 'TRAIL', {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
    }).setOrigin(0, 0.5);
    const cleared = run.encounters.slice(0, run.currentEncounterIndex + 1).slice(-10);
    cleared.forEach((e, i) => {
      const x = 86 + i * 42;
      const meta = this.offerMeta(e);
      this.add.rectangle(x, y, 26, 26, UI.panel).setStrokeStyle(2, meta.color);
      this.add.text(x, y, meta.glyph, {
        fontFamily: DISPLAY_FONT, fontSize: '9px', color: Phaser.Display.Color.IntegerToColor(meta.color).rgba,
      }).setOrigin(0.5);
      if (i < cleared.length - 1) this.add.rectangle(x + 21, y, 10, 3, UI.line);
    });
    if (!cleared.length) {
      this.add.text(86, y, 'THE GATE', {
        fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
      }).setOrigin(0, 0.5);
    }
  }

  private drawOffer(e: Encounter, x: number, y: number, w: number, selected: boolean, index: number): void {
    const meta = this.offerMeta(e);
    const bg = panel(this, x, y, w, 316, selected);
    spritePlate(this, x, y - 46, w - 28, 174, meta.color, selected ? UI.gold : UI.line);
    this.add.rectangle(x, y - 46, 60, 60, UI.void).setStrokeStyle(3, meta.color);
    this.add.text(x, y - 46, meta.glyph, {
      fontFamily: DISPLAY_FONT, fontSize: '24px',
      color: Phaser.Display.Color.IntegerToColor(meta.color).rgba,
    }).setOrigin(0.5);
    this.add.text(x, y + 72, meta.name, {
      fontFamily: DISPLAY_FONT, fontSize: '11px', color: selected ? UI.hi : UI.mutedBright,
    }).setOrigin(0.5);
    this.add.text(x, y + 104, meta.line, {
      fontFamily: BODY_FONT, fontSize: '11px', color: selected ? UI.body : UI.muted,
      align: 'center', wordWrap: { width: w - 40 },
    }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true });
    // The departure/commit modals and the run-end screen draw over these cards, but the
    // cards stay interactive underneath. Without these guards a click that reaches a card
    // while a modal is open commits the encounter instead — which looks exactly like
    // "depart did nothing and put me back on the map". `pointerover` is guarded too: it
    // calls draw(), which destroys and rebuilds every object in the scene, including the
    // modal button the player is currently reaching for.
    bg.on('pointerover', () => {
      if (this.confirmingDeparture || this.confirmingCommit !== null || this.ending || this.showingBag) return;
      if (this.selected !== index) { this.selected = index; this.draw(); }
    });
    bg.on('pointerdown', () => {
      if (this.confirmingDeparture || this.confirmingCommit !== null || this.ending || this.showingBag) return;
      this.selected = index;
      this.commitSelected();
    });
  }

  private offerMeta(e: Encounter): { name: string; glyph: string; color: number; line: string } {
    if (e.type === 'rest') return { name: 'RESPITE', glyph: '+', color: UI.green, line: 'Quiet, and a fire someone left burning.' };
    if (e.type === 'shop') return { name: 'MARKET', glyph: '$', color: UI.gold, line: 'Someone is trading down here.' };
    if (e.type === 'event') return { name: 'EVENT', glyph: '?', color: UI.muted === '#8c78a5' ? 0x8c78a5 : UI.lineBright, line: 'No telling until you are standing in it.' };
    if (e.type === 'boss') return { name: e.bossTier === 'major' ? 'WARDEN' : 'ELITE', glyph: '!', color: UI.orange, line: 'Something ancient is guarding the way down.' };
    return { name: 'ENCOUNTER', glyph: 'X', color: UI.red, line: 'Something down there is awake.' };
  }

  private offerName(e?: Encounter): string {
    return e ? this.offerMeta(e).name : '';
  }

  private move(delta: number): void {
    const run = gameState.currentRun;
    if (!run?.choices.length || this.ending) return;
    this.selected = (this.selected + delta + run.choices.length) % run.choices.length;
    this.draw();
  }

  private toggleAuto(): void {
    if (!gameState.currentRun || this.ending) return;
    gameState.currentRun.autoCombat = !gameState.currentRun.autoCombat;
    this.draw();
  }

  private commitSelected(): void {
    // `confirmingDeparture`/`confirmingCommit` matter as much as `ending`: while a modal
    // is open, entering a room is never what the player meant.
    const encounter = gameState.currentRun?.choices[this.selected];
    if (!encounter || this.ending || this.confirmingDeparture || this.showingBag) return;
    if (this.confirmingCommit) return;
    if (canDepart(gameState.currentRun!)) {
      this.confirmingCommit = encounter;
      this.draw();
      return;
    }
    this.selectEncounter(encounter);
  }

  private requestDeparture(): void {
    if (this.ending) return;
    if (!canDepart(gameState.currentRun!) && !hasWaystone(gameState.backpack)) {
      this.flashLock();
      return;
    }
    this.confirmingDeparture = true;
    this.draw();
  }

  /**
   * Departure is locked and there is no waystone. Flash the header line rather
   * than opening a modal whose only button is "never mind" — an unusable modal
   * reads as a broken button.
   */
  private flashLock(): void {
    const line = this.add.text(480, 300, 'THE WAY BACK IS SHUT', {
      fontFamily: DISPLAY_FONT, fontSize: '13px', color: UI.redCss,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: line, alpha: 0, duration: 900, onComplete: () => line.destroy() });
  }

  private confirmDeparture(): void {
    const run = gameState.currentRun!;
    if (!canDepart(run)) {
      // Only a waystone can be paying for this exit — spend it before the results
      // screen renders the bag, or the ledger shows an item the player no longer has.
      const i = gameState.backpack.slots.findIndex(
        s => s !== null && s.kind === 'item' && s.itemId === 'waystone');
      if (i === -1) { this.confirmingDeparture = false; this.draw(); return; }
      gameState.backpack = removeAt(gameState.backpack, i);
    }
    this.showRunEnd('fled');
  }

  private drawDepartureConfirmation(): void {
    const run = gameState.currentRun!;
    const open = canDepart(run);
    this.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
    const modal = panel(this, 480, 320, 540, 250, true);
    this.add.text(480, 245, 'LEAVE THE TOWER?', {
      fontFamily: DISPLAY_FONT, fontSize: '13px', color: UI.hi,
    }).setOrigin(0.5);
    this.add.text(480, 292,
      open
        ? 'The run ends here. Your leftover Obols convert to Essence at the full rate.'
        : 'The waystone breaks. The run ends here, at the full rate.', {
        fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
        align: 'center', wordWrap: { width: 450 },
      }).setOrigin(0.5);
    button(this, 385, 370, 170, 50, 'LEAVE TOWER', () => this.confirmDeparture(), UI.red);
    button(this, 575, 370, 170, 50, 'KEEP GOING', () => {
      this.confirmingDeparture = false;
      this.draw();
    }, UI.teal);
    this.add.text(480, 423, 'ENTER LEAVE  ·  ESC STAY', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    }).setOrigin(0.5);
    modal.setInteractive();
  }

  private drawCommitConfirmation(encounter: Encounter): void {
    const run = gameState.currentRun!;
    const nextFloor = nextDepartureFloor(run);
    const carrying = hasWaystone(gameState.backpack);
    this.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
    panel(this, 480, 320, 560, 262, true);
    this.add.text(480, 240, 'PRESS ON?', {
      fontFamily: DISPLAY_FONT, fontSize: '13px', color: UI.hi,
    }).setOrigin(0.5);
    this.add.text(480, 292,
      nextFloor === null
        ? `Committing to floor ${encounter.floor}. There is no guaranteed way out below this.`
        : `Committing to floor ${encounter.floor}. The next guaranteed way out is floor ${nextFloor}.`, {
        fontFamily: BODY_FONT, fontSize: '11px', color: UI.body,
        align: 'center', wordWrap: { width: 470 },
      }).setOrigin(0.5);
    if (carrying) {
      this.add.text(480, 336, 'You carry a waystone — one exit, any time.', {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.tealCss,
      }).setOrigin(0.5);
    }
    button(this, 385, 382, 170, 50, 'PRESS ON', () => {
      const staged = this.confirmingCommit!;
      this.confirmingCommit = null;
      this.selectEncounter(staged);
    }, UI.gold);
    button(this, 575, 382, 170, 50, 'DEPART INSTEAD', () => {
      this.confirmingCommit = null;
      this.confirmDeparture();
    }, UI.teal);
    this.add.text(480, 432, 'ENTER PRESS ON  ·  ESC BACK', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    }).setOrigin(0.5);
  }

  private selectEncounter(encounter: Encounter): void {
    const run = gameState.currentRun!;
    run.currentEncounterIndex = encounter.index;
    run.choices = [];
    if (encounter.type === 'combat' || encounter.type === 'boss') {
      this.scene.start('CombatScene', { encounter });
    } else if (encounter.type === 'shop') {
      this.scene.start('ShopScene', { encounter });
    } else if (encounter.type === 'rest') {
      this.scene.start('RestScene', { encounter });
    } else {
      run.obols += 15;
      run.xpEarned += 10;
      for (const c of gameState.runParty) {
        if (!run.partyKO[c.instanceId]) {
          c.xp += 10;
          gameState.tryLevelUp(c);
          run.partyHp[c.instanceId] = Math.min(
            run.partyHp[c.instanceId] + Math.floor(c.currentStats.hp * 0.1),
            c.currentStats.hp,
          );
        }
      }
      this.refreshChoices();
      this.selected = 0;
      this.draw();
    }
  }

  private showRunEnd(outcome: 'cleared' | 'fled' | 'wiped'): void {
    if (this.ending) return;
    this.ending = true;
    this.children.removeAll(true);
    const run = gameState.currentRun!;
    const isWipe = outcome === 'wiped';
    this.resultIsWipe = isWipe;
    this.confirmingDeparture = false;
    this.confirmingCommit = null;
    const deepest = run.currentEncounterIndex >= 0
      ? run.encounters[run.currentEncounterIndex].floor : run.startFloor;
    const gain = convertObolsToEssence(run.obols, { isWipe });
    const before = gameState.essence;
    screenFrame(this);
    header(this, isWipe ? 'PARTY WIPED' : outcome === 'cleared' ? 'TOWER CLEARED' : 'RETURNED ALIVE',
      `FLOOR ${deepest}  ·  ${run.currentEncounterIndex + 1} ROOMS CLEARED`,
      `LEFTOVER ${run.obols} OBOLS`, UI.goldCss);

    panel(this, 300, 300, 536, 390);
    this.add.text(52, 118, 'THE EXCHANGE', {
      fontFamily: DISPLAY_FONT, fontSize: '11px', color: UI.hi,
    });
    this.ledgerRow(52, 162, 'BASE CONVERSION', `${run.obols} obols at the current rate`, `+${convertObolsToEssence(run.obols, { isWipe: false })}`, UI.teal);
    this.ledgerRow(52, 224, 'DEPTH REACHED', `floor ${deepest} of ${TOWER_FLOORS}`, 'RECORDED', UI.amber);
    if (isWipe) this.ledgerRow(52, 286, 'WIPE PENALTY', 'the tower keeps half the leftover purse', `−${convertObolsToEssence(run.obols, { isWipe: false }) - gain}`, UI.red);
    panel(this, 300, 392, 488, 92, true);
    this.add.text(76, 366, 'ESSENCE GAINED', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.tealCss,
    });
    this.add.text(76, 393, `+${gain}`, {
      fontFamily: DISPLAY_FONT, fontSize: '22px', color: UI.hi,
    });
    this.add.text(274, 397, isWipe ? 'half taken at the gate' : 'nothing withheld', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    });

    panel(this, 748, 235, 328, 260);
    this.add.text(608, 126, 'PERMANENT BALANCE', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.tealCss,
    });
    this.add.text(608, 154, `${before}  →  ${before + gain} ESSENCE`, {
      fontFamily: DISPLAY_FONT, fontSize: '12px', color: UI.hi,
    });
    this.add.text(608, 198, 'PARTY FATES', {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
    });
    gameState.runParty.forEach((c, i) => {
      const t = getTemplate(c.speciesId);
      spritePlate(this, 632, 233 + i * 50, 32, 32, archetypeColor(t.archetype));
      this.add.text(656, 223 + i * 50, c.nickname ?? t.name, {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.text,
      });
      this.add.text(890, 223 + i * 50, isWipe ? 'FELLED' : 'HOME', {
        fontFamily: DISPLAY_FONT, fontSize: '7px', color: isWipe ? UI.redCss : UI.greenCss,
      }).setOrigin(1, 0);
    });
    panel(this, 748, 424, 328, 80);
    this.add.text(608, 397, isWipe ? 'TAKEN AT THE GATE' : 'NOTHING TAKEN', {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: isWipe ? UI.redCss : UI.greenCss,
    });
    this.add.text(608, 427, isWipe ? `ESSENCE −${convertObolsToEssence(run.obols, { isWipe: false }) - gain}` : 'ESSENCE 0  ·  ITEMS 0', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
    });
    button(this, 748, 526, 328, 62, 'TO TOWN', () => this.returnToTown());
    footer(this, 'ENTER TO TOWN', `${gain} ESSENCE BANKED`);
  }

  private returnToTown(): void {
    if (!this.ending || !gameState.currentRun) return;
    const run = gameState.currentRun;
    gameState.endRun(!this.resultIsWipe, run.obols);
    gameState.saveToLocalStorage();
    this.scene.start('TownScene');
  }

  private ledgerRow(x: number, y: number, label: string, note: string, value: string, color: number): void {
    this.add.rectangle(x + 244, y, 488, 50, UI.void).setStrokeStyle(2, UI.line);
    this.add.rectangle(x + 3, y, 6, 50, color);
    this.add.text(x + 16, y - 16, label, {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.text,
    });
    this.add.text(x + 16, y + 3, note, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
    });
    this.add.text(x + 468, y - 7, value, {
      fontFamily: DISPLAY_FONT, fontSize: '9px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
    }).setOrigin(1, 0);
  }
}
