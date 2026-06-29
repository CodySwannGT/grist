/**
 * The Field↔Battle scene-link glue (sub-task #82) — the adapter-level plumbing the
 * Field scene uses to *launch* the existing Phase-1 Battle scene for a triggered
 * encounter and to *resume* the descent after the fight, consuming its result.
 * Pulled out of the Field scene so the scene stays a thin renderer: these free
 * functions own the registry round-trip (stash/restore the live field session,
 * read/fold the battle result), while the *rules* live in the pure
 * `logic/field` + `logic/run-state` modules these compose. No combat math is
 * added here — only the launch payload and the result consumption.
 * @module scenes/field-launch
 */
import type Phaser from "phaser";
import { SceneKeys, type BattleLaunchData } from "../consts";
import {
  FieldActionKinds,
  advanceAfterBattle,
  pendingLaunch,
  startField,
  stepField,
  traverseToNext,
  type FieldState,
} from "../logic/field";
import { applyBattleResult, type RunState } from "../logic/run-state";
import {
  getFieldState,
  setFieldState,
  setRunState,
  takeLastBattleResult,
} from "../services/run-store";

/** The session + run a (re)entry resolves to, ready for the scene to render. */
interface FieldSession {
  /** The field session state to render. */
  readonly state: FieldState;
  /** The (possibly updated) run progression. */
  readonly run: RunState;
  /** The seed the session is running under. */
  readonly seed: number;
}

/**
 * Begin a brand-new descent: start the session under `seed` in Room A in the
 * `exploring` phase — Wren can move and examine before the fight. The Room-A
 * encounter is *not* auto-fired on boot; it fires when the player engages it
 * ({@link engageEncounter}), so the Field is a real, playable scene rather than a
 * pass-through into combat. The run passes through unchanged.
 * @param run - The current run progression.
 * @param seed - The 32-bit field seed.
 * @returns The fresh exploring session in Room A.
 */
export function beginFieldSession(run: RunState, seed: number): FieldSession {
  return { state: startField(seed), run, seed };
}

/**
 * Engage the current room's encounter — fire its trigger (the pure
 * {@link beginDescent}/`enter` step) and hand it to the Battle scene via
 * {@link launchPendingBattle}. This is how Room A's fight starts: after the player
 * has explored, they engage. A no-op when the room's encounter has already fired.
 * Returns the post-engage field state so the scene can adopt it.
 * @param scene - The Field scene (used to start the Battle scene on a launch).
 * @param registry - The scene registry.
 * @param state - The current (exploring) field state.
 * @returns The next field state — the room's fired trigger (or unchanged).
 */
export function engageEncounter(
  scene: Phaser.Scene,
  registry: Phaser.Data.DataManager,
  state: FieldState
): FieldState {
  const engaged = stepField(state, {
    kind: FieldActionKinds.enter,
    roomId: state.currentRoom,
  });
  launchPendingBattle(scene, registry, engaged);
  return engaged;
}

/**
 * Resume the descent after a battle: restore the stashed pre-launch session from
 * the registry, consume the just-resolved battle result (fold it into the run and
 * persist it), then acknowledge the cleared room so control returns to the Field
 * in the `exploring` phase (the pure {@link advanceAfterBattle} step) — no fight is
 * auto-launched, so the Field is visible and playable between encounters. The
 * player (or the verification bridge) then traverses to the next room to fire its
 * trigger. Falls back to a fresh descent under `fallbackSeed` if no session was
 * stashed (defensive — a resume should always have one).
 * @param registry - The scene registry.
 * @param run - The current run progression.
 * @param fallbackSeed - The seed to start a fresh descent under if none stashed.
 * @returns The resumed (or fresh) session with the consumed result folded in.
 */
export function resumeFieldSession(
  registry: Phaser.Data.DataManager,
  run: RunState,
  fallbackSeed: number
): FieldSession {
  const stashed = getFieldState(registry);
  if (!stashed) {
    return beginFieldSession(run, fallbackSeed);
  }
  const result = takeLastBattleResult(registry);
  const nextRun = result === null ? run : applyBattleResult(run, result);
  if (result !== null) {
    setRunState(registry, nextRun);
  }
  return {
    state: advanceAfterBattle(stashed),
    run: nextRun,
    seed: stashed.seed,
  };
}

/**
 * Hand a pending encounter to the existing Phase-1 Battle scene when the session
 * is in the `triggered` phase with a `pendingEncounter`: stash the live session on
 * the registry (so it is restored byte-for-byte on return) and start the Battle
 * scene with the encounter id + a battle seed derived from the field RNG state.
 * Returns whether a launch was started, so the caller can latch it to fire once.
 * No-op (returns false) when no trigger is pending.
 * @param scene - The Field scene (used only to start the Battle scene).
 * @param registry - The scene registry.
 * @param state - The live field session state.
 * @returns True when a battle launch was started.
 */
export function launchPendingBattle(
  scene: Phaser.Scene,
  registry: Phaser.Data.DataManager,
  state: FieldState
): boolean {
  const pending = pendingLaunch(state);
  if (pending === null) {
    return false;
  }
  const launch: BattleLaunchData = {
    encounterId: pending.encounterId,
    seed: pending.seed,
  };
  // Stash the live session so the Field restores byte-for-byte on return, then
  // hand the launch payload to the existing Phase-1 Battle scene.
  setFieldState(registry, state);
  scene.scene.start(SceneKeys.Battle, launch);
  return true;
}

/**
 * Traverse from the current (cleared) room to the next in the A→B→C progression
 * (the pure {@link traverseToNext} step), firing the next room's encounter trigger,
 * then hand that trigger straight to the Battle scene via {@link launchPendingBattle}.
 * Returns the post-traverse field state so the scene can adopt it (the launch, when
 * one fires, has already swapped the active scene). A no-op past the final room
 * leaves the session `complete` and launches nothing. This is how the Field
 * advances the descent between fights.
 * @param scene - The Field scene (used to start the Battle scene on a launch).
 * @param registry - The scene registry.
 * @param state - The current (exploring) field state.
 * @returns The next field state — the next room's trigger, or `complete`.
 */
export function advanceToNextRoom(
  scene: Phaser.Scene,
  registry: Phaser.Data.DataManager,
  state: FieldState
): FieldState {
  const next = traverseToNext(state);
  launchPendingBattle(scene, registry, next);
  return next;
}
