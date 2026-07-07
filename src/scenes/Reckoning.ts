/**
 * Reckoning scene (#251) — the Phaser host that makes the World Map's **The Reckoning**
 * hook *play its authored world-turn set-piece* (#125) instead of silently re-skinning the
 * map. It closes the #251 dead-end where selecting "strike the keystone at the Mourne
 * refinery-spire" flipped the world-state to ashfall with no cutscene, so the game's central
 * Act I → Act II pivot passed as a quiet menu change.
 *
 * It mounts the reusable dialogue presenter (`ui/dialogue`, the same adapter the Dialogue and
 * Finale scenes use) over the authored {@link RECKONING_SCRIPT} (`content/scenes/reckoning`):
 * Sallow steps from the background → the party fails → the corpse-reactor overloads → the
 * **world turns to Ashfall** (the deliberate quiet beat) → the party scatters → Sable is
 * taken → the hard cut where color and music drain. The **world-state flip commits exactly
 * once**, at its authored beat — the instant the presenter reaches the
 * {@link RECKONING_TURN_NODE_ID world-turns} node — through the shared save queue (#245), so
 * it can never clobber a concurrent economy write. The flip is the idempotent {@link reckon}
 * (`reach → ashfall`, a second application is a no-op), latched here so it fires a single
 * time regardless of how the presenter is advanced.
 *
 * When the set-piece finishes it lands the run **back on the transformed World Map**, so the
 * Ashfall re-skin (regions renamed, Act II nodes, the desaturated map) reads as the direct
 * consequence of the beat the player just watched — and, because the World Map projects the
 * Reckoning hook to null once the world has turned, the set-piece can never replay.
 *
 * It owns NO world-turn rules: the flip is the pure {@link reckon}; the set-piece content is
 * authored data; the scene is a thin adapter that renders the script, wires the live input
 * path (reusing {@link DialogueInputService} + the semantic-intent bus, exactly as the
 * Dialogue and Finale scenes do), commits + persists the flip at the beat, and frees every
 * subscription on shutdown.
 * @module scenes/Reckoning
 */
import Phaser from "phaser";
import { DialogueColors, DialogueEvents, GameView, SceneKeys } from "../consts";
import {
  type ReckoningLaunchData,
  type WorldMapLaunchData,
} from "../world-map-consts";
import { RECKONING_SCRIPT } from "../content";
import {
  RECKONING_SCENE_ID,
  RECKONING_TURN_NODE_ID,
} from "../logic/narrative/reckoning";
import { reckon } from "../logic/world";
import { type DialoguePresenterInput } from "../logic/narrative";
import { saveAutosave } from "../services/save-autosave";
import { DialogueInputService } from "../services/dialogue-input";
import type { DialogueIntent } from "../services/dialogue-input-map";
import { eventsCenter } from "../services/events";
import { DialoguePresenter } from "../ui/dialogue";
import { verifyBridge, type VerifyResolution } from "../uat/bridge";
import { type DialogueView } from "../uat/dialogue-view";

/** Hosts the reckoning set-piece presenter and commits the world-turn at its beat. */
export class Reckoning extends Phaser.Scene {
  #presenter!: DialoguePresenter;
  #input!: DialogueInputService;
  /** The World Map's own back target, carried forward so the Ashfall map it lands on keeps it. */
  #returnTo: string | null = null;
  /** Latches the world-turn flip + persist so it commits exactly once, at its beat. */
  #turned = false;
  /**
   * Whether the terminal hard-cut node has been shown at least once. A scene reports `done`
   * the instant its terminal node is on-screen, so without this latch the hand-off would
   * fire on arrival and flash the hard cut past the player: the first `done` after-step marks
   * the terminal seen (the card stays on-screen), the next advance lands the World Map.
   */
  #seenTerminal = false;
  /** Latches the hand-off back to the World Map so it fires exactly once. */
  #exited = false;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Reckoning);
  }

  /**
   * Mount the presenter over the authored reckoning script, wire the live input path + the
   * semantic-intent bus subscription, make the choice buttons clickable (the script is
   * linear, so none exist — the seam matches the other dialogue hosts), attach the
   * verification bridge, and free every subscription on shutdown.
   * @param data - The launch payload (the World Map's onward back target), or undefined
   *   standalone (`?scene=reckoning`).
   * @returns void
   */
  create(data?: ReckoningLaunchData): void {
    this.cameras.main.setBackgroundColor(DialogueColors.boxFill);
    this.#returnTo = data?.returnTo ?? null;
    this.#turned = false;
    this.#exited = false;
    this.#presenter = new DialoguePresenter(
      this,
      RECKONING_SCRIPT,
      RECKONING_SCENE_ID
    );
    this.#input = new DialogueInputService(this);
    this.#presenter.onChoicePointer((index: number) =>
      this.#input.tapChoose(index)
    );
    // A single-node script would report done on arrival; the reckoning script is multi-node,
    // so the terminal hard cut still shows before its advance-to-exit.
    this.#seenTerminal = this.#presenter.done;

    eventsCenter.on(DialogueEvents.Intent, this.#onIntent);
    verifyBridge.attach(SceneKeys.Reckoning, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
  }

  /**
   * Handle one semantic dialogue intent on the live bus: advance the caption, resolve a
   * `choose` index against the current node's choices, or skip. Mirrors the Dialogue and
   * Finale scenes' resolver so the set-piece is driven by the exact published-intent path
   * real input uses.
   * @param intent - The semantic dialogue intent.
   * @returns void
   */
  readonly #onIntent = (intent: DialogueIntent): void => {
    if (intent.kind === "advance") {
      this.#emit({ kind: "advance" });
    } else if (intent.kind === "skip") {
      this.#emit({ kind: "skip" });
    } else {
      const choice = this.#presenter.model().choices[intent.index];
      if (choice) {
        this.#emit({ kind: "branch", choiceId: choice.id });
      }
    }
  };

  /**
   * Publish one resolved presenter input on the bus (the presenter folds it and re-renders
   * synchronously), then run the after-step.
   * @param input - The resolved dialogue input (advance / branch / skip).
   * @returns void
   */
  #emit(input: DialoguePresenterInput): void {
    eventsCenter.emit(DialogueEvents.Input, input);
    this.#afterStep();
  }

  /**
   * The after-step run after every emitted input: (1) commit + persist the world-turn flip
   * the instant the presenter reaches the world-turns node — its authored beat — latched
   * once, and (2) hand the run back to the transformed World Map once the terminal hard cut
   * is passed, latched once.
   * @returns void
   */
  #afterStep(): void {
    this.#commitTurnIfReached();
    this.#exitIfDone();
  }

  /**
   * Commit the world-turn flip as the presenter reaches the authored world-turns beat: flip
   * the persisted world-state through the idempotent {@link reckon} (`reach → ashfall`) via
   * the shared save queue (#245) so it never interleaves with an economy write. Latched so it
   * fires exactly once; a no-op while the set-piece is still in its lead-up beats. The map's
   * Ashfall re-skin, desaturation, and Act II content all ride this single flip when the run
   * lands back on the World Map.
   * @returns void
   */
  #commitTurnIfReached(): void {
    if (this.#turned || this.#presenter.nodeId !== RECKONING_TURN_NODE_ID) {
      return;
    }
    this.#turned = true;
    void saveAutosave.mutate(save => ({
      ...save,
      worldState: reckon(save.worldState),
    }));
  }

  /**
   * Hand the run back to the transformed World Map once the terminal hard cut has been SHOWN
   * and then advanced past — not the instant the cursor lands on it (a scene reports `done`
   * on arrival, which would flash the hard cut by). The first `done` after-step marks the
   * terminal seen (the card stays on-screen); the next advance exits, carrying the World
   * Map's onward back target forward so the Ashfall map it lands on keeps it. Latched so the
   * hand-off fires exactly once.
   * @returns void
   */
  #exitIfDone(): void {
    if (this.#exited || !this.#presenter.done) {
      return;
    }
    if (!this.#seenTerminal) {
      this.#seenTerminal = true;
      return;
    }
    this.#exited = true;
    const launch: WorldMapLaunchData | undefined =
      this.#returnTo === null ? undefined : { returnTo: this.#returnTo };
    this.scene.start(SceneKeys.WorldMap, launch);
  }

  /**
   * The live link the verification bridge reads/drives (reusing the shared
   * {@link DialogueView} seam so `__VERIFY__.dialogue()` / `advanceDialogue()` drive the
   * set-piece exactly as they drive the Dialogue and Finale scenes). The set-piece carries no
   * reveal beat, so the beat-gating hooks are inert.
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
      advanceLive: () => this.#emit({ kind: "advance" }),
      revealBeatGating: () => false,
      tickRevealBeat: () => undefined,
    };
  }

  /**
   * Free every external subscription on shutdown (the `require-shutdown-cleanup` contract):
   * detach the bridge, unsubscribe the intent listener, dispose the input service, and
   * dispose the presenter.
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    eventsCenter.off(DialogueEvents.Intent, this.#onIntent);
    this.#input.dispose();
    this.#presenter.dispose();
  }
}
