/**
 * `SaveService` — the persistence boundary for the slice. Owns the one place the
 * game touches **IndexedDB** (decision 0008): it reads and writes the versioned
 * {@link CurrentSave} payload so a run survives a page reload (PRD #41 FR9 / AC7,
 * and the persistence half of AC5). It is a thin byte-I/O shell over the pure,
 * engine-free core in `src/logic/save` — the schema, the
 * serialize/deserialize round-trip, and the forward migration chain all live
 * there and are unit-tested without a DOM; this service only turns those
 * payloads into stored bytes and back.
 *
 * IndexedDB is reached through the tiny **`idb`** promise wrapper (decision 0008:
 * "accessed through the tiny `idb` promise wrapper … behind the `SaveService`
 * abstraction"), which adapts IndexedDB's callback/`IDBRequest` API to
 * async/await with a typed schema — so this file stays small and stringly-typed
 * store access becomes compile-checked. Raw `localStorage` is never used for
 * saves (decisions 0007 / 0008); all IndexedDB access is isolated here so the
 * rest of the game — and the pure save logic — never sees a browser storage API.
 *
 * Safety: every read is total. A missing store, a corrupt or foreign payload, or
 * an IndexedDB error resolves to a {@link freshSave} rather than throwing, so a
 * bad save can never crash the boot. The migration chain (in the pure core) lifts
 * an older save forward on read; the rng lineage is restored verbatim, never
 * regenerated, so determinism survives the reload. A best-effort
 * `navigator.storage.persist()` request asks the browser not to evict saves under
 * storage pressure — losing a local-only playthrough — and is fully guarded so an
 * unsupporting or denying browser still saves (decision 0008).
 * @module services/save-service
 */
import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import {
  deserialize,
  freshSave,
  serialize,
  type CurrentSave,
} from "../logic/save";

/** The IndexedDB database name for the slice's save data. */
const DB_NAME = "grist-save";
/** The object-store name holding the save records, keyed by slot id. */
const STORE_NAME = "save";
/** The slot id the single active save (autosave) is stored under by default. */
const DEFAULT_SLOT = "current";
/**
 * The IndexedDB schema version — the *store layout* version, distinct from the
 * {@link CurrentSave} payload's `version`. Bump only when the object stores
 * themselves change (e.g. adding a store or an index); payload-shape evolution is
 * handled by the save migration chain, not here.
 */
const DB_VERSION = 1;

/**
 * The typed `idb` schema for the save database: one object store keyed by slot id
 * whose values are the serialized save JSON strings the pure core produces.
 * Typing the schema makes the store name and its key/value types compile-time
 * checked rather than stringly-typed at every call.
 */
interface SaveDbSchema extends DBSchema {
  /** Slot id → serialized {@link CurrentSave} JSON string. */
  [STORE_NAME]: {
    key: string;
    value: string;
  };
}

/**
 * Ask the browser to keep this origin's storage durable so saves are not evicted
 * under storage pressure. Best-effort and fully guarded: a browser without the
 * Storage API, or one that denies the request, is a no-op (never a throw) — so a
 * private-mode or older browser still saves, just without the durability hint.
 * @returns A promise resolving to whether storage is now persisted.
 */
async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    navigator.storage?.persist === undefined
  ) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Versioned save persistence over IndexedDB. Construct once at bootstrap (e.g. in
 * Boot) and pass the instance to whatever owns run state, or use the shared
 * {@link saveService}. The database is opened lazily on first use and the
 * connection is reused for subsequent calls.
 */
export class SaveService {
  /** The lazily-opened database connection, shared across calls. */
  #db: Promise<IDBPDatabase<SaveDbSchema>> | null = null;

  /** Whether durable storage has already been requested (request it once). */
  #persistRequested = false;

  /**
   * Open (and cache) the IndexedDB connection via `idb`, creating the object
   * store on first run or a store-layout upgrade. Caching the *promise* — not the
   * resolved DB — means concurrent early calls share one open.
   * @returns A promise for the open database.
   */
  #open(): Promise<IDBPDatabase<SaveDbSchema>> {
    this.#db ??= openDB<SaveDbSchema>(DB_NAME, DB_VERSION, {
      // Store-LAYOUT migrations live here, keyed off `oldVersion`. Today there is
      // one layout (v1: the single `save` store), so this only creates it. When
      // DB_VERSION is bumped for a layout change (a new store/index), extend this
      // with `if (oldVersion < n) { … }` branches — payload-SHAPE evolution is
      // handled by the save migration chain (logic/save/migrate), not here.
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
    return this.#db;
  }

  /**
   * Persist a save into a slot. The payload is serialized through the pure core
   * (which re-stamps the current schema `version`) and written under the slot
   * key, replacing any prior save there. On the first save it also requests
   * durable storage so the browser will not evict the playthrough. Resolves once
   * the write transaction commits.
   * @param save - The current-version save to persist.
   * @param slot - The target slot id (defaults to the autosave slot).
   * @returns A promise that resolves when the save is committed.
   */
  async save(save: CurrentSave, slot: string = DEFAULT_SLOT): Promise<void> {
    if (!this.#persistRequested) {
      this.#persistRequested = true;
      await requestPersistentStorage();
    }
    const db = await this.#open();
    await db.put(STORE_NAME, serialize(save), slot);
  }

  /**
   * Load the persisted save in a slot, restoring it exactly (AC7). Returns a
   * {@link freshSave} when no save exists, when the stored payload is corrupt or
   * from a version this runtime cannot recover, or when IndexedDB is unavailable
   * or errors — loading is total and never throws. A recognized older save is
   * migrated forward by the pure core before it is returned.
   * @param slot - The slot id to load (defaults to the autosave slot).
   * @returns A promise for the restored current-version save (never null).
   */
  async load(slot: string = DEFAULT_SLOT): Promise<CurrentSave> {
    const stored = await this.#readRaw(slot);
    if (typeof stored !== "string") {
      return freshSave();
    }
    return deserialize(stored) ?? freshSave();
  }

  /**
   * Whether a (syntactically present) save record exists in a slot. A bare
   * existence check for "continue vs new game" affordances — it does not validate
   * the payload; use {@link load} to actually restore.
   * @param slot - The slot id to check (defaults to the autosave slot).
   * @returns A promise that resolves true when a save record is present.
   */
  async has(slot: string = DEFAULT_SLOT): Promise<boolean> {
    return typeof (await this.#readRaw(slot)) === "string";
  }

  /**
   * Delete the persisted save in a slot (new game / reset). Resolves once the
   * delete transaction commits; a missing record is a no-op success.
   * @param slot - The slot id to clear (defaults to the autosave slot).
   * @returns A promise that resolves when the save is cleared.
   */
  async clear(slot: string = DEFAULT_SLOT): Promise<void> {
    const db = await this.#open();
    await db.delete(STORE_NAME, slot);
  }

  /**
   * List the slot ids that currently hold a save, in insertion order. Lets a
   * future save-slot UI enumerate saves without reading every payload (the UI
   * itself is out of scope for this issue, but the read is cheap and keeps the
   * service complete).
   * @returns A promise resolving to the occupied slot ids.
   */
  async slots(): Promise<readonly string[]> {
    try {
      const db = await this.#open();
      return await db.getAllKeys(STORE_NAME);
    } catch {
      return [];
    }
  }

  /**
   * Read the raw stored string for a slot, or `undefined` when absent or on any
   * IndexedDB failure (a failed read fails safe to "no save" so the caller falls
   * back to a fresh run rather than surfacing a storage error).
   * @param slot - The slot id to read.
   * @returns A promise for the raw stored string, or `undefined`.
   */
  async #readRaw(slot: string): Promise<string | undefined> {
    try {
      const db = await this.#open();
      const value = await db.get(STORE_NAME, slot);
      return typeof value === "string" ? value : undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * The shared {@link SaveService} instance for the app. A single service owns the
 * one IndexedDB connection; the verification bridge and the (future) autosave
 * hook use this rather than constructing their own, mirroring the single-instance
 * `eventsCenter` convention in `src/services/events`.
 */
export const saveService = new SaveService();
