/**
 * Typed wrapper over the Phaser scene registry for the slice run-state — the
 * cross-scene storage the Field↔Battle leg uses to carry the {@link RunState}
 * (grist wallet, shards, pending choice) and the last consumed {@link BattleResult}
 * between scene transitions (locked decision 5: global state goes through a typed
 * registry wrapper, never ad-hoc `registry.get`/`set` with raw string keys). The
 * registry is the single store shared across every scene; this wrapper is the only
 * code that reads/writes these keys, so a typo is impossible and the stored shapes
 * are typed. It holds storage, not rules — the run reducer (`logic/run-state`) owns
 * the transitions.
 * @module services/run-store
 */
import type Phaser from "phaser";
import { newRunState, type RunState } from "../logic/run-state";
import { type BattleResult } from "../logic/battle-result";
import { type FieldState } from "../logic/field";

/** The single registry data manager the wrapper reads/writes. */
type Registry = Phaser.Data.DataManager;

/** Typed registry keys — the only place these strings are written. */
const RunKeys = {
  run: "grist:run-state",
  lastResult: "grist:last-battle-result",
  fieldState: "grist:field-state",
} as const;

/**
 * Read the current run-state from the registry, lazily seeding a fresh run on
 * first access so callers never see `undefined`. The fresh run is written back so
 * subsequent reads (and the Battle scene) observe the same instance.
 * @param registry - The scene registry (`this.registry`).
 * @returns The current run state.
 */
export function getRunState(registry: Registry): RunState {
  const existing = registry.get(RunKeys.run) as RunState | undefined;
  if (existing) {
    return existing;
  }
  const fresh = newRunState();
  registry.set(RunKeys.run, fresh);
  return fresh;
}

/**
 * Persist the run-state to the registry.
 * @param registry - The scene registry.
 * @param run - The run state to store.
 * @returns void
 */
export function setRunState(registry: Registry, run: RunState): void {
  registry.set(RunKeys.run, run);
}

/**
 * Record the result of the just-resolved battle so the Field can consume it on
 * return. The Battle scene writes this the instant the fight resolves; the Field
 * reads and clears it via {@link takeLastBattleResult}.
 * @param registry - The scene registry.
 * @param result - The consumable battle result.
 * @returns void
 */
export function setLastBattleResult(
  registry: Registry,
  result: BattleResult
): void {
  registry.set(RunKeys.lastResult, result);
}

/**
 * Read and clear the last battle result (one-shot): returns the result the Battle
 * scene stored on resolution, or null when none is pending. Clearing on read
 * means the Field consumes a given battle exactly once.
 * @param registry - The scene registry.
 * @returns The pending battle result, or null.
 */
export function takeLastBattleResult(registry: Registry): BattleResult | null {
  const result = registry.get(RunKeys.lastResult) as BattleResult | undefined;
  if (!result) {
    return null;
  }
  registry.remove(RunKeys.lastResult);
  return result;
}

/**
 * Stash the live, serializable {@link FieldState} so the Field can be restored
 * byte-for-byte after a battle round-trip — far more robust than re-deriving the
 * session from a seed. The Field writes this immediately before launching a
 * battle; it reads it back via {@link getFieldState} on a post-battle resume.
 * @param registry - The scene registry.
 * @param state - The field session state to stash.
 * @returns void
 */
export function setFieldState(registry: Registry, state: FieldState): void {
  registry.set(RunKeys.fieldState, state);
}

/**
 * Read the stashed field session state, or null when none is stored (a fresh
 * boot). The Field restores from this on a post-battle resume.
 * @param registry - The scene registry.
 * @returns The stashed field state, or null.
 */
export function getFieldState(registry: Registry): FieldState | null {
  return (registry.get(RunKeys.fieldState) as FieldState | undefined) ?? null;
}
