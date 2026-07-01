/**
 * Unit coverage for the persisted-save forward migration chain
 * (`src/logic/save/migrate`): a stored payload at any older schema version is
 * walked forward one step at a time (v0 → v1 → v2 → v3) and structurally
 * validated, so an older player's save is lifted forward — never dropped or
 * crash-loaded — when the shape evolves. Split from `save-data.test.ts` so each
 * suite stays focused (and under the file-length budget); the schema-constant,
 * round-trip, and corruption coverage stays there, the v3 build/scene axes live
 * in `save-data-v3.test.ts`. Exercised without a DOM or IndexedDB under vitest.
 */
import { describe, expect, it } from "vitest";

import {
  SAVE_VERSION,
  deserialize,
  migrate,
  type SaveDataV1,
  type SaveDataV2,
  type SaveDataV3,
} from "../../src/logic/save";

const WREN = "wren";
const MARROW_BOUND = "marrow-bound";
const FREE = "free";
const EMBERWISP = "emberwisp";

/**
 * A fully-populated current-version (v3) payload — the migration *target* shape
 * the older fixtures are derived from, so the v1/v2 sources can never drift apart
 * from the current schema.
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

/**
 * A v2 payload (no `build` / `scene`, `version: 2`) — the migration source the
 * v2→v3 step lifts forward. Derived from {@link sampleSave} so the fixtures never
 * drift.
 * @returns A fully-populated legacy v2 save.
 */
function sampleSaveV2(): SaveDataV2 {
  const { build: _build, scene: _scene, ...rest } = sampleSave();
  return { ...rest, version: 2 };
}

/**
 * A v1 payload (no `worldState`, `version: 1`) — the migration source the v1→v2
 * step lifts forward. Derived from {@link sampleSaveV2} so the fixtures never
 * drift.
 * @returns A fully-populated legacy v1 save.
 */
function sampleSaveV1(): SaveDataV1 {
  const { worldState: _drop, ...rest } = sampleSaveV2();
  return { ...rest, version: 1 };
}

describe("migrate — versioned with a migration path", () => {
  it("passes a current v3 payload through unchanged", () => {
    const save = sampleSave();
    expect(migrate(save)).toEqual(save);
  });

  it("migrates a v2 shape forward to v3, forward-filling an empty build + null scene and carrying every field verbatim", () => {
    const v2 = sampleSaveV2();
    const migrated = migrate(v2);
    expect(migrated?.version).toBe(SAVE_VERSION);
    // The two new axes forward-fill to their "nothing yet" baseline; every
    // carried field survives the lift verbatim (the v3 save is the v2 + build + scene).
    expect(migrated).toEqual({
      ...v2,
      version: 3,
      build: { statBonuses: {}, equippedShards: [] },
      scene: null,
    });
  });

  it("migrates a v1 shape all the way forward (v1 → v2 → v3), forward-filling world-state, build, and scene", () => {
    const v1 = sampleSaveV1();
    const migrated = migrate(v1);
    expect(migrated?.version).toBe(SAVE_VERSION);
    // v1 predates world-state, build, and scene; the full chain forward-fills all
    // three while carrying every original field verbatim.
    expect(migrated).toEqual({
      ...v1,
      version: 3,
      worldState: "reach",
      build: { statBonuses: {}, equippedShards: [] },
      scene: null,
    });
  });

  it("migrates a pre-v1 (v0) shape all the way forward (v0 → v1 → v2 → v3)", () => {
    // v0 is the hypothetical legacy shape: a flat blob with no choice/ledger.
    const v0 = {
      version: 0,
      party: [{ id: WREN, level: 3 }],
      grist: 10,
      seed: 7,
      rngState: 7,
    };
    const migrated = migrate(v0);
    expect(migrated?.version).toBe(SAVE_VERSION);
    expect(migrated?.version).toBe(3);
    // forward-fill: the new axes get safe defaults, the carried data survives, and
    // the full chain reaches v3 so world-state / build / scene forward-fill too.
    expect(migrated?.grist).toBe(10);
    expect(migrated?.rng).toEqual({ seed: 7, state: 7 });
    expect(migrated?.choice.resolved).toBe(false);
    expect(migrated?.moralLedger.karma).toBe(0);
    expect(migrated?.worldState).toBe("reach");
    expect(migrated?.build).toEqual({ statBonuses: {}, equippedShards: [] });
    expect(migrated?.scene).toBeNull();
  });

  it("returns null for a version newer than the runtime understands", () => {
    expect(migrate({ version: 999 })).toBeNull();
  });

  it("returns null for an un-versioned / non-object value", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate("nope")).toBeNull();
    expect(migrate({ grist: 5 })).toBeNull();
  });

  it("deserialize runs the migration chain for an older serialized save", () => {
    const v0Text = JSON.stringify({
      version: 0,
      party: [],
      grist: 3,
      seed: 1,
      rngState: 1,
    });
    const restored = deserialize(v0Text);
    expect(restored?.version).toBe(SAVE_VERSION);
    expect(restored?.grist).toBe(3);
    expect(restored?.worldState).toBe("reach");
    // The full chain reaches v3, so the build + scene axes forward-fill too.
    expect(restored?.build).toEqual({ statBonuses: {}, equippedShards: [] });
    expect(restored?.scene).toBeNull();
  });
});
