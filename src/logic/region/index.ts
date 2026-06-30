/**
 * Public surface of the pure per-region framework — the boot/runtime harness (#137)
 * that boots a {@link RegionDef}-authored region into a deterministic, scene-agnostic
 * session the `__VERIFY__` bridge drives with `scene()` / `state()` / `act()` /
 * `hash()`, plus the per-region Bound-site template (#135) that anchors a region's
 * single Bound site and wires it through the Phase-2 free-vs-wield kit. Engine-free
 * and unit-testable, with zero Phaser, zero I/O, and only the seeded RNG. The bridge
 * cells (`uat/region-harness-cell`, `uat/bound-site-cell`) and the region scene
 * pipeline import from here. Re-export only — all logic lives in the per-concern
 * modules (`./region-runtime`, `./bound-site`).
 * @module logic/region
 */
export {
  actRegion,
  bootRegion,
  hashRegionRun,
  regionScene,
  RegionActionKinds,
  RegionPhases,
  type RegionAction,
  type RegionRunState,
} from "./region-runtime";
export {
  boundSiteShard,
  chooseAtBoundSite,
  hashBoundSite,
  isBoundSiteSettled,
  openBoundSite,
  type BoundSiteSession,
} from "./bound-site";
