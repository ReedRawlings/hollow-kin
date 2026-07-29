import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getItem } from '../data/items';
import { TOWN_ITEM_OFFERS, ItemOffer, tryBuyItem } from '../systems/Shop';
import { capacity, isFull, isProtected, usedSlots } from '../systems/Backpack';
import {
  UI, BODY_FONT, DISPLAY_FONT, backButton, button, footer, header, panel,
  screenFrame, spritePlate,
} from '../ui/Theme';

/**
 * The town Provisioner stocks carryable items for Essence. Purchases persist
 * immediately and remain in the shared bag for the next descent.
 */
export class TownShopScene extends Phaser.Scene {
  private selected = 0;
  private keyboardBound = false;

  constructor() {
    super({ key: 'TownShopScene' });
  }

  create(): void {
    this.selected = 0;
    this.draw();
    if (!this.keyboardBound) {
      this.keyboardBound = true;
      this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
      this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
      this.input.keyboard?.on('keydown-ENTER', () => this.purchaseSelected());
      this.input.keyboard?.on('keydown-ESC', () => this.returnToTown());
    }
  }

  private draw(): void {
    this.children.removeAll(true);
    const bag = gameState.backpack;

    screenFrame(this);
    header(this, 'THE PROVISIONER', 'SUPPLIES BOUGHT HERE WAIT IN YOUR BAG',
      `${gameState.essence} ESSENCE`, UI.tealCss);
    backButton(this, () => this.returnToTown());
    this.add.text(152, 95, 'OUTFITTER OF THE LAST SAFE STREET', {
      fontFamily: BODY_FONT, fontSize: '10px', color: UI.mutedBright,
    });
    this.add.text(152, 113,
      'Choose carefully. Captures and supplies compete for the same space below.', {
        fontFamily: BODY_FONT, fontSize: '10px', color: UI.body,
      });

    TOWN_ITEM_OFFERS.forEach((offer, i) => {
      this.drawOffer(264 + i * 432, 326, 404, 334, offer, i);
    });

    this.drawBagStrip();
    footer(this, '← → CHOOSE  ·  ENTER BUY  ·  ESC TOWN',
      `${usedSlots(bag)}/${capacity(bag)} BAG SLOTS`);
  }

  private offerState(offer: ItemOffer): { enabled: boolean; reason: string } {
    if (isFull(gameState.backpack)) return { enabled: false, reason: 'BAG IS FULL' };
    if (gameState.essence < offer.cost) {
      return { enabled: false, reason: `NEED ${offer.cost - gameState.essence} MORE ESSENCE` };
    }
    return { enabled: true, reason: 'READY TO PACK' };
  }

  private drawOffer(
    x: number,
    y: number,
    w: number,
    h: number,
    offer: ItemOffer,
    index: number,
  ): void {
    const def = getItem(offer.itemId);
    const selected = this.selected === index;
    const state = this.offerState(offer);
    const accent = offer.itemId === 'mending_draught' ? UI.green : UI.gold;
    const glyph = offer.itemId === 'mending_draught' ? '+' : 'STR';

    panel(this, x, y, w, h, selected);
    this.add.text(x - w / 2 + 22, y - h / 2 + 20, `SUPPLY 0${index + 1}`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.muted,
    });
    this.add.text(x + w / 2 - 22, y - h / 2 + 18, `${offer.cost} ESSENCE`, {
      fontFamily: DISPLAY_FONT, fontSize: '8px',
      color: state.enabled ? UI.tealCss : UI.muted,
    }).setOrigin(1, 0);
    spritePlate(this, x, y - 62, 152, 112, state.enabled ? accent : UI.line,
      selected ? UI.gold : UI.line);
    this.add.text(x, y - 62, glyph, {
      fontFamily: DISPLAY_FONT, fontSize: glyph.length > 2 ? '12px' : '24px',
      color: state.enabled
        ? Phaser.Display.Color.IntegerToColor(accent).rgba
        : UI.muted,
    }).setOrigin(0.5);
    this.add.text(x, y + 19, def.name.toUpperCase(), {
      fontFamily: DISPLAY_FONT, fontSize: '11px',
      color: state.enabled ? UI.hi : UI.muted,
    }).setOrigin(0.5);
    this.add.text(x, y + 56, def.description, {
      fontFamily: BODY_FONT, fontSize: '11px',
      color: state.enabled ? UI.body : UI.muted,
      align: 'center', wordWrap: { width: w - 52 },
    }).setOrigin(0.5);
    this.add.text(x, y + 94, state.reason, {
      fontFamily: DISPLAY_FONT, fontSize: '8px',
      color: state.enabled ? UI.greenCss : UI.redCss,
    }).setOrigin(0.5);
    button(this, x, y + 132, 220, 46,
      state.enabled ? `BUY  ·  ${offer.cost}` : 'UNAVAILABLE',
      state.enabled ? () => { this.selected = index; this.purchaseSelected(); } : null,
      UI.teal, state.enabled);

    const hit = this.add.rectangle(x, y - 24, w, h - 72, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: state.enabled });
    hit.on('pointerover', () => {
      if (this.selected !== index) {
        this.selected = index;
        this.draw();
      }
    });
    hit.on('pointerdown', () => {
      this.selected = index;
      this.purchaseSelected();
    });
  }

  private drawBagStrip(): void {
    const bag = gameState.backpack;
    panel(this, 480, 535, 912, 72);
    this.add.text(40, 511, 'YOUR BAG', {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.hi,
    });
    this.add.text(40, 532, `${usedSlots(bag)} / ${capacity(bag)} USED`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
    });
    this.add.text(40, 550, `${bag.guaranteedSlots} SAFE SLOTS`, {
      fontFamily: BODY_FONT, fontSize: '8px', color: UI.tealCss,
    });

    bag.slots.forEach((slot, i) => {
      const x = 194 + i * 116;
      const safe = isProtected(bag, i);
      this.add.rectangle(x, 535, 104, 48, UI.void)
        .setStrokeStyle(2, slot ? (safe ? UI.teal : UI.gold) : UI.line);
      const label = slot?.kind === 'item'
        ? getItem(slot.itemId).name.toUpperCase()
        : slot ? slot.kind.toUpperCase() : 'EMPTY';
      this.add.text(x, 528, label.slice(0, 16), {
        fontFamily: BODY_FONT, fontSize: '7px', color: slot ? UI.text : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 545, safe ? 'SAFE' : `SLOT ${i + 1}`, {
        fontFamily: BODY_FONT, fontSize: '7px', color: safe ? UI.tealCss : UI.muted,
      }).setOrigin(0.5);
    });
  }

  private move(delta: number): void {
    this.selected = (this.selected + delta + TOWN_ITEM_OFFERS.length) % TOWN_ITEM_OFFERS.length;
    this.draw();
  }

  private purchaseSelected(): void {
    const offer = TOWN_ITEM_OFFERS[this.selected];
    if (!offer || !this.offerState(offer).enabled) return;
    const result = tryBuyItem(offer, gameState.essence, gameState.backpack);
    if (!result.bought) return;
    gameState.essence -= offer.cost;
    gameState.backpack = result.backpack;
    gameState.saveToLocalStorage();
    this.draw();
  }

  private returnToTown(): void {
    this.scene.start('TownScene');
  }
}
