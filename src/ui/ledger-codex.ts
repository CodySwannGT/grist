/**
 * The Ledger **codex panel** presenter (sub-task #221, Story #196 / #99): the pure,
 * Phaser-free formatter that turns the projected {@link LedgerCodexView} (and the
 * karma {@link MoralLedger} summary) into the ordered display lines the Menu scene's
 * Ledger panel renders. Data in, strings out — it owns the panel's *wording and
 * order* (the karma summary header, the `Recorded: N of M` tally, then one line per
 * codex row, recorded-with-line or pending), never any Phaser object. The scene is a
 * thin renderer over this list, so the whole panel copy is unit-testable headless and
 * its `__VERIFY__` twin reads the same lines.
 *
 * The karma summary lines come from {@link formatMoralLedger} (the existing #98 header
 * the Ledger route already showed) — kept as the panel header, additive, so the codex
 * is layered on top of it and never regresses it.
 * @module ui/ledger-codex
 */
import type { LedgerCodexRow, LedgerCodexView } from "../logic/narrative";
import { moralLedgerLean } from "../logic/pause-menu";
import type { MoralLedger } from "../logic/save/types";

/** The bullet prefix for a recorded codex row. */
const RECORDED_MARK = "✓ ";
/** The bullet prefix for a still-pending codex row. */
const PENDING_MARK = "· ";
/** The separator between a row's title and its recorded line / pending marker. */
const TITLE_SEP = " — ";
/** The word shown in place of a recorded line for a pending row. */
const PENDING_LABEL = "pending";

/**
 * Format one codex row into its single display line: a recorded row shows its
 * recorded line, a pending row shows the pending marker — each prefixed by a
 * recorded/pending bullet so the state reads without color.
 * @param row - The projected codex row.
 * @returns The row's display line.
 */
export function ledgerCodexRowLine(row: LedgerCodexRow): string {
  const mark = row.recorded ? RECORDED_MARK : PENDING_MARK;
  const detail = row.recorded ? (row.line ?? "") : PENDING_LABEL;
  return `${mark}${row.title}${TITLE_SEP}${detail}`;
}

/**
 * Format the karma summary as a single **compact** header line — the net karma with its
 * lean, then the freed / wielded counts — instead of the classic ledger route's three
 * stacked lines (#98). The codex panel keeps the same karma facts but on one line so the
 * denser codex body (which flows each recorded row to wrapped rows, #265) has the
 * vertical room to show a fully-recorded catalog without spilling past the panel.
 * @param ledger - The moral ledger to summarize.
 * @returns The one-line karma summary.
 */
export function formatCodexKarmaLine(ledger: MoralLedger): string {
  const sign = ledger.karma >= 0 ? "+" : "";
  return `Karma ${sign}${ledger.karma} (${moralLedgerLean(ledger)})  Freed ${ledger.freeChoices}  Wielded ${ledger.wieldChoices}`;
}

/**
 * Format the whole Ledger codex panel into ordered display lines: the compact karma
 * summary header, the `Recorded: N of M` tally, then one line per codex row in authored
 * order. Pure — the scene renders these lines (wrapping each to the panel width).
 * @param codex - The projected codex view.
 * @param ledger - The moral ledger to summarize in the header.
 * @returns The ordered panel display lines.
 */
export function formatLedgerCodexPanel(
  codex: LedgerCodexView,
  ledger: MoralLedger
): readonly string[] {
  return [
    formatCodexKarmaLine(ledger),
    codex.tally,
    ...codex.rows.map(ledgerCodexRowLine),
  ];
}
