/**
 * Static Field-scene chrome builders (sub-task #82 split-out) — the programmatic
 * backdrop the Field scene paints once on create. Pulled out of the scene so the
 * scene body stays a thin renderer of live state; this module only places fixed
 * decoration (no game state, no rules), so it is a plain `(scene) => void` helper.
 * Programmatic art only — no binary assets.
 * @module scenes/field-chrome
 */
import type Phaser from "phaser";
import { FieldColors, FieldLayout, FieldTextStyles, GameView } from "../consts";
import { GristPalette } from "../logic/render";
import { type MarrowRoomDef } from "../content/map";

/**
 * Paint the top-down room backdrop: a dark back wall, the lit floor band below
 * the wall line, and the dividing wall line. Fixed decoration only — drawn once.
 *
 * The Marrow's structural tones come from the centralized {@link GristPalette}
 * (#114 AC1): the floor and wall are its desaturated, near-grey base — the world
 * reads drained — so the grist-gold HUD accents glow against them. Routing these
 * through the palette (not the raw `FieldColors`) is what makes the desaturation +
 * grist-gold grade real and coherent across every surface rather than per-scene ad
 * hoc hues.
 * @param scene - The Field scene to add the backdrop rectangles to.
 * @returns void
 */
export function drawFieldBackdrop(scene: Phaser.Scene): void {
  const { width, height } = GameView;
  scene.add
    .rectangle(0, 0, width, FieldLayout.wallY, GristPalette.wall)
    .setOrigin(0, 0);
  scene.add
    .rectangle(
      0,
      FieldLayout.wallY,
      width,
      height - FieldLayout.wallY,
      GristPalette.floor
    )
    .setOrigin(0, 0);
  scene.add
    .rectangle(0, FieldLayout.wallY, width, 1, FieldColors.wallLine)
    .setOrigin(0, 0);
}

/**
 * Build the static field chrome — the centered room-name banner — plus the
 * initially-hidden lore banner the examine surfaces. Returns the lore box/text so
 * the scene can show them on examine. The examine affordance is NOT drawn here:
 * the field HUD ({@link import("./field-hud").FieldHud}) owns the contextual
 * "[E] examine <prop>" prompt and shows it only while Wren is in range of the
 * interactable (#107), so a single, range-gated affordance replaces the old
 * always-on label. Pulled out of the scene so its body stays a thin renderer;
 * this places fixed chrome and the (hidden) banner only.
 * @param scene - The Field scene to add the chrome to.
 * @param room - The current room's definition (for its display name).
 * @returns The lore banner box and text (both initially hidden).
 */
export function drawFieldChrome(
  scene: Phaser.Scene,
  room: MarrowRoomDef
): {
  readonly loreBox: Phaser.GameObjects.Rectangle;
  readonly loreText: Phaser.GameObjects.Text;
} {
  const loreBox = scene.add
    .rectangle(
      FieldLayout.loreBoxX,
      FieldLayout.loreBoxY,
      FieldLayout.loreBoxWidth,
      FieldLayout.loreBoxHeight,
      FieldColors.loreBoxFill
    )
    .setOrigin(0, 0)
    .setStrokeStyle(1, FieldColors.loreBoxStroke)
    .setVisible(false);
  const loreText = scene.add
    .text(
      FieldLayout.loreBoxX + 4,
      FieldLayout.loreBoxY + 4,
      "",
      FieldTextStyles.lore
    )
    .setOrigin(0, 0)
    .setVisible(false);
  scene.add
    .text(GameView.width / 2, 6, room.name, FieldTextStyles.roomName)
    .setOrigin(0.5, 0);
  return { loreBox, loreText };
}
