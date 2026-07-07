/**
 * The pure **region-unlock progression** (#241, Scope-IN 2) — the gating table that
 * decides which regions the world-map travel front door offers as reachable, and how
 * every region grades LOCKED / AVAILABLE / IN PROGRESS / COMPLETE. This is the
 * connective tissue #239's dead-end audit found missing: the region runtime
 * (`logic/region`) and the region catalog (`content/region-catalog`) shipped, but
 * nothing decided the *order* the player earns them in.
 *
 * The order is Story #121's serial Act I sequence + the wiki's soft-gate rule
 * (`wiki/design/open-world.md` — "progress is gated by capability and knowledge, not
 * clocks"): the Vanta hub is the frontier the run opens on, and each later Reach
 * region opens when its predecessor's playlist is finished. Where the canon is
 * explicit the chain follows it; where it is silent (the exact slot of the Roots /
 * the Deep) a sensible default is chosen and disclosed (see {@link UNLOCK_PREDECESSOR}).
 * Once the Reckoning has turned the world to **ashfall** the whole map re-opens
 * (Act II is "more open and nonlinear" — `wiki/design/open-world.md`), so every
 * region is reachable in its mourned state.
 *
 * Pure: zero Phaser, no I/O, no RNG. A total function of the progress ledger + the
 * world-state flag, so the projection is deterministic and unit-testable headless.
 * @module logic/world-map/unlock
 */
import { REGIONS, RegionIds, type RegionId } from "../../content";
import { isAshfall, type WorldState } from "../world";
import { isRegionCompleted, type RegionProgress } from "./progress";

/**
 * A region's grade on the world map. `locked` — its predecessor is unfinished (a cue
 * names it); `available` — reachable but not yet entered; `in-progress` — its
 * playlist is partially cleared; `complete` — its playlist has been finished.
 */
export const RegionStatuses = {
  locked: "locked",
  available: "available",
  inProgress: "in-progress",
  complete: "complete",
} as const;

/** A region status (the literal-union of {@link RegionStatuses}). */
export type RegionStatus = (typeof RegionStatuses)[keyof typeof RegionStatuses];

/**
 * The regions reachable from the start of an Act I run — the Vanta hub frontier
 * (`wiki/design/regions.md`): the **Marrow** (home, the vertical-slice tutorial
 * region) and **upper Vanta** (the story frontier that carries the Ch.5 keystone,
 * "the first of Story #121's serial Act I regions"). Everything else is earned.
 */
const START_AVAILABLE_REGIONS: readonly RegionId[] = [
  RegionIds.marrow,
  RegionIds.upperVanta,
];

/**
 * The Act I unlock chain as a predecessor map: a region opens once the region named
 * here is completed. Story #121's serial order is **upper Vanta → Sylvemarch →
 * Holtspire → Cinderfen → Wrack**; the Roots / the Deep (#143) is canon-silent on its
 * exact gate, so it defaults to opening after the Marrow — the descent gesture, "the
 * fantasy heart *under* the city" (`wiki/design/regions.md`) reached by going deeper
 * from the undercity. A region absent from this map and from
 * {@link START_AVAILABLE_REGIONS} would be permanently locked (there is none today).
 */
const UNLOCK_PREDECESSOR: Readonly<Partial<Record<RegionId, RegionId>>> = {
  [RegionIds.roots]: RegionIds.marrow,
  [RegionIds.sylvemarch]: RegionIds.upperVanta,
  [RegionIds.holtspire]: RegionIds.sylvemarch,
  [RegionIds.cinderfen]: RegionIds.holtspire,
  [RegionIds.wrack]: RegionIds.cinderfen,
};

/**
 * The predecessor region that gates a region's Act I unlock, or null when the region
 * is available from the start. Pure reader over {@link UNLOCK_PREDECESSOR}.
 * @param id - The region to look up.
 * @returns The gating predecessor, or null for a start-available region.
 */
export function unlockPredecessor(id: RegionId): RegionId | null {
  return UNLOCK_PREDECESSOR[id] ?? null;
}

/**
 * Whether a region is reachable given the run's progress and the world-state. In Act
 * II **ashfall** every region re-opens (the map is nonlinear). In Act I **reach** a
 * region is reachable when it is start-available or its predecessor's playlist has
 * been completed. Pure — a total function of its inputs.
 * @param id - The region to test.
 * @param progress - The run's region-progress ledger.
 * @param worldState - The live world-state flag.
 * @returns True when the region is reachable.
 */
export function isRegionUnlocked(
  id: RegionId,
  progress: RegionProgress,
  worldState: WorldState
): boolean {
  if (isAshfall(worldState)) {
    return true;
  }
  if (START_AVAILABLE_REGIONS.includes(id)) {
    return true;
  }
  const predecessor = unlockPredecessor(id);
  return predecessor !== null && isRegionCompleted(progress, predecessor);
}

/**
 * Grade a region for the world map from the run's progress and the world-state:
 * `locked` when its predecessor is unfinished; otherwise `complete` when its playlist
 * is finished, `in-progress` when partially cleared, else `available`. Pure.
 * @param id - The region to grade.
 * @param progress - The run's region-progress ledger.
 * @param worldState - The live world-state flag.
 * @returns The region's status.
 */
export function regionStatus(
  id: RegionId,
  progress: RegionProgress,
  worldState: WorldState
): RegionStatus {
  if (!isRegionUnlocked(id, progress, worldState)) {
    return RegionStatuses.locked;
  }
  if (isRegionCompleted(progress, id)) {
    return RegionStatuses.complete;
  }
  const entry = progress[id];
  if (entry !== undefined && entry.cleared > 0) {
    return RegionStatuses.inProgress;
  }
  return RegionStatuses.available;
}

/**
 * The player-facing unlock cue for a region — the one-line "why is this locked" text
 * the map shows on a LOCKED node. Names the predecessor region (its Act I *reach*
 * display name) so the player knows exactly what opens it; empty when the region is
 * not locked (start-available or already reachable). Pure.
 * @param id - The region to describe.
 * @param progress - The run's region-progress ledger.
 * @param worldState - The live world-state flag.
 * @returns The unlock cue text, or "" when the region is not locked.
 */
export function regionUnlockCue(
  id: RegionId,
  progress: RegionProgress,
  worldState: WorldState
): string {
  if (isRegionUnlocked(id, progress, worldState)) {
    return "";
  }
  const predecessor = unlockPredecessor(id);
  if (predecessor === null) {
    return "Locked";
  }
  return `Locked — finish ${REGIONS[predecessor].states.reach.name}`;
}
