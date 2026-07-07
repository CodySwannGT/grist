/**
 * The pure **region-progress model** (#241) — the persisted record of how far the
 * player has walked each region's encounter playlist, and which regions they have
 * finished. This is the state the world-map travel front door reads to grade every
 * region LOCKED / AVAILABLE / IN PROGRESS / COMPLETE (`./unlock`) and the state a
 * region run folds a battle win back into (a cleared encounter advances the cursor).
 *
 * It rides the existing save with **no schema change**: exactly like the Act II
 * reunion board (`logic/party/reunion` → `reunionStatusFlags` /
 * `reunionSessionFromFlags`), each region's progress projects into the
 * `SaveDataV3.scene.flags` primitive ledger under `region:<id>:cleared` (a number)
 * and `region:<id>:done` (a boolean), folded through the shipped
 * {@link import("../save").foldSceneProgress} merge reducer — so region completion
 * and partial progress survive a reload without a `SAVE_VERSION` bump or a migration.
 *
 * Pure: zero Phaser, no I/O, no RNG, no `Math.random` / `Date.now`. Every function is
 * a total map of its inputs, so the projection is deterministic and unit-testable
 * headless.
 * @module logic/world-map/progress
 */
import { RegionIds, type RegionId } from "../../content";
import { type SavedSceneFlag } from "../save/types";

/**
 * The persisted progress of a single region: how many encounters of its playlist the
 * player has cleared (the cursor), and whether the region's playlist has been
 * finished. `completed` is sticky — it stays true across a later re-visit in Act II
 * so an Act I clear is never un-recorded.
 */
interface RegionProgressEntry {
  /** The number of encounters cleared so far (the run cursor). */
  readonly cleared: number;
  /** Whether the region's playlist has been finished at least once. */
  readonly completed: boolean;
}

/** The per-region progress ledger — absent entries are untouched regions. */
export type RegionProgress = Readonly<
  Partial<Record<RegionId, RegionProgressEntry>>
>;

/** The scene-flag key prefix each region's persisted progress is stored under. */
const REGION_FLAG_PREFIX = "region:";
/** The scene-flag suffix for a region's cleared-count. */
const CLEARED_SUFFIX = ":cleared";
/** The scene-flag suffix for a region's completion boolean. */
const DONE_SUFFIX = ":done";

/**
 * The empty progress ledger — a fresh run with no region touched.
 * @returns An empty region-progress ledger.
 */
export function emptyRegionProgress(): RegionProgress {
  return {};
}

/**
 * Read one region's progress entry, defaulting an untouched region to a zero,
 * un-completed entry so a consumer never dereferences `undefined`. Pure.
 * @param progress - The progress ledger to read.
 * @param id - The region whose progress to read.
 * @returns The region's progress entry (a fresh zero entry when untouched).
 */
export function regionProgressEntry(
  progress: RegionProgress,
  id: RegionId
): RegionProgressEntry {
  return progress[id] ?? { cleared: 0, completed: false };
}

/**
 * Whether a region's playlist has been finished at least once — the predicate the
 * unlock chain gates a successor on. Pure.
 * @param progress - The progress ledger to read.
 * @param id - The region to check.
 * @returns True when the region is completed.
 */
export function isRegionCompleted(
  progress: RegionProgress,
  id: RegionId
): boolean {
  return regionProgressEntry(progress, id).completed;
}

/**
 * Record a region's live cursor into the ledger — the write a region run folds after
 * a battle win advances the cursor. `cleared` is the new cursor; `total` is the live
 * variant's playlist length, so the region flips `completed` the moment the cursor
 * reaches the end. `completed` is sticky: once a region has been finished, a later
 * partial re-visit (a shorter Ashfall playlist, say) never clears the flag. Pure —
 * returns a fresh ledger, mutates nothing.
 * @param progress - The current ledger (never mutated).
 * @param id - The region to record.
 * @param cleared - The region's live cursor (encounters cleared).
 * @param total - The live variant's playlist length.
 * @returns The next ledger with the region's progress recorded.
 */
export function recordRegionProgress(
  progress: RegionProgress,
  id: RegionId,
  cleared: number,
  total: number
): RegionProgress {
  const wasCompleted = regionProgressEntry(progress, id).completed;
  return {
    ...progress,
    [id]: {
      cleared,
      completed: wasCompleted || (total > 0 && cleared >= total),
    },
  };
}

/**
 * Project the progress ledger into the `SaveDataV3.scene.flags` primitive ledger —
 * the persistence seam (mirroring `reunionStatusFlags`), with no save-schema change.
 * Each touched region contributes a `region:<id>:cleared` number and a
 * `region:<id>:done` boolean; untouched regions contribute nothing. Pure.
 * @param progress - The progress ledger to project.
 * @returns The region-progress scene-flag fragment.
 */
export function regionProgressFlags(
  progress: RegionProgress
): Readonly<Record<string, SavedSceneFlag>> {
  return Object.values(RegionIds).reduce<Record<string, SavedSceneFlag>>(
    (acc, id) => {
      const entry = progress[id];
      if (entry === undefined) {
        return acc;
      }
      return {
        ...acc,
        [`${REGION_FLAG_PREFIX}${id}${CLEARED_SUFFIX}`]: entry.cleared,
        [`${REGION_FLAG_PREFIX}${id}${DONE_SUFFIX}`]: entry.completed,
      };
    },
    {}
  );
}

/**
 * Rebuild the progress ledger from a persisted scene-flag ledger — the restore seam
 * a reload uses so the world map surfaces the restored completed/in-progress statuses
 * rather than a fresh board (mirroring `reunionSessionFromFlags`). A region with
 * neither flag is left absent (untouched); a malformed flag defaults to the zero
 * value. Pure — reads nothing ambient.
 * @param flags - The persisted scene-flag ledger (may hold non-region flags too).
 * @returns The restored region-progress ledger.
 */
export function regionProgressFromFlags(
  flags: Readonly<Record<string, unknown>>
): RegionProgress {
  return Object.values(RegionIds).reduce<Record<RegionId, RegionProgressEntry>>(
    (acc, id) => {
      const clearedFlag = flags[`${REGION_FLAG_PREFIX}${id}${CLEARED_SUFFIX}`];
      const doneFlag = flags[`${REGION_FLAG_PREFIX}${id}${DONE_SUFFIX}`];
      if (clearedFlag === undefined && doneFlag === undefined) {
        return acc;
      }
      return {
        ...acc,
        [id]: {
          cleared: typeof clearedFlag === "number" ? clearedFlag : 0,
          completed: doneFlag === true,
        },
      };
    },
    {} as Record<RegionId, RegionProgressEntry>
  );
}
