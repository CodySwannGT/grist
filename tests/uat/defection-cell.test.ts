/**
 * Unit coverage for the pure verification-bridge defection cell
 * (`src/uat/defection-cell.ts`, #146) — the in-memory holder the `__VERIFY__` bridge
 * owns so the Halcyon-defection e2e can drive the Ch.4 defection trigger and read the
 * active party roster scene-agnostically, the same way
 * {@link import("../../src/uat/requiem-hall-cell").RequiemHallCell} drives the Ch.4
 * set-piece. The cell only *composes* the shipped kit (the requiem-hall set-piece
 * #145 + the pure defection reducer); all rules live in `logic`. These assertions
 * exercise the open → play-to-truth → fire → read contract without a DOM or canvas so
 * they run under vitest; the in-game journey is the Playwright e2e twin. ZERO Phaser
 * imports by design.
 */
import { describe, expect, it } from "vitest";

import { PARTY } from "../../src/content";
import { freshSave } from "../../src/logic/save";
import type { CurrentSave } from "../../src/logic/save";
import { DefectionCell } from "../../src/uat/defection-cell";

/**
 * Build a {@link CurrentSave} whose persisted party is the given id/level pairs —
 * the raw DTO shape `loadSave()` returns (id + level only, no live stats/kit), used
 * to drive the cell's rehydration (`adopt`) the way the bridge does after a reload.
 * @param party - The persisted party members (id + level) to seed the save with.
 * @returns A fresh save carrying the given party.
 */
function saveWithParty(
  party: readonly { id: string; level: number }[]
): CurrentSave {
  return { ...freshSave(), party };
}

describe("DefectionCell — the fresh cell (starting party)", () => {
  it("opens reads the starting roster [wren, tobi] — Halcyon absent before firing", () => {
    const cell = new DefectionCell();
    const snapshot = cell.snapshot();
    expect(snapshot.roster.map(member => member.id)).toEqual(["wren", "tobi"]);
    expect(snapshot.halcyonJoined).toBe(false);
  });
});

describe("DefectionCell — the soft-gate (firing too early)", () => {
  it("firing before the requiem reaches truth does NOT add Halcyon", () => {
    const cell = new DefectionCell();
    // Open the requiem reachable but DO NOT play it to truth.
    cell.openRequiem();
    cell.fireDefection();
    expect(cell.snapshot().halcyonJoined).toBe(false);
    expect(cell.snapshot().roster).toHaveLength(2);
  });

  it("firing against a soft-gated (Velith un-attuned) requiem does NOT add Halcyon", () => {
    const cell = new DefectionCell();
    cell.openRequiem({ withVelith: false });
    cell.playRequiemToTruth();
    cell.fireDefection();
    expect(cell.snapshot().halcyonJoined).toBe(false);
  });
});

describe("DefectionCell — Halcyon joins once the truth is revealed (#146 — scenario 1)", () => {
  it("play-to-truth then fire adds Halcyon with her authored stat block + kit", () => {
    const cell = new DefectionCell();
    cell.openRequiem();
    cell.playRequiemToTruth();
    cell.fireDefection();
    const snapshot = cell.snapshot();
    expect(snapshot.halcyonJoined).toBe(true);
    expect(snapshot.roster.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "halcyon",
    ]);
    const halcyon = snapshot.roster.find(member => member.id === "halcyon")!;
    // The read surfaces her authored stat block + signature kit (so the e2e asserts
    // she joined with stats/kit, not just an id).
    expect(halcyon.baseStats).toEqual(PARTY.halcyon.baseStats);
    expect(halcyon.signatureKit).toEqual(PARTY.halcyon.signatureKit);
    expect(halcyon.level).toBe(PARTY.halcyon.level);
  });

  it("re-firing is idempotent — exactly one Halcyon", () => {
    const cell = new DefectionCell();
    cell.openRequiem();
    cell.playRequiemToTruth();
    cell.fireDefection();
    cell.fireDefection();
    expect(
      cell.snapshot().roster.filter(member => member.id === "halcyon")
    ).toHaveLength(1);
  });
});

describe("DefectionCell — persistence projection (#146 — scenario 2)", () => {
  it("projects the post-defection roster into a CurrentSave the save path persists", () => {
    const cell = new DefectionCell();
    cell.openRequiem();
    cell.playRequiemToTruth();
    cell.fireDefection();
    const save = cell.toSave();
    expect(save.party.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "halcyon",
    ]);
    const halcyon = save.party.find(member => member.id === "halcyon")!;
    expect(halcyon.level).toBe(PARTY.halcyon.level);
  });
});

describe("DefectionCell — rehydration from a persisted save (#146 — reload regression)", () => {
  it("adopt(save) rebuilds the held roster from save.party — Halcyon restored WITH her stats + kit", () => {
    const cell = new DefectionCell();
    // The raw persisted DTO carries only id + level (no live stat block / kit) — the
    // exact shape loadSave() returns. adopt() must resolve each id back into the live
    // PARTY entry so the snapshot surfaces her full stats + kit (the hydration path).
    cell.adopt(
      saveWithParty([
        { id: "wren", level: PARTY.wren.level },
        { id: "tobi", level: PARTY.tobi.level },
        { id: "halcyon", level: PARTY.halcyon.level },
      ])
    );
    const snapshot = cell.snapshot();
    expect(snapshot.halcyonJoined).toBe(true);
    expect(snapshot.roster.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "halcyon",
    ]);
    const halcyon = snapshot.roster.find(member => member.id === "halcyon")!;
    expect(halcyon.baseStats).toEqual(PARTY.halcyon.baseStats);
    expect(halcyon.signatureKit).toEqual(PARTY.halcyon.signatureKit);
    expect(halcyon.level).toBe(PARTY.halcyon.level);
  });

  it("adopt(save) preserves join order and ignores unknown ids defensively", () => {
    const cell = new DefectionCell();
    cell.adopt(
      saveWithParty([
        { id: "halcyon", level: PARTY.halcyon.level },
        { id: "ghost", level: 99 },
        { id: "wren", level: PARTY.wren.level },
      ])
    );
    // The unknown "ghost" id is dropped (not crashed on); the known ids keep order.
    expect(cell.snapshot().roster.map(member => member.id)).toEqual([
      "halcyon",
      "wren",
    ]);
  });

  it("reset() restores the fresh starting roster [wren, tobi] with Halcyon absent", () => {
    const cell = new DefectionCell();
    cell.adopt(
      saveWithParty([
        { id: "wren", level: PARTY.wren.level },
        { id: "tobi", level: PARTY.tobi.level },
        { id: "halcyon", level: PARTY.halcyon.level },
      ])
    );
    expect(cell.snapshot().halcyonJoined).toBe(true);
    cell.reset();
    const snapshot = cell.snapshot();
    expect(snapshot.roster.map(member => member.id)).toEqual(["wren", "tobi"]);
    expect(snapshot.halcyonJoined).toBe(false);
  });
});
