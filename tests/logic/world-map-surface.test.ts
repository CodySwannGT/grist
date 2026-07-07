/**
 * Unit coverage for the pure **world-map surface projection** (`src/logic/world-map/surface`,
 * #241, Scope-IN 1) — the graded region roster + the Act I Reckoning hook + the Act II
 * reunion frontier + finale entry, and its determinism digest. ZERO Phaser imports:
 * a total function of the world-state + progress, exercised headless.
 */
import { describe, expect, it } from "vitest";

import { RegionIds } from "../../src/content";
import {
  emptyRegionProgress,
  hashWorldMapSurface,
  projectWorldMapSurface,
  recordRegionProgress,
  RegionStatuses,
} from "../../src/logic/world-map";

describe("world-map surface — Act I reach", () => {
  it("grades every region and marks the current location", () => {
    const surface = projectWorldMapSurface({
      worldState: "reach",
      progress: emptyRegionProgress(),
      currentRegion: RegionIds.marrow,
    });
    expect(surface.regions).toHaveLength(7);
    const marrow = surface.regions.find(r => r.id === RegionIds.marrow);
    expect(marrow?.status).toBe(RegionStatuses.available);
    expect(marrow?.current).toBe(true);
    const sylvemarch = surface.regions.find(r => r.id === RegionIds.sylvemarch);
    expect(sylvemarch?.status).toBe(RegionStatuses.locked);
    expect(sylvemarch?.cue).not.toBe("");
  });

  it("surfaces the Reckoning hook, unavailable until upper Vanta completes", () => {
    const before = projectWorldMapSurface({
      worldState: "reach",
      progress: emptyRegionProgress(),
      currentRegion: null,
    });
    expect(before.reckoning?.available).toBe(false);
    expect(before.reunions).toHaveLength(0);
    expect(before.finale.available).toBe(false);

    const after = projectWorldMapSurface({
      worldState: "reach",
      progress: recordRegionProgress(
        emptyRegionProgress(),
        RegionIds.upperVanta,
        2,
        2
      ),
      currentRegion: null,
    });
    expect(after.reckoning?.available).toBe(true);
  });

  it("counts cleared/total from the live playlist", () => {
    const surface = projectWorldMapSurface({
      worldState: "reach",
      progress: recordRegionProgress(
        emptyRegionProgress(),
        RegionIds.marrow,
        1,
        2
      ),
      currentRegion: RegionIds.marrow,
    });
    const marrow = surface.regions.find(r => r.id === RegionIds.marrow);
    expect(marrow?.cleared).toBe(1);
    expect(marrow?.total).toBe(2);
    expect(marrow?.status).toBe(RegionStatuses.inProgress);
  });
});

describe("world-map surface — Act II ashfall", () => {
  it("drops the Reckoning hook and opens the reunion frontier + finale", () => {
    const surface = projectWorldMapSurface({
      worldState: "ashfall",
      progress: emptyRegionProgress(),
      currentRegion: null,
    });
    expect(surface.reckoning).toBeNull();
    expect(surface.reunions).toHaveLength(4);
    expect(surface.finale.available).toBe(true);
    // Every region re-opens (nonlinear Act II) — none locked.
    expect(surface.regions.every(r => r.status !== RegionStatuses.locked)).toBe(
      true
    );
    // The map reads ashfall everywhere (mourned).
    expect(surface.regions.every(r => r.tone === "ashen")).toBe(true);
  });

  it("anchors each reunion to its Ashfall region", () => {
    const surface = projectWorldMapSurface({
      worldState: "ashfall",
      progress: emptyRegionProgress(),
      currentRegion: null,
    });
    const cal = surface.reunions.find(r => r.id === "cal");
    expect(cal?.regionId).toBe(RegionIds.holtspire);
  });
});

describe("world-map surface — determinism", () => {
  it("the same inputs hash identically; a change diverges", () => {
    const input = {
      worldState: "reach" as const,
      progress: emptyRegionProgress(),
      currentRegion: RegionIds.marrow,
    };
    const a = hashWorldMapSurface(projectWorldMapSurface(input));
    const b = hashWorldMapSurface(projectWorldMapSurface(input));
    expect(a).toBe(b);
    const moved = hashWorldMapSurface(
      projectWorldMapSurface({ ...input, currentRegion: RegionIds.upperVanta })
    );
    expect(moved).not.toBe(a);
  });
});
