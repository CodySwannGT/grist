/**
 * Unit coverage for the pure **region-travel plan** (`src/logic/world-map/travel-plan`,
 * #241, Scope-IN 3) — the fast-travel grist cost that reuses `logic/travel`: a first
 * journey is a free discovery leg, a return to a discovered region is the charged
 * fast-travel hop, priced against the wallet. ZERO Phaser imports, exercised headless.
 */
import { describe, expect, it } from "vitest";

import { RegionIds } from "../../src/content";
import { TravelTuning } from "../../src/logic/travel";
import {
  emptyRegionProgress,
  isRegionDiscovered,
  planRegionTravel,
  recordRegionProgress,
  TravelPlanKinds,
} from "../../src/logic/world-map";

describe("region-travel plan", () => {
  it("staying at the current region costs nothing", () => {
    const plan = planRegionTravel(
      RegionIds.marrow,
      RegionIds.marrow,
      emptyRegionProgress(),
      0
    );
    expect(plan.kind).toBe(TravelPlanKinds.stay);
    expect(plan.cost).toBe(0);
    expect(plan.affordable).toBe(true);
  });

  it("a first journey is a free discovery leg", () => {
    const plan = planRegionTravel(
      RegionIds.sylvemarch,
      RegionIds.marrow,
      emptyRegionProgress(),
      0
    );
    expect(plan.kind).toBe(TravelPlanKinds.discover);
    expect(plan.cost).toBe(0);
    expect(plan.affordable).toBe(true);
  });

  it("returning to a discovered region is the charged fast-travel hop", () => {
    const progress = recordRegionProgress(
      emptyRegionProgress(),
      RegionIds.sylvemarch,
      2,
      2
    );
    const rich = planRegionTravel(
      RegionIds.sylvemarch,
      RegionIds.marrow,
      progress,
      TravelTuning.fastTravelCost
    );
    expect(rich.kind).toBe(TravelPlanKinds.fastTravel);
    expect(rich.cost).toBe(TravelTuning.fastTravelCost);
    expect(rich.affordable).toBe(true);
    // Broke — the hop is reported unaffordable (never a hard gate; the caller decides).
    const broke = planRegionTravel(
      RegionIds.sylvemarch,
      RegionIds.marrow,
      progress,
      0
    );
    expect(broke.affordable).toBe(false);
  });

  it("derives discovery from progress + current location", () => {
    expect(
      isRegionDiscovered(
        RegionIds.marrow,
        RegionIds.marrow,
        emptyRegionProgress()
      )
    ).toBe(true);
    expect(
      isRegionDiscovered(
        RegionIds.wrack,
        RegionIds.marrow,
        emptyRegionProgress()
      )
    ).toBe(false);
  });
});
