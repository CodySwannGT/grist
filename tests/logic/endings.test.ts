/**
 * Phaser-free unit coverage for the Act II ending-gate resolver + finale set-piece
 * (#142, PRD #43 — FR8 / AC6): the pure `logic/narrative/endings` gate table + resolve
 * rules and the `logic/narrative/finale` reachability / choice / digest. These are the
 * headless assertions the issue's Validation Journey names ("standing accumulation and
 * ending-gate evaluation in `src/logic`"), exercised without a DOM. The in-game
 * `__VERIFY__` gated-by-standing + finale journey is verified by the e2e suite
 * (`tests/e2e/act2-endings.spec.ts`). ZERO Phaser imports by design.
 *
 * Expected reachable sets are hardcoded known constants (not derived from the gate
 * thresholds under test), so a tuning edit is caught rather than silently mirrored, and
 * each threshold boundary is probed at *and* just-below to pin the gate edges.
 */
import { describe, expect, it } from "vitest";

import {
  ENDING_GATES,
  EndingIds,
  chooseEnding,
  hashFinale,
  isEndingReachable,
  resolveFinale,
  resolveReachableEndings,
  standingFromLedger,
  type EndingStanding,
} from "../../src/logic/narrative";

/**
 * A fully-specified standing, layered per-test to probe one axis at a time.
 * @param overrides - The standing axes to override on the neutral baseline.
 * @returns The layered {@link EndingStanding}.
 */
function standing(overrides: Partial<EndingStanding>): EndingStanding {
  return {
    worldState: "ashfall",
    karma: 0,
    freeChoices: 0,
    wieldChoices: 0,
    reunionsCompleted: 0,
    ...overrides,
  };
}

describe("ENDING_GATES — the four ending paths (content-as-data)", () => {
  it("authors exactly the four story endings, in resolve order", () => {
    expect(ENDING_GATES.map(gate => gate.id)).toEqual([
      "sunder",
      "wake",
      "third-way",
      "let-die",
    ]);
  });

  it("gives every gate a player-facing title", () => {
    for (const gate of ENDING_GATES) {
      expect(gate.title.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveReachableEndings — endings are Act II only", () => {
  it("reaches nothing before the Reckoning (Act I reach)", () => {
    expect(resolveReachableEndings(standing({ worldState: "reach" }))).toEqual(
      []
    );
  });

  it("even a maxed standing reaches nothing in reach", () => {
    const maxed = standing({
      worldState: "reach",
      karma: 9,
      freeChoices: 9,
      reunionsCompleted: 4,
    });
    expect(resolveReachableEndings(maxed)).toEqual([]);
  });
});

describe("resolveReachableEndings — gated by accumulated standing (ashfall)", () => {
  it("offers only the damning default (sunder) at neutral standing", () => {
    expect(resolveReachableEndings(standing({}))).toEqual(["sunder"]);
  });

  it("sunder is reachable unconditionally in ashfall (even fully corrupt)", () => {
    const corrupt = standing({ karma: -5, wieldChoices: 5 });
    expect(resolveReachableEndings(corrupt)).toEqual(["sunder"]);
  });

  it("unlocks Wake once one reunion is completed (boundary at 1)", () => {
    expect(resolveReachableEndings(standing({ reunionsCompleted: 0 }))).toEqual(
      ["sunder"]
    );
    expect(resolveReachableEndings(standing({ reunionsCompleted: 1 }))).toEqual(
      ["sunder", "wake"]
    );
  });

  it("gates the Third Way on karma>=2 AND reunions>=2", () => {
    // karma just below the bar (1) with the reunions met → no third-way
    expect(
      resolveReachableEndings(standing({ karma: 1, reunionsCompleted: 2 }))
    ).toEqual(["sunder", "wake"]);
    // both bars met → third-way opens
    expect(
      resolveReachableEndings(standing({ karma: 2, reunionsCompleted: 2 }))
    ).toEqual(["sunder", "wake", "third-way"]);
    // reunions just below (1) with karma met → no third-way
    expect(
      resolveReachableEndings(standing({ karma: 2, reunionsCompleted: 1 }))
    ).toEqual(["sunder", "wake"]);
  });

  it("gates Let-It-Die on karma>=3, zero Wield, AND reunions>=3", () => {
    const letDie = standing({
      karma: 3,
      freeChoices: 3,
      wieldChoices: 0,
      reunionsCompleted: 3,
    });
    expect(resolveReachableEndings(letDie)).toEqual([
      "sunder",
      "wake",
      "third-way",
      "let-die",
    ]);
  });

  it("one Wield carry slams the Let-It-Die purity gate shut", () => {
    const oneWield = standing({
      karma: 3,
      freeChoices: 4,
      wieldChoices: 1,
      reunionsCompleted: 3,
    });
    // karma still 3 and reunions still 3, but a single Wield carry gates let-die out
    expect(resolveReachableEndings(oneWield)).not.toContain("let-die");
    expect(resolveReachableEndings(oneWield)).toContain("third-way");
  });

  it("karma just below 3 gates Let-It-Die out but keeps the Third Way", () => {
    const almost = standing({
      karma: 2,
      wieldChoices: 0,
      reunionsCompleted: 3,
    });
    expect(resolveReachableEndings(almost)).toEqual([
      "sunder",
      "wake",
      "third-way",
    ]);
  });

  it("reunions just below 3 gates Let-It-Die out", () => {
    const almost = standing({
      karma: 3,
      wieldChoices: 0,
      reunionsCompleted: 2,
    });
    expect(resolveReachableEndings(almost)).not.toContain("let-die");
  });
});

describe("isEndingReachable — single-ending probe", () => {
  it("agrees with the resolved set", () => {
    const s = standing({ reunionsCompleted: 1 });
    expect(isEndingReachable(s, EndingIds.wake)).toBe(true);
    expect(isEndingReachable(s, EndingIds.letDie)).toBe(false);
  });

  it("returns false for an unknown ending id rather than throwing", () => {
    expect(isEndingReachable(standing({}), "oblivion" as never)).toBe(false);
  });
});

describe("standingFromLedger — maps persisted run state into the gate input", () => {
  it("lifts karma + tally from the moral ledger and the reunion count", () => {
    const s = standingFromLedger(
      "ashfall",
      { karma: 2, freeChoices: 3, wieldChoices: 1 },
      2
    );
    expect(s).toEqual({
      worldState: "ashfall",
      karma: 2,
      freeChoices: 3,
      wieldChoices: 1,
      reunionsCompleted: 2,
    });
  });
});

describe("resolveFinale — Aurel's heart (the finale set-piece)", () => {
  it("enters no finale before the Reckoning (Act I reach)", () => {
    const finale = resolveFinale(standing({ worldState: "reach" }));
    expect(finale.atAurelsHeart).toBe(false);
    expect(finale.sallowConfronted).toBe(false);
    expect(finale.choirSongWhole).toBe(false);
    expect(finale.reachableEndings).toEqual([]);
  });

  it("reaches the heart in ashfall — Sallow confronted, Choir's Song heard whole", () => {
    const finale = resolveFinale(standing({ reunionsCompleted: 2, karma: 2 }));
    expect(finale.atAurelsHeart).toBe(true);
    expect(finale.sallowConfronted).toBe(true);
    expect(finale.choirSongWhole).toBe(true);
    expect(finale.reachableEndings).toEqual(["sunder", "wake", "third-way"]);
    expect(finale.chosenEnding).toBeNull();
  });
});

describe("chooseEnding — commit a reachable end", () => {
  it("commits an ending that the standing unlocked", () => {
    const finale = resolveFinale(standing({ reunionsCompleted: 1 }));
    expect(chooseEnding(finale, EndingIds.wake).chosenEnding).toBe("wake");
  });

  it("is a no-op (same object) for an ungated ending", () => {
    const finale = resolveFinale(standing({}));
    // let-die is not reachable at neutral standing
    expect(chooseEnding(finale, EndingIds.letDie)).toBe(finale);
  });

  it("cannot commit any ending before the heart is reached", () => {
    const finale = resolveFinale(standing({ worldState: "reach" }));
    expect(chooseEnding(finale, EndingIds.sunder)).toBe(finale);
  });
});

describe("hashFinale — the determinism digest", () => {
  it("is an 8-char hex digest", () => {
    expect(hashFinale(resolveFinale(standing({})))).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is identical for the same standing + choice", () => {
    const a = chooseEnding(
      resolveFinale(standing({ reunionsCompleted: 1 })),
      EndingIds.wake
    );
    const b = chooseEnding(
      resolveFinale(standing({ reunionsCompleted: 1 })),
      EndingIds.wake
    );
    expect(hashFinale(a)).toBe(hashFinale(b));
  });

  it("changes when the committed ending changes", () => {
    const base = resolveFinale(standing({ reunionsCompleted: 1 }));
    const wake = chooseEnding(base, EndingIds.wake);
    const sunder = chooseEnding(base, EndingIds.sunder);
    expect(hashFinale(wake)).not.toBe(hashFinale(sunder));
  });

  it("differs between an above-threshold and a below-threshold standing", () => {
    const gathered = hashFinale(
      resolveFinale(standing({ reunionsCompleted: 3, karma: 3 }))
    );
    const alone = hashFinale(resolveFinale(standing({})));
    expect(gathered).not.toBe(alone);
  });
});
