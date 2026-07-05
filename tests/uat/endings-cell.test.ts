/**
 * Unit coverage for the pure verification-bridge endings cell
 * (`src/uat/endings-cell.ts`, #142) — the in-memory holder the `__VERIFY__` bridge owns
 * so the Act II endings e2e can load a standing profile and read the reachable ending
 * set + finale at Aurel's heart scene-agnostically, the same way
 * {@link import("../../src/uat/reunion-cell").ReunionCell} drives the reunions. The cell
 * only *composes* the shipped kit (the pure `logic/narrative/endings` gate resolver +
 * `logic/narrative/finale` set-piece); all rules live in `logic`. These assertions
 * exercise the open (load profile) → read → choose → reset contract without a DOM so
 * they run under vitest; the in-game journey is the Playwright e2e twin. ZERO Phaser.
 */
import { describe, expect, it } from "vitest";

import { EndingsCell } from "../../src/uat/endings-cell";

describe("EndingsCell — the fresh cell (neutral standing, damning default only)", () => {
  it("reaches Aurel's heart in Ashfall with only the sunder default at neutral standing", () => {
    const cell = new EndingsCell();
    const snapshot = cell.snapshot();
    expect(snapshot.atAurelsHeart).toBe(true);
    expect(snapshot.sallowConfronted).toBe(true);
    expect(snapshot.choirSongWhole).toBe(true);
    expect(snapshot.reachableEndings).toEqual(["sunder"]);
    expect(snapshot.chosenEnding).toBeNull();
  });
});

describe("EndingsCell — gated by loaded standing", () => {
  it("reaches no ending and no finale in Act I reach", () => {
    const cell = new EndingsCell();
    cell.open({ worldState: "reach", karma: 5, reunionsCompleted: 4 });
    const snapshot = cell.snapshot();
    expect(snapshot.atAurelsHeart).toBe(false);
    expect(snapshot.reachableEndings).toEqual([]);
  });

  it("a gathered, merciful profile unlocks strictly more endings than a lone one", () => {
    const cell = new EndingsCell();
    cell.open({
      karma: 3,
      freeChoices: 3,
      wieldChoices: 0,
      reunionsCompleted: 3,
    });
    const gathered = cell.snapshot().reachableEndings;
    cell.open({});
    const alone = cell.snapshot().reachableEndings;
    expect(gathered).toEqual(["sunder", "wake", "third-way", "let-die"]);
    expect(alone).toEqual(["sunder"]);
    expect(gathered.length).toBeGreaterThan(alone.length);
  });
});

describe("EndingsCell — commit an ending", () => {
  it("commits a reachable ending and reflects it in the snapshot + digest", () => {
    const cell = new EndingsCell();
    cell.open({ reunionsCompleted: 1 });
    const before = cell.snapshot().hash;
    cell.choose("wake");
    const after = cell.snapshot();
    expect(after.chosenEnding).toBe("wake");
    expect(after.hash).not.toBe(before);
  });

  it("ignores an ungated ending (no commit, digest unchanged)", () => {
    const cell = new EndingsCell();
    cell.open({});
    const before = cell.snapshot();
    cell.choose("let-die");
    const after = cell.snapshot();
    expect(after.chosenEnding).toBeNull();
    expect(after.hash).toBe(before.hash);
  });
});

describe("EndingsCell — reset", () => {
  it("returns to the neutral damning-default floor", () => {
    const cell = new EndingsCell();
    cell.open({ karma: 3, wieldChoices: 0, reunionsCompleted: 3 });
    cell.choose("let-die");
    cell.reset();
    const snapshot = cell.snapshot();
    expect(snapshot.reachableEndings).toEqual(["sunder"]);
    expect(snapshot.chosenEnding).toBeNull();
  });
});
