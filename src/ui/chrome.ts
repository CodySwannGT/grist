/**
 * Shared pixel-art chrome factories (#202): the 9-slice `panel` frame and the
 * `arrow` selection cursor, both from the packed `ui` atlas.
 *
 * Every menu/HUD panel, dialogue box, and button is a single Phaser
 * {@link Phaser.GameObjects.NineSlice} of the same Ninja-Adventure `ThemeMetal3`
 * terminal frame — a dark, text-legible interior behind a teal etched bezel — so
 * the whole UI reads as one "corporate-terminal" chrome (art bible). A NineSlice
 * is placed at the **identical** x/y/w/h the old flat `add.rectangle` used, so no
 * bridge-asserted layout rect (`commandRect`, `dialogueChoiceRect`) moves; only
 * the pixels change. State is shown by tint (multiply): the native dark frame by
 * default, {@link PanelTint.active} grist-gold for a selected/equipped surface.
 * @module ui/chrome
 */
import Phaser from "phaser";
import { AtlasKeys, Frames } from "../assets";

/**
 * Source 9-slice corner insets (px) of the `panel` frame. `ThemeMetal3`'s bezel
 * is a uniform 5px border (rounded transparent corners) around a flat center that
 * stretches to any panel size — measured from the pack art in `ingest-assets`.
 */
const PANEL_INSET = 5;

/**
 * NineSlice tints for the neutral terminal `panel`, multiplied over the frame's
 * own etched art so each keeps the bezel relief. `frame` is untinted (the native
 * dark terminal); `active` is grist-gold for the selected/equipped surface;
 * `equipped` is the bench "learning" green; `disabled` dims an unaffordable
 * button. Mirrors the former flat-fill/stroke state cues one-for-one.
 */
export const PanelTint = {
  frame: 0xffffff,
  active: 0xffd166,
  equipped: 0x57c969,
  disabled: 0x4a5162,
} as const;

/** The grist-gold selection-cursor tint (matches `HudColors.marker`). */
const CURSOR_TINT = 0xffd166;

/**
 * Create a 9-slice terminal panel of the `ui` atlas `panel` frame at a logical
 * rect. Origin is left unset (NineSlice default 0.5) — the caller sets the origin
 * to match the flat rectangle it replaces so the drawn rect is byte-identical.
 * @param scene - The owning scene (for its display list).
 * @param x - Logical x (same as the replaced rectangle).
 * @param y - Logical y.
 * @param width - Panel width.
 * @param height - Panel height.
 * @returns The NineSlice panel.
 */
export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(
    x,
    y,
    AtlasKeys.ui,
    Frames.ui.panel,
    width,
    height,
    PANEL_INSET,
    PANEL_INSET,
    PANEL_INSET,
    PANEL_INSET
  );
}

/**
 * Make a {@link addPanel} panel a tap target for its full logical rect. A
 * NineSlice's default input hit area is its 16×16 source frame, not its stretched
 * display size, so the hit rect must be given explicitly — `(0,0,width,height)`
 * in the object's top-left-anchored local space (origin-independent, the same
 * form the battle command Zone uses). Mirrors the interactive flat rectangles it
 * replaces; unbind with `panel.off(POINTER_DOWN)` in the owner's teardown.
 * @param panel - The panel to make interactive.
 * @param width - The panel's logical width (its hit width).
 * @param height - The panel's logical height (its hit height).
 * @param onPointerDown - The pointer-down handler.
 * @returns void
 */
export function enablePanelTap(
  panel: Phaser.GameObjects.NineSlice,
  width: number,
  height: number,
  onPointerDown: () => void
): void {
  panel
    .setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    })
    .on(Phaser.Input.Events.POINTER_DOWN, onPointerDown);
}

/**
 * Create the grist-gold `arrow` selection cursor from the `ui` atlas. The pack
 * arrow points **down**; pass a rotation (radians) to aim it (e.g. `-Math.PI/2`
 * to point right for a vertical menu). Origin is the image default (0.5) so a
 * caller repositions it by its center like the marker/caret it replaces.
 * @param scene - The owning scene.
 * @param x - Logical x.
 * @param y - Logical y.
 * @param rotation - Cursor rotation in radians (default 0 = pointing down).
 * @returns The tinted cursor image.
 */
export function addCursor(
  scene: Phaser.Scene,
  x: number,
  y: number,
  rotation = 0
): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, AtlasKeys.ui, Frames.ui.arrow)
    .setTint(CURSOR_TINT)
    .setRotation(rotation);
}
