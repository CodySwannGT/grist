/**
 * The persisted-save → ending-standing seam (#244, composing #142). Asserts the pure
 * mapper that turns a run's {@link CurrentSave} into the {@link EndingStanding} the
 * ending gates read: the world-state, the {@link MoralLedger} karma + Free/Wield tally,
 * and the reunion count derived from the persisted scene flags. Zero Phaser — the same
 * save always yields the same standing. Twins the live Finale scene wiring headless.
 */
import { describe, expect, it } from "vitest";

import { freshSave } from "../../src/logic/save";
import {
  REUNION_COMPLETE_FLAG_PREFIX,
  reunionsCompletedFromFlags,
  resolveReachableEndings,
  standingFromSave,
} from "../../src/logic/narrative";

describe("reunionsCompletedFromFlags (#244)", () => {
  it("counts truthy flags under the reunion namespace, ignoring others", () => {
    expect(
      reunionsCompletedFromFlags({
        [`${REUNION_COMPLETE_FLAG_PREFIX}quietus`]: true,
        [`${REUNION_COMPLETE_FLAG_PREFIX}asch`]: "completed",
        "mill-rendered": "render", // an unrelated flag — not counted
        "sable-revealed": true,
      })
    ).toBe(2);
  });

  it("does not count a cleared reunion flag (falsy value)", () => {
    expect(
      reunionsCompletedFromFlags({
        [`${REUNION_COMPLETE_FLAG_PREFIX}quietus`]: false,
        [`${REUNION_COMPLETE_FLAG_PREFIX}asch`]: 0,
        [`${REUNION_COMPLETE_FLAG_PREFIX}cal`]: "",
      })
    ).toBe(0);
  });

  it("is zero on an empty flag record", () => {
    expect(reunionsCompletedFromFlags({})).toBe(0);
  });
});

describe("standingFromSave (#244)", () => {
  it("maps a fresh Act I save to a reach standing that reaches no endings", () => {
    const standing = standingFromSave(freshSave());
    expect(standing.worldState).toBe("reach");
    expect(standing.reunionsCompleted).toBe(0);
    expect(resolveReachableEndings(standing)).toEqual([]);
  });

  it("reads karma + reunion count from the persisted ledger and flags", () => {
    const save = {
      ...freshSave(),
      worldState: "ashfall" as const,
      moralLedger: { karma: 3, freeChoices: 4, wieldChoices: 0 },
      scene: {
        sceneId: "x",
        nodeId: "y",
        flags: {
          [`${REUNION_COMPLETE_FLAG_PREFIX}quietus`]: true,
          [`${REUNION_COMPLETE_FLAG_PREFIX}asch`]: true,
          [`${REUNION_COMPLETE_FLAG_PREFIX}cal`]: true,
        },
      },
    };
    const standing = standingFromSave(save);
    expect(standing.karma).toBe(3);
    expect(standing.wieldChoices).toBe(0);
    expect(standing.reunionsCompleted).toBe(3);
    // A near-pure, fully-gathered ashfall run unlocks every ending (incl. the hardest).
    expect(resolveReachableEndings(standing)).toEqual([
      "sunder",
      "wake",
      "third-way",
      "let-die",
    ]);
  });

  it("a neutral ashfall run reaches only the always-available Sundering default", () => {
    const save = { ...freshSave(), worldState: "ashfall" as const };
    expect(resolveReachableEndings(standingFromSave(save))).toEqual(["sunder"]);
  });
});
