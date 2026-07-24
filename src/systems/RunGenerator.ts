import { Encounter, EncounterType, TOWER_FLOORS, isBossFloor, bossTierForFloor } from '../types';
import { ZONE_CREATURE_POOLS } from '../data/creatures';

/** Depth band pool: floors 1-10 -> band 1, 11-20 -> band 2, 21-30 -> band 3. */
export function poolForFloor(floor: number): string[] {
  const band = Math.min(3, Math.floor((floor - 1) / 10) + 1);
  return ZONE_CREATURE_POOLS[band] ?? ZONE_CREATURE_POOLS[1];
}

/** Non-boss, non-forced filler encounter type. */
function fillerType(): EncounterType {
  // Weighted mix: mostly combat, some shop/event. (Rests are only the forced pre-boss ones.)
  const r = Math.random();
  if (r < 0.6) return 'combat';
  if (r < 0.8) return 'shop';
  return 'event';
}

function makeEncounter(type: EncounterType, floor: number, index: number): Encounter {
  const e: Encounter = { type, floor, index };
  if (type === 'boss') {
    e.bossTier = bossTierForFloor(floor);
    const pool = poolForFloor(floor);
    e.enemies = e.bossTier === 'major' ? [pool[0], pool[1], pool[2] ?? pool[0]] : [pool[0], pool[1]];
    e.enemyLevels = Math.floor(floor * (e.bossTier === 'major' ? 1.2 : 1.0)) + 2;
  } else if (type === 'combat') {
    const pool = poolForFloor(floor);
    const isEarly = floor <= 3;
    const enemyCount = isEarly ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
    e.enemies = [];
    for (let i = 0; i < enemyCount; i++) {
      e.enemies.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    e.enemyLevels = Math.max(1, Math.floor(floor * 0.8));
  }
  return e;
}

/**
 * Build the tower descent from `startFloor` (default 1) through TOWER_FLOORS.
 * One encounter per floor. First floor = combat; floor before any boss = rest;
 * boss floors (multiples of 5) are mini/major; the rest are combat/shop/event.
 */
export function generateDescent(startFloor = 1): Encounter[] {
  const encounters: Encounter[] = [];
  let index = 0;
  for (let floor = startFloor; floor <= TOWER_FLOORS; floor++) {
    let type: EncounterType;
    // NOTE: startFloor is expected to be a non-boss, non-pre-boss floor — either 1 or a
    // break+1 floor (6, 11, 16, 21, 26). isBossFloor is checked first for simplicity;
    // this is safe only under that assumption (no depth-jump start floor is ever a
    // boss or pre-boss floor).
    if (isBossFloor(floor)) {
      type = 'boss';
    } else if (floor === startFloor) {
      type = 'combat';                 // first floor of the run is always combat
    } else if (isBossFloor(floor + 1)) {
      type = 'rest';                   // floor immediately before a boss is rest
    } else {
      type = fillerType();
    }
    encounters.push(makeEncounter(type, floor, index));
    index++;
  }
  return encounters;
}

/**
 * Pick-next choices on the linear descent. Bosses and pre-boss rests are forced
 * (returned alone). Otherwise offer 2-3 encounters strictly before the next boss —
 * so a choice can never skip past a boss floor.
 */
export function generatePickNextChoices(encounters: Encounter[], currentIndex: number): Encounter[] {
  const remaining = encounters.filter((_, i) => i > currentIndex);
  if (remaining.length === 0) return [];

  // First encounter of the run is forced (generateDescent guarantees it is combat).
  if (currentIndex === -1) return [remaining[0]];

  const next = remaining[0];

  // Forced: the immediate next encounter is a boss, or a rest sitting right before a boss.
  if (next.type === 'boss') return [next];
  if (next.type === 'rest' && remaining[1]?.type === 'boss') return [next];

  // Barrier: cannot choose anything at or beyond the next boss.
  const nextBossPos = remaining.findIndex(e => e.type === 'boss');
  const selectable = nextBossPos === -1 ? remaining : remaining.slice(0, nextBossPos);

  // The pre-boss rest floor (the last element of `selectable` when a boss lies ahead)
  // is reachable only as the forced immediate-next rest handled above — it must never
  // appear in the general candidate pool. Exclude it, falling back to the full
  // `selectable` list if that exclusion would leave no candidates.
  const excludePreBossRest = nextBossPos !== -1 ? selectable.slice(0, -1) : selectable;
  const candidates = excludePreBossRest.length > 0 ? excludePreBossRest : selectable;

  if (candidates.length <= 1) return candidates;

  const count = Math.min(candidates.length, 2 + (Math.random() < 0.4 ? 1 : 0));
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
