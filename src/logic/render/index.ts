/**
 * Public surface of the pure render-support core (PD-3.9 / #114): the Phaser-free
 * colour + timing logic the presentation pass depends on. Two modules live here —
 * the {@link GristPalette} / {@link desaturate} colour grade (AC1: the Marrow's
 * desaturation + grist-gold palette) and the {@link beginTransition} /
 * {@link stepTransition} scene-transition state machine (AC2: readable transitions).
 * Both are engine-free, deterministic, and unit-tested headless; scenes import from
 * here so the grade and the timing are a single source of truth, never scattered
 * literals. Re-export only — palette logic lives in `./palette`, transition logic in
 * `./transition`.
 * @module logic/render
 */
export type { Rgb } from "./palette";
export {
  GRIST_GOLD,
  GRIST_GOLD_CSS,
  GristPalette,
  desaturate,
  hexToCss,
  hexToRgb,
  mixHex,
  rgbToHex,
} from "./palette";
export type { TransitionPhase, TransitionState } from "./transition";
export {
  TransitionTiming,
  beginTransition,
  isTransitionDone,
  stepTransition,
  transitionOpacity,
  transitionTotalMs,
} from "./transition";
