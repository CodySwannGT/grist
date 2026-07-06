/**
 * Unit coverage for the pure moral-ledger **codex** projection
 * (`logic/narrative/ledger-codex`) — the headless proof for sub-task #221 / Story
 * #196's acceptance criteria. Asserts, against a synthetic catalog + ledger (so the
 * projection rules are proven independently of the authored content), that the codex
 * lists every entry in authored order, tags each recorded/pending correctly (default
 * truthy vs. a per-entry predicate), shows the recorded line only when recorded, and
 * headers the `Recorded: N of M` tally — including the empty-ledger all-pending
 * `0 of M` case the second Gherkin scenario names.
 */
import { describe, expect, it } from "vitest";

import {
  projectLedgerCodex,
  type LedgerCodexEntry,
} from "../../src/logic/narrative";
import type { NarrativeLedger, SceneFlag } from "../../src/logic/narrative";

/** A three-entry synthetic catalog: two plain booleans and one tri-state predicate. */
const CATALOG: readonly LedgerCodexEntry[] = [
  { id: "a", flag: "flag-a", title: "Choice A", recordedLine: "A happened." },
  { id: "b", flag: "flag-b", title: "Choice B", recordedLine: "B happened." },
  {
    id: "c",
    flag: "flag-c",
    title: "Choice C",
    recordedLine: "C completed.",
    isRecorded: (value: SceneFlag): boolean => value === "completed",
  },
];

describe("projectLedgerCodex", () => {
  it("lists every catalog entry in authored order", () => {
    const codex = projectLedgerCodex(CATALOG, {});
    expect(codex.rows.map(row => row.id)).toEqual(["a", "b", "c"]);
    expect(codex.rows.map(row => row.title)).toEqual([
      "Choice A",
      "Choice B",
      "Choice C",
    ]);
  });

  it("an empty ledger yields every row pending and Recorded: 0 of M", () => {
    const codex = projectLedgerCodex(CATALOG, {});
    expect(codex.rows.every(row => !row.recorded)).toBe(true);
    expect(codex.rows.every(row => row.line === null)).toBe(true);
    expect(codex.recorded).toBe(0);
    expect(codex.total).toBe(3);
    expect(codex.tally).toBe("Recorded: 0 of 3");
  });

  it("tags a present truthy flag recorded and shows its recorded line", () => {
    const ledger: NarrativeLedger = { "flag-a": true };
    const codex = projectLedgerCodex(CATALOG, ledger);
    const rowA = codex.rows.find(row => row.id === "a");
    expect(rowA?.recorded).toBe(true);
    expect(rowA?.line).toBe("A happened.");
    expect(codex.tally).toBe("Recorded: 1 of 3");
  });

  it("treats a present-but-falsey flag as pending (present & truthy rule)", () => {
    const codex = projectLedgerCodex(CATALOG, { "flag-a": false });
    expect(codex.rows.find(row => row.id === "a")?.recorded).toBe(false);
    expect(codex.recorded).toBe(0);
  });

  it("applies a per-entry predicate (tri-state records only on its value)", () => {
    const available = projectLedgerCodex(CATALOG, { "flag-c": "available" });
    expect(available.rows.find(row => row.id === "c")?.recorded).toBe(false);

    const completed = projectLedgerCodex(CATALOG, { "flag-c": "completed" });
    const rowC = completed.rows.find(row => row.id === "c");
    expect(rowC?.recorded).toBe(true);
    expect(rowC?.line).toBe("C completed.");
  });

  it("counts multiple recorded entries and ignores unknown ledger keys", () => {
    const ledger: NarrativeLedger = {
      "flag-a": true,
      "flag-c": "completed",
      "flag-unknown": true,
    };
    const codex = projectLedgerCodex(CATALOG, ledger);
    expect(codex.recorded).toBe(2);
    expect(codex.tally).toBe("Recorded: 2 of 3");
    // The unknown key never adds a row — the catalog is the sole source of rows.
    expect(codex.rows).toHaveLength(3);
  });
});
