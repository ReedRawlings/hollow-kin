import { describe, expect, it } from 'vitest';
import { makeTestCreature } from './testFixtures';
import { chooseSharedAction } from './SharedActionAI';
import { NO_KNOWLEDGE } from './TacticsAI';

describe('Shared Action AI', () => {
  it('ignores empty MP and chooses a learned move that the AP pool can afford', () => {
    const actor = makeTestCreature({
      speciesId: 'actor', mp: 0, abilities: ['ember', 'smolder'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false });

    expect(chooseSharedAction(actor, [actor], [foe], 1, NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'ember', target: foe });
  });

  it('falls back to zero-cost Basic when no AP remains', () => {
    const actor = makeTestCreature({
      speciesId: 'actor', mp: 20, abilities: ['ember', 'smolder'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false });

    expect(chooseSharedAction(actor, [actor], [foe], 0, NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack', target: foe });
  });
});
