import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { getTemplate } from '../data/creatures';
import { getAbility } from '../data/abilities';
import {
  CombatCreature, BattlePhase, Encounter, CreatureInstance,
  generateId, STAR_LEVEL_CAPS, STAR_LONGEVITY,
} from '../types';
import {
  calculateTurnOrder, calculateDamage, applyDamage, applyHeal,
  applyAbilityEffects, tickStatusEffects, isSkipTurn, getEnemyAction,
  createCombatCreature,
} from '../systems/CombatEngine';

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
        longevity: 0,
        abilities: [...template.defaultAbilities, null, null].slice(0, 4),
        traitSlots: [],
        lineage: { parentA: null, parentB: null },
        currentStats: { ...template.baseStats },
        resistances: [...template.resistances],
        weaknesses: [...template.weaknesses],
        isRetired: false,
        isBreedReady: false,
        xp: 0,
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
      this.time.delayedCall(1000, () => this.nextTurn());
      return;
    }

    if (current.isPlayerOwned) {
      this.phase = BattlePhase.PLAYER_CHOOSING;
      this.drawBattlefield();
      this.showActionMenu(current);
    } else {
      this.phase = BattlePhase.EXECUTING;
      this.executeEnemyTurn(current);
    }
  }

  private showActionMenu(creature: CombatCreature): void {
    const y = 510;
    const abilities = creature.instance.abilities.filter((id): id is string => id !== null);

    // Always have basic attack
    const allActions = [...abilities];
    if (!allActions.includes('basic_attack')) {
      allActions.push('basic_attack');
    }

    // Ability buttons
    allActions.forEach((abilityId, i) => {
      const ability = getAbility(abilityId);
      const x = 120 + i * 180;
      const canUse = creature.currentMp >= ability.mpCost;

      const bg = this.add.rectangle(x, y, 160, 40, canUse ? 0x334466 : 0x222222, 0.9)
        .setStrokeStyle(1, canUse ? 0x6688aa : 0x444444).setInteractive({ useHandCursor: true });
      this.uiElements.push(bg);

      const label = this.add.text(x, y - 6, ability.name, {
        fontSize: '11px', color: canUse ? '#ffffff' : '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(label);

      const mpText = this.add.text(x, y + 10, ability.mpCost > 0 ? `MP:${ability.mpCost} | Pow:${ability.power || '—'}` : 'Free', {
        fontSize: '9px', color: '#888888', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(mpText);

      if (canUse) {
        bg.on('pointerover', () => bg.setFillStyle(0x446688));
        bg.on('pointerout', () => bg.setFillStyle(0x334466));
        bg.on('pointerdown', () => {
          this.selectedAbilityId = abilityId;
          if (ability.targeting === 'self' || ability.targeting === 'all_enemies' || ability.targeting === 'all_allies') {
            this.executePlayerAction(creature, abilityId, creature);
          } else if (ability.targeting === 'single_ally') {
            // For now, self-heal
            this.executePlayerAction(creature, abilityId, creature);
          } else {
            // Target selection — highlight enemies
            this.showTargetSelection(creature, abilityId);
          }
        });
      }
    });

    // Defend button
    const defX = 120 + allActions.length * 180;
    const defBg = this.add.rectangle(defX, y, 120, 40, 0x443322, 0.9)
      .setStrokeStyle(1, 0x886644).setInteractive({ useHandCursor: true });
    this.uiElements.push(defBg);
    const defLabel = this.add.text(defX, y, 'DEFEND', {
      fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
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
    const ability = getAbility(abilityId);

    this.add.text(this.cameras.main.centerX, 500, `Select target for ${ability.name}`, {
      fontSize: '14px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.enemyParty.forEach((enemy, i) => {
      if (enemy.isKnockedOut) return;
      const x = 620;
      const y = 130 + i * 110;

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
    this.time.delayedCall(800, () => this.finishTurn(attacker));
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
    this.time.delayedCall(800, () => this.finishTurn(enemy));
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
      this.addMessage(`${attacker.template.name} used ${ability.name}!`);
      const effectTarget = ability.targeting === 'self' ? attacker : target;
      const effectMsgs = applyAbilityEffects(ability, attacker, effectTarget, 0);
      effectMsgs.forEach(m => this.addMessage(m));
    }
  }

  private finishTurn(creature: CombatCreature): void {
    // Tick status effects
    const msgs = tickStatusEffects(creature);
    msgs.forEach(m => this.addMessage(m));

    this.currentTurnIndex++;
    this.drawBattlefield();
    this.time.delayedCall(400, () => this.nextTurn());
  }

  private showBattleEnd(victory: boolean): void {
    this.clearUI();
    const cx = this.cameras.main.centerX;
    const run = gameState.currentRun!;

    if (victory) {
      // Award XP and plasm
      const xpPerCreature = 8 + (this.encounter.type === 'boss' ? 20 : 5) * this.encounter.zone;
      const plasmGain = 10 + (this.encounter.type === 'boss' ? 25 : 8) * this.encounter.zone;
      run.plasm += plasmGain;

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

      this.add.text(cx, 440, 'VICTORY!', {
        fontSize: '24px', color: '#ffdd88', fontFamily: 'monospace',
      }).setOrigin(0.5);

      let rewards = `+${plasmGain} Plasm  |  +${xpPerCreature} XP each`;
      if (levelUpMsg) rewards += '\n' + levelUpMsg;

      this.add.text(cx, 475, rewards, {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5);

      // Save party state before reward choice
      this.savePartyState(run);

      // Show reward choice
      this.showRewardChoice(cx, run);
    } else {
      this.add.text(cx, 470, 'DEFEAT...', {
        fontSize: '24px', color: '#ff4444', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.savePartyState(run);

      const returnBtn = this.add.text(cx, 560, 'RETURN', {
        fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
        backgroundColor: '#444444', padding: { x: 30, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      returnBtn.on('pointerdown', () => {
        gameState.endRun(false);
        gameState.saveToLocalStorage();
        this.scene.start('TownScene');
      });
    }
  }

  private savePartyState(run: typeof gameState.currentRun & object): void {
    for (const pc of this.playerParty) {
      run.partyHp[pc.instance.instanceId] = pc.currentHp;
      run.partyMp[pc.instance.instanceId] = pc.currentMp;
      run.partyKO[pc.instance.instanceId] = pc.isKnockedOut;
    }
  }

  private showRewardChoice(cx: number, run: typeof gameState.currentRun & object): void {
    this.add.text(cx, 510, 'Choose a reward:', {
      fontSize: '14px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const alive = this.playerParty.filter(c => !c.isKnockedOut);
    const resourceGain = 5 + this.encounter.zone * 3;

    const choices = [
      { label: 'Restore HP', desc: 'Heal party for 10% HP', color: 0x44aa44 },
      { label: 'Restore MP', desc: 'Restore party 20% MP', color: 0x4466cc },
      { label: 'Resources', desc: `+${resourceGain} Town Resources`, color: 0xcc8844 },
    ];

    choices.forEach((choice, i) => {
      const bx = cx - 200 + i * 200;
      const by = 560;
      const bg = this.add.rectangle(bx, by, 170, 60, choice.color, 0.9)
        .setStrokeStyle(2, 0xffffff).setInteractive({ useHandCursor: true });

      this.add.text(bx, by - 10, choice.label, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.add.text(bx, by + 12, choice.desc, {
        fontSize: '10px', color: '#dddddd', fontFamily: 'monospace',
      }).setOrigin(0.5);

      bg.on('pointerover', () => bg.setAlpha(0.7));
      bg.on('pointerout', () => bg.setAlpha(1));

      bg.on('pointerdown', () => {
        if (i === 0) {
          // Restore 25% HP to alive party members
          for (const pc of alive) {
            const heal = Math.floor(pc.maxHp * 0.10);
            pc.currentHp = Math.min(pc.maxHp, pc.currentHp + heal);
            run.partyHp[pc.instance.instanceId] = pc.currentHp;
          }
        } else if (i === 1) {
          // Restore 20% MP to alive party members
          for (const pc of alive) {
            const restore = Math.floor(pc.maxMp * 0.20);
            pc.currentMp = Math.min(pc.maxMp, pc.currentMp + restore);
            run.partyMp[pc.instance.instanceId] = pc.currentMp;
          }
        } else {
          // Town resources
          gameState.townResources += resourceGain;
        }
        gameState.saveToLocalStorage();
        this.scene.start('RunScene', { continueRun: true });
      });
    });
  }

  // ---------- RENDERING ----------

  private drawBattlefield(): void {
    // Clear previous battlefield elements (but not UI overlay)
    this.children.removeAll();
    this.uiElements = [];

    // Background
    this.add.rectangle(480, 320, 960, 640, 0x1a1a2e);

    // Battle area divider
    this.add.line(480, 0, 0, 70, 0, 460, 0x333355, 0.5);

    // Turn indicator
    const current = this.turnOrder[this.currentTurnIndex];
    if (current) {
      this.add.text(480, 15, `Turn: ${current.template.name}`, {
        fontSize: '14px', color: '#ffdd88', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    // Draw player creatures
    this.playerParty.forEach((creature, i) => {
      this.drawCreature(creature, 140, 120 + i * 120, true);
    });

    // Draw enemy creatures
    this.enemyParty.forEach((creature, i) => {
      this.drawCreature(creature, 700, 120 + i * 110, false);
    });

    // Message log
    const logY = 400;
    const recentMessages = this.messageLog.slice(-4);
    recentMessages.forEach((msg, i) => {
      this.add.text(20, logY + i * 18, msg, {
        fontSize: '11px', color: '#aaaacc', fontFamily: 'monospace',
      });
    });
  }

  private drawCreature(creature: CombatCreature, x: number, y: number, isPlayer: boolean): void {
    const alpha = creature.isKnockedOut ? 0.3 : 1;

    // Rectangle sprite
    const rect = this.add.rectangle(x, y, 70, 55, creature.template.spriteColor, alpha);
    if (creature.isDefending) rect.setStrokeStyle(2, 0x8888ff);

    // Name and level
    const labelX = isPlayer ? x + 50 : x - 50;
    const align = isPlayer ? 'left' : 'right';
    const origin = isPlayer ? 0 : 1;

    this.add.text(labelX, y - 30, `${creature.template.name}`, {
      fontSize: '11px', color: creature.isKnockedOut ? '#666666' : '#ffffff', fontFamily: 'monospace',
    }).setOrigin(origin, 0.5);

    // HP bar
    const hpPct = creature.currentHp / creature.maxHp;
    const hpColor = hpPct > 0.5 ? 0x44aa44 : hpPct > 0.25 ? 0xaaaa44 : 0xaa4444;
    const barX = isPlayer ? x + 50 : x - 120;
    this.add.rectangle(barX, y - 14, 70, 6, 0x333333).setOrigin(0);
    this.add.rectangle(barX, y - 14, 70 * hpPct, 6, hpColor).setOrigin(0);

    // HP text
    this.add.text(barX, y - 5, `${creature.currentHp}/${creature.maxHp}`, {
      fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0);

    // MP bar (player only)
    if (isPlayer) {
      const mpPct = creature.currentMp / creature.maxMp;
      this.add.rectangle(barX, y + 8, 70, 4, 0x333333).setOrigin(0);
      this.add.rectangle(barX, y + 8, 70 * mpPct, 4, 0x4466aa).setOrigin(0);
      this.add.text(barX, y + 15, `MP:${creature.currentMp}/${creature.maxMp}`, {
        fontSize: '8px', color: '#6688aa', fontFamily: 'monospace',
      }).setOrigin(0);
    }

    // Status effects
    const statuses = creature.statusEffects.map(s => s.type.substring(0, 3).toUpperCase()).join(' ');
    if (statuses) {
      this.add.text(x, y + 35, statuses, {
        fontSize: '9px', color: '#ff8888', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    // KO marker
    if (creature.isKnockedOut) {
      this.add.text(x, y, 'KO', {
        fontSize: '18px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);
    }
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
}
