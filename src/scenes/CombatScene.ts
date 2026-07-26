import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { getAbility } from '../data/abilities';
import {
  CombatCreature, BattlePhase, Encounter, CreatureInstance,
  generateId, STAR_LEVEL_CAPS, TacticId, COMBAT_DELAY_AUTO_THINK,
  scaledDelay, COMBAT_DELAY_ACTION, COMBAT_DELAY_TURN_END, COMBAT_DELAY_STATUS_SKIP,
} from '../types';
import {
  calculateTurnOrder, calculateDamage, applyDamage,
  applyAbilityEffects, tickStatusEffects, isSkipTurn,
  createCombatCreature, resolveNonDamagingAbility,
} from '../systems/CombatEngine';
import { getEnemyAction, chooseAction } from '../systems/TacticsAI';
import { obolsForEncounter } from '../systems/Economy';
import { renderBattlefield } from './combat/BattlefieldRenderer';
import { UI, BODY_FONT, DISPLAY_FONT } from '../ui/Theme';

export class CombatScene extends Phaser.Scene {
  private playerParty: CombatCreature[] = [];
  private enemyParty: CombatCreature[] = [];
  private turnOrder: CombatCreature[] = [];
  private currentTurnIndex = 0;
  private phase: BattlePhase = BattlePhase.STARTING;
  private encounter!: Encounter;
  private messageLog: string[] = [];
  private uiElements: Phaser.GameObjects.GameObject[] = [];
  private selectedAbilityId: string | null = null;
  /**
   * Objects drawn by drawHud(), tracked separately from uiElements/battlefield
   * children so they can be explicitly destroyed rather than merely detached.
   */
  private hudElements: Phaser.GameObjects.GameObject[] = [];
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
    this.selectedAbilityId = null;
    this.uiElements = [];
    this.hudElements = [];
  }

  create(): void {
    this.initBattle();
    this.phase = BattlePhase.NEXT_TURN;
    this.drawBattlefield();
    this.nextTurn();
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
      this.drawBattlefield();
      this.time.delayedCall(scaledDelay(COMBAT_DELAY_STATUS_SKIP, gameState.battleSpeed), () => this.nextTurn());
      return;
    }

    if (current.isPlayerOwned) {
      const run2 = gameState.currentRun!;
      const tactic = current.instance.tactic;
      if (run2.autoCombat && tactic !== 'follow_orders') {
        this.phase = BattlePhase.EXECUTING;
        this.drawBattlefield();
        this.time.delayedCall(scaledDelay(COMBAT_DELAY_AUTO_THINK, gameState.battleSpeed), () => this.executeAutoTurn(current));
      } else {
        this.phase = BattlePhase.PLAYER_CHOOSING;
        this.drawBattlefield();
        this.showActionMenu(current);
      }
    } else {
      this.phase = BattlePhase.EXECUTING;
      this.executeEnemyTurn(current);
    }
  }

  private showActionMenu(creature: CombatCreature): void {
    const abilities = creature.instance.abilities.filter((id): id is string => id !== null);

    // Always have basic attack
    const allActions = [...abilities];
    if (!allActions.includes('basic_attack')) {
      allActions.push('basic_attack');
    }

    // Ability buttons
    allActions.forEach((abilityId, i) => {
      const ability = getAbility(abilityId);
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 170 + col * 310;
      const y = 506 + row * 54;
      const canUse = creature.currentMp >= ability.mpCost;

      const bg = this.add.rectangle(x, y, 286, 44, canUse ? UI.plate : UI.panel)
        .setStrokeStyle(2, canUse ? UI.gold : UI.line).setInteractive({ useHandCursor: true });
      this.uiElements.push(bg);

      const label = this.add.text(x, y - 6, ability.name, {
        fontSize: '9px', color: canUse ? UI.hi : UI.muted, fontFamily: DISPLAY_FONT,
      }).setOrigin(0.5);
      this.uiElements.push(label);

      const mpText = this.add.text(x, y + 10, ability.mpCost > 0 ? `MP:${ability.mpCost} | Pow:${ability.power || '—'}` : 'Free', {
        fontSize: '9px', color: canUse ? UI.mutedBright : UI.muted, fontFamily: BODY_FONT,
      }).setOrigin(0.5);
      this.uiElements.push(mpText);

      if (canUse) {
        bg.on('pointerover', () => bg.setFillStyle(UI.gold));
        bg.on('pointerout', () => bg.setFillStyle(UI.plate));
        bg.on('pointerdown', () => {
          this.selectedAbilityId = abilityId;
          if (ability.targeting === 'self' || ability.targeting === 'all_enemies' || ability.targeting === 'all_allies') {
            this.executePlayerAction(creature, abilityId, creature);
          } else if (ability.targeting === 'single_ally') {
            // A single_ally ability may target any living ally, including the caster.
            const livingAllies = this.playerParty.filter(p => !p.isKnockedOut);
            if (livingAllies.length === 1) {
              this.executePlayerAction(creature, abilityId, livingAllies[0]);
            } else {
              this.showAllyTargetSelection(creature, abilityId);
            }
          } else {
            // Single-enemy targeting: auto-target when only one enemy is alive,
            // otherwise let the player pick.
            const livingEnemies = this.enemyParty.filter(e => !e.isKnockedOut);
            if (livingEnemies.length === 1) {
              this.executePlayerAction(creature, abilityId, livingEnemies[0]);
            } else {
              this.showTargetSelection(creature, abilityId);
            }
          }
        });
      }
    });

    // Defend button
    const defIndex = allActions.length;
    const defX = 170 + (defIndex % 3) * 310;
    const defY = 506 + Math.floor(defIndex / 3) * 54;
    const defBg = this.add.rectangle(defX, defY, 286, 44, UI.plate)
      .setStrokeStyle(2, UI.teal).setInteractive({ useHandCursor: true });
    this.uiElements.push(defBg);
    const defLabel = this.add.text(defX, defY, 'DEFEND', {
      fontSize: '9px', color: UI.tealCss, fontFamily: DISPLAY_FONT,
    }).setOrigin(0.5);
    this.uiElements.push(defLabel);
    defBg.on('pointerdown', () => {
      creature.isDefending = true;
      this.addMessage(`${creature.template.name} defends!`);
      this.finishTurn(creature);
    });
  }

  private showTargetSelection(attacker: CombatCreature, abilityId: string): void {
    this.clearUI();
    this.phase = BattlePhase.PLAYER_TARGETING;
    const ability = getAbility(abilityId);

    this.add.text(this.cameras.main.centerX, 500, `Select target for ${ability.name}`, {
      fontSize: '14px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.enemyParty.forEach((enemy, i) => {
      if (enemy.isKnockedOut) return;
      const x = 480 - ((this.enemyParty.length - 1) * 154) / 2 + i * 154;
      const y = 173;

      const highlight = this.add.rectangle(x, y + 20, 110, 90, 0xffdd88, 0.15)
        .setStrokeStyle(2, 0xffdd88).setInteractive({ useHandCursor: true });
      this.uiElements.push(highlight);

      highlight.on('pointerover', () => highlight.setAlpha(0.4));
      highlight.on('pointerout', () => highlight.setAlpha(0.15));
      highlight.on('pointerdown', () => {
        this.executePlayerAction(attacker, abilityId, enemy);
      });
    });
  }

  private showAllyTargetSelection(caster: CombatCreature, abilityId: string): void {
    this.clearUI();
    this.phase = BattlePhase.PLAYER_TARGETING;
    const ability = getAbility(abilityId);

    this.add.text(this.cameras.main.centerX, 500, `Select ally for ${ability.name}`, {
      fontSize: '14px', color: '#88ffaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.playerParty.forEach((ally, i) => {
      if (ally.isKnockedOut) return;
      const x = 180 + i * 300;
      const y = 354;

      const highlight = this.add.rectangle(x, y, 110, 90, 0x88ffaa, 0.15)
        .setStrokeStyle(2, 0x88ffaa).setInteractive({ useHandCursor: true });
      this.uiElements.push(highlight);

      highlight.on('pointerover', () => highlight.setAlpha(0.4));
      highlight.on('pointerout', () => highlight.setAlpha(0.15));
      highlight.on('pointerdown', () => {
        this.executePlayerAction(caster, abilityId, ally);
      });
    });
  }

  private executePlayerAction(
    attacker: CombatCreature,
    abilityId: string,
    target: CombatCreature,
  ): void {
    this.clearUI();
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

    this.drawBattlefield();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed), () => this.finishTurn(attacker));
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

    this.drawBattlefield();
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
    this.drawBattlefield();
    this.time.delayedCall(scaledDelay(COMBAT_DELAY_TURN_END, gameState.battleSpeed), () => this.nextTurn());
  }

  private showBattleEnd(victory: boolean): void {
    this.clearUI();
    // showBattleEnd() never routes through drawBattlefield()/drawHud(), so the
    // AUTO toggle painted by the last in-battle drawBattlefield() call (e.g.
    // from finishTurn(), while phase was still EXECUTING) is still live and
    // interactive underneath this screen. The phase gate in drawHud() stops
    // it from being redrawn, but that stale instance must be destroyed here
    // explicitly or it dead-ends the game (clicking it wipes this screen via
    // drawBattlefield() and draws nothing to replace it).
    this.destroyHud();

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

    const cx = this.cameras.main.centerX;
    const run = gameState.currentRun!;

    if (victory) {
      // Award XP and obols
      // Depth band (1-3) is the zone-equivalent value, not the raw floor (1-30) —
      // using raw floor here would inflate XP ~10x at deep floors.
      const depthBand = Math.floor((this.encounter.floor - 1) / 10) + 1;
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

  /**
   * Toggle row, redrawn after every battlefield repaint since children are
   * detached (not destroyed) each repaint. Always destroys the previous
   * HUD objects first — detaching from the display list does not deregister
   * interactive objects from the input plugin, so a bare repaint would leak
   * an accumulating pile of clickable rectangles (finding 2).
   *
   * Renders nothing once the battle has ended (see HUD_ACTIVE_PHASES) so the
   * toggle can't sit on top of — or wipe — the VICTORY/DEFEAT screen.
   */
  private drawHud(): void {
    this.destroyHud();
    if (!CombatScene.HUD_ACTIVE_PHASES.has(this.phase)) return;

    const run = gameState.currentRun!;

    const autoOn = run.autoCombat;
    const autoBg = this.add.rectangle(880, 20, 120, 28, autoOn ? 0x336633 : 0x333344, 0.95)
      .setStrokeStyle(2, autoOn ? 0x66cc66 : 0x555566)
      .setInteractive({ useHandCursor: true });
    this.hudElements.push(autoBg);
    const autoLabel = this.add.text(880, 20, autoOn ? 'AUTO: ON' : 'AUTO: OFF', {
      fontSize: '12px', color: autoOn ? '#bbffbb' : '#9999aa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.hudElements.push(autoLabel);

    autoBg.on('pointerdown', () => {
      // Destroy whatever menu/target-selection elements are currently registered
      // with the input plugin before anything else. drawBattlefield() below only
      // detaches uiElements (children.removeAll()), it doesn't destroy them — a
      // bare redraw would leave the previous prompt's hotspots alive and
      // clickable underneath whatever gets drawn next (finding 1b).
      this.clearUI();
      run.autoCombat = !run.autoCombat;
      // NOTE: intentionally not calling gameState.saveToLocalStorage() here.
      // autoCombat lives on RunState (gameState.currentRun), and currentRun is
      // not part of the serialized save — this toggle is never persisted by
      // this call regardless, so the call would just be a no-op flush of
      // unrelated state (finding 4).
      // If we just switched on while waiting for input, hand this turn to the AI.
      const current = this.turnOrder[this.currentTurnIndex];
      if (run.autoCombat
        && this.phase === BattlePhase.PLAYER_CHOOSING
        && current?.isPlayerOwned
        && current.instance.tactic !== 'follow_orders') {
        this.phase = BattlePhase.EXECUTING;
        this.drawBattlefield();
        this.time.delayedCall(scaledDelay(COMBAT_DELAY_AUTO_THINK, gameState.battleSpeed), () => this.executeAutoTurn(current));
      } else {
        this.drawBattlefield();
        // Re-show the ability menu whenever the player was mid-decision — for
        // PLAYER_CHOOSING that's an unchanged redraw of the menu; for
        // PLAYER_TARGETING (a target/ally prompt was just destroyed by the
        // clearUI() above) this deliberately returns the player to the ability
        // menu rather than leaving them with no prompt at all. Their
        // in-progress ability selection is lost — defensible and simple, and
        // strictly better than a dead screen (finding 1c).
        if ((this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING) && current) {
          this.phase = BattlePhase.PLAYER_CHOOSING;
          this.showActionMenu(current);
        }
      }
    });

    const speed = gameState.battleSpeed;
    const speedBg = this.add.rectangle(880, 52, 120, 24, 0x333344, 0.95)
      .setStrokeStyle(2, 0x555566).setInteractive({ useHandCursor: true });
    this.hudElements.push(speedBg);
    const speedLabel = this.add.text(880, 52, `SPEED ${speed}x`, {
      fontSize: '11px', color: '#bbbbcc', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.hudElements.push(speedLabel);

    speedBg.on('pointerover', () => speedBg.setFillStyle(0x444455));
    speedBg.on('pointerout', () => speedBg.setFillStyle(0x333344));
    speedBg.on('pointerdown', () => {
      // See the AUTO handler above — must destroy, not just detach, the
      // currently-registered menu/target-selection elements before redrawing
      // (finding 1b).
      this.clearUI();
      gameState.cycleBattleSpeed();
      gameState.saveToLocalStorage();
      this.drawBattlefield();
      const current = this.turnOrder[this.currentTurnIndex];
      // See the AUTO handler above for why PLAYER_TARGETING is included here
      // (finding 1c).
      if ((this.phase === BattlePhase.PLAYER_CHOOSING || this.phase === BattlePhase.PLAYER_TARGETING) && current) {
        this.phase = BattlePhase.PLAYER_CHOOSING;
        this.showActionMenu(current);
      }
    });
  }

  private drawBattlefield(): void {
    // Clear previous battlefield elements (but not UI overlay)
    this.children.removeAll();
    this.uiElements = [];

    renderBattlefield(this, {
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      currentActor: this.turnOrder[this.currentTurnIndex],
      messageLog: this.messageLog,
      showTactics: gameState.currentRun?.autoCombat ?? false,
    });

    this.drawHud();
  }

  private addMessage(msg: string): void {
    this.messageLog.push(msg);
    if (this.messageLog.length > 20) this.messageLog.shift();
  }

  private clearUI(): void {
    for (const el of this.uiElements) {
      el.destroy();
    }
    this.uiElements = [];
  }

  private destroyHud(): void {
    for (const el of this.hudElements) {
      el.destroy();
    }
    this.hudElements = [];
  }
}
