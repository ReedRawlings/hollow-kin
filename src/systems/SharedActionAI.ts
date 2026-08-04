import { getAbility } from '../data/abilities';
import { CombatAction, CombatCreature, KnownSpecies } from '../types';
import { sharedActionAbilityCost } from './BattleChamber';
import { estimateDamage } from './TacticsAI';

interface Candidate {
  action: CombatAction;
  score: number;
  cost: number;
}

/**
 * Chamber-only greedy policy for the Shared AP experiment.
 *
 * It deliberately never reads currentMp or mpCost for legality, budgeting, or
 * tie-breaking. The production tactics profiles remain authoritative for MP
 * combat; this policy exists so an AP simulation actually tests AP.
 */
export function chooseSharedAction(
  actor: CombatCreature,
  allies: CombatCreature[],
  foes: CombatCreature[],
  availablePoints: number,
  known: KnownSpecies,
): CombatAction | null {
  const livingFoes = foes.filter(foe => !foe.isKnockedOut);
  if (livingFoes.length === 0) return null;

  const ids = actor.instance.abilities.filter((id): id is string => id !== null);
  if (!ids.includes('basic_attack')) ids.push('basic_attack');
  const abilities = [...new Set(ids)]
    .map(getAbility)
    .filter(ability => sharedActionAbilityCost(ability) <= availablePoints);

  const hurtAllies = allies
    .filter(ally => !ally.isKnockedOut && ally.currentHp < ally.maxHp * 0.3)
    .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp));
  if (hurtAllies.length > 0) {
    const heal = abilities.find(ability => ability.effects?.some(effect => effect.type === 'heal'));
    if (heal) {
      const target = heal.targeting === 'self' ? actor : hurtAllies[0];
      return { kind: 'ability', abilityId: heal.id, target };
    }
  }

  const candidates: Candidate[] = [];
  for (const ability of abilities) {
    if (ability.power <= 0) continue;
    const cost = sharedActionAbilityCost(ability);
    if (ability.targeting === 'all_enemies') {
      candidates.push({
        action: { kind: 'ability', abilityId: ability.id, target: livingFoes[0] },
        score: livingFoes.reduce(
          (sum, foe) => sum + estimateDamage(actor, foe, ability, known), 0,
        ),
        cost,
      });
      continue;
    }
    if (ability.targeting !== 'single_enemy') continue;
    for (const foe of livingFoes) {
      const damage = estimateDamage(actor, foe, ability, known);
      candidates.push({
        action: { kind: 'ability', abilityId: ability.id, target: foe },
        score: damage + (damage >= foe.currentHp ? 10_000 : 0),
        cost,
      });
    }
  }

  candidates.sort((a, b) =>
    b.score - a.score
    || a.cost - b.cost
    || a.action.abilityId.localeCompare(b.action.abilityId)
    || a.action.target.instance.instanceId.localeCompare(b.action.target.instance.instanceId));
  return candidates[0]?.action ?? null;
}
