/**
 * Unit coverage for the pure learning-progression **write-through** projection
 * (`src/logic/save/learning`): the Phaser-free twin of the `SaveService` write the Bench
 * performs when the run's spell-learning commits (#264). Proves `foldLearning` sets
 * `learned` + `learning` from a live run's projected learning, preserves every OTHER
 * persisted field (grist, build, scene progress, party, world-state, choice, moral
 * ledger, and the determinism-critical rng lineage) verbatim, copies the run's arrays so
 * the save never aliases live state, and mutates neither input. Exercised without a DOM
 * or IndexedDB under vitest, mirroring the `run-economy` / `scene-progress` suites.
 */
import { describe, expect, it } from "vitest";

import {
  foldLearning,
  freshSave,
  type CurrentSave,
  type PersistedLearning,
} from "../../../src/logic/save";

/** A grown learning progression: one spell learned, one in progress at 50%. */
const GROWN_LEARNING: PersistedLearning = {
  learned: ["spark"],
  learning: [{ spell: "cinder", progress: 0.5 }],
};

/**
 * A save carrying non-learning progress a player would not want a learning write to
 * clobber: a spent-then-earned wallet, a grown build, a mid-story scene cursor + flags,
 * a party roster, a turned world, a resolved choice, a moral ledger, and a non-trivial
 * rng lineage.
 * @returns A current-version save with rich non-learning state.
 */
function saveWithProgress(): CurrentSave {
  return {
    ...freshSave(),
    grist: 42,
    build: { statBonuses: { spd: 2 }, equippedShards: ["marrow-bound"] },
    party: [{ id: "wren", level: 4 }],
    choice: { resolved: true, shard: "marrow-bound", variant: "wield" },
    moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
    rng: { seed: 12345, state: 987654321 },
    worldState: "ashfall",
    scene: { sceneId: "ch1", nodeId: "node-3", flags: { "sable-lost": true } },
  };
}

describe("foldLearning — learning-progression write-through (#264)", () => {
  it("sets the learned spell ids from the live run", () => {
    const next = foldLearning(freshSave(), GROWN_LEARNING);
    expect(next.learned).toEqual(["spark"]);
  });

  it("sets the in-progress learning entries from the live run", () => {
    const next = foldLearning(freshSave(), GROWN_LEARNING);
    expect(next.learning).toEqual([{ spell: "cinder", progress: 0.5 }]);
  });

  it("preserves every non-learning field verbatim (incl. the rng lineage)", () => {
    const save = saveWithProgress();
    const next = foldLearning(save, GROWN_LEARNING);
    expect(next.grist).toBe(save.grist);
    expect(next.build).toEqual(save.build);
    expect(next.party).toEqual(save.party);
    expect(next.choice).toEqual(save.choice);
    expect(next.moralLedger).toEqual(save.moralLedger);
    expect(next.worldState).toBe(save.worldState);
    expect(next.scene).toEqual(save.scene);
    expect(next.rng).toEqual(save.rng); // determinism-critical — never regenerated
  });

  it("copies the run's arrays so the save never aliases live learning state", () => {
    const next = foldLearning(freshSave(), GROWN_LEARNING);
    expect(next.learned).not.toBe(GROWN_LEARNING.learned);
    expect(next.learning).not.toBe(GROWN_LEARNING.learning);
    expect(next.learning[0]).not.toBe(GROWN_LEARNING.learning[0]);
  });

  it("mutates neither input", () => {
    const save = saveWithProgress();
    const frozenSave = Object.freeze({ ...save });
    const frozenLearning = Object.freeze({ ...GROWN_LEARNING });
    expect(() => foldLearning(frozenSave, frozenLearning)).not.toThrow();
    expect(save.learned).toEqual([]);
  });

  it("round-trips through JSON (plain serializable data)", () => {
    const next = foldLearning(saveWithProgress(), GROWN_LEARNING);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });

  it("replaces prior persisted learning wholesale — the run is authoritative", () => {
    const stale: CurrentSave = {
      ...freshSave(),
      learned: ["render"],
      learning: [{ spell: "unmake", progress: 0.9 }],
    };
    const next = foldLearning(stale, GROWN_LEARNING);
    expect(next.learned).toEqual(["spark"]);
    expect(next.learning).toEqual([{ spell: "cinder", progress: 0.5 }]);
  });
});
