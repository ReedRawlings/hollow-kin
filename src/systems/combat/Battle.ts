import { getAbility } from '../../data/abilities';
import { getTemplate } from '../../data/creatures';
import { getItem } from '../../data/items';
import { gameState } from '../../managers/GameState';
import {
  ActiveBoon,
  BattlePhase,
  CombatAction,
  CombatCreature,
  COMBAT_DELAY_ACTION,
  COMBAT_DELAY_AUTO_THINK,
  COMBAT_DELAY_STATUS_SKIP,
  COMBAT_DELAY_TURN_END,
  CreatureInstance,
  Encounter,
  bandForFloor,
  generateId,
  scaledDelay,
  STAR_LEVEL_CAPS,
  TacticId,
} from '../../types';
import {
  applyAbilityEffects,
  applyDamage,
  calculateDamage,
  createCombatCreature,
  isSkipTurn,
  resolveNonDamagingAbility,
  tickStatusEffects,
} from '../CombatEngine';
import {
  damageDealtMultiplier,
  damageTakenMultiplier,
  effectiveMaxHp,
  obolMultiplier,
  postVictoryHealFraction,
  tickAfterBattle,
} from '../Boons';
import { removeAt } from '../Backpack';
import { applyItemInCombat } from '../Items';
import { obolsForEncounter } from '../Economy';
import {
  RiteLogBook,
  newLogBook,
  recordActed,
  recordDamageTaken,
  recordDamageTypeUsed,
  recordEffectOutcome,
  recordItemUsed,
  recordRoundSurvived,
  recordStrike,
  snapshotEffects,
} from '../RiteRecorder';
import {
  PackTempoState,
  beginTempoRound,
  canSpendRelay,
  createPackTempoState,
  generateTempo,
  relayCandidates,
  relayTimeline,
  spendRelay,
  tempoReasonForAction,
} from '../PackTempo';
import { BattleChamberContext, sharedActionAbilityCost } from '../BattleChamber';
import {
  SharedActionPoolState,
  beginSharedActionRound,
  createSharedActionPool,
  spendSharedActions,
} from '../SharedActionPool';
import { chooseSharedAction } from '../SharedActionAI';
import { chooseAction, getEnemyAction } from '../TacticsAI';
import { RandomSource } from '../SeededRandom';
import { buildTurnSlots, TurnSlot } from '../TurnTimeline';
import {
  LinkArtRecipe,
  LinkChainState,
  createLinkChainState,
  interruptLink,
  linkSignature,
  previewLinkArt,
  recordLinkedMove,
} from '../LinkArts';

interface AbilityResolution {
  landed: boolean;
  conditionalCritical: boolean;
  exploitedWeakness: boolean;
}

export interface TempoMetrics {
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
}

function newTempoMetrics(): TempoMetrics {
  return {
    generated: 0,
    spent: 0,
    wastedAtCap: 0,
    relays: 0,
    actionPointsSpent: 0,
    spentOnRelay: 0,
    playerActions: 0,
    enemyActions: 0,
    packFirstRounds: 0,
    initiativeRounds: 0,
    relayHeldRounds: 0,
    linkArtsCompleted: 0,
    linksInterrupted: 0,
    relayEnabledLinks: 0,
  };
}

export interface BattleEvents {
  redraw(): void;
  schedule(delayMs: number, callback: () => void): void;
  openRootMenu(): void;
  returnToChoosing(): void;
  battleEnded(victory: boolean): void;
  escaped(): void;
}

export interface BattleExit {
  scene: 'BattleChamberScene' | 'PostCombatScene' | 'RunScene';
  data: Record<string, unknown>;
}

/**
 * Presentation-free combat model. It owns the mutable battle state and rules;
 * a scene supplies timing, redraw, menu, and navigation hooks.
 */
/**
 * Pure victory payout for an encounter: XP per surviving creature and the Obol
 * gain. Composes the boon Obol multiplier with the encounter's own
 * `rewardMultiplier` (Warden's Wager); absent multiplier = 1.
 */
export function victoryRewards(
  encounter: Encounter,
  boons: ActiveBoon[],
): { xpPerCreature: number; obolGain: number; tier: 'normal' | 'mini' | 'major' } {
  const rewardMul = encounter.rewardMultiplier ?? 1;
  const depthBand = bandForFloor(encounter.floor);
  const baseXp = 8 + (encounter.type === 'boss' ? 20 : 5) * depthBand;
  const xpPerCreature = Math.max(1, Math.round(baseXp * rewardMul));
  const tier = encounter.type === 'boss' ? (encounter.bossTier ?? 'mini') : 'normal';
  const obolGain = Math.max(
    1,
    Math.round(obolsForEncounter(tier, encounter.floor) * obolMultiplier(boons) * rewardMul),
  );
  return { xpPerCreature, obolGain, tier };
}

export class Battle {
  readonly encounter: Encounter;
  readonly chamberContext: BattleChamberContext | null;

  playerParty: CombatCreature[] = [];
  enemyParty: CombatCreature[] = [];
  turnOrder: TurnSlot[] = [];
  currentTurnIndex = 0;
  phase: BattlePhase = BattlePhase.STARTING;
  messageLog: string[] = [];
  enemyIntents = new Map<string, CombatAction>();
  packTempo: PackTempoState = createPackTempoState();
  sharedActions: SharedActionPoolState = createSharedActionPool();
  linkChain: LinkChainState = createLinkChainState();
  activeLinkArt: LinkArtRecipe | null = null;
  tempoMetrics: TempoMetrics = newTempoMetrics();
  queuedRelayTargetSlotId: string | null = null;
  relayedSlotIds = new Set<string>();
  roundNumber = 1;
  riteLogs: RiteLogBook = new Map();
  actedPlayerIds = new Set<string>();

  private roundSawPlayer = false;
  private roundSawEnemy = false;
  private roundEnemyBeforePendingPlayer = false;
  private roundMetricsFinalized = false;

  constructor(
    encounter: Encounter,
    chamberContext: BattleChamberContext | null,
    private readonly rng: RandomSource,
    private readonly events: BattleEvents,
  ) {
    this.encounter = encounter;
    this.chamberContext = chamberContext;
    if (chamberContext?.initialTempoPoints) {
      this.packTempo = {
        ...this.packTempo,
        points: Math.min(
          this.packTempo.cap,
          Math.max(0, Math.floor(chamberContext.initialTempoPoints)),
        ),
      };
    }
  }

  start(): void {
    this.initializeCombatants();
    this.phase = BattlePhase.NEXT_TURN;
    this.events.redraw();
    this.nextTurn();
  }

  private initializeCombatants(): void {
    const run = gameState.currentRun!;

    for (const creature of gameState.runParty) {
      if (run.partyKO[creature.instanceId]) continue;
      const template = getTemplate(creature.speciesId);
      this.playerParty.push(createCombatCreature(
        creature,
        template,
        true,
        run.partyHp[creature.instanceId],
        run.partyMp[creature.instanceId],
        effectiveMaxHp(creature.currentStats.hp, run.activeBoons),
      ));
    }

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
        tactic: 'fight_wisely',
      };
      const statNames = ['hp', 'mp', 'str', 'def', 'wis', 'spd', 'int'] as const;
      for (const stat of statNames) {
        const base = template.baseStats[stat];
        const maxStat = base * 2.0;
        enemyInstance.currentStats[stat] = Math.floor(base + (maxStat - base) * (enemyLevel / 10));
      }
      enemyInstance.currentStats.str = Math.floor(enemyInstance.currentStats.str * 0.6);
      enemyInstance.currentStats.int = Math.floor(enemyInstance.currentStats.int * 0.6);
      enemyInstance.currentStats.hp = Math.floor(enemyInstance.currentStats.hp * 1.2);
      if (this.encounter.type === 'boss') {
        enemyInstance.currentStats.hp = Math.floor(enemyInstance.currentStats.hp * 1.8);
        enemyInstance.currentStats.str = Math.floor(enemyInstance.currentStats.str * 1.15);
        enemyInstance.currentStats.int = Math.floor(enemyInstance.currentStats.int * 1.15);
      }
      this.enemyParty.push(createCombatCreature(enemyInstance, template, false));
    }

    this.riteLogs = newLogBook(this.enemyParty);
  }

  nextTurn(): void {
    if (this.playerParty.every(creature => creature.isKnockedOut)) {
      this.finishBattle(false);
      return;
    }
    if (this.enemyParty.every(creature => creature.isKnockedOut)) {
      this.finishBattle(true);
      return;
    }

    if (this.currentTurnIndex >= this.turnOrder.length || this.turnOrder.length === 0) {
      if (this.turnOrder.length > 0) {
        recordRoundSurvived(this.riteLogs, this.enemyParty);
        this.finalizeInitiativeRound();
        if (canSpendRelay(this.packTempo)) this.tempoMetrics.relayHeldRounds++;
        this.roundNumber++;
      }
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

    if (isSkipTurn(current)) {
      const statusName = current.statusEffects.find(
        status => status.type === 'freeze' || status.type === 'stun' || status.type === 'sleep',
      )?.type ?? 'status';
      this.addMessage(`${current.template.name} is ${statusName}ed and can't move!`);
      tickStatusEffects(current).forEach(message => this.addMessage(message));
      this.recordTimelineTurn(current, false);
      this.currentTurnIndex++;
      this.events.redraw();
      this.events.schedule(
        scaledDelay(COMBAT_DELAY_STATUS_SKIP, gameState.battleSpeed),
        () => this.nextTurn(),
      );
      return;
    }

    if (current.isPlayerOwned) {
      const tactic = current.instance.tactic;
      if (gameState.currentRun!.autoCombat && tactic !== 'follow_orders') {
        this.phase = BattlePhase.EXECUTING;
        this.events.redraw();
        this.events.schedule(
          scaledDelay(COMBAT_DELAY_AUTO_THINK, gameState.battleSpeed),
          () => this.executeAutoTurn(current),
        );
      } else {
        this.events.openRootMenu();
      }
    } else {
      this.phase = BattlePhase.EXECUTING;
      this.executeEnemyTurn(current);
    }
  }

  private finishBattle(victory: boolean): void {
    this.phase = victory ? BattlePhase.VICTORY : BattlePhase.DEFEAT;
    this.finalizeInitiativeRound();
    this.events.battleEnded(victory);
  }

  private commitEnemyIntents(): void {
    this.enemyIntents.clear();
    const committedAbilityByActor = new Map<string, string>();
    for (const slot of this.turnOrder) {
      const enemy = slot.actor;
      if (enemy.isPlayerOwned || enemy.isKnockedOut) continue;
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

  usesSharedActions(): boolean {
    return this.chamberContext?.resourceModel === 'shared_actions';
  }

  playerKnownSpecies(): ReadonlySet<string> {
    if (!this.chamberContext?.revealWeaknesses) return gameState.seenSpecies;
    return new Set(this.enemyParty.map(enemy => enemy.instance.speciesId));
  }

  isWeakness(ability: ReturnType<typeof getAbility>, target: CombatCreature | null): boolean {
    return !!target
      && ability.damageType !== 'None'
      && target.instance.weaknesses.includes(ability.damageType);
  }

  isKnownWeakness(ability: ReturnType<typeof getAbility>, target: CombatCreature | null): boolean {
    return !!target
      && this.isWeakness(ability, target)
      && (this.chamberContext?.revealWeaknesses
        || gameState.seenSpecies.has(target.instance.speciesId));
  }

  canQueueRelay(): boolean {
    return canSpendRelay(this.packTempo) && this.relayCandidatesForCurrentTurn().length > 0;
  }

  playerAbilityCost(abilityId: string): number {
    const ability = getAbility(abilityId);
    return this.usesSharedActions() ? sharedActionAbilityCost(ability) : ability.mpCost;
  }

  canPayPlayerAbility(actor: CombatCreature, abilityId: string): boolean {
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

  magicAbilityIds(actor: CombatCreature): string[] {
    return actor.instance.abilities.filter((id): id is string => id !== null && id !== 'basic_attack');
  }

  playerAct(attacker: CombatCreature, abilityId: string, target: CombatCreature): void {
    const ability = getAbility(abilityId);
    if (!this.payPlayerAbility(attacker, abilityId)) {
      this.addMessage(this.usesSharedActions()
        ? `${ability.name} needs more shared Action Points.`
        : `${attacker.template.name} does not have enough MP for ${ability.name}.`);
      this.events.openRootMenu();
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
      for (const enemy of this.enemyParty.filter(candidate => !candidate.isKnockedOut)) {
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

    this.events.redraw();
    this.events.schedule(
      scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
      () => this.finishTurn(attacker),
    );
  }

  useItem(itemId: string, slotIndex: number, target: CombatCreature | null): void {
    const actor = this.turnOrder[this.currentTurnIndex]?.actor;
    if (!actor) return;
    const definition = getItem(itemId);
    const context = { where: 'combat' as const, isBoss: this.encounter.type === 'boss' };
    const outcome = applyItemInCombat(definition, target, context, this.playerParty);

    if (outcome.kind === 'refused' || outcome.kind === 'depart') {
      this.addMessage(outcome.kind === 'refused'
        ? outcome.reason
        : `${definition.name} cannot be used here.`);
      this.phase = BattlePhase.PLAYER_CHOOSING;
      this.events.returnToChoosing();
      return;
    }

    this.phase = BattlePhase.EXECUTING;
    if (this.chamberContext?.linkArts) this.linkChain = createLinkChainState();
    recordItemUsed(this.riteLogs, target);
    gameState.backpack = removeAt(gameState.backpack, slotIndex);
    gameState.saveToLocalStorage();

    if (outcome.kind === 'escape_battle') {
      this.addMessage(`${actor.template.name} broke the ${definition.name}!`);
      this.events.redraw();
      this.events.schedule(
        scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
        () => this.events.escaped(),
      );
      return;
    }

    this.addMessage(`${actor.template.name} used ${definition.name} — ${outcome.message}`);
    this.events.redraw();
    this.events.schedule(
      scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
      () => this.finishTurn(actor),
    );
  }

  executeAutoTurn(creature: CombatCreature): void {
    this.queueAutoRelayIfUseful();
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
    if (action === null) {
      this.finishTurn(creature);
      return;
    }
    this.playerAct(creature, action.abilityId, action.target);
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
      this.addMessage(
        `${enemy.template.name}'s ${ability.name} fizzled — ${target.template.name} was already down.`,
      );
      this.events.redraw();
      this.events.schedule(
        scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
        () => this.finishTurn(enemy),
      );
      return;
    }

    enemy.currentMp -= ability.mpCost;
    if (ability.targeting === 'all_enemies') {
      for (const player of this.playerParty.filter(candidate => !candidate.isKnockedOut)) {
        this.resolveAbility(enemy, player, ability);
      }
    } else {
      this.resolveAbility(enemy, target, ability);
    }
    this.events.redraw();
    this.events.schedule(
      scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed),
      () => this.finishTurn(enemy),
    );
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

      const boons = gameState.currentRun?.activeBoons ?? [];
      const dealt = attacker.isPlayerOwned ? damageDealtMultiplier(boons) : 1;
      const taken = target.isPlayerOwned ? damageTakenMultiplier(boons, this.roundNumber) : 1;
      const linkMultiplier = attacker.isPlayerOwned
        ? this.activeLinkArt?.damageMultiplier ?? 1
        : 1;
      const damage = Math.max(1, Math.round(result.damage * dealt * taken * linkMultiplier));

      recordStrike(this.riteLogs, attacker, target);
      recordDamageTypeUsed(this.riteLogs, ability);
      recordDamageTaken(this.riteLogs, target, ability);
      applyDamage(target, damage);
      let message = `${attacker.template.name} used ${ability.name} → ${damage} dmg to ${target.template.name}`;
      if (result.isCrit) message += ' CRIT!';
      this.addMessage(message);

      const beforeEffects = snapshotEffects(target);
      applyAbilityEffects(ability, attacker, target, damage, this.rng)
        .forEach(effectMessage => this.addMessage(effectMessage));
      recordEffectOutcome(this.riteLogs, target, beforeEffects);
      return {
        landed: true,
        conditionalCritical: result.isCrit,
        exploitedWeakness: this.isWeakness(ability, target),
      };
    }

    const beforeEffects = snapshotEffects(target);
    const result = resolveNonDamagingAbility(ability, attacker, target, this.rng);
    if (result.missed) {
      this.addMessage(`${attacker.template.name} used ${ability.name} — MISS!`);
      return { landed: false, conditionalCritical: false, exploitedWeakness: false };
    }
    this.addMessage(`${attacker.template.name} used ${ability.name}!`);
    result.messages.forEach(message => this.addMessage(message));
    recordEffectOutcome(this.riteLogs, target, beforeEffects);
    return { landed: true, conditionalCritical: false, exploitedWeakness: false };
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
      this.addMessage(
        `Pack Tempo +${result.granted} — ${attacker.template.name} exploited a weakness.`,
      );
    } else if (result.wastedAtCap > 0) {
      this.tempoMetrics.wastedAtCap += result.wastedAtCap;
    }
  }

  private finishTurn(creature: CombatCreature): void {
    if (creature.isPlayerOwned) this.actedPlayerIds.add(creature.instance.instanceId);
    else recordActed(this.riteLogs, creature);
    this.recordTimelineTurn(creature, true);
    tickStatusEffects(creature).forEach(message => this.addMessage(message));

    if (creature.isPlayerOwned && this.queuedRelayTargetSlotId
      && !this.enemyParty.every(enemy => enemy.isKnockedOut)) {
      const target = this.relayCandidatesForCurrentTurn().find(
        slot => slot.slotId === this.queuedRelayTargetSlotId,
      );
      if (target && this.performRelay(target)) return;
    }
    this.advanceAfterTurn();
  }

  relayCandidatesForCurrentTurn(): TurnSlot[] {
    return relayCandidates(
      this.turnOrder,
      this.currentTurnIndex,
      slot => slot.slotId,
      slot => slot.actor.isPlayerOwned && !slot.actor.isKnockedOut,
    );
  }

  private performRelay(target: TurnSlot): boolean {
    const reordered = relayTimeline(
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
    this.tempoMetrics.spent += 3;
    this.tempoMetrics.spentOnRelay += 3;
    this.tempoMetrics.relays++;
    this.addMessage(
      `Relay! ${target.actor.template.name} moves next. Tempo -3.`,
    );
    this.advanceAfterTurn();
    return true;
  }

  private advanceAfterTurn(): void {
    this.queuedRelayTargetSlotId = null;
    this.currentTurnIndex++;
    this.events.redraw();
    this.events.schedule(
      scaledDelay(COMBAT_DELAY_TURN_END, gameState.battleSpeed),
      () => this.nextTurn(),
    );
  }

  /** Apply all battle-end rules and tell the scene where to navigate. */
  settle(victory: boolean): BattleExit {
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
      };
      return {
        scene: 'BattleChamberScene',
        data: {
          selectedPresetId: this.chamberContext.presetId,
          resourceModel: this.chamberContext.resourceModel,
          result,
          comparisonResults: {
            ...(this.chamberContext.comparisonResults ?? {}),
            [this.chamberContext.resourceModel]: result,
          },
        },
      };
    }

    // First encounters remain blind during the fight and become known only at
    // the common battle-end choke point.
    for (const enemy of this.enemyParty) {
      gameState.recordSeenSpecies(enemy.instance.speciesId);
    }

    const run = gameState.currentRun!;
    if (!victory) {
      this.savePartyState(run);
      return { scene: 'RunScene', data: { continueRun: true } };
    }

    const boons = run.activeBoons;
    const { xpPerCreature, obolGain, tier } = victoryRewards(this.encounter, boons);
    run.obols += obolGain;

    if (this.encounter.type === 'boss') {
      gameState.recordBreakCleared(this.encounter.floor);
    }

    let levelUpMessage = '';
    for (const player of this.playerParty) {
      if (player.isKnockedOut) continue;
      player.instance.xp += xpPerCreature;
      while (gameState.tryLevelUp(player.instance)) {
        player.maxHp = effectiveMaxHp(player.instance.currentStats.hp, boons);
        player.maxMp = player.instance.currentStats.mp;
        player.currentHp = Math.min(player.currentHp + 5, player.maxHp);
        levelUpMessage += `${player.template.name} → Lv${player.instance.currentLevel}! `;
      }
    }

    const healFraction = postVictoryHealFraction(boons);
    if (healFraction > 0) {
      for (const player of this.playerParty) {
        if (player.isKnockedOut) continue;
        player.currentHp = Math.min(
          player.maxHp,
          player.currentHp + Math.floor(player.maxHp * healFraction),
        );
      }
    }
    run.activeBoons = tickAfterBattle(boons);

    let storyMessage = '';
    if (this.encounter.storyEventId) {
      gameState.recordStoryEvent(this.encounter.storyEventId);
      storyMessage = this.encounter.storyEventId === 'gary_shortsword'
        ? 'Among the fallen lies an engraved shortsword. Gary may recognize it.'
        : 'Something recovered here may matter back in town.';
    }

    this.savePartyState(run);
    return {
      scene: 'PostCombatScene',
      data: {
        floor: this.encounter.floor,
        tier,
        obolGain,
        xpPerCreature,
        levelUpMessage: levelUpMessage.trim(),
        storyMessage,
      },
    };
  }

  /** A Smoke Husk escape advances boon duration but grants no knowledge or rewards. */
  settleEscape(): BattleExit {
    const run = gameState.currentRun!;
    run.activeBoons = tickAfterBattle(run.activeBoons);
    this.savePartyState(run);
    gameState.saveToLocalStorage();
    return { scene: 'RunScene', data: { continueRun: true } };
  }

  private savePartyState(run: NonNullable<typeof gameState.currentRun>): void {
    for (const player of this.playerParty) {
      run.partyHp[player.instance.instanceId] = player.currentHp;
      run.partyMp[player.instance.instanceId] = player.currentMp;
      run.partyKO[player.instance.instanceId] = player.isKnockedOut;
    }
  }

  snapshot(): object {
    return {
      phase: this.phase,
      round: this.roundNumber,
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
      playersActed: this.actedPlayerIds.size,
      chamber: this.chamberContext,
      resourceModel: this.chamberContext?.resourceModel ?? 'individual_mp',
      tempo: { points: this.packTempo.points, cap: this.packTempo.cap },
      actionPool: this.usesSharedActions()
        ? { points: this.sharedActions.points, cap: this.sharedActions.cap }
        : null,
      relayReady: canSpendRelay(this.packTempo),
      queuedRelay: this.queuedRelayTargetSlotId
        ? this.turnOrder.find(slot => slot.slotId === this.queuedRelayTargetSlotId)
          ?.actor.template.name ?? null
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
      relayAvailable: this.phase === BattlePhase.PLAYER_CHOOSING && this.canQueueRelay(),
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

  private addMessage(message: string): void {
    this.messageLog.push(message);
    if (this.messageLog.length > 20) this.messageLog.shift();
  }
}
