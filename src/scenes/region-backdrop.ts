/**
 * The Region scene's side-view backdrop painter (extracted from `scenes/Region` so the
 * scene stays under its line budget). Owns the per-region parallax layer table and the
 * readability scrim: a booted session's `state.backdrop` names its FAR layer (resolved
 * by the harness `regionBackdrop()`); when the key has a stack here the scene layers the
 * full parallax set, otherwise it renders the key as a single flat backdrop — so a
 * per-region art set ships by adding images + one row here, no scene logic.
 * @module scenes/region-backdrop
 */
import type Phaser from "phaser";
import { ImageKeys } from "../assets";
import { GameView } from "../consts";

/**
 * Parallax layer stacks per backdrop key (far → near). Every live region in
 * `content/regions` gets its own distinct set (#200); the keys are the generated
 * `ImageKeys.<region>Bg{Far,Mid,Near}`, so a renamed/missing plate is a compile error.
 */
const REGION_BACKDROP_LAYERS: Readonly<Record<string, readonly string[]>> = {
  [ImageKeys.marrowBgFar]: [
    ImageKeys.marrowBgFar,
    ImageKeys.marrowBgMid,
    ImageKeys.marrowBgNear,
  ],
  [ImageKeys.rootsBgFar]: [
    ImageKeys.rootsBgFar,
    ImageKeys.rootsBgMid,
    ImageKeys.rootsBgNear,
  ],
  [ImageKeys.upperVantaBgFar]: [
    ImageKeys.upperVantaBgFar,
    ImageKeys.upperVantaBgMid,
    ImageKeys.upperVantaBgNear,
  ],
  [ImageKeys.sylvemarchBgFar]: [
    ImageKeys.sylvemarchBgFar,
    ImageKeys.sylvemarchBgMid,
    ImageKeys.sylvemarchBgNear,
  ],
  [ImageKeys.holtspireBgFar]: [
    ImageKeys.holtspireBgFar,
    ImageKeys.holtspireBgMid,
    ImageKeys.holtspireBgNear,
  ],
  [ImageKeys.cinderfenBgFar]: [
    ImageKeys.cinderfenBgFar,
    ImageKeys.cinderfenBgMid,
    ImageKeys.cinderfenBgNear,
  ],
  [ImageKeys.wrackBgFar]: [
    ImageKeys.wrackBgFar,
    ImageKeys.wrackBgMid,
    ImageKeys.wrackBgNear,
  ],
};

/** Readability scrim over the backdrop (color + alpha) so chrome stays legible. */
const SCRIM_COLOR = 0x0b0e16;
const SCRIM_ALPHA = 0.35;

/**
 * Paint a region's side-view backdrop: the parallax stack registered for `backdropKey`
 * (far layer first), plus a dark scrim so the chrome stays readable over the art. Falls
 * back to the flat key when no stack is registered.
 * @param scene - The Region scene to draw into.
 * @param backdropKey - The far-layer backdrop key (`state.backdrop`).
 * @returns void
 */
export function buildRegionBackdrop(
  scene: Phaser.Scene,
  backdropKey: string
): void {
  const layers = REGION_BACKDROP_LAYERS[backdropKey] ?? [backdropKey];
  for (const layer of layers) {
    // Bottom-anchored: taller-than-stage art crops at the top edge.
    scene.add.image(0, GameView.height, layer).setOrigin(0, 1);
  }
  scene.add
    .rectangle(0, 0, GameView.width, GameView.height, SCRIM_COLOR, SCRIM_ALPHA)
    .setOrigin(0, 0);
}
