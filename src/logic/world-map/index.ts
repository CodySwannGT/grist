/**
 * Public surface of the pure **world-map travel front door** logic (#241) — the
 * connective tissue that makes the authored regions, the Reckoning, and Act II
 * reachable in normal play. Engine-free and unit-testable, with zero Phaser, zero
 * I/O, and zero RNG:
 *
 * - `./progress` — the persisted region-progress ledger (cleared cursor + completion)
 *   that rides `SaveDataV3.scene.flags` with no schema bump (the reunion precedent).
 * - `./unlock` — the Act I unlock chain + the LOCKED / AVAILABLE / IN PROGRESS /
 *   COMPLETE grade and its locked cue.
 * - `./surface` — the whole world-map surface projection (regions graded + counted,
 *   the Reckoning hook, the Act II reunion frontier + finale entry) + its digest.
 * - `./travel-plan` — the grist fast-travel cost for selecting a region (reuses
 *   `logic/travel`).
 *
 * The World Map scene (`scenes/WorldMap`) and the bridge cell (`uat/world-map-surface-cell`)
 * import from here. Re-export only — all logic lives in the per-concern modules.
 * @module logic/world-map
 */
export {
  emptyRegionProgress,
  isRegionCompleted,
  recordRegionProgress,
  regionProgressEntry,
  regionProgressFlags,
  regionProgressFromFlags,
  type RegionProgress,
} from "./progress";
export {
  isRegionUnlocked,
  regionStatus,
  regionUnlockCue,
  unlockPredecessor,
  RegionStatuses,
} from "./unlock";
export {
  hashWorldMapSurface,
  projectWorldMapSurface,
  type FinaleEntry,
  type ReckoningHook,
  type ReunionNode,
  type WorldMapRegionNode,
  type WorldMapSurface,
} from "./surface";
export {
  isRegionDiscovered,
  planRegionTravel,
  TravelPlanKinds,
} from "./travel-plan";
