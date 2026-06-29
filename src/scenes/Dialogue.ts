/**
 * Dialogue scene — the thin Phaser host for the reusable dialogue/cutscene
 * presenter (sub-task #104, Story #92 PD-3.1). It owns NO dialogue rules: the pure
 * presenter state machine (`logic/narrative/presenter`) holds advance/branch/skip,
 * and the {@link DialoguePresenter} adapter (`ui/dialogue`) holds the rendering;
 * this scene just mounts the presenter over a script, publishes the player's
 * advance/branch/skip as semantic {@link DialogueEvents.Input} intents on the
 * EventsCenter bus, and frees its subscription on shutdown.
 *
 * It is a **verification entry point**, the dialogue counterpart of the `?scene=field`
 * / `?scene=bench` starts: reached only via `?scene=dialogue`, it plays a tiny
 * UAT-only demo script (NOT authored game content — PD-3.2 / PD-3.6 author the real
 * opening/recruitment scenes) so the opening e2e can drive the presenter and assert
 * captions + speaker + portrait slot on the live canvas. When real scenes wire the
 * presenter into the Field/opening flow, they mount the same {@link DialoguePresenter}
 * the same way. No allocations in `update()` — the presenter is event-driven, so it
 * has none.
 * @module scenes/Dialogue
 */
import Phaser from "phaser";
import { DialogueColors, DialogueEvents, GameView, SceneKeys } from "../consts";
import type { DialoguePresenterInput } from "../logic/narrative";
import { eventsCenter } from "../services/events";
import { DialoguePresenter } from "../ui/dialogue";
import { verifyBridge, type VerifyResolution } from "../uat/bridge";
import {
  DEMO_DIALOGUE_OPENING,
  demoDialogueScript,
  type DialogueView,
} from "../uat/dialogue-view";

/** Hosts the reusable dialogue presenter over a (demo) script and bridges it. */
export class Dialogue extends Phaser.Scene {
  #presenter!: DialoguePresenter;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Dialogue);
  }

  /**
   * Mount the presenter over the demo script, attach the verification bridge, and
   * free the bus subscription on shutdown. The presenter subscribes to the dialogue
   * intent bus itself; this scene only publishes intents and disposes the presenter.
   * @returns void
   */
  create(): void {
    this.cameras.main.setBackgroundColor(DialogueColors.boxFill);
    this.#presenter = new DialoguePresenter(
      this,
      demoDialogueScript(),
      DEMO_DIALOGUE_OPENING
    );

    verifyBridge.attach(SceneKeys.Dialogue, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
  }

  /**
   * Publish one semantic dialogue intent on the bus — the presenter (subscribed in
   * its constructor) folds it through the pure reducer and re-renders. Raw input
   * never reaches the presenter; only these named intents do.
   * @param input - The dialogue presenter input (advance / branch / skip).
   * @returns void
   */
  #emit(input: DialoguePresenterInput): void {
    eventsCenter.emit(DialogueEvents.Input, input);
  }

  /**
   * The live link the verification bridge reads/drives: the resolved integer scale
   * and the rendered dialogue model, plus the three presenter actions routed as
   * bus intents so the e2e exercises the exact published-intent path real input
   * will use.
   * @returns The dialogue view.
   */
  #bridgeView(): DialogueView {
    return {
      resolution: (): VerifyResolution => ({
        width: GameView.width,
        height: GameView.height,
        zoom: this.scale.zoom,
      }),
      dialogue: () => this.#presenter.model(),
      advance: () => this.#emit({ kind: "advance" }),
      branch: (choiceId: string) => this.#emit({ kind: "branch", choiceId }),
      skip: () => this.#emit({ kind: "skip" }),
    };
  }

  /**
   * Free every external subscription on scene shutdown (the
   * `require-shutdown-cleanup` contract): detach the bridge and dispose the
   * presenter (which removes its dialogue-intent bus listener).
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    this.#presenter.dispose();
  }
}
