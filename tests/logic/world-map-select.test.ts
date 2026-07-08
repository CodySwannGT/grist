/**
 * Unit coverage for the pure **world-map selection resolver**
 * (`src/logic/world-map-select`, #273) — the projection that maps a selected World Map
 * entry to the action the scene dispatches. The regression this locks: an Act II reunion
 * ("story") node must resolve to its OWN reunion surface, NEVER to a region travel (which
 * dumped the player on the reunion's already-cleared anchor region's summary). ZERO
 * Phaser, exercised headless.
 */
import { describe, expect, it } from "vitest";

import { RegionIds, ReunionIds } from "../../src/content";
import { projectWorldMapSurface } from "../../src/logic/world-map";
import { buildWorldMapEntries } from "../../src/logic/world-map-entries";
import { worldMapEntryAction } from "../../src/logic/world-map-select";

/**
 * Every region completed — the Act II fully-cleared board.
 * @returns A region-progress ledger with every region completed.
 */
function allComplete() {
  return Object.fromEntries(
    Object.values(RegionIds).map(id => [id, { cleared: 99, completed: true }])
  );
}

describe("world-map selection resolver (#273)", () => {
  it("resolves a reunion story-node to its OWN reunion action, not a region travel", () => {
    const surface = projectWorldMapSurface({
      worldState: "ashfall",
      progress: allComplete(),
      currentRegion: RegionIds.marrow,
    });
    const entries = buildWorldMapEntries(surface);
    const ghost = entries.find(
      e => e.kind === "reunion" && e.node.id === ReunionIds.quietus
    )!;
    const action = worldMapEntryAction(ghost);
    // The bug: this resolved to { kind: "region", regionId: "wrack" } → the Wrack's
    // already-complete summary. It must now resolve to the reunion's own surface.
    expect(action.kind).toBe("reunion");
    if (action.kind === "reunion") {
      expect(action.reunionId).toBe(ReunionIds.quietus);
    }
  });

  it("resolves the finale entry to a finale action that is enterable in ashfall", () => {
    const surface = projectWorldMapSurface({
      worldState: "ashfall",
      progress: allComplete(),
      currentRegion: RegionIds.marrow,
    });
    const entries = buildWorldMapEntries(surface);
    const finale = entries.find(e => e.kind === "finale")!;
    const action = worldMapEntryAction(finale);
    expect(action).toEqual({ kind: "finale", available: true });
  });

  it("resolves a region row to a region travel carrying its id and status", () => {
    const surface = projectWorldMapSurface({
      worldState: "reach",
      progress: {},
      currentRegion: RegionIds.marrow,
    });
    const entries = buildWorldMapEntries(surface);
    const marrow = entries.find(
      e => e.kind === "region" && e.node.id === RegionIds.marrow
    )!;
    const action = worldMapEntryAction(marrow);
    expect(action.kind).toBe("region");
    if (action.kind === "region") {
      expect(action.regionId).toBe(RegionIds.marrow);
    }
  });
});
