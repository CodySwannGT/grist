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
import { type RegionRunState } from "../logic/region";
import { type RegionId } from "../content";
import {
  foldLearning,
  foldRunEconomy,
  foldSceneProgress,
  type CurrentSave,
} from "../logic/save";
import { toPersistedLearning } from "../logic/spell-learning";
import {
  recordRegionProgress,
  regionProgressFlags,
  regionProgressFromFlags,
} from "../logic/world-map";
import { saveAutosave } from "./save-autosave";

/** The single registry data manager the wrapper reads/writes. */
type Registry = Phaser.Data.DataManager;

/** Typed registry keys — the only place these strings are written. */
const RunKeys = {
  run: "grist:run-state",
  lastResult: "grist:last-battle-result",
  fieldState: "grist:field-state",
  fieldView: "grist:field-view",
  regionSession: "grist:region-session",
  currentRegion: "grist:current-region",
} as const;

/**
 * The live region run + its return route (#241), stashed on the registry so a region
 * encounter's Battle round-trip restores the exact playlist cursor on return — the
 * region counterpart of {@link setFieldState}. `returnTo` is the World Map the region
 * exits back to.
 */
export interface RegionSession {
  /** The live region run state (playlist cursor, world-state, seeded RNG). */
  readonly run: RegionRunState;
  /** The World Map scene key the region returns to on exit. */
  readonly returnTo: string;
}

/**
 * Wren's adapter-level render position when the Field handed off to the pause menu
 * (#233). The pure {@link FieldState} deliberately does not model Wren's continuous
 * position *within* a room (it is render state, not sim state), so the pause round-
 * trip stashes it here to restore her exactly where she stood — unlike the post-
 * battle resume, which respawns her at the room entrance on purpose.
 */
export interface FieldViewSnapshot {
  /** Wren's logical (384×216) center X. */
  readonly x: number;
  /** Wren's logical (384×216) center Y. */
  readonly y: number;
  /** Wren's facing (a `BattlerDir` string), so her idle pose is restored too. */
  readonly facing: string;
}

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
 * Write a run's earned economy + learning progression THROUGH to the persisted save
 * (#235, #264) so they survive a reload and **Continue** restores them — the write side
 * of the wallet/build/learning persistence the owner decision requires (`runStateFromSave`
 * is the read side). Folds the run's grist wallet + bench build via the pure
 * {@link foldRunEconomy} projection AND its spell-learning progression via
 * {@link foldLearning} (#264: so an equipped shard's learning no longer resets on Continue,
 * which left the Bench reading "equipped (learning Cinder)" and "Cinder: not begun" at
 * once) — both into the loaded save, preserving scene progress, party, world-state, and the
 * rng lineage. The two folds compose in ONE mutation so the write is a single atomic
 * read-modify-write, never interleaving learning and economy against a stale snapshot.
 * Serialized behind
 * the shared {@link saveAutosave} queue — the ONE choke point every read-modify-write save
 * shares (#245) — so it never races the region-progress or world-turn write that lands in
 * the same beat (a region battle win credits grist AND advances the region cursor; before
 * the unified queue the region write, having loaded before this one committed, clobbered
 * the credited grist with the stale pre-win balance). Best-effort: a storage failure is
 * swallowed so it never breaks play — the live run still holds the economy for the session.
 * @param run - The live run whose economy + learning progression to persist.
 * @returns A promise that resolves once this write (after any queued ahead of it) is attempted.
 */
export function persistRunEconomy(run: RunState): Promise<void> {
  const learning = toPersistedLearning(run.learning);
  return saveAutosave.mutate(save =>
    foldLearning(
      foldRunEconomy(save, {
        grist: run.wallet.grist,
        statBonuses: run.statBonuses,
        equippedShards: run.equippedShards,
      }),
      learning
    )
  );
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

/**
 * Stash Wren's live render position (#233) so a pause-menu round-trip restores her
 * exactly where she stood. The Field writes this immediately before opening the
 * Menu; it reads and clears it via {@link takeFieldViewSnapshot} on the resume.
 * @param registry - The scene registry.
 * @param view - Wren's position + facing to stash.
 * @returns void
 */
export function setFieldViewSnapshot(
  registry: Registry,
  view: FieldViewSnapshot
): void {
  registry.set(RunKeys.fieldView, view);
}

/**
 * Read and clear the stashed Wren render position (one-shot): returns the snapshot
 * the Field stored before opening the pause menu, or null when none is pending.
 * Clearing on read means a menu return consumes it exactly once, so a later post-
 * battle resume never wrongly restores a stale pause position.
 * @param registry - The scene registry.
 * @returns The stashed snapshot, or null.
 */
export function takeFieldViewSnapshot(
  registry: Registry
): FieldViewSnapshot | null {
  const view = registry.get(RunKeys.fieldView) as FieldViewSnapshot | undefined;
  if (!view) {
    return null;
  }
  registry.remove(RunKeys.fieldView);
  return view;
}

/**
 * Stash the live region session (#241) so a region encounter's Battle round-trip
 * restores the exact playlist cursor on return — the region counterpart of
 * {@link setFieldState}. The Region scene writes this immediately before launching a
 * region encounter; it reads it back via {@link getRegionSession} on the post-battle
 * resume.
 * @param registry - The scene registry.
 * @param session - The region session to stash.
 * @returns void
 */
export function setRegionSession(
  registry: Registry,
  session: RegionSession
): void {
  registry.set(RunKeys.regionSession, session);
}

/**
 * Read the stashed region session, or null when none is stored. The Region scene
 * restores from this on a post-battle resume.
 * @param registry - The scene registry.
 * @returns The stashed region session, or null.
 */
export function getRegionSession(registry: Registry): RegionSession | null {
  return (
    (registry.get(RunKeys.regionSession) as RegionSession | undefined) ?? null
  );
}

/**
 * Record the player's current region location (#241) — the "you are here" marker the
 * World Map reads and the travel plan prices against (a return to the current region
 * is a no-op). Set when the player travels into a region; null on a fresh run.
 * @param registry - The scene registry.
 * @param regionId - The region the player is in.
 * @returns void
 */
export function setCurrentRegion(registry: Registry, regionId: RegionId): void {
  registry.set(RunKeys.currentRegion, regionId);
}

/**
 * The player's current region location, or null when unset (a fresh run before any
 * travel). Read by the World Map to mark "you are here" and price the travel plan.
 * @param registry - The scene registry.
 * @returns The current region, or null.
 */
export function getCurrentRegion(registry: Registry): RegionId | null {
  return (registry.get(RunKeys.currentRegion) as RegionId | undefined) ?? null;
}

/** A single region's live cursor + playlist length to record. */
interface RegionCursorUpdate {
  /** The region whose progress to record. */
  readonly regionId: RegionId;
  /** The region's live cursor (encounters cleared). */
  readonly cleared: number;
  /** The region's live variant playlist length. */
  readonly total: number;
}

/**
 * The pure region-progress projection: read the CURRENT region ledger back from the save
 * (so sticky completion is preserved across an Ashfall re-visit), record the region's new
 * cursor, then merge the region-progress flags INTO the save's scene-flag ledger via the
 * pure {@link foldSceneProgress} — preserving the existing sceneId/nodeId narrative cursor,
 * every other flag, AND the grist/build the economy write owns (this fold never touches
 * them). Because it reads the ledger from the *passed* save, running it behind the shared
 * {@link saveAutosave} queue means it folds into the freshest committed save — so a region
 * win's economy credit is already present and preserved verbatim, never clobbered (#245).
 * @param save - The freshest loaded save to fold the region cursor into (never mutated).
 * @param update - The region + its live cursor/total to record.
 * @returns The next save carrying the recorded region progress.
 */
function foldRegionProgress(
  save: CurrentSave,
  update: RegionCursorUpdate
): CurrentSave {
  const ledger = regionProgressFromFlags(save.scene?.flags ?? {});
  const next = recordRegionProgress(
    ledger,
    update.regionId,
    update.cleared,
    update.total
  );
  return foldSceneProgress(save, {
    sceneId: save.scene?.sceneId ?? "",
    nodeId: save.scene?.nodeId ?? "",
    flags: regionProgressFlags(next),
  });
}

/**
 * Persist the region-progress ledger THROUGH to the save (#241, Scope-IN 4) so region
 * completion and partial progress survive a reload and the world map surfaces the
 * restored statuses. Folds the region-progress flags into `SaveDataV3.scene.flags` via
 * the shipped {@link foldSceneProgress} merge reducer (no schema bump — the reunion
 * precedent), serialized behind the shared {@link saveAutosave} queue — the SAME choke
 * point the economy write uses (#245) — so the two writes a region battle win fires (grist
 * credit + cursor advance) never interleave and clobber each other. Best-effort (a storage
 * failure is swallowed so it never breaks play).
 * @param update - The region + its live cursor/total to record.
 * @returns A promise resolving once this write (after any queued ahead of it) is attempted.
 */
export function persistRegionProgress(
  update: RegionCursorUpdate
): Promise<void> {
  return saveAutosave.mutate(save => foldRegionProgress(save, update));
}
