/**
 * Dialogue scene — the thin Phaser host for the reusable dialogue/cutscene
 * presenter (sub-task #104, Story #92 PD-3.1). It owns NO dialogue rules: the pure
 * presenter state machine (`logic/narrative/presenter`) holds advance/branch/skip,
 * and the {@link DialoguePresenter} adapter (`ui/dialogue`) holds the rendering;
 * this scene mounts the presenter over a script, wires the **live** input path, and
 * frees every subscription on shutdown.
 *
 * Input flows in two stages so the same path serves real play and UAT:
 * 1. The {@link DialogueInputService} reads raw keyboard (and the scene forwards
 *    pointer taps) and publishes a device-tagged semantic {@link DialogueEvents.Intent}
 *    (advance / skip / choose-Nth) — "actions, not raw keys".
 * 2. This scene subscribes to that intent, resolves a `choose` index to the current
 *    node's choice id (from the presenter model), and re-publishes the resolved
 *    {@link DialogueEvents.Input}, which the presenter adapter folds through the pure
 *    reducer. The `?uat=1` bridge drives advance/branch/skip through the **same**
 *    re-publish path, so the e2e exercises exactly what live input does.
 *
 * It is also a **verification entry point**, the dialogue counterpart of the
 * `?scene=field` / `?scene=bench` starts: reached via `?scene=dialogue`, it plays a
 * tiny UAT-only demo script (NOT authored game content — PD-3.2 / PD-3.6 author the
 * real opening/recruitment scenes). When real scenes wire the presenter into the
 * Field/opening flow, they mount the same {@link DialoguePresenter} the same way. No
 * allocations in `update()` — the scene is event-driven, so it has none.
 * @module scenes/Dialogue
 */
import Phaser from "phaser";
import { DialogueColors, DialogueEvents, GameView, SceneKeys } from "../consts";
import type { DialoguePresenterInput } from "../logic/narrative";
import { DialogueInputService } from "../services/dialogue-input";
import type { DialogueIntent } from "../services/dialogue-input-map";
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
  #input!: DialogueInputService;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Dialogue);
  }

  /**
   * Mount the presenter over the demo script, wire the live input service + the
   * semantic-intent bus subscription, make the choice buttons clickable, attach the
   * verification bridge, and free every subscription on shutdown.
   * @returns void
   */
  create(): void {
    this.cameras.main.setBackgroundColor(DialogueColors.boxFill);
    this.#presenter = new DialoguePresenter(
      this,
      demoDialogueScript(),
      DEMO_DIALOGUE_OPENING
    );
    this.#input = new DialogueInputService(this);

    // The live input path: the input service publishes a semantic intent; this
    // scene resolves it against the current node and drives the presenter.
    eventsCenter.on(DialogueEvents.Intent, this.#onIntent);
    this.#presenter.onChoicePointer((index: number) =>
      this.#input.tapChoose(index)
    );

    verifyBridge.attach(SceneKeys.Dialogue, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
  }

  /**
   * Handle one semantic dialogue intent: translate it into a presenter input and
   * re-publish on the bus. A `choose` index is resolved against the current node's
   * choices (an out-of-range index is dropped — totality), so the presenter only
   * ever sees a real `branch` with a valid choice id. A stable arrow field so it
   * can be unsubscribed by reference in {@link #shutdown}.
   * @param intent - The semantic dialogue intent (advance / skip / choose).
   * @returns void
   */
  readonly #onIntent = (intent: DialogueIntent): void => {
    switch (intent.kind) {
      case "advance":
        this.#emit({ kind: "advance" });
        break;
      case "skip":
        this.#emit({ kind: "skip" });
        break;
      case "choose": {
        const choice = this.#presenter.model().choices[intent.index];
        if (choice) {
          this.#emit({ kind: "branch", choiceId: choice.id });
        }
        break;
      }
    }
  };

  /**
   * Publish one resolved presenter input on the bus — the presenter (subscribed in
   * its constructor) folds it through the pure reducer and re-renders. Raw input
   * never reaches the presenter; only this resolved intent does.
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
   * `require-shutdown-cleanup` contract): detach the bridge, unsubscribe the
   * semantic-intent bus listener, dispose the input service (keyboard listeners),
   * and dispose the presenter (which removes its own dialogue-input bus listener
   * and the choice-button pointer handlers).
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    eventsCenter.off(DialogueEvents.Intent, this.#onIntent);
    this.#input.dispose();
    this.#presenter.dispose();
  }
}
