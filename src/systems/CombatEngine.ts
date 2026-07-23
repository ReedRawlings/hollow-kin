import {
  CombatCreature, Ability, AbilityEffect, BaseStats, StatName,
  BUFF_MULTIPLIERS, RESISTANCE_MULTIPLIER, WEAKNESS_MULTIPLIER,
  CRIT_MULTIPLIER, BASE_CRIT_RATE, HIGH_CRIT_RATE, MIN_HIT_CHANCE,
  DamageType,
} from '../types';
import { getAbility } from '../data/abilities';

export function calculateTurnOrder(combatants: CombatCreature[]): CombatCreature[] {
  const alive = combatants.filter(c => !c.isKnockedOut);
  return alive.sort((a, b) => getEffectiveStat(b, 'spd') - getEffectiveStat(a, 'spd'));
}

export function getEffectiveStat(creature: CombatCreature, stat: StatName): number {
  const base = creature.instance.currentStats[stat];
  const stage = creature.buffStages[stat] ?? 0;
  const mult = BUFF_MULTIPLIERS[stage] ?? 1;
  return Math.floor(base * mult);
}

export function calculateDamage(
  attacker: CombatCreature,
  defender: CombatCreature,
  ability: Ability,
): { damage: number; isCrit: boolean; missed: boolean } {
  // Check hit
  const hitChance = Math.max(MIN_HIT_CHANCE, ability.accuracy / 100);
  if (Math.random() > hitChance) {
    return { damage: 0, isCrit: false, missed: true };
  }

  if (ability.power === 0) return { damage: 0, isCrit: false, missed: false };

  const isPhysical = ability.category === 'Physical';
  const atkStat = isPhysical ? getEffectiveStat(attacker, 'str') : getEffectiveStat(attacker, 'int');
  const defStat = isPhysical ? getEffectiveStat(defender, 'def') : getEffectiveStat(defender, 'wis');

  // Core formula: (ATK - DEF/2) * (Power/50) * TypeMult
  let damage = Math.max(1, atkStat - defStat / 2) * (ability.power / 50);

  // Type multiplier
  if (ability.damageType !== 'None') {
    const dmgType = ability.damageType as DamageType;
    if (defender.instance.resistances.includes(dmgType)) {
      damage *= RESISTANCE_MULTIPLIER;
    } else if (defender.instance.weaknesses.includes(dmgType)) {
      damage *= WEAKNESS_MULTIPLIER;
    }
  }

  // Crit check (player only)
  let isCrit = false;
  if (attacker.isPlayerOwned) {
    const critRate = ability.highCrit ? HIGH_CRIT_RATE : BASE_CRIT_RATE;
    const spdBonus = getEffectiveStat(attacker, 'spd') / 1000;
    if (Math.random() < critRate + spdBonus) {
      isCrit = true;
      damage *= CRIT_MULTIPLIER;
    }
  }

  // Defend halves damage
  if (defender.isDefending) {
    damage *= 0.5;
  }

  return { damage: Math.max(1, Math.floor(damage)), isCrit, missed: false };
}

export function applyDamage(target: CombatCreature, damage: number): void {
  target.currentHp = Math.max(0, target.currentHp - damage);
  if (target.currentHp <= 0) {
    target.isKnockedOut = true;
    target.currentHp = 0;
  }
}

export function applyHeal(target: CombatCreature, percentage: number): number {
  const healAmount = Math.floor(target.maxHp * percentage);
  const actualHeal = Math.min(healAmount, target.maxHp - target.currentHp);
  target.currentHp += actualHeal;
  return actualHeal;
}

export function applyBuffDebuff(target: CombatCreature, stat: StatName, stages: number): void {
  const current = target.buffStages[stat] ?? 0;
  target.buffStages[stat] = Math.max(-3, Math.min(3, current + stages));
}

export function applyAbilityEffects(
  ability: Ability,
  user: CombatCreature,
  target: CombatCreature,
  damage: number,
): string[] {
  const messages: string[] = [];
  if (!ability.effects) return messages;

  for (const effect of ability.effects) {
    const chance = effect.chance ?? 1;
    if (Math.random() > chance) continue;

    switch (effect.type) {
      case 'buff':
        if (effect.stat && effect.stages) {
          applyBuffDebuff(target, effect.stat, effect.stages);
          const dir = effect.stages > 0 ? 'rose' : 'fell';
          messages.push(`${target.template.name}'s ${effect.stat.toUpperCase()} ${dir}!`);
        }
        break;
      case 'debuff':
        if (effect.stat && effect.stages) {
          applyBuffDebuff(target, effect.stat, effect.stages);
          const dir = effect.stages > 0 ? 'rose' : 'fell';
          messages.push(`${target.template.name}'s ${effect.stat.toUpperCase()} ${dir}!`);
        }
        break;
      case 'status':
        if (effect.status) {
          const existing = target.statusEffects.find(s => s.type === effect.status);
          if (!existing) {
            const dur = effect.status === 'freeze' || effect.status === 'stun' ? 1 : 3;
            target.statusEffects.push({ type: effect.status, turnsRemaining: dur });
            messages.push(`${target.template.name} is ${effect.status}ed!`);
          }
        }
        break;
      case 'heal':
        if (effect.value) {
          const healed = applyHeal(
            ability.targeting === 'self' ? user : target,
            effect.value,
          );
          const healTarget = ability.targeting === 'self' ? user : target;
          messages.push(`${healTarget.template.name} recovered ${healed} HP!`);
        }
        break;
      case 'recoil':
        if (effect.value && damage > 0) {
          const recoil = Math.floor(damage * effect.value);
          applyDamage(user, recoil);
          messages.push(`${user.template.name} took ${recoil} recoil damage!`);
        }
        break;
    }
  }
  return messages;
}

export function tickStatusEffects(creature: CombatCreature): string[] {
  const messages: string[] = [];
  const remaining: typeof creature.statusEffects = [];

  for (const status of creature.statusEffects) {
    switch (status.type) {
      case 'poison': {
        const dmg = Math.max(1, Math.floor(creature.maxHp * 0.08));
        applyDamage(creature, dmg);
        messages.push(`${creature.template.name} took ${dmg} poison damage!`);
        break;
      }
      case 'burn': {
        const dmg = Math.max(1, Math.floor(creature.maxHp * 0.06));
        applyDamage(creature, dmg);
        messages.push(`${creature.template.name} took ${dmg} burn damage!`);
        break;
      }
    }

    status.turnsRemaining--;
    if (status.turnsRemaining > 0) {
      remaining.push(status);
    } else {
      messages.push(`${creature.template.name} is no longer ${status.type}ed.`);
    }
  }

  creature.statusEffects = remaining;
  return messages;
}

export function isSkipTurn(creature: CombatCreature): boolean {
  return creature.statusEffects.some(
    s => s.type === 'freeze' || s.type === 'stun' || s.type === 'sleep'
  );
}

export function getEnemyAction(
  enemy: CombatCreature,
  playerParty: CombatCreature[],
): { abilityId: string; target: CombatCreature } {
  const aliveTargets = playerParty.filter(c => !c.isKnockedOut);
  const target = aliveTargets.reduce((lowest, c) =>
    c.currentHp < lowest.currentHp ? c : lowest, aliveTargets[0]);

  // Pick strongest usable ability
  const usable = enemy.instance.abilities
    .filter((id): id is string => id !== null)
    .map(id => getAbility(id))
    .filter(a => a.mpCost <= enemy.currentMp && a.category !== 'Status');

  if (usable.length > 0) {
    usable.sort((a, b) => b.power - a.power);
    return { abilityId: usable[0].id, target };
  }

  return { abilityId: 'basic_attack', target };
}

export function createCombatCreature(
  instance: any,
  template: any,
  isPlayer: boolean,
  currentHp?: number,
  currentMp?: number,
): CombatCreature {
  return {
    instance,
    template,
    currentHp: currentHp ?? instance.currentStats.hp,
    maxHp: instance.currentStats.hp,
    currentMp: currentMp ?? instance.currentStats.mp,
    maxMp: instance.currentStats.mp,
    buffStages: {},
    statusEffects: [],
    isKnockedOut: (currentHp ?? instance.currentStats.hp) <= 0,
    isDefending: false,
    isPlayerOwned: isPlayer,
  };
}
