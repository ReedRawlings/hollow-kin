import { describe, expect, it } from 'vitest';
import { getAbility } from '../data/abilities';
import {
  createLinkChainState, interruptLink, linkSignature, previewLinkArt, recordLinkedMove,
} from './LinkArts';

describe('Link Arts', () => {
  it('previews an authored broad buff into Ash recipe', () => {
    let state = createLinkChainState();
    state = recordLinkedMove(state, linkSignature(getAbility('harden'), 'kin-a'), null);
    const recipe = previewLinkArt(state, linkSignature(getAbility('ember'), 'kin-b'));
    expect(recipe?.id).toBe('rallying_inferno');
    expect(recipe?.effect).toBe('The Ash finisher deals 40% more damage.');
  });

  it('supports the current Ash into Salt and Salt into Breath move pairs', () => {
    let state = createLinkChainState();
    state = recordLinkedMove(state, linkSignature(getAbility('ember'), 'kin-a'), null);
    expect(previewLinkArt(state, linkSignature(getAbility('frost'), 'kin-b'))?.id)
      .toBe('thermal_shock');

    state = createLinkChainState();
    state = recordLinkedMove(state, linkSignature(getAbility('frost'), 'kin-a'), null);
    expect(previewLinkArt(state, linkSignature(getAbility('slash'), 'kin-b'))?.id)
      .toBe('shatterwind');
  });

  it('does not create arbitrary combinations', () => {
    let state = createLinkChainState();
    state = recordLinkedMove(state, linkSignature(getAbility('jab'), 'kin-a'), null);
    expect(previewLinkArt(state, linkSignature(getAbility('ember'), 'kin-b'))).toBeNull();
  });

  it('requires different creatures and is cleared by an enemy action', () => {
    let state = createLinkChainState();
    state = recordLinkedMove(state, linkSignature(getAbility('harden'), 'kin-a'), null);
    expect(previewLinkArt(state, linkSignature(getAbility('ember'), 'kin-a'))).toBeNull();
    expect(interruptLink(state, 'Ashmaw')).toEqual({ moves: [], interruptedBy: 'Ashmaw' });
  });
});
