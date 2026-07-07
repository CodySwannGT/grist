/**
 * Unit coverage for the pure **region-unlock progression** (`src/logic/world-map/unlock`,
 * #241, Scope-IN 2) — Story #121's serial Act I chain + the Ashfall re-open, and the
 * LOCKED / AVAILABLE / IN PROGRESS / COMPLETE grade with its locked cue. ZERO Phaser
 * imports: a total function of the progress ledger + world-state, exercised headless.
 */
import { describe, expect, it } from "vitest";

import { RegionIds } from "../../src/content";
import {
  emptyRegionProgress,
  isRegionUnlocked,
  recordRegionProgress,
  regionStatus,
  regionUnlockCue,
  unlockPredecessor,
  RegionStatuses,
  type RegionProgress,
} from "../../src/logic/world-map";

/**
 * Complete a region's 2-encounter Act I playlist in the ledger.
 * @param progress - The current progress ledger.
 * @param id - The region id to complete.
 * @returns The ledger with the region completed.
 */
function complete(progress: RegionProgress, id: string): RegionProgress {
  return recordRegionProgress(progress, id as never, 2, 2);
}

describe("region-unlock — Act I reach chain", () => {
  it("the Marrow and upper Vanta are available from the start", () => {
    const progress = emptyRegionProgress();
    expect(isRegionUnlocked(RegionIds.marrow, progress, "reach")).toBe(true);
    expect(isRegionUnlocked(RegionIds.upperVanta, progress, "reach")).toBe(
      true
    );
  });

  it("later Reach regions are locked until their predecessor completes", () => {
    const progress = emptyRegionProgress();
    expect(isRegionUnlocked(RegionIds.sylvemarch, progress, "reach")).toBe(
      false
    );
    expect(isRegionUnlocked(RegionIds.roots, progress, "reach")).toBe(false);
    const afterVanta = complete(progress, RegionIds.upperVanta);
    expect(isRegionUnlocked(RegionIds.sylvemarch, afterVanta, "reach")).toBe(
      true
    );
    // Holtspire still waits on Sylvemarch.
    expect(isRegionUnlocked(RegionIds.holtspire, afterVanta, "reach")).toBe(
      false
    );
  });

  it("the serial chain unlocks one region at a time", () => {
    let progress = emptyRegionProgress();
    progress = complete(progress, RegionIds.upperVanta);
    progress = complete(progress, RegionIds.sylvemarch);
    progress = complete(progress, RegionIds.holtspire);
    expect(isRegionUnlocked(RegionIds.cinderfen, progress, "reach")).toBe(true);
    expect(isRegionUnlocked(RegionIds.wrack, progress, "reach")).toBe(false);
    progress = complete(progress, RegionIds.cinderfen);
    expect(isRegionUnlocked(RegionIds.wrack, progress, "reach")).toBe(true);
  });

  it("the Roots opens after the Marrow (the descent default)", () => {
    expect(unlockPredecessor(RegionIds.roots)).toBe(RegionIds.marrow);
    const afterMarrow = complete(emptyRegionProgress(), RegionIds.marrow);
    expect(isRegionUnlocked(RegionIds.roots, afterMarrow, "reach")).toBe(true);
  });
});

describe("region-unlock — Act II ashfall re-open", () => {
  it("every region is reachable once the world has turned", () => {
    const progress = emptyRegionProgress();
    for (const id of Object.values(RegionIds)) {
      expect(isRegionUnlocked(id, progress, "ashfall")).toBe(true);
    }
  });
});

describe("region-unlock — status grade + cue", () => {
  it("grades locked / available / in-progress / complete", () => {
    let progress = emptyRegionProgress();
    expect(regionStatus(RegionIds.marrow, progress, "reach")).toBe(
      RegionStatuses.available
    );
    expect(regionStatus(RegionIds.sylvemarch, progress, "reach")).toBe(
      RegionStatuses.locked
    );
    progress = recordRegionProgress(progress, RegionIds.marrow, 1, 2);
    expect(regionStatus(RegionIds.marrow, progress, "reach")).toBe(
      RegionStatuses.inProgress
    );
    progress = recordRegionProgress(progress, RegionIds.marrow, 2, 2);
    expect(regionStatus(RegionIds.marrow, progress, "reach")).toBe(
      RegionStatuses.complete
    );
  });

  it("a locked region's cue names its gating predecessor", () => {
    const cue = regionUnlockCue(
      RegionIds.sylvemarch,
      emptyRegionProgress(),
      "reach"
    );
    expect(cue).toContain("Upper Vanta");
    // A reachable region has no cue.
    expect(
      regionUnlockCue(RegionIds.marrow, emptyRegionProgress(), "reach")
    ).toBe("");
  });
});
