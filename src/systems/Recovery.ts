import { CreatureInstance, RunState } from '../types';
import { effectiveMaxHp } from './Boons';

export function runMaxHp(creature: CreatureInstance, run: RunState): number {
  return effectiveMaxHp(creature.currentStats.hp, run.activeBoons);
}

export type RecoveryKind = 'hp' | 'mp';

export function canReceiveRecovery(
  kind: RecoveryKind,
  creature: CreatureInstance,
  run: RunState,
): boolean {
  if (run.partyKO[creature.instanceId]) return false;
  if (kind === 'hp') {
    return (run.partyHp[creature.instanceId] ?? 0) < runMaxHp(creature, run);
  }
  return (run.partyMp[creature.instanceId] ?? 0) < creature.currentStats.mp;
}

export function eligibleRecoveryTargets(
  kind: RecoveryKind,
  party: CreatureInstance[],
  run: RunState,
): CreatureInstance[] {
  return party.filter(creature => canReceiveRecovery(kind, creature, run));
}

/** Apply a percentage-of-maximum recovery to one eligible creature. */
export function applyTargetedRecovery(
  kind: RecoveryKind,
  fraction: number,
  creature: CreatureInstance,
  run: RunState,
): number {
  if (!canReceiveRecovery(kind, creature, run)) return 0;

  if (kind === 'hp') {
    const max = runMaxHp(creature, run);
    const current = run.partyHp[creature.instanceId] ?? 0;
    const recovered = Math.min(Math.floor(max * fraction), max - current);
    run.partyHp[creature.instanceId] = current + recovered;
    return recovered;
  }

  const max = creature.currentStats.mp;
  const current = run.partyMp[creature.instanceId] ?? 0;
  const recovered = Math.min(Math.floor(max * fraction), max - current);
  run.partyMp[creature.instanceId] = current + recovered;
  return recovered;
}

/**
 * Bring a knocked-out creature back on the run map.
 *
 * The run-state twin of CombatEngine's `revive`: same contract, different state
 * shape. Returns false and changes nothing when the target is still standing, so
 * a caller can refuse rather than consume.
 */
export function reviveOnRun(
  creature: CreatureInstance,
  run: RunState,
  hpFraction: number,
  mpFraction: number,
): boolean {
  if (!run.partyKO[creature.instanceId]) return false;
  run.partyKO[creature.instanceId] = false;
  run.partyHp[creature.instanceId] = Math.min(
    runMaxHp(creature, run),
    Math.max(1, Math.floor(runMaxHp(creature, run) * hpFraction)),
  );
  // Never LOWER MP: a knock-out only zeroes HP on the run map too, so a
  // creature felled at full MP keeps it — mirrors CombatEngine's `revive`.
  const currentMp = run.partyMp[creature.instanceId] ?? 0;
  run.partyMp[creature.instanceId] = Math.min(
    creature.currentStats.mp,
    Math.max(currentMp, Math.floor(creature.currentStats.mp * mpFraction)),
  );
  return true;
}
