/**
 * A stable string hash of a {@link BattleState} for the determinism contract:
 * the same state hashes to the same digest, and any change to a tracked field
 * changes it. Pure FNV-1a over a canonical serialization. The unit suite uses it
 * to assert identical progression across two seeded runs, and the verification
 * bridge (a later sub-task) reuses it to compare seeded play-throughs.
 * @module logic/combat/hash
 */
import { type BattleState, type Combatant } from "./types";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Canonical, compact serialization of one combatant's mutable battle fields.
 * @param combatant - The combatant to serialize.
 * @returns A stable string token.
 */
function serializeCombatant(combatant: Combatant): string {
  const statuses = combatant.statuses
    .map(status => `${status.id}:${status.turns}`)
    .join(",");
  return [
    combatant.ref,
    combatant.hp,
    combatant.ap,
    combatant.atb,
    combatant.pressure,
    combatant.broken ? 1 : 0,
    statuses,
  ].join("|");
}

/**
 * Canonical serialization of the whole battle state — the fields the determinism
 * contract covers: both sides, grist, RNG state, tick, phase, and log length.
 * @param state - The battle state.
 * @returns A stable string encoding.
 */
function serializeState(state: BattleState): string {
  return [
    state.party.map(serializeCombatant).join(";"),
    state.enemies.map(serializeCombatant).join(";"),
    state.grist,
    state.rngState,
    state.tick,
    state.phase,
    state.log.length,
  ].join("#");
}

/**
 * FNV-1a 32-bit hash of the canonical state serialization, as zero-padded hex.
 * @param state - The battle state to hash.
 * @returns An 8-character hex digest.
 */
export function hashState(state: BattleState): string {
  const hash = [...serializeState(state)].reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (hash >>> 0).toString(16).padStart(8, "0");
}
