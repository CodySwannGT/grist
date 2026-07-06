/**
 * Standalone-battle terminal resolution (#225) — the small controller that gives a
 * *standalone* resolved battle a way forward instead of the frozen dead-end the
 * bug described. A field-launched battle hands its result back to the Field
 * (`Battle.#maybeReturnToField`); a standalone boot (`?scene=battle`) has nowhere
 * to return to, so on resolution this presents the terminal Victory/Defeat summary
 * ({@link BattleSummaryView} over the pure {@link battleSummary} model) and, on a
 * DELIBERATE advance — a real `confirm` through the InputService semantic bus, or a
 * tap on the panel — transitions to the Title front door behind the readable fade.
 *
 * It deliberately HOLDS the scene on resolution (it never auto-transitions), so the
 * existing battle specs that autoWin and then read `state()` on the Battle scene
 * stay intact; only the deliberate advance leaves. Extracted from the scene to keep
 * `Battle.ts` thin and under its line budget. Owns its bus listener + overlay and
 * frees them on {@link dispose} (the `require-shutdown-cleanup` contract).
 * @module scenes/standalone-resolution
 */
import type Phaser from "phaser";
import { BattleEvents, SceneKeys } from "../consts";
import { type EncounterDef } from "../content";
import { isResolved, type BattleState } from "../logic/combat";
import { extractBattleResult } from "../logic/battle-result";
import {
  battleSummary,
  type BattleSummaryModel,
} from "../logic/battle-summary";
import { eventsCenter } from "../services/events";
import { type InputIntent } from "../services/input-map";
import { BattleSummaryView } from "../ui/battle-summary";
import { transitionToScene } from "./scene-transition";

/** Presents the terminal summary for a resolved standalone battle and routes on. */
export class StandaloneResolution {
  readonly #scene: Phaser.Scene;
  readonly #readState: () => BattleState;
  readonly #encounter: EncounterDef;
  /** The presented summary model, or null until resolution — also the once-latch. */
  #model: BattleSummaryModel | null = null;
  #view: BattleSummaryView | null = null;
  /** Set once the advance has fired, so the Title transition runs exactly once. */
  #advancing = false;

  /**
   * Wire the controller and subscribe its deliberate-advance listener to the
   * InputService bus (inert until the summary is shown).
   * @param scene - The owning standalone battle scene.
   * @param readState - Reads the live battle state each frame.
   * @param encounter - The encounter that ran (for result extraction).
   */
  constructor(
    scene: Phaser.Scene,
    readState: () => BattleState,
    encounter: EncounterDef
  ) {
    this.#scene = scene;
    this.#readState = readState;
    this.#encounter = encounter;
    eventsCenter.on(BattleEvents.Input, this.#onInput);
  }

  /**
   * Present the terminal summary the first frame the battle is resolved (the
   * `#model` latch fires it once). A no-op while the fight is live. Called from the
   * scene's `update` only on a standalone boot.
   * @returns void
   */
  update(): void {
    if (this.#model !== null) {
      return;
    }
    const state = this.#readState();
    if (!isResolved(state)) {
      return;
    }
    const result = extractBattleResult(state, this.#encounter);
    if (result === null) {
      return;
    }
    this.#model = battleSummary(result);
    this.#view = new BattleSummaryView(this.#scene, this.#model, this.#advance);
  }

  /**
   * The presented summary model, or null while the fight is live — the bridge's
   * `summary()` read.
   * @returns The summary model or null.
   */
  summary(): BattleSummaryModel | null {
    return this.#model;
  }

  /**
   * Advance off the terminal summary to the Title once a `confirm` intent arrives
   * (Enter/Space/E, through the InputService bus). Inert until the summary is shown,
   * so it never touches the live fight. A stable arrow field for unsubscribe.
   * @param intent - The semantic input intent from the bus.
   * @returns void
   */
  readonly #onInput = (intent: InputIntent): void => {
    if (this.#model !== null && intent.kind === "confirm") {
      this.#advance();
    }
  };

  /**
   * The single exit from a resolved standalone battle: transition to the Title
   * behind the readable fade cut, exactly once (the `#advancing` latch guards a
   * double keyboard+tap fire). A stable arrow field so the view can call it.
   * @returns void
   */
  readonly #advance = (): void => {
    if (this.#advancing) {
      return;
    }
    this.#advancing = true;
    transitionToScene(this.#scene, SceneKeys.Title);
  };

  /**
   * Free the bus listener and the overlay on scene shutdown.
   * @returns void
   */
  dispose(): void {
    eventsCenter.off(BattleEvents.Input, this.#onInput);
    this.#view?.destroy();
    this.#view = null;
  }
}
