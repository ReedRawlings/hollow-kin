import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getAbility } from '../data/abilities';
import { getItem } from '../data/items';
import {
  CombatCreature, CombatAction, BattlePhase, Encounter, COMBAT_DELAY_AUTO_THINK, scaledDelay,
} from '../types';
import { usedSlots } from '../systems/Backpack';
import { canUseItem } from '../systems/Items';
import { canSpendRelay } from '../systems/PackTempo';
import { BattleChamberContext } from '../systems/BattleChamber';
import { createSeededRandom } from '../systems/SeededRandom';
import { linkSignature, previewLinkArt } from '../systems/LinkArts';
import {
  CombatBattlefield, ChipSpec, CommandPanelView, RootCommandSpec, SubRowSpec,
} from './combat/BattlefieldRenderer';
import { UI, BODY_FONT } from '../ui/Theme';
import { Battle } from '../systems/combat/Battle';

/** Root menu. Escaping a battle is an ITEM (Smoke Husk), not a menu verb. */
const ROOT_COMMAND_COUNT = 4;

function emptyRow(): SubRowSpec {
  return { label: '', meta: '', selected: false, disabled: true, onHover: () => {}, onClick: () => {} };
}

export class CombatScene extends Phaser.Scene {
  private battle!: Battle;
  private battlefield!: CombatBattlefield;
  private hud!: Phaser.GameObjects.Container;

  /** Presentation-only state for the new command panel / targeting UI. */
  private currentTarget: CombatCreature | null = null;
  private cmdIndex = 0;
  private subOpen: 'MAGIC' | 'ITEM' | 'RELAY' | null = null;
  private subRowIndex = 0;
  /**
   * What's awaiting a click in the ALLY field. Items can now target the fallen as
   * well as the living, so the pending action carries which picker is open.
   *
   * Enemy-targeted items are deliberately NOT represented here — they use the
   * persistent `currentTarget` hover selection, exactly as enemy abilities do.
   * See selectItem for why routing them through this field breaks targeting.
   */
  private pendingAllyAction:
    | { kind: 'ability'; abilityId: string }
    | { kind: 'item'; itemId: string; slotIndex: number; picker: 'living_ally' | 'downed_ally' }
    | null = null;

  /** First row shown in the ITEM submenu; nine items no longer fit four rows. */
  private itemPage = 0;

  private onEscKey = () => this.handleEscape();
  private onLeftKey = () => this.cycleTarget(-1);
  private onRightKey = () => this.cycleTarget(1);

  /**
   * Phases in which the AUTO toggle is allowed to render at all. Deliberately
   * an allowlist rather than a denylist: a future phase that isn't added here
   * simply gets no toggle (safe default) instead of silently getting one that's
   * live and clickable on top of a screen that doesn't expect it (the original
   * bug — the toggle survived into VICTORY/DEFEAT and dead-ended the game).
   */
  private static readonly HUD_ACTIVE_PHASES: ReadonlySet<BattlePhase> = new Set([
    BattlePhase.NEXT_TURN,
    BattlePhase.PLAYER_CHOOSING,
    BattlePhase.PLAYER_TARGETING,
    BattlePhase.EXECUTING,
    BattlePhase.TURN_END,
  ]);

  constructor() {
    super({ key: 'CombatScene' });
  }

  private get playerParty() { return this.battle.playerParty; }
  private get enemyParty() { return this.battle.enemyParty; }
  private get turnOrder() { return this.battle.turnOrder; }
  private get currentTurnIndex() { return this.battle.currentTurnIndex; }
  private get phase() { return this.battle.phase; }
  private set phase(value: BattlePhase) { this.battle.phase = value; }
  private get encounter() { return this.battle.encounter; }
  private get messageLog() { return this.battle.messageLog; }
  private get enemyIntents() { return this.battle.enemyIntents; }
  private get packTempo() { return this.battle.packTempo; }
  private get sharedActions() { return this.battle.sharedActions; }
  private get linkChain() { return this.battle.linkChain; }
  private get chamberContext() { return this.battle.chamberContext; }
  private get roundNumber() { return this.battle.roundNumber; }
  private get queuedRelayTargetSlotId() { return this.battle.queuedRelayTargetSlotId; }
  private set queuedRelayTargetSlotId(value: string | null) {
    this.battle.queuedRelayTargetSlotId = value;
  }

  init(data: { encounter: Encounter; chamber?: BattleChamberContext }): void {
    const chamberContext = data.chamber ?? null;
    const rng = chamberContext
      ? createSeededRandom(chamberContext.seed)
      : Math.random;
    this.battle = new Battle(data.encounter, chamberContext, rng, {
      redraw: () => this.redraw(),
      schedule: (delayMs, callback) => { this.time.delayedCall(delayMs, callback); },
      openRootMenu: () => this.openRootMenu(),
      returnToChoosing: () => {
        this.pendingAllyAction = null;
        this.redraw();
      },
      battleEnded: victory => this.showBattleEnd(victory),
      escaped: () => this.escapeBattle(),
    });
    this.currentTarget = null;
    this.cmdIndex = 0;
    this.subOpen = null;
    this.subRowIndex = 0;
    this.pendingAllyAction = null;
    this.itemPage = 0;
  }

  create(): void {
    this.bindKeys();
    this.battlefield = new CombatBattlefield(this);
    this.hud = this.add.container(0, 0);
    this.battle.start();
  }

  private bindKeys(): void {
    // The scene instance is reused across battles (Phaser doesn't recreate it
    // on scene.start()), so listeners must be removed before re-adding or
    // they'd accumulate one extra firing per past battle.
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.off('keydown-ESC', this.onEscKey);
    kb.off('keydown-LEFT', this.onLeftKey);
    kb.off('keydown-RIGHT', this.onRightKey);
    kb.on('keydown-ESC', this.onEscKey);
    kb.on('keydown-LEFT', this.onLeftKey);
    kb.on('keydown-RIGHT', this.onRightKey);
  }

  // ---------- Menu / targeting state machine (presentation only) ----------

  private openRootMenu(): void {
    this.cmdIndex = 0;
    this.subOpen = null;
    this.subRowIndex = 0;
    this.pendingAllyAction = null;
    this.ensureValidTarget();
    this.phase = BattlePhase.PLAYER_CHOOSING;
    this.redraw();
  }

  private rootLabels(): string[] {
    const queuedSlot = this.turnOrder.find(slot => slot.slotId === this.queuedRelayTargetSlotId);
    const relay = queuedSlot
      ? `RELAY → ${queuedSlot.actor.template.name.toUpperCase()}`
      : 'RELAY';
    return this.battle.usesSharedActions()
      ? ['BASIC · 0 AP', 'MOVES · AP', 'ITEM', relay]
      : ['FIGHT', 'MAGIC', 'ITEM', relay];
  }

  private rootDetails(): string[] {
    const relay = this.queuedRelayTargetSlotId
      ? 'Relay queued. Choose it again to change or cancel the target.'
      : !canSpendRelay(this.packTempo)
        ? `RELAY — earn ${this.packTempo.cap - this.packTempo.points} more Tempo through Weakness, Omen, Break, or Rebound.`
        : 'RELAY READY — remains banked until used. Pull an unused ally forward for all 3 Tempo.';
    return [
      this.battle.usesSharedActions()
        ? 'BASIC — costs 0 AP. Tempo comes from authored combat accomplishments.'
        : 'FIGHT — costs 0 MP. Tempo comes from authored combat accomplishments.',
      this.battle.usesSharedActions()
        ? 'MOVES — spend shared Action Points on learned actions; FIGHT is always free.'
        : 'MAGIC — spend this Kin\'s MP on a move.',
      'ITEM — use something from the shared bag.',
      relay,
    ];
  }

  private ensureValidTarget(): void {
    if (this.currentTarget && !this.currentTarget.isKnockedOut) return;
    this.currentTarget = this.enemyParty.find(e => !e.isKnockedOut) ?? null;
  }

  private cycleTarget(dir: 1 | -1): void {
    if (this.phase !== BattlePhase.PLAYER_CHOOSING || this.pendingAllyAction) return;
    const alive = this.enemyParty.filter(e => !e.isKnockedOut);
    if (alive.length === 0) return;
    const idx = this.currentTarget ? alive.indexOf(this.currentTarget) : -1;
    const next = (((idx < 0 ? 0 : idx) + dir) + alive.length) % alive.length;
    this.currentTarget = alive[next];
    this.redraw();
  }

  private handleEscape(): void {
    if (this.pendingAllyAction) {
      this.pendingAllyAction = null;
      this.phase = BattlePhase.PLAYER_CHOOSING;
      this.redraw();
    } else if (this.subOpen) {
      this.subOpen = null;
      this.subRowIndex = 0;
      this.redraw();
    }
  }

  private handleRootCommand(i: number, actor: CombatCreature): void {
    if (i === 0) {
      this.chooseAbility(actor, 'basic_attack');
    } else if (i === 1) {
      this.cmdIndex = 1;
      this.subOpen = 'MAGIC';
      this.subRowIndex = 0;
      this.redraw();
    } else if (i === 2) {
      this.cmdIndex = 2;
      this.subOpen = 'ITEM';
      this.subRowIndex = 0;
      this.itemPage = 0;
      this.redraw();
    } else if (i === 3) {
      this.cmdIndex = 3;
      this.subOpen = 'RELAY';
      this.subRowIndex = 0;
      this.redraw();
    }
  }

  /**
   * Same targeting dispatch the old ability-button grid used — only how a
   * target gets picked has changed (a persistent hover/arrow-key selection in
   * the enemy field instead of a modal picker screen). single_enemy auto-
   * targets when exactly one enemy is alive, same as before.
   */
  private chooseAbility(caster: CombatCreature, abilityId: string): void {
    const ability = getAbility(abilityId);
    if (ability.targeting === 'self' || ability.targeting === 'all_enemies' || ability.targeting === 'all_allies') {
      this.battle.playerAct(caster, abilityId, caster);
      return;
    }
    if (ability.targeting === 'single_ally') {
      const livingAllies = this.playerParty.filter(p => !p.isKnockedOut);
      if (livingAllies.length === 1) {
        this.battle.playerAct(caster, abilityId, livingAllies[0]);
      } else {
        this.pendingAllyAction = { kind: 'ability', abilityId };
        this.phase = BattlePhase.PLAYER_TARGETING;
        this.redraw();
      }
      return;
    }
    // single_enemy
    const livingEnemies = this.enemyParty.filter(e => !e.isKnockedOut);
    if (livingEnemies.length === 1) {
      this.battle.playerAct(caster, abilityId, livingEnemies[0]);
    } else {
      this.ensureValidTarget();
      if (this.currentTarget) this.battle.playerAct(caster, abilityId, this.currentTarget);
    }
  }

  /** Selecting an ITEM row — routes to the picker (or auto-target) its `targeting` calls for. */
  private selectItem(itemId: string): void {
    const slotIndex = gameState.backpack.slots.findIndex(
      s => s !== null && s.kind === 'item' && s.itemId === itemId);
    if (slotIndex === -1) return;
    const def = getItem(itemId);

    if (def.targeting === 'none' || def.targeting === 'all_living_allies') {
      // 'all_living_allies' takes no single target either — Battle.useItem
      // resolves it against the whole player party, same as 'none' resolves
      // against nothing.
      this.useItem(itemId, slotIndex, null);
      return;
    }
    if (def.targeting === 'enemy') {
      // Mirrors chooseAbility's single_enemy branch exactly. Do NOT route this
      // through pendingAllyAction: that flips the phase to PLAYER_TARGETING, and
      // `enemyInteractive` is computed as `PLAYER_CHOOSING && !pendingAllyAction`
      // — so the enemy field would go dead and strand the player with no way to
      // pick a target and no way back.
      const living = this.enemyParty.filter(e => !e.isKnockedOut);
      if (living.length === 1) { this.useItem(itemId, slotIndex, living[0]); return; }
      this.ensureValidTarget();
      if (this.currentTarget) this.useItem(itemId, slotIndex, this.currentTarget);
      return;
    }
    const wantDown = def.targeting === 'downed_ally';
    const candidates = this.playerParty.filter(c => c.isKnockedOut === wantDown);
    if (candidates.length === 0) return;
    if (candidates.length === 1) { this.useItem(itemId, slotIndex, candidates[0]); return; }
    this.pendingAllyAction = {
      kind: 'item', itemId, slotIndex, picker: wantDown ? 'downed_ally' : 'living_ally',
    };
    this.phase = BattlePhase.PLAYER_TARGETING;
    this.redraw();
  }

  /**
   * Apply a bag item's effect to `target` (null for effects that take none) and
   * consume the acting creature's turn. All interpretation of what the item DOES
   * lives in Items.ts — this method only routes the outcome to messages/turn
   * state. `slotIndex` is the exact slot the row was built from at selection
   * time (selectItem re-resolves it fresh, so a stale index here would be a bug).
   */
  private useItem(itemId: string, slotIndex: number, target: CombatCreature | null): void {
    this.pendingAllyAction = null;
    this.battle.useItem(itemId, slotIndex, target);
  }

  private escapeBattle(): void {
    this.destroyAll();
    const exit = this.battle.settleEscape();
    this.scene.start(exit.scene, exit.data);
  }

  private showBattleEnd(victory: boolean): void {
    this.destroyAll();
    const exit = this.battle.settle(victory);
    this.scene.start(exit.scene, exit.data);
  }

  // ---------- RENDERING ----------

  private floorLabel(): string {
    const floor = this.encounter.floor;
    if (this.encounter.type === 'boss') {
      return `FLOOR ${floor} — ${this.encounter.bossTier === 'major' ? 'MAJOR BOSS' : 'MINI BOSS'}`;
    }
    return `FLOOR ${floor} — AMBUSH`;
  }

  /** Unique item ids usable in THIS battle, in slot order. */
  private bagItemIds(): string[] {
    const ctx = { where: 'combat' as const, isBoss: this.encounter.type === 'boss' };
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const slot of gameState.backpack.slots) {
      if (slot && slot.kind === 'item' && !seen.has(slot.itemId)) {
        seen.add(slot.itemId);
        if (canUseItem(getItem(slot.itemId), ctx)) ids.push(slot.itemId);
      }
    }
    return ids;
  }

  /** Usable-item ids for the current ITEM submenu page. Reused by both the
   *  footer detail (which describes the hovered row) and the row builder,
   *  so the two never disagree about which item row N is. */
  private currentItemPage(): { shown: string[]; pages: number } {
    const all = this.bagItemIds();
    const PAGE = 3; // fourth row is the pager
    const pages = Math.max(1, Math.ceil(all.length / PAGE));
    this.itemPage = this.itemPage % pages;
    const shown = all.slice(this.itemPage * PAGE, this.itemPage * PAGE + PAGE);
    return { shown, pages };
  }

  private computeFooterDetail(): string {
    if (this.pendingAllyAction) {
      const name = this.pendingAllyAction.kind === 'ability'
        ? getAbility(this.pendingAllyAction.abilityId).name
        : getItem(this.pendingAllyAction.itemId).name;
      return `Select an ally for ${name}.`;
    }
    if (this.phase !== BattlePhase.PLAYER_CHOOSING) {
      return this.messageLog[this.messageLog.length - 1] ?? '';
    }
    if (this.subOpen === 'MAGIC') {
      const actor = this.turnOrder[this.currentTurnIndex]?.actor;
      const ids = actor ? this.battle.magicAbilityIds(actor) : [];
      const id = ids[this.subRowIndex];
      if (!id || !actor) return '';
      const ability = getAbility(id);
      const link = this.chamberContext?.linkArts
        ? previewLinkArt(this.linkChain, linkSignature(ability, actor.instance.instanceId))
        : null;
      return link ? `${ability.name} becomes ${link.name}: ${link.effect}` : ability.description;
    }
    if (this.subOpen === 'ITEM') {
      const { shown } = this.currentItemPage();
      const id = shown[this.subRowIndex];
      return id ? getItem(id).description : 'The bag holds no usable items.';
    }
    if (this.subOpen === 'RELAY') {
      const candidate = this.battle.relayCandidatesForCurrentTurn()[this.subRowIndex];
      return candidate
        ? `Queue ${candidate.actor.template.name} to act next after this action. Tempo is paid afterward.`
        : 'Cancel the queued Relay without spending Tempo.';
    }
    return this.rootDetails()[this.cmdIndex] ?? '';
  }

  private buildCommandPanel(actor: CombatCreature | undefined): CommandPanelView {
    if (this.pendingAllyAction && actor) {
      const name = this.pendingAllyAction.kind === 'ability'
        ? getAbility(this.pendingAllyAction.abilityId).name
        : getItem(this.pendingAllyAction.itemId).name;
      const disabledRoot: RootCommandSpec[] = this.rootLabels().map(label => ({
        label, selected: false, disabled: true, onHover: () => {}, onClick: () => {},
      }));
      return {
        headline: `SELECT ALLY — ${name.toUpperCase()}`,
        showBack: true,
        onBack: () => { this.handleEscape(); },
        rootOpen: true,
        rootCommands: disabledRoot,
        subRows: [],
        interactive: true,
      };
    }

    const choosing = !!actor && actor.isPlayerOwned && this.phase === BattlePhase.PLAYER_CHOOSING;
    if (!choosing) {
      const headline = actor
        ? `${actor.template.name.toUpperCase()} ${actor.isPlayerOwned ? 'ACTS' : 'ATTACKS'}`
        : '';
      return {
        headline,
        showBack: false,
        onBack: () => {},
        rootOpen: true,
        rootCommands: this.rootLabels().map(label => ({
          label, selected: false, disabled: true, onHover: () => {}, onClick: () => {},
        })),
        subRows: [],
        interactive: false,
      };
    }

    if (this.subOpen === 'MAGIC') {
      const abilityIds = this.battle.magicAbilityIds(actor);
      const rows: SubRowSpec[] = abilityIds.map((id, i) => {
        const ability = getAbility(id);
        const link = this.chamberContext?.linkArts
          ? previewLinkArt(this.linkChain, linkSignature(ability, actor.instance.instanceId))
          : null;
        const cost = this.battle.playerAbilityCost(id);
        const canUse = this.battle.canPayPlayerAbility(actor, id);
        const resource = this.battle.usesSharedActions() ? `AP ${cost}` : `MP${cost}`;
        const tempoPreview = this.battle.isKnownWeakness(ability, this.currentTarget)
          ? ' · +TEMPO WEAK'
          : '';
        return {
          label: (link?.name ?? ability.name).toUpperCase(),
          meta: link
            ? `LINK ART · ${resource}${tempoPreview} · ${link.effect.toUpperCase()}`
            : `${ability.power > 0 ? `${resource} · POW${ability.power}` : resource}${ability.keen ? ' · KEEN' : ''}${tempoPreview}`,
          selected: i === this.subRowIndex,
          disabled: !canUse,
          onHover: () => { this.subRowIndex = i; this.redraw(); },
          onClick: () => { this.subRowIndex = i; this.chooseAbility(actor, id); },
        };
      });
      while (rows.length < 4) rows.push(emptyRow());
      return {
        headline: this.battle.usesSharedActions()
          ? `MOVES — ${actor.template.name.toUpperCase()}  ·  SHARED AP ${this.sharedActions.points}/${this.sharedActions.cap}`
          : `MAGIC — ${actor.template.name.toUpperCase()}  ·  MP ${actor.currentMp}/${actor.maxMp}`,
        showBack: true,
        onBack: () => { this.subOpen = null; this.redraw(); },
        rootOpen: false,
        rootCommands: [],
        subRows: rows,
        interactive: true,
      };
    }

    if (this.subOpen === 'RELAY') {
      const candidates = this.battle.relayCandidatesForCurrentTurn();
      const rows: SubRowSpec[] = candidates.map((candidate, i) => ({
        label: `QUEUE ${candidate.actor.template.name.toUpperCase()}`,
        meta: 'ACT NEXT AFTER THIS ACTION · COST 3',
        selected: i === this.subRowIndex,
        disabled: false,
        onHover: () => { this.subRowIndex = i; this.redraw(); },
        onClick: () => {
          this.queuedRelayTargetSlotId = candidate.slotId;
          this.subOpen = null;
          this.cmdIndex = 3;
          this.redraw();
        },
      }));
      if (this.queuedRelayTargetSlotId) {
        const cancelIndex = rows.length;
        rows.push({
          label: 'CANCEL RELAY',
          meta: 'KEEP THE TEMPO BANKED',
          selected: this.subRowIndex === cancelIndex,
          disabled: false,
          onHover: () => { this.subRowIndex = cancelIndex; this.redraw(); },
          onClick: () => {
            this.queuedRelayTargetSlotId = null;
            this.subOpen = null;
            this.cmdIndex = 3;
            this.redraw();
          },
        });
      }
      while (rows.length < ROOT_COMMAND_COUNT) rows.push(emptyRow());
      return {
        headline: `RELAY READY — PACK TEMPO ${this.packTempo.points}/${this.packTempo.cap}`,
        showBack: true,
        onBack: () => { this.subOpen = null; this.redraw(); },
        rootOpen: false,
        rootCommands: [],
        subRows: rows,
        interactive: true,
      };
    }

    if (this.subOpen === 'ITEM') {
      const bag = gameState.backpack;
      const counts = new Map<string, number>();
      for (const slot of bag.slots) {
        if (slot && slot.kind === 'item') counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + 1);
      }
      const { shown, pages } = this.currentItemPage();
      const rows: SubRowSpec[] = shown.map((itemId, i) => {
        const def = getItem(itemId);
        // canUseItem (baked into bagItemIds) only checks CONTEXT — where the item
        // may be used. It says nothing about whether a valid target exists right
        // now, so a downed_ally item with nobody knocked out would otherwise reach
        // selectItem's bare `return` on click: no message, no state change, a dead
        // row that reads as a broken button.
        const disabled = def.targeting === 'downed_ally'
          && !this.playerParty.some(c => c.isKnockedOut);
        return {
          label: def.name.toUpperCase(),
          meta: `×${counts.get(itemId) ?? 0}`,
          selected: i === this.subRowIndex,
          disabled,
          onHover: () => { this.subRowIndex = i; this.redraw(); },
          onClick: () => { this.subRowIndex = i; this.selectItem(itemId); },
        };
      });
      if (pages > 1) {
        rows.push({
          label: `MORE (${this.itemPage + 1}/${pages})`,
          meta: '',
          selected: false,
          disabled: false,
          onHover: () => {},
          onClick: () => { this.itemPage = (this.itemPage + 1) % pages; this.subRowIndex = 0; this.redraw(); },
        });
      }
      if (rows.length === 0) {
        rows.push({
          label: 'EMPTY', meta: '', selected: false, disabled: true, onHover: () => {}, onClick: () => {},
        });
      }
      while (rows.length < 4) rows.push(emptyRow());
      return {
        headline: `ITEM — SHARED BAG  ·  ${usedSlots(bag)} SLOTS USED`,
        showBack: true,
        onBack: () => { this.subOpen = null; this.redraw(); },
        rootOpen: false,
        rootCommands: [],
        subRows: rows,
        interactive: true,
      };
    }

    const relayDisabled = !this.battle.canQueueRelay();
    const rootCommands: RootCommandSpec[] = this.rootLabels().map((label, i) => ({
      label,
      selected: i === this.cmdIndex,
      disabled: i === 3 && relayDisabled,
      onHover: () => { this.cmdIndex = i; this.redraw(); },
      onClick: () => this.handleRootCommand(i, actor),
    }));
    return {
      headline: `${actor.template.name.toUpperCase()}'S TURN`,
      showBack: false,
      onBack: () => {},
      rootOpen: true,
      rootCommands,
      subRows: [],
      interactive: true,
    };
  }

  private redraw(): void {
    const actor = this.turnOrder[this.currentTurnIndex]?.actor;
    const aliveEnemies = this.enemyParty.filter(e => !e.isKnockedOut);
    if (this.currentTarget && this.currentTarget.isKnockedOut) this.currentTarget = null;
    if (!this.currentTarget && aliveEnemies.length > 0) this.currentTarget = aliveEnemies[0];

    const turnOrderChips: ChipSpec[] = this.turnOrder.slice(this.currentTurnIndex, this.currentTurnIndex + 6).map(slot => ({
      label: `${slot.actor.template.name.toUpperCase()}${slot.source === 'boss_extra' ? ' II' : ''}`,
      color: slot.actor.isPlayerOwned ? UI.hi : UI.mutedBright,
      border: slot.actor.isPlayerOwned ? UI.gold : UI.line,
      bg: slot.actor.isPlayerOwned ? UI.plate : UI.void,
    }));

    const command = this.buildCommandPanel(actor);
    const footerDetail = this.computeFooterDetail();
    const footerTarget = this.currentTarget
      ? `TARGET — ${this.currentTarget.template.name.toUpperCase()} ${this.currentTarget.currentHp}/${this.currentTarget.maxHp}${
        this.chamberContext?.revealWeaknesses
          ? ` · WEAK ${this.currentTarget.instance.weaknesses.join('/') || 'NONE'}`
          : ''}`
      : '';

    const enemyInteractive = this.phase === BattlePhase.PLAYER_CHOOSING && !this.pendingAllyAction
      && !!actor?.isPlayerOwned;
    const allyInteractive = this.phase === BattlePhase.PLAYER_TARGETING && !!this.pendingAllyAction;

    this.battlefield.update({
      floorLabel: this.floorLabel(),
      round: this.roundNumber,
      tempo: this.packTempo.points,
      tempoCap: this.packTempo.cap,
      relayReady: canSpendRelay(this.packTempo),
      linkLabel: this.linkChain.moves.length > 0
        ? this.linkChain.moves.map(move => getAbility(move.abilityId).name.toUpperCase()).join(' → ')
        : null,
      usesSharedActions: this.battle.usesSharedActions(),
      actionPoints: this.sharedActions.points,
      actionPointCap: this.sharedActions.cap,
      turnOrderChips,
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      currentActor: actor,
      currentTarget: this.currentTarget,
      enemyInteractive,
      onEnemyHover: (enemy) => { this.currentTarget = enemy; this.redraw(); },
      onEnemyClick: (enemy) => { this.currentTarget = enemy; this.redraw(); },
      enemyIntent: (enemy) => {
        const intents = this.turnOrder
          .filter(slot => slot.actor === enemy)
          .map(slot => this.enemyIntents.get(slot.slotId))
          .filter((intent): intent is CombatAction => !!intent);
        if (intents.length === 0) return null;
        return intents.map((intent, index) => {
          const ability = getAbility(intent.abilityId);
          const target = ability.targeting === 'all_enemies'
            ? 'ALL KIN'
            : intent.target.template.name.toUpperCase();
          return `${intents.length > 1 ? `${index + 1}: ` : ''}${ability.name.toUpperCase()} → ${target}`;
        }).join('  ·  ');
      },
      allyInteractive,
      allyTargetable: (ally) =>
        this.pendingAllyAction?.kind === 'item' && this.pendingAllyAction.picker === 'downed_ally'
          ? ally.isKnockedOut
          : !ally.isKnockedOut,
      onAllyHover: () => {},
      onAllyClick: (ally) => {
        if (!this.pendingAllyAction) return;
        const caster = this.turnOrder[this.currentTurnIndex]?.actor;
        const action = this.pendingAllyAction;
        this.pendingAllyAction = null;
        if (!caster) return;
        if (action.kind === 'ability') {
          this.battle.playerAct(caster, action.abilityId, ally);
        } else {
          this.useItem(action.itemId, action.slotIndex, ally);
        }
      },
      command,
      footerDetail,
      footerTarget,
    });

    this.drawHud();
  }

  /**
   * The AUTO / SPEED toggles float in the top-right margin of the enemy field.
   * The mockup doesn't show them (out of scope for the design pass), so they
   * keep their old top-right-corner placement rather than being dropped —
   * just nudged down to clear the header's new turn-order chip row.
   */
  private drawHud(): void {
    this.hud.removeAll(true);
    if (!CombatScene.HUD_ACTIVE_PHASES.has(this.phase)) return;
    const run = gameState.currentRun!;

    const autoOn = run.autoCombat;
    const autoBg = this.add.rectangle(880, 117, 90, 20, autoOn ? 0x224422 : UI.panel, 0.96)
      .setStrokeStyle(2, autoOn ? 0x66cc66 : UI.line).setInteractive({ useHandCursor: true });
    const autoText = this.add.text(880, 117, autoOn ? 'AUTO: ON' : 'AUTO: OFF', {
      fontFamily: BODY_FONT, fontSize: '9px', color: autoOn ? '#bbffbb' : UI.muted,
    }).setOrigin(0.5);
    autoBg.on('pointerdown', () => this.toggleAuto());

    const speed = gameState.battleSpeed;
    const speedBg = this.add.rectangle(880, 142, 90, 20, UI.panel, 0.96)
      .setStrokeStyle(2, UI.line).setInteractive({ useHandCursor: true });
    const speedText = this.add.text(880, 142, `SPEED ${speed}x`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
    }).setOrigin(0.5);
    speedBg.on('pointerdown', () => this.cycleSpeed());
    this.hud.add([autoBg, autoText, speedBg, speedText]);
  }

  private toggleAuto(): void {
    const run = gameState.currentRun!;
    run.autoCombat = !run.autoCombat;
    // NOTE: intentionally not calling gameState.saveToLocalStorage() here.
    // autoCombat lives on RunState (gameState.currentRun), and currentRun is
    // not part of the serialized save — this toggle is never persisted by
    // this call regardless, so the call would just be a no-op flush of
    // unrelated state.
    const current = this.turnOrder[this.currentTurnIndex]?.actor;
    if (run.autoCombat
      && (this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING)
      && current?.isPlayerOwned
      && current.instance.tactic !== 'follow_orders') {
      this.pendingAllyAction = null;
      this.phase = BattlePhase.EXECUTING;
      this.redraw();
      this.time.delayedCall(
        scaledDelay(COMBAT_DELAY_AUTO_THINK, gameState.battleSpeed),
        () => this.battle.executeAutoTurn(current),
      );
    } else if ((this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING) && current) {
      // Re-open a fresh root menu rather than leaving a stale/half-open one.
      // Any in-progress ability selection is lost — defensible and simple.
      this.openRootMenu();
    } else {
      this.redraw();
    }
  }

  private cycleSpeed(): void {
    gameState.cycleBattleSpeed();
    gameState.saveToLocalStorage();
    const current = this.turnOrder[this.currentTurnIndex]?.actor;
    if ((this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING) && current) {
      this.openRootMenu();
    } else {
      this.redraw();
    }
  }

  /** Deterministic, presentation-free snapshot for browser playtests. */
  combatState(): object {
    return this.battle.snapshot();
  }

  /**
   * Fully destroys every object this scene has drawn, including interactive
   * registrations on the input plugin — not merely detaching them from the
   * display list. `this.children.removeAll()` (the old approach) only
   * detaches, which leaks a clickable hotspot every repaint; GameObject#destroy
   * additionally deregisters it from the InputPlugin. Since a full repaint
   * happens on essentially every state change here, that leak would otherwise
   * be severe.
   */
  private destroyAll(): void {
    const objs = this.children.getAll();
    for (let i = objs.length - 1; i >= 0; i--) {
      objs[i].destroy();
    }
  }
}
