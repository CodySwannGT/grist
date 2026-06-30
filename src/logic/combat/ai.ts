/**
 * Deterministic enemy turn resolution and player-decision advancement — the pure
 * glue that lets a seeded ATB battle actually run to a terminal outcome. The
 * {@link step} reducer pauses the world the instant any gauge fills (ATB-Wait);
 * a ready *party* member waits for player input, but a ready *enemy* has no
 * player to act for it, so without this module the gauges deadlock the moment an
 * enemy fills. {@link resolveEnemyTurns} spends each ready enemy's turn on a
 * deterministic Strike against the first living party member, and
 * {@link runToNextDecision} fills the gauges — resolving enemies as they ready —
 * until a party member is up or the battle resolves. Both are pure, RNG-threaded
 * through {@link step}, and read nothing ambient, so the runner's wall-clock loop
 * and the verification bridge's headless drive progress identically. Authoring a
 * richer per-profile AI (`EnemyDef.ai`) is a later sub-task; this is the
 * minimal, deterministic opponent that makes the prototype winnable when played.
 * @module logic/combat/ai
 */
import { step } from "./engine";
import { isResolved } from "./outcome";
import { nextActor } from "./turn-order";
import {
  ActionKinds,
  BattleSides,
  type ActionKind,
  type BattleState,
} from "./types";

/**
 * The action kind a ready enemy will spend its turn on — the single source of
 * truth for enemy behavior, shared by {@link resolveEnemyTurns} (which actually
 * applies it) and the HUD telegraph (which warns of it). The minimal,
 * deterministic prototype AI always Strikes; a richer per-profile AI replaces
 * this one helper, and both the turn it takes and the telegraph the player sees
 * update together — they can never drift.
 * @param _state - The battle state (unused today; the seam for profile-aware AI).
 * @returns The action kind the next enemy turn will issue.
 */
export function enemyIntentKind(_state: BattleState): ActionKind {
  return ActionKinds.strike;
}

/** Safety bound on consecutive enemy turns resolved in one pass (loop guard). */
const MAX_ENEMY_TURNS = 64;
/** Safety bound on ATB ticks applied while filling to the next decision. */
const MAX_FILL_TICKS = 10_000;

/**
 * The index of the first living party member, or -1 when the party is wiped.
 * @param state - The battle state.
 * @returns The first living party index, or -1.
 */
function firstLivingParty(state: BattleState): number {
  return state.party.findIndex(member => member.hp > 0);
}

/**
 * Resolve every enemy currently at the head of the ready queue, one at a time,
 * until the next actor is a party member, no gauge is full, or the battle
 * resolves. Each ready enemy spends its turn on a deterministic Strike against
 * the first living party member (the {@link step} reducer threads the seeded RNG
 * for variance/crit), so the same seed always yields the same enemy actions. A
 * party member at the head of the queue is left untouched — its turn belongs to
 * the player. Pure and bounded; never consults `Math.random` / `Date`.
 * @param state - The battle state.
 * @param budget - Remaining enemy-turn budget (loop guard).
 * @returns The state after all consecutively-ready enemy turns resolve.
 */
export function resolveEnemyTurns(
  state: BattleState,
  budget = MAX_ENEMY_TURNS
): BattleState {
  if (budget <= 0 || isResolved(state)) {
    return state;
  }
  const actor = nextActor(state);
  if (actor === null || actor.side !== BattleSides.enemies) {
    return state;
  }
  const targetIndex = firstLivingParty(state);
  if (targetIndex < 0) {
    return state;
  }
  return resolveEnemyTurns(
    step(state, {
      kind: enemyIntentKind(state),
      actor,
      target: { side: BattleSides.party, index: targetIndex },
    }),
    budget - 1
  );
}

/**
 * Advance the battle to the next player decision point: auto-resolve any ready
 * enemies, then fill the ATB gauges (one {@link ActionKinds.tick} at a time —
 * resolving enemies the instant they ready) until a party member is ready to act
 * or the battle resolves. Pure and deterministic in the *number* of ticks
 * applied — independent of wall-clock — so the headless drive and the in-browser
 * runner reach byte-identical states. The runner uses this for its bridge-driven
 * `advanceTurn`; the determinism gate uses it to replay a seeded battle.
 * @param state - The battle state.
 * @param maxTicks - Safety bound on ticks applied (loop guard).
 * @returns The state at the next party turn, or the terminal state.
 */
export function runToNextDecision(
  state: BattleState,
  maxTicks = MAX_FILL_TICKS
): BattleState {
  const cleared = resolveEnemyTurns(state);
  // After clearing enemies, a non-null next actor can only be a party member —
  // its turn is the decision point. A null next actor means keep filling.
  if (maxTicks <= 0 || isResolved(cleared) || nextActor(cleared) !== null) {
    return cleared;
  }
  return runToNextDecision(
    step(cleared, { kind: ActionKinds.tick }),
    maxTicks - 1
  );
}
