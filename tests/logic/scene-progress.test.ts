/**
 * Unit coverage for the pure scene-progress **write-through** projection
 * (`src/logic/save/scene-progress`): the Phaser-free twin of the `SaveService` write
 * the Dialogue scene performs when its cursor folds a moral-ledger flag (#223). Proves
 * `foldSceneProgress` sets `scene.flags` from a live narrative cursor, MERGES over the
 * flags a save already carries (so a later beat never drops an earlier one — the
 * Reckoning/reunion flags survive a dialogue write), overwrites a re-recorded flag,
 * seeds `scene` on a fresh (`scene: null`) save, and mutates neither input. Exercised
 * without a DOM or IndexedDB under vitest, mirroring the `save-data` suites.
 */
import { describe, expect, it } from "vitest";

import {
  foldSceneProgress,
  freshSave,
  type CurrentSave,
  type SceneProgress,
} from "../../src/logic/save";

const CH1_SCENE = "ch1-the-delivery";
const CH1_REVEAL = "cargo-opens";
const MILL_SCENE = "side-mill-rendered";
const MILL_OUTCOME = "outcome";
const SABLE_REVEALED = "sable-revealed";
const MILL_RENDERED = "mill-rendered";
const SABLE_LOST = "sable-lost";

/** A live Ch.1 reveal cursor with the `sable-revealed` flag folded. */
const CH1_PROGRESS: SceneProgress = {
  sceneId: CH1_SCENE,
  nodeId: CH1_REVEAL,
  flags: { [SABLE_REVEALED]: true },
};

/** A live mill render-outcome cursor with the `mill-rendered` choice folded. */
const MILL_PROGRESS: SceneProgress = {
  sceneId: MILL_SCENE,
  nodeId: MILL_OUTCOME,
  flags: { [MILL_RENDERED]: "render" },
};

/**
 * A save whose scene already carries a prior beat's flags (e.g. the Reckoning's).
 * @param flags - The scene flags the save already holds.
 * @returns A current-version save carrying those scene flags.
 */
function saveWithFlags(
  flags: Readonly<Record<string, boolean | string | number>>
): CurrentSave {
  const base = freshSave();
  return {
    ...base,
    scene: { sceneId: "ashfall", nodeId: "node-0", flags },
  };
}

describe("foldSceneProgress — dialogue-scene write-through (#223)", () => {
  it("seeds scene + flags on a fresh (scene: null) save", () => {
    const base = freshSave();
    expect(base.scene).toBeNull();

    const next = foldSceneProgress(base, CH1_PROGRESS);

    expect(next.scene).not.toBeNull();
    expect(next.scene?.sceneId).toBe(CH1_SCENE);
    expect(next.scene?.nodeId).toBe(CH1_REVEAL);
    expect(next.scene?.flags).toEqual({ [SABLE_REVEALED]: true });
  });

  it("MERGES over the flags a save already carries — no earlier beat is dropped", () => {
    const prior = saveWithFlags({ [SABLE_LOST]: true });

    const next = foldSceneProgress(prior, MILL_PROGRESS);

    // The Reckoning flag survives the dialogue write; the mill flag is added.
    expect(next.scene?.flags).toEqual({
      [SABLE_LOST]: true,
      [MILL_RENDERED]: "render",
    });
    // The cursor advances to the beat being recorded.
    expect(next.scene?.sceneId).toBe(MILL_SCENE);
    expect(next.scene?.nodeId).toBe(MILL_OUTCOME);
  });

  it("overwrites only its own prior value on a re-record", () => {
    const prior = saveWithFlags({ [MILL_RENDERED]: "render", keep: 7 });

    const next = foldSceneProgress(prior, {
      sceneId: "side-mill-spared",
      nodeId: MILL_OUTCOME,
      flags: { [MILL_RENDERED]: "spare" },
    });

    expect(next.scene?.flags).toEqual({ [MILL_RENDERED]: "spare", keep: 7 });
  });

  it("mutates neither the input save nor its flag ledger", () => {
    const prior = saveWithFlags({ [SABLE_LOST]: true });
    const priorFlagsSnapshot = { ...prior.scene?.flags };

    const next = foldSceneProgress(prior, CH1_PROGRESS);

    expect(next).not.toBe(prior);
    expect(next.scene).not.toBe(prior.scene);
    expect(prior.scene?.flags).toEqual(priorFlagsSnapshot);
    expect(prior.scene?.flags).not.toHaveProperty(SABLE_REVEALED);
  });

  it("round-trips through JSON.stringify (serializable, no embedded behavior)", () => {
    const next = foldSceneProgress(freshSave(), MILL_PROGRESS);
    const roundTripped = JSON.parse(JSON.stringify(next)) as CurrentSave;
    expect(roundTripped.scene).toEqual(next.scene);
  });
});
