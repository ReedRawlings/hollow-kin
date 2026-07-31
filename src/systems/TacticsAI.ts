import {
  CombatCreature, Ability, CombatAction, TacticProfile, KnownSpecies, StatName,
  MIN_HIT_CHANCE,
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
  const hitChance = Math.max(MIN_HIT_CHANCE, ability.accuracy / 100);
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

interface HealOption {
  abilityId: string;
  target: CombatCreature;
  mpCost: number;
  /** Fraction of the target's max HP restored. */
  value: number;
}

/**
 * Every affordable heal the actor can cast, paired with each ally it can reach.
 * `mend` (targeting 'self') reaches only the actor; `soothe` (targeting
 * 'single_ally') reaches any living ally, the actor included.
 */
function healCandidates(actor: CombatCreature, allies: CombatCreature[]): HealOption[] {
  const out: HealOption[] = [];
  for (const ability of abilityList(actor)) {
    if (!affordable(actor, ability)) continue;
    const heal = ability.effects?.find(e => e.type === 'heal');
    if (!heal?.value) continue;

    if (ability.targeting === 'self') {
      out.push({ abilityId: ability.id, target: actor, mpCost: ability.mpCost, value: heal.value });
    } else if (ability.targeting === 'single_ally' || ability.targeting === 'all_allies') {
      for (const ally of living(allies)) {
        out.push({ abilityId: ability.id, target: ally, mpCost: ability.mpCost, value: heal.value });
      }
    }
  }
  return out;
}

/**
 * The heal that best serves the most-hurt ally under `threshold`. Prefers the
 * lowest-HP recipient, then the largest heal, then the cheapest, then abilityId.
 */
function bestHeal(
  actor: CombatCreature,
  allies: CombatCreature[],
  threshold: number,
): HealOption | null {
  const needy = living(allies).filter(a => hpFraction(a) <= threshold);
  if (needy.length === 0) return null;

  const options = healCandidates(actor, allies)
    .filter(o => needy.includes(o.target) && o.target.currentHp < o.target.maxHp);
  if (options.length === 0) return null;

  let best = options[0];
  for (const o of options.slice(1)) {
    const a = hpFraction(o.target);
    const b = hpFraction(best.target);
    if (a !== b) { if (a < b) best = o; continue; }
    if (o.value !== best.value) { if (o.value > best.value) best = o; continue; }
    if (o.mpCost !== best.mpCost) { if (o.mpCost < best.mpCost) best = o; continue; }
    if (o.abilityId < best.abilityId) best = o;
  }
  return best;
}

function healAction(o: HealOption | null): CombatAction | null {
  return o ? { kind: 'ability', abilityId: o.abilityId, target: o.target } : null;
}

/** Options that would drop their target this turn. Spread hits are excluded. */
function killers(options: Option[]): Option[] {
  return options.filter(o => !o.isSpread && o.damage >= o.target.currentHp);
}

/**
 * The MP cost of the actor's cheapest heal ability, ignoring affordability.
 * Unlike `healCandidates` (which filters to what the actor can currently pay
 * for), this looks at the actor's kit as a fact about the creature: it knows
 * a heal ability and has a reserve floor to protect for it, whether or not it
 * can currently afford to cast that heal. Returns null if the actor has no
 * heal ability at all, in which case there is nothing to reserve for.
 */
function cheapestHealCost(actor: CombatCreature): number | null {
  let cheapest: number | null = null;
  for (const ability of abilityList(actor)) {
    if (ability.targeting !== 'self' && ability.targeting !== 'single_ally'
      && ability.targeting !== 'all_allies') continue;
    const heal = ability.effects?.find(e => e.type === 'heal');
    if (!heal?.value) continue;
    if (cheapest === null || ability.mpCost < cheapest) cheapest = ability.mpCost;
  }
  return cheapest;
}

/** The cheapest affordable self-buff whose stat is still below +2. */
function buffAction(actor: CombatCreature): CombatAction | null {
  let best: Ability | null = null;
  for (const ability of abilityList(actor)) {
    if (ability.category !== 'Status' || ability.targeting !== 'self') continue;
    if (!affordable(actor, ability)) continue;
    const buffs = ability.effects?.filter(e => e.type === 'buff' && e.stat) ?? [];
    if (buffs.length === 0) continue;
    // Only worth casting if at least one of its stats has headroom below +2.
    const useful = buffs.some(e => (actor.buffStages[e.stat as StatName] ?? 0) < 2);
    if (!useful) continue;
    if (best === null || ability.mpCost < best.mpCost
      || (ability.mpCost === best.mpCost && ability.id < best.id)) {
      best = ability;
    }
  }
  return best ? { kind: 'ability', abilityId: best.id, target: actor } : null;
}

/** The cheapest affordable debuff against the strongest foe not already at -2. */
function debuffAction(actor: CombatCreature, foes: CombatCreature[]): CombatAction | null {
  const alive = living(foes);
  if (alive.length === 0) return null;

  // "Strongest" = highest effective STR, tie-broken on species id, then —
  // matching `bestBy`'s discipline — on target.instance.instanceId, so
  // iteration order can never decide the outcome.
  let strongest = alive[0];
  for (const f of alive.slice(1)) {
    const a = getEffectiveStat(f, 'str');
    const b = getEffectiveStat(strongest, 'str');
    if (a !== b) { if (a > b) strongest = f; continue; }
    if (f.instance.speciesId !== strongest.instance.speciesId) {
      if (f.instance.speciesId < strongest.instance.speciesId) strongest = f;
      continue;
    }
    if (f.instance.instanceId < strongest.instance.instanceId) strongest = f;
  }

  let best: Ability | null = null;
  for (const ability of abilityList(actor)) {
    if (ability.targeting !== 'single_enemy' || ability.power > 0) continue;
    if (!affordable(actor, ability)) continue;
    const debuffs = ability.effects?.filter(e => e.type === 'debuff' && e.stat) ?? [];
    if (debuffs.length === 0) continue;
    const useful = debuffs.some(e => (strongest.buffStages[e.stat as StatName] ?? 0) > -2);
    if (!useful) continue;
    if (best === null || ability.mpCost < best.mpCost
      || (ability.mpCost === best.mpCost && ability.id < best.id)) {
      best = ability;
    }
  }
  return best ? { kind: 'ability', abilityId: best.id, target: strongest } : null;
}

function conserveMp(
  actor: CombatCreature,
  allies: CombatCreature[],
  foes: CombatCreature[],
  known: KnownSpecies,
): CombatAction | null {
  // 1. Patch itself up when it is the one in danger.
  const selfHeal = healCandidates(actor, allies)
    .filter(o => o.target === actor && hpFraction(actor) <= 0.35 && actor.currentHp < actor.maxHp);
  if (selfHeal.length > 0) {
    const cheapest = selfHeal.reduce((a, b) => (b.mpCost < a.mpCost ? b : a));
    return healAction(cheapest)!;
  }

  // 2. Emergencies beat thrift.
  const rescue = healAction(bestHeal(actor, allies, 0.25));
  if (rescue) return rescue;

  const options = damageCandidates(actor, foes, known);

  // 3. A free kill is always worth taking.
  const freeKill = bestBy(killers(options).filter(o => o.mpCost === 0), o => o.damage);
  if (freeKill) return toAction(freeKill)!;

  // 4. Spend only while the party is under pressure.
  const underPressure = living(allies).some(a => hpFraction(a) <= 0.50);
  if (underPressure) {
    const paidKill = bestBy(killers(options), o => -o.mpCost);
    if (paidKill) return toAction(paidKill)!;

    // Hardest hit inside a third of max MP. Damage-per-MP would be wrong here:
    // the free basic attack always wins that ratio, so rule 4 would never
    // actually spend and the pressure gate would be dead code.
    const ceiling = Math.floor(actor.maxMp / 3);
    const affordableNow = options.filter(o => o.mpCost <= ceiling);
    const strongest = bestBy(affordableNow, o => o.damage);
    if (strongest) return toAction(strongest)!;
  }

  // 5. Save the MP.
  return fallback(actor, foes, known);
}

function healFirst(
  actor: CombatCreature,
  allies: CombatCreature[],
  foes: CombatCreature[],
  known: KnownSpecies,
): CombatAction | null {
  // 1. Keep the party standing.
  const heal = healAction(bestHeal(actor, allies, 0.60));
  if (heal) return heal;

  // 2. Nobody hurt — set the party up.
  const buff = buffAction(actor);
  if (buff) return buff;

  // 3. Take the edge off the biggest threat.
  const debuff = debuffAction(actor, foes);
  if (debuff) return debuff;

  // 4. Contribute damage, but never spend the MP that keeps the party alive.
  // The reserve floor comes from the actor's cheapest heal *ability*, not from
  // `healCandidates` (which filters by affordability) — otherwise, once MP
  // drops below the heal's own cost, the candidate list would go empty, the
  // gate would be skipped entirely, and the AI would spend most freely
  // exactly when it is most MP-starved. If the actor has no heal ability at
  // all, there is nothing to reserve for and the gate correctly does not apply.
  const cheapestHeal = cheapestHealCost(actor);
  if (cheapestHeal !== null && actor.currentMp < cheapestHeal * 2) {
    return fallback(actor, foes, known);
  }
  // Past the reserve check, spending is already sanctioned — so hit hardest
  // rather than most efficiently, for the same reason as Conserve MP's rule 4.
  const strongest = bestBy(damageCandidates(actor, foes, known), o => o.damage);
  if (strongest) return toAction(strongest)!;

  // Type-level exhaustiveness branch, not a fifth rule: `bestBy` returns
  // `Option | null`, so TypeScript requires this null case to be handled. It
  // cannot execute at runtime — basic_attack always costs 0 MP, so it always
  // survives the rule-4 reserve gate above and is always present in
  // `damageCandidates`, meaning `strongest` always resolves to at least
  // basic_attack once any foe is alive. Do not go looking for the conditions
  // that would trigger this; there are none.
  return fallback(actor, foes, known);
}

function fightWisely(
  actor: CombatCreature,
  allies: CombatCreature[],
  foes: CombatCreature[],
  known: KnownSpecies,
): CombatAction | null {
  // 1. Rescue an ally in real danger.
  const rescue = healAction(bestHeal(actor, allies, 0.30));
  if (rescue) return rescue;

  const options = damageCandidates(actor, foes, known);

  // 2. Close a kill as cheaply as possible.
  const kill = bestBy(killers(options), o => -o.mpCost);
  if (kill) return toAction(kill)!;

  // 3. Spread damage when it genuinely beats the best single hit.
  if (living(foes).length >= 2) {
    const spread = bestBy(options.filter(o => o.isSpread), o => o.damage);
    const single = bestBy(options.filter(o => !o.isSpread), o => o.damage);
    if (spread && single && spread.damage > single.damage) return toAction(spread)!;
  }

  // 4. Hit hardest within a self-imposed budget of half its CURRENT MP. This
  //    spends freely while MP is plentiful and tightens automatically as it
  //    drains. Basic attack, at 0 MP, is always inside the budget.
  //    (Deliberately not "best damage per MP": that scheme needs a
  //    divide-by-zero guard for 0-MP abilities — e.g. scoring basic_attack's
  //    cost as 1, not its real 0 — and with real numbers that guard makes
  //    basic_attack score 12/1=12 while thrash scores 45/5=9, beating nearly
  //    every paid ability and collapsing this tactic into a basic-attack bot.)
  const budget = Math.floor(actor.currentMp / 2);
  const withinBudget = options.filter(o => o.mpCost <= budget);
  const strongest = bestBy(withinBudget, o => o.damage);
  if (strongest) return toAction(strongest)!;

  // Type-level exhaustiveness branch, not a fifth rule: `bestBy` returns
  // `Option | null`, so TypeScript requires this null case to be handled.
  // It cannot execute at runtime — basic_attack always costs 0 MP, which is
  // always <= the rule-4 budget, so `withinBudget` (and thus `strongest`)
  // always contains at least basic_attack once any foe is alive. Do not go
  // looking for the conditions that would trigger this; there are none.
  return fallback(actor, foes, known);
}

function allOut(
  actor: CombatCreature,
  foes: CombatCreature[],
  known: KnownSpecies,
): CombatAction | null {
  const options = damageCandidates(actor, foes, known);

  // 1. Kill, hitting as hard as possible while doing it.
  const kill = bestBy(killers(options), o => o.damage);
  if (kill) return toAction(kill)!;

  // 2. Maximum damage, cost disregarded entirely.
  const hardest = bestBy(options, o => o.damage);
  if (hardest) return toAction(hardest)!;

  // Type-level exhaustiveness branch, not a third rule: same reasoning as
  // fightWisely's final branch above — basic_attack is free, so `options`
  // always has at least one entry once any foe is alive, and `hardest` is
  // never null. Do not go looking for the conditions that would trigger this.
  return fallback(actor, foes, known);
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

/**
 * Last-resort action: swing with basic attack at the weakest living foe.
 *
 * Returns null when there is nothing to swing at. This used to return a defend
 * action; defend was cut (2026-07-30), and null is the honest answer — "this
 * creature has no move this turn" — rather than inventing one. Callers skip
 * the turn.
 */
function fallback(
  actor: CombatCreature,
  foes: CombatCreature[],
  known: KnownSpecies,
): CombatAction | null {
  const basic = damageCandidates(actor, foes, known)
    .filter(o => o.abilityId === 'basic_attack');
  return toAction(bestBy(basic, o => o.damage)) ?? null;
}

/**
 * Decide what `actor` does this turn. Side-agnostic: `allies` is the actor's own
 * side (including itself) and `foes` is the opposing side. Returns an action —
 * never mutates anything.
 *
 * Returns **null** when the actor has no legal move — in practice only when every
 * foe is already knocked out, which means the battle is over and the caller should
 * simply end the turn. Callers must handle null rather than assuming an action.
 */
export function chooseAction(
  actor: CombatCreature,
  allies: CombatCreature[],
  foes: CombatCreature[],
  profile: TacticProfile,
  known: KnownSpecies,
): CombatAction | null {
  if (living(foes).length === 0) return null;

  switch (profile) {
    case 'enemy_default':
      return enemyDefault(actor, foes);
    case 'fight_wisely':
      return fightWisely(actor, allies, foes, known);
    case 'all_out':
      return allOut(actor, foes, known);
    case 'conserve_mp':
      return conserveMp(actor, allies, foes, known);
    case 'heal_first':
      return healFirst(actor, allies, foes, known);
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
  if (action === null) {
    return { abilityId: 'basic_attack', target: playerParty[0] };
  }
  return { abilityId: action.abilityId, target: action.target };
}
