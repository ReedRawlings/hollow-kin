import { CombatCreature, CreatureInstance, RunState } from '../types';
import { ItemDefinition } from '../data/items';
import {
  applyBuffDebuff, applyHeal, applyPercentDamage, clearNegativeStatuses,
  revive, stripPositiveStages,
} from './CombatEngine';
import { applyTargetedRecovery, canReceiveRecovery, reviveOnRun } from './Recovery';

/**
 * Resolving a carried item — the one place that knows what each effect does.
 *
 * Two entry points rather than one, because combat and the run map genuinely
 * hold different state: combat has `CombatCreature` (currentHp, buffStages,
 * statusEffects), the map has `CreatureInstance` plus RunState's partyHp/partyMp/
 * partyKO. The codebase already splits along that seam — CombatEngine on one
 * side, Recovery on the other — so this module follows it instead of inventing
 * an adapter to hide it.
 *
 * Nothing here ends a battle or a run. Extraction items resolve to an OUTCOME the
 * scene acts on, which keeps this module pure, Phaser-free and unit-testable.
 *
 * Consumption is the CALLER's job, and only on a non-`refused` outcome — the same
 * "don't take payment for what you can't deliver" rule `tryBuyItem` follows.
 */

/** Where a use is being attempted. `isBoss` is only meaningful in combat. */
export interface ItemContext {
  where: 'combat' | 'map';
  isBoss: boolean;
}

export type ItemOutcome =
  | { kind: 'applied'; message: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'escape_battle' }
  | { kind: 'depart' };

/** Is this item offerable in this context at all? Drives both UIs' menus. */
export function canUseItem(def: ItemDefinition, ctx: ItemContext): boolean {
  switch (def.usableIn) {
    case 'both': return true;
    case 'map': return ctx.where === 'map';
    case 'combat': return ctx.where === 'combat';
    case 'combat_non_boss': return ctx.where === 'combat' && !ctx.isBoss;
  }
}

const WRONG_PLACE = 'Not here.';
const NO_TARGET = 'Nothing to use it on.';

/** Resolve against combat state. `target` is null for effects that take none. */
export function applyItemInCombat(
  def: ItemDefinition,
  target: CombatCreature | null,
  ctx: ItemContext,
): ItemOutcome {
  if (!canUseItem(def, ctx)) return { kind: 'refused', reason: WRONG_PLACE };

  const name = target?.template.name ?? '';

  switch (def.effect.kind) {
    case 'heal': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      if (target.currentHp >= target.maxHp) return { kind: 'refused', reason: `${name} is unhurt.` };
      const healed = applyHeal(target, def.effect.amount);
      return { kind: 'applied', message: `${name} recovers ${healed} HP.` };
    }
    case 'restore_mp': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      if (target.currentMp >= target.maxMp) return { kind: 'refused', reason: `${name} is clear-headed.` };
      const before = target.currentMp;
      target.currentMp = Math.min(target.maxMp, before + Math.floor(target.maxMp * def.effect.amount));
      return { kind: 'applied', message: `${name} recovers ${target.currentMp - before} MP.` };
    }
    case 'revive': {
      if (!target) return { kind: 'refused', reason: NO_TARGET };
      if (!revive(target, def.effect.hpAmount, def.effect.mpAmount)) {
        return { kind: 'refused', reason: `${name} is still standing.` };
      }
      return { kind: 'applied', message: `${name} wakes.` };
    }
    case 'cure_status': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      const removed = clearNegativeStatuses(target);
      if (!removed.length) return { kind: 'refused', reason: `${name} is unafflicted.` };
      return { kind: 'applied', message: `${name} is cleansed of ${removed.join(', ')}.` };
    }
    case 'buff': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      applyBuffDebuff(target, def.effect.stat, def.effect.stages);
      return { kind: 'applied', message: `${name}'s ${def.effect.stat.toUpperCase()} rises.` };
    }
    case 'percent_damage': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      const fraction = ctx.isBoss ? def.effect.bossFraction : def.effect.fraction;
      const dealt = applyPercentDamage(target, fraction);
      return { kind: 'applied', message: `${name} takes ${dealt} damage.` };
    }
    case 'strip_buffs': {
      if (!target || target.isKnockedOut) return { kind: 'refused', reason: NO_TARGET };
      const cleared = stripPositiveStages(target);
      if (!cleared.length) return { kind: 'refused', reason: `${name} has no advantage to strip.` };
      return { kind: 'applied', message: `${name} loses its edge.` };
    }
    case 'escape_battle':
      return { kind: 'escape_battle' };
    case 'depart':
      return { kind: 'refused', reason: WRONG_PLACE };
  }
}

/**
 * Resolve against run state.
 *
 * Every combat-only effect is REFUSED here rather than falling through to a
 * no-op. A refusal is a bug caught; a no-op is an item consumed for nothing.
 */
export function applyItemOnMap(
  def: ItemDefinition,
  target: CreatureInstance | null,
  run: RunState,
): ItemOutcome {
  if (!canUseItem(def, { where: 'map', isBoss: false })) {
    return { kind: 'refused', reason: WRONG_PLACE };
  }

  const name = target?.nickname ?? target?.speciesId ?? '';

  switch (def.effect.kind) {
    case 'heal': {
      if (!target || !canReceiveRecovery('hp', target, run)) {
        return { kind: 'refused', reason: NO_TARGET };
      }
      const healed = applyTargetedRecovery('hp', def.effect.amount, target, run);
      return { kind: 'applied', message: `${name} recovers ${healed} HP.` };
    }
    case 'restore_mp': {
      if (!target || !canReceiveRecovery('mp', target, run)) {
        return { kind: 'refused', reason: NO_TARGET };
      }
      const restored = applyTargetedRecovery('mp', def.effect.amount, target, run);
      return { kind: 'applied', message: `${name} recovers ${restored} MP.` };
    }
    case 'revive': {
      if (!target || !reviveOnRun(target, run, def.effect.hpAmount, def.effect.mpAmount)) {
        return { kind: 'refused', reason: 'No one has fallen.' };
      }
      return { kind: 'applied', message: `${name} wakes.` };
    }
    case 'depart':
      return { kind: 'depart' };
    // Combat-only effects. Listed rather than defaulted so that adding an effect
    // kind is a compile error here, not a silent map no-op.
    case 'cure_status':
    case 'buff':
    case 'percent_damage':
    case 'strip_buffs':
    case 'escape_battle':
      return { kind: 'refused', reason: WRONG_PLACE };
  }
}
