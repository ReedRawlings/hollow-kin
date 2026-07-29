import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getItem } from '../data/items';
import { Encounter } from '../types';
import {
  SHOP_ITEMS, ShopItem, canBenefitFromShopItem, tryPurchaseShopItem,
  merchantStockFor, ItemOffer, tryBuyItem,
} from '../systems/Shop';
import { capacity, isFull, isProtected, usedSlots } from '../systems/Backpack';
import {
  UI, BODY_FONT, DISPLAY_FONT, button, footer, header, itemAccent, panel, screenFrame,
  spritePlate,
} from '../ui/Theme';

interface MerchantOffer {
  kind: 'service' | 'item';
  name: string;
  description: string;
  cost: number;
  accent: number;
  glyph: string;
  service?: ShopItem;
  item?: ItemOffer;
}

const SERVICE_COPY: Record<ShopItem['id'], { description: string; glyph: string; accent: number }> = {
  heal_party: {
    description: 'Restore half of every standing creature’s maximum HP.',
    glyph: '+',
    accent: UI.green,
  },
  restore_mp: {
    description: 'Fully restore MP for every standing creature.',
    glyph: 'MP',
    accent: UI.teal,
  },
  revive_creature: {
    description: 'Return the first fallen creature at one quarter HP and MP.',
    glyph: '↑',
    accent: UI.orange,
  },
};

/**
 * The in-run merchant. Services take effect immediately; supplies occupy a bag
 * slot and can be used later. Both are paid for with the run's Obols.
 */
export class ShopScene extends Phaser.Scene {
  private selected = 0;
  private keyboardBound = false;
  private encounter!: Encounter;

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data: { encounter: Encounter }): void {
    this.selected = 0;
    this.encounter = data.encounter;
    this.draw();
    if (!this.keyboardBound) {
      this.keyboardBound = true;
      this.input.keyboard?.on('keydown-LEFT', () => this.move(-1));
      this.input.keyboard?.on('keydown-RIGHT', () => this.move(1));
      this.input.keyboard?.on('keydown-UP', () => this.move(-1));
      this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
      this.input.keyboard?.on('keydown-ENTER', () => this.purchaseSelected());
      this.input.keyboard?.on('keydown-ESC', () => this.leave());
    }
  }

  private offers(): MerchantOffer[] {
    const services: MerchantOffer[] = SHOP_ITEMS.map(service => {
      const copy = SERVICE_COPY[service.id];
      return {
        kind: 'service',
        name: service.name.replace(/\s*\(.+\)$/, ''),
        description: copy.description,
        cost: service.cost,
        accent: copy.accent,
        glyph: copy.glyph,
        service,
      };
    });
    const items: MerchantOffer[] = merchantStockFor(this.encounter).map(item => {
      const def = getItem(item.itemId);
      const { color: accent, glyph } = itemAccent(def.effect.kind);
      return {
        kind: 'item',
        name: def.name,
        description: def.description,
        cost: item.cost,
        accent,
        glyph,
        item,
      };
    });
    return [...services, ...items];
  }

  private draw(): void {
    this.children.removeAll(true);
    const run = gameState.currentRun!;
    const offers = this.offers();

    screenFrame(this);
    const floor = run.currentEncounterIndex >= 0
      ? run.encounters[run.currentEncounterIndex]?.floor ?? run.startFloor
      : run.startFloor;
    header(this, 'TOWER MERCHANT', `FLOOR ${floor}  ·  TRADE BEFORE MOVING ON`,
      `${run.obols} OBOLS`, UI.goldCss);
    button(this, 866, 58, 136, 28, 'CONTINUE', () => this.leave(), UI.lineBright);

    this.add.text(24, 94, 'FIELD SERVICES', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.hi,
    });
    offers.slice(0, 3).forEach((offer, i) => {
      this.drawOffer(176 + i * 304, 196, 286, 164, offer, i);
    });

    this.add.text(24, 294, 'SUPPLIES  ·  PACKED FOR LATER', {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: UI.hi,
    });
    offers.slice(3).forEach((offer, i) => {
      this.drawOffer(252 + i * 456, 405, 432, 184, offer, i + 3);
    });

    this.drawBagStrip();
    footer(this, '← → CHOOSE  ·  ENTER BUY  ·  ESC CONTINUE',
      `${usedSlots(gameState.backpack)}/${capacity(gameState.backpack)} BAG SLOTS`);
  }

  private offerState(offer: MerchantOffer): { enabled: boolean; reason: string } {
    const run = gameState.currentRun!;
    if (offer.kind === 'service') {
      if (!canBenefitFromShopItem(offer.service!.id, run, gameState.runParty)) {
        return { enabled: false, reason: 'NO ONE NEEDS THIS' };
      }
    } else if (isFull(gameState.backpack)) {
      return { enabled: false, reason: 'BAG IS FULL' };
    }
    if (run.obols < offer.cost) {
      return { enabled: false, reason: `NEED ${offer.cost - run.obols} MORE` };
    }
    return { enabled: true, reason: 'AVAILABLE' };
  }

  private drawOffer(
    x: number,
    y: number,
    w: number,
    h: number,
    offer: MerchantOffer,
    index: number,
  ): void {
    const selected = this.selected === index;
    const state = this.offerState(offer);
    panel(this, x, y, w, h, selected);
    spritePlate(this, x - w / 2 + 50, y - h / 2 + 47, 54, 54,
      state.enabled ? offer.accent : UI.line, selected ? UI.gold : UI.line);
    this.add.text(x - w / 2 + 50, y - h / 2 + 47, offer.glyph, {
      fontFamily: DISPLAY_FONT,
      fontSize: offer.glyph.length > 2 ? '7px' : '13px',
      color: state.enabled
        ? Phaser.Display.Color.IntegerToColor(offer.accent).rgba
        : UI.muted,
    }).setOrigin(0.5);
    this.add.text(x - w / 2 + 88, y - h / 2 + 23, offer.name.toUpperCase(), {
      fontFamily: DISPLAY_FONT, fontSize: '8px',
      color: state.enabled ? UI.text : UI.muted,
    });
    this.add.text(x + w / 2 - 16, y - h / 2 + 23, `${offer.cost}`, {
      fontFamily: DISPLAY_FONT, fontSize: '9px',
      color: state.enabled ? UI.goldCss : UI.muted,
    }).setOrigin(1, 0);
    this.add.text(x - w / 2 + 88, y - h / 2 + 43, 'OBOLS', {
      fontFamily: BODY_FONT, fontSize: '8px', color: UI.mutedBright,
    });
    this.add.text(x - w / 2 + 16, y + 14, offer.description, {
      fontFamily: BODY_FONT, fontSize: '10px',
      color: state.enabled ? UI.body : UI.muted,
      wordWrap: { width: w - 32 }, lineSpacing: 2,
    });
    this.add.text(x - w / 2 + 16, y + h / 2 - 27, state.reason, {
      fontFamily: DISPLAY_FONT, fontSize: '7px',
      color: state.enabled ? UI.greenCss : UI.redCss,
    });

    const hit = this.add.rectangle(x, y, w, h, 0xffffff, 0.001)
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
    panel(this, 480, 550, 912, 62);
    this.add.text(40, 532, 'YOUR BAG', {
      fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.hi,
    });
    this.add.text(40, 552, `${usedSlots(bag)} / ${capacity(bag)} USED`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
    });
    bag.slots.forEach((slot, i) => {
      const x = 194 + i * 116;
      const safe = isProtected(bag, i);
      this.add.rectangle(x, 550, 104, 40, UI.void)
        .setStrokeStyle(2, slot ? (safe ? UI.teal : UI.gold) : UI.line);
      const label = slot?.kind === 'item'
        ? getItem(slot.itemId).name.toUpperCase()
        : slot ? slot.kind.toUpperCase() : 'EMPTY';
      this.add.text(x, 544, label.slice(0, 16), {
        fontFamily: BODY_FONT, fontSize: '7px', color: slot ? UI.text : UI.muted,
      }).setOrigin(0.5);
      this.add.text(x, 558, safe ? 'SAFE' : `SLOT ${i + 1}`, {
        fontFamily: BODY_FONT, fontSize: '7px', color: safe ? UI.tealCss : UI.muted,
      }).setOrigin(0.5);
    });
  }

  private move(delta: number): void {
    const count = this.offers().length;
    this.selected = (this.selected + delta + count) % count;
    this.draw();
  }

  private purchaseSelected(): void {
    const run = gameState.currentRun;
    const offer = this.offers()[this.selected];
    if (!run || !offer || !this.offerState(offer).enabled) return;
    if (offer.service) {
      tryPurchaseShopItem(offer.service, run, gameState.runParty);
    } else if (offer.item) {
      const result = tryBuyItem(offer.item, run.obols, gameState.backpack);
      if (result.bought) {
        run.obols -= offer.item.cost;
        gameState.backpack = result.backpack;
      }
    }
    this.draw();
  }

  private leave(): void {
    this.scene.start('RunScene', { continueRun: true });
  }
}
