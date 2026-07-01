/**
 * Unit coverage for the pure persistence core (`src/logic/save`): the versioned
 * {@link SaveDataV2} schema (now carrying the world-state flag, #134), the
 * engine-free serialize/deserialize round-trip, and the forward migration chain
 * (v0 → v1 → v2). These are the assertions the issue's Validation Journey names
 * ("unit cases assert serialize/deserialize round-trips and the version/migration
 * path"), exercised without a DOM or IndexedDB so they run under vitest. The
 * IndexedDB-touching `SaveService` wrapper is verified separately by the e2e
 * reload journey.
 */
import { describe, expect, it } from "vitest";

import {
  SAVE_VERSION,
  deserialize,
  freshSave,
  serialize,
  type SaveDataV3,
} from "../../src/logic/save";

// Shared fixture ids, hoisted so the repeated literals across the corruption
// cases below don't trip the no-duplicate-string lint.
const WREN = "wren";
const MARROW_BOUND = "marrow-bound";
const FREE = "free";
const EMBERWISP = "emberwisp";

/**
 * A fully-populated current-version (v3) payload covering every persisted axis
 * the Technical Approach enumerates: party roster, grist, inventory,
 * learned/learning, shard choice, moralLedger, the rng lineage, the v2
 * world-state flag (#134), and — added this sub-task (#116) — the character
 * `build` (bench stat augments + equipped shards) and `scene` progress
 * (narrative cursor + flag ledger). Mirrors the cross-slice state the producers
 * populate; this sub-task adds the build + scene shapes.
 * @returns A fully-populated current-version save.
 */
function sampleSave(): SaveDataV3 {
  return {
    version: 3,
    party: [
      { id: WREN, level: 3, shard: EMBERWISP, shardMode: FREE },
      // An unequipped member: no shard and (per the shard/shardMode unit rule)
      // no orphan shardMode either — covers the absent-optional axis.
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
    // The character build (#116): a bench-bought stat augment and an equipped
    // shard — the "spend grist → change the build" growth that must survive a
    // reload and persist into a later battle.
    build: { statBonuses: { spd: 2, pow: 1 }, equippedShards: [MARROW_BOUND] },
    // Scene progress (#116): a non-trivial narrative cursor plus a serializable
    // flag ledger (the moral-ledger flag the AC names rides here too).
    scene: {
      sceneId: "ch1-marrow",
      nodeId: "node-7",
      flags: { metWren: true, shardChoice: "wield", visits: 3 },
    },
  };
}

describe("SaveDataV3 — schema constants", () => {
  it("pins the current schema version at 3", () => {
    expect(SAVE_VERSION).toBe(3);
  });

  it("a fresh save carries the current version, world-state reach, and empty cross-slice state", () => {
    const fresh = freshSave();
    expect(fresh.version).toBe(SAVE_VERSION);
    expect(fresh.version).toBe(3);
    expect(fresh.party).toEqual([]);
    expect(fresh.inventory).toEqual([]);
    expect(fresh.learned).toEqual([]);
    expect(fresh.learning).toEqual([]);
    expect(fresh.choice.resolved).toBe(false);
    // A new game begins before the Reckoning: Act I reach.
    expect(fresh.worldState).toBe("reach");
    // A new game has grown no build and entered no scene (#116).
    expect(fresh.build).toEqual({ statBonuses: {}, equippedShards: [] });
    expect(fresh.scene).toBeNull();
  });
});

describe("SaveDataV3 — round-trip persistence (AC7)", () => {
  it("serialize → deserialize restores an exact deep-equal payload", () => {
    const save = sampleSave();
    const restored = deserialize(serialize(save));
    expect(restored).toEqual(save);
  });

  it("the serialized form advertises the current version", () => {
    expect(JSON.parse(serialize(sampleSave())).version).toBe(3);
  });

  it("round-trips the world-state flag exactly in either Act", () => {
    const ashfall = deserialize(
      serialize({ ...sampleSave(), worldState: "ashfall" })
    );
    expect(ashfall?.worldState).toBe("ashfall");
    const reach = deserialize(
      serialize({ ...sampleSave(), worldState: "reach" })
    );
    expect(reach?.worldState).toBe("reach");
  });

  it("restores the rng lineage exactly (determinism: no regeneration)", () => {
    const save = sampleSave();
    const restored = deserialize(serialize(save));
    expect(restored?.rng).toEqual({ seed: 1337, state: 987654321 });
  });

  it("preserves nested party shard choice through the round-trip", () => {
    const restored = deserialize(serialize(sampleSave()));
    expect(restored?.party).toEqual(sampleSave().party);
  });
});

describe("SaveDataV3 — the moral choice persists (AC5)", () => {
  it("the resolved shard variant + moralLedger survive a round-trip", () => {
    const save = sampleSave();
    const restored = deserialize(serialize(save));
    expect(restored?.choice).toEqual({
      resolved: true,
      shard: MARROW_BOUND,
      variant: "wield",
    });
    expect(restored?.moralLedger).toEqual({
      karma: -2,
      freeChoices: 1,
      wieldChoices: 2,
    });
  });

  it("a free-mode resolution round-trips its karma flag intact", () => {
    const save: SaveDataV3 = {
      ...sampleSave(),
      choice: { resolved: true, shard: EMBERWISP, variant: FREE },
      moralLedger: { karma: 1, freeChoices: 3, wieldChoices: 0 },
    };
    const restored = deserialize(serialize(save));
    expect(restored?.choice.variant).toBe(FREE);
    expect(restored?.moralLedger.karma).toBe(1);
  });
});

describe("deserialize — corruption & guarding (never crash-load)", () => {
  it("returns null for non-JSON garbage", () => {
    expect(deserialize("not json {{{")).toBeNull();
  });

  it("returns null for a JSON value that is not an object", () => {
    expect(deserialize("42")).toBeNull();
    expect(deserialize("null")).toBeNull();
    expect(deserialize('"string"')).toBeNull();
  });

  it("returns null for an object missing the version discriminant", () => {
    expect(deserialize(JSON.stringify({ grist: 5 }))).toBeNull();
  });

  it("returns null for a structurally-invalid payload at the current version", () => {
    expect(
      deserialize(JSON.stringify({ version: 3, grist: "lots" }))
    ).toBeNull();
  });

  it("rejects a current-version payload with a missing or out-of-domain world-state flag", () => {
    // A raw v2-tagged blob with no worldState skipped the migration chain (which
    // forward-fills it); an out-of-domain flag is corruption — both rejected, not
    // loaded with an absent/invalid Act flag.
    const { worldState: _omit, ...withoutWorldState } = sampleSave();
    expect(deserialize(JSON.stringify(withoutWorldState))).toBeNull();
    expect(
      deserialize(JSON.stringify({ ...sampleSave(), worldState: "twilight" }))
    ).toBeNull();
  });

  it("returns null for a NaN / non-finite version discriminant", () => {
    // JSON has no NaN literal, so a hand-built string is the realistic shape.
    expect(deserialize('{"version": NaN, "grist": 1}')).toBeNull();
  });

  it("rejects the whole save when one party member is malformed (no silent trim)", () => {
    const save = {
      ...sampleSave(),
      party: [
        { id: WREN, level: 3, shardMode: FREE },
        { level: 2 }, // missing id → the collection is corrupt, not trimmed
      ],
    };
    expect(deserialize(JSON.stringify(save))).toBeNull();
  });

  it("rejects semantically out-of-range numbers the schema forbids", () => {
    // qty must be whole/non-negative, level a positive integer, progress in [0,1).
    expect(
      deserialize(
        JSON.stringify({ ...sampleSave(), inventory: [{ id: "x", qty: -1 }] })
      )
    ).toBeNull();
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          party: [{ id: WREN, level: 1.5 }],
        })
      )
    ).toBeNull();
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          learning: [{ spell: "cinder", progress: 1.2 }],
        })
      )
    ).toBeNull();
  });

  it("round-trips a member with an absent optional shard (omitted, not undefined)", () => {
    const save: SaveDataV3 = {
      ...sampleSave(),
      party: [{ id: "tobi", level: 3 }],
    };
    const restored = deserialize(serialize(save));
    expect(restored?.party).toEqual([{ id: "tobi", level: 3 }]);
    expect(restored?.party[0] && "shard" in restored.party[0]).toBe(false);
  });

  it("rejects a half-equipped party member: a shard without its shardMode", () => {
    // A shard and its carry mode are a unit; a shard with no mode is an
    // impossible equipment state, so the whole save is rejected, not loaded.
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          party: [{ id: WREN, level: 3, shard: "emberwisp" }],
        })
      )
    ).toBeNull();
  });

  it("rejects a half-equipped party member: a shardMode without its shard", () => {
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          party: [{ id: WREN, level: 3, shardMode: FREE }],
        })
      )
    ).toBeNull();
  });

  it("rejects a resolved choice missing its shard/variant", () => {
    // resolved iff shard+variant present: a resolved choice with no resolution
    // violates the schema contract (PRD #41 AC5) and must not load.
    expect(
      deserialize(
        JSON.stringify({ ...sampleSave(), choice: { resolved: true } })
      )
    ).toBeNull();
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          choice: { resolved: true, shard: MARROW_BOUND },
        })
      )
    ).toBeNull();
  });

  it("rejects an unresolved choice that still carries a shard/variant", () => {
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          choice: { resolved: false, shard: MARROW_BOUND, variant: "wield" },
        })
      )
    ).toBeNull();
  });

  it("accepts a correctly unresolved choice (no shard, no variant)", () => {
    const restored = deserialize(
      JSON.stringify({ ...sampleSave(), choice: { resolved: false } })
    );
    expect(restored?.choice).toEqual({ resolved: false });
  });

  it("rejects a moral ledger with a negative choice counter", () => {
    // freeChoices / wieldChoices are counts: negative, fractional, or NaN values
    // are corruption, not state.
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          moralLedger: { karma: 0, freeChoices: -1, wieldChoices: 2 },
        })
      )
    ).toBeNull();
  });

  it("rejects a moral ledger with a fractional choice counter", () => {
    expect(
      deserialize(
        JSON.stringify({
          ...sampleSave(),
          moralLedger: { karma: 0, freeChoices: 1, wieldChoices: 1.5 },
        })
      )
    ).toBeNull();
  });
});
