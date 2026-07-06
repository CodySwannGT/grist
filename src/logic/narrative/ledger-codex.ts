/**
 * The moral-ledger **codex** projection (sub-task #221, Story #196 / #99, PRD #42):
 * the pure, Phaser-free machine that turns a live {@link NarrativeLedger} into the
 * render-ready list the Ledger menu panel surfaces — every authored moral choice in
 * catalog order, each tagged **recorded** (its flag is present and resolved) or
 * **pending**, plus a `Recorded: N of M` tally. Data in, data out: it owns the
 * codex *rules* (order, recorded/pending, the tally), never the rendering or the
 * strings. The authored catalog (titles + recorded lines + per-entry flag keys)
 * lives in `content/ledger-codex` — the content-as-data half — and is passed in, so
 * this module stays in the logic core with no edge into `content`.
 *
 * Mirrors the `logic/pause-menu` split the Ledger route already uses: the pure model
 * here, a thin scene ({@link import("../../scenes/Menu").Menu}) that renders it. The
 * same `(catalog, ledger)` always yields the same view — nothing reads `Math.random`
 * / `Date.now`, so it is unit-testable headless and its `__VERIFY__` twin round-trips
 * exactly.
 *
 * **Recorded vs. pending.** An entry is *recorded* when its flag key is present in the
 * ledger AND the entry's {@link LedgerCodexEntry.isRecorded} predicate accepts the
 * value (default: any truthy {@link SceneFlag}); otherwise *pending*. The predicate is
 * per-entry content-as-data so a tri-state flag (a reunion's
 * `available`/`completed`/`missed`) records only on its meaningful value, while a plain
 * boolean beat records on `true`. A pending entry never shows a recorded line.
 * @module logic/narrative/ledger-codex
 */
import type { NarrativeLedger, SceneFlag } from "./types";

/**
 * One authored codex entry (content-as-data): the {@link NarrativeLedger} `flag` key
 * it watches, the display `title`, the `recordedLine` shown once recorded, and the
 * optional `isRecorded` predicate that decides — from the flag's value — whether the
 * beat counts as recorded (default: any truthy value). Pure data; the strings live in
 * the `content/ledger-codex` catalog, the codebase's typed-consts idiom (no i18n
 * runtime).
 */
export interface LedgerCodexEntry {
  /** The stable catalog id (also the codex row id). */
  readonly id: string;
  /** The {@link NarrativeLedger} flag key this entry is recorded by. */
  readonly flag: string;
  /** The display title of the moral choice. */
  readonly title: string;
  /** The line shown when the entry is recorded (never shown while pending). */
  readonly recordedLine: string;
  /**
   * Whether a *present* flag value counts as recorded. Omitted → any truthy value
   * records (a plain boolean beat). A tri-state flag supplies its own predicate (e.g.
   * a reunion records only on `"completed"`).
   */
  readonly isRecorded?: (value: SceneFlag) => boolean;
}

/** One projected codex row: the entry's identity plus its recorded/pending resolution. */
export interface LedgerCodexRow {
  /** The catalog entry id. */
  readonly id: string;
  /** The flag key this row is recorded by. */
  readonly flag: string;
  /** The display title. */
  readonly title: string;
  /** Whether this choice has been recorded in the ledger. */
  readonly recorded: boolean;
  /** The recorded line when recorded, else `null` (pending). */
  readonly line: string | null;
}

/**
 * The whole projected codex: every catalog row in authored order, the count of
 * recorded rows, the catalog size, and the pre-formatted `Recorded: N of M` tally the
 * panel header shows. Plain, deep-equal-comparable data.
 */
export interface LedgerCodexView {
  /** Every catalog row, in authored order. */
  readonly rows: readonly LedgerCodexRow[];
  /** How many rows are recorded (`N`). */
  readonly recorded: number;
  /** The catalog size (`M`). */
  readonly total: number;
  /** The header tally text: `Recorded: N of M`. */
  readonly tally: string;
}

/**
 * Whether a catalog entry is recorded in the given ledger: its flag key must be
 * present AND its {@link LedgerCodexEntry.isRecorded} predicate (default: truthy) must
 * accept the value. Total — a missing key is simply pending.
 * @param entry - The catalog entry.
 * @param ledger - The live narrative ledger.
 * @returns True when the entry counts as recorded.
 */
function isEntryRecorded(
  entry: LedgerCodexEntry,
  ledger: NarrativeLedger
): boolean {
  if (!Object.prototype.hasOwnProperty.call(ledger, entry.flag)) {
    return false;
  }
  const value = ledger[entry.flag];
  if (value === undefined) {
    return false;
  }
  const accept =
    entry.isRecorded ?? ((flag: SceneFlag): boolean => Boolean(flag));
  return accept(value);
}

/**
 * Project an authored codex catalog against a live {@link NarrativeLedger}: return
 * every entry as a {@link LedgerCodexRow} in the catalog's authored order — recorded
 * (with its line) or pending (line `null`) — plus the recorded count, the catalog
 * size, and the `Recorded: N of M` header tally. Pure and total: an empty ledger
 * yields every row pending and `Recorded: 0 of M`.
 * @param catalog - The authored codex entries, in display order.
 * @param ledger - The live narrative ledger (e.g. a save's `scene.flags`).
 * @returns The projected codex view.
 */
export function projectLedgerCodex(
  catalog: readonly LedgerCodexEntry[],
  ledger: NarrativeLedger
): LedgerCodexView {
  const rows: readonly LedgerCodexRow[] = catalog.map(entry => {
    const recorded = isEntryRecorded(entry, ledger);
    return {
      id: entry.id,
      flag: entry.flag,
      title: entry.title,
      recorded,
      line: recorded ? entry.recordedLine : null,
    };
  });
  const recorded = rows.reduce((sum, row) => (row.recorded ? sum + 1 : sum), 0);
  return {
    rows,
    recorded,
    total: catalog.length,
    tally: `Recorded: ${recorded} of ${catalog.length}`,
  };
}
