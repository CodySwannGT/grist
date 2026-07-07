/**
 * Unit coverage for the pure **world-map entry list** (`src/logic/world-map-entries`,
 * #241) — the ordered selectable entries + their labels/details/ids derived from the
 * surface. ZERO Phaser, exercised headless.
 */
import { describe, expect, it } from "vitest";

import { RegionIds } from "../../src/content";
import {
  emptyRegionProgress,
  projectWorldMapSurface,
  recordRegionProgress,
} from "../../src/logic/world-map";
import {
  buildWorldMapEntries,
  worldMapEntryDetail,
  worldMapEntryId,
  worldMapEntryLabel,
} from "../../src/logic/world-map-entries";

describe("world-map entries — Act I", () => {
  it("lists regions, the Reckoning hook, then the sealed finale", () => {
    const surface = projectWorldMapSurface({
      worldState: "reach",
      progress: emptyRegionProgress(),
      currentRegion: RegionIds.marrow,
    });
    const entries = buildWorldMapEntries(surface);
    // 7 regions + Reckoning hook + the always-present finale entry (sealed in reach, #244).
    expect(entries).toHaveLength(9);
    expect(entries[0]?.kind).toBe("region");
    expect(entries[7]?.kind).toBe("reckoning");
    expect(worldMapEntryId(entries[7]!)).toBe("reckoning");
    const finale = entries[8]!;
    expect(finale.kind).toBe("finale");
    expect(worldMapEntryLabel(finale)).toContain("sealed");
    expect(worldMapEntryDetail(finale)).toContain("LOCKED");
  });

  it("labels a locked region and shows its cue as detail", () => {
    const surface = projectWorldMapSurface({
      worldState: "reach",
      progress: emptyRegionProgress(),
      currentRegion: null,
    });
    const entries = buildWorldMapEntries(surface);
    const sylvemarch = entries.find(
      e => e.kind === "region" && e.node.id === RegionIds.sylvemarch
    )!;
    expect(worldMapEntryLabel(sylvemarch)).toContain("LOCKED");
    expect(worldMapEntryDetail(sylvemarch)).toContain("Upper Vanta");
  });

  it("labels the current region with a here marker and cleared counts", () => {
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
    const marrow = buildWorldMapEntries(surface).find(
      e => e.kind === "region" && e.node.id === RegionIds.marrow
    )!;
    expect(worldMapEntryLabel(marrow)).toContain("here");
    expect(worldMapEntryDetail(marrow)).toContain("1/2");
  });
});

describe("world-map entries — Act II", () => {
  it("lists regions, reunions, then the finale", () => {
    const surface = projectWorldMapSurface({
      worldState: "ashfall",
      progress: emptyRegionProgress(),
      currentRegion: null,
    });
    const entries = buildWorldMapEntries(surface);
    expect(entries).toHaveLength(12); // 7 regions + 4 reunions + finale
    expect(entries.filter(e => e.kind === "reunion")).toHaveLength(4);
    expect(entries.at(-1)?.kind).toBe("finale");
    expect(worldMapEntryDetail(entries.at(-1)!)).toContain("Aurel");
  });
});
