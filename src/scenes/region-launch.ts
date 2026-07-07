/**
 * The Region↔Battle scene-link glue (#241) — the adapter plumbing the player-facing
 * Region scene uses to *play a region's encounter playlist through real battles*,
 * reusing the exact Field↔Battle registry round-trip (`scenes/field-launch`) rather
 * than the harness auto-resolve. Pulled out of the Region scene so it stays a thin
 * renderer: these free functions own booting the region run, stashing/restoring it
 * across a Battle, folding the win into the shared run, and persisting the region's
 * cursor — while the *rules* live in the pure `logic/region` runtime + `logic/run-state`
 * + `logic/world-map` modules these compose. No combat or economy math is added here.
 *
 * The flow mirrors the Field's: {@link engageRegionEncounter} stashes the live region
 * session and hands the encounter under the run cursor to the existing Battle scene
 * (with `returnTo: Region`); {@link resumeRegionPlay} restores the stash, consumes the
 * one-shot battle result exactly once, advances the region cursor through the pure
 * {@link actRegion} reducer, and writes the new cursor through to the save. The region
 * completes when the cursor reaches the end of the live variant's playlist.
 * @module scenes/region-launch
 */
import type Phaser from "phaser";
import { SceneKeys, type BattleLaunchData } from "../consts";
import { type RegionLaunchData } from "../world-map-consts";
import {
  REGIONS,
  regionBattleTitle,
  resolveRegionVariant,
  type EncounterId,
  type RegionId,
} from "../content";
import {
  actRegion,
  bootRegion,
  RegionActionKinds,
  type RegionRunState,
} from "../logic/region";
import { applyBattleResult, type RunState } from "../logic/run-state";
import { type WorldState } from "../logic/world";
import {
  getRegionSession,
  persistRegionProgress,
  persistRunEconomy,
  setRegionSession,
  setRunState,
  takeLastBattleResult,
  type RegionSession,
} from "../services/run-store";
import { transitionToScene } from "./scene-transition";

/** A resumed region session plus the (possibly updated) run it folded a win into. */
interface RegionPlaySession {
  /** The live region session (run cursor + return route). */
  readonly session: RegionSession;
  /** The run progression, updated when a battle result was consumed. */
  readonly run: RunState;
}

/**
 * The encounter id under a region run's cursor — the next fight to launch — or null
 * when the playlist is finished. Reads the live variant's playlist so an Ashfall run
 * fights its Ashfall table. Pure.
 * @param run - The region run state.
 * @returns The current encounter id, or null when the region is complete.
 */
function currentRegionEncounter(run: RegionRunState): EncounterId | null {
  const region = REGIONS[run.regionId as RegionId];
  const playlist = resolveRegionVariant(region, run.worldState).encounters;
  return playlist[run.cursor] ?? null;
}

/**
 * Boot a region into player mode from the World Map launch payload: boot the run under
 * the seed + world-state, then fast-forward the cursor to the saved cleared-count by
 * replaying the pure {@link actRegion} advance (so a partially-cleared region resumes
 * exactly where the player left it, deterministically). No battle is launched here —
 * the scene renders the run and the player engages the next encounter.
 * @param launch - The World Map launch payload (region id, world-state, cleared, returnTo).
 * @param seed - The 32-bit seed to boot the run under.
 * @returns The booted region session.
 */
export function bootRegionPlay(
  launch: RegionLaunchData,
  seed: number
): RegionSession {
  const region = REGIONS[launch.regionId as RegionId];
  const booted = bootRegion(region, seed, launch.worldState as WorldState);
  const playlist = resolveRegionVariant(
    region,
    launch.worldState as WorldState
  ).encounters;
  const target = Math.min(launch.cleared, playlist.length);
  // Replay the saved cleared-count deterministically to resume the exact cursor.
  const run = Array.from({ length: target }).reduce<RegionRunState>(
    prev => actRegion(prev, { kind: RegionActionKinds.advance }),
    booted
  );
  return { run, returnTo: launch.returnTo };
}

/**
 * Engage the encounter under the region cursor: stash the live region session on the
 * registry (so the Battle round-trip restores the exact cursor) and hand the encounter
 * to the existing Battle scene with `returnTo: Region`, behind the readable fade cut.
 * A no-op (returns false) when the region is already complete (no encounter to fight).
 * The battle seed is threaded from the run's live RNG state for determinism.
 * @param scene - The Region scene (used to start the Battle scene).
 * @param registry - The scene registry.
 * @param session - The live region session to stash and engage from.
 * @returns True when a battle launch was started.
 */
export function engageRegionEncounter(
  scene: Phaser.Scene,
  registry: Phaser.Data.DataManager,
  session: RegionSession
): boolean {
  const encounterId = currentRegionEncounter(session.run);
  if (encounterId === null) {
    return false;
  }
  // Derive the battle banner from the region's live world-state variant (#248) so the
  // fight reads its region ("THE MARROW REACH", "UPPER VANTA — …") — and turns with the
  // Reckoning — rather than the fixed "MARROW DESCENT" the Battle scene defaults to.
  const region = REGIONS[session.run.regionId as RegionId];
  const launch: BattleLaunchData = {
    encounterId,
    seed: session.run.rngState,
    returnTo: SceneKeys.Region,
    title: regionBattleTitle(region, session.run.worldState),
  };
  setRegionSession(registry, session);
  transitionToScene(scene, SceneKeys.Battle, launch);
  return true;
}

/**
 * Resume region play after a battle: restore the stashed session, consume the one-shot
 * battle result (fold it into the shared run and persist the earned economy — exactly
 * as the Field's resume does, so a region win credits grist once), advance the region
 * cursor through {@link actRegion}, and write the new cursor through to the save so the
 * region's progress (and completion) survive a reload. Returns null when no session was
 * stashed (defensive — a resume should always have one).
 * @param registry - The scene registry.
 * @param run - The current run progression.
 * @returns The resumed region session + updated run, or null when nothing was stashed.
 */
export function resumeRegionPlay(
  registry: Phaser.Data.DataManager,
  run: RunState
): RegionPlaySession | null {
  const stashed = getRegionSession(registry);
  if (stashed === null) {
    return null;
  }
  const result = takeLastBattleResult(registry);
  const nextRun = result === null ? run : applyBattleResult(run, result);
  if (result !== null) {
    setRunState(registry, nextRun);
    void persistRunEconomy(nextRun);
  }
  // A win clears the encounter under the cursor: advance the region run, then persist
  // the new cursor (and completion, when the cursor reaches the playlist end).
  const advanced = actRegion(stashed.run, {
    kind: RegionActionKinds.advance,
  });
  const region = REGIONS[advanced.regionId as RegionId];
  const total = resolveRegionVariant(region, advanced.worldState).encounters
    .length;
  void persistRegionProgress({
    regionId: advanced.regionId as RegionId,
    cleared: advanced.cursor,
    total,
  });
  return { session: { ...stashed, run: advanced }, run: nextRun };
}
