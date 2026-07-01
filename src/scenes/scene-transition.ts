/**
 * Thin Phaser adapter for the pure scene-transition machine (`logic/render/transition`,
 * PD-3.9 / #114 AC2 "scene transitions are readable"). The timing/opacity logic is
 * headless and unit-tested; this file only paints it: fade the camera out to black,
 * hold the beat, then start the next scene (which fades itself in on `create`).
 *
 * Kept as small as possible so the readable-cut contract lives in logic, not here:
 * the helper uses Phaser's built-in one-shot `cameras.main.fadeOut` (no per-frame
 * tween allocation in an `update()` loop — pooling rule intact) driven by the pure
 * {@link transitionTotalMs} / {@link TransitionTiming} durations, so a duration
 * change is a single edit in the logic module. Scenes that want an instant cut still
 * call `this.scene.start(...)` directly; this is opt-in for handoffs that should read.
 * @module scenes/scene-transition
 */
import type Phaser from "phaser";

import { TransitionTiming } from "../logic/render/transition";

/** The fade overlay color — black, matching the pure machine's cover overlay. */
const FADE_BLACK = { r: 0, g: 0, b: 0 } as const;

/**
 * Fade `scene`'s camera out over the transition's fade-out + hold window, then start
 * `nextKey` (passing optional `data`). The outgoing fade covers the screen to black
 * and holds the beat before the cut, so the handoff reads rather than snaps; the
 * incoming scene reveals itself with {@link fadeSceneIn} on its own `create`. Uses a
 * single one-shot camera fade (fired once, not per frame) so nothing allocates in an
 * update loop.
 * @param scene - The outgoing scene.
 * @param nextKey - The scene key to start once the fade-out + hold completes.
 * @param data - Optional launch data forwarded to the next scene.
 * @returns void
 */
export function transitionToScene(
  scene: Phaser.Scene,
  nextKey: string,
  data?: object
): void {
  const coverMs = TransitionTiming.fadeOutMs + TransitionTiming.holdMs;
  const camera = scene.cameras.main;
  camera.once("camerafadeoutcomplete", () => {
    scene.scene.start(nextKey, data);
  });
  camera.fadeOut(coverMs, FADE_BLACK.r, FADE_BLACK.g, FADE_BLACK.b);
}

/**
 * Reveal `scene` by fading its camera in from black over the transition's fade-in
 * window — the incoming half of a readable cut. Call once from a scene's `create`
 * when it was entered via {@link transitionToScene}; a scene entered by a direct
 * `scene.start` simply never calls this and shows instantly.
 * @param scene - The incoming scene to reveal.
 * @returns void
 */
export function fadeSceneIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(
    TransitionTiming.fadeInMs,
    FADE_BLACK.r,
    FADE_BLACK.g,
    FADE_BLACK.b
  );
}
