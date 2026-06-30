/**
 * Typed layout, palette, and text-style constants for the Field-scene HUD
 * (PD-3.3 / #107). Split out of the scene (and out of the shared `consts.ts`,
 * which is at its line budget) so the field-HUD widget stays a thin renderer and
 * a color/size change is a single edit next to the widget that consumes them.
 * Pure constants — no Phaser, no state. The *shapes* match Phaser's text-style
 * object; the values are first-pass — the shape is the contract, not the numbers.
 * @module scenes/field-hud-layout
 */
import { GameView } from "../consts";

/**
 * Field-HUD layout in logical (384×216) pixels: the persistent grist readout
 * (top-left), the floating context prompt that follows an in-range interactable,
 * the mini-map summon hint (top-right), and the summonable mini-map overlay (a
 * centered panel of room nodes A→B→C). Minimal and quiet per ui-ux-and-controls —
 * the HUD must keep the screen contemplative.
 */
export const FieldHudLayout = {
  /** Persistent grist readout, top-left (kept clear of the centered room name). */
  gristX: 6,
  gristY: 6,
  /** Mini-map summon hint, top-right. */
  hintRightX: 378,
  hintY: 6,
  /** Floating context prompt anchor (centered above Wren's head height band). */
  promptX: GameView.width / 2,
  promptY: 196,
  /** The summonable mini-map overlay panel (centered). */
  mapPanelX: 112,
  mapPanelY: 64,
  mapPanelWidth: 160,
  mapPanelHeight: 88,
  /** Mini-map title baseline (inside the panel, top). */
  mapTitleY: 72,
  /** First room node's center inside the panel; nodes stack down by `mapRowH`. */
  mapNodeX: 132,
  mapFirstNodeY: 96,
  mapRowH: 16,
  /** Node marker (dot) radius and its label offset from the marker center. */
  mapNodeRadius: 4,
  mapLabelDx: 12,
  /** Depth the mini-map overlay sits at (above the field, below nothing else). */
  mapDepth: 150,
} as const;

/** Field-HUD palette: light text, grist-gold highlight, dim for unvisited nodes. */
export const FieldHudColors = {
  /** The persistent grist readout — grist-gold, "always feel the wallet". */
  grist: "#ffd166",
  /** The mini-map summon hint and floating context prompt. */
  prompt: "#9be7c4",
  /** The mini-map overlay panel fill + stroke. */
  mapPanelFill: 0x0d111a,
  mapPanelStroke: 0x39455c,
  /** The mini-map title text. */
  mapTitle: "#ffd166",
  /** Room-node label colors by visit state. */
  nodeCurrentText: "#ffd166",
  nodeVisitedText: "#e8e8ea",
  nodeUnvisitedText: "#737a86",
  /** Room-node marker fill by visit state. */
  nodeCurrentFill: 0xffd166,
  nodeVisitedFill: 0x9be7c4,
  nodeUnvisitedFill: 0x39455c,
} as const;

/**
 * Field-HUD text styles (monospace chrome): the persistent grist readout, the
 * mini-map summon hint, the floating context prompt, the mini-map title, and the
 * per-node label. Kept here so the scene stays a thin renderer.
 */
export const FieldHudTextStyles = {
  /** The always-visible grist readout. */
  grist: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: FieldHudColors.grist,
  },
  /** The "[M] map" summon hint. */
  hint: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: FieldHudColors.prompt,
  },
  /** The floating context prompt on an in-range interactable. */
  contextPrompt: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: FieldHudColors.prompt,
  },
  /** The mini-map overlay title. */
  mapTitle: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: FieldHudColors.mapTitle,
  },
  /** A mini-map room-node label. */
  mapNode: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: FieldHudColors.nodeVisitedText,
  },
} as const;
