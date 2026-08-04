import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { getAbility } from '../data/abilities';
import { getItem } from '../data/items';
import {
  CombatCreature, CombatAction, BattlePhase, Encounter, CreatureInstance, bandForFloor,
  generateId, STAR_LEVEL_CAPS, TacticId, COMBAT_DELAY_AUTO_THINK,
  scaledDelay, COMBAT_DELAY_ACTION, COMBAT_DELAY_TURN_END, COMBAT_DELAY_STATUS_SKIP,
} from '../types';
import {
  calculateDamage, applyDamage,
  applyAbilityEffects, tickStatusEffects, isSkipTurn,
  createCombatCreature, resolveNonDamagingAbility,
} from '../systems/CombatEngine';
import { getEnemyAction, chooseAction } from '../systems/TacticsAI';
import { obolsForEncounter } from '../systems/Economy';
import {
  damageDealtMultiplier, damageTakenMultiplier, obolMultiplier,
  postVictoryHealFraction, tickAfterBattle,
  effectiveMaxHp,
} from '../systems/Boons';
import { usedSlots, removeAt } from '../systems/Backpack';
import { applyItemInCombat, canUseItem } from '../systems/Items';
import {
  RiteLogBook, newLogBook, recordDamageTypeUsed, recordDamageTaken, recordStrike,
  recordItemUsed, recordEffectOutcome, snapshotEffects, recordActed, recordRoundSurvived,
} from '../systems/RiteRecorder';
import {
  PackTempoState, beginTempoRound, canSpendRelay, createPackTempoState,
  generateTempo, relayCandidates, relayTimeline, spendRelay, tempoReasonForAction,
} from '../systems/PackTempo';
import {
  BattleChamberContext, sharedActionAbilityCost,
} from '../systems/BattleChamber';
import {
  SharedActionPoolState, beginSharedActionRound, createSharedActionPool,
  spendSharedActions,
} from '../systems/SharedActionPool';
import { chooseSharedAction } from '../systems/SharedActionAI';
import { createSeededRandom, RandomSource } from '../systems/SeededRandom';
import { buildTurnSlots, createExtraTurnSlot, TurnSlot } from '../systems/TurnTimeline';
import {
  LinkArtRecipe, LinkChainState, createLinkChainState, interruptLink, linkSignature,
  previewLinkArt, recordLinkedMove,
} from '../systems/LinkArts';
import {
  renderBattlefield, ChipSpec, CommandPanelView, RootCommandSpec, SubRowSpec,
} from './combat/BattlefieldRenderer';
import { UI, BODY_FONT } from '../ui/Theme';

/** Root menu. Escaping a battle is an ITEM (Smoke Husk), not a menu verb. */
const ROOT_COMMAND_COUNT = 4;

function emptyRow(): SubRowSpec {
  return { label: '', meta: '', selected: false, disabled: true, onHover: () => {}, onClick: () => {} };
}

interface AbilityResolution {
  landed: boolean;
  conditionalCritical: boolean;
  exploitedWeakness: boolean;
}

interface TempoMetrics {
  generated: number;
  spent: number;
  wastedAtCap: number;
  relays: number;
  actionPointsSpent: number;
  spentOnRelay: number;
  playerActions: number;
  enemyActions: number;
  packFirstRounds: number;
  initiativeRounds: number;
  relayHeldRounds: number;
  linkArtsCompleted: number;
  linksInterrupted: number;
  relayEnabledLinks: number;
  extraTurnsGranted: number;
}

function newTempoMetrics(): TempoMetrics {
  return {
    generated: 0, spent: 0, wastedAtCap: 0, relays: 0,
    actionPointsSpent: 0, spentOnRelay: 0,
    playerActions: 0, enemyActions: 0,
    packFirstRounds: 0, initiativeRounds: 0,
    relayHeldRounds: 0, linkArtsCompleted: 0, linksInterrupted: 0,
    relayEnabledLinks: 0, extraTurnsGranted: 0,
  };
}

export class CombatScene extends Phaser.Scene {
  private playerParty: CombatCreature[] = [];
  private enemyParty: CombatCreature[] = [];
  private turnOrder: TurnSlot[] = [];
  private currentTurnIndex = 0;
  private phase: BattlePhase = BattlePhase.STARTING;
  private encounter!: Encounter;
  private messageLog: string[] = [];
  private enemyIntents = new Map<string, CombatAction>();
  private packTempo: PackTempoState = createPackTempoState();
  private sharedActions: SharedActionPoolState = createSharedActionPool();
  private linkChain: LinkChainState = createLinkChainState();
  private activeLinkArt: LinkArtRecipe | null = null;
  private tempoMetrics: TempoMetrics = newTempoMetrics();
  private chamberContext: BattleChamberContext | null = null;
  private rng: RandomSource = Math.random;

  /** A Relay is chosen before acting and paid only after that action resolves. */
  private queuedRelayTargetSlotId: string | null = null;
  private relayedSlotIds = new Set<string>();
  private encoreUsedThisRound = false;
  private roundSawPlayer = false;
  private roundSawEnemy = false;
  private roundEnemyBeforePendingPlayer = false;
  private roundMetricsFinalized = false;

  /** Presentation-only state for the new command panel / targeting UI. */
  private roundNumber = 1;
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

  /**
   * Per-enemy rite record for this battle, and which player creatures have acted.
   * Both feed capture pricing (see RiteRecorder). Discarded with the battle —
   * nothing here is persisted, because runs are not saved mid-fight.
   */
  private riteLogs: RiteLogBook = new Map();
  private actedPlayerIds = new Set<string>();

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

  init(data: { encounter: Encounter; chamber?: BattleChamberContext }): void {
    this.encounter = data.encounter;
    this.chamberContext = data.chamber ?? null;
    this.rng = this.chamberContext
      ? createSeededRandom(this.chamberContext.seed)
      : Math.random;
    this.playerParty = [];
    this.enemyParty = [];
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.messageLog = [];
    this.enemyIntents.clear();
    this.packTempo = createPackTempoState();
    if (this.chamberContext?.initialTempoPoints) {
      this.packTempo = {
        ...this.packTempo,
        points: Math.min(
          this.packTempo.cap,
          Math.max(0, Math.floor(this.chamberContext.initialTempoPoints)),
        ),
      };
    }
    this.sharedActions = createSharedActionPool();
    this.linkChain = createLinkChainState();
    this.activeLinkArt = null;
    this.tempoMetrics = newTempoMetrics();
    this.queuedRelayTargetSlotId = null;
    this.relayedSlotIds = new Set();
    this.encoreUsedThisRound = false;
    this.roundSawPlayer = false;
    this.roundSawEnemy = false;
    this.roundEnemyBeforePendingPlayer = false;
    this.roundMetricsFinalized = false;
    this.roundNumber = 1;
    this.currentTarget = null;
    this.cmdIndex = 0;
    this.subOpen = null;
    this.subRowIndex = 0;
    this.pendingAllyAction = null;
    this.itemPage = 0;
    this.riteLogs = new Map();
    this.actedPlayerIds = new Set();
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
        effectiveMaxHp(creature.currentStats.hp, run.activeBoons),
      ));
    }

    // Enemy party
    const enemyIds = this.encounter.enemies ?? [];
    const enemyLevel = this.encounter.enemyLevels ?? 1;
    for (let enemyIndex = 0; enemyIndex < enemyIds.length; enemyIndex++) {
      const speciesId = enemyIds[enemyIndex];
      const template = getTemplate(speciesId);
      const enemyInstance: CreatureInstance = {
        instanceId: this.chamberContext
          ? `chamber-${this.chamberContext.presetId}-enemy-${enemyIndex}`
          : generateId(),
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

    // One rite log per enemy, opened after the party is built so every enemy has one.
    this.riteLogs = newLogBook(this.enemyParty);
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
      // A completed round is one every surviving enemy endured.
      if (this.turnOrder.length > 0) {
        recordRoundSurvived(this.riteLogs, this.enemyParty);
        this.finalizeInitiativeRound();
        if (canSpendRelay(this.packTempo)) this.tempoMetrics.relayHeldRounds++;
      }
      if (this.turnOrder.length > 0) this.roundNumber++; // not on the very first computation
      const bossExtraActorIds = this.chamberContext?.bossDoubleAction
        ? new Set(this.enemyParty.filter(enemy => !enemy.isKnockedOut).slice(0, 1)
          .map(enemy => enemy.instance.instanceId))
        : undefined;
      this.turnOrder = buildTurnSlots(
        [...this.playerParty, ...this.enemyParty],
        this.roundNumber,
        { bossExtraActorIds },
      );
      this.currentTurnIndex = 0;
      this.packTempo = beginTempoRound(this.packTempo);
      this.linkChain = createLinkChainState();
      this.activeLinkArt = null;
      this.encoreUsedThisRound = false;
      if (this.usesSharedActions()) {
        this.sharedActions = beginSharedActionRound(this.sharedActions);
      }
      this.beginInitiativeRound();
      this.commitEnemyIntents();
    }

    const currentSlot = this.turnOrder[this.currentTurnIndex];
    const current = currentSlot?.actor;
    if (!currentSlot || !current || current.isKnockedOut) {
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
      this.recordTimelineTurn(current, false);
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

  /** Lock an exact move and target for every enemy action slot before the round begins. */
  private commitEnemyIntents(): void {
    this.enemyIntents.clear();
    const committedAbilityByActor = new Map<string, string>();
    for (const slot of this.turnOrder) {
      const enemy = slot.actor;
      if (enemy.isPlayerOwned) continue;
      if (enemy.isKnockedOut) continue;
      let action = getEnemyAction(enemy, this.playerParty, this.rng);
      const previousAbility = committedAbilityByActor.get(enemy.instance.instanceId);
      if (slot.source === 'boss_extra' && action.abilityId === previousAbility) {
        const alternateId = enemy.instance.abilities.find((id): id is string => {
          if (!id || id === previousAbility) return false;
          return getAbility(id).mpCost <= enemy.currentMp;
        });
        if (alternateId) {
          const alternate = getAbility(alternateId);
          const target = alternate.targeting === 'self'
            || alternate.targeting === 'single_ally'
            || alternate.targeting === 'all_allies'
            ? enemy
            : this.playerParty.find(kin => !kin.isKnockedOut) ?? this.playerParty[0];
          if (target) action = { abilityId: alternateId, target };
        }
      }
      this.enemyIntents.set(slot.slotId, { kind: 'ability', ...action });
      committedAbilityByActor.set(enemy.instance.instanceId, action.abilityId);
    }
  }

  private beginInitiativeRound(): void {
    this.roundSawPlayer = false;
    this.roundSawEnemy = false;
    this.roundEnemyBeforePendingPlayer = false;
    this.roundMetricsFinalized = false;
  }

  /** Record timeline order separately from actual actions so status skips still count for initiative. */
  private recordTimelineTurn(creature: CombatCreature, acted: boolean): void {
    if (creature.isPlayerOwned) {
      this.roundSawPlayer = true;
      if (acted) this.tempoMetrics.playerActions++;
      return;
    }

    this.roundSawEnemy = true;
    if (acted) this.tempoMetrics.enemyActions++;
    if (this.turnOrder.slice(this.currentTurnIndex + 1).some(
      later => later.actor.isPlayerOwned && !later.actor.isKnockedOut,
    )) {
      this.roundEnemyBeforePendingPlayer = true;
    }
  }

  private finalizeInitiativeRound(): void {
    if (this.roundMetricsFinalized) return;
    this.roundMetricsFinalized = true;
    if (!this.roundSawPlayer || !this.roundSawEnemy) return;
    this.tempoMetrics.initiativeRounds++;
    if (!this.roundEnemyBeforePendingPlayer) this.tempoMetrics.packFirstRounds++;
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

  private usesSharedActions(): boolean {
    return this.chamberContext?.resourceModel === 'shared_actions';
  }

  private playerKnownSpecies(): ReadonlySet<string> {
    if (!this.chamberContext?.revealWeaknesses) return gameState.seenSpecies;
    return new Set(this.enemyParty.map(enemy => enemy.instance.speciesId));
  }

  private isWeakness(
    ability: ReturnType<typeof getAbility>,
    target: CombatCreature | null,
  ): boolean {
    return !!target
      && ability.damageType !== 'None'
      && target.instance.weaknesses.includes(ability.damageType);
  }

  private isKnownWeakness(
    ability: ReturnType<typeof getAbility>,
    target: CombatCreature | null,
  ): boolean {
    return !!target
      && this.isWeakness(ability, target)
      && (this.chamberContext?.revealWeaknesses
        || gameState.seenSpecies.has(target.instance.speciesId));
  }

  private rootLabels(): string[] {
    const queuedSlot = this.turnOrder.find(slot => slot.slotId === this.queuedRelayTargetSlotId);
    const relay = queuedSlot
      ? `RELAY → ${queuedSlot.actor.template.name.toUpperCase()}`
      : 'RELAY';
    return this.usesSharedActions()
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
      this.usesSharedActions()
        ? 'BASIC — costs 0 AP. Tempo comes from authored combat accomplishments.'
        : 'FIGHT — costs 0 MP. Tempo comes from authored combat accomplishments.',
      this.usesSharedActions()
        ? 'MOVES — spend shared Action Points on learned actions; FIGHT is always free.'
        : 'MAGIC — spend this Kin\'s MP on a move.',
      'ITEM — use something from the shared bag.',
      relay,
    ];
  }

  private canQueueRelay(): boolean {
    return canSpendRelay(this.packTempo)
      && this.relayCandidatesForCurrentTurn().length > 0;
  }

  private playerAbilityCost(abilityId: string): number {
    return this.usesSharedActions() ? sharedActionAbilityCost(getAbility(abilityId)) : getAbility(abilityId).mpCost;
  }

  private canPayPlayerAbility(actor: CombatCreature, abilityId: string): boolean {
    const cost = this.playerAbilityCost(abilityId);
    return this.usesSharedActions()
      ? this.sharedActions.points >= cost
      : actor.currentMp >= cost;
  }

  private payPlayerAbility(actor: CombatCreature, abilityId: string): boolean {
    const cost = this.playerAbilityCost(abilityId);
    if (!this.canPayPlayerAbility(actor, abilityId)) return false;
    if (!this.usesSharedActions()) {
      actor.currentMp -= cost;
      return true;
    }
    const spent = spendSharedActions(this.sharedActions, cost);
    if (!spent) return false;
    this.sharedActions = spent;
    this.tempoMetrics.actionPointsSpent += cost;
    return true;
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
    const ability = getAbility(abilityId);
    if (!this.payPlayerAbility(attacker, abilityId)) {
      this.addMessage(this.usesSharedActions()
        ? `${ability.name} needs more shared Action Points.`
        : `${attacker.template.name} does not have enough MP for ${ability.name}.`);
      this.openRootMenu();
      return;
    }
    this.phase = BattlePhase.EXECUTING;

    const signature = this.chamberContext?.linkArts
      ? linkSignature(ability, attacker.instance.instanceId)
      : null;
    const linkArt = previewLinkArt(this.linkChain, signature);
    this.activeLinkArt = linkArt;

    const resolutions: AbilityResolution[] = [];
    if (ability.targeting === 'all_enemies') {
      for (const enemy of this.enemyParty.filter(e => !e.isKnockedOut)) {
        resolutions.push(this.resolveAbility(attacker, enemy, ability));
      }
    } else if (ability.targeting === 'self') {
      resolutions.push(this.resolveAbility(attacker, attacker, ability));
    } else {
      resolutions.push(this.resolveAbility(attacker, target, ability));
    }
    this.generateTempoFromAction(attacker, resolutions);
    if (this.chamberContext?.linkArts) {
      if (linkArt) {
        this.tempoMetrics.linkArtsCompleted++;
        const slotId = this.turnOrder[this.currentTurnIndex]?.slotId;
        if (slotId && this.relayedSlotIds.has(slotId)) this.tempoMetrics.relayEnabledLinks++;
        this.addMessage(`LINK ART — ${linkArt.name}! ${linkArt.effect}`);
      }
      this.linkChain = recordLinkedMove(this.linkChain, signature, linkArt);
    }
    this.activeLinkArt = null;

    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed), () => this.finishTurn(attacker));
  }

  /** Selecting an ITEM row — routes to the picker (or auto-target) its `targeting` calls for. */
  private selectItem(itemId: string): void {
    const slotIndex = gameState.backpack.slots.findIndex(
      s => s !== null && s.kind === 'item' && s.itemId === itemId);
    if (slotIndex === -1) return;
    const def = getItem(itemId);

    if (def.targeting === 'none') {
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
    const actor = this.turnOrder[this.currentTurnIndex]?.actor;
    if (!actor) return;
    const def = getItem(itemId);
    const ctx = { where: 'combat' as const, isBoss: this.encounter.type === 'boss' };
    const outcome = applyItemInCombat(def, target, ctx);

    // A 'depart' outcome cannot occur here today — applyItemInCombat maps the depart
    // effect to 'refused', and this method never calls applyItemOnMap. The case exists
    // to close a narrowing gap across the function boundary, and it is grouped with
    // 'refused' deliberately: if a future refactor ever did route depart through combat,
    // refusing costs the player nothing, whereas handling it after consumption would
    // silently eat the item and stall the turn with no message and no finishTurn.
    if (outcome.kind === 'refused' || outcome.kind === 'depart') {
      // Nothing consumed and nothing spent — hand the turn back rather than
      // burning it on a mistake. Same rule tryBuyItem follows for payment.
      this.addMessage(outcome.kind === 'refused' ? outcome.reason : `${def.name} cannot be used here.`);
      this.pendingAllyAction = null;
      this.phase = BattlePhase.PLAYER_CHOOSING;
      this.redraw();
      return;
    }

    this.phase = BattlePhase.EXECUTING;
    if (this.chamberContext?.linkArts) this.linkChain = createLinkChainState();
    this.pendingAllyAction = null;
    // Recorded here, past the refused/depart guard above, so only an item that was
    // really consumed counts toward the Fauna and Food rites.
    recordItemUsed(this.riteLogs, target);
    gameState.backpack = removeAt(gameState.backpack, slotIndex);
    gameState.saveToLocalStorage();

    if (outcome.kind === 'escape_battle') {
      // Free action: escapeBattle() never calls finishTurn(), so the turn is
      // never passed and no enemy acts in response. The delay is for readability.
      this.addMessage(`${actor.template.name} broke the ${def.name}!`);
      this.redraw();
      this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
        () => this.escapeBattle());
      return;
    }

    this.addMessage(`${actor.template.name} used ${def.name} — ${outcome.message}`);
    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
      () => this.finishTurn(actor));
  }

  /**
   * Leave a fight at once, with nothing to show for it.
   *
   * A free action by design: the battle ends the instant the husk breaks, so no
   * enemy acts in response. It is still only reachable on a player turn, because
   * that is the only time the ITEM menu exists — so no change to the turn loop is
   * needed to make it "free".
   *
   * Deliberately does NOT call showBattleEnd(): that records every enemy species
   * into the knowledge fog, and a no-cost escape that did so would turn this item
   * into free reconnaissance ("enter, read them, leave, come back informed").
   * Forfeiting the encounter must also forfeit what you learned in it.
   *
   * No Obols and no XP are awarded, and `recordBreakCleared` is never reached —
   * `usableIn: 'combat_non_boss'` keeps this off boss floors entirely, so an
   * escape can never bank a break the party did not earn.
   */
  private escapeBattle(): void {
    this.destroyAll();
    const run = gameState.currentRun!;
    // A Smoke Husk escape spent a battle even though it paid nothing. Not
    // counting it would quietly make the husk a duration-extender for boons.
    run.activeBoons = tickAfterBattle(run.activeBoons);
    this.savePartyState(run);
    gameState.saveToLocalStorage();
    this.scene.start('RunScene', { continueRun: true });
  }

  private executeAutoTurn(creature: CombatCreature): void {
    this.queueAutoRelayIfUseful();
    // tactic is narrowed to TacticProfile — 'follow_orders' never reaches here.
    const profile = creature.instance.tactic as Exclude<TacticId, 'follow_orders'>;
    const chosen = this.usesSharedActions()
      ? chooseSharedAction(
        creature,
        this.playerParty,
        this.enemyParty,
        this.sharedActions.points,
        this.playerKnownSpecies(),
      )
      : chooseAction(
        creature,
        this.playerParty,
        this.enemyParty,
        profile,
        this.playerKnownSpecies(),
        this.rng,
      );
    const action = this.legalizeSharedActionAutoAction(creature, chosen);

    // null means no legal move — every foe is already down, so the battle is
    // ending anyway. End the turn rather than inventing an action.
    if (action === null) {
      this.finishTurn(creature);
      return;
    }
    this.executePlayerAction(creature, action.abilityId, action.target);
  }

  private queueAutoRelayIfUseful(): void {
    this.queuedRelayTargetSlotId = null;
    if (!canSpendRelay(this.packTempo)) return;
    const next = this.turnOrder[this.currentTurnIndex + 1]?.actor;
    const candidate = this.relayCandidatesForCurrentTurn()[0];
    if (next && !next.isPlayerOwned && candidate) {
      this.queuedRelayTargetSlotId = candidate.slotId;
    }
  }

  private legalizeSharedActionAutoAction(
    creature: CombatCreature,
    chosen: { abilityId: string; target: CombatCreature } | null,
  ): { abilityId: string; target: CombatCreature } | null {
    if (!this.usesSharedActions() || !chosen || this.canPayPlayerAbility(creature, chosen.abilityId)) {
      return chosen;
    }

    const livingEnemies = this.enemyParty.filter(enemy => !enemy.isKnockedOut);
    const livingAllies = this.playerParty.filter(ally => !ally.isKnockedOut);
    const fallbackIds = [
      ...this.magicAbilityIds(creature).filter(id => getAbility(id).tempoGeneration === 'on_hit'),
      ...this.magicAbilityIds(creature),
      'basic_attack',
    ];
    for (const abilityId of [...new Set(fallbackIds)]) {
      if (!this.canPayPlayerAbility(creature, abilityId)) continue;
      const ability = getAbility(abilityId);
      const target = ability.targeting === 'self' || ability.targeting === 'all_allies'
        ? creature
        : ability.targeting === 'single_ally'
          ? livingAllies[0]
          : livingEnemies[0];
      if (target) return { abilityId, target };
    }
    return null;
  }

  private executeEnemyTurn(enemy: CombatCreature): void {
    const currentSlot = this.turnOrder[this.currentTurnIndex];
    const intent = currentSlot ? this.enemyIntents.get(currentSlot.slotId) : null;
    if (!intent) {
      this.addMessage(`${enemy.template.name} has no committed action.`);
      this.finishTurn(enemy);
      return;
    }
    if (this.chamberContext?.linkArts && this.linkChain.moves.length > 0) {
      this.linkChain = interruptLink(this.linkChain, enemy.template.name);
      this.tempoMetrics.linksInterrupted++;
      this.addMessage(`${enemy.template.name} broke the Link!`);
    }
    const { abilityId, target } = intent;
    const ability = getAbility(abilityId);

    if (ability.targeting === 'single_enemy' && target.isKnockedOut) {
      this.addMessage(`${enemy.template.name}'s ${ability.name} fizzled — ${target.template.name} was already down.`);
      this.redraw();
      this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed), () => this.finishTurn(enemy));
      return;
    }

    enemy.currentMp -= ability.mpCost;

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
  ): AbilityResolution {
    if (ability.power > 0) {
      const result = calculateDamage(attacker, target, ability, this.rng);
      if (result.missed) {
        this.addMessage(`${attacker.template.name} used ${ability.name} — MISS!`);
        return { landed: false, conditionalCritical: false, exploitedWeakness: false };
      }

      // Boons are the player's. `damageDealt` applies only when one of the
      // player's kin is swinging; `damageTaken` only when one of them is being
      // hit. resolveAbility runs for enemy turns as well, so keying on ownership
      // rather than assuming the player is what keeps an enemy from riding the
      // player's War Chorus.
      const boons = gameState.currentRun?.activeBoons ?? [];
      const dealt = attacker.isPlayerOwned ? damageDealtMultiplier(boons) : 1;
      const taken = target.isPlayerOwned ? damageTakenMultiplier(boons, this.roundNumber) : 1;
      const linkMultiplier = attacker.isPlayerOwned
        ? this.activeLinkArt?.damageMultiplier ?? 1
        : 1;
      const damage = Math.max(1, Math.round(result.damage * dealt * taken * linkMultiplier));

      // Rite record: the struck creature's stages must be read now — this ability's
      // own effects may debuff them a line later, and after that the fact is gone.
      recordStrike(this.riteLogs, attacker, target);
      recordDamageTypeUsed(this.riteLogs, ability);
      recordDamageTaken(this.riteLogs, target, ability);

      applyDamage(target, damage);
      let msg = `${attacker.template.name} used ${ability.name} → ${damage} dmg to ${target.template.name}`;
      if (result.isCrit) msg += ' CRIT!';
      this.addMessage(msg);

      // Apply secondary effects
      const beforeEffects = snapshotEffects(target);
      const effectMsgs = applyAbilityEffects(ability, attacker, target, damage, this.rng);
      effectMsgs.forEach(m => this.addMessage(m));
      recordEffectOutcome(this.riteLogs, target, beforeEffects);
      return {
        landed: true,
        conditionalCritical: result.isCrit,
        exploitedWeakness: this.isWeakness(ability, target),
      };
    } else {
      // Status/buff move
      const beforeEffects = snapshotEffects(target);
      const result = resolveNonDamagingAbility(ability, attacker, target, this.rng);
      if (result.missed) {
        this.addMessage(`${attacker.template.name} used ${ability.name} — MISS!`);
        return { landed: false, conditionalCritical: false, exploitedWeakness: false };
      }
      this.addMessage(`${attacker.template.name} used ${ability.name}!`);
      result.messages.forEach(m => this.addMessage(m));
      recordEffectOutcome(this.riteLogs, target, beforeEffects);
      return { landed: true, conditionalCritical: false, exploitedWeakness: false };
    }
  }

  private generateTempoFromAction(
    attacker: CombatCreature,
    resolutions: AbilityResolution[],
  ): void {
    if (!attacker.isPlayerOwned || !resolutions.some(result => result.landed)) return;

    const reason = tempoReasonForAction(resolutions);
    if (!reason) return;

    const actionId = this.turnOrder[this.currentTurnIndex]?.slotId
      ?? `${this.roundNumber}:${attacker.instance.instanceId}:${this.currentTurnIndex}`;
    const result = generateTempo(this.packTempo, actionId, reason);
    this.packTempo = result.state;
    if (result.granted > 0) {
      this.tempoMetrics.generated += result.granted;
      this.addMessage(`Pack Tempo +${result.granted} — ${attacker.template.name} exploited a weakness.`);
    } else if (result.wastedAtCap > 0) {
      this.tempoMetrics.wastedAtCap += result.wastedAtCap;
    }
  }

  private finishTurn(creature: CombatCreature): void {
    // Rite record: reached only once a creature has actually taken its action, so a
    // status-skipped turn (which bypasses finishTurn) correctly does not count.
    if (creature.isPlayerOwned) this.actedPlayerIds.add(creature.instance.instanceId);
    else recordActed(this.riteLogs, creature);
    this.recordTimelineTurn(creature, true);

    // Tick status effects
    const msgs = tickStatusEffects(creature);
    msgs.forEach(m => this.addMessage(m));

    if (creature.isPlayerOwned && this.queuedRelayTargetSlotId
      && !this.enemyParty.every(enemy => enemy.isKnockedOut)) {
      const target = this.relayCandidatesForCurrentTurn().find(
        slot => slot.slotId === this.queuedRelayTargetSlotId,
      );
      if (target && this.performRelay(target)) return;
    }

    this.advanceAfterTurn();
  }

  private relayCandidatesForCurrentTurn(): TurnSlot[] {
    const ordinary = relayCandidates(
      this.turnOrder,
      this.currentTurnIndex,
      slot => slot.slotId,
      slot => slot.actor.isPlayerOwned && !slot.actor.isKnockedOut,
    );
    if (!this.chamberContext?.encoreRelay || this.encoreUsedThisRound) return ordinary;

    const acted = new Map<string, CombatCreature>();
    for (const slot of this.turnOrder.slice(0, this.currentTurnIndex + 1)) {
      if (slot.actor.isPlayerOwned && !slot.actor.isKnockedOut) {
        acted.set(slot.actor.instance.instanceId, slot.actor);
      }
    }
    const extras = [...acted.values()].map(actor => createExtraTurnSlot(actor, this.roundNumber));
    return [...ordinary, ...extras];
  }

  private performRelay(target: TurnSlot): boolean {
    const isExtra = target.source === 'relic_extra';
    const reordered = isExtra
      ? [
        ...this.turnOrder.slice(0, this.currentTurnIndex + 1),
        target,
        ...this.turnOrder.slice(this.currentTurnIndex + 1),
      ]
      : relayTimeline(
        this.turnOrder,
        this.currentTurnIndex,
        target.slotId,
        slot => slot.slotId,
      );
    const spent = spendRelay(this.packTempo);
    if (!reordered || !spent || target.actor.isKnockedOut || !target.actor.isPlayerOwned) return false;

    this.turnOrder = reordered;
    this.packTempo = spent;
    this.relayedSlotIds.add(target.slotId);
    if (isExtra) {
      this.encoreUsedThisRound = true;
      this.tempoMetrics.extraTurnsGranted++;
    }
    this.tempoMetrics.spent += 3;
    this.tempoMetrics.spentOnRelay += 3;
    this.tempoMetrics.relays++;
    this.addMessage(`Relay! ${target.actor.template.name} ${isExtra ? 'acts again' : 'moves next'}. Tempo -3.`);
    this.advanceAfterTurn();
    return true;
  }

  private advanceAfterTurn(): void {
    this.queuedRelayTargetSlotId = null;
    this.currentTurnIndex++;
    this.redraw();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_TURN_END, gameState.battleSpeed), () => this.nextTurn());
  }

  private showBattleEnd(victory: boolean): void {
    this.finalizeInitiativeRound();
    // Every game object this scene has drawn — including whatever HUD/menu
    // hotspots were interactive a moment ago — gets destroyed (not just
    // detached) here, before we hand off via scene.start(). See destroyAll().
    this.destroyAll();

    if (this.chamberContext) {
      gameState.currentRun = null;
      const result = {
        presetId: this.chamberContext.presetId,
        resourceModel: this.chamberContext.resourceModel,
        outcome: victory ? 'victory' as const : 'defeat' as const,
        rounds: this.roundNumber,
        tempoGenerated: this.tempoMetrics.generated,
        tempoSpent: this.tempoMetrics.spent,
        tempoWasted: this.tempoMetrics.wastedAtCap,
        relays: this.tempoMetrics.relays,
        actionPointsSpent: this.tempoMetrics.actionPointsSpent,
        tempoSpentOnRelay: this.tempoMetrics.spentOnRelay,
        playerActions: this.tempoMetrics.playerActions,
        enemyActions: this.tempoMetrics.enemyActions,
        packFirstRounds: this.tempoMetrics.packFirstRounds,
        initiativeRounds: this.tempoMetrics.initiativeRounds,
        relayHeldRounds: this.tempoMetrics.relayHeldRounds,
        linkArtsCompleted: this.tempoMetrics.linkArtsCompleted,
        linksInterrupted: this.tempoMetrics.linksInterrupted,
        relayEnabledLinks: this.tempoMetrics.relayEnabledLinks,
        extraTurnsGranted: this.tempoMetrics.extraTurnsGranted,
      };
      this.scene.start('BattleChamberScene', {
        selectedPresetId: this.chamberContext.presetId,
        resourceModel: this.chamberContext.resourceModel,
        result,
        comparisonResults: {
          ...(this.chamberContext.comparisonResults ?? {}),
          [this.chamberContext.resourceModel]: result,
        },
      });
      return;
    }

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
      const boons = run.activeBoons;
      const obolGain = Math.max(
        1, Math.round(obolsForEncounter(obolKind, this.encounter.floor) * obolMultiplier(boons)),
      );
      run.obols += obolGain;

      if (this.encounter.type === 'boss') {
        gameState.recordBreakCleared(this.encounter.floor);
      }

      let levelUpMsg = '';
      for (const pc of this.playerParty) {
        if (!pc.isKnockedOut) {
          pc.instance.xp += xpPerCreature;
          while (gameState.tryLevelUp(pc.instance)) {
            pc.maxHp = effectiveMaxHp(pc.instance.currentStats.hp, boons);
            pc.maxMp = pc.instance.currentStats.mp;
            pc.currentHp = Math.min(pc.currentHp + 5, pc.maxHp);
            levelUpMsg += `${pc.template.name} → Lv${pc.instance.currentLevel}! `;
          }
        }
      }

      // Post-victory heal, then count every boon down one battle. Both happen
      // here so the ledger the player is about to see already reflects them.
      const healFraction = postVictoryHealFraction(boons);
      if (healFraction > 0) {
        for (const pc of this.playerParty) {
          if (pc.isKnockedOut) continue;
          pc.currentHp = Math.min(pc.maxHp, pc.currentHp + Math.floor(pc.maxHp * healFraction));
        }
      }
      run.activeBoons = tickAfterBattle(boons);

      let storyMessage = '';
      if (this.encounter.storyEventId) {
        gameState.recordStoryEvent(this.encounter.storyEventId);
        storyMessage = this.encounter.storyEventId === 'gary_shortsword'
          ? "Among the fallen lies an engraved shortsword. Gary may recognize it."
          : 'Something recovered here may matter back in town.';
      }

      this.savePartyState(run);
      this.scene.start('PostCombatScene', {
        floor: this.encounter.floor,
        tier: obolKind,
        obolGain,
        xpPerCreature,
        levelUpMessage: levelUpMsg.trim(),
        storyMessage,
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
      const ids = actor ? this.magicAbilityIds(actor) : [];
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
      const candidate = this.relayCandidatesForCurrentTurn()[this.subRowIndex];
      return candidate
        ? `Queue ${candidate.actor.template.name} to ${candidate.source === 'relic_extra' ? 'act again' : 'act next'} after this action. Tempo is paid afterward.`
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
      const abilityIds = this.magicAbilityIds(actor);
      const rows: SubRowSpec[] = abilityIds.map((id, i) => {
        const ability = getAbility(id);
        const link = this.chamberContext?.linkArts
          ? previewLinkArt(this.linkChain, linkSignature(ability, actor.instance.instanceId))
          : null;
        const cost = this.playerAbilityCost(id);
        const canUse = this.canPayPlayerAbility(actor, id);
        const resource = this.usesSharedActions() ? `AP ${cost}` : `MP${cost}`;
        const tempoPreview = this.isKnownWeakness(ability, this.currentTarget)
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
        headline: this.usesSharedActions()
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
      const candidates = this.relayCandidatesForCurrentTurn();
      const rows: SubRowSpec[] = candidates.map((candidate, i) => ({
        label: `QUEUE ${candidate.actor.template.name.toUpperCase()}`,
        meta: candidate.source === 'relic_extra'
          ? 'ENCORE · ACT AGAIN · COST 3'
          : 'ACT NEXT AFTER THIS ACTION · COST 3',
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

    const relayDisabled = !this.canQueueRelay();
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
    this.destroyAll();

    const actor = this.turnOrder[this.currentTurnIndex]?.actor;
    const aliveEnemies = this.enemyParty.filter(e => !e.isKnockedOut);
    if (this.currentTarget && this.currentTarget.isKnockedOut) this.currentTarget = null;
    if (!this.currentTarget && aliveEnemies.length > 0) this.currentTarget = aliveEnemies[0];

    const turnOrderChips: ChipSpec[] = this.turnOrder.slice(this.currentTurnIndex, this.currentTurnIndex + 6).map(slot => ({
      label: `${slot.actor.template.name.toUpperCase()}${slot.source === 'boss_extra' ? ' II' : slot.source === 'relic_extra' ? ' +' : ''}`,
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

    renderBattlefield(this, {
      floorLabel: this.floorLabel(),
      round: this.roundNumber,
      tempo: this.packTempo.points,
      tempoCap: this.packTempo.cap,
      relayReady: canSpendRelay(this.packTempo),
      linkLabel: this.linkChain.moves.length > 0
        ? this.linkChain.moves.map(move => getAbility(move.abilityId).name.toUpperCase()).join(' → ')
        : null,
      usesSharedActions: this.usesSharedActions(),
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
    const current = this.turnOrder[this.currentTurnIndex]?.actor;
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
    const current = this.turnOrder[this.currentTurnIndex]?.actor;
    if ((this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING) && current) {
      this.openRootMenu();
    } else {
      this.redraw();
    }
  }

  /** Deterministic, presentation-free snapshot for browser playtests. */
  combatState(): object {
    return {
      phase: this.phase,
      round: this.roundNumber,
      // Rite record, for QA of capture pricing. Surfaced here rather than logged
      // because the write sites are spread across the turn loop and the only way to
      // tell they all fire is to read the accumulated result mid-battle.
      rites: this.enemyParty.map(enemy => {
        const log = this.riteLogs.get(enemy.instance.instanceId);
        return log ? {
          enemy: enemy.template.name,
          archetype: enemy.template.archetype,
          took: log.damageTypesTaken,
          used: log.damageTypesDealt,
          statuses: log.statusesApplied,
          struck: log.struckStatStages,
          debuffApplied: log.debuffApplied,
          itemOnSelf: log.itemConsumedOnSelf,
          itemOnAlly: log.itemConsumedByAlly,
          acted: log.hasActed,
          roundsSurvived: log.turnsAlive,
        } : null;
      }),
      playersActed: [...this.actedPlayerIds].length,
      chamber: this.chamberContext,
      resourceModel: this.chamberContext?.resourceModel ?? 'individual_mp',
      tempo: { points: this.packTempo.points, cap: this.packTempo.cap },
      actionPool: this.usesSharedActions()
        ? { points: this.sharedActions.points, cap: this.sharedActions.cap }
        : null,
      relayReady: canSpendRelay(this.packTempo),
      queuedRelay: this.queuedRelayTargetSlotId
        ? this.turnOrder.find(slot => slot.slotId === this.queuedRelayTargetSlotId)?.actor.template.name ?? null
        : null,
      link: {
        enabled: !!this.chamberContext?.linkArts,
        chain: this.linkChain.moves.map(move => move.abilityId),
        interruptedBy: this.linkChain.interruptedBy,
      },
      timeline: this.turnOrder.slice(this.currentTurnIndex).map(slot => ({
        slotId: slot.slotId,
        actorId: slot.actor.instance.instanceId,
        name: slot.actor.template.name,
        side: slot.actor.isPlayerOwned ? 'player' : 'enemy',
        source: slot.source,
        hp: slot.actor.currentHp,
        knockedOut: slot.actor.isKnockedOut,
      })),
      intents: this.turnOrder.slice(this.currentTurnIndex)
        .filter(slot => !slot.actor.isPlayerOwned && !slot.actor.isKnockedOut)
        .map(slot => {
        const action = this.enemyIntents.get(slot.slotId);
        const ability = action ? getAbility(action.abilityId) : null;
        return action && ability ? {
          slotId: slot.slotId,
          source: slot.source,
          enemy: slot.actor.template.name,
          weaknesses: this.chamberContext?.revealWeaknesses
            ? [...slot.actor.instance.weaknesses]
            : undefined,
          ability: ability.name,
          target: ability.targeting === 'all_enemies' ? 'All Kin' : action.target.template.name,
        } : {
          slotId: slot.slotId,
          source: slot.source,
          enemy: slot.actor.template.name,
          weaknesses: this.chamberContext?.revealWeaknesses
            ? [...slot.actor.instance.weaknesses]
            : undefined,
          ability: null,
          target: null,
        };
      }),
      relayAvailable: this.phase === BattlePhase.PLAYER_CHOOSING
        && this.canQueueRelay(),
      relayCandidates: this.phase === BattlePhase.PLAYER_CHOOSING
        ? this.relayCandidatesForCurrentTurn().map(slot => ({
          name: slot.actor.template.name,
          source: slot.source,
        }))
        : [],
      metrics: { ...this.tempoMetrics },
      lastMessage: this.messageLog[this.messageLog.length - 1] ?? '',
    };
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
