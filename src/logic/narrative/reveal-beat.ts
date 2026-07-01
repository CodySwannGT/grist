/**
 * The pure Sable-reveal "quiet beat" (PD-3.9 / #114, AC3 "the Sable reveal has a
 * deliberate quiet beat"). When the Ch.1 dialogue cursor lands on the reveal node
 * ({@link CH1_REVEAL_NODE_ID}, "cargo-opens" — the cargo opening to reveal Sable),
 * the moment must be *held*: a non-zero {@link REVEAL_BEAT_MS} hold has to elapse
 * before an advance past the reveal is permitted, so the reveal reads as deliberate
 * and quiet rather than being clicked straight through into the ambush.
 *
 * Modelled as a pure fold exactly like {@link import("./presenter")} — a beat state
 * `{ remainingMs }` counted down by an injected `dtMs` ({@link stepRevealBeat}), and
 * a composable guard ({@link canAdvancePastReveal}) the Dialogue adapter consults so
 * an advance at the reveal node is *deferred* until the beat elapses, and never
 * blocks anywhere else. Zero Phaser, zero I/O, no `Date.now` / `performance.now` /
 * `Math.random`: timing is folded via the same delta-time the scene already threads
 * into its other reducers, so the whole thing is deterministic and JSON-round-
 * trippable (asserted headless by `tests/logic/reveal-beat.test.ts`). It composes
 * *around* the presenter — presenter.ts's core is untouched, so its existing tests
 * stay green.
 * @module logic/narrative/reveal-beat
 */
import {
  CH1_REVEAL_NODE_ID,
  SABLE_REVEAL_BEAT_MS,
} from "../../content/scenes/ch1";

/**
 * The duration of the deliberate quiet beat held at the Sable reveal, in
 * milliseconds — the single source of truth is the reveal node's own `beatMs`
 * ({@link SABLE_REVEAL_BEAT_MS} in the Ch.1 content), re-exported here so the adapter
 * guard and the content data can never drift. Non-zero by design: long enough that
 * the reveal lands as a held, quiet moment (AC3) before the player can advance into
 * the ambush, short enough that it never feels like the game has stalled.
 */
export const REVEAL_BEAT_MS = SABLE_REVEAL_BEAT_MS;

/**
 * The pure quiet-beat state: how much of the hold remains. Plain serializable data
 * (a single number) so it round-trips through `JSON.stringify` for a save layer and
 * carries no behavior — the scene folds `dtMs` into it and reads it, exactly like
 * the presenter's narrative cursor.
 */
export interface RevealBeatState {
  /** Milliseconds of the quiet beat still to elapse (clamped at 0). */
  readonly remainingMs: number;
}

/**
 * The fresh quiet-beat state, seeded with the full {@link REVEAL_BEAT_MS} to elapse.
 * Begin the beat with this the instant the cursor reaches the reveal node, then fold
 * frame `dtMs` through {@link stepRevealBeat}.
 * @returns The initial (fully-held) beat state.
 */
export function beginRevealBeat(): RevealBeatState {
  return { remainingMs: REVEAL_BEAT_MS };
}

/**
 * Fold `dtMs` of elapsed time into the quiet beat, decrementing the remaining hold
 * and clamping it at zero so an over-long frame can never drive it negative. Pure and
 * deterministic — the same `(state, dtMs)` always yields the same result, the input
 * is never mutated, and a negative dt is ignored (the beat never runs backward).
 * @param state - The current beat state (never mutated).
 * @param dtMs - The frame delta-time to fold in, in ms (negative dt is ignored).
 * @returns The next beat state.
 */
export function stepRevealBeat(
  state: RevealBeatState,
  dtMs: number
): RevealBeatState {
  const remainingMs = Math.max(0, state.remainingMs - Math.max(0, dtMs));
  return { remainingMs };
}

/**
 * Whether the quiet beat has fully elapsed (no hold remains).
 * @param state - The beat state.
 * @returns True once the deliberate beat has been held long enough.
 */
export function isRevealBeatElapsed(state: RevealBeatState): boolean {
  return state.remainingMs <= 0;
}

/**
 * The composable advance guard the Dialogue adapter consults before letting an
 * advance walk past the current node: at the {@link CH1_REVEAL_NODE_ID reveal node}
 * an advance is *deferred* until the quiet beat has elapsed (so the reveal is held,
 * AC3); at every other node the beat is inert and advance is never blocked by it.
 * Pure — it reads the node id and the beat state, nothing ambient.
 * @param nodeId - The id of the node the presenter cursor currently addresses.
 * @param beat - The current quiet-beat state.
 * @returns False only while holding the beat at the reveal node; true otherwise.
 */
export function canAdvancePastReveal(
  nodeId: string,
  beat: RevealBeatState
): boolean {
  if (nodeId !== CH1_REVEAL_NODE_ID) {
    return true;
  }
  return isRevealBeatElapsed(beat);
}
