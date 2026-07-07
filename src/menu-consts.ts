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
  /**
   * The detail panel (right side) shown when an entry is confirmed. Widened and
   * heightened for #265: the Ledger/Party rows carry authored sentences (a recorded
   * codex line, a member's name + stats + shard) that overflowed the old 168px panel's
   * right border. A wider inner body wraps each authored line to at most a couple of
   * rows (see `ui/menu-panel-fit`), and the taller box holds the fully-recorded codex
   * once its rows wrap; the left edge still clears the longest entry label
   * ("System/Settings", centered on {@link entryX}) so the panel never covers an entry.
   */
  panelX: 160,
  panelY: 24,
  panelWidth: 216,
  panelHeight: 174,
  /** Inset of the panel's title and its body lines from the panel's top-left. */
  panelPadX: 10,
  panelTitleY: 34,
  panelBodyY: 54,
  /** Vertical step between stacked body lines in the detail panel. */
  panelLineGap: 14,
  /**
   * The Ledger **codex** panel's denser body (#221): it stacks the compact karma header,
   * the `Recorded: N of M` tally, and one line per catalog choice, so it starts just
   * under the title and steps tighter than the four-slot info panel. The codex panel
   * *flows* its rows by their rendered (wrapped) height rather than a fixed step, so a
   * two-row recorded line never overlaps the next; this gap is the base top and the
   * fallback single-line pitch (the help panel, whose lines never wrap, still steps by
   * it).
   */
  codexBodyY: 46,
  codexLineGap: 9,
  /** The extra vertical gap the codex flow leaves between wrapped rows (#265). */
  codexRowGap: 1,
  /** The bottom hint line ("↑↓ move · Enter open · Esc / tap close"). */
  hintY: 200,
  /**
   * The transparent hit-rect over the bottom hint (#239) that lets touch players —
   * who reach the Menu via the Field's tappable "[Esc] menu" affordance but have no
   * Esc key — tap to close it, so the Menu is never a pointer dead-end.
   */
  hintHitWidth: 220,
  hintHitHeight: 18,
} as const;

/**
 * The **Party** panel layout (#249) — the roster the pause menu's Party entry opens.
 * One row per member (a small portrait faceset beside a compact stat line) stacked
 * from just under the panel title, then the roster-wide bench-build lines below the
 * roster. Sized so the Phase-1/Act-I party (2–4 members) shows its build lines
 * comfortably; the late-game full roster fills the rows and the build lines fold away.
 */
export const PartyLayout = {
  /** The first member row's baseline Y; rows stack down by `rowGap`. */
  rowY: 50,
  /**
   * Vertical step between stacked member rows — sized to hold a stat line that wraps to
   * a second row (a max-length name + stats + shard) without the wrapped line touching
   * the next member (#265).
   */
  rowGap: 18,
  /** The square portrait faceset drawn at the left of each member row. */
  portraitSize: 12,
  /** X inset of the member's stat line from the portrait's right edge. */
  lineInset: 4,
  /** Vertical step between the bench-build lines stacked below the roster. */
  buildLineGap: 9,
  /** The number of bench-build lines the panel pools (spells / shards / augments). */
  buildLineSlots: 3,
  /** The max roster rows the panel pools (the full secondary roster). */
  memberSlots: 7,
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
  /** A Party roster member's compact stat line (#249) — name + level + HP/AP + shard. */
  partyMember: {
    fontFamily: "monospace",
    fontSize: "7px",
    color: MenuColors.panelBody,
  },
  /** A Party roster-wide bench-build line (#249) — spells / shards / augments. */
  partyBuild: {
    fontFamily: "monospace",
    fontSize: "7px",
    color: MenuColors.entry,
  },
} as const;
