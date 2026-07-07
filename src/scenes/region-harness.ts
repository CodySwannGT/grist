/**
 * The Region scene's harness-mode `?scene=region` query helpers (extracted from
 * `scenes/Region` so the scene stays under its line budget). These resolve which region
 * + world-state the dev/UAT harness boots, and the deliberately-broken region fixture
 * the boot-throw path uses. Player mode (#241, entered from the World Map) never uses
 * these — it reads its target from the launch payload.
 * @module scenes/region-harness
 */
import { REGIONS, RegionIds, authorRegion, type RegionDef } from "../content";
import { BoundIds } from "../content";
import { type WorldState } from "../logic/world";

/**
 * A deliberately-incomplete region (missing its `ashfall` variant) for the boot-throw
 * path — forced past the compiler with a cast so `?scene=region&region=broken` proves a
 * bad region is CAUGHT and fails the harness (AC scenario 2), not rendered.
 * @returns An incomplete region that `bootRegion` rejects.
 */
function brokenRegion(): RegionDef {
  return authorRegion({
    id: "broken",
    boundSite: BoundIds.marrowBound,
    states: {
      reach: {
        name: "Broken Reach",
        tone: "verdant",
        keyLocations: [{ id: "void", name: "Void" }],
        encounters: [],
        sideStories: [],
      },
    },
  } as unknown as RegionDef);
}

/**
 * Resolve which region to boot from the `?region=` query: the broken fixture for
 * `?region=broken`, else the registered region whose id matches, falling back to
 * `marrow`. Guarded for non-browser (test) contexts.
 * @returns The region to boot.
 */
export function requestedRegion(): RegionDef {
  if (typeof window === "undefined") {
    return REGIONS[RegionIds.marrow];
  }
  const requested = new URLSearchParams(window.location.search)
    .get("region")
    ?.toLowerCase();
  if (requested === "broken") {
    return brokenRegion();
  }
  const matched = Object.values(REGIONS).find(
    region => region.id.toLowerCase() === requested
  );
  return matched ?? REGIONS[RegionIds.marrow];
}

/**
 * Resolve the world-state to boot in from the `?world=` query: `ashfall` for
 * `?world=ashfall`, else `reach`. Guarded for non-browser (test) contexts.
 * @returns The world-state to boot in.
 */
export function requestedWorldState(): WorldState {
  if (typeof window === "undefined") {
    return "reach";
  }
  const requested = new URLSearchParams(window.location.search)
    .get("world")
    ?.toLowerCase();
  return requested === "ashfall" ? "ashfall" : "reach";
}
