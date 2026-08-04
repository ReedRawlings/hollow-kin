import { Ability } from '../types';

export type LinkMoveRole = 'attack' | 'buff' | 'debuff' | 'heal' | 'guard';

export interface LinkMoveSignature {
  abilityId: string;
  actorId: string;
  element: string | null;
  role: LinkMoveRole;
}

export interface LinkPredicate {
  element?: string;
  role?: LinkMoveRole;
}

export interface LinkArtRecipe {
  id: string;
  name: string;
  sequence: readonly LinkPredicate[];
  effect: string;
  /** Prototype payoff applied to the finishing damaging move. */
  damageMultiplier?: number;
}

export interface LinkChainState {
  moves: readonly LinkMoveSignature[];
  interruptedBy: string | null;
}

export const CHAMBER_LINK_RECIPES: readonly LinkArtRecipe[] = [
  {
    id: 'rallying_inferno',
    name: 'Rallying Inferno',
    sequence: [{ role: 'buff' }, { element: 'Ash', role: 'attack' }],
    effect: 'The Ash finisher deals 40% more damage.',
    damageMultiplier: 1.4,
  },
  {
    id: 'thermal_shock',
    name: 'Thermal Shock',
    sequence: [{ element: 'Ash', role: 'attack' }, { element: 'Salt', role: 'attack' }],
    effect: 'The Salt finisher deals 30% more damage.',
    damageMultiplier: 1.3,
  },
  {
    id: 'shatterwind',
    name: 'Shatterwind',
    sequence: [{ element: 'Salt', role: 'attack' }, { element: 'Breath', role: 'attack' }],
    effect: 'The Breath finisher deals 30% more damage.',
    damageMultiplier: 1.3,
  },
];

export function createLinkChainState(): LinkChainState {
  return { moves: [], interruptedBy: null };
}

export function linkSignature(ability: Ability, actorId: string): LinkMoveSignature | null {
  let role: LinkMoveRole;
  if (ability.power > 0) role = 'attack';
  else if (ability.effects?.some(effect => effect.type === 'buff')) role = 'buff';
  else if (ability.effects?.some(effect => effect.type === 'debuff' || effect.type === 'status')) role = 'debuff';
  else if (ability.effects?.some(effect => effect.type === 'heal')) role = 'heal';
  else return null;

  return {
    abilityId: ability.id,
    actorId,
    element: ability.damageType === 'None' ? null : ability.damageType,
    role,
  };
}

function matches(move: LinkMoveSignature, predicate: LinkPredicate): boolean {
  return (predicate.element === undefined || predicate.element === move.element)
    && (predicate.role === undefined || predicate.role === move.role);
}

export function previewLinkArt(
  state: LinkChainState,
  next: LinkMoveSignature | null,
  recipes: readonly LinkArtRecipe[] = CHAMBER_LINK_RECIPES,
): LinkArtRecipe | null {
  if (!next) return null;
  const prospective = [...state.moves, next];
  for (const recipe of recipes) {
    if (prospective.length < recipe.sequence.length) continue;
    const tail = prospective.slice(-recipe.sequence.length);
    if (new Set(tail.map(move => move.actorId)).size !== tail.length) continue;
    if (tail.every((move, index) => matches(move, recipe.sequence[index]))) return recipe;
  }
  return null;
}

export function recordLinkedMove(
  state: LinkChainState,
  move: LinkMoveSignature | null,
  completed: LinkArtRecipe | null,
): LinkChainState {
  if (!move) return createLinkChainState();
  if (completed) return createLinkChainState();
  // Duo recipes are the baseline prototype. Preserve only the last eligible move
  // while keeping the state extensible for authored trio recipes.
  return { moves: [...state.moves, move].slice(-2), interruptedBy: null };
}

export function interruptLink(state: LinkChainState, enemyName: string): LinkChainState {
  if (state.moves.length === 0) return state;
  return { moves: [], interruptedBy: enemyName };
}
