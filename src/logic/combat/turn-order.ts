/**
 * ATB turn-order derivation: who is ready to act and in what order. Order is
 * SPD-first — the highest-SPD ready combatant acts first — with a deterministic
 * tie-break (party before enemies, then lower index), so it is fully
 * reproducible and never reads the RNG. {@link advanceToNextTurn} runs the
 * engine's `tick` until someone is ready.
 * @module logic/combat/turn-order
 */
import { AtbTuning, step } from "./engine";
import {
  ActionKinds,
  BattleSides,
  type BattleSide,
  type BattleState,
  type Combatant,
  type CombatantRef,
} from "./types";

/** A ready combatant paired with the SPD the turn sort orders on. */
interface ReadyEntry {
  readonly ref: CombatantRef;
  readonly spd: number;
}

/**
 * Map one side's ready combatants to {@link ReadyEntry}s — a combatant is ready
 * only when it is **alive** (HP > 0) *and* its gauge has reached `ready`. Excluding
 * the downed is load-bearing: a KO'd combatant keeps ticking its gauge to full, and
 * a full-gauge corpse left in the ready queue parks the ATB loop on a turn no one
 * can take — the runner pauses for a player command the HP-gated HUD never surfaces
 * and `resolveEnemyTurns` bails on the corpse at the head of the queue, an
 * input-dead soft-lock (#243). The dead never act, so they are never ready.
 * @param side - The side's combatants.
 * @param sideId - Which side they are on.
 * @returns Ready entries for that side.
 */
function collectReady(
  side: readonly Combatant[],
  sideId: BattleSide
): readonly ReadyEntry[] {
  return side.flatMap((combatant, index) =>
    combatant.hp > 0 && combatant.atb >= AtbTuning.ready
      ? [{ ref: { side: sideId, index }, spd: combatant.stats.spd }]
      : []
  );
}

/**
 * Order two ready entries: higher SPD first, then party before enemies, then
 * lower index — a total, deterministic order that consults no RNG.
 * @param a - First entry.
 * @param b - Second entry.
 * @returns Negative if `a` acts before `b`, positive if after, 0 if identical.
 */
function compareReady(a: ReadyEntry, b: ReadyEntry): number {
  if (a.spd !== b.spd) {
    return b.spd - a.spd;
  }
  if (a.ref.side !== b.ref.side) {
    return a.ref.side === BattleSides.party ? -1 : 1;
  }
  return a.ref.index - b.ref.index;
}

/**
 * Every combatant whose ATB gauge has reached `ready`, as refs in act order:
 * highest SPD first, ties broken deterministically. Empty when no gauge is full.
 * @param state - The battle state.
 * @returns Ready combatant refs in act order (highest-SPD first).
 */
export function readyActors(state: BattleState): readonly CombatantRef[] {
  return [
    ...collectReady(state.party, BattleSides.party),
    ...collectReady(state.enemies, BattleSides.enemies),
  ]
    .sort(compareReady)
    .map(entry => entry.ref);
}

/**
 * The single combatant that should act next — the highest-SPD ready combatant —
 * or null when no gauge has filled yet.
 * @param state - The battle state.
 * @returns The next actor's ref, or null.
 */
export function nextActor(state: BattleState): CombatantRef | null {
  return readyActors(state)[0] ?? null;
}

/**
 * Apply ATB `tick`s until a combatant is ready to act, or the safety bound is
 * reached, returning the advanced state. Pure: it threads the engine's `step`
 * and recurses a bounded number of times rather than looping unbounded.
 * @param state - The battle state.
 * @param maxTicks - Safety bound on ticks applied (default 1000).
 * @returns The state at the next ready turn (or after `maxTicks` ticks).
 */
export function advanceToNextTurn(
  state: BattleState,
  maxTicks = 1000
): BattleState {
  if (maxTicks <= 0 || nextActor(state) !== null) {
    return state;
  }
  return advanceToNextTurn(
    step(state, { kind: ActionKinds.tick }),
    maxTicks - 1
  );
}
