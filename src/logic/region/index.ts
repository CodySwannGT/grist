/**
 * Public surface of the pure per-region boot/runtime harness (#137) — the reusable
 * framework that boots a {@link RegionDef}-authored region into a deterministic,
 * scene-agnostic session the `__VERIFY__` bridge drives with
 * `scene()` / `state()` / `act()` / `hash()`. Engine-free and unit-testable, with
 * zero Phaser, zero I/O, and only the seeded RNG. The bridge cell
 * (`uat/region-harness-cell`) and the region scene pipeline import from here.
 * Re-export only — all logic lives in `./region-runtime`.
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
