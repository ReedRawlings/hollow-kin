import {
  CombatCreature, Ability, CombatAction, TacticProfile, KnownSpecies, StatName,
} from '../types';
import { getAbility } from '../data/abilities';
import { baseDamage, getEffectiveStat } from './CombatEngine';

/** A side that may not exploit any weaknesses. */
export const NO_KNOWLEDGE: KnownSpecies = new Set<string>();

/**
 * Expected damage, deterministically. Weights by accuracy instead of rolling a
 * hit, and applies the type multiplier only for species the side has already
 * met — that is where the knowledge fog lives.
 */
export function estimateDamage(
  actor: CombatCreature,
  foe: CombatCreature,
  ability: Ability,
  known: KnownSpecies,
): number {
  if (ability.power === 0) return 0;
  const hitChance = Math.max(0.3, ability.accuracy / 100);
  const raw = baseDamage(actor, foe, ability, known.has(foe.instance.speciesId));
  return Math.max(1, Math.floor(raw * hitChance));
}

// ---------- small helpers ----------

function living(list: CombatCreature[]): CombatCreature[] {
  return list.filter(c => !c.isKnockedOut);
}

function hpFraction(c: CombatCreature): number {
  return c.maxHp > 0 ? c.currentHp / c.maxHp : 0;
}

/** Every ability the actor can select, with basic_attack always available. */
function abilityList(actor: CombatCreature): Ability[] {
  const ids = actor.instance.abilities.filter((id): id is string => id !== null);
  if (!ids.includes('basic_attack')) ids.push('basic_attack');
  return ids.map(id => getAbility(id));
}

function affordable(actor: CombatCreature, ability: Ability): boolean {
  return ability.mpCost <= actor.currentMp;
}

interface Option {
  abilityId: string;
  target: CombatCreature;
  damage: number;
  mpCost: number;
  /** True for all_enemies options, whose `damage` is a party-wide total. */
  isSpread: boolean;
}

/**
 * Every affordable damaging option. Deterministic: iteration follows the
 * actor's ability order, then the foe list order.
 */
function damageCandidates(
  actor: CombatCreature,
  foes: CombatCreature[],
  known: KnownSpecies,
): Option[] {
  const alive = living(foes);
  const out: Option[] = [];
  for (const ability of abilityList(actor)) {
    if (ability.power <= 0 || !affordable(actor, ability)) continue;
    if (ability.targeting === 'all_enemies') {
      const total = alive.reduce((sum, f) => sum + estimateDamage(actor, f, ability, known), 0);
      out.push({
        abilityId: ability.id, target: alive[0], damage: total,
        mpCost: ability.mpCost, isSpread: true,
      });
    } else if (ability.targeting === 'single_enemy') {
      for (const f of alive) {
        out.push({
          abilityId: ability.id, target: f, damage: estimateDamage(actor, f, ability, known),
          mpCost: ability.mpCost, isSpread: false,
        });
      }
    }
  }
  return out;
}

/**
 * Picks the best option by `score`, higher wins. Ties break on lower MP cost,
 * then lower target HP, then abilityId, then — since two same-species foes at
 * identical HP targeted by the same ability tie on all three of those —
 * lexicographically-lower target.instance.instanceId. instanceId is unique
 * per creature instance, so this final key is guaranteed to break every tie:
 * the chain is total, and the result never depends on iteration order.
 */
function bestBy(options: Option[], score: (o: Option) => number): Option | null {
  let best: Option | null = null;
  let bestScore = -Infinity;
  for (const o of options) {
    const s = score(o);
    if (best === null || s > bestScore) {
      best = o; bestScore = s; continue;
    }
    if (s < bestScore) continue;
    // tie-break chain
    if (o.mpCost !== best.mpCost) {
      if (o.mpCost < best.mpCost) best = o;
      continue;
    }
    if (o.target.currentHp !== best.target.currentHp) {
      if (o.target.currentHp < best.target.currentHp) best = o;
      continue;
    }
    if (o.abilityId !== best.abilityId) {
      if (o.abilityId < best.abilityId) best = o;
      continue;
    }
    if (o.target.instance.instanceId < best.target.instance.instanceId) best = o;
  }
  return best;
}

function toAction(o: Option | null): CombatAction | null {
  return o ? { kind: 'ability', abilityId: o.abilityId, target: o.target } : null;
}

// ---------- profiles ----------

/**
 * Literal port of the original getEnemyAction. Deliberately dumb: random living
 * target, strongest affordable non-Status ability by raw power, else basic
 * attack. Consumes exactly one Math.random call — the one deliberate exception
 * to the AI's no-RNG rule, kept so enemy behavior is unchanged.
 */
function enemyDefault(actor: CombatCreature, foes: CombatCreature[]): CombatAction {
  const aliveTargets = foes.filter(c => !c.isKnockedOut);
  const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];

  const usable = actor.instance.abilities
    .filter((id): id is string => id !== null)
    .map(id => getAbility(id))
    .filter(a => a.mpCost <= actor.currentMp && a.category !== 'Status');

  if (usable.length > 0) {
    usable.sort((a, b) => b.power - a.power);
    return { kind: 'ability', abilityId: usable[0].id, target };
  }
  return { kind: 'ability', abilityId: 'basic_attack', target };
}

/** Last-resort action: swing with basic attack at the weakest living foe. */
function fallback(actor: CombatCreature, foes: CombatCreature[], known: KnownSpecies): CombatAction {
  const basic = damageCandidates(actor, foes, known)
    .filter(o => o.abilityId === 'basic_attack');
  return toAction(bestBy(basic, o => o.damage)) ?? { kind: 'defend' };
}

/**
 * Decide what `actor` does this turn. Side-agnostic: `allies` is the actor's own
 * side (including itself) and `foes` is the opposing side. Returns an action —
 * never mutates anything.
 */
export function chooseAction(
  actor: CombatCreature,
  allies: CombatCreature[],
  foes: CombatCreature[],
  profile: TacticProfile,
  known: KnownSpecies,
): CombatAction {
  if (living(foes).length === 0) return { kind: 'defend' };

  switch (profile) {
    case 'enemy_default':
      return enemyDefault(actor, foes);
    default:
      // Remaining profiles land in Tasks 7 and 8.
      return fallback(actor, foes, known);
  }
}

/**
 * Thin compatibility wrapper. Enemy decisions come from the enemy_default
 * profile above, which is a literal port of the logic that used to live in
 * CombatEngine.ts — CombatEngine.test.ts pins the behavior. Lives here rather
 * than in CombatEngine to keep the module dependency one-way (TacticsAI ->
 * CombatEngine), since this module already imports baseDamage/getEffectiveStat
 * from CombatEngine.
 *
 * DELIBERATE DIVERGENCE from the pre-port `getEnemyAction`, empty-foes branch
 * only: when every entry in `playerParty` is knocked out, this now returns
 * `{ abilityId: 'basic_attack', target: playerParty[0] }` (a defined, if
 * knocked-out, target) and consumes zero `Math.random()` calls.
 *
 * The pre-port code had no explicit empty-foes check. It indexed an empty
 * array directly — `livingTargets[Math.floor(Math.random() * livingTargets.length)]`
 * with `livingTargets.length === 0` — which still burned one `Math.random()`
 * call, evaluated to `[][0]` = `undefined`, and then went on to pick the
 * enemy's actual strongest affordable ability (not necessarily 'basic_attack')
 * paired with that `undefined` target.
 *
 * `target: undefined` is a latent crash: any caller dereferencing
 * `target.template.name` (or similar) throws. The new behavior trades an
 * unpinned RNG call and an arbitrary ability id for a target that is always a
 * real CombatCreature — strictly safer. This branch is unreachable in the
 * live game today: `CombatScene.nextTurn` ends the battle via
 * `playerParty.every(c => c.isKnockedOut)` before any enemy turn can run with
 * an all-knocked-out party. Do NOT restore the old undefined-target behavior;
 * see the "all foes knocked out" test in CombatEngine.test.ts, which pins
 * this post-port contract.
 */
export function getEnemyAction(
  enemy: CombatCreature,
  playerParty: CombatCreature[],
): { abilityId: string; target: CombatCreature } {
  const action = chooseAction(enemy, [enemy], playerParty, 'enemy_default', NO_KNOWLEDGE);
  if (action.kind === 'defend') {
    return { abilityId: 'basic_attack', target: playerParty[0] };
  }
  return { abilityId: action.abilityId, target: action.target };
}
