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
import {
  SceneKeys,
  type BattleLaunchData,
  type MenuLaunchData,
} from "../consts";
import { CH1_AMBUSH_ENCOUNTER } from "../content";
import {
  FieldActionKinds,
  FieldPhases,
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
  setFieldViewSnapshot,
  takeFieldViewSnapshot,
  setRunState,
  takeLastBattleResult,
  type FieldViewSnapshot,
} from "../services/run-store";
import { transitionToScene } from "./scene-transition";

/** The session + run a (re)entry resolves to, ready for the scene to render. */
interface FieldSession {
  /** The field session state to render. */
  readonly state: FieldState;
  /** The (possibly updated) run progression. */
  readonly run: RunState;
  /** The seed the session is running under. */
  readonly seed: number;
  /**
   * Wren's exact render position to restore, present only on a pause-menu resume
   * (#233) — a fresh boot / post-battle resume omits it and the scene spawns her at
   * the room entrance, so only a pause drops her back at the pixel she paused on.
   */
  readonly wren?: FieldViewSnapshot | undefined;
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
 * Open the pause Menu over the live Field (#233): stash the current session and
 * Wren's exact render position on the registry, then start the Menu telling it to
 * return to the Field on close. It reuses the same registry round-trip as the
 * Field↔Battle leg — the Menu is a full-screen overlay reached by a real
 * `scene.start`, and closing it re-enters the Field via {@link resumeFieldFromMenu}
 * with the stashed session + position restored byte-for-byte. No menu rules live
 * here (those are the pure `logic/pause-menu`); this is only the launch payload.
 * @param scene - The Field scene (used to start the Menu scene).
 * @param registry - The scene registry.
 * @param state - The live field session state to stash for the resume.
 * @param view - Wren's render position + facing to restore on return.
 * @returns void
 */
export function openPauseMenu(
  scene: Phaser.Scene,
  registry: Phaser.Data.DataManager,
  state: FieldState,
  view: FieldViewSnapshot
): void {
  const launch: MenuLaunchData = { returnTo: SceneKeys.Field };
  setFieldState(registry, state);
  setFieldViewSnapshot(registry, view);
  scene.scene.start(SceneKeys.Menu, launch);
}

/**
 * Resume the Field from the pause Menu (#233): restore the stashed session exactly
 * as it was — no battle result to consume, no post-battle room advance — so the
 * player drops back into the same room/phase they paused in. Wren's exact position
 * is restored separately by the scene from the stashed field-view snapshot. Falls back
 * to a fresh descent under `fallbackSeed` if nothing was stashed (defensive).
 * @param registry - The scene registry.
 * @param run - The current run progression (unchanged by a pause).
 * @param fallbackSeed - The seed to start a fresh descent under if none stashed.
 * @returns The restored (or fresh) session.
 */
export function resumeFieldFromMenu(
  registry: Phaser.Data.DataManager,
  run: RunState,
  fallbackSeed: number
): FieldSession {
  const stashed = getFieldState(registry);
  if (!stashed) {
    return beginFieldSession(run, fallbackSeed);
  }
  return {
    state: stashed,
    run,
    seed: stashed.seed,
    wren: takeFieldViewSnapshot(registry) ?? undefined,
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
  // hand the launch payload to the existing Phase-1 Battle scene — behind a
  // readable fade cut (#114 AC2) rather than an instant snap. The stash happens
  // synchronously (resume state is intact the moment we return `true`); only the
  // visual `scene.start` is deferred behind the fade-out + hold, so the launch is
  // still "initiated" for the caller's fire-once latch and the byte-identical
  // resume path is unchanged.
  setFieldState(registry, state);
  transitionToScene(scene, SceneKeys.Battle, launch);
  return true;
}

/**
 * Build the synthetic field session the Ch.1 opening hands off to (#105 AC2): a
 * normal Room-A descent session, forced into the `triggered` phase pending the
 * Ch.1 tutorial ambush — so the existing #82 {@link launchPendingBattle} path can
 * launch it byte-identically. This is an override at the **launch boundary only**:
 * `MARROW_MAP` and the rigid Room-A→`warren-street` binding are untouched
 * (`?scene=field` still launches warren-street in Room A), and the field sim is not
 * forked — we start from {@link startField} (valid rooms + threaded RNG) and only
 * set the two fields {@link pendingLaunch} reads. Pure (Phaser-free, no ambient
 * read), so the same seed always yields the same session and it round-trips through
 * `JSON.stringify`.
 * @param seed - The 32-bit field seed (threaded from the opening boot).
 * @returns A triggered session whose pending launch is the Ch.1 tutorial ambush.
 */
export function ch1AmbushSession(seed: number): FieldState {
  return {
    ...startField(seed),
    phase: FieldPhases.triggered,
    pendingEncounter: CH1_AMBUSH_ENCOUNTER,
  };
}

/**
 * Launch the Ch.1 tutorial ambush from the opening's end (#105 AC2): hand the
 * synthetic {@link ch1AmbushSession} to the existing #82 launcher, which stashes it
 * on the registry (so the post-battle resume restores it and credits the shared
 * wallet via {@link applyBattleResult}) and starts the Battle scene. The ambush
 * therefore begins immediately after the reveal, and a win flows back through the
 * normal Field resume — no new combat or economy code, no field-sim fork.
 * @param scene - The scene starting the Battle (the Dialogue scene at the handoff).
 * @param registry - The scene registry (stashes the session for the resume).
 * @param seed - The 32-bit field seed to run the ambush under.
 * @returns True when the battle launch was started.
 */
export function launchCh1Ambush(
  scene: Phaser.Scene,
  registry: Phaser.Data.DataManager,
  seed: number
): boolean {
  return launchPendingBattle(scene, registry, ch1AmbushSession(seed));
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
