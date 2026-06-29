/**
 * Static Field-scene chrome builders (sub-task #82 split-out) — the programmatic
 * backdrop the Field scene paints once on create. Pulled out of the scene so the
 * scene body stays a thin renderer of live state; this module only places fixed
 * decoration (no game state, no rules), so it is a plain `(scene) => void` helper.
 * Programmatic art only — no binary assets.
 * @module scenes/field-chrome
 */
import type Phaser from "phaser";
import { FieldColors, FieldLayout, GameView } from "../consts";

/**
 * Paint the top-down room backdrop: a dark back wall, the lit floor band below
 * the wall line, and the dividing wall line. Fixed decoration only — drawn once.
 * @param scene - The Field scene to add the backdrop rectangles to.
 * @returns void
 */
export function drawFieldBackdrop(scene: Phaser.Scene): void {
  const { width, height } = GameView;
  scene.add
    .rectangle(0, 0, width, FieldLayout.wallY, FieldColors.wall)
    .setOrigin(0, 0);
  scene.add
    .rectangle(
      0,
      FieldLayout.wallY,
      width,
      height - FieldLayout.wallY,
      FieldColors.floor
    )
    .setOrigin(0, 0);
  scene.add
    .rectangle(0, FieldLayout.wallY, width, 1, FieldColors.wallLine)
    .setOrigin(0, 0);
}
