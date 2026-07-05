/**
 * Static Field-scene chrome builders (sub-task #82 split-out) — the room
 * backdrop the Field scene paints once on create. Pulled out of the scene so the
 * scene body stays a thin renderer of live state; this module only places fixed
 * decoration (no game state, no rules), so it is a plain `(scene) => void` helper.
 * @module scenes/field-chrome
 */
import type Phaser from "phaser";
import { ImageKeys } from "../assets";
import { FieldColors, FieldLayout, FieldTextStyles, GameView } from "../consts";
import { addPanel } from "../ui/chrome";
import { GristPalette } from "../logic/render";
import { type MarrowRoomDef } from "../content/map";

/** Dimming over the skyline band so the HUD text stays readable above it. */
const SKYLINE_SCRIM_ALPHA = 0.55;

/**
 * Paint the room backdrop: the Marrow's neon skyline (the parallax far/mid
 * layers, bottom-anchored to the wall line so the city rises behind the room),
 * a readability scrim over that band, the lit floor band below the wall line,
 * and the dividing wall line. Fixed decoration only — drawn once.
 *
 * The floor keeps the centralized {@link GristPalette} desaturated base (#114
 * AC1) so the grist-gold HUD accents still glow against a drained world; the
 * skyline band above the wall line is where the "neon over old bone" mood
 * shows through.
 * @param scene - The Field scene to add the backdrop to.
 * @returns void
 */
export function drawFieldBackdrop(scene: Phaser.Scene): void {
  const { width, height } = GameView;
  for (const layer of [ImageKeys.marrowBgFar, ImageKeys.marrowBgMid]) {
    // Bottom-anchored to the wall line: the skyline fills the back-wall band.
    scene.add.image(0, FieldLayout.wallY, layer).setOrigin(0, 1);
  }
  scene.add
    .rectangle(
      0,
      0,
      width,
      FieldLayout.wallY,
      GristPalette.wall,
      SKYLINE_SCRIM_ALPHA
    )
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
  readonly loreBox: Phaser.GameObjects.NineSlice;
  readonly loreText: Phaser.GameObjects.Text;
} {
  const loreBox = addPanel(
    scene,
    FieldLayout.loreBoxX,
    FieldLayout.loreBoxY,
    FieldLayout.loreBoxWidth,
    FieldLayout.loreBoxHeight
  )
    .setOrigin(0, 0)
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
