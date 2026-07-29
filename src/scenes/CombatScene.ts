import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { getAbility } from '../data/abilities';
import { getItem } from '../data/items';
import {
  CombatCreature, BattlePhase, Encounter, CreatureInstance, bandForFloor,
  generateId, STAR_LEVEL_CAPS, TacticId, COMBAT_DELAY_AUTO_THINK,
  scaledDelay, COMBAT_DELAY_ACTION, COMBAT_DELAY_TURN_END, COMBAT_DELAY_STATUS_SKIP,
} from '../types';
import {
  calculateTurnOrder, calculateDamage, applyDamage,
  applyAbilityEffects, tickStatusEffects, isSkipTurn,
  createCombatCreature, resolveNonDamagingAbility, applyHeal, applyBuffDebuff,
} from '../systems/CombatEngine';
import { getEnemyAction, chooseAction } from '../systems/TacticsAI';
import { obolsForEncounter } from '../systems/Economy';
import { usedSlots, removeAt } from '../systems/Backpack';
import {
  renderBattlefield, ChipSpec, CommandPanelView, RootCommandSpec, SubRowSpec,
} from './combat/BattlefieldRenderer';
import { UI, BODY_FONT } from '../ui/Theme';

const ROOT_LABELS = ['FIGHT', 'MAGIC', 'ITEM', 'RUN'] as const;

/**
 * Root-menu detail lines, verbatim from the mockup — except RUN. The mockup's
 * RUN row cites a fabricated escape percentage; there is no mid-battle flee
 * mechanic in this codebase (flee only exists between encounters, on
 * RunScene), so per the task's instruction this row reads as unavailable
 * rather than inventing one.
 */
const ROOT_DETAIL: readonly string[] = [
  'FIGHT — basic attack, no MP cost.',
  'MAGIC — spend MP on a spell.',
  'ITEM — use something from the shared bag.',
  'RUN — no escape available mid-battle.',
];

function emptyRow(): SubRowSpec {
  return { label: '', meta: '', selected: false, disabled: true, onHover: () => {}, onClick: () => {} };
}

export class CombatScene extends Phaser.Scene {
  private playerParty: CombatCreature[] = [];
  private enemyParty: CombatCreature[] = [];
  private turnOrder: CombatCreature[] = [];
  private currentTurnIndex = 0;
  private phase: BattlePhase = BattlePhase.STARTING;
  private encounter!: Encounter;
  private messageLog: string[] = [];

  /** Presentation-only state for the new command panel / targeting UI. */
  private roundNumber = 1;
  private currentTarget: CombatCreature | null = null;
  private cmdIndex = 0;
  private subOpen: 'MAGIC' | 'ITEM' | null = null;
  private subRowIndex = 0;
  /**
   * What's awaiting a click on a living ally: an ability (single_ally targeting,
   * >1 candidate) or a bag item (both of today's item effects target one ally) —
   * both funnel through the same ally-picker UI, so one field covers either.
   */
  private pendingAllyAction:
    | { kind: 'ability'; abilityId: string }
    | { kind: 'item'; itemId: string; slotIndex: number }
    | null = null;

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

  init(data: { encounter: Encounter }): void {
    this.encounter = data.encounter;
    this.playerParty = [];
    this.enemyParty = [];
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.messageLog = [];
    this.roundNumber = 1;
    this.currentTarget = null;
    this.cmdIndex = 0;
    this.subOpen = null;
    this.subRowIndex = 0;
    this.pendingAllyAction = null;
  }

  create(): void {
    this.bindKeys();
    this.initBattle();
    this.phase = BattlePhase.NEXT_TURN;
    this.redraw();
    this.nextTurn();
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

  private initBattle(): void {
    const run = gameState.currentRun!;

    // Player party
    for (const creature of gameState.runParty) {
      if (run.partyKO[creature.instanceId]) continue;
      const template = getTemplate(creature.speciesId);
      this.playerParty.push(createCombatCreature(
        creature, template, true,
        run.partyHp[creature.instanceId],
        run.partyMp[creature.instanceId],
      ));
    }

    // Enemy party
    const enemyIds = this.encounter.enemies ?? [];
    const enemyLevel = this.encounter.enemyLevels ?? 1;
    for (const speciesId of enemyIds) {
      const template = getTemplate(speciesId);
      const enemyInstance: CreatureInstance = {
        instanceId: generateId(),
        speciesId,
        nickname: null,
        starRating: 0,
        currentLevel: enemyLevel,
        levelCap: STAR_LEVEL_CAPS[0],
        permanentLevel: 1,
        essenceInvested: 0,
        abilities: [...template.defaultAbilities, null, null].slice(0, 4),
        traitSlots: [],
        lineage: { parentA: null, parentB: null },
        statBaseline: { ...template.baseStats },
        currentStats: { ...template.baseStats },
        resistances: [...template.resistances],
        weaknesses: [...template.weaknesses],
        isRetired: false,
        isBreedReady: false,
        xp: 0,
        tactic: 'fight_wisely', // unused for enemies; they run the enemy_default profile
      };
      // Scale enemy stats by level
      const statNames = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'] as const;
      for (const stat of statNames) {
        const base = template.baseStats[stat];
        const maxStat = base * 2.0; // Enemies scale less than players
        enemyInstance.currentStats[stat] = Math.floor(base + (maxStat - base) * (enemyLevel / 10));
      }
      // Per combat-system.md: enemies have nerfed ATK and slightly boosted HP
      // so each battle is not life or death
      enemyInstance.currentStats.str = Math.floor(enemyInstance.currentStats.str * 0.6);
      enemyInstance.currentStats.int = Math.floor(enemyInstance.currentStats.int * 0.6);
      enemyInstance.currentStats.hp = Math.floor(enemyInstance.currentStats.hp * 1.2);
      // Boss buff (on top of the above)
      if (this.encounter.type === 'boss') {
        enemyInstance.currentStats.hp = Math.floor(enemyInstance.currentStats.hp * 1.8);
        enemyInstance.currentStats.str = Math.floor(enemyInstance.currentStats.str * 1.15);
        enemyInstance.currentStats.int = Math.floor(enemyInstance.currentStats.int * 1.15);
      }
      this.enemyParty.push(createCombatCreature(enemyInstance, template, false));
    }
  }

  private nextTurn(): void {
    // Check battle end
    if (this.playerParty.every(c => c.isKnockedOut)) {
      this.phase = BattlePhase.DEFEAT;
      this.showBattleEnd(false);
      return;
    }
    if (this.enemyParty.every(c => c.isKnockedOut)) {
      this.phase = BattlePhase.VICTORY;
      this.showBattleEnd(true);
      return;
    }

    // Recalculate turn order if starting a new round
    if (this.currentTurnIndex >= this.turnOrder.length || this.turnOrder.length === 0) {
      if (this.turnOrder.length > 0) this.roundNumber++; // not on the very first computation
      this.turnOrder = calculateTurnOrder([...this.playerParty, ...this.enemyParty]);
      this.currentTurnIndex = 0;
    }

    const current = this.turnOrder[this.currentTurnIndex];
    if (!current || current.isKnockedOut) {
      this.currentTurnIndex++;
      this.nextTurn();
      return;
    }

    // Status check — skip turn if frozen/stunned/asleep
    if (isSkipTurn(current)) {
      const statusName = current.statusEffects.find(
        s => s.type === 'freeze' || s.type === 'stun' || s.type === 'sleep'
      )?.type ?? 'status';
      this.addMessage(`${current.template.name} is ${statusName}ed and can't move!`);
      const msgs = tickStatusEffects(current);
      msgs.forEach(m => this.addMessage(m));
      current.isDefending = false;
      this.currentTurnIndex++;
      this.redraw();
      this.time.delayedCall(scaledDelay(COMBAT_DELAY_STATUS_SKIP, gameState.battleSpeed), () => this.nextTurn());
      return;
    }

    if (current.isPlayerOwned) {
      const run2 = gameState.currentRun!;
      const tactic = current.instance.tactic;
      if (run2.autoCombat && tactic !== 'follow_orders') {
        this.phase = BattlePhase.EXECUTING;
        this.redraw();
        this.time.delayedCall(scaledDelay(COMBAT_DELAY_AUTO_THINK, gameState.battleSpeed), () => this.executeAutoTurn(current));
      } else {
        this.openRootMenu();
      }
    } else {
      this.phase = BattlePhase.EXECUTING;
      this.executeEnemyTurn(current);
    }
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

  private magicAbilityIds(actor: CombatCreature): string[] {
    return actor.instance.abilities.filter((id): id is string => id !== null && id !== 'basic_attack');
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
      this.redraw();
    }
    // i === 3 (RUN): no escape mechanic exists mid-battle — disabled, unreachable.
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
      this.executePlayerAction(caster, abilityId, caster);
      return;
    }
    if (ability.targeting === 'single_ally') {
      const livingAllies = this.playerParty.filter(p => !p.isKnockedOut);
      if (livingAllies.length === 1) {
        this.executePlayerAction(caster, abilityId, livingAllies[0]);
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
      this.executePlayerAction(caster, abilityId, livingEnemies[0]);
    } else {
      this.ensureValidTarget();
      if (this.currentTarget) this.executePlayerAction(caster, abilityId, this.currentTarget);
    }
  }

  private executePlayerAction(
    attacker: CombatCreature,
    abilityId: string,
    target: CombatCreature,
  ): void {
    this.phase = BattlePhase.EXECUTING;
    const ability = getAbility(abilityId);

    attacker.currentMp -= ability.mpCost;
    attacker.isDefending = false;

    if (ability.targeting === 'all_enemies') {
      for (const enemy of this.enemyParty.filter(e => !e.isKnockedOut)) {
        this.resolveAbility(attacker, enemy, ability);
      }
    } else if (ability.targeting === 'self') {
      this.resolveAbility(attacker, attacker, ability);
    } else {
      this.resolveAbility(attacker, target, ability);
    }

    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed), () => this.finishTurn(attacker));
  }

  /**
   * Selecting an ITEM row. Both item effects today (heal, buff) target a single
   * ally — same auto-target-when-unambiguous rule as a single_ally ability.
   */
  private selectItem(itemId: string): void {
    const slotIndex = gameState.backpack.slots.findIndex(
      s => s !== null && s.kind === 'item' && s.itemId === itemId,
    );
    if (slotIndex === -1) return; // bag changed under us (shouldn't happen mid-turn) — no-op

    const livingAllies = this.playerParty.filter(p => !p.isKnockedOut);
    if (livingAllies.length === 1) {
      this.useItem(itemId, slotIndex, livingAllies[0]);
    } else {
      this.pendingAllyAction = { kind: 'item', itemId, slotIndex };
      this.phase = BattlePhase.PLAYER_TARGETING;
      this.redraw();
    }
  }

  /**
   * Apply a bag item's effect to `target` and consume the acting creature's turn —
   * same shape as executePlayerAction, minus MP cost. Reuses CombatEngine's existing
   * heal/buff paths rather than a second implementation. The item is removed from
   * `slotIndex` on use, which is the exact slot the row was built from at selection
   * time (selectItem re-resolves it fresh, so a stale index here would be a bug).
   */
  private useItem(itemId: string, slotIndex: number, target: CombatCreature): void {
    const actor = this.turnOrder[this.currentTurnIndex];
    if (!actor) return;
    this.phase = BattlePhase.EXECUTING;
    const def = getItem(itemId);
    actor.isDefending = false;

    if (def.effect.kind === 'heal') {
      const healed = applyHeal(target, def.effect.amount);
      this.addMessage(`${actor.template.name} used ${def.name} on ${target.template.name} — recovered ${healed} HP!`);
    } else {
      applyBuffDebuff(target, def.effect.stat, def.effect.stages);
      const dir = def.effect.stages > 0 ? 'rose' : 'fell';
      this.addMessage(`${actor.template.name} used ${def.name} — ${target.template.name}'s ${def.effect.stat.toUpperCase()} ${dir}!`);
    }

    gameState.backpack = removeAt(gameState.backpack, slotIndex);
    gameState.saveToLocalStorage();

    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed), () => this.finishTurn(actor));
  }

  private executeAutoTurn(creature: CombatCreature): void {
    // tactic is narrowed to TacticProfile — 'follow_orders' never reaches here.
    const profile = creature.instance.tactic as Exclude<TacticId, 'follow_orders'>;
    const action = chooseAction(
      creature,
      this.playerParty,
      this.enemyParty,
      profile,
      gameState.seenSpecies,
    );

    if (action.kind === 'defend') {
      creature.isDefending = true;
      this.addMessage(`${creature.template.name} defends!`);
      this.finishTurn(creature);
      return;
    }
    this.executePlayerAction(creature, action.abilityId, action.target);
  }

  private executeEnemyTurn(enemy: CombatCreature): void {
    const { abilityId, target } = getEnemyAction(enemy, this.playerParty);
    const ability = getAbility(abilityId);

    enemy.currentMp -= ability.mpCost;
    enemy.isDefending = false;

    if (ability.targeting === 'all_enemies') {
      for (const player of this.playerParty.filter(p => !p.isKnockedOut)) {
        this.resolveAbility(enemy, player, ability);
      }
    } else {
      this.resolveAbility(enemy, target, ability);
    }

    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed), () => this.finishTurn(enemy));
  }

  private resolveAbility(
    attacker: CombatCreature,
    target: CombatCreature,
    ability: ReturnType<typeof getAbility>,
  ): void {
    if (ability.power > 0) {
      const result = calculateDamage(attacker, target, ability);
      if (result.missed) {
        this.addMessage(`${attacker.template.name} used ${ability.name} — MISS!`);
        return;
      }
      applyDamage(target, result.damage);
      let msg = `${attacker.template.name} used ${ability.name} → ${result.damage} dmg to ${target.template.name}`;
      if (result.isCrit) msg += ' CRIT!';
      this.addMessage(msg);

      // Apply secondary effects
      const effectMsgs = applyAbilityEffects(ability, attacker, target, result.damage);
      effectMsgs.forEach(m => this.addMessage(m));
    } else {
      // Status/buff move
      const result = resolveNonDamagingAbility(ability, attacker, target);
      if (result.missed) {
        this.addMessage(`${attacker.template.name} used ${ability.name} — MISS!`);
        return;
      }
      this.addMessage(`${attacker.template.name} used ${ability.name}!`);
      result.messages.forEach(m => this.addMessage(m));
    }
  }

  private finishTurn(creature: CombatCreature): void {
    // Tick status effects
    const msgs = tickStatusEffects(creature);
    msgs.forEach(m => this.addMessage(m));

    this.currentTurnIndex++;
    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_TURN_END, gameState.battleSpeed), () => this.nextTurn());
  }

  private showBattleEnd(victory: boolean): void {
    // Every game object this scene has drawn — including whatever HUD/menu
    // hotspots were interactive a moment ago — gets destroyed (not just
    // detached) here, before we hand off via scene.start(). See destroyAll().
    this.destroyAll();

    // The player has now met every species in this encounter — win, loss, or
    // (should combat ever grow a mid-battle flee) any other exit — so record
    // them here, at the single choke point both battle-end paths (VICTORY and
    // DEFEAT branches of nextTurn(), the only two callers of showBattleEnd())
    // pass through. Recording in initBattle() instead (as the branch
    // originally did) makes every species already "known" before the AI ever
    // evaluates the battle it was just generated for, so the fog can never
    // suppress a type multiplier in the fight where it should. Per the design
    // spec §1 ("blind on first encounter") — the intent §3 contradicted by
    // asking for population at encounter-generation time — this battle stays
    // blind and only battles from here on are informed.
    for (const enemy of this.enemyParty) {
      gameState.recordSeenSpecies(enemy.instance.speciesId);
    }

    const run = gameState.currentRun!;

    if (victory) {
      // Award XP and obols
      // Scale on the depth band, not the raw floor — using the floor directly
      // would inflate XP roughly tenfold at the bottom of the tower.
      const depthBand = bandForFloor(this.encounter.floor);
      const xpPerCreature = 8 + (this.encounter.type === 'boss' ? 20 : 5) * depthBand;
      const obolKind = this.encounter.type === 'boss'
        ? (this.encounter.bossTier ?? 'mini')
        : 'normal';
      const obolGain = obolsForEncounter(obolKind, this.encounter.floor);
      run.obols += obolGain;

      if (this.encounter.type === 'boss') {
        gameState.recordBreakCleared(this.encounter.floor);
      }

      let levelUpMsg = '';
      for (const pc of this.playerParty) {
        if (!pc.isKnockedOut) {
          pc.instance.xp += xpPerCreature;
          while (gameState.tryLevelUp(pc.instance)) {
            pc.maxHp = pc.instance.currentStats.hp;
            pc.maxMp = pc.instance.currentStats.mp;
            pc.currentHp = Math.min(pc.currentHp + 5, pc.maxHp);
            levelUpMsg += `${pc.template.name} → Lv${pc.instance.currentLevel}! `;
          }
        }
      }

      this.savePartyState(run);
      this.scene.start('PostCombatScene', {
        floor: this.encounter.floor,
        obolGain,
        xpPerCreature,
        levelUpMessage: levelUpMsg.trim(),
      });
    } else {
      this.savePartyState(run);
      this.scene.start('RunScene', { continueRun: true });
    }
  }

  private savePartyState(run: typeof gameState.currentRun & object): void {
    for (const pc of this.playerParty) {
      run.partyHp[pc.instance.instanceId] = pc.currentHp;
      run.partyMp[pc.instance.instanceId] = pc.currentMp;
      run.partyKO[pc.instance.instanceId] = pc.isKnockedOut;
    }
  }

  // ---------- RENDERING ----------

  private floorLabel(): string {
    const floor = this.encounter.floor;
    if (this.encounter.type === 'boss') {
      return `FLOOR ${floor} — ${this.encounter.bossTier === 'major' ? 'MAJOR BOSS' : 'MINI BOSS'}`;
    }
    return `FLOOR ${floor} — AMBUSH`;
  }

  /** Unique item ids in the bag, in slot order — the same order both the footer
   *  detail and the ITEM row list read from, so hovering row N always describes
   *  the item row N will act on. */
  private bagItemIds(): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const slot of gameState.backpack.slots) {
      if (slot && slot.kind === 'item' && !seen.has(slot.itemId)) {
        seen.add(slot.itemId);
        ids.push(slot.itemId);
      }
    }
    return ids;
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
      const actor = this.turnOrder[this.currentTurnIndex];
      const ids = actor ? this.magicAbilityIds(actor) : [];
      const id = ids[this.subRowIndex];
      return id ? getAbility(id).description : '';
    }
    if (this.subOpen === 'ITEM') {
      const ids = this.bagItemIds();
      const id = ids[this.subRowIndex];
      return id ? getItem(id).description : 'The bag holds no usable items.';
    }
    return ROOT_DETAIL[this.cmdIndex] ?? '';
  }

  private buildCommandPanel(actor: CombatCreature | undefined): CommandPanelView {
    if (this.pendingAllyAction && actor) {
      const name = this.pendingAllyAction.kind === 'ability'
        ? getAbility(this.pendingAllyAction.abilityId).name
        : getItem(this.pendingAllyAction.itemId).name;
      const disabledRoot: RootCommandSpec[] = ROOT_LABELS.map(label => ({
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
        rootCommands: ROOT_LABELS.map(label => ({
          label, selected: false, disabled: true, onHover: () => {}, onClick: () => {},
        })),
        subRows: [],
        interactive: false,
      };
    }

    if (this.subOpen === 'MAGIC') {
      const abilityIds = this.magicAbilityIds(actor);
      const rows: SubRowSpec[] = abilityIds.map((id, i) => {
        const ability = getAbility(id);
        const canUse = actor.currentMp >= ability.mpCost;
        return {
          label: ability.name.toUpperCase(),
          meta: ability.power > 0 ? `MP${ability.mpCost} · POW${ability.power}` : `MP${ability.mpCost}`,
          selected: i === this.subRowIndex,
          disabled: !canUse,
          onHover: () => { this.subRowIndex = i; this.redraw(); },
          onClick: () => { this.subRowIndex = i; this.chooseAbility(actor, id); },
        };
      });
      while (rows.length < 4) rows.push(emptyRow());
      return {
        headline: `MAGIC — ${actor.template.name.toUpperCase()}  ·  MP ${actor.currentMp}/${actor.maxMp}`,
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
      const entries = this.bagItemIds().map(id => [id, counts.get(id)!] as const);
      const rows: SubRowSpec[] = entries.slice(0, 4).map(([itemId, count], i) => {
        const def = getItem(itemId);
        return {
          label: def.name.toUpperCase(),
          meta: `×${count}`,
          selected: i === this.subRowIndex,
          disabled: false,
          onHover: () => { this.subRowIndex = i; this.redraw(); },
          onClick: () => { this.subRowIndex = i; this.selectItem(itemId); },
        };
      });
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

    const rootCommands: RootCommandSpec[] = ROOT_LABELS.map((label, i) => ({
      label,
      selected: i === this.cmdIndex,
      disabled: i === 3, // RUN — no escape mechanic mid-battle
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
    this.destroyAll();

    const actor = this.turnOrder[this.currentTurnIndex];
    const aliveEnemies = this.enemyParty.filter(e => !e.isKnockedOut);
    if (this.currentTarget && this.currentTarget.isKnockedOut) this.currentTarget = null;
    if (!this.currentTarget && aliveEnemies.length > 0) this.currentTarget = aliveEnemies[0];

    const turnOrderChips: ChipSpec[] = this.turnOrder.slice(this.currentTurnIndex, this.currentTurnIndex + 6).map(c => ({
      label: c.template.name.toUpperCase(),
      color: c.isPlayerOwned ? UI.hi : UI.mutedBright,
      border: c.isPlayerOwned ? UI.gold : UI.line,
      bg: c.isPlayerOwned ? UI.plate : UI.void,
    }));

    const command = this.buildCommandPanel(actor);
    const footerDetail = this.computeFooterDetail();
    const footerTarget = this.currentTarget
      ? `TARGET — ${this.currentTarget.template.name.toUpperCase()} ${this.currentTarget.currentHp}/${this.currentTarget.maxHp}`
      : '';

    const enemyInteractive = this.phase === BattlePhase.PLAYER_CHOOSING && !this.pendingAllyAction
      && !!actor?.isPlayerOwned;
    const allyInteractive = this.phase === BattlePhase.PLAYER_TARGETING && !!this.pendingAllyAction;

    renderBattlefield(this, {
      floorLabel: this.floorLabel(),
      round: this.roundNumber,
      turnOrderChips,
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      currentActor: actor,
      currentTarget: this.currentTarget,
      enemyInteractive,
      onEnemyHover: (enemy) => { this.currentTarget = enemy; this.redraw(); },
      onEnemyClick: (enemy) => { this.currentTarget = enemy; this.redraw(); },
      allyInteractive,
      onAllyHover: () => {},
      onAllyClick: (ally) => {
        if (!this.pendingAllyAction) return;
        const caster = this.turnOrder[this.currentTurnIndex];
        const action = this.pendingAllyAction;
        this.pendingAllyAction = null;
        if (!caster) return;
        if (action.kind === 'ability') {
          this.executePlayerAction(caster, action.abilityId, ally);
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
    if (!CombatScene.HUD_ACTIVE_PHASES.has(this.phase)) return;
    const run = gameState.currentRun!;

    const autoOn = run.autoCombat;
    const autoBg = this.add.rectangle(880, 117, 90, 20, autoOn ? 0x224422 : UI.panel, 0.96)
      .setStrokeStyle(2, autoOn ? 0x66cc66 : UI.line).setInteractive({ useHandCursor: true });
    this.add.text(880, 117, autoOn ? 'AUTO: ON' : 'AUTO: OFF', {
      fontFamily: BODY_FONT, fontSize: '9px', color: autoOn ? '#bbffbb' : UI.muted,
    }).setOrigin(0.5);
    autoBg.on('pointerdown', () => this.toggleAuto());

    const speed = gameState.battleSpeed;
    const speedBg = this.add.rectangle(880, 142, 90, 20, UI.panel, 0.96)
      .setStrokeStyle(2, UI.line).setInteractive({ useHandCursor: true });
    this.add.text(880, 142, `SPEED ${speed}x`, {
      fontFamily: BODY_FONT, fontSize: '9px', color: UI.mutedBright,
    }).setOrigin(0.5);
    speedBg.on('pointerdown', () => this.cycleSpeed());
  }

  private toggleAuto(): void {
    const run = gameState.currentRun!;
    run.autoCombat = !run.autoCombat;
    // NOTE: intentionally not calling gameState.saveToLocalStorage() here.
    // autoCombat lives on RunState (gameState.currentRun), and currentRun is
    // not part of the serialized save — this toggle is never persisted by
    // this call regardless, so the call would just be a no-op flush of
    // unrelated state.
    const current = this.turnOrder[this.currentTurnIndex];
    if (run.autoCombat
      && (this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING)
      && current?.isPlayerOwned
      && current.instance.tactic !== 'follow_orders') {
      this.pendingAllyAction = null;
      this.phase = BattlePhase.EXECUTING;
      this.redraw();
      this.time.delayedCall(scaledDelay(COMBAT_DELAY_AUTO_THINK, gameState.battleSpeed), () => this.executeAutoTurn(current));
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
    const current = this.turnOrder[this.currentTurnIndex];
    if ((this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING) && current) {
      this.openRootMenu();
    } else {
      this.redraw();
    }
  }

  private addMessage(msg: string): void {
    this.messageLog.push(msg);
    if (this.messageLog.length > 20) this.messageLog.shift();
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
