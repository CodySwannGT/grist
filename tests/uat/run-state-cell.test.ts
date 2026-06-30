/**
 * Unit coverage for the pure verification-bridge run-state cell
 * (`src/uat/run-state-cell.ts`, #88) — the in-memory holder the `__VERIFY__`
 * bridge owns so the slice e2e (#89) can read the **free-vs-wield choice +
 * moralLedger/karma**, the **learning progress**, and the **shared grist wallet**
 * scene-agnostically, seeded by the same `CurrentSave` payload `__VERIFY__.save`
 * adopts. The cell only *holds* the adopted save sub-shapes (it re-derives
 * nothing); these assertions exercise that holding/snapshot contract without a DOM
 * or canvas so they run under vitest. The in-game read journey is verified
 * end-to-end by the Playwright UAT suite. ZERO Phaser imports by design.
 */
import { describe, expect, it } from "vitest";

import type { CurrentSave } from "../../src/logic/save/types";
import { RunStateCell } from "../../src/uat/run-state-cell";
import { WalletCell } from "../../src/uat/wallet-cell";

// Hoisted so the shard id repeated across the payload + assertions below does not
// trip the no-duplicate-string lint.
const MARROW = "marrow-bound";

/**
 * A representative resolved-wield slice payload: a spent wallet, an in-progress
 * spell, learned spells, a resolved wield choice, and the matching moral ledger.
 * Mirrors the shape `__VERIFY__.save` carries (and the save-reload e2e seeds).
 * @returns A complete v3 save in a resolved-wield mid-run state.
 */
function wieldSave(): CurrentSave {
  return {
    version: 3,
    party: [{ id: "wren", level: 4, shard: MARROW, shardMode: "wield" }],
    grist: 7,
    inventory: [{ id: "salve", qty: 3 }],
    learned: ["cinder"],
    learning: [{ spell: "render", progress: 0.5 }],
    choice: { resolved: true, shard: MARROW, variant: "wield" },
    moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
    rng: { seed: 12345, state: 987654321 },
    worldState: "reach",
    build: { statBonuses: { spd: 2 }, equippedShards: [MARROW] },
    scene: null,
  };
}

describe("RunStateCell — the empty cell", () => {
  it("snapshots null before a save is adopted", () => {
    expect(new RunStateCell(new WalletCell()).snapshot()).toBeNull();
  });
});

describe("RunStateCell — adopting a save", () => {
  it("surfaces the choice + moralLedger + learning + wallet verbatim", () => {
    const cell = new RunStateCell(new WalletCell());
    cell.adopt(wieldSave());
    expect(cell.snapshot()).toEqual({
      choice: { resolved: true, shard: MARROW, variant: "wield" },
      moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
      learned: ["cinder"],
      learning: [{ spell: "render", progress: 0.5 }],
      grist: 7,
    });
  });
});

describe("RunStateCell — adopting a fresh / free-choice save", () => {
  it("reflects an unresolved choice and a neutral ledger", () => {
    const cell = new RunStateCell(new WalletCell());
    cell.adopt({
      ...wieldSave(),
      choice: { resolved: false },
      moralLedger: { karma: 0, freeChoices: 0, wieldChoices: 0 },
      learned: [],
      learning: [],
      grist: 0,
    });
    expect(cell.snapshot()).toEqual({
      choice: { resolved: false },
      moralLedger: { karma: 0, freeChoices: 0, wieldChoices: 0 },
      learned: [],
      learning: [],
      grist: 0,
    });
  });

  it("reflects a re-adopted payload (a later save overwrites the held one)", () => {
    const cell = new RunStateCell(new WalletCell());
    cell.adopt(wieldSave());
    cell.adopt({
      ...wieldSave(),
      choice: { resolved: true, shard: MARROW, variant: "free" },
      moralLedger: { karma: 1, freeChoices: 1, wieldChoices: 0 },
      grist: 3,
    });
    const snap = cell.snapshot();
    expect(snap?.choice).toEqual({
      resolved: true,
      shard: MARROW,
      variant: "free",
    });
    expect(snap?.moralLedger.karma).toBe(1);
    expect(snap?.grist).toBe(3);
  });
});
