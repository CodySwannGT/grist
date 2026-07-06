/**
 * Unit coverage for the authored moral-ledger **codex catalog** (`content/ledger-codex`)
 * — sub-task #221 / Story #196. Asserts the catalog's integrity (stable authored order,
 * unique non-empty flag keys, every entry carries a title + recorded line) and that the
 * real catalog, projected against a live narrative ledger, satisfies both Gherkin
 * scenarios end-to-end: a fresh run reads all-pending `Recorded: 0 of M`, and a run with
 * recorded flags lists the recorded beats with their lines and the rest pending — over
 * the SAME flag shapes the game persists (`sable-lost`, the `reunion:<id>` statuses).
 */
import { describe, expect, it } from "vitest";

import {
  LEDGER_CODEX_CATALOG,
  LEDGER_CODEX_TOTAL,
  MILL_RENDERED_FLAG,
} from "../../src/content/ledger-codex";
import { projectLedgerCodex } from "../../src/logic/narrative";
import type { NarrativeLedger } from "../../src/logic/narrative";
import { SABLE_REVEALED_FLAG } from "../../src/content/scenes/ch1";
import { SABLE_LOST_FLAG } from "../../src/logic/narrative";
import { ReunionStatuses } from "../../src/logic/party/reunion";

describe("LEDGER_CODEX_CATALOG (authored catalog)", () => {
  it("is non-empty and LEDGER_CODEX_TOTAL matches its length", () => {
    expect(LEDGER_CODEX_CATALOG.length).toBeGreaterThan(0);
    expect(LEDGER_CODEX_TOTAL).toBe(LEDGER_CODEX_CATALOG.length);
  });

  it("every entry has a unique, non-empty flag key and full display copy", () => {
    const flags = LEDGER_CODEX_CATALOG.map(entry => entry.flag);
    expect(new Set(flags).size).toBe(flags.length);
    for (const entry of LEDGER_CODEX_CATALOG) {
      expect(entry.flag.length).toBeGreaterThan(0);
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.recordedLine.length).toBeGreaterThan(0);
    }
  });

  it("leads with the Ch.1 reveal, the mill beat, then the Reckoning (story order)", () => {
    expect(LEDGER_CODEX_CATALOG[0]?.flag).toBe(SABLE_REVEALED_FLAG);
    expect(LEDGER_CODEX_CATALOG[1]?.flag).toBe(MILL_RENDERED_FLAG);
    expect(LEDGER_CODEX_CATALOG[2]?.flag).toBe(SABLE_LOST_FLAG);
  });

  it("includes the four Act II reunion status flags", () => {
    const flags = LEDGER_CODEX_CATALOG.map(entry => entry.flag);
    expect(flags).toContain("reunion:quietus");
    expect(flags).toContain("reunion:asch");
    expect(flags).toContain("reunion:cal");
    expect(flags).toContain("reunion:shrike");
  });
});

describe("codex projection over the real catalog", () => {
  it("a fresh run (no scene flags) reads all pending, Recorded: 0 of M", () => {
    const codex = projectLedgerCodex(LEDGER_CODEX_CATALOG, {});
    expect(codex.recorded).toBe(0);
    expect(codex.total).toBe(LEDGER_CODEX_TOTAL);
    expect(codex.tally).toBe(`Recorded: 0 of ${LEDGER_CODEX_TOTAL}`);
    expect(codex.rows.every(row => !row.recorded && row.line === null)).toBe(
      true
    );
  });

  it("a run with recorded flags lists recorded beats with lines and the rest pending", () => {
    // The shapes the game actually persists into `save.scene.flags`.
    const ledger: NarrativeLedger = {
      [SABLE_LOST_FLAG]: true,
      "reunion:quietus": ReunionStatuses.completed,
      "reunion:asch": ReunionStatuses.available,
    };
    const codex = projectLedgerCodex(LEDGER_CODEX_CATALOG, ledger);

    const sableLost = codex.rows.find(row => row.flag === SABLE_LOST_FLAG);
    expect(sableLost?.recorded).toBe(true);
    expect(sableLost?.line).not.toBeNull();

    const quietus = codex.rows.find(row => row.flag === "reunion:quietus");
    expect(quietus?.recorded).toBe(true);

    // An `available` reunion has NOT been completed — it stays pending.
    const asch = codex.rows.find(row => row.flag === "reunion:asch");
    expect(asch?.recorded).toBe(false);
    expect(asch?.line).toBeNull();

    expect(codex.recorded).toBe(2);
    expect(codex.tally).toBe(`Recorded: 2 of ${LEDGER_CODEX_TOTAL}`);
  });
});
