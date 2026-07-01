/**
 * The character-build logic barrel (#116) — the pure helpers that turn a persisted
 * {@link import("../save/types").SavedBuild} (bench stat augments + equipped shards)
 * into the effective combat stats a later battle fields. Engine-free: no Phaser, no
 * RNG, no I/O.
 * @module logic/build
 */
export { applyStatBonuses } from "./apply";
