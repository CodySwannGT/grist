/**
 * Unit coverage for the pure **region-progress ledger** (`src/logic/world-map/progress`,
 * #241) — the persisted cleared-cursor + completion record that rides
 * `SaveDataV3.scene.flags` with no schema bump (the reunion precedent). ZERO Phaser
 * imports: a total function of its inputs, so the projection round-trips through the
 * scene-flag ledger deterministically. Exercised headless under vitest.
 */
import { describe, expect, it } from "vitest";

import { RegionIds } from "../../src/content";
import {
  emptyRegionProgress,
  isRegionCompleted,
  recordRegionProgress,
  regionProgressEntry,
  regionProgressFlags,
  regionProgressFromFlags,
} from "../../src/logic/world-map";

describe("region-progress — entries", () => {
  it("an untouched region reads a zero, un-completed entry", () => {
    const progress = emptyRegionProgress();
    expect(regionProgressEntry(progress, RegionIds.marrow)).toEqual({
      cleared: 0,
      completed: false,
    });
    expect(isRegionCompleted(progress, RegionIds.marrow)).toBe(false);
  });

  it("recording a partial cursor marks in-progress but not completed", () => {
    const progress = recordRegionProgress(
      emptyRegionProgress(),
      RegionIds.marrow,
      1,
      2
    );
    expect(regionProgressEntry(progress, RegionIds.marrow)).toEqual({
      cleared: 1,
      completed: false,
    });
    expect(isRegionCompleted(progress, RegionIds.marrow)).toBe(false);
  });

  it("recording the cursor at the playlist length completes the region", () => {
    const progress = recordRegionProgress(
      emptyRegionProgress(),
      RegionIds.marrow,
      2,
      2
    );
    expect(isRegionCompleted(progress, RegionIds.marrow)).toBe(true);
  });

  it("completion is sticky across a later shorter re-visit", () => {
    const done = recordRegionProgress(
      emptyRegionProgress(),
      RegionIds.wrack,
      2,
      2
    );
    // A later Ashfall re-visit records a smaller cursor against a shorter playlist;
    // the region must stay completed (an Act I clear is never un-recorded).
    const revisit = recordRegionProgress(done, RegionIds.wrack, 1, 2);
    expect(isRegionCompleted(revisit, RegionIds.wrack)).toBe(true);
  });

  it("recording never mutates the input ledger", () => {
    const before = emptyRegionProgress();
    recordRegionProgress(before, RegionIds.marrow, 1, 2);
    expect(before[RegionIds.marrow]).toBeUndefined();
  });
});

describe("region-progress — scene-flag round-trip", () => {
  it("projects only touched regions into namespaced flags", () => {
    const progress = recordRegionProgress(
      emptyRegionProgress(),
      RegionIds.marrow,
      1,
      2
    );
    const flags = regionProgressFlags(progress);
    expect(flags["region:marrow:cleared"]).toBe(1);
    expect(flags["region:marrow:done"]).toBe(false);
    // An untouched region contributes nothing.
    expect(flags["region:wrack:cleared"]).toBeUndefined();
  });

  it("round-trips a completed + in-progress ledger through the flags", () => {
    let progress = recordRegionProgress(
      emptyRegionProgress(),
      RegionIds.marrow,
      2,
      2
    );
    progress = recordRegionProgress(progress, RegionIds.upperVanta, 1, 2);
    const restored = regionProgressFromFlags(regionProgressFlags(progress));
    expect(isRegionCompleted(restored, RegionIds.marrow)).toBe(true);
    expect(regionProgressEntry(restored, RegionIds.upperVanta)).toEqual({
      cleared: 1,
      completed: false,
    });
  });

  it("ignores foreign flags and defaults malformed values", () => {
    const restored = regionProgressFromFlags({
      "reunion:cal": "completed",
      "region:marrow:cleared": "oops",
      "region:marrow:done": true,
    });
    expect(regionProgressEntry(restored, RegionIds.marrow)).toEqual({
      cleared: 0,
      completed: true,
    });
    expect(restored[RegionIds.wrack]).toBeUndefined();
  });
});
