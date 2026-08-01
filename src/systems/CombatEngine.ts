import {
  CombatCreature, Ability, AbilityEffect, BaseStats, StatName, StatusType,
  BUFF_MULTIPLIERS, RESISTANCE_MULTIPLIER, WEAKNESS_MULTIPLIER,
  CRIT_MULTIPLIER, MIN_HIT_CHANCE,
  DamageType,
} from '../types';
import { RandomSource } from './SeededRandom';

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

/**
 * Deterministic damage core: stat matchup, power, and the optional type
 * multiplier. No RNG — no hit roll, no crit, no accuracy weighting.
 * Shared by calculateDamage (which layers accuracy and conditional crits on top) and the AI's
 * estimateDamage (which layers accuracy on top).
 *
 * `useTypeMultiplier` is false when the caller must not assume knowledge of the
 * defender's resistances — that is how the AI's knowledge fog is enforced.
 */
export function baseDamage(
  attacker: CombatCreature,
  defender: CombatCreature,
  ability: Ability,
  useTypeMultiplier: boolean,
): number {
  if (ability.power === 0) return 0;

  const isPhysical = ability.category === 'Physical';
  const atkStat = isPhysical ? getEffectiveStat(attacker, 'str') : getEffectiveStat(attacker, 'int');
  const defStat = isPhysical ? getEffectiveStat(defender, 'def') : getEffectiveStat(defender, 'wis');

  // Core formula: (ATK - DEF/2) * (Power/50) * TypeMult
  let damage = Math.max(1, atkStat - defStat / 2) * (ability.power / 50);

  if (useTypeMultiplier && ability.damageType !== 'None') {
    const dmgType = ability.damageType as DamageType;
    if (defender.instance.resistances.includes(dmgType)) {
      damage *= RESISTANCE_MULTIPLIER;
    } else if (defender.instance.weaknesses.includes(dmgType)) {
      damage *= WEAKNESS_MULTIPLIER;
    }
  }

  return damage;
}

/** Roll an ability's configured accuracy, respecting the global minimum hit chance. */
export function rollAbilityHit(ability: Ability, rng: RandomSource = Math.random): boolean {
  const hitChance = Math.max(MIN_HIT_CHANCE, ability.accuracy / 100);
  return rng() <= hitChance;
}

export function calculateDamage(
  attacker: CombatCreature,
  defender: CombatCreature,
  ability: Ability,
  rng: RandomSource = Math.random,
): { damage: number; isCrit: boolean; missed: boolean } {
  // Check hit — this roll must stay first to preserve the RNG stream.
  if (!rollAbilityHit(ability, rng)) {
    return { damage: 0, isCrit: false, missed: true };
  }

  if (ability.power === 0) return { damage: 0, isCrit: false, missed: false };

  let damage = baseDamage(attacker, defender, ability, true);

  const isCrit = meetsCriticalCondition(defender, ability);
  if (isCrit) damage *= CRIT_MULTIPLIER;

  return { damage: Math.max(1, Math.floor(damage)), isCrit, missed: false };
}

/** Criticals are authored state checks, never a random roll. */
export function meetsCriticalCondition(defender: CombatCreature, ability: Ability): boolean {
  switch (ability.critCondition) {
    case 'target_statused':
      return defender.statusEffects.length > 0;
    case 'target_debuffed':
      return Object.values(defender.buffStages).some(stage => (stage ?? 0) < 0);
    case 'target_below_half':
      return defender.currentHp * 2 < defender.maxHp;
    default:
      return false;
  }
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

/**
 * Bring a knocked-out creature back. Returns false — and changes nothing — when
 * the target is still standing, so a caller can refuse the item rather than
 * consuming it for no effect.
 *
 * The HP floor of 1 matters: a low fraction against a low-HP creature otherwise
 * floors to 0, which would revive someone directly back into a knockout.
 */
export function revive(target: CombatCreature, hpFraction: number, mpFraction: number): boolean {
  if (!target.isKnockedOut) return false;
  target.isKnockedOut = false;
  target.currentHp = Math.max(1, Math.min(target.maxHp, Math.floor(target.maxHp * hpFraction)));
  // Never LOWER MP: a knock-out only zeroes HP, so a creature felled at full MP
  // keeps it, and a revive item must not turn into a stat penalty for whoever
  // was carrying the most MP when they went down.
  target.currentMp = Math.min(target.maxMp, Math.max(target.currentMp, Math.floor(target.maxMp * mpFraction)));
  return true;
}

/** Remove every status, reporting what was cleared. All statuses are negative today. */
export function clearNegativeStatuses(target: CombatCreature): StatusType[] {
  const removed = target.statusEffects.map(s => s.type);
  target.statusEffects = [];
  return removed;
}

/**
 * Zero out positive stat stages only, reporting which stats were cleared.
 *
 * Leaving negative stages untouched is the point: this counters a buffed elite,
 * it is not a cleanse. Clearing debuffs too would hand the enemy a favour.
 */
export function stripPositiveStages(target: CombatCreature): StatName[] {
  const cleared: StatName[] = [];
  for (const stat of Object.keys(target.buffStages) as StatName[]) {
    if ((target.buffStages[stat] ?? 0) > 0) {
      target.buffStages[stat] = 0;
      cleared.push(stat);
    }
  }
  return cleared;
}

/**
 * Damage as a fraction of the target's maximum HP, returning the damage actually
 * dealt (capped at the target's remaining HP).
 *
 * Deliberately bypasses `calculateDamage`: ignoring DEF and the type chart is
 * exactly what earns a fixed-damage item a backpack slot when the party's
 * abilities are being resisted, and is why it cannot just be a zero-MP ability.
 */
export function applyPercentDamage(target: CombatCreature, fraction: number): number {
  const intended = Math.max(1, Math.floor(target.maxHp * fraction));
  const dealt = Math.min(intended, target.currentHp);
  applyDamage(target, intended);
  return dealt;
}

export function applyAbilityEffects(
  ability: Ability,
  user: CombatCreature,
  target: CombatCreature,
  damage: number,
  rng: RandomSource = Math.random,
): string[] {
  const messages: string[] = [];
  if (!ability.effects) return messages;

  for (const effect of ability.effects) {
    const chance = effect.chance ?? 1;
    if (rng() > chance) continue;

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

/** Enemy-targeting abilities are hostile; self and ally abilities are friendly. */
export function isHostileAbility(ability: Ability): boolean {
  return ability.targeting === 'single_enemy' || ability.targeting === 'all_enemies';
}

/**
 * Resolve a zero-power status, buff, debuff, or heal.
 *
 * Hostile abilities roll their configured accuracy. Friendly abilities remain
 * guaranteed, matching their existing behavior. The scene calls this once per
 * target, so future area debuffs get an independent hit roll for each target.
 */
export function resolveNonDamagingAbility(
  ability: Ability,
  user: CombatCreature,
  target: CombatCreature,
  rng: RandomSource = Math.random,
): { missed: boolean; messages: string[] } {
  if (isHostileAbility(ability) && !rollAbilityHit(ability, rng)) {
    return { missed: true, messages: [] };
  }

  const effectTarget = ability.targeting === 'self' ? user : target;
  return {
    missed: false,
    messages: applyAbilityEffects(ability, user, effectTarget, 0, rng),
  };
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

export function createCombatCreature(
  instance: any,
  template: any,
  isPlayer: boolean,
  currentHp?: number,
  currentMp?: number,
  maxHpOverride?: number,
): CombatCreature {
  return {
    instance,
    template,
    currentHp: currentHp ?? maxHpOverride ?? instance.currentStats.hp,
    maxHp: maxHpOverride ?? instance.currentStats.hp,
    currentMp: currentMp ?? instance.currentStats.mp,
    maxMp: instance.currentStats.mp,
    buffStages: {},
    statusEffects: [],
    isKnockedOut: (currentHp ?? instance.currentStats.hp) <= 0,
    isPlayerOwned: isPlayer,
  };
}
