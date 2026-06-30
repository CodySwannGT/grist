/**
 * Unit coverage for the v3 persisted-save axes (#116): the character `build`
 * (bench stat augments + equipped shards — the "spend grist → change the build"
 * growth that must survive a reload into a later battle) and the `scene` progress
 * (the narrative cursor + serializable flag ledger, or `null` before any scene is
 * entered). Split from `save-data.test.ts` so each suite stays focused (and under
 * the file-length budget); the schema-constant, core round-trip, moral-choice,
 * and migration-chain coverage stays there. Exercised without a DOM or IndexedDB
 * so they run under vitest; the IndexedDB-touching `SaveService` wrapper and the
 * live reload are verified separately.
 */
import { describe, expect, it } from "vitest";

import { deserialize, serialize, type SaveDataV3 } from "../../src/logic/save";

// Shared fixture ids, hoisted so the repeated literals across the cases below do
// not trip the no-duplicate-string lint.
const WREN = "wren";
const MARROW_BOUND = "marrow-bound";
const FREE = "free";
const EMBERWISP = "emberwisp";

/**
 * A fully-populated current-version (v3) payload, mirroring the one in
 * `save-data.test.ts` but kept local so this suite stands alone. Carries a
 * non-trivial character build (a +2 SPD / +1 POW augment and an equipped shard)
 * and a mid-story scene cursor with a typed flag ledger.
 * @returns A fully-populated current-version save.
 */
function sampleSave(): SaveDataV3 {
  return {
    version: 3,
    party: [
      { id: WREN, level: 3, shard: EMBERWISP, shardMode: FREE },
      { id: "tobi", level: 3 },
    ],
    grist: 42,
    inventory: [
      { id: "salvage-cache", qty: 1 },
      { id: "ember-shard", qty: 3 },
    ],
    learned: ["bind-wisp", "flurry"],
    learning: [{ spell: "cinder", progress: 0.5 }],
    choice: { resolved: true, shard: MARROW_BOUND, variant: "wield" },
    moralLedger: { karma: -2, freeChoices: 1, wieldChoices: 2 },
    rng: { seed: 1337, state: 987654321 },
    worldState: "ashfall",
    build: { statBonuses: { spd: 2, pow: 1 }, equippedShards: [MARROW_BOUND] },
    scene: {
      sceneId: "ch1-marrow",
      nodeId: "node-7",
      flags: { metWren: true, shardChoice: "wield", visits: 3 },
    },
  };
}

describe("SaveDataV3 — the build persists (#116: growth survives a reload)", () => {
  it("round-trips the bench stat augments + equipped shards exactly", () => {
    const restored = deserialize(serialize(sampleSave()));
    expect(restored?.build).toEqual({
      statBonuses: { spd: 2, pow: 1 },
      equippedShards: [MARROW_BOUND],
    });
  });

  it("round-trips an empty build (a run that has not yet grown one)", () => {
    const save: SaveDataV3 = {
      ...sampleSave(),
      build: { statBonuses: {}, equippedShards: [] },
    };
    const restored = deserialize(serialize(save));
    expect(restored?.build).toEqual({ statBonuses: {}, equippedShards: [] });
  });

  it("the grown build is the value a later battle reads (growth persists AC)", () => {
    // The "Growth persists" AC: a build change made before a reload is exactly
    // what the post-reload run (and the battle it enters) loads — the bonus is
    // data, restored verbatim, never re-derived.
    const grown: SaveDataV3 = {
      ...sampleSave(),
      build: { statBonuses: { spd: 4 }, equippedShards: [EMBERWISP] },
    };
    const restored = deserialize(serialize(grown));
    expect(restored?.build.statBonuses.spd).toBe(4);
    expect(restored?.build.equippedShards).toEqual([EMBERWISP]);
  });
});

describe("SaveDataV3 — scene progress persists (#116)", () => {
  it("round-trips the scene cursor + flag ledger exactly", () => {
    const restored = deserialize(serialize(sampleSave()));
    expect(restored?.scene).toEqual({
      sceneId: "ch1-marrow",
      nodeId: "node-7",
      flags: { metWren: true, shardChoice: "wield", visits: 3 },
    });
  });

  it("round-trips a null scene (no narrative scene entered yet)", () => {
    const save: SaveDataV3 = { ...sampleSave(), scene: null };
    const restored = deserialize(serialize(save));
    expect(restored?.scene).toBeNull();
  });

  it("preserves every scene-flag primitive type through the round-trip", () => {
    const save: SaveDataV3 = {
      ...sampleSave(),
      scene: {
        sceneId: "s",
        nodeId: "n",
        flags: { aBool: false, aString: "tag", aNumber: 0 },
      },
    };
    const restored = deserialize(serialize(save));
    expect(restored?.scene?.flags).toEqual({
      aBool: false,
      aString: "tag",
      aNumber: 0,
    });
  });
});

describe("SaveDataV3 — build & scene corruption guarding (never crash-load)", () => {
  it("rejects a current-version payload missing the build axis", () => {
    // A raw v3-tagged blob with no `build` skipped the migration chain (which
    // forward-fills it) — corruption, not loaded with an absent build.
    const { build: _omit, ...withoutBuild } = sampleSave();
    expect(deserialize(JSON.stringify(withoutBuild))).toBeNull();
  });

  it("rejects a build whose statBonuses carries an unknown stat axis", () => {
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          build: { statBonuses: { spd: 2, bogus: 9 }, equippedShards: [] },
        })
      )
    ).toBeNull();
  });

  it("rejects a build with a non-finite stat bonus", () => {
    expect(
      deserialize('{"version":3,"build":{"statBonuses":{"spd":NaN}}}')
    ).toBeNull();
  });

  it("rejects a build whose equippedShards is not a string array", () => {
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          build: { statBonuses: {}, equippedShards: [1, 2] },
        })
      )
    ).toBeNull();
  });

  it("rejects a current-version payload missing the scene axis (not even null)", () => {
    // `scene` must be present (a literal `null` or a cursor object); an absent
    // key is a raw blob that skipped the migration chain's forward-fill.
    const { scene: _omit, ...withoutScene } = sampleSave();
    expect(deserialize(JSON.stringify(withoutScene))).toBeNull();
  });

  it("rejects a malformed (present, non-null) scene cursor", () => {
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          scene: { sceneId: "s" }, // missing nodeId + flags
        })
      )
    ).toBeNull();
  });

  it("rejects a scene flag that is not a primitive", () => {
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          scene: { sceneId: "s", nodeId: "n", flags: { bad: { nested: 1 } } },
        })
      )
    ).toBeNull();
  });
});
