/**
 * Terminal battle-outcome resolution: the two pure predicates that decide when an
 * ATB battle has reached a stable end — **Victory** when every enemy is defeated
 * (and the party survives), **Defeat** when the whole party is wiped — and the
 * {@link resolveOutcome} transition the engine's `step` applies after every
 * action. A combatant is defeated once its HP pool reaches 0 (HP is clamped at 0
 * by the effect resolver and the Rendering DoT, so `<= 0` and `=== 0` coincide).
 * Every function here reads only the passed state — no RNG, no Phaser, no `Date`
 * — so the same state always resolves to the same terminal phase.
 * @module logic/combat/outcome
 */
import {
  BattlePhases,
  type BattlePhase,
  type BattleState,
  type Combatant,
} from "./types";

/**
 * Whether a combatant has been defeated — its HP pool has been reduced to 0.
 * @param combatant - The combatant to inspect.
 * @returns True when the combatant is down (HP at or below 0).
 */
export function isDefeated(combatant: Combatant): boolean {
  return combatant.hp <= 0;
}

/**
 * Whether every combatant on a side is defeated. A side with members is wiped
 * only when all of them are down; the `every` semantics treat an empty side as
 * vacuously defeated, which never arises for real encounters (party and enemy
 * lineups are always non-empty).
 * @param side - One side's combatants.
 * @returns True when no combatant on the side is still standing.
 */
function allDefeated(side: readonly Combatant[]): boolean {
  return side.every(isDefeated);
}

/**
 * Whether the battle has reached a terminal phase ({@link BattlePhases.won} or
 * {@link BattlePhases.lost}). A resolved battle rejects further actions.
 * @param state - The battle state.
 * @returns True when the battle has already resolved.
 */
export function isResolved(state: BattleState): boolean {
  return state.phase === BattlePhases.won || state.phase === BattlePhases.lost;
}

/**
 * Whether the party has been wiped — the Defeat condition. Defeat is evaluated
 * first by {@link resolveOutcome} and so **dominates** a simultaneous mutual
 * wipe: you cannot claim a battle your whole party did not survive.
 * @param state - The battle state.
 * @returns True when every party member is defeated.
 */
export function isDefeat(state: BattleState): boolean {
  return allDefeated(state.party);
}

/**
 * Whether every enemy has been defeated while at least one party member survives
 * — the Victory condition. Mutually exclusive with {@link isDefeat}: a mutual
 * wipe is a defeat, not a victory.
 * @param state - The battle state.
 * @returns True when all enemies are down and the party is not wiped.
 */
export function isVictory(state: BattleState): boolean {
  return !isDefeat(state) && allDefeated(state.enemies);
}

/**
 * The terminal phase a battle state has reached, or null while it is still live.
 * Defeat is checked before Victory so a simultaneous mutual wipe resolves to a
 * loss.
 * @param state - The battle state.
 * @returns {@link BattlePhases.lost}, {@link BattlePhases.won}, or null.
 */
function terminalPhase(state: BattleState): BattlePhase | null {
  if (isDefeat(state)) {
    return BattlePhases.lost;
  }
  if (isVictory(state)) {
    return BattlePhases.won;
  }
  return null;
}

/**
 * Resolve a post-action battle state to its terminal phase when a Victory or
 * Defeat predicate fires, otherwise return it untouched (same reference). Pure:
 * it only sets `phase`, never the RNG, the log, or any combatant — so the
 * reducer stays deterministic when it threads every step through here.
 * @param state - The state produced by an applied action.
 * @returns The state with `phase` set to won/lost, or the input unchanged.
 */
export function resolveOutcome(state: BattleState): BattleState {
  const phase = terminalPhase(state);
  return phase === null ? state : { ...state, phase };
}
