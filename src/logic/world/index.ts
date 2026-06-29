/**
 * Public surface of the pure world-state core. The {@link WorldState} flag, its
 * initial value, the idempotent Reckoning {@link reckon} flip, the `reach` /
 * `ashfall` predicates, and the {@link WorldStateResolver} read-through framework —
 * engine-free and unit-testable, with zero Phaser, zero I/O, and zero RNG. Region,
 * encounter, and economy code (and the save layer, which persists the flag) import
 * from here. Re-export only — all logic lives in `./world-state`.
 * @module logic/world
 */
export {
  INITIAL_WORLD_STATE,
  isAshfall,
  isReach,
  reckon,
  resolveByWorldState,
  type WorldState,
  type WorldStateResolver,
} from "./world-state";
