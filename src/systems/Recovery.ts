import { CreatureInstance, RunState } from '../types';

export type RecoveryKind = 'hp' | 'mp';

export function canReceiveRecovery(
  kind: RecoveryKind,
  creature: CreatureInstance,
  run: RunState,
): boolean {
  if (run.partyKO[creature.instanceId]) return false;
  if (kind === 'hp') {
    return (run.partyHp[creature.instanceId] ?? 0) < creature.currentStats.hp;
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
    const max = creature.currentStats.hp;
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
  run.partyHp[creature.instanceId] = Math.max(
    1, Math.floor(creature.currentStats.hp * hpFraction),
  );
  run.partyMp[creature.instanceId] = Math.floor(creature.currentStats.mp * mpFraction);
  return true;
}
