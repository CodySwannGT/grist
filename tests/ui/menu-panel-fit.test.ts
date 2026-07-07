/**
 * Unit coverage for the pure menu detail-panel **fit** guard (`ui/menu-panel-fit`, #265)
 * — the Phaser-free twin the Ledger codex + Party panels rely on to keep every authored
 * row inside the panel chrome. The `dialogue-layout` fit idiom (#262 / #263) applied to
 * the pause menu: it asserts the *longest authored content* provably fits its wrapped-row
 * budget, so a future recorded line or roster name long enough to clip the panel's right
 * border (the QA finding: "…pried the cargo op…" clipped, "*Emberwisp" near-clipped)
 * fails CI rather than degrading in front of the player.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_CODEX_ROWS,
  MAX_PARTY_ROWS,
  codexRowLineFits,
  estimateMenuLineRows,
  menuPanelInnerWidth,
  partyLineWrapWidth,
  partyMemberLineFits,
} from "../../src/ui/menu-panel-fit";
import {
  formatCodexKarmaLine,
  ledgerCodexRowLine,
} from "../../src/ui/ledger-codex";
import { partyMemberLine } from "../../src/ui/party-roster";
import { LEDGER_CODEX_CATALOG } from "../../src/content/ledger-codex";
import { PARTY } from "../../src/content/party";
import { BOUNDS } from "../../src/content/bounds";
import type { PartyMemberView } from "../../src/logic/party-roster";
import type { Stats } from "../../src/logic/combat/types";

const WIDE_STATS: Stats = {
  hp: 9999,
  ap: 999,
  pow: 99,
  foc: 99,
  def: 99,
  wrd: 99,
  spd: 99,
  lck: 99,
};

/**
 * Build a member view for the fit guard (only name/level/hp/ap/shard drive the line).
 * @param name - The member's display name.
 * @param shard - The equipped shard's display name, or null.
 * @returns The member view.
 */
function memberView(name: string, shard: string | null): PartyMemberView {
  return {
    id: "wren",
    name,
    level: 88,
    hp: WIDE_STATS.hp,
    ap: WIDE_STATS.ap,
    stats: WIDE_STATS,
    shard,
    signature: [],
  };
}

describe("estimateMenuLineRows", () => {
  it("counts an empty line as one row", () => {
    expect(estimateMenuLineRows("", 100, 7)).toBe(1);
  });

  it("keeps a short line on one row and wraps a long line onto more", () => {
    const inner = menuPanelInnerWidth();
    expect(estimateMenuLineRows("Karma +0 (Balanced)", inner, 7)).toBe(1);
    const long = "word ".repeat(80).trim();
    expect(estimateMenuLineRows(long, inner, 7)).toBeGreaterThan(1);
  });
});

describe("codex row fit guard (#265)", () => {
  it("every authored recorded codex line fits the codex row budget", () => {
    for (const entry of LEDGER_CODEX_CATALOG) {
      const line = ledgerCodexRowLine({
        id: entry.id,
        flag: entry.flag,
        title: entry.title,
        recorded: true,
        line: entry.recordedLine,
      });
      expect(
        codexRowLineFits(line),
        `recorded line overflows ${MAX_CODEX_ROWS} rows: ${line}`
      ).toBe(true);
    }
  });

  it("every authored pending codex line fits the codex row budget", () => {
    for (const entry of LEDGER_CODEX_CATALOG) {
      const line = ledgerCodexRowLine({
        id: entry.id,
        flag: entry.flag,
        title: entry.title,
        recorded: false,
        line: null,
      });
      expect(codexRowLineFits(line), `pending line overflows: ${line}`).toBe(
        true
      );
    }
  });

  it("the compact karma header fits the codex row budget at wide values", () => {
    const line = formatCodexKarmaLine({
      karma: -9999,
      freeChoices: 999,
      wieldChoices: 999,
    });
    expect(codexRowLineFits(line), `karma header overflows: ${line}`).toBe(
      true
    );
  });
});

describe("party member line fit guard (#265)", () => {
  it("every authored roster member fits — carrying no shard or any bound", () => {
    const shardNames = Object.values(BOUNDS).map(bound => bound.name);
    for (const def of Object.values(PARTY)) {
      for (const shard of [null, ...shardNames]) {
        const line = partyMemberLine(memberView(def.name, shard));
        expect(
          partyMemberLineFits(line),
          `party line overflows ${MAX_PARTY_ROWS} rows: ${line}`
        ).toBe(true);
      }
    }
  });

  it("uses a party wrap width narrower than the full body (portrait inset)", () => {
    expect(partyLineWrapWidth()).toBeLessThan(menuPanelInnerWidth());
  });
});
