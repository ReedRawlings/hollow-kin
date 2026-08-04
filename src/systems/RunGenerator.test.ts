import { describe, it, expect } from 'vitest';
import {
  generateDescent, generatePickNextChoices, injectStoryCombat,
  openingEncounterPool, poolForFloor,
} from './RunGenerator';
import { TOWER_FLOORS, TOWER_BAND_SIZE, bandForFloor } from '../types';
import { getTemplate, STARTER_HAND_LOADOUTS, STARTER_TRIO_A } from '../data/creatures';
import { getAbility } from '../data/abilities';

/** Every boss floor in the current descent, mini and major alike. */
const BOSS_FLOORS = Array.from({ length: Math.floor(TOWER_FLOORS / 5) }, (_, i) => (i + 1) * 5);

describe('poolForFloor', () => {
  it('holds the pool steady across a band and switches at the boundary', () => {
    // Asserted against band boundaries rather than pool inequality: alpha authors
    // every creature into both bands 1 and 2, so the two pools are legitimately
    // equal today and comparing them would test the roster, not the banding.
    expect(bandForFloor(1)).toBe(bandForFloor(TOWER_BAND_SIZE));
    expect(bandForFloor(TOWER_BAND_SIZE + 1)).toBe(bandForFloor(TOWER_BAND_SIZE * 2));
    expect(bandForFloor(TOWER_BAND_SIZE)).not.toBe(bandForFloor(TOWER_BAND_SIZE + 1));
    expect(poolForFloor(1)).toEqual(poolForFloor(TOWER_BAND_SIZE));
  });

  it('never hands back an empty pool, even below the shallowest authored band', () => {
    // Bands past the authored roster fall back to band 1; an empty pool would
    // break encounter generation outright.
    expect(poolForFloor(TOWER_BAND_SIZE * 9 + 1).length).toBeGreaterThan(0);
    expect(poolForFloor(1).length).toBeGreaterThan(0);
  });
});

describe('generateDescent', () => {
  it('routes a floor-15+ story event through an ordinary combat', () => {
    const descent = injectStoryCombat(generateDescent(), 'gary_shortsword', 15, () => 0);
    const story = descent.find(e => e.storyEventId === 'gary_shortsword');
    expect(story?.floor).toBeGreaterThanOrEqual(15);
    expect(story?.type).toBe('combat');
    expect(story?.enemies?.length).toBeGreaterThan(0);
  });
  it('produces one encounter per floor of the tower by default', () => {
    const d = generateDescent();
    expect(d).toHaveLength(TOWER_FLOORS);
    expect(d[0].floor).toBe(1);
    expect(d[d.length - 1].floor).toBe(TOWER_FLOORS);
    d.forEach((e, i) => expect(e.index).toBe(i));
  });

  it('places a boss every 5 floors, major on every 10th', () => {
    const d = generateDescent();
    const byFloor = (f: number) => d.find(e => e.floor === f)!;
    for (const f of BOSS_FLOORS) {
      expect(byFloor(f).type).toBe('boss');
      expect(byFloor(f).bossTier).toBe(f % 10 === 0 ? 'major' : 'mini');
    }
  });

  it('gives a boss distinct enemies rather than the head of the pool', () => {
    // Pools are derived from towerIds, so pool[0..2] carries no meaning; a boss
    // taking the first three entries would pin every boss to the same species.
    const d = generateDescent();
    for (const e of d.filter(x => x.type === 'boss')) {
      expect(new Set(e.enemies!).size).toBe(e.enemies!.length);
    }
  });

  it('makes the first floor combat', () => {
    const d = generateDescent();
    expect(d[0].type).toBe('combat');
  });

  it('randomizes floor one within enemies the Founding Hand can exploit', () => {
    const starterWards = new Set(STARTER_TRIO_A.flatMap(id => (
      STARTER_HAND_LOADOUTS[id]
        .map(abilityId => getAbility(abilityId).damageType)
        .filter(damageType => damageType !== 'None')
    )));
    const eligible = openingEncounterPool();
    expect(eligible.length).toBeGreaterThan(0);
    for (const id of eligible) {
      expect(getTemplate(id).weaknesses.some(weakness => starterWards.has(weakness))).toBe(true);
    }
    for (let i = 0; i < 100; i++) {
      const enemies = generateDescent()[0].enemies!;
      expect(enemies.length).toBeGreaterThanOrEqual(1);
      expect(enemies.length).toBeLessThanOrEqual(2);
      for (const id of enemies) expect(eligible).toContain(id);
    }
  });

  it('supports a depth-jump start floor', () => {
    const start = TOWER_BAND_SIZE + 1;
    const d = generateDescent(start);
    expect(d[0].floor).toBe(start);
    expect(d[0].type).toBe('combat');
    expect(d[d.length - 1].floor).toBe(TOWER_FLOORS);
    expect(d).toHaveLength(TOWER_FLOORS - start + 1);
  });

  it('gives every combat/boss enemies and a positive level', () => {
    const d = generateDescent();
    for (const e of d) {
      if (e.type === 'combat' || e.type === 'boss') {
        expect((e.enemies?.length ?? 0)).toBeGreaterThan(0);
        expect(e.enemyLevels!).toBeGreaterThan(0);
      }
    }
  });
});

describe('generatePickNextChoices', () => {
  it('forces the next boss when it is the immediate next encounter', () => {
    const d = generateDescent();
    const bossIdx = d.findIndex(e => e.type === 'boss'); // floor 5, index 4
    const choices = generatePickNextChoices(d, bossIdx - 1);
    expect(choices).toHaveLength(1);
    expect(choices[0].type).toBe('boss');
  });

  it('never offers a choice that skips past a boss', () => {
    const d = generateDescent();
    const choices = generatePickNextChoices(d, -1); // start of run
    const firstBossIdx = d.findIndex(e => e.type === 'boss');
    for (const c of choices) {
      expect(c.index).toBeLessThan(firstBossIdx);
    }
  });

  it('never offers a choice at or past the next boss from a real mid-segment index', () => {
    const d = generateDescent();
    const firstBossIdx = d.findIndex(e => e.type === 'boss'); // floor 5, index 4
    // From currentIndex 0 (standing on floor 1), remaining = floors 2..30. Floors 2-4
    // are filler candidates before the floor-5 boss, exercising the barrier over many
    // randomized selections.
    for (let i = 0; i < 200; i++) {
      const choices = generatePickNextChoices(d, 0);
      for (const c of choices) {
        expect(c.index).toBeLessThan(firstBossIdx);
      }
    }
  });

  it('returns the first combat with no real choice at run start', () => {
    const d = generateDescent();
    const choices = generatePickNextChoices(d, -1);
    expect(choices.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty when the run is complete', () => {
    const d = generateDescent();
    expect(generatePickNextChoices(d, d.length - 1)).toEqual([]);
  });

  it('walks a full descent end-to-end, forcing every boss and terminating at the tower floor', () => {
    const d = generateDescent();
    let idx = -1;
    const forcedBossFloors: number[] = [];
    let lastFloor = -1;
    let terminatedOnEmpty = false;

    for (let i = 0; i < 100; i++) {
      const choices = generatePickNextChoices(d, idx);
      if (choices.length === 0) {
        terminatedOnEmpty = true;
        break;
      }
      if (choices.length === 1 && choices[0].type === 'boss') {
        forcedBossFloors.push(choices[0].floor);
      }
      const pick = choices.reduce((a, b) => (a.index < b.index ? a : b));
      idx = pick.index;
      lastFloor = d[idx].floor;
    }

    expect(terminatedOnEmpty).toBe(true);
    expect(forcedBossFloors).toEqual(BOSS_FLOORS);
    expect(lastFloor).toBe(TOWER_FLOORS);
  });

  it('never offers the same non-combat encounter type twice in one choice set', () => {
    // Two MARKETs side by side read as a duplicate even though they are distinct
    // encounters. Combat may repeat — those differ by their enemies.
    const d = generateDescent();
    for (let seed = 0; seed < 300; seed++) {
      for (let idx = -1; idx < d.length - 1; idx++) {
        const choices = generatePickNextChoices(d, idx);
        const nonCombat = choices.filter(c => c.type !== 'combat').map(c => c.type);
        expect(new Set(nonCombat).size).toBe(nonCombat.length);
      }
    }
  });

  it('still offers a real choice most of the time after deduping', () => {
    // Deduping can starve an offer down to one entry, but that should be the
    // exception — if it were common the pick-next decision would stop existing.
    const d = generateDescent();
    let multi = 0;
    let offers = 0;
    for (let idx = 0; idx < d.length - 1; idx++) {
      const choices = generatePickNextChoices(d, idx);
      if (choices.length === 0) continue;
      const forcedBoss = choices.length === 1 && choices[0].type === 'boss';
      if (forcedBoss) continue;
      offers++;
      if (choices.length > 1) multi++;
    }
    expect(multi).toBeGreaterThan(offers / 2);
  });
});
