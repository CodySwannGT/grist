/**
 * The persistent controls & resource reference (#228) — the pure, Phaser-free copy
 * the pause menu's System/Settings panel renders so a player who missed the
 * first-battle hints can always look the controls up. A newcomer had no way to
 * discover how to navigate a menu, what the `AP`/`G` costs mean, or how to change
 * the battle speed; this is the static legend that answers all three, quoting the
 * **real** bindings from `services/input-map` (battle) and `services/field-input-map`
 * (field) so the reference can never drift from what the keys actually do.
 *
 * Data in, lines out: a small typed catalog of titled sections, plus two total
 * projections the thin {@link import("../ui/help-panel").HelpPanel} renders — one
 * that tags each line as a heading or a row (for per-line color) and one that
 * flattens to plain strings (for the verification bridge to assert). Terse by
 * design (the panel is ~168px wide); it unit-tests headless.
 * @module logic/controls-help
 */

/** One titled block of the controls reference: a heading and its rows. */
interface HelpSection {
  /** The section heading (rendered in the panel's title color). */
  readonly title: string;
  /** The reference rows under the heading (rendered as body lines). */
  readonly rows: readonly string[];
}

/**
 * The controls & resource reference, in render order. Field and battle bindings
 * are quoted verbatim from the key maps (WASD/arrows to move, Enter/Space to
 * confirm, `M` for the map, **Esc** to open the pause menu (#233), and **Shift** —
 * not Tab — to cycle battle speed), and
 * the last block glosses the two resources the command menu prices in: `AP`
 * (Craft) and `G`rist (Bind). This array IS the reference the panel shows.
 */
export const CONTROLS_HELP: readonly HelpSection[] = [
  {
    title: "FIELD",
    rows: ["Move    WASD / Arrows", "Examine Enter · Map M", "Menu    Esc"],
  },
  {
    title: "BATTLE",
    rows: [
      "Command ↑↓ · Target ←→",
      "Confirm Enter · Cancel Esc",
      "Speed   Shift (Wait/Norm/Fast)",
    ],
  },
  {
    title: "COMMANDS & COST",
    rows: [
      "Strike free · Craft AP · Bind G",
      "AP refills each turn",
      "G = Grist, hard-won & shared",
    ],
  },
] as const;

/** One projected reference line: its text and whether it is a section heading. */
interface HelpLine {
  /** The line text. */
  readonly text: string;
  /** Whether this line is a section heading (vs a body row). */
  readonly heading: boolean;
}

/**
 * Project the reference into display lines, each tagged heading-or-row so the panel
 * can color headings like a title and rows like body text. A total function of the
 * static {@link CONTROLS_HELP} catalog.
 * @returns The tagged reference lines in render order.
 */
export function controlsHelpDisplay(): readonly HelpLine[] {
  return CONTROLS_HELP.flatMap(section => [
    { text: section.title, heading: true },
    ...section.rows.map(text => ({ text, heading: false })),
  ]);
}

/**
 * The flat list of reference line strings, in render order — the shape the
 * verification bridge surfaces so an e2e can assert the panel rendered the controls
 * (that "Shift" and the AP/Grist legend are present) without inspecting pixels.
 * @returns Every reference line as a plain string.
 */
export function controlsHelpLines(): readonly string[] {
  return controlsHelpDisplay().map(line => line.text);
}

/** The number of display lines the reference produces (the panel's pool size). */
export const CONTROLS_HELP_LINE_COUNT = controlsHelpDisplay().length;
