import Phaser from 'phaser';
import { gameState } from '../../managers/GameState';
import { getTemplate } from '../../data/creatures';
import { getItem } from '../../data/items';
import { runMaxHp } from '../../systems/Recovery';
import { canUseItem, applyItemOnMap } from '../../systems/Items';
import { capacity, isProtected, removeAt, usedSlots } from '../../systems/Backpack';
import { BackpackSlot, CreatureInstance, RunState } from '../../types';
import { UI, BODY_FONT, DISPLAY_FONT, button, panel } from '../../ui/Theme';

/**
 * The bag, lifted out of RunScene once it stopped being read-only.
 *
 * The real precedent: a panel drawn into a scene it does not own, owning its
 * own selection state rather than reaching back into the scene for it.
 * RunScene was already 425 lines before departure gating landed on top of it,
 * and the bag is the self-contained piece.
 *
 * The panel never decides what an item does — `applyItemOnMap` does. It renders
 * the outcome and, on anything other than a refusal, consumes the slot — except
 * a waystone: that resolves to `depart`, and departing is irreversible and
 * scene-owned, so this panel hands off to `onDepartRequest` and consumes nothing.
 * `RunScene.confirmDeparture()` is the single site that removes the waystone.
 */

export interface BagPanelOpts {
  run: RunState;
  onClose: () => void;
  /** A waystone was used — ask the scene to open its departure confirmation.
   *  The item is NOT consumed here; confirmDeparture() removes it once the
   *  player actually commits, matching the USE WAYSTONE button on the map. */
  onDepartRequest: () => void;
  /** Something changed; the caller should redraw the map behind the modal. */
  onChanged: () => void;
}

/** Which slot the player is choosing a target for; module-scoped, reset on open. */
let pendingSlot: number | null = null;
let lastMessage = '';

export function resetBagPanel(): void {
  pendingSlot = null;
  lastMessage = '';
}

export function drawBagPanel(scene: Phaser.Scene, opts: BagPanelOpts): void {
  const { run } = opts;
  const bag = gameState.backpack;

  scene.add.rectangle(480, 320, 952, 632, UI.void, 0.82).setInteractive();
  panel(scene, 480, 320, 640, 452, true);
  scene.add.text(480, 122, 'THE BAG', {
    fontFamily: DISPLAY_FONT, fontSize: '16px', color: UI.hi,
  }).setOrigin(0.5);
  scene.add.text(480, 156, `${run.obols} OBOLS  ·  ${usedSlots(bag)}/${capacity(bag)} SLOTS USED`, {
    fontFamily: DISPLAY_FONT, fontSize: '8px', color: UI.goldCss,
  }).setOrigin(0.5);

  if (pendingSlot !== null) {
    drawTargetPicker(scene, opts, pendingSlot);
    return;
  }

  bag.slots.forEach((slot, i) => {
    const x = 260 + (i % 3) * 148;
    const y = 220 + Math.floor(i / 3) * 96;
    const safe = isProtected(bag, i);
    scene.add.rectangle(x, y, 136, 84, UI.panel)
      .setStrokeStyle(2, slot ? (safe ? UI.teal : UI.line) : UI.line);
    if (safe) {
      scene.add.text(x, y - 32, 'SECURED', {
        fontFamily: BODY_FONT, fontSize: '8px', color: UI.tealCss,
      }).setOrigin(0.5);
    }
    scene.add.text(x, y - 8, slotLabel(slot), {
      fontFamily: BODY_FONT, fontSize: '8px',
      color: slot ? UI.body : UI.muted, align: 'center', wordWrap: { width: 124 },
    }).setOrigin(0.5);

    if (slot?.kind === 'item') {
      const def = getItem(slot.itemId);
      if (canUseItem(def, { where: 'map', isBoss: false })) {
        button(scene, x, y + 26, 84, 22, 'USE', () => beginUse(scene, opts, i), UI.gold);
      } else {
        scene.add.text(x, y + 26, 'FOR FIGHTS', {
          fontFamily: BODY_FONT, fontSize: '8px', color: UI.muted,
        }).setOrigin(0.5);
      }
    }
  });

  scene.add.text(480, 470, lastMessage
    || 'SECURED SLOTS SURVIVE A WIPE. EVERYTHING ELSE RISKS ONE RANDOM LOSS.', {
    fontFamily: BODY_FONT, fontSize: '8px',
    color: lastMessage ? UI.greenCss : UI.mutedBright, align: 'center',
  }).setOrigin(0.5);
  button(scene, 480, 512, 170, 44, 'CLOSE', () => { resetBagPanel(); opts.onClose(); }, UI.lineBright);
}

/** Resolve straight away when the item takes no target; otherwise pick one. */
function beginUse(scene: Phaser.Scene, opts: BagPanelOpts, slotIndex: number): void {
  const slot = gameState.backpack.slots[slotIndex];
  if (slot?.kind !== 'item') return;
  const def = getItem(slot.itemId);
  if (def.effect.kind === 'depart') {
    // Same irreversible outcome as the run map's USE WAYSTONE button — route
    // through the same confirmation instead of ending the run on one misclick.
    resetBagPanel();
    opts.onDepartRequest();
    return;
  }
  if (def.targeting === 'none') {
    resolve(scene, opts, slotIndex, null);
    return;
  }
  pendingSlot = slotIndex;
  opts.onChanged();
}

function drawTargetPicker(scene: Phaser.Scene, opts: BagPanelOpts, slotIndex: number): void {
  const slot = gameState.backpack.slots[slotIndex];
  if (slot?.kind !== 'item') { pendingSlot = null; opts.onChanged(); return; }
  const def = getItem(slot.itemId);

  scene.add.text(480, 196, `USE ${def.name.toUpperCase()} ON WHOM?`, {
    fontFamily: DISPLAY_FONT, fontSize: '10px', color: UI.hi,
  }).setOrigin(0.5);

  gameState.runParty.forEach((creature, i) => {
    const down = opts.run.partyKO[creature.instanceId];
    const eligible = def.targeting === 'downed_ally' ? down : !down;
    const x = 260 + i * 220;
    const card = panel(scene, x, 300, 200, 132, false);
    scene.add.text(x, 270, creature.nickname ?? getTemplate(creature.speciesId).name, {
      fontFamily: DISPLAY_FONT, fontSize: '9px', color: eligible ? UI.text : UI.muted,
    }).setOrigin(0.5);
    scene.add.text(x, 302, down ? 'DOWN' : `HP ${opts.run.partyHp[creature.instanceId]}/${runMaxHp(creature, opts.run)}`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: down ? UI.redCss : UI.greenCss,
    }).setOrigin(0.5);
    scene.add.text(x, 326, `MP ${opts.run.partyMp[creature.instanceId]}/${creature.currentStats.mp}`, {
      fontFamily: BODY_FONT, fontSize: '10px', color: down ? UI.muted : UI.tealCss,
    }).setOrigin(0.5);
    if (eligible) {
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => resolve(scene, opts, slotIndex, creature));
    }
  });

  button(scene, 480, 470, 170, 44, 'BACK',
    () => { pendingSlot = null; opts.onChanged(); }, UI.lineBright);
}

/**
 * Ask Items.ts what happens, then act on it.
 *
 * The slot is consumed on any outcome EXCEPT a refusal — the same rule
 * `tryBuyItem` follows for payment. A refusal reports why and keeps the item.
 *
 * Never called for a `depart`-effect item: `beginUse` intercepts those before
 * reaching here (see `onDepartRequest`), so `outcome.kind === 'depart'` cannot
 * occur in practice. It stays in `ItemOutcome`'s union regardless — this
 * function just never produces or consumes for it.
 */
function resolve(
  scene: Phaser.Scene,
  opts: BagPanelOpts,
  slotIndex: number,
  target: CreatureInstance | null,
): void {
  const slot = gameState.backpack.slots[slotIndex];
  if (slot?.kind !== 'item') return;
  const outcome = applyItemOnMap(getItem(slot.itemId), target, opts.run);

  if (outcome.kind === 'refused') {
    lastMessage = outcome.reason.toUpperCase();
    pendingSlot = null;
    opts.onChanged();
    return;
  }

  gameState.backpack = removeAt(gameState.backpack, slotIndex);
  pendingSlot = null;

  lastMessage = outcome.kind === 'applied' ? outcome.message.toUpperCase() : '';
  gameState.saveToLocalStorage();
  opts.onChanged();
}

function slotLabel(slot: BackpackSlot): string {
  if (!slot) return 'empty';
  switch (slot.kind) {
    case 'creature': return getTemplate(slot.instance.speciesId).name.toUpperCase();
    case 'item': return getItem(slot.itemId).name.toUpperCase();
    case 'mark': return `MARK · ${slot.markId.toUpperCase()}`;
    case 'trait': return `${slot.traitId.toUpperCase()} L${slot.traitLevel}`;
  }
}
