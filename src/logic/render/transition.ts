/**
 * Pure, Phaser-free scene-transition state machine (PD-3.9 / #114, AC2 "scene
 * transitions are readable"). Before this pass every scene change was an instant
 * `this.scene.start(...)` — the world snapped rather than read. A *readable* cut is a
 * bounded, phased fade: **fade-out → hold → fade-in → done**, driving a black overlay
 * from clear → opaque → clear so the handoff is legible without stalling.
 *
 * The timing lives here as data + a total fold; the Phaser scene is a thin renderer
 * that steps the machine with the frame `dtMs` and paints an overlay at the derived
 * {@link transitionOpacity}. No ambient clock, no `Math.random`, no Phaser, no I/O —
 * {@link stepTransition} is a pure function of `(state, dtMs)`, so the same dt
 * sequence always reproduces the same trajectory (asserted headless by
 * `tests/logic/transition.test.ts`). Per decision 0006 the 384×216 baseline is
 * untouched; this is an overlay fade, not a resolution change. The state is plain
 * JSON-round-trippable data so a mid-transition frame never embeds behavior.
 * @module logic/render/transition
 */

/**
 * The per-phase durations of a readable cut, in milliseconds. Fade the outgoing
 * scene to black, hold the black beat briefly so the cut reads as deliberate, then
 * fade the incoming scene in. Tuned inside a snappy band — the total stays legible
 * AND brief (see the `<= 1200ms` bound the suite locks). Frozen `as const` — timing
 * is data.
 */
export const TransitionTiming = {
  /** Fade the outgoing scene out to black. */
  fadeOutMs: 260,
  /** Hold on black — the deliberate beat that makes the cut read. */
  holdMs: 120,
  /** Fade the incoming scene in from black. */
  fadeInMs: 260,
} as const;

/** The ordered phases of a transition. `done` is terminal. */
export type TransitionPhase = "fade-out" | "hold" | "fade-in" | "done";

/**
 * The pure transition state: which {@link TransitionPhase} the cut is in, the total
 * `elapsedMs` folded so far (clamped at the total duration), and the `progress`
 * (0..1) *within the current phase*. Plain serializable data — the scene reads it
 * and paints; it never advances the clock itself.
 */
export interface TransitionState {
  /** The current phase. */
  readonly phase: TransitionPhase;
  /** Total elapsed time folded into the transition, in ms (clamped at the total). */
  readonly elapsedMs: number;
  /** Progress within the current phase, 0..1 (always 1 once `done`). */
  readonly progress: number;
}

/**
 * The total duration of a transition — the sum of its phase durations. A scene knows
 * the cut is over when it has folded this much dt (or {@link isTransitionDone}).
 * @returns The total transition duration in ms.
 */
export function transitionTotalMs(): number {
  return (
    TransitionTiming.fadeOutMs +
    TransitionTiming.holdMs +
    TransitionTiming.fadeInMs
  );
}

/**
 * Clamp a value into `[0, 1]` so a derived progress / opacity can never leave the
 * unit range regardless of rounding or an over-long dt.
 * @param value - The value to clamp.
 * @returns The value clamped into `[0, 1]`.
 */
function unit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The fresh transition state: parked at the very start of fade-out (elapsed 0,
 * progress 0), fully clear. Seed a cut with this, then fold frame `dtMs` through
 * {@link stepTransition}.
 * @returns The initial transition state.
 */
export function beginTransition(): TransitionState {
  return { phase: "fade-out", elapsedMs: 0, progress: 0 };
}

/**
 * Resolve the {@link TransitionPhase} and in-phase progress for a total elapsed time.
 * Pure lookup over the phase durations — the single place the phase boundaries live,
 * so {@link stepTransition} stays a thin fold.
 * @param elapsedMs - Total elapsed time into the transition (already clamped).
 * @returns The phase and its 0..1 progress at that elapsed time.
 */
function phaseAt(elapsedMs: number): {
  readonly phase: TransitionPhase;
  readonly progress: number;
} {
  const { fadeOutMs, holdMs, fadeInMs } = TransitionTiming;
  if (elapsedMs < fadeOutMs) {
    return { phase: "fade-out", progress: unit(elapsedMs / fadeOutMs) };
  }
  if (elapsedMs < fadeOutMs + holdMs) {
    return { phase: "hold", progress: unit((elapsedMs - fadeOutMs) / holdMs) };
  }
  if (elapsedMs < fadeOutMs + holdMs + fadeInMs) {
    return {
      phase: "fade-in",
      progress: unit((elapsedMs - fadeOutMs - holdMs) / fadeInMs),
    };
  }
  return { phase: "done", progress: 1 };
}

/**
 * Fold `dtMs` of elapsed time into a transition, returning the next state. Elapsed
 * time accumulates and clamps at {@link transitionTotalMs}, so stepping a finished
 * cut is a no-op that stays `done`. Pure and deterministic — the same `(state, dtMs)`
 * always yields the same result and the input is never mutated. A degenerate hold
 * phase (`holdMs = 0`) still resolves correctly because `phaseAt` uses half-open
 * ranges.
 * @param state - The current transition state (never mutated).
 * @param dtMs - The frame delta-time to fold in, in ms (negative dt is ignored).
 * @returns The next transition state.
 */
export function stepTransition(
  state: TransitionState,
  dtMs: number
): TransitionState {
  const total = transitionTotalMs();
  const advanced = state.elapsedMs + Math.max(0, dtMs);
  const elapsedMs = Math.min(total, advanced);
  const { phase, progress } = phaseAt(elapsedMs);
  return { phase, elapsedMs, progress };
}

/**
 * Whether the transition has finished (its overlay is fully clear and the new scene
 * fully revealed).
 * @param state - The transition state.
 * @returns True once the cut is complete.
 */
export function isTransitionDone(state: TransitionState): boolean {
  return state.phase === "done";
}

/**
 * The 0..1 opacity of the black cover overlay the scene paints for a transition
 * state: rising through fade-out (screen covering), fully opaque through the hold,
 * falling through fade-in (screen clearing), and clear once done. Derived purely
 * from the phase + in-phase progress so the scene stays a thin renderer.
 * @param state - The transition state.
 * @returns The overlay opacity in `[0, 1]`.
 */
export function transitionOpacity(state: TransitionState): number {
  switch (state.phase) {
    case "fade-out":
      return unit(state.progress);
    case "hold":
      return 1;
    case "fade-in":
      return unit(1 - state.progress);
    case "done":
      return 0;
  }
}
