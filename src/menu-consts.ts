/**
 * Typed view constants for the pause/main-menu scene (#113): its logical-pixel
 * layout, chrome colors, and monospace text styles. Split out of the central
 * `consts` module (which holds the scene keys + battle/field/bench/dialogue/region
 * tunables) so that file stays within its line budget; the Menu scene imports its
 * own visual constants from here and the scene key from `consts`. Never inline
 * these as magic strings/numbers — a rename is a single edit and a typo is a
 * compile error.
 * @module menu-consts
 */

/**
 * Pause/main-menu layout in logical (384×216) pixels (#113). A centered title
 * banners the top, the six entries stack as a vertical list down the left-center,
 * and an info/ledger detail panel opens on the right when an entry is confirmed.
 * First-pass — the *shape* (a titled vertical entry list with a side detail panel)
 * is the contract, not the exact constants.
 */
export const MenuLayout = {
  /** Centered title banner Y. */
  titleY: 12,
  /** The first entry row's center; subsequent entries stack down by `rowGap`. */
  entryX: 110,
  firstEntryY: 56,
  rowGap: 22,
  entryWidth: 150,
  entryHeight: 18,
  /** The cursor caret drawn to the left of the focused entry. */
  caretX: 28,
  /** The detail panel (right side) shown when an entry is confirmed. */
  panelX: 208,
  panelY: 48,
  panelWidth: 168,
  panelHeight: 132,
  /** Inset of the panel's title and its body lines from the panel's top-left. */
  panelPadX: 10,
  panelTitleY: 58,
  panelBodyY: 80,
  /** Vertical step between stacked body lines in the detail panel. */
  panelLineGap: 14,
  /**
   * The Ledger **codex** panel's denser body (#221): it stacks the karma header, the
   * `Recorded: N of M` tally, and one line per catalog choice, so it starts just under
   * the title and steps tighter than the four-slot info panel to fit every row.
   */
  codexBodyY: 72,
  codexLineGap: 9,
  /** The bottom hint line ("↑↓ move · Enter open · Esc close"). */
  hintY: 200,
} as const;

/** Pause/main-menu placeholder-art and chrome colors (programmatic art only). */
export const MenuColors = {
  backdrop: 0x141821,
  title: "#ffd166",
  /** An unfocused entry label. */
  entry: "#9aa3b2",
  /** The focused entry label (and its caret). */
  entryFocused: "#ffd166",
  /** The detail panel fill + stroke. */
  panelFill: 0x0d111a,
  panelStroke: 0x39455c,
  panelTitle: "#ffd166",
  panelBody: "#e8e8ea",
  hint: "#5a606c",
} as const;

/**
 * Pause/main-menu text styles (monospace chrome). Kept with the other typed Menu
 * constants so the scene stays a thin renderer and a color/size change is a single
 * edit. The shapes match Phaser's text-style object.
 */
export const MenuTextStyles = {
  /** The centered "Menu" title banner. */
  title: {
    fontFamily: "monospace",
    fontSize: "12px",
    color: MenuColors.title,
  },
  /** A menu entry label (recolored per focus on render). */
  entry: {
    fontFamily: "monospace",
    fontSize: "10px",
    color: MenuColors.entry,
  },
  /** The detail-panel title. */
  panelTitle: {
    fontFamily: "monospace",
    fontSize: "10px",
    color: MenuColors.panelTitle,
  },
  /** A detail-panel body line. */
  panelBody: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: MenuColors.panelBody,
  },
  /** The bottom controls hint. */
  hint: {
    fontFamily: "monospace",
    fontSize: "8px",
    color: MenuColors.hint,
  },
  /** A Ledger codex line (#221) — a denser body line so every catalog row fits. */
  codexLine: {
    fontFamily: "monospace",
    fontSize: "7px",
    color: MenuColors.panelBody,
  },
} as const;
