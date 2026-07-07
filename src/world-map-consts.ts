/**
 * Typed constants for the world-map travel front door (#241) — the scene-data payloads
 * the World Map / Region handoffs use, and the World Map + region player-mode layout /
 * colors / text styles. Split out of `consts.ts` (the way `menu-consts.ts` is) so each
 * file stays under its line budget; import from here, never inline the magic
 * strings/numbers, so a rename is a single edit and a typo is a compile error.
 * @module world-map-consts
 */
import { GRIST_GOLD } from "./logic/render/palette";

/**
 * The typed scene-data a gameplay surface hands to the World Map when it opens it
 * (#241): the scene key to return to when the map is closed with Back/Esc, so the
 * map resumes the caller exactly where the player was. Absent when the map is reached
 * standalone via the `?scene=worldmap` seam — that map has no caller and Back stays put.
 */
export interface WorldMapLaunchData {
  /** The caller scene key to resume on Back/Esc (e.g. the Field). */
  readonly returnTo: string;
}

/**
 * The typed scene-data the World Map hands to the Region scene when the player travels
 * into a region (#241): the region id + world-state to boot, the saved cleared-cursor
 * to resume partial progress at, and the scene to return to when the player leaves the
 * region (the World Map). The Region scene reads this in `init()` and boots the region
 * runtime in player mode, wiring each encounter to a real battle. Kept here so a
 * world-map launch and a region-init can never drift on key names.
 */
export interface RegionLaunchData {
  /** The region id to boot (a {@link import("./content").RegionId}). */
  readonly regionId: string;
  /** The world-state to boot in (`reach` or `ashfall`). */
  readonly worldState: string;
  /** The saved cleared-cursor to fast-forward to (resume partial progress). */
  readonly cleared: number;
  /** The scene to return to when the player leaves the region (the World Map). */
  readonly returnTo: string;
}

/**
 * The typed scene-data the World Map hands to the Finale scene when the player enters the
 * ★ Aurel's Heart node (#244): the scene to return to if the finale is ever backed out of
 * before it commits. The finale itself always plays through to the Title on completion, so
 * `returnTo` is the pre-commit escape hatch, not the terminal destination. Absent when the
 * finale is reached standalone via the `?scene=finale` seam.
 */
export interface FinaleLaunchData {
  /** The caller scene key to resume if the finale is exited before it commits. */
  readonly returnTo: string;
}

/**
 * World-map surface layout in logical (384×216) pixels (#241). The travel front door
 * is a full-screen list surface (the Menu/Bench chrome pattern): a title banner, a
 * grist readout, a single navigable column of status-graded region rows and Act nodes,
 * a detail line, and a bottom controls hint. The *shape* is the contract, not the
 * exact constants.
 */
export const WorldMapLayout = {
  /** Centered title banner Y. */
  titleY: 6,
  /** Shared-grist readout (top-left). */
  gristX: 8,
  gristY: 6,
  /** World-state readout (top-right, right-aligned). */
  stateX: 376,
  stateY: 6,
  /** The single navigable column of entries (regions, then Act nodes). */
  rowX: 12,
  rowCenterX: 192,
  firstRowY: 26,
  rowWidth: 360,
  rowHeight: 13,
  rowGap: 14,
  /** The most rows the column ever renders (7 regions + 4 reunions + 1 finale). */
  maxRows: 12,
  /** The selected-entry detail/cue line, along the bottom. */
  detailY: 194,
  /** The "[Enter] travel · [Esc] back" affordance hint, centered along the bottom. */
  hintY: 207,
} as const;

/** World-map placeholder-art and chrome colors (programmatic — no bespoke map art). */
export const WorldMapColors = {
  backdrop: 0x0d1219,
  title: "#ffd166",
  grist: "#9be7c4",
  state: "#9be7c4",
  labelAvailable: "#e8e8ea",
  labelLocked: "#5a606c",
  detail: "#c8cbd2",
  hint: "#5a606c",
  /** The grist-gold accent (kept for parity with the shared chrome). */
  accent: GRIST_GOLD,
} as const;

/** World-map text styles (monospace chrome). */
export const WorldMapTextStyles = {
  title: {
    fontFamily: "monospace",
    fontSize: "12px",
    color: WorldMapColors.title,
  },
  grist: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: WorldMapColors.grist,
  },
  state: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: WorldMapColors.state,
  },
  row: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: WorldMapColors.labelAvailable,
  },
  detail: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: WorldMapColors.detail,
    wordWrap: { width: 368 },
  },
  hint: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: WorldMapColors.hint,
  },
} as const;

/**
 * Region player-mode chrome (#241): the Engage / Back controls the World Map's region
 * runner overlays on the shipped side-view (harness mode is unchanged). The *shape*
 * (an Engage-next-encounter affordance + a Back-to-map exit) is the contract.
 */
export const RegionPlayLayout = {
  /** The Engage-next-encounter button. */
  engageX: 192,
  engageY: 120,
  engageWidth: 200,
  engageHeight: 22,
  /** The tappable Back-to-map control (top-right chrome). */
  backX: 344,
  backY: 15,
  backWidth: 68,
  backHeight: 18,
  /** The bottom "[Enter] engage · [Esc] map" affordance hint. */
  hintY: 207,
} as const;

/** Region player-mode chrome colors. */
export const RegionPlayColors = {
  buttonText: "#e8e8ea",
  hint: "#5a606c",
} as const;

/** Region player-mode text styles (monospace chrome). */
export const RegionPlayTextStyles = {
  button: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: RegionPlayColors.buttonText,
  },
  hint: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: RegionPlayColors.hint,
  },
} as const;
