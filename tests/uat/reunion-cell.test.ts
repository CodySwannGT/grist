/**
 * Unit coverage for the pure verification-bridge reunion cell
 * (`src/uat/reunion-cell.ts`, #140) — the in-memory holder the `__VERIFY__` bridge owns
 * so the Act II reunion e2e can drive the open, nonlinear, optional/missable reunion
 * quests and read the active party roster scene-agnostically, the same way
 * {@link import("../../src/uat/defection-cell").DefectionCell} drives Halcyon's Ch.4
 * defection. The cell only *composes* the shipped kit (the reunion catalog + the pure
 * reunion structure `logic/party/reunion`); all rules live in `logic`. These assertions
 * exercise the open → complete/bypass/advance → read → persist → rehydrate contract
 * without a DOM or canvas so they run under vitest; the in-game journey is the
 * Playwright e2e twin. ZERO Phaser imports by design.
 */
import { describe, expect, it } from "vitest";

import { PARTY } from "../../src/content";
import { freshSave } from "../../src/logic/save";
import type { CurrentSave } from "../../src/logic/save";
import { ReunionCell } from "../../src/uat/reunion-cell";

describe("ReunionCell — the fresh cell (starting party, untouched board)", () => {
  it("opens reachable in Ashfall with the starting roster and every reunion available", () => {
    const cell = new ReunionCell();
    const snapshot = cell.snapshot();
    expect(snapshot.roster.map(member => member.id)).toEqual(["wren", "tobi"]);
    expect(snapshot.reachable).toBe(true);
    expect(snapshot.statuses.quietus).toBe("available");
    expect(snapshot.statuses.shrike).toBe("available");
  });
});

describe("ReunionCell — the Ashfall soft-gate (completing too early)", () => {
  it("completing a reunion on a reach-gated board does NOT recruit anyone", () => {
    const cell = new ReunionCell();
    cell.open({ worldState: "reach" });
    cell.complete("quietus");
    const snapshot = cell.snapshot();
    expect(snapshot.reachable).toBe(false);
    expect(snapshot.roster.map(member => member.id)).toEqual(["wren", "tobi"]);
    expect(snapshot.statuses.quietus).toBe("available");
  });
});

describe("ReunionCell — completing a reunion recruits its companion (#140)", () => {
  it("complete('quietus') joins Quietus with her authored stat block + kit", () => {
    const cell = new ReunionCell();
    cell.open();
    cell.complete("quietus");
    const snapshot = cell.snapshot();
    expect(snapshot.roster.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "quietus",
    ]);
    const quietus = snapshot.roster.find(member => member.id === "quietus")!;
    expect(quietus.baseStats).toEqual(PARTY.quietus.baseStats);
    expect(quietus.signatureKit).toEqual(PARTY.quietus.signatureKit);
    expect(quietus.level).toBe(PARTY.quietus.level);
    expect(snapshot.statuses.quietus).toBe("completed");
  });

  it("re-completing is idempotent — exactly one Quietus", () => {
    const cell = new ReunionCell();
    cell.open();
    cell.complete("quietus");
    cell.complete("quietus");
    expect(
      cell.snapshot().roster.filter(member => member.id === "quietus")
    ).toHaveLength(1);
  });
});

describe("ReunionCell — optional/missable (#140 — the AC scenario)", () => {
  it("complete one, bypass another, advance — completed joins, bypassed missed, play proceeds", () => {
    const cell = new ReunionCell();
    cell.open();
    cell.complete("quietus");
    cell.bypass("asch");
    cell.advance();
    const snapshot = cell.snapshot();
    expect(snapshot.statuses.quietus).toBe("completed");
    expect(snapshot.statuses.asch).toBe("missed");
    expect(snapshot.statuses.cal).toBe("missed");
    expect(snapshot.statuses.shrike).toBe("missed");
    // Play proceeds: the roster scales to who was found (only Quietus joined).
    expect(snapshot.roster.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "quietus",
    ]);
  });
});

describe("ReunionCell — persistence projection (#140)", () => {
  it("projects the recruited roster into party and the statuses into scene flags", () => {
    const cell = new ReunionCell();
    cell.open();
    cell.complete("quietus");
    cell.bypass("asch");
    const save = cell.toSave();
    expect(save.party.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "quietus",
    ]);
    expect(save.worldState).toBe("ashfall");
    expect(save.scene?.flags["reunion:quietus"]).toBe("completed");
    expect(save.scene?.flags["reunion:asch"]).toBe("missed");
  });
});

describe("ReunionCell — rehydration from a persisted save (#140 — reload regression)", () => {
  /**
   * Build a {@link CurrentSave} carrying the given party and reunion-status flags — the
   * shape `loadSave()` returns, used to drive the cell's rehydration the way the bridge
   * does after a reload.
   * @param party - The persisted party (id + level).
   * @param flags - The persisted reunion-status scene flags.
   * @returns A fresh save carrying the party + reunion flags in Ashfall.
   */
  const savedReunion = (
    party: readonly { id: string; level: number }[],
    flags: Readonly<Record<string, string>>
  ): CurrentSave => ({
    ...freshSave(),
    party,
    worldState: "ashfall",
    scene: { sceneId: "act2-reunions", nodeId: "gathering-the-lost", flags },
  });

  it("adopt(save) restores the recruited roster AND the completed/missed statuses", () => {
    const cell = new ReunionCell();
    cell.adopt(
      savedReunion(
        [
          { id: "wren", level: PARTY.wren.level },
          { id: "tobi", level: PARTY.tobi.level },
          { id: "quietus", level: PARTY.quietus.level },
        ],
        { "reunion:quietus": "completed", "reunion:asch": "missed" }
      )
    );
    const snapshot = cell.snapshot();
    expect(snapshot.roster.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "quietus",
    ]);
    const quietus = snapshot.roster.find(member => member.id === "quietus")!;
    expect(quietus.baseStats).toEqual(PARTY.quietus.baseStats);
    expect(quietus.signatureKit).toEqual(PARTY.quietus.signatureKit);
    expect(snapshot.statuses.quietus).toBe("completed");
    expect(snapshot.statuses.asch).toBe("missed");
  });

  it("reset() restores the fresh starting roster with an untouched Ashfall board", () => {
    const cell = new ReunionCell();
    cell.open();
    cell.complete("quietus");
    expect(cell.snapshot().statuses.quietus).toBe("completed");
    cell.reset();
    const snapshot = cell.snapshot();
    expect(snapshot.roster.map(member => member.id)).toEqual(["wren", "tobi"]);
    expect(snapshot.statuses.quietus).toBe("available");
    expect(snapshot.reachable).toBe(true);
  });
});
