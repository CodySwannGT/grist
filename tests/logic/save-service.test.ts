/**
 * Integration coverage for {@link SaveService} — the IndexedDB persistence
 * boundary — exercised under vitest against `fake-indexeddb`, an in-memory,
 * spec-compliant IndexedDB that drives the real `idb` wrapper the service uses
 * (no DOM, no real browser store). This proves the service's real save/load
 * path: an exact round-trip (AC7), the moral-choice persistence (AC5),
 * migration-on-load of an older payload, slot keying (decision 0008), and the
 * fail-safe behaviors (no save → fresh, corrupt save → fresh) — the same
 * guarantees the e2e reload journey confirms on the live build.
 *
 * A fresh `fake-indexeddb` is installed on `globalThis.indexedDB` before each
 * test so databases never leak between cases; the real `navigator.storage`
 * (absent under node) makes the service's durable-storage request a guarded
 * no-op, which is itself part of what is verified.
 */
// `fake-indexeddb/auto` installs the full IndexedDB surface (indexedDB,
// IDBRequest, IDBKeyRange, …) on the global, which the real `idb` wrapper the
// service uses depends on — a bare `globalThis.indexedDB` is not enough.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";

import {
  SAVE_VERSION,
  serialize,
  type CurrentSave,
} from "../../src/logic/save";
import { SaveService } from "../../src/services/save-service";

/** The default autosave slot id (must match `SaveService`'s DEFAULT_SLOT). */
const AUTOSAVE_SLOT = "current";
/** The object-store name `SaveService` writes to (must match its STORE_NAME). */
const STORE = "save";
/** The database name `SaveService` opens (must match its DB_NAME). */
const DB_NAME = "grist-save";
/** The store-layout version `SaveService` opens at (must match its DB_VERSION). */
const DB_VERSION = 1;

/** The shard id the sample save resolves its choice on and equips at the bench. */
const MARROW_BOUND = "marrow-bound";

/** Reset to a pristine in-memory IndexedDB so each test starts from empty stores. */
function installFreshIndexedDB(): void {
  Reflect.set(globalThis, "indexedDB", new IDBFactory());
}

/**
 * A fully-populated payload covering every persisted axis: party (with a shard
 * choice), grist, inventory, learned/learning, the resolved free-vs-wield
 * choice, the moral ledger, the rng lineage, the world-state flag, and — added
 * #116 — the character build (bench stat augments + equipped shards) and scene
 * progress (narrative cursor + flag ledger).
 * @returns A fully-populated current-version save.
 */
function sampleSave(): CurrentSave {
  return {
    version: SAVE_VERSION,
    party: [{ id: "wren", level: 3, shard: "emberwisp", shardMode: "free" }],
    grist: 42,
    inventory: [{ id: "ember-shard", qty: 3 }],
    learned: ["bind-wisp"],
    learning: [{ spell: "cinder", progress: 0.5 }],
    choice: { resolved: true, shard: MARROW_BOUND, variant: "wield" },
    moralLedger: { karma: -2, freeChoices: 1, wieldChoices: 2 },
    rng: { seed: 1337, state: 987654321 },
    worldState: "ashfall",
    build: { statBonuses: { spd: 2 }, equippedShards: [MARROW_BOUND] },
    scene: {
      sceneId: "ch1-marrow",
      nodeId: "node-7",
      flags: { metWren: true, shardChoice: "wield" },
    },
  };
}

beforeEach(() => installFreshIndexedDB());

describe("SaveService — IndexedDB round-trip (AC7)", () => {
  it("returns a fresh save when nothing is persisted", async () => {
    const fresh = await new SaveService().load();
    expect(fresh.version).toBe(SAVE_VERSION);
    expect(fresh.party).toEqual([]);
    expect(fresh.choice.resolved).toBe(false);
  });

  it("save then load (a reload) restores the exact payload from IndexedDB", async () => {
    const save = sampleSave();
    await new SaveService().save(save);
    // a second instance models the post-reload boot reading the same store.
    const restored = await new SaveService().load();
    expect(restored).toEqual(save);
  });

  it("the moral choice + ledger survive save and reload (AC5)", async () => {
    await new SaveService().save(sampleSave());
    const restored = await new SaveService().load();
    expect(restored.choice).toEqual({
      resolved: true,
      shard: MARROW_BOUND,
      variant: "wield",
    });
    expect(restored.moralLedger).toEqual({
      karma: -2,
      freeChoices: 1,
      wieldChoices: 2,
    });
  });

  it("restores the rng lineage verbatim (determinism across reload)", async () => {
    await new SaveService().save(sampleSave());
    const restored = await new SaveService().load();
    expect(restored.rng).toEqual({ seed: 1337, state: 987654321 });
  });

  it("has() reports presence and clear() removes the save", async () => {
    const service = new SaveService();
    expect(await service.has()).toBe(false);
    await service.save(sampleSave());
    expect(await service.has()).toBe(true);
    await service.clear();
    expect(await service.has()).toBe(false);
    expect((await service.load()).party).toEqual([]);
  });
});

describe("SaveService — slots (decision 0008: autosave + named slots)", () => {
  it("keeps named slots independent and enumerable", async () => {
    const service = new SaveService();
    const autosave = sampleSave();
    const manual = { ...sampleSave(), grist: 7 };
    await service.save(autosave); // default autosave slot
    await service.save(manual, "slot-1");
    expect((await service.load()).grist).toBe(42);
    expect((await service.load("slot-1")).grist).toBe(7);
    const slots = await service.slots();
    expect([...slots].sort((a, b) => a.localeCompare(b))).toEqual([
      "current",
      "slot-1",
    ]);
  });
});

describe("SaveService — migration on load", () => {
  it("migrates a stored older (v0) payload forward on read", async () => {
    // Seed the raw store directly with a legacy v0 blob, bypassing the service's
    // current-version serialize so the migration chain is what does the upgrade.
    const v0 = JSON.stringify({
      version: 0,
      party: [{ id: "wren", level: 3 }],
      grist: 10,
      seed: 7,
      rngState: 99,
    });
    await seedRawSave(AUTOSAVE_SLOT, v0);

    const restored = await new SaveService().load();
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.grist).toBe(10);
    expect(restored.rng).toEqual({ seed: 7, state: 99 });
    expect(restored.choice.resolved).toBe(false);
    // The full v0 → v1 → v2 → v3 chain forward-fills the world-state flag to
    // reach (and the v3 build/scene axes to their empty/null baseline).
    expect(restored.worldState).toBe("reach");
    expect(restored.build).toEqual({ statBonuses: {}, equippedShards: [] });
    expect(restored.scene).toBeNull();
  });
});

describe("SaveService — fail-safe loading (never crash)", () => {
  it("falls back to a fresh save on a corrupt stored payload", async () => {
    await seedRawSave(AUTOSAVE_SLOT, "not json {{{");
    const restored = await new SaveService().load();
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.party).toEqual([]);
  });

  it("the fresh fallback itself serializes cleanly (stable re-save)", async () => {
    await seedRawSave(AUTOSAVE_SLOT, "42");
    const restored = await new SaveService().load();
    expect(serialize(restored)).toContain(`"version":${SAVE_VERSION}`);
  });
});

describe("SaveService — open-failure retry (stability)", () => {
  it("does not poison the cached connection after a transient open failure", async () => {
    const service = new SaveService();

    // Stage a genuine transient open failure through the real `idb` path: a
    // higher-version DB already exists, so the service's lower-version `openDB`
    // rejects asynchronously with a VersionError (a real `onerror`, not a
    // synthetic synchronous throw) — exactly the kind of rejection `#open()`
    // must not memoize.
    const blocker = await openDB(DB_NAME, DB_VERSION + 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
    blocker.close();

    // First save hits the version conflict and must surface it (fail loud once),
    // and — critically — must NOT cache the rejected open promise.
    await expect(service.save(sampleSave())).rejects.toBeTruthy();

    // Clear the blocker so a clean open is now possible, then retry on the SAME
    // instance. Without the `.catch` reset in `#open()`, the rejected open
    // promise stays memoized and every later call fails for the page lifetime —
    // this round-trip would never succeed.
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    });

    await service.save(sampleSave());
    const restored = await service.load();
    expect(restored).toEqual(sampleSave());
  });
});

/**
 * Write a raw string into the save store under a slot, opening the DB the same
 * way the service does so the store exists. Lets a test plant a legacy/corrupt
 * payload the service must then handle on load.
 * @param slot - The slot id to write.
 * @param raw - The raw stored string.
 * @returns A promise that resolves once written.
 */
function seedRawSave(slot: string, raw: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("grist-save", 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(raw, slot);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}
