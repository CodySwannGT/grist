/**
 * Public surface of the pure **traversal + fast-travel + soft-gate service** (#136).
 * The earned-freedom mobility chain (foot → skiff → airship → fast-travel), the
 * capability/knowledge soft-gate ({@link canTravel} / {@link canFastTravel}), the
 * grist-deducting {@link fastTravel} hop (drawing the single shared wallet from
 * `logic/grist`), and the determinism {@link hashTravel} digest — engine-free and
 * unit-testable, with zero Phaser, zero I/O, and zero RNG. The `__VERIFY__` bridge
 * cell and the travel scene pipeline import from here. Re-export only — all logic
 * lives in `./travel`.
 * @module logic/travel
 */
export {
  canFastTravel,
  canTravel,
  discoverSafehouse,
  fastTravel,
  hashTravel,
  newTravelState,
  TravelScopes,
  TravelTuning,
  TraversalTiers,
  unlockAirship,
  unlockSkiff,
  type FastTravelResult,
  type TravelScope,
  type TravelState,
  type TraversalTier,
} from "./travel";
