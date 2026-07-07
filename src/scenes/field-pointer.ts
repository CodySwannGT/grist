/**
 * Field pointer wiring — the split-out that routes raw pointer/touch events into the
 * semantic {@link FieldInputService}, so the Field scene never reads raw coordinates in
 * gameplay and stays a thin renderer under its line budget (the same `field-*` split the
 * chrome / launch / motion helpers use). No game rules: it only translates a tap into a
 * `move-to` (+ `examine` on the room's marker) intent.
 * @module scenes/field-pointer
 */
import Phaser from "phaser";
import { FieldLayout } from "../consts";
import { type FieldInputService } from "../services/field-input";

/**
 * Wire the pointer for a Field scene: tapping the floor sets a tap-to-move destination
 * (mapped from the pointer's logical coords) and — when the current room has an
 * examinable prop marker — tapping that marker walks to it and examines it. Both routed
 * through the semantic {@link FieldInputService}, so no raw pointer math leaks past it.
 * @param scene - The Field scene whose floor taps to route.
 * @param sign - The current room's examinable marker, or null when it has none.
 * @param input - The field input service the taps publish through.
 * @returns void
 */
export function wireFieldPointer(
  scene: Phaser.Scene,
  sign: Phaser.GameObjects.Rectangle | null,
  input: FieldInputService
): void {
  sign
    ?.setInteractive({ useHandCursor: true })
    .on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      // Tapping the marker first walks to it, then examines — the tap is a semantic
      // move-to + examine, never a raw coordinate read in gameplay.
      input.tapMoveTo(FieldLayout.signX, FieldLayout.signY);
      input.tapExamine();
      pointer.event?.stopPropagation();
    });
  scene.input.on(
    Phaser.Input.Events.POINTER_DOWN,
    (pointer: Phaser.Input.Pointer) => {
      // pointer.worldX/Y are already in the scene's logical (384×216) space.
      input.tapMoveTo(pointer.worldX, pointer.worldY);
    }
  );
}
