import { Encounter, EncounterType } from '../types';
import { ZONE_CREATURE_POOLS } from '../data/creatures';

export function generateZoneEncounters(zone: number): Encounter[] {
  const encounters: Encounter[] = [];
  const pool = ZONE_CREATURE_POOLS[zone] ?? ZONE_CREATURE_POOLS[1];

  // Zone constraints:
  // 14 encounters + 1 boss = 15 total
  // First encounter is combat
  // Last encounter (14th) before boss is rest
  // 5-7 combats, at least 1 shop, at least 2 rests, 1-2 events
  // No more than 3 combats in a row
  // No more than 2 rest/shop in a row

  const combatCount = 5 + Math.floor(Math.random() * 3); // 5-7
  const restCount = 2 + (Math.random() < 0.3 ? 1 : 0);   // 2-3
  const eventCount = 1 + (Math.random() < 0.4 ? 1 : 0);   // 1-2
  const shopCount = 14 - combatCount - restCount - eventCount;

  // Build type array
  const types: EncounterType[] = [];
  for (let i = 0; i < combatCount; i++) types.push('combat');
  for (let i = 0; i < restCount; i++) types.push('rest');
  for (let i = 0; i < eventCount; i++) types.push('event');
  for (let i = 0; i < shopCount; i++) types.push('shop');

  // Shuffle middle section (positions 1-12, since 0=combat, 13=rest)
  const middle = types.slice(1);
  // Remove one rest for position 13
  const lastRestIdx = middle.lastIndexOf('rest');
  if (lastRestIdx !== -1) middle.splice(lastRestIdx, 1);

  // Fisher-Yates shuffle
  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }

  // Validate constraints and fix violations
  const ordered: EncounterType[] = ['combat', ...middle, 'rest'];
  fixConsecutiveViolations(ordered);

  // Build encounter objects
  for (let i = 0; i < ordered.length; i++) {
    const type = ordered[i];
    const encounter: Encounter = { type, zone, index: i };

    if (type === 'combat') {
      // Pick 1-3 enemies from the zone pool
      const enemyCount = zone === 1 && i < 3
        ? 1 + Math.floor(Math.random() * 2) // 1-2 in early zone 1
        : 1 + Math.floor(Math.random() * 3); // 1-3 normally
      encounter.enemies = [];
      for (let e = 0; e < enemyCount; e++) {
        encounter.enemies.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      encounter.enemyLevels = Math.floor(1 + (i / 14) * 4 + (zone - 1) * 3);
    }
    encounters.push(encounter);
  }

  // Add zone boss
  encounters.push({
    type: 'boss',
    zone,
    index: 14,
    enemies: [pool[0], pool[1]],
    enemyLevels: 3 + zone * 2,
  });

  return encounters;
}

function fixConsecutiveViolations(arr: EncounterType[]): void {
  for (let pass = 0; pass < 10; pass++) {
    let fixed = true;
    for (let i = 2; i < arr.length; i++) {
      // No more than 3 combats in a row
      if (arr[i] === 'combat' && arr[i-1] === 'combat' && arr[i-2] === 'combat') {
        if (i + 1 < arr.length - 1) {
          swapWithDifferent(arr, i, 'combat');
          fixed = false;
        }
      }
      // No more than 2 rest/shop in a row
      const isNonCombat = (t: EncounterType) => t === 'rest' || t === 'shop';
      if (isNonCombat(arr[i]) && isNonCombat(arr[i-1]) && i >= 2 && isNonCombat(arr[i-2])) {
        swapWithDifferent(arr, i, arr[i]);
        fixed = false;
      }
    }
    if (fixed) break;
  }
}

function swapWithDifferent(arr: EncounterType[], idx: number, avoid: EncounterType): void {
  for (let j = idx + 1; j < arr.length - 1; j++) {
    if (arr[j] !== avoid) {
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return;
    }
  }
}

export function generatePickNextChoices(
  encounters: Encounter[],
  currentIndex: number,
): Encounter[] {
  const remaining = encounters.filter((_, i) => i > currentIndex);
  if (remaining.length === 0) return [];

  // First encounter of the zone is always combat — no choice
  if (currentIndex === -1) {
    const first = remaining.find(e => e.type === 'combat');
    return first ? [first] : [remaining[0]];
  }

  // Boss is always the last encounter — only show it when no other encounters remain
  const nonBoss = remaining.filter(e => e.type !== 'boss');
  const boss = remaining.find(e => e.type === 'boss');

  // Pre-boss rest is forced — when only the rest before boss remains, no choice
  if (nonBoss.length === 1 && nonBoss[0].type === 'rest' && boss) {
    return [nonBoss[0]];
  }

  if (nonBoss.length === 0 && boss) return [boss];
  if (nonBoss.length <= 1) return boss ? [...nonBoss, boss] : nonBoss;

  // Offer 2-3 choices from non-boss encounters
  const count = Math.min(nonBoss.length, 2 + (Math.random() < 0.4 ? 1 : 0));
  const shuffled = [...nonBoss];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
