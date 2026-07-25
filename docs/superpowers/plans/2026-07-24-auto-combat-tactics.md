# Auto-Combat & Tactics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dragon Quest–style tactics layer so the player assigns a standing behavior to each creature and hands combat to the AI, with a battle speed control.

**Architecture:** One pure, side-agnostic decision module (`src/systems/TacticsAI.ts`) serves both player creatures and enemies. It returns a `CombatAction` describing what to do; `CombatScene` executes it through the same code path a mouse click takes. Enemy behavior is preserved byte-for-byte by an `enemy_default` profile that is a literal port of today's `getEnemyAction`, pinned by a characterization test written before the merge.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest.

**Source spec:** `docs/superpowers/specs/2026-07-24-auto-combat-tactics-design.md`

## Global Constraints

- **The AI must never mutate combat state.** `chooseAction` returns a `CombatAction`; only `CombatScene` applies it.
- **The four player-facing profiles must consume zero RNG.** `Math.random` may not be called on their code paths. `enemy_default` is the sole exception: it consumes exactly one `Math.random()` for target selection, deliberately, to preserve current behavior. (This narrows the spec's blanket determinism claim in §12 — see Task 3.)
- **All AI tie-breaks must be fully deterministic**, terminating in a lexicographic `abilityId` comparison so no ordering ambiguity survives.
- **HP thresholds are fractions of max HP**, never absolute values.
- Buff/debuff stages cap at **±3** (`BUFF_MULTIPLIERS` in `types.ts`).
- Player crits only — enemies cannot crit. Enforced in `calculateDamage`, never in the AI.
- Existing tests must stay green after every task: `npm test`.
- Run `npx tsc --noEmit` before each commit; the project builds with `tsc && vite build`.

**Ordering note:** this plan reorders spec §13. The data-model task (adding `tactic` to `CreatureInstance`) moves ahead of the `TacticsAI` tasks, because the AI's test fixtures construct `CreatureInstance` objects and will not type-check until that field exists.

---

### Task 1: Fix `single_ally` targeting

Standalone bug fix. `soothe` currently cannot heal anyone but its caster, in manual play. No AI code yet.

**Files:**
- Modify: `src/scenes/CombatScene.ts:193-209` (the `pointerdown` handler in `showActionMenu`)
- Modify: `src/scenes/CombatScene.ts:229-252` (add a sibling to `showTargetSelection`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CombatScene.showAllyTargetSelection(caster: CombatCreature, abilityId: string): void`. Ally-targeted abilities now resolve against a chosen ally rather than always the caster.

- [ ] **Step 1: Read the current handler**

Open `src/scenes/CombatScene.ts` and find this block inside `showActionMenu`:

```typescript
} else if (ability.targeting === 'single_ally') {
  // For now, self-heal
  this.executePlayerAction(creature, abilityId, creature);
} else {
```

- [ ] **Step 2: Replace it with real ally selection**

```typescript
} else if (ability.targeting === 'single_ally') {
  // A single_ally ability may target any living ally, including the caster.
  const livingAllies = this.playerParty.filter(p => !p.isKnockedOut);
  if (livingAllies.length === 1) {
    this.executePlayerAction(creature, abilityId, livingAllies[0]);
  } else {
    this.showAllyTargetSelection(creature, abilityId);
  }
} else {
```

- [ ] **Step 3: Add `showAllyTargetSelection`**

Insert directly after the existing `showTargetSelection` method (which ends at `CombatScene.ts:252`):

```typescript
  private showAllyTargetSelection(caster: CombatCreature, abilityId: string): void {
    this.clearUI();
    const ability = getAbility(abilityId);

    this.add.text(this.cameras.main.centerX, 500, `Select ally for ${ability.name}`, {
      fontSize: '14px', color: '#88ffaa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.playerParty.forEach((ally, i) => {
      if (ally.isKnockedOut) return;
      const x = 140;
      const y = 120 + i * 120;

      const highlight = this.add.rectangle(x, y, 110, 90, 0x88ffaa, 0.15)
        .setStrokeStyle(2, 0x88ffaa).setInteractive({ useHandCursor: true });
      this.uiElements.push(highlight);

      highlight.on('pointerover', () => highlight.setAlpha(0.4));
      highlight.on('pointerout', () => highlight.setAlpha(0.15));
      highlight.on('pointerdown', () => {
        this.executePlayerAction(caster, abilityId, ally);
      });
    });
  }
```

Note the `y` values match `drawBattlefield`'s player layout (`120 + i * 120` at `CombatScene.ts:489`), so the highlights land on the creatures.

- [ ] **Step 4: Verify `executePlayerAction` already routes this correctly**

Read `CombatScene.ts:266-274`. The `else` branch calls `this.resolveAbility(attacker, target, ability)` with the passed target, and `applyAbilityEffects` (`CombatEngine.ts:128-137`) heals `ability.targeting === 'self' ? user : target`. For `soothe` (`single_ally`) that resolves to `target`. No change needed — confirm by reading, do not edit.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit`
Expected: no output (success).

Run: `npm test`
Expected: all existing suites pass.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, click NEW GAME, take a party including **Petalward** or **Mossgolem** (the only two creatures with `soothe`), enter a fight, damage a teammate, and cast Soothe.
Expected: an ally-selection prompt appears; choosing a *different* creature heals that creature, not the caster.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/CombatScene.ts
git commit -m "fix: single_ally abilities can target any living ally

soothe was hard-coded to self-target, so no creature could heal a
teammate. Adds ally target selection mirroring enemy targeting, with
the same auto-target shortcut when only one ally is alive."
```

---

### Task 2: Extract `BattlefieldRenderer`

Pure refactor, zero behavior change. `CombatScene.ts` is 572 lines and this feature adds ~110; this buys the headroom back.

**Files:**
- Create: `src/scenes/combat/BattlefieldRenderer.ts`
- Modify: `src/scenes/CombatScene.ts` (delete `drawBattlefield`/`drawCreature` bodies, import and delegate)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `renderBattlefield(scene: Phaser.Scene, view: BattlefieldView): void` and `interface BattlefieldView { playerParty: CombatCreature[]; enemyParty: CombatCreature[]; currentActor: CombatCreature | undefined; messageLog: string[] }`.

- [ ] **Step 1: Create the renderer**

Create `src/scenes/combat/BattlefieldRenderer.ts`:

```typescript
import Phaser from 'phaser';
import { CombatCreature } from '../../types';

export interface BattlefieldView {
  playerParty: CombatCreature[];
  enemyParty: CombatCreature[];
  currentActor: CombatCreature | undefined;
  messageLog: string[];
}

/**
 * Draws the whole battlefield: background, both parties, and the message log.
 * Pure rendering — reads the view and touches no combat state. The caller is
 * responsible for clearing the display list first.
 */
export function renderBattlefield(scene: Phaser.Scene, view: BattlefieldView): void {
  // Background
  scene.add.rectangle(480, 320, 960, 640, 0x1a1a2e);

  // Battle area divider
  scene.add.line(480, 0, 0, 70, 0, 460, 0x333355, 0.5);

  // Turn indicator
  if (view.currentActor) {
    scene.add.text(480, 15, `Turn: ${view.currentActor.template.name}`, {
      fontSize: '14px', color: '#ffdd88', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  view.playerParty.forEach((creature, i) => {
    drawCreature(scene, creature, 140, 120 + i * 120, true);
  });

  view.enemyParty.forEach((creature, i) => {
    drawCreature(scene, creature, 700, 120 + i * 110, false);
  });

  // Message log
  const logY = 400;
  const recentMessages = view.messageLog.slice(-4);
  recentMessages.forEach((msg, i) => {
    scene.add.text(20, logY + i * 18, msg, {
      fontSize: '11px', color: '#aaaacc', fontFamily: 'monospace',
    });
  });
}

function drawCreature(
  scene: Phaser.Scene,
  creature: CombatCreature,
  x: number,
  y: number,
  isPlayer: boolean,
): void {
  const alpha = creature.isKnockedOut ? 0.3 : 1;

  const rect = scene.add.rectangle(x, y, 70, 55, creature.template.spriteColor, alpha);
  if (creature.isDefending) rect.setStrokeStyle(2, 0x8888ff);

  const labelX = isPlayer ? x + 50 : x - 50;
  const origin = isPlayer ? 0 : 1;

  scene.add.text(labelX, y - 30, `${creature.template.name}`, {
    fontSize: '11px', color: creature.isKnockedOut ? '#666666' : '#ffffff', fontFamily: 'monospace',
  }).setOrigin(origin, 0.5);

  // HP bar
  const hpPct = creature.currentHp / creature.maxHp;
  const hpColor = hpPct > 0.5 ? 0x44aa44 : hpPct > 0.25 ? 0xaaaa44 : 0xaa4444;
  const barX = isPlayer ? x + 50 : x - 120;
  scene.add.rectangle(barX, y - 14, 70, 6, 0x333333).setOrigin(0);
  scene.add.rectangle(barX, y - 14, 70 * hpPct, 6, hpColor).setOrigin(0);

  scene.add.text(barX, y - 5, `${creature.currentHp}/${creature.maxHp}`, {
    fontSize: '9px', color: '#aaaaaa', fontFamily: 'monospace',
  }).setOrigin(0);

  // MP bar (player only)
  if (isPlayer) {
    const mpPct = creature.currentMp / creature.maxMp;
    scene.add.rectangle(barX, y + 8, 70, 4, 0x333333).setOrigin(0);
    scene.add.rectangle(barX, y + 8, 70 * mpPct, 4, 0x4466aa).setOrigin(0);
    scene.add.text(barX, y + 15, `MP:${creature.currentMp}/${creature.maxMp}`, {
      fontSize: '8px', color: '#6688aa', fontFamily: 'monospace',
    }).setOrigin(0);
  }

  // Status effects
  const statuses = creature.statusEffects.map(s => s.type.substring(0, 3).toUpperCase()).join(' ');
  if (statuses) {
    scene.add.text(x, y + 35, statuses, {
      fontSize: '9px', color: '#ff8888', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  // KO marker
  if (creature.isKnockedOut) {
    scene.add.text(x, y, 'KO', {
      fontSize: '18px', color: '#ff4444', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
  }
}
```

Note the original `drawCreature` declared `const align = isPlayer ? 'left' : 'right';` and never used it (`CombatScene.ts:516`). It is dropped here deliberately — it is dead code, and `noUnusedLocals` would reject it.

- [ ] **Step 2: Delete the old methods from CombatScene**

In `src/scenes/CombatScene.ts`, delete the entire `drawBattlefield` method (lines 468-505) and the entire `drawCreature` method (lines 507-559), including the `// ---------- RENDERING ----------` comment above them.

- [ ] **Step 3: Add the delegating `drawBattlefield`**

In the same place, insert:

```typescript
  // ---------- RENDERING ----------

  private drawBattlefield(): void {
    // Clear previous battlefield elements (but not UI overlay)
    this.children.removeAll();
    this.uiElements = [];

    renderBattlefield(this, {
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      currentActor: this.turnOrder[this.currentTurnIndex],
      messageLog: this.messageLog,
    });
  }
```

- [ ] **Step 4: Add the import**

At the top of `src/scenes/CombatScene.ts`, after the `import { obolsForEncounter } from '../systems/Economy';` line:

```typescript
import { renderBattlefield } from './combat/BattlefieldRenderer';
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Manual verification — nothing moved**

Run: `npm run dev`, start a run, enter combat.
Expected: the battlefield looks pixel-identical to before — creatures, HP/MP bars, status text, KO markers, message log all in the same positions.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/combat/BattlefieldRenderer.ts src/scenes/CombatScene.ts
git commit -m "refactor: extract battlefield rendering from CombatScene

Pure move of drawBattlefield/drawCreature into a stateless renderer.
No behavior change. Buys back the line budget the tactics feature needs."
```

---

### Task 3: Characterization test pinning `getEnemyAction`

Written **before** the AI merge. This is the safety net for the whole unification: if `enemy_default` ever drifts from today's enemy behavior, this test goes red.

**Files:**
- Create: `src/systems/CombatEngine.test.ts`

**Interfaces:**
- Consumes: `getEnemyAction`, `createCombatCreature` from `src/systems/CombatEngine.ts`.
- Produces: `makeTestCreature(opts)` fixture helper, re-exported for later AI tests to import.

- [ ] **Step 1: Write the fixture helper and characterization tests**

Create `src/systems/CombatEngine.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  CombatCreature, CreatureInstance, CreatureTemplate, BaseStats, DamageType,
} from '../types';
import { createCombatCreature, getEnemyAction } from './CombatEngine';

export function testStats(over: Partial<BaseStats> = {}): BaseStats {
  return { hp: 100, mp: 20, str: 40, def: 20, wis: 20, spd: 20, int: 40, ...over };
}

export interface TestCreatureOpts {
  speciesId?: string;
  abilities?: (string | null)[];
  isPlayer?: boolean;
  hp?: number;
  mp?: number;
  stats?: Partial<BaseStats>;
  weaknesses?: DamageType[];
  resistances?: DamageType[];
}

/** Builds a CombatCreature with predictable stats for AI and engine tests. */
export function makeTestCreature(opts: TestCreatureOpts = {}): CombatCreature {
  const speciesId = opts.speciesId ?? 'dummy';
  const s = testStats(opts.stats);
  const template: CreatureTemplate = {
    id: speciesId,
    name: speciesId,
    archetype: 'Fauna',
    baseStats: s,
    defaultAbilities: [],
    resistances: [],
    weaknesses: [],
    spriteColor: 0,
  };
  const instance: CreatureInstance = {
    instanceId: `i-${speciesId}`,
    speciesId,
    nickname: null,
    starRating: 0,
    currentLevel: 1,
    levelCap: 5,
    permanentLevel: 1,
    essenceInvested: 0,
    abilities: opts.abilities ?? ['basic_attack'],
    traitSlots: [],
    lineage: { parentA: null, parentB: null },
    currentStats: s,
    resistances: opts.resistances ?? [],
    weaknesses: opts.weaknesses ?? [],
    isRetired: false,
    isBreedReady: false,
    xp: 0,
  };
  const c = createCombatCreature(instance, template, opts.isPlayer ?? true);
  // `stats` sets the maxima; `hp`/`mp` set the current values. An override
  // above the stat-derived max raises the max with it, so `{ hp: 500 }` builds
  // a tanky creature at full health rather than the impossible 500/100.
  if (opts.hp !== undefined) {
    c.currentHp = opts.hp;
    if (opts.hp > c.maxHp) c.maxHp = opts.hp;
  }
  if (opts.mp !== undefined) {
    c.currentMp = opts.mp;
    if (opts.mp > c.maxMp) c.maxMp = opts.mp;
  }
  c.isKnockedOut = c.currentHp <= 0;
  return c;
}

/** Forces Math.random to yield the given sequence, then repeat its last value. */
function seedRandom(values: number[]): void {
  let i = 0;
  vi.spyOn(Math, 'random').mockImplementation(() => values[Math.min(i++, values.length - 1)]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getEnemyAction — characterization', () => {
  it('picks the highest-power affordable non-Status ability', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20,
      abilities: ['jab', 'thrash', 'smash'], // power 30 / 75 / 50
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('thrash');
  });

  it('ignores abilities it cannot afford', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 4,
      abilities: ['jab', 'thrash', 'smash'], // costs 2 / 5 / 4
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('smash');
  });

  it('never uses Status abilities', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20,
      abilities: ['bold', 'mend', 'harden'], // all Status
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('basic_attack');
  });

  it('falls back to basic_attack with no MP', () => {
    seedRandom([0]);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 0, abilities: ['thrash'],
    });
    const party = [makeTestCreature({ speciesId: 'hero' })];
    expect(getEnemyAction(enemy, party).abilityId).toBe('basic_attack');
  });

  it('targets a random living party member and skips the knocked out', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const b = makeTestCreature({ speciesId: 'b', hp: 0 });
    const c = makeTestCreature({ speciesId: 'c' });
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false, mp: 0 });

    seedRandom([0]);
    expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).toBe('a');

    vi.restoreAllMocks();
    seedRandom([0.99]);
    expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).toBe('c');

    // The two seeds above pin index scaling but CANNOT catch a dropped KO
    // filter: unfiltered, floor(0*3)=0 -> a and floor(0.99*3)=2 -> c, the same
    // answers. 0.4 is the seed that diverges — filtered floor(0.8)=0 -> a,
    // unfiltered floor(1.2)=1 -> b, the dead one. Without this the whole
    // characterization is decorative.
    vi.restoreAllMocks();
    seedRandom([0.4]);
    expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).toBe('a');
  });

  it('never returns a knocked-out target across a spread of seeds', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const b = makeTestCreature({ speciesId: 'b', hp: 0 });
    const c = makeTestCreature({ speciesId: 'c' });
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false, mp: 0 });

    for (const seed of [0, 0.1, 0.3, 0.4, 0.5, 0.7, 0.9, 0.99]) {
      vi.restoreAllMocks();
      seedRandom([seed]);
      expect(getEnemyAction(enemy, [a, b, c]).target.instance.speciesId).not.toBe('b');
    }
  });

  it('consumes exactly one Math.random call per decision', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['jab'],
    });
    getEnemyAction(enemy, [makeTestCreature({ speciesId: 'hero' })]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests against the current implementation**

Run: `npx vitest run src/systems/CombatEngine.test.ts`
Expected: **all 6 PASS.** These characterize existing behavior, so they must pass immediately. If any fails, the test encodes a wrong assumption — fix the test, not `CombatEngine.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/systems/CombatEngine.test.ts
git commit -m "test: characterize current enemy AI behavior

Pins getEnemyAction's ability choice, targeting, and RNG consumption
before the player/enemy AI code paths merge, so any drift in
enemy_default shows up as a red test rather than a harder floor 12."
```

---

### Task 4: Refactor `calculateDamage` into a deterministic core

The AI needs to estimate damage without consuming RNG or rolling phantom misses. Extract the deterministic arithmetic; leave the rolls on top.

**Files:**
- Modify: `src/systems/CombatEngine.ts:21-68`
- Modify: `src/systems/CombatEngine.test.ts` (add coverage)

**Interfaces:**
- Consumes: `getEffectiveStat` from `CombatEngine.ts`.
- Produces: `baseDamage(attacker: CombatCreature, defender: CombatCreature, ability: Ability, useTypeMultiplier: boolean): number` — deterministic, unfloored, no accuracy weighting, no crit. `calculateDamage`'s signature and behavior are unchanged.

- [ ] **Step 1: Write a test asserting RNG order is preserved**

Append to `src/systems/CombatEngine.test.ts`:

```typescript
import { calculateDamage, baseDamage } from './CombatEngine';
import { getAbility } from '../data/abilities';

describe('baseDamage', () => {
  it('is deterministic and consumes no RNG', () => {
    const spy = vi.spyOn(Math, 'random');
    const a = makeTestCreature({ speciesId: 'a', isPlayer: true });
    const d = makeTestCreature({ speciesId: 'd', isPlayer: false });
    const first = baseDamage(a, d, getAbility('smash'), true);
    const second = baseDamage(a, d, getAbility('smash'), true);
    expect(first).toBe(second);
    expect(spy).not.toHaveBeenCalled();
  });

  it('applies the weakness multiplier only when asked', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const weak = makeTestCreature({ speciesId: 'd', weaknesses: ['Fire'] });
    const ember = getAbility('ember');
    expect(baseDamage(a, weak, ember, true)).toBeCloseTo(baseDamage(a, weak, ember, false) * 1.5);
  });

  it('applies the resistance multiplier only when asked', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const tough = makeTestCreature({ speciesId: 'd', resistances: ['Fire'] });
    const ember = getAbility('ember');
    expect(baseDamage(a, tough, ember, true)).toBeCloseTo(baseDamage(a, tough, ember, false) * 0.5);
  });

  it('halves damage against a defending target', () => {
    const a = makeTestCreature({ speciesId: 'a' });
    const d = makeTestCreature({ speciesId: 'd' });
    const open = baseDamage(a, d, getAbility('smash'), true);
    d.isDefending = true;
    expect(baseDamage(a, d, getAbility('smash'), true)).toBeCloseTo(open * 0.5);
  });
});

describe('calculateDamage — RNG contract', () => {
  it('rolls hit before crit, and misses without rolling crit', () => {
    // First value > hitChance forces a miss; only one roll should be consumed.
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const a = makeTestCreature({ speciesId: 'a', isPlayer: true });
    const d = makeTestCreature({ speciesId: 'd', isPlayer: false });
    // seismic_slam has accuracy 90, so 0.99 > 0.90 misses.
    const result = calculateDamage(a, d, getAbility('seismic_slam'));
    expect(result.missed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not crit for enemy attackers', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const hero = makeTestCreature({ speciesId: 'hero', isPlayer: true });
    expect(calculateDamage(enemy, hero, getAbility('smash')).isCrit).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/systems/CombatEngine.test.ts`
Expected: FAIL — `baseDamage` is not exported from `./CombatEngine`.

- [ ] **Step 3: Refactor `calculateDamage`**

In `src/systems/CombatEngine.ts`, replace the whole `calculateDamage` function (lines 21-68) with:

```typescript
/**
 * Deterministic damage core: stat matchup, power, optional type multiplier,
 * and the defend halving. No RNG — no hit roll, no crit, no accuracy weighting.
 * Shared by calculateDamage (which layers the rolls on top) and the AI's
 * estimateDamage (which layers accuracy on top).
 *
 * `useTypeMultiplier` is false when the caller must not assume knowledge of the
 * defender's resistances — that is how the AI's knowledge fog is enforced.
 */
export function baseDamage(
  attacker: CombatCreature,
  defender: CombatCreature,
  ability: Ability,
  useTypeMultiplier: boolean,
): number {
  if (ability.power === 0) return 0;

  const isPhysical = ability.category === 'Physical';
  const atkStat = isPhysical ? getEffectiveStat(attacker, 'str') : getEffectiveStat(attacker, 'int');
  const defStat = isPhysical ? getEffectiveStat(defender, 'def') : getEffectiveStat(defender, 'wis');

  // Core formula: (ATK - DEF/2) * (Power/50) * TypeMult
  let damage = Math.max(1, atkStat - defStat / 2) * (ability.power / 50);

  if (useTypeMultiplier && ability.damageType !== 'None') {
    const dmgType = ability.damageType as DamageType;
    if (defender.instance.resistances.includes(dmgType)) {
      damage *= RESISTANCE_MULTIPLIER;
    } else if (defender.instance.weaknesses.includes(dmgType)) {
      damage *= WEAKNESS_MULTIPLIER;
    }
  }

  // Defend halves damage
  if (defender.isDefending) {
    damage *= 0.5;
  }

  return damage;
}

export function calculateDamage(
  attacker: CombatCreature,
  defender: CombatCreature,
  ability: Ability,
): { damage: number; isCrit: boolean; missed: boolean } {
  // Check hit — this roll must stay first to preserve the RNG stream.
  const hitChance = Math.max(MIN_HIT_CHANCE, ability.accuracy / 100);
  if (Math.random() > hitChance) {
    return { damage: 0, isCrit: false, missed: true };
  }

  if (ability.power === 0) return { damage: 0, isCrit: false, missed: false };

  let damage = baseDamage(attacker, defender, ability, true);

  // Crit check (player only)
  let isCrit = false;
  if (attacker.isPlayerOwned) {
    const critRate = ability.highCrit ? HIGH_CRIT_RATE : BASE_CRIT_RATE;
    const spdBonus = getEffectiveStat(attacker, 'spd') / 1000;
    if (Math.random() < critRate + spdBonus) {
      isCrit = true;
      damage *= CRIT_MULTIPLIER;
    }
  }

  return { damage: Math.max(1, Math.floor(damage)), isCrit, missed: false };
}
```

The roll order (hit, then the `power === 0` early return, then crit) is unchanged from the original, so the RNG stream is identical.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/systems/CombatEngine.test.ts`
Expected: PASS, including the Task 3 characterization tests.

Run: `npm test`
Expected: all suites pass.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/systems/CombatEngine.ts src/systems/CombatEngine.test.ts
git commit -m "refactor: split deterministic damage core out of calculateDamage

baseDamage() holds the stat/power/type/defend arithmetic with no RNG,
so the tactics AI can estimate damage without consuming the combat
random stream. calculateDamage layers the hit and crit rolls back on
in the original order, leaving its behavior identical."
```

---

### Task 5: Data model, types, and save v3

Moved ahead of the AI tasks because `TacticsAI` and its test fixtures reference `CreatureInstance.tactic`.

**Files:**
- Modify: `src/types.ts` (add `TacticId`, `TacticProfile`, `CombatAction`, `KnownSpecies`; add `tactic` to `CreatureInstance`; add `autoCombat` to `RunState`)
- Modify: `src/managers/GameState.ts` (add `seenSpecies`, `battleSpeed`, set `tactic` on creation, save/load v3)
- Modify: `src/systems/BreedingSystem.ts:62` (offspring gets a tactic)
- Modify: `src/scenes/CombatScene.ts:67` (enemy instances get a tactic)
- Modify: `src/scenes/RunScene.ts:19-30` (new runs start with `autoCombat: false`)
- Modify: `src/managers/GameState.test.ts` (persistence coverage)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type TacticId = 'fight_wisely' | 'all_out' | 'conserve_mp' | 'heal_first' | 'follow_orders'`
  - `type TacticProfile = Exclude<TacticId, 'follow_orders'> | 'enemy_default'`
  - `type CombatAction = { kind: 'ability'; abilityId: string; target: CombatCreature } | { kind: 'defend' }`
  - `type KnownSpecies = ReadonlySet<string>`
  - `const TACTIC_LABELS: Record<TacticId, string>`
  - `CreatureInstance.tactic: TacticId`, `RunState.autoCombat: boolean`
  - `gameState.seenSpecies: Set<string>`, `gameState.battleSpeed: BattleSpeed`, `gameState.recordSeenSpecies(id)`

- [ ] **Step 1: Add the types**

In `src/types.ts`, immediately after the `export type TargetingType = ...` line:

```typescript
/** A standing behavior the player assigns to a creature. */
export type TacticId =
  | 'fight_wisely'
  | 'all_out'
  | 'conserve_mp'
  | 'heal_first'
  | 'follow_orders';

/**
 * A profile the AI can actually execute. Excludes 'follow_orders' — that value
 * means "do not call the AI at all" — and adds the enemy profile, which the
 * player can never select. The scene narrows TacticId to TacticProfile, so the
 * type system makes it impossible to hand 'follow_orders' to chooseAction.
 */
export type TacticProfile = Exclude<TacticId, 'follow_orders'> | 'enemy_default';

export const TACTIC_LABELS: Record<TacticId, string> = {
  fight_wisely: 'Fight Wisely',
  all_out: 'All Out',
  conserve_mp: 'Conserve MP',
  heal_first: 'Heal First',
  follow_orders: 'Follow Orders',
};

/** Player-assignable tactics, in cycle order for the UI. */
export const TACTIC_ORDER: TacticId[] = [
  'fight_wisely', 'all_out', 'conserve_mp', 'heal_first', 'follow_orders',
];

/** Species whose resistances and weaknesses a side is allowed to exploit. */
export type KnownSpecies = ReadonlySet<string>;
```

- [ ] **Step 2: Add `CombatAction` after the `CombatCreature` interface**

In `src/types.ts`, directly after the closing brace of `interface CombatCreature`:

```typescript
/** What the tactics AI decides to do. The AI never applies it — the scene does. */
export type CombatAction =
  | { kind: 'ability'; abilityId: string; target: CombatCreature }
  | { kind: 'defend' };
```

- [ ] **Step 3: Add the fields to `CreatureInstance` and `RunState`**

In `src/types.ts`, inside `interface CreatureInstance`, after `xp: number;`:

```typescript
  tactic: TacticId;       // standing auto-combat behavior; persists across runs
```

Inside `interface RunState`, after `xpEarned: number;`:

```typescript
  autoCombat: boolean;    // AUTO toggle state; persists across encounters within a run
```

- [ ] **Step 4: Add the battle speed constants**

Append to `src/types.ts`:

```typescript
// --- Battle pacing ---
export const BATTLE_SPEEDS = [1, 2, 4] as const;
export type BattleSpeed = typeof BATTLE_SPEEDS[number];

export const COMBAT_DELAY_ACTION = 800;       // after an action resolves
export const COMBAT_DELAY_TURN_END = 400;     // after a turn finishes
export const COMBAT_DELAY_STATUS_SKIP = 1000; // on a status-skip message
export const COMBAT_DELAY_AUTO_THINK = 350;   // beat before an AI acts, so it reads as a decision
export const COMBAT_DELAY_FLOOR = 100;        // never go below this, or tweens collapse

/** Scale a pacing delay by the player's battle speed, never below the floor. */
export function scaledDelay(baseMs: number, speed: BattleSpeed): number {
  return Math.max(COMBAT_DELAY_FLOOR, Math.round(baseMs / speed));
}
```

- [ ] **Step 5: Write the failing persistence tests**

Append to `src/managers/GameState.test.ts`:

```typescript
describe('tactics and settings persistence', () => {
  it('gives new creatures the balanced tactic by default', () => {
    const c = gameState.createCreatureInstance('ironjaw', 0);
    expect(c.tactic).toBe('fight_wisely');
  });

  it('records seen species without duplicates', () => {
    gameState.seenSpecies = new Set();
    gameState.recordSeenSpecies('ironjaw');
    gameState.recordSeenSpecies('ironjaw');
    expect(gameState.seenSpecies.size).toBe(1);
    expect(gameState.seenSpecies.has('ironjaw')).toBe(true);
  });

  it('round-trips seenSpecies, battleSpeed, and tactic through save/load', () => {
    gameState.initializeNewGame(['ironjaw']);
    gameState.creatureBox[0].tactic = 'heal_first';
    gameState.seenSpecies = new Set(['mossgolem', 'petalward']);
    gameState.battleSpeed = 4;
    gameState.saveToLocalStorage();

    gameState.creatureBox = [];
    gameState.seenSpecies = new Set();
    gameState.battleSpeed = 1;
    expect(gameState.loadFromLocalStorage()).toBe(true);

    expect(gameState.creatureBox[0].tactic).toBe('heal_first');
    expect(gameState.battleSpeed).toBe(4);
    expect([...gameState.seenSpecies].sort()).toEqual(['mossgolem', 'petalward']);
  });

  it('migrates a v2 save with safe defaults', () => {
    localStorage.setItem('hollow_kin_save', JSON.stringify({
      version: 2,
      essence: 40,
      deepestBreakCleared: 5,
      selectedStartFloor: 1,
      hasCompletedFirstRun: true,
      creatureBox: [{
        instanceId: 'old-1', speciesId: 'ironjaw', nickname: null, starRating: 1,
        currentLevel: 3, levelCap: 10, abilities: ['ember'], traitSlots: [],
        lineage: { parentA: null, parentB: null },
        currentStats: { hp: 50, mp: 10, str: 10, def: 10, wis: 10, spd: 10, int: 10 },
        resistances: [], weaknesses: [], isRetired: false, isBreedReady: false, xp: 0,
      }],
    }));

    expect(gameState.loadFromLocalStorage()).toBe(true);
    expect(gameState.creatureBox[0].tactic).toBe('fight_wisely');
    expect(gameState.battleSpeed).toBe(1);
    expect(gameState.seenSpecies.size).toBe(0);
    expect(gameState.essence).toBe(40);
  });
});
```

Check the top of `src/managers/GameState.test.ts` for how it imports `gameState` and whether it stubs `localStorage`; match the existing pattern rather than inventing a new one.

- [ ] **Step 6: Run to confirm failure**

Run: `npx vitest run src/managers/GameState.test.ts`
Expected: FAIL — `tactic` does not exist, `recordSeenSpecies` is not a function.

- [ ] **Step 7: Update `GameState`**

In `src/managers/GameState.ts`:

Add to the imports on line 1-4: `BattleSpeed` and `TacticId`.

Add these fields after `hasCompletedFirstRun = false;`:

```typescript
  seenSpecies: Set<string> = new Set();
  battleSpeed: BattleSpeed = 1;
```

Add `tactic: 'fight_wisely',` to the object returned by `createCreatureInstance`, after `xp: 0,`.

Add these methods after `recordBreakCleared`:

```typescript
  /** Note that the player has met this species; unlocks weakness use for auto-combat. */
  recordSeenSpecies(speciesId: string): void {
    this.seenSpecies.add(speciesId);
  }

  /** Cycle 1x -> 2x -> 4x -> 1x. Returns the new speed. */
  cycleBattleSpeed(): BattleSpeed {
    this.battleSpeed = this.battleSpeed === 1 ? 2 : this.battleSpeed === 2 ? 4 : 1;
    return this.battleSpeed;
  }
```

In `initializeNewGame`, after `this.hasCompletedFirstRun = false;`:

```typescript
    this.seenSpecies = new Set();
    this.battleSpeed = 1;
```

Replace `saveToLocalStorage`'s `data` object with:

```typescript
    const data = {
      version: 3,
      creatureBox: this.creatureBox,
      essence: this.essence,
      deepestBreakCleared: this.deepestBreakCleared,
      selectedStartFloor: this.selectedStartFloor,
      hasCompletedFirstRun: this.hasCompletedFirstRun,
      seenSpecies: [...this.seenSpecies],
      battleSpeed: this.battleSpeed,
    };
```

In `loadFromLocalStorage`, after the `this.hasCompletedFirstRun = ...` line:

```typescript
      // v3 additions — absent on v2 saves, so default safely.
      this.seenSpecies = new Set<string>(data.seenSpecies ?? []);
      this.battleSpeed = (data.battleSpeed ?? 1) as BattleSpeed;
```

And inside the `creatureBox` map, add to the returned object alongside `permanentLevel`:

```typescript
          tactic: (c.tactic ?? 'fight_wisely') as TacticId,
```

- [ ] **Step 8: Fix the other two construction sites**

In `src/systems/BreedingSystem.ts`, add to the returned object after `xp: 0,`:

```typescript
    tactic: 'fight_wisely',
```

In `src/scenes/CombatScene.ts`, add to the `enemyInstance` literal after `xp: 0,`:

```typescript
        tactic: 'fight_wisely', // unused for enemies; they run the enemy_default profile
```

In `src/scenes/RunScene.ts`, add to the `gameState.currentRun = { ... }` literal after `xpEarned: 0,`:

```typescript
        autoCombat: false,
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run src/managers/GameState.test.ts`
Expected: PASS.

Run: `npm test`
Expected: all suites pass.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/managers/GameState.ts src/managers/GameState.test.ts src/systems/BreedingSystem.ts src/scenes/CombatScene.ts src/scenes/RunScene.ts
git commit -m "feat: tactics data model and save v3

Adds TacticId/TacticProfile/CombatAction types, a per-creature tactic
that persists across runs, a per-run AUTO flag, global seenSpecies
memory and battleSpeed preference, plus battle pacing constants.
v2 saves migrate with fight_wisely, an empty bestiary, and 1x speed."
```

---

### Task 6: `TacticsAI` scaffolding, helpers, and `enemy_default`

Builds the module and immediately routes enemies through it. The Task 3 characterization test is the gate.

**Files:**
- Create: `src/systems/TacticsAI.ts`
- Create: `src/systems/TacticsAI.test.ts`
- Modify: `src/systems/CombatEngine.ts:188-209` (`getEnemyAction` delegates)

**Interfaces:**
- Consumes: `baseDamage`, `getEffectiveStat`, `createCombatCreature` (`CombatEngine.ts`); `makeTestCreature` (`CombatEngine.test.ts`); `TacticProfile`, `CombatAction`, `KnownSpecies` (`types.ts`).
- Produces:
  - `chooseAction(actor, allies, foes, profile, known): CombatAction`
  - `estimateDamage(actor, foe, ability, known): number`
  - `const NO_KNOWLEDGE: KnownSpecies`
  - Internal helpers `living`, `hpFraction`, `abilityList`, `damageCandidates`, `healCandidates`, `bestBy` — not exported.

- [ ] **Step 1: Write the failing tests**

Create `src/systems/TacticsAI.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeTestCreature } from './CombatEngine.test';
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
    const d = makeTestCreature({ speciesId: 'unknown', weaknesses: ['Fire'] });
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
    // Weaker-power Fire move vs a Fire-weak target: an informed AI would pick ember.
    const enemy = makeTestCreature({
      speciesId: 'foe', isPlayer: false, mp: 20, abilities: ['ember', 'thrash'],
    });
    const hero = makeTestCreature({ speciesId: 'hero', weaknesses: ['Fire'] });
    const action = chooseAction(enemy, [enemy], [hero], 'enemy_default', new Set(['hero']));
    // enemy_default sorts by raw power only: thrash (75) beats ember (40).
    expect(action).toMatchObject({ abilityId: 'thrash' });
  });

  it('defends when no foe is alive', () => {
    const enemy = makeTestCreature({ speciesId: 'foe', isPlayer: false });
    const dead = makeTestCreature({ speciesId: 'hero', hp: 0 });
    expect(chooseAction(enemy, [enemy], [dead], 'enemy_default', NO_KNOWLEDGE))
      .toEqual({ kind: 'defend' });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/systems/TacticsAI.test.ts`
Expected: FAIL — cannot resolve `./TacticsAI`.

- [ ] **Step 3: Create the module**

Create `src/systems/TacticsAI.ts`:

```typescript
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
 * then lower target HP, then abilityId — so the result never depends on
 * iteration luck.
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
    if (o.abilityId < best.abilityId) best = o;
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
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/systems/TacticsAI.test.ts`
Expected: PASS (all 8).

- [ ] **Step 5: Delegate `getEnemyAction` to the new module**

In `src/systems/CombatEngine.ts`, replace the whole `getEnemyAction` function (lines 188-209) with:

```typescript
/**
 * Thin compatibility wrapper. Enemy decisions now come from TacticsAI's
 * enemy_default profile, which is a literal port of the logic that used to live
 * here — CombatEngine.test.ts pins the behavior.
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
```

Add this import at the top of `src/systems/CombatEngine.ts`:

```typescript
import { chooseAction, NO_KNOWLEDGE } from './TacticsAI';
```

`TacticsAI` imports `baseDamage` and `getEffectiveStat` from `CombatEngine`, and `CombatEngine` now imports `chooseAction` from `TacticsAI`. This circular import is safe here because both sides are function declarations resolved at call time, not at module-evaluation time — ES modules hoist function declarations. If Vite or vitest reports a circularity problem, break it by moving `getEnemyAction` into `TacticsAI.ts` and re-exporting it from `CombatEngine`.

- [ ] **Step 6: Run the characterization gate**

Run: `npx vitest run src/systems/CombatEngine.test.ts`
Expected: **PASS** — all Task 3 characterization tests still green. This is the whole point of the task: enemy behavior is provably unchanged after the merge.

Run: `npm test`
Expected: all suites pass.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/systems/TacticsAI.ts src/systems/TacticsAI.test.ts src/systems/CombatEngine.ts
git commit -m "feat: TacticsAI module with enemy_default profile

Side-agnostic chooseAction() with deterministic estimateDamage and
fully-ordered tie-breaks. enemy_default is a literal port of the old
getEnemyAction, which is now a thin wrapper — the characterization
tests confirm enemy behavior is byte-identical."
```

---

### Task 7: Fight Wisely and All Out

**Files:**
- Modify: `src/systems/TacticsAI.ts` (add both profiles)
- Modify: `src/systems/TacticsAI.test.ts` (add coverage)

**Interfaces:**
- Consumes: `damageCandidates`, `bestBy`, `toAction`, `living`, `hpFraction`, `abilityList`, `affordable` from Task 6.
- Produces: `chooseAction(..., 'fight_wisely', ...)` and `chooseAction(..., 'all_out', ...)`; internal `healCandidates(actor, allies)` returning `HealOption[]`.

- [ ] **Step 1: Write the failing tests**

Append to `src/systems/TacticsAI.test.ts`:

```typescript
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

  it('rule 3: uses a spread ability when it out-totals the best single hit', () => {
    const hero = makeTestCreature({
      speciesId: 'hero', mp: 20, abilities: ['discharge', 'spark'], // spread 70 / single 40
    });
    const a = makeTestCreature({ speciesId: 'fa', isPlayer: false });
    const b = makeTestCreature({ speciesId: 'fb', isPlayer: false });
    const c = makeTestCreature({ speciesId: 'fc', isPlayer: false });
    const action = chooseAction(hero, [hero], [a, b, c], 'fight_wisely', NO_KNOWLEDGE);
    expect(action).toMatchObject({ abilityId: 'discharge' });
  });

  it('rule 4: knowledge flips the choice toward the weakness', () => {
    // gale: Wind, power 60, 5 MP -> ~36 damage.
    // ember: Fire, power 40, 2 MP -> ~24 blind, ~36 against a Fire weakness.
    // Blind, gale is strictly stronger. Informed, ember ties it and wins the
    // cheaper-cost tie-break. Same board, opposite decision.
    const foe = makeTestCreature({
      speciesId: 'foe', isPlayer: false, hp: 500, weaknesses: ['Fire'],
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

  it('rule 5: basic attacks with no MP', () => {
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/systems/TacticsAI.test.ts -t "fight_wisely"`
Expected: FAIL — the fallback returns `basic_attack` where a tactic action is expected.

- [ ] **Step 3: Add heal candidates and the two profiles**

In `src/systems/TacticsAI.ts`, add after the `bestBy` / `toAction` helpers:

```typescript
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

function fightWisely(
  actor: CombatCreature,
  allies: CombatCreature[],
  foes: CombatCreature[],
  known: KnownSpecies,
): CombatAction {
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
  //    (Deviates from spec §5's "best damage per MP" — see the deviation note
  //    at the bottom of this plan. Raw damage-per-MP makes the free basic
  //    attack dominate every paid ability, collapsing this tactic into
  //    Conserve MP.)
  const budget = Math.floor(actor.currentMp / 2);
  const withinBudget = options.filter(o => o.mpCost <= budget);
  const strongest = bestBy(withinBudget, o => o.damage);
  if (strongest) return toAction(strongest)!;

  // 5. Nothing affordable.
  return fallback(actor, foes, known);
}

function allOut(
  actor: CombatCreature,
  foes: CombatCreature[],
  known: KnownSpecies,
): CombatAction {
  const options = damageCandidates(actor, foes, known);

  // 1. Kill, hitting as hard as possible while doing it.
  const kill = bestBy(killers(options), o => o.damage);
  if (kill) return toAction(kill)!;

  // 2. Maximum damage, cost disregarded entirely.
  const hardest = bestBy(options, o => o.damage);
  if (hardest) return toAction(hardest)!;

  return fallback(actor, foes, known);
}
```

- [ ] **Step 4: Wire them into `chooseAction`**

Replace the `switch` inside `chooseAction` with:

```typescript
  switch (profile) {
    case 'enemy_default':
      return enemyDefault(actor, foes);
    case 'fight_wisely':
      return fightWisely(actor, allies, foes, known);
    case 'all_out':
      return allOut(actor, foes, known);
    default:
      // conserve_mp and heal_first land in Task 8.
      return fallback(actor, foes, known);
  }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/systems/TacticsAI.test.ts`
Expected: PASS (all, including the Task 6 cases).

Run: `npm test`
Expected: all suites pass.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/systems/TacticsAI.ts src/systems/TacticsAI.test.ts
git commit -m "feat: Fight Wisely and All Out tactics

Fight Wisely rescues below 30%, closes kills cheaply, prefers spread
when it out-totals a single hit, else hits hardest within half its
current MP. All Out maximizes raw damage and ignores MP entirely.
Weakness-seeking falls out of estimateDamage rather than needing an
explicit rule."
```

---

### Task 8: Conserve MP and Heal First

**Files:**
- Modify: `src/systems/TacticsAI.ts`
- Modify: `src/systems/TacticsAI.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 6 and 7.
- Produces: `chooseAction(..., 'conserve_mp', ...)` and `chooseAction(..., 'heal_first', ...)`; internal `buffAction` and `debuffAction` helpers.

- [ ] **Step 1: Write the failing tests**

Append to `src/systems/TacticsAI.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/systems/TacticsAI.test.ts -t "conserve_mp"`
Expected: FAIL — the fallback returns `basic_attack` where tactic actions are expected.

- [ ] **Step 3: Add buff/debuff helpers and both profiles**

In `src/systems/TacticsAI.ts`, add after the `killers` helper:

```typescript
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

  // "Strongest" = highest effective STR, tie-broken on species id for determinism.
  let strongest = alive[0];
  for (const f of alive.slice(1)) {
    const a = getEffectiveStat(f, 'str');
    const b = getEffectiveStat(strongest, 'str');
    if (a > b || (a === b && f.instance.speciesId < strongest.instance.speciesId)) strongest = f;
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
): CombatAction {
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
): CombatAction {
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
  const heals = healCandidates(actor, allies);
  if (heals.length > 0) {
    const cheapestHeal = heals.reduce((a, b) => (b.mpCost < a.mpCost ? b : a)).mpCost;
    if (actor.currentMp < cheapestHeal * 2) return fallback(actor, foes, known);
  }
  // Past the reserve check, spending is already sanctioned — so hit hardest
  // rather than most efficiently, for the same reason as Conserve MP's rule 4.
  const strongest = bestBy(damageCandidates(actor, foes, known), o => o.damage);
  if (strongest) return toAction(strongest)!;

  // 5.
  return fallback(actor, foes, known);
}
```

- [ ] **Step 4: Complete `chooseAction`**

Replace the `switch` with the exhaustive version:

```typescript
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
```

With `TacticProfile` fully covered, TypeScript proves the switch exhaustive and no `default` is needed. Delete the now-unused `default` branch.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/systems/TacticsAI.test.ts`
Expected: PASS (all).

Run: `npm test`
Expected: all suites pass — including the Task 3 characterization tests.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/systems/TacticsAI.ts src/systems/TacticsAI.test.ts
git commit -m "feat: Conserve MP and Heal First tactics

Conserve MP basic-attacks by default and unlocks spending only when an
ally drops to 50%, capped at a third of max MP. Heal First triages at
60%, then buffs and debuffs, and holds MP in reserve once it can no
longer afford two heals. All four player profiles now consume zero RNG."
```

---

### Task 9: Scene wiring — AUTO toggle, dispatch, seen species

**Files:**
- Modify: `src/scenes/CombatScene.ts` (turn dispatch, HUD, `seenSpecies` recording)
- Modify: `src/scenes/combat/BattlefieldRenderer.ts` (tactic readout)

**Interfaces:**
- Consumes: `chooseAction` (`TacticsAI`), `gameState.seenSpecies`, `run.autoCombat`, `TACTIC_LABELS`.
- Produces: `CombatScene.drawHud()`, `CombatScene.executeAutoTurn(creature)`. `BattlefieldView` gains `showTactics: boolean`.

- [ ] **Step 1: Record seen species**

In `src/scenes/CombatScene.ts`, inside `initBattle`'s enemy loop, immediately after `const template = getTemplate(speciesId);`:

```typescript
      // The player has met this species — auto-combat may use its weaknesses from now on.
      gameState.recordSeenSpecies(speciesId);
```

- [ ] **Step 2: Add the auto dispatch to `nextTurn`**

Replace the `if (current.isPlayerOwned) { ... }` block near `CombatScene.ts:149` with:

```typescript
    if (current.isPlayerOwned) {
      const run2 = gameState.currentRun!;
      const tactic = current.instance.tactic;
      if (run2.autoCombat && tactic !== 'follow_orders') {
        this.phase = BattlePhase.EXECUTING;
        this.drawBattlefield();
        this.time.delayedCall(COMBAT_DELAY_AUTO_THINK, () => this.executeAutoTurn(current));
      } else {
        this.phase = BattlePhase.PLAYER_CHOOSING;
        this.drawBattlefield();
        this.showActionMenu(current);
      }
    } else {
```

- [ ] **Step 3: Add `executeAutoTurn`**

Insert immediately before `executeEnemyTurn`:

```typescript
  private executeAutoTurn(creature: CombatCreature): void {
    // tactic is narrowed to TacticProfile — 'follow_orders' never reaches here.
    const profile = creature.instance.tactic as Exclude<TacticId, 'follow_orders'>;
    const action = chooseAction(
      creature,
      this.playerParty,
      this.enemyParty,
      profile,
      gameState.seenSpecies,
    );

    if (action.kind === 'defend') {
      creature.isDefending = true;
      this.addMessage(`${creature.template.name} defends!`);
      this.finishTurn(creature);
      return;
    }
    this.executePlayerAction(creature, action.abilityId, action.target);
  }
```

- [ ] **Step 4: Add the HUD**

Add this method immediately before `drawBattlefield`:

```typescript
  /** Toggle row, redrawn after every battlefield repaint since children are cleared. */
  private drawHud(): void {
    const run = gameState.currentRun!;

    const autoOn = run.autoCombat;
    const autoBg = this.add.rectangle(880, 20, 120, 28, autoOn ? 0x336633 : 0x333344, 0.95)
      .setStrokeStyle(2, autoOn ? 0x66cc66 : 0x555566)
      .setInteractive({ useHandCursor: true });
    this.add.text(880, 20, autoOn ? 'AUTO: ON' : 'AUTO: OFF', {
      fontSize: '12px', color: autoOn ? '#bbffbb' : '#9999aa', fontFamily: 'monospace',
    }).setOrigin(0.5);

    autoBg.on('pointerdown', () => {
      run.autoCombat = !run.autoCombat;
      gameState.saveToLocalStorage();
      // If we just switched on while waiting for input, hand this turn to the AI.
      const current = this.turnOrder[this.currentTurnIndex];
      if (run.autoCombat
        && this.phase === BattlePhase.PLAYER_CHOOSING
        && current?.isPlayerOwned
        && current.instance.tactic !== 'follow_orders') {
        this.clearUI();
        this.phase = BattlePhase.EXECUTING;
        this.drawBattlefield();
        this.time.delayedCall(COMBAT_DELAY_AUTO_THINK, () => this.executeAutoTurn(current));
      } else {
        this.drawBattlefield();
        if (this.phase === BattlePhase.PLAYER_CHOOSING && current) this.showActionMenu(current);
      }
    });
  }
```

- [ ] **Step 5: Call `drawHud` from `drawBattlefield`**

Update `drawBattlefield` to end with the HUD, and to pass the tactic flag:

```typescript
  private drawBattlefield(): void {
    // Clear previous battlefield elements (but not UI overlay)
    this.children.removeAll();
    this.uiElements = [];

    renderBattlefield(this, {
      playerParty: this.playerParty,
      enemyParty: this.enemyParty,
      currentActor: this.turnOrder[this.currentTurnIndex],
      messageLog: this.messageLog,
      showTactics: gameState.currentRun?.autoCombat ?? false,
    });

    this.drawHud();
  }
```

- [ ] **Step 6: Show the tactic in the renderer**

In `src/scenes/combat/BattlefieldRenderer.ts`, add `showTactics: boolean;` to `BattlefieldView`, import `TACTIC_LABELS` from `'../../types'`, and change the player draw call to pass it through:

```typescript
  view.playerParty.forEach((creature, i) => {
    drawCreature(scene, creature, 140, 120 + i * 120, true, view.showTactics);
  });

  view.enemyParty.forEach((creature, i) => {
    drawCreature(scene, creature, 700, 120 + i * 110, false, false);
  });
```

Update the `drawCreature` signature to `(scene, creature, x, y, isPlayer, showTactic: boolean)` and add this just before the KO marker block:

```typescript
  if (showTactic && isPlayer && !creature.isKnockedOut) {
    scene.add.text(labelX, y + 30, TACTIC_LABELS[creature.instance.tactic], {
      fontSize: '9px', color: '#88aacc', fontFamily: 'monospace',
    }).setOrigin(origin, 0.5);
  }
```

- [ ] **Step 7: Add the imports to CombatScene**

Add `chooseAction` and the new type/constant imports:

```typescript
import { chooseAction } from '../systems/TacticsAI';
```

and extend the existing `../types` import with `TacticId` and `COMBAT_DELAY_AUTO_THINK`.

- [ ] **Step 8: Type-check and test**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 9: Manual verification**

Run: `npm run dev`. Start a run and enter combat.
Expected:
- An `AUTO: OFF` button sits top-right; combat plays manually as before.
- Clicking it flips to `AUTO: ON`, tactic labels appear under player creatures, and the party acts on its own.
- Clicking again mid-fight returns to the manual action menu on the next player turn.
- Toggling AUTO on *while* the action menu is showing immediately hands that turn to the AI.

- [ ] **Step 10: Commit**

```bash
git add src/scenes/CombatScene.ts src/scenes/combat/BattlefieldRenderer.ts
git commit -m "feat: AUTO toggle and auto-combat turn dispatch

Auto turns route through chooseAction and execute via the same path a
click takes, so auto and manual cannot diverge. Records seen species on
encounter start, shows each creature's tactic while AUTO is on, and
lets the toggle seize a turn already waiting for input."
```

---

### Task 10: Tactic assignment in Party Select

**Files:**
- Modify: `src/scenes/PartySelectScene.ts`

**Interfaces:**
- Consumes: `TACTIC_ORDER`, `TACTIC_LABELS` from `types.ts`.
- Produces: a per-card tactic cycler that mutates `creature.tactic` and saves.

- [ ] **Step 1: Add the imports**

At the top of `src/scenes/PartySelectScene.ts`:

```typescript
import { TACTIC_ORDER, TACTIC_LABELS } from '../types';
```

- [ ] **Step 2: Add the tactic button to each card**

Inside the `available.forEach((creature, i) => { ... })` loop, after the `Lv ${creature.permanentLevel}` text block:

```typescript
      // Tactic cycler — a standing behavior for auto-combat, persists across runs.
      const tacticBg = this.add.rectangle(x + 62, y + 62, 96, 18, 0x223344, 0.95)
        .setStrokeStyle(1, 0x446688).setInteractive({ useHandCursor: true });
      const tacticText = this.add.text(x + 62, y + 62, TACTIC_LABELS[creature.tactic], {
        fontSize: '9px', color: '#88bbdd', fontFamily: 'monospace',
      }).setOrigin(0.5);

      tacticBg.on('pointerover', () => tacticBg.setFillStyle(0x334466));
      tacticBg.on('pointerout', () => tacticBg.setFillStyle(0x223344));
      tacticBg.on('pointerdown', () => {
        const idx = TACTIC_ORDER.indexOf(creature.tactic);
        creature.tactic = TACTIC_ORDER[(idx + 1) % TACTIC_ORDER.length];
        tacticText.setText(TACTIC_LABELS[creature.tactic]);
        gameState.saveToLocalStorage();
      });
```

The tactic button must be created **after** the card `bg` so it sits above it in the display list and receives the click instead of the selection rectangle.

- [ ] **Step 3: Type-check and test**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, go to party select.
Expected: each creature card shows a tactic chip. Clicking it cycles Fight Wisely → All Out → Conserve MP → Heal First → Follow Orders → back, **without** toggling that creature's party selection. Reload the page and confirm the chosen tactics persisted.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/PartySelectScene.ts
git commit -m "feat: assign tactics in party select

Per-creature tactic cycler on each card, saved immediately so the
choice persists across runs."
```

---

### Task 11: Battle speed control

**Files:**
- Modify: `src/scenes/CombatScene.ts` (scale every delay; add the speed button)
- Modify: `src/scenes/RunScene.ts` (AUTO toggle on the map overview)
- Create: `src/types.test.ts`

**Interfaces:**
- Consumes: `scaledDelay`, `COMBAT_DELAY_*`, `BattleSpeed`, `gameState.cycleBattleSpeed()` from Task 5.
- Produces: no new exports; all four `CombatScene` delay sites become speed-scaled.

- [ ] **Step 1: Write the failing test**

Create `src/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  scaledDelay, COMBAT_DELAY_ACTION, COMBAT_DELAY_TURN_END, COMBAT_DELAY_FLOOR,
} from './types';

describe('scaledDelay', () => {
  it('leaves delays untouched at 1x', () => {
    expect(scaledDelay(COMBAT_DELAY_ACTION, 1)).toBe(800);
  });

  it('halves at 2x and quarters at 4x', () => {
    expect(scaledDelay(COMBAT_DELAY_ACTION, 2)).toBe(400);
    expect(scaledDelay(COMBAT_DELAY_ACTION, 4)).toBe(200);
  });

  it('never drops below the floor', () => {
    expect(scaledDelay(COMBAT_DELAY_TURN_END, 4)).toBe(COMBAT_DELAY_FLOOR);
    expect(scaledDelay(120, 4)).toBe(COMBAT_DELAY_FLOOR);
  });
});
```

`COMBAT_DELAY_TURN_END` is 400, so at 4× the raw result is 100 — exactly the floor, which is the boundary worth pinning.

- [ ] **Step 2: Run it**

Run: `npx vitest run src/types.test.ts`
Expected: PASS — `scaledDelay` shipped in Task 5. If it fails, Task 5 is incomplete.

- [ ] **Step 3: Scale every delay in CombatScene**

Replace all four `this.time.delayedCall(...)` sites in `src/scenes/CombatScene.ts`:

| Location | Was | Becomes |
|---|---|---|
| status-skip in `nextTurn` | `1000` | `scaledDelay(COMBAT_DELAY_STATUS_SKIP, gameState.battleSpeed)` |
| auto-think in `nextTurn` (Task 9) | `COMBAT_DELAY_AUTO_THINK` | `scaledDelay(COMBAT_DELAY_AUTO_THINK, gameState.battleSpeed)` |
| end of `executePlayerAction` | `800` | `scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed)` |
| end of `executeEnemyTurn` | `800` | `scaledDelay(COMBAT_DELAY_ACTION, gameState.battleSpeed)` |
| end of `finishTurn` | `400` | `scaledDelay(COMBAT_DELAY_TURN_END, gameState.battleSpeed)` |

Also update the auto-think call inside `drawHud` (Task 9, Step 4) the same way.

Extend the `../types` import with `scaledDelay`, `COMBAT_DELAY_ACTION`, `COMBAT_DELAY_TURN_END`, `COMBAT_DELAY_STATUS_SKIP`.

- [ ] **Step 4: Add the speed button to the HUD**

In `drawHud`, after the AUTO button block:

```typescript
    const speed = gameState.battleSpeed;
    const speedBg = this.add.rectangle(880, 52, 120, 24, 0x333344, 0.95)
      .setStrokeStyle(2, 0x555566).setInteractive({ useHandCursor: true });
    this.add.text(880, 52, `SPEED ${speed}x`, {
      fontSize: '11px', color: '#bbbbcc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    speedBg.on('pointerover', () => speedBg.setFillStyle(0x444455));
    speedBg.on('pointerout', () => speedBg.setFillStyle(0x333344));
    speedBg.on('pointerdown', () => {
      gameState.cycleBattleSpeed();
      gameState.saveToLocalStorage();
      this.drawBattlefield();
      const current = this.turnOrder[this.currentTurnIndex];
      if (this.phase === BattlePhase.PLAYER_CHOOSING && current) this.showActionMenu(current);
    });
```

- [ ] **Step 5: Add the AUTO toggle to RunScene**

In `src/scenes/RunScene.ts`, inside `drawUI`, immediately before the `// Flee button` block:

```typescript
    // AUTO toggle — combat-system.md: switchable "during battle or from the map overview".
    const autoOn = run.autoCombat;
    const autoBg = this.add.rectangle(860, 45, 140, 26, autoOn ? 0x336633 : 0x333344, 0.95)
      .setStrokeStyle(2, autoOn ? 0x66cc66 : 0x555566)
      .setInteractive({ useHandCursor: true });
    this.add.text(860, 45, autoOn ? 'AUTO: ON' : 'AUTO: OFF', {
      fontSize: '12px', color: autoOn ? '#bbffbb' : '#9999aa', fontFamily: 'monospace',
    }).setOrigin(0.5);
    autoBg.on('pointerdown', () => {
      run.autoCombat = !run.autoCombat;
      gameState.saveToLocalStorage();
      this.drawUI();
    });
```

- [ ] **Step 6: Type-check and test**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: all suites pass.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`. Enter combat with AUTO on.
Expected:
- `SPEED 1x` sits under the AUTO button; clicking cycles 1× → 2× → 4× → 1×.
- At 4× the same battle resolves visibly faster, and messages still render (never instant).
- The setting survives a page reload.
- `RunScene` shows a matching AUTO toggle whose state agrees with the one in combat.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/CombatScene.ts src/scenes/RunScene.ts src/types.test.ts
git commit -m "feat: battle speed control and map-overview AUTO toggle

All combat pacing delays scale by a persisted 1x/2x/4x preference with
a 100ms floor so tweens cannot collapse. Speed applies to enemy turns
too, so tempo does not jump when a Follow Orders creature acts."
```

---

## Post-Implementation

- [ ] Run the full suite one final time: `npm test` and `npm run build`.
- [ ] Update `CLAUDE.md`: move "Auto-combat / tactics system" out of **What's NOT Built Yet** and into **Working systems**; drop it from roadmap item 5.
- [ ] Update `combat-system.md`: replace the "Detailed auto-combat AI decision trees per tactic" open question with a pointer to the spec, and note that the Monsterpedia dependency is partially satisfied by `seenSpecies`.
- [ ] Playtest against spec §14's open questions, especially whether Fight Wisely and Conserve MP have converged now that MP costs were cut ~40%.

---

## Self-Review Notes

**Spec coverage.** Every spec section maps to a task: §2 architecture → Tasks 6-8; §3 data model → Task 5; §4 helpers → Tasks 4 and 6; §5 ladders → Tasks 7-8; §7 no-defend → honored (no ladder emits `defend`; only the no-foes guard does); §8 ally targeting → Task 1; §9 speed → Task 11; §10 wiring → Tasks 9-10; §11 cleanup → Task 2; §12 tests → distributed, all present; §13 order → reordered with the reason stated.

**Three deviations from the spec, all deliberate:**

1. **Ordering.** The data model moves from §13 step 6 to Task 5, ahead of `TacticsAI`, because the AI's test fixtures construct `CreatureInstance` and will not compile without `tactic`.

2. **Determinism scope.** Spec §12 claims `chooseAction` consumes no RNG. That is true of the four player profiles but not of `enemy_default`, which must consume exactly one `Math.random()` to preserve current enemy targeting. The Global Constraints section states the narrowed rule, and Task 3 pins the call count at one.

3. **"Best damage per MP" is replaced with a budgeted "hit hardest."** This one is a real design change, found by checking the spec's ladders against the actual ability numbers.

   Spec §5 ends Fight Wisely (rule 4), Conserve MP (rule 4), and Heal First (rule 4) with "best damage per MP," counting a 0-MP ability as cost 1. Run the arithmetic on a baseline creature (str 40 vs def 20): `basic_attack` scores 12 damage ÷ 1 = **12**, while `thrash` — nearly four times the damage — scores 45 ÷ 5 = **9**. The free action wins the ratio against essentially every paid ability in the roster. Under the literal spec rule, all three tactics would basic-attack almost always, Fight Wisely would be indistinguishable from Conserve MP, and Conserve MP's carefully designed pressure gate would be unreachable dead code.

   The fix keeps each tactic's intent but changes the final selector to **highest damage within a spending budget**, where the budget is what distinguishes the tactics:
   - **Fight Wisely** — budget is half its *current* MP. Spends freely when flush, tightens as it drains. Self-regulating, no party-state input.
   - **Conserve MP** — budget is a third of *max* MP, and only unlocks at all once an ally drops to 50%. Gates on party danger, not on its own reserves.
   - **Heal First** — no damage budget, because the reserve check in the preceding rule already protects the MP that matters.

   This preserves the spec's stated intent for all three tactics — the ladders' *rungs* and thresholds are untouched — and makes them behave differently from each other, which "damage per MP" would not have. Worth confirming in playtest against spec §14's first open question, which anticipated exactly this convergence risk.

**Known content limitation carried from spec §6:** only 4 of 36 creatures have any heal, so Heal First's rule 1 rarely fires. Task 8 covers the degradation path explicitly.
