/**
 * The verification (UAT) bridge's render-support cell (#114) — the scene-agnostic
 * `__VERIFY__` seam that surfaces the two pure presentation modules the Marrow pass
 * ships, so the palette + transition acceptance criteria can be proven on the live
 * built game without a bespoke scene hook:
 *
 * - **AC1 (palette):** the resolved {@link GristPalette} the field / region / HUD
 *   surfaces actually consume — the desaturated near-grey base/floor/wall/line and the
 *   one warm {@link GRIST_GOLD} highlight — so the e2e reads the SAME typed palette the
 *   scenes render, not a re-derived copy, and asserts "the Marrow uses the desaturation
 *   + grist-gold palette".
 * - **AC2 (transition):** a deterministic sample of the pure fade-out→hold→fade-in
 *   state machine ({@link beginTransition} / {@link stepTransition}) — the phased
 *   opacity trajectory and total duration — so the e2e asserts a scene cut runs a
 *   readable, bounded fade rather than an instant snap.
 *
 * Zero Phaser, zero I/O, zero RNG — it reads the pure `logic/render` modules and folds
 * an injected dt, exactly like the pure suites, so the same inputs always yield the
 * same snapshot. Mirrors the other bridge-held data cells (e.g. `mill-beat-cell`):
 * extracted so the bridge stays under its line budget and the render seam is
 * independently readable.
 * @module uat/render-cell
 */
import {
  GristPalette,
  beginTransition,
  stepTransition,
  transitionOpacity,
  transitionTotalMs,
  type TransitionPhase,
  type TransitionState,
} from "../logic/render";

/**
 * A read-only snapshot of the resolved Marrow palette (#114 AC1) — the SAME
 * {@link GristPalette} the field / region / HUD surfaces consume, exposed so the e2e
 * proves the desaturation grade + grist-gold highlight are real and centralized, never
 * scattered per-scene hex. The channel spread of `base` vs `highlight` is what "the
 * base is desaturated, the gold glows against it" means numerically.
 */
export interface VerifyPaletteState {
  /** The canonical grist-gold highlight (`0xffd166`) — the one warm accent. */
  readonly highlight: number;
  /** The desaturated near-grey base tone (backdrops / panel fills). */
  readonly base: number;
  /** The desaturated Marrow floor tone. */
  readonly floor: number;
  /** The desaturated Marrow wall tone. */
  readonly wall: number;
  /** The desaturated structural line/edge tone. */
  readonly line: number;
  /** The max-minus-min channel spread of `base` (its residual chroma). */
  readonly baseChroma: number;
  /** The max-minus-min channel spread of `highlight` (the gold's vivid chroma). */
  readonly highlightChroma: number;
}

/** One sampled frame of a transition: its phase and the derived overlay opacity. */
export interface VerifyTransitionFrame {
  /** The phase this frame sits in. */
  readonly phase: TransitionPhase;
  /** Total elapsed time folded into the transition at this frame, in ms. */
  readonly elapsedMs: number;
  /** The 0..1 black-overlay opacity the scene would paint at this frame. */
  readonly opacity: number;
}

/**
 * A read-only snapshot of the scene-transition state machine (#114 AC2): the total
 * readable-cut duration and a deterministic per-frame trajectory of the phased fade,
 * so the e2e can assert the cut runs fade-out→hold→fade-in (rising, held, falling
 * opacity) within a bounded duration rather than snapping.
 */
export interface VerifyTransitionState {
  /** The total transition duration in ms (sum of the phase durations). */
  readonly totalMs: number;
  /** The sampled trajectory, one frame per injected dt step, in order. */
  readonly frames: readonly VerifyTransitionFrame[];
}

/** The max-minus-min 8-bit channel spread of a packed `0xRRGGBB` colour. */
const CHANNEL_MASK = 0xff;

/**
 * The chroma proxy of a colour: the spread between its brightest and dimmest 8-bit
 * channel (0 for a pure grey, larger for a vivid colour). Lets the e2e assert the base
 * is more desaturated than the grist-gold highlight without depending on the exact
 * blend maths.
 * @param hex - The packed `0xRRGGBB` colour to measure.
 * @returns The max-minus-min channel spread (0..255).
 */
function chroma(hex: number): number {
  const r = (hex >> 16) & CHANNEL_MASK;
  const g = (hex >> 8) & CHANNEL_MASK;
  const b = hex & CHANNEL_MASK;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * The bridge-held render cell (#114): a stateless reader over the pure `logic/render`
 * modules. Both snapshots are pure functions of their inputs — no held state, no
 * Phaser — so a stray read on any scene returns the same deterministic grade/trajectory.
 */
export class RenderCell {
  /**
   * The resolved Marrow palette snapshot (#114 AC1) — the SAME {@link GristPalette}
   * the scenes consume, plus the pre-computed base/highlight chroma so the e2e asserts
   * the base is desaturated below the gold without re-deriving the maths.
   * @returns The palette snapshot.
   */
  palette(): VerifyPaletteState {
    return {
      highlight: GristPalette.highlight,
      base: GristPalette.base,
      floor: GristPalette.floor,
      wall: GristPalette.wall,
      line: GristPalette.line,
      baseChroma: chroma(GristPalette.base),
      highlightChroma: chroma(GristPalette.highlight),
    };
  }

  /**
   * A deterministic sample of the scene-transition state machine (#114 AC2): fold a
   * uniform dt across the whole readable cut and record the phase + overlay opacity at
   * each step, so the e2e can assert the fade-out→hold→fade-in progression and the
   * bounded total. The default `steps` samples finely enough to observe each phase.
   * @param steps - How many uniform dt steps to sample across the cut (default 24).
   * @returns The transition snapshot (total duration + per-frame trajectory).
   */
  transition(steps: number = 24): VerifyTransitionState {
    const totalMs = transitionTotalMs();
    const dt = totalMs / Math.max(1, steps);
    const toFrame = (state: TransitionState): VerifyTransitionFrame => ({
      phase: state.phase,
      elapsedMs: state.elapsedMs,
      opacity: transitionOpacity(state),
    });
    // Fold the fixed dt across `steps` samples, accumulating one frame per state —
    // a pure reduce (no mutable cursor) so the trajectory is deterministic.
    const states = Array.from({ length: steps }).reduce<
      readonly TransitionState[]
    >(
      trajectory => [
        ...trajectory,
        stepTransition(trajectory[trajectory.length - 1]!, dt),
      ],
      [beginTransition()]
    );
    return { totalMs, frames: states.map(toFrame) };
  }
}

/** The render slice of the `window.__VERIFY__` surface (#114 AC1/AC2). */
export interface RenderApi {
  /** The resolved Marrow palette (the desaturation + grist-gold grade the scenes consume). */
  readonly palette: () => VerifyPaletteState;
  /** A deterministic sample of the readable scene-transition fade trajectory. */
  readonly transition: (steps?: number) => VerifyTransitionState;
}

/**
 * Build the render slice of the verification API, bound to a {@link RenderCell}.
 * Spread into `window.__VERIFY__` by the bridge so the palette + transition seams sit
 * next to the cell they read (the `dialogueApi` pattern), keeping `uat/bridge` under
 * its line budget. Scene-agnostic — both reads are pure functions of `logic/render`,
 * so they answer identically on any scene.
 * @param cell - The render cell that reads the pure palette + transition modules.
 * @returns The render verification API slice.
 */
export function renderApi(cell: RenderCell): RenderApi {
  return {
    palette: () => cell.palette(),
    transition: (steps?: number) =>
      steps === undefined ? cell.transition() : cell.transition(steps),
  };
}
