/**
 * Shared battle-view geometry: the side-view combatant placement (`unitCenter`,
 * the single source the scene and the HUD's target marker both read) and the HUD
 * layout boxes / colors. Pure constants and total functions — no Phaser — so the
 * command-button hit rects are computed identically by the HUD (to lay out and
 * hit-test) and the verification bridge (to address a button under `?uat=1`).
 * @module ui/layout
 */
import { BattleLayout } from "../consts";
import { BattleSides, type BattleSide } from "../logic/combat";
import { COMMAND_ORDER } from "./commands";

/** A logical (384×216) rectangle: top-left origin plus size. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The on-screen center of a combatant: its side's anchor column, stepped up and
 * staggered toward screen-center for the back rows (a depth cue). Enemies anchor
 * left, party right. Shared by the scene's unit views and the HUD's target marker.
 * @param side - The combatant's side.
 * @param index - The combatant's index within its side.
 * @returns The unit's logical center.
 */
export function unitCenter(
  side: BattleSide,
  index: number
): { readonly x: number; readonly y: number } {
  const toEnemies = side === BattleSides.enemies;
  const anchorX = toEnemies
    ? BattleLayout.enemyAnchorX
    : BattleLayout.partyAnchorX;
  const dir = toEnemies ? 1 : -1;
  return {
    x: anchorX + dir * index * BattleLayout.rowStaggerX,
    y:
      BattleLayout.groundY -
      BattleLayout.unitHeight / 2 -
      index * BattleLayout.rowGap,
  };
}

/** HUD layout boxes, in logical (384×216) pixels. First-pass; the shape is the contract. */
export const HudLayout = {
  /** Left margin for the grist readout + party panel. */
  marginX: 4,
  /** Grist readout baseline (top-left). */
  gristY: 3,
  /** Right edge the speed widget aligns to (top-right). */
  speedRightX: 380,
  /** Speed widget baseline. */
  speedY: 3,
  /** Target label center X / baseline (top-center, below the battle title). */
  targetCenterX: 192,
  targetY: 18,
  /** Party panel: top of the first row, per-row height, bar size. */
  partyTopY: 170,
  partyRowH: 22,
  partyBarW: 62,
  partyBarH: 3,
  partyApDx: 88,
  /** Command menu: a right-aligned vertical list of buttons. */
  menuRightX: 380,
  menuTopY: 150,
  menuRowH: 12,
  menuW: 84,
  menuPadX: 4,
  /** Target marker: a caret this far above the targeted enemy's center. */
  markerYOffset: 18,
} as const;

/** HUD palette. Text is light on the dark backdrop; grist-gold is the highlight. */
export const HudColors = {
  text: "#e8e8ea",
  dim: "#737a86",
  grist: "#ffd166",
  ready: "#9be7c4",
  breakTag: "#ff7a6b",
  highlightText: "#ffd166",
  highlightFill: 0x33405a,
  panelFill: 0x0d111a,
  atbFill: 0x4cc2e0,
  atbBg: 0x1d2738,
  marker: 0xffd166,
} as const;

/**
 * The hit/draw rectangle of the command button at a menu index — a right-aligned
 * vertical list. Out-of-range indices clamp to row 0 so the function stays total.
 * @param index - The command's index in {@link COMMAND_ORDER}.
 * @returns The button's logical rectangle.
 */
export function commandRect(index: number): Rect {
  const row = Math.max(0, Math.min(index, COMMAND_ORDER.length - 1));
  return {
    x: HudLayout.menuRightX - HudLayout.menuW,
    y: HudLayout.menuTopY + row * HudLayout.menuRowH,
    width: HudLayout.menuW,
    height: HudLayout.menuRowH,
  };
}
