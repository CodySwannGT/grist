/**
 * Unit coverage for the pure persistence core (`src/logic/save`): the versioned
 * {@link SaveDataV1} schema, the engine-free serialize/deserialize round-trip,
 * and the forward migration chain. These are the assertions the issue's
 * Validation Journey names ("unit cases assert SaveDataV1 serialize/deserialize
 * round-trips and the version/migration path"), exercised without a DOM or
 * IndexedDB so they run under vitest. The IndexedDB-touching `SaveService`
 * wrapper is verified separately by the e2e reload journey.
 */
import { describe, expect, it } from "vitest";

import {
  SAVE_VERSION,
  deserialize,
  freshSave,
  migrate,
  serialize,
  type SaveDataV1,
} from "../../src/logic/save";

/**
 * A fully-populated payload covering every persisted axis the Technical
 * Approach enumerates: party, grist, inventory, learned/learning, shard choice,
 * moralLedger, and the rng lineage. Mirrors the cross-slice state the producers
 * (#73/#74/#75) will populate; this sub-task only persists the shape.
 * @returns A fully-populated current-version save.
 */
function sampleSave(): SaveDataV1 {
  return {
    version: 1,
    party: [
      { id: "wren", level: 3, shard: "emberwisp", shardMode: "free" },
      { id: "tobi", level: 3, shardMode: "free" },
    ],
    grist: 42,
    inventory: [
      { id: "salvage-cache", qty: 1 },
      { id: "ember-shard", qty: 3 },
    ],
    learned: ["bind-wisp", "flurry"],
    learning: [{ spell: "cinder", progress: 0.5 }],
    choice: { resolved: true, shard: "marrow-bound", variant: "wield" },
    moralLedger: { karma: -2, freeChoices: 1, wieldChoices: 2 },
    rng: { seed: 1337, state: 987654321 },
  };
}

describe("SaveDataV1 — schema constants", () => {
  it("pins the current schema version at 1", () => {
    expect(SAVE_VERSION).toBe(1);
  });

  it("a fresh save carries the current version and empty cross-slice state", () => {
    const fresh = freshSave();
    expect(fresh.version).toBe(SAVE_VERSION);
    expect(fresh.party).toEqual([]);
    expect(fresh.inventory).toEqual([]);
    expect(fresh.learned).toEqual([]);
    expect(fresh.learning).toEqual([]);
    expect(fresh.choice.resolved).toBe(false);
  });
});

describe("SaveDataV1 — round-trip persistence (AC7)", () => {
  it("serialize → deserialize restores an exact deep-equal payload", () => {
    const save = sampleSave();
    const restored = deserialize(serialize(save));
    expect(restored).toEqual(save);
  });

  it("the serialized form is a stable JSON string", () => {
    const text = serialize(sampleSave());
    expect(typeof text).toBe("string");
    expect(JSON.parse(text).version).toBe(1);
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

describe("SaveDataV1 — the moral choice persists (AC5)", () => {
  it("the resolved shard variant + moralLedger survive a round-trip", () => {
    const save = sampleSave();
    const restored = deserialize(serialize(save));
    expect(restored?.choice).toEqual({
      resolved: true,
      shard: "marrow-bound",
      variant: "wield",
    });
    expect(restored?.moralLedger).toEqual({
      karma: -2,
      freeChoices: 1,
      wieldChoices: 2,
    });
  });

  it("a free-mode resolution round-trips its karma flag intact", () => {
    const save: SaveDataV1 = {
      ...sampleSave(),
      choice: { resolved: true, shard: "emberwisp", variant: "free" },
      moralLedger: { karma: 1, freeChoices: 3, wieldChoices: 0 },
    };
    const restored = deserialize(serialize(save));
    expect(restored?.choice.variant).toBe("free");
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
      deserialize(JSON.stringify({ version: 1, grist: "lots" }))
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
        { id: "wren", level: 3, shardMode: "free" },
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
          party: [{ id: "wren", level: 1.5 }],
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
    const save: SaveDataV1 = {
      ...sampleSave(),
      party: [{ id: "tobi", level: 3 }],
    };
    const restored = deserialize(serialize(save));
    expect(restored?.party).toEqual([{ id: "tobi", level: 3 }]);
    expect(restored?.party[0] && "shard" in restored.party[0]).toBe(false);
  });
});

describe("migrate — versioned with a migration path", () => {
  it("passes a current v1 payload through unchanged", () => {
    const save = sampleSave();
    expect(migrate(save)).toEqual(save);
  });

  it("migrates a pre-v1 (v0) shape forward to the current version", () => {
    // v0 is the hypothetical legacy shape: a flat blob with no choice/ledger.
    const v0 = {
      version: 0,
      party: [{ id: "wren", level: 3 }],
      grist: 10,
      seed: 7,
      rngState: 7,
    };
    const migrated = migrate(v0);
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(SAVE_VERSION);
    // forward-fill: the new axes get safe defaults, the carried data survives.
    expect(migrated?.grist).toBe(10);
    expect(migrated?.rng).toEqual({ seed: 7, state: 7 });
    expect(migrated?.choice.resolved).toBe(false);
    expect(migrated?.moralLedger.karma).toBe(0);
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
  });
});
