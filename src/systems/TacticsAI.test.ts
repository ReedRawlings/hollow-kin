import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeTestCreature } from './testFixtures';
import { getAbility } from '../data/abilities';
import { chooseAction, estimateDamage, NO_KNOWLEDGE } from './TacticsAI';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('estimateDamage', () => {
  it('consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    estimateDamage(a, d, getAbility('smash'), NO_KNOWLEDGE);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores a weakness on an unknown species', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'unknown', weaknesses: ['Ash'] });
    const blind = estimateDamage(a, d, getAbility('ember'), NO_KNOWLEDGE);
    const informed = estimateDamage(a, d, getAbility('ember'), new Set(['unknown']));
    expect(informed).toBeGreaterThan(blind);
  });

  it('weights by accuracy', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    // inferno_strike: power 70, accuracy 85. razor_wind: power 70, accuracy 95.
    expect(estimateDamage(a, d, getAbility('inferno_strike'), NO_KNOWLEDGE))
      .toBeLessThan(estimateDamage(a, d, getAbility('razor_wind'), NO_KNOWLEDGE));
  });

  it('returns 0 for a zero-power ability', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    expect(estimateDamage(a, d, getAbility('bold'), NO_KNOWLEDGE)).toBe(0);
  });
});

describe('chooseAction — enemy_default', () => {
  it('matches getEnemyAction: strongest affordable non-Status ability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['jab', 'thrash', 'smash'],
    });
    const hero = makeTestCreature({ speciesId: 'hero' });
    const action = chooseAction(enemy, [enemy], [hero], 'enemy_default', NO_KNOWLEDGE);
    expect(action).toEqual({ kind: 'ability', abilityId: 'thrash', target: hero });
  });

  it('never picks a Status ability', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['bold', 'mend'],
    });
    const hero = makeTestCreature({ speciesId: 'hero' });
    const action = chooseAction(enemy, [enemy], [hero], 'enemy_default', NO_KNOWLEDGE);
    expect(action).toEqual({ kind: 'ability', abilityId: 'basic_attack', target: hero });
  });

  it('never exploits a weakness even when handed knowledge', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Weaker-power Ash move vs an Ash-weak target: an informed AI would pick ember.
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['ember', 'thrash'],
    });
    const hero = makeTestCreature({ speciesId: 'hero', weaknesses: ['Ash'] });
    const action = chooseAction(enemy, [enemy], [hero], 'enemy_default', new Set(['hero']));
    // enemy_default sorts by raw power only: thrash (75) beats ember (40).
    expect(action).toMatchObject({ abilityId: 'thrash' });
  });

  it('returns null when no foe is alive', () => {
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const dead = makeTestCreature({ speciesId: 'hero', hp: 0 });
    expect(chooseAction(enemy, [enemy], [dead], 'enemy_default', NO_KNOWLEDGE))
      .toBeNull();
  });
});

describe('bestBy tie-break (exercised via chooseAction — fallback path)', () => {
  // `bestBy` is only reachable through the `fallback` path today (every
  // TacticProfile other than 'enemy_default' falls through to it). Tested here
  // through the public `chooseAction` entry point rather than by exporting
  // `bestBy` — going through the public API isn't awkward for this case, and it
  // keeps the module's exported surface minimal.
  it('is fully deterministic and order-independent when two foes tie on score, mpCost, HP, and abilityId', () => {
    // Two same-species foes, identical stats, identical current HP, and the
    // actor only has basic_attack — so both damage candidates tie on score,
    // mpCost, and target.currentHp, and both share abilityId 'basic_attack'.
    // Without a final instanceId tie-break, the winner would depend on
    // iteration order alone.
    const actor = makeTestCreature({ speciesId: 'actor', isPlayer: true, abilities: ['basic_attack'] });
    const foeA = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 50 });
    const foeB = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 50 });
    // Force distinct, orderable instanceIds (makeTestCreature derives instanceId
    // from speciesId, so same-species foes otherwise collide).
    foeA.instance.instanceId = 'z-foe';
    foeB.instance.instanceId = 'a-foe';

    const forward = chooseAction(actor, [actor], [foeA, foeB], 'fight_wisely', NO_KNOWLEDGE);
    const reversed = chooseAction(actor, [actor], [foeB, foeA], 'fight_wisely', NO_KNOWLEDGE);

    expect(forward).toEqual({ kind: 'ability', abilityId: 'basic_attack', target: foeB });
    // The order-independence assertion is the one that matters: a test that
    // only ever calls with the same array order would pass even with the bug.
    expect(reversed).toEqual(forward);
  });
});

describe('chooseAction — fight_wisely', () => {
  it('rule 1: heals an ally below 30% before attacking', () => {
    const healer = makeTestCreature({
      speciesId: 'healer', mp: 20, abilities: ['soothe', 'thrash'],
    });
    const hurt = makeTestCreature({ speciesId: 'hurt', hp: 20 }); // 20%
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const action = chooseAction(healer, [healer, hurt], [foe], 'fight_wisely', NO_KNOWLEDGE);
    expect(action).toEqual({ kind: 'ability', abilityId: 'soothe', target: hurt });
  });

  it('rule 1 does not fire when everyone is above the threshold', () => {
    const healer = makeTestCreature({
      speciesId: 'healer', mp: 20, abilities: ['soothe', 'thrash'],
    });
    const fine = makeTestCreature({ speciesId: 'fine', hp: 90 });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const action = chooseAction(healer, [healer, fine], [foe], 'fight_wisely', NO_KNOWLEDGE);
    expect(action).toMatchObject({ abilityId: 'thrash' });
  });

  it('rule 2: takes the cheapest ability that still kills', () => {
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['jab', 'thrash'], // cost 2 / 5
    });
    // With str 40 vs def 20: basic_attack ~12, jab ~18, thrash ~45.
    // At 15 HP only jab and thrash kill, so the cheaper of those two wins —
    // and the free basic_attack is correctly excluded for being too weak.
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 15 });
    const action = chooseAction(hero, [hero], [foe], 'fight_wisely', NO_KNOWLEDGE);
    expect(action).toMatchObject({ abilityId: 'jab', target: foe });
  });

  it('end-to-end: spread ability wins when it out-totals the best single hit', () => {
    // At 20 MP, rule 4's budget (10) also admits discharge (cost 7), and
    // discharge's party-wide total (126) trounces any single-target damage
    // value — so this board doesn't discriminate rule 3 from rule 4; it just
    // pins that the overall tactic ends up picking discharge. See the
    // dedicated "rule 3" test below for the board that actually isolates it.
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['discharge', 'spark'], // spread 70 / single 40
    });
    const a = makeTestCreature({ speciesId: 'fa', isPlayer: false });
    const b = makeTestCreature({ speciesId: 'fb', isPlayer: false });
    const c = makeTestCreature({ speciesId: 'fc', isPlayer: false });
    const action = chooseAction(hero, [hero], [a, b, c], 'fight_wisely', NO_KNOWLEDGE);
    expect(action).toMatchObject({ abilityId: 'discharge' });
  });

  it('rule 3: uses a spread ability when the budget in rule 4 would exclude it', () => {
    // At 10 MP, rule 4's budget is floor(10/2) = 5, which excludes discharge
    // (cost 7) — so without rule 3, the AI would fall through to rule 4 and
    // pick spark (cost 3) instead. Rule 3 doesn't consult the budget at all,
    // so it selects discharge here specifically because it out-totals the
    // best single hit, not because it happens to also win downstream.
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 10, abilities: ['discharge', 'spark'], // spread 70 / single 40
    });
    const a = makeTestCreature({ speciesId: 'fa', isPlayer: false });
    const b = makeTestCreature({ speciesId: 'fb', isPlayer: false });
    const c = makeTestCreature({ speciesId: 'fc', isPlayer: false });
    const action = chooseAction(hero, [hero], [a, b, c], 'fight_wisely', NO_KNOWLEDGE);
    expect(action).toMatchObject({ abilityId: 'discharge' });
  });

  it('rule 4: knowledge flips the choice toward the weakness', () => {
    // gale: Breath, power 60, 5 MP -> ~36 damage.
    // ember: Ash, power 40, 2 MP -> ~24 blind, ~36 against an Ash weakness.
    // Blind, gale is strictly stronger. Informed, ember ties it and wins the
    // cheaper-cost tie-break. Same board, opposite decision.
    const foe = makeTestCreature({
      speciesId: 'foe', isPlayer: false, hp: 500, weaknesses: ['Ash'],
    });
    const blindHero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['ember', 'gale'],
    });
    expect(chooseAction(blindHero, [blindHero], [foe], 'fight_wisely', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'gale' });

    const informedHero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['ember', 'gale'],
    });
    expect(chooseAction(informedHero, [informedHero], [foe], 'fight_wisely', new Set(['foe'])))
      .toMatchObject({ abilityId: 'ember' });
  });

  it('rule 4: budgets to half its current MP', () => {
    // thrash costs 5. At 20 MP the budget is 10 and it is affordable;
    // at 8 MP the budget is 4 and it is not, so the free basic attack wins.
    const rich = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(rich, [rich], [foe], 'fight_wisely', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'thrash' });

    const poor = makeTestCreature({ speciesId: 'hero', mp: 8, abilities: ['thrash'] });
    expect(chooseAction(poor, [poor], [foe], 'fight_wisely', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack' });
  });

  it('rule 4: basic attack is always within budget, even at 0 MP', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 0, abilities: ['thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'fight_wisely', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack' });
  });

  it('consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    chooseAction(hero, [hero], [foe], 'fight_wisely', NO_KNOWLEDGE);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('chooseAction — all_out', () => {
  it('picks the highest raw damage regardless of MP cost', () => {
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['jab', 'thrash'], // 30 cheap / 75 dear
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'all_out', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'thrash' });
  });

  it('never heals even with a dying ally', () => {
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['soothe', 'thrash'],
    });
    const dying = makeTestCreature({ speciesId: 'dying', hp: 1 });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero, dying], [foe], 'all_out', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'thrash' });
  });

  it('kills with the highest-damage option rather than the cheapest', () => {
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['jab', 'thrash'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 1 });
    expect(chooseAction(hero, [hero], [foe], 'all_out', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'thrash' });
  });

  it('consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    chooseAction(hero, [hero], [foe], 'all_out', NO_KNOWLEDGE);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('chooseAction — conserve_mp', () => {
  it('rule 3: basic attacks while the party is healthy', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['thrash'] });
    const ally = makeTestCreature({ speciesId: 'ally', hp: 100 });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero, ally], [foe], 'conserve_mp', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack' });
  });

  it('rule 1: self-heals below 35%', () => {
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, hp: 30, abilities: ['mend', 'thrash'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'conserve_mp', NO_KNOWLEDGE))
      .toEqual({ kind: 'ability', abilityId: 'mend', target: hero });
  });

  it('rule 2: soothes an ally below 25%', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['soothe', 'thrash'] });
    const dying = makeTestCreature({ speciesId: 'dying', hp: 20 });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero, dying], [foe], 'conserve_mp', NO_KNOWLEDGE))
      .toEqual({ kind: 'ability', abilityId: 'soothe', target: dying });
  });

  it('rule 3 beats rule 4: kills with a free basic attack', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['thrash'] });
    const hurtAlly = makeTestCreature({ speciesId: 'ally', hp: 40 }); // under pressure
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 1 });
    expect(chooseAction(hero, [hero, hurtAlly], [foe], 'conserve_mp', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack' });
  });

  it('rule 3: a free kill is taken over raw damage even without pressure', () => {
    // Party healthy, so rule 4's pressure gate is closed and — without rule 3
    // — the ladder would fall all the way to rule 5's fallback, which ranks
    // by raw damage with no kill filter.
    //
    // Foe A: DEF 60, HP 4. basic_attack damage = max(1, 40 - 30) * (20/50) = 4,
    // which kills (4 >= 4 HP).
    // Foe B: DEF 0, HP 100. basic_attack damage = max(1, 40 - 0) * (20/50) = 16,
    // which does not kill (16 < 100 HP) but is the higher raw-damage hit.
    //
    // Rule 3 takes the free kill on A. Without it, rule 5's fallback would
    // pick the harder-hitting B instead.
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: [] });
    const ally = makeTestCreature({ speciesId: 'ally', hp: 100 }); // healthy — no pressure
    const foeA = makeTestCreature({
      speciesId: 'fa', isPlayer: false, hp: 4, stats: { def: 60 },
    });
    const foeB = makeTestCreature({
      speciesId: 'fb', isPlayer: false, hp: 100, stats: { def: 0 },
    });
    const action = chooseAction(hero, [hero, ally], [foeA, foeB], 'conserve_mp', NO_KNOWLEDGE);
    expect(action).toMatchObject({ abilityId: 'basic_attack', target: foeA });
  });

  it('rule 4: spends only when the party is under pressure', () => {
    // A tanky foe basic attack cannot kill; hero has a cheap strong option.
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, stats: { mp: 20 }, abilities: ['smash'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });

    const healthy = makeTestCreature({ speciesId: 'ally', hp: 100 });
    expect(chooseAction(hero, [hero, healthy], [foe], 'conserve_mp', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack' });

    const pressured = makeTestCreature({ speciesId: 'ally', hp: 40 }); // 40% <= 50%
    expect(chooseAction(hero, [hero, pressured], [foe], 'conserve_mp', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'smash' });
  });

  it('rule 4 respects the one-third max MP ceiling', () => {
    // maxMp 20 -> ceiling 6. razor_wind costs 6 (allowed); discharge costs 7 (not).
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, stats: { mp: 20 }, abilities: ['razor_wind', 'discharge'],
    });
    const pressured = makeTestCreature({ speciesId: 'ally', hp: 40 });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero, pressured], [foe], 'conserve_mp', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'razor_wind' });
  });

  it('consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    chooseAction(hero, [hero], [foe], 'conserve_mp', NO_KNOWLEDGE);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('chooseAction — heal_first', () => {
  it('rule 1: heals an ally below 60%', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['soothe', 'thrash'] });
    const hurt = makeTestCreature({ speciesId: 'hurt', hp: 50 });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero, hurt], [foe], 'heal_first', NO_KNOWLEDGE))
      .toEqual({ kind: 'ability', abilityId: 'soothe', target: hurt });
  });

  it('rule 2: buffs itself when nobody is hurt', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['bold', 'thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toEqual({ kind: 'ability', abilityId: 'bold', target: hero });
  });

  it('rule 2 stops once the stat is at +2', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['bold', 'thrash'] });
    hero.buffStages.str = 2;
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'thrash' });
  });

  it('rule 3: debuffs when it has no buff left to cast', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['weaken', 'thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toEqual({ kind: 'ability', abilityId: 'weaken', target: foe });
  });

  it('rule 3 stops once the foe is at -2 on that stat', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['weaken', 'thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    foe.buffStages.str = -2;
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'thrash' });
  });

  it('rule 4: holds MP in reserve below twice its cheapest heal', () => {
    // soothe costs 4, so the reserve floor is 8. At 6 MP it must not spend on damage.
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 6, stats: { mp: 20 }, abilities: ['soothe', 'smash'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack' });
  });

  it('rule 4: attacks normally when it has MP to spare', () => {
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, stats: { mp: 20 }, abilities: ['soothe', 'smash'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'smash' });
  });

  it('rule 4: the reserve gate still holds once the cheapest heal itself is unaffordable', () => {
    // soothe costs 4, so the reserve floor is 8. At 2 MP, soothe is not even
    // affordable — so a reserve check derived from *affordable* heal
    // candidates would find none and skip the gate entirely, falling through
    // to unrestricted damage selection where jab (2 MP, higher damage than
    // basic_attack) would win. The gate must instead derive the reserve floor
    // from the actor's heal *ability* (soothe exists in its kit) regardless
    // of whether it can pay for it right now, and hold at basic_attack.
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 2, stats: { mp: 20 }, abilities: ['soothe', 'jab'],
    });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'basic_attack' });
  });

  it('degrades to damage on a creature with no support kit', () => {
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    expect(chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE))
      .toMatchObject({ abilityId: 'thrash' });
  });

  it('consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const hero = makeTestCreature({ speciesId: 'hero', mp: 20, abilities: ['soothe', 'thrash'] });
    const foe = makeTestCreature({ speciesId: 'foe', isPlayer: false, hp: 500 });
    chooseAction(hero, [hero], [foe], 'heal_first', NO_KNOWLEDGE);
    expect(spy).not.toHaveBeenCalled();
  });
});
