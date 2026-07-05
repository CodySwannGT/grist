/**
 * Public surface of the pure per-region framework — the boot/runtime harness (#137)
 * that boots a {@link RegionDef}-authored region into a deterministic, scene-agnostic
 * session the `__VERIFY__` bridge drives with `scene()` / `state()` / `act()` /
 * `hash()`, plus the per-region Bound-site template (#135) that anchors a region's
 * single Bound site and wires it through the Phase-2 free-vs-wield kit, the Ch.4
 * Sidhe requiem-hall set-piece (#145), and the Ch.5 Mourne keystone set-piece (#128 —
 * upper Vanta's Reckoning-trigger anchor, the region that cages no Bound). Engine-free
 * and unit-testable, with zero Phaser, zero I/O, and only the seeded RNG. The bridge
 * cells (`uat/region-harness-cell`, `uat/bound-site-cell`) and the region scene
 * pipeline import from here, plus the Ashfall transformed-map resolver (#139) that
 * folds the whole region catalog through one world-state flag (the "one map, two
 * states" aggregate). Re-export only — all logic lives in the per-concern modules
 * (`./region-runtime`, `./bound-site`, `./requiem-hall`, `./keystone`, `./world-map`).
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
export {
  hashRequiemHall,
  isRequiemHallComplete,
  isRequiemHallReachable,
  openRequiemHall,
  playRequiemHall,
  playRequiemHallToCompletion,
  RequiemHallPhases,
  type RequiemHallSession,
} from "./requiem-hall";
export {
  hashKeystone,
  isKeystoneComplete,
  isKeystoneReachable,
  keystoneTriggersReckoning,
  KEYSTONE_LOCATION,
  KeystonePhases,
  openKeystone,
  playKeystone,
  playKeystoneToCompletion,
  type KeystoneSession,
} from "./keystone";
export {
  hashWorldMap,
  resolveWorldMap,
  type MournedPlace,
  type WorldMap,
  type WorldMapPalette,
  type WorldMapRegion,
} from "./world-map";
