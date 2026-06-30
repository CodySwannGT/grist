/**
 * The data-cell slice of the verification (UAT) bridge — the scene-agnostic
 * `window.__VERIFY__` entry points backed by the bridge-held *data* cells
 * (save / world-state / run-state / region-data / enemy-family), extracted from
 * `uat/bridge.ts` the same way the field / bench / dialogue / region-scene seams are
 * (keeping the bridge under its line budget). These cells hold pure test state — no
 * Phaser, no gameplay objects — so an e2e can persist + reload a save, flip the
 * world-state, and read a template-authored region / enemy-family scene-agnostically,
 * without a live scene attached.
 * @module uat/data-cell-api
 */
import { type CurrentSave } from "../logic/save";
import { type WorldState } from "../logic/world";
import { saveService } from "../services/save-service";
import { EnemyCell, type VerifyEnemyState } from "./enemy-cell";
import { RegionCell, type VerifyRegionState } from "./region-cell";
import { RunStateCell, type VerifyRunState } from "./run-state-cell";
import { WorldStateCell } from "./world-state-cell";

/**
 * The bridge-held world-state cell (#134): the world-state flag the e2e flips and
 * reads lives here in memory (flip + resolve semantics delegated to `logic/world`),
 * while the canonical flag still rides the persisted save. A module singleton — a
 * pure test seam, not gameplay state.
 */
const worldStateCell = new WorldStateCell();

/**
 * The bridge-held run-state cell (#88): the resolved free-vs-wield choice, the moral
 * ledger, the learning progression, and the shared grist wallet adopted from the
 * persisted save, so the slice e2e can read them scene-agnostically.
 */
const runStateCell = new RunStateCell();

/**
 * The bridge-held region cell (#133): a region authored against the `RegionDef`
 * template, read through the live world-state flag, so the region e2e can load a
 * region and observe its both-states variants scene-agnostically.
 */
const regionCell = new RegionCell();

/**
 * The bridge-held enemy-family cell (#138): a family authored against the
 * `EnemyFamilyDef` schema, read per-region through the live world-state flag, so the
 * enemy-family e2e can load a family and observe its Reach block warp to Ashfall.
 */
const enemyCell = new EnemyCell();

/**
 * Persist a {@link CurrentSave} through the real shared {@link saveService} (the
 * `__VERIFY__.save` driver). Adopts the payload's world-state and run-state into the
 * held cells first so the in-memory read paths (worldState / reckon / regionTone /
 * runState) stay consistent with what was written, then commits to IndexedDB.
 * Resolves false if persistence is unavailable.
 * @param save - The save payload to adopt and persist.
 * @returns True once the write commits, false on failure.
 */
async function persistSave(save: CurrentSave): Promise<boolean> {
  worldStateCell.adopt(save.worldState);
  runStateCell.adopt(save);
  try {
    await saveService.save(save);
    return true;
  } catch {
    return false;
  }
}

/** The data-cell slice of the verification API spread into `window.__VERIFY__`. */
export interface DataCellApi {
  /** Persist a {@link CurrentSave} to IndexedDB via the real save service. */
  readonly save: (save: CurrentSave) => Promise<boolean>;
  /** Restore the persisted save from IndexedDB (the post-reload read). */
  readonly loadSave: () => Promise<CurrentSave>;
  /** Whether a save record is present in IndexedDB. */
  readonly hasSave: () => Promise<boolean>;
  /** Delete the persisted save (reset between e2e runs). */
  readonly clearSave: () => Promise<void>;
  /** The bridge-held current world-state, or null if none has been adopted. */
  readonly worldState: () => WorldState | null;
  /** Apply the Reckoning flip to the bridge-held world-state (reach → ashfall). */
  readonly reckon: () => void;
  /** The region tone resolved through the live world-state flag, or null. */
  readonly regionTone: () => string | null;
  /** Load the canonical example region authored against the template. */
  readonly loadRegion: () => void;
  /** The loaded region resolved through the live world-state, or null. */
  readonly region: () => VerifyRegionState | null;
  /** Load the canonical example enemy family authored against the schema. */
  readonly loadEnemy: () => void;
  /** The loaded family's region block resolved through the live world-state, or null. */
  readonly enemy: () => VerifyEnemyState | null;
  /** The bundled run-state snapshot (choice + karma + learning + wallet), or null. */
  readonly runState: () => VerifyRunState | null;
}

/**
 * Build the data-cell slice of the verification API, bound to the module-singleton
 * data cells. Spread into `window.__VERIFY__` by the bridge so the save / world-state
 * / region-data / enemy-family entry points live next to the cells they drive — the
 * same `dialogueApi(...)` split that keeps `uat/bridge.ts` under its line budget. The
 * region/enemy reads resolve through the live world-state flag (default Act I `reach`
 * until a save adopts or `reckon()` flips one).
 * @returns The data-cell verification API slice.
 */
export function dataCellApi(): DataCellApi {
  return {
    save: (save: CurrentSave) => persistSave(save),
    loadSave: () => saveService.load(),
    hasSave: () => saveService.has(),
    clearSave: () => saveService.clear(),
    worldState: () => worldStateCell.read(),
    reckon: () => worldStateCell.reckon(),
    regionTone: () => worldStateCell.regionTone(),
    loadRegion: () => regionCell.load(),
    region: () => regionCell.snapshot(worldStateCell.read() ?? "reach"),
    loadEnemy: () => enemyCell.load(),
    enemy: () => enemyCell.snapshot(worldStateCell.read() ?? "reach"),
    runState: () => runStateCell.snapshot(),
  };
}
