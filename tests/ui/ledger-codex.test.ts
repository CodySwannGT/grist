/**
 * Unit coverage for the pure Ledger codex panel formatter (`ui/ledger-codex`) — the
 * Phaser-free twin for the panel body sub-task #221 renders. Asserts the karma summary
 * header (#98) is kept as the panel header (additive — not regressed), the
 * `Recorded: N of M` tally follows it, and each codex row formats to a single line that
 * shows its recorded line when recorded or the pending marker when not — each prefixed
 * by a non-color recorded/pending bullet.
 */
import { describe, expect, it } from "vitest";

import {
  formatCodexKarmaLine,
  formatLedgerCodexPanel,
  ledgerCodexRowLine,
} from "../../src/ui/ledger-codex";
import { moralLedgerLean } from "../../src/logic/pause-menu";
import { projectLedgerCodex } from "../../src/logic/narrative";
import type { LedgerCodexEntry } from "../../src/logic/narrative";
import type { MoralLedger } from "../../src/logic/save/types";

const TITLE_A = "Choice A";
const LINE_A = "A happened.";
const TITLE_B = "Choice B";

const CATALOG: readonly LedgerCodexEntry[] = [
  { id: "a", flag: "flag-a", title: TITLE_A, recordedLine: LINE_A },
  { id: "b", flag: "flag-b", title: TITLE_B, recordedLine: "B happened." },
];

const LEDGER: MoralLedger = { karma: -2, freeChoices: 1, wieldChoices: 3 };

describe("ledgerCodexRowLine", () => {
  it("a recorded row shows its recorded line", () => {
    const line = ledgerCodexRowLine({
      id: "a",
      flag: "flag-a",
      title: TITLE_A,
      recorded: true,
      line: LINE_A,
    });
    expect(line).toContain(TITLE_A);
    expect(line).toContain(LINE_A);
    expect(line).not.toContain("pending");
  });

  it("a pending row shows the pending marker, not a line", () => {
    const line = ledgerCodexRowLine({
      id: "b",
      flag: "flag-b",
      title: TITLE_B,
      recorded: false,
      line: null,
    });
    expect(line).toContain(TITLE_B);
    expect(line).toContain("pending");
  });
});

describe("formatCodexKarmaLine", () => {
  it("summarizes karma, lean, and the freed/wielded counts on one compact line", () => {
    const line = formatCodexKarmaLine(LEDGER);
    expect(line).toContain("Karma -2");
    expect(line).toContain(`(${moralLedgerLean(LEDGER)})`);
    expect(line).toContain("Freed 1");
    expect(line).toContain("Wielded 3");
  });
});

describe("formatLedgerCodexPanel", () => {
  it("leads with the compact karma header, then the tally, then one line per row", () => {
    const codex = projectLedgerCodex(CATALOG, { "flag-a": true });
    const lines = formatLedgerCodexPanel(codex, LEDGER);

    // Header: one compact karma line (#265 — the denser body needs the vertical room).
    expect(lines[0]).toBe(formatCodexKarmaLine(LEDGER));
    // Then the tally.
    expect(lines[1]).toBe("Recorded: 1 of 2");
    // Then one line per catalog row (recorded first, then pending).
    expect(lines[2]).toContain(LINE_A);
    expect(lines[3]).toContain("pending");
    expect(lines).toHaveLength(2 + codex.rows.length);
  });
});
