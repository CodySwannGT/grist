/**
 * Finale scene (#244) — the Phaser host that makes the World Map's **★ Aurel's Heart**
 * node enterable, closing the #244 dead-end where the finale advertised "the finale
 * awaits" but its travel handler was a no-op. It mounts the reusable dialogue presenter
 * (`ui/dialogue`, the same adapter the Dialogue scene uses) over the finale script the
 * pure #142 kit + `content/scenes/finale` build for the run's accumulated standing:
 * resolve the standing from the persisted save (`standingFromSave`), resolve the finale
 * (`resolveFinale` — Aurel's heart reached, Sallow confronted, the Choir's Song whole,
 * and the reachable ending-choice), and play the confrontation into the ending fork.
 *
 * It owns NO ending rules: reachability + which ends are offered are the pure
 * `logic/narrative/endings` gate resolver; committing a chosen end is the pure
 * {@link chooseEnding}; the scene is a thin adapter that renders the built script, wires
 * the live input path (reusing {@link DialogueInputService} + the semantic-intent bus,
 * exactly as the Dialogue scene does), commits + persists the chosen ending the instant
 * the presenter crosses into its epilogue, and hands the run back to the Title once the
 * terminal THE GRIST card is passed — a FINAL-feeling landing with no dead end.
 *
 * A defensive **sealed** read covers the `?scene=finale` UAT seam booted before the world
 * has turned (no ending reachable): rather than a fork with no choices, it plays a single
 * "your standing does not yet reach Aurel's heart" beat and returns to the Title, so the
 * scene explains itself instead of stranding the player. In normal play the World Map only
 * enters the finale when it is available (ashfall), where the always-reachable `sunder`
 * default guarantees the fork is never empty.
 * @module scenes/Finale
 */
import Phaser from "phaser";
import { DialogueColors, DialogueEvents, GameView, SceneKeys } from "../consts";
import { type FinaleLaunchData } from "../world-map-consts";
import {
  buildFinaleScript,
  endingIdFromSceneId,
  FINALE_CHOSEN_ENDING_FLAG,
  FINALE_SCENE_ID,
} from "../content";
import {
  chooseEnding,
  resolveFinale,
  standingFromSave,
  type DialoguePresenterInput,
  type FinaleState,
  type SceneDef,
} from "../logic/narrative";
import { foldSceneProgress, type SceneProgress } from "../logic/save";
import { saveService } from "../services/save-service";
import { saveAutosave } from "../services/save-autosave";
import { DialogueInputService } from "../services/dialogue-input";
import type { DialogueIntent } from "../services/dialogue-input-map";
import { eventsCenter } from "../services/events";
import { DialoguePresenter, type DialogueModel } from "../ui/dialogue";
import { verifyBridge, type VerifyResolution } from "../uat/bridge";
import { type DialogueView } from "../uat/dialogue-view";

/** The sealed-read scene id used when the finale is entered before the world has turned. */
const SEALED_SCENE_ID = "finale-sealed";

/**
 * The sealed-read script (defensive, `?scene=finale` before ashfall): a single beat that
 * states why the heart is out of reach, then ends (the scene hands off to the Title). In
 * normal play the World Map gates this away — it only enters the finale when available.
 */
const SEALED_SCRIPT: Readonly<Record<string, SceneDef>> = {
  [SEALED_SCENE_ID]: {
    id: SEALED_SCENE_ID,
    nodes: [
      {
        id: "sealed",
        speaker: "wren",
        text: "Your standing does not yet reach Aurel's heart — the world has not turned. Turn it through the Reckoning first; the finale is sealed until then.",
      },
    ],
  },
};

/** Hosts the finale presenter over the standing-built script and wires it to real play. */
export class Finale extends Phaser.Scene {
  #presenter: DialoguePresenter | null = null;
  #input!: DialogueInputService;
  #finale: FinaleState | null = null;
  /** Latches the ending commit + persist so it fires exactly once. */
  #committed = false;
  /**
   * Whether the terminal node (the THE GRIST card, or the sealed read) has been shown at
   * least once. A single-node scene reports `done` the instant its node is on-screen, so
   * without this latch the hand-off would fire on arrival and flash the card past the
   * player. Seeded true at mount only when the opening itself is terminal (the sealed
   * read), so that reads with one advance; otherwise the card shows, then one advance
   * lands the Title.
   */
  #seenTerminal = false;
  /** Latches the hand-off to the Title so it fires exactly once. */
  #exited = false;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Finale);
  }

  /**
   * Wire the live input path + the verification bridge, then load the save and mount the
   * presenter (async — the presenter is null until the standing is resolved and the
   * script built).
   * @param _data - The launch payload (unused: the finale always lands on the Title).
   * @returns void
   */
  create(_data?: FinaleLaunchData): void {
    this.cameras.main.setBackgroundColor(DialogueColors.boxFill);
    this.#committed = false;
    this.#exited = false;
    this.#input = new DialogueInputService(this);
    eventsCenter.on(DialogueEvents.Intent, this.#onIntent);
    verifyBridge.attach(SceneKeys.Finale, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
    void this.#loadAndMount();
  }

  /**
   * Load the persisted save, resolve the run's standing → finale state, and mount the
   * presenter over the script built for the reachable endings — or the sealed read when
   * the finale is not open (before the world has turned). Wires the choice-button pointer
   * path once the presenter exists.
   * @returns A promise that resolves once the presenter is mounted.
   */
  async #loadAndMount(): Promise<void> {
    const save = await saveService.load();
    const finale = resolveFinale(standingFromSave(save));
    this.#finale = finale;
    const open = finale.atAurelsHeart && finale.reachableEndings.length > 0;
    const table = open
      ? buildFinaleScript(finale.reachableEndings)
      : SEALED_SCRIPT;
    const opening = open ? FINALE_SCENE_ID : SEALED_SCENE_ID;
    this.#presenter = new DialoguePresenter(this, table, opening);
    this.#presenter.onChoicePointer((index: number) =>
      this.#input.tapChoose(index)
    );
    // A sealed read has nothing to commit and simply plays out to the Title; latch the
    // commit closed so the after-step never probes it.
    this.#committed = !open;
    // If the opening is itself terminal (the sealed single-node read), count it as the
    // shown terminal so one advance lands the Title; the confrontation opening is not
    // terminal, so the THE GRIST card still shows before its advance-to-exit.
    this.#seenTerminal = this.#presenter.done;
  }

  /**
   * Handle one semantic dialogue intent on the live bus: advance the caption, resolve a
   * `choose` index against the current fork's choices, or skip. Mirrors the Dialogue
   * scene's resolver so the finale is driven by the exact published-intent path real
   * input uses. A no-op until the presenter is mounted.
   * @param intent - The semantic dialogue intent.
   * @returns void
   */
  readonly #onIntent = (intent: DialogueIntent): void => {
    if (this.#presenter === null) {
      return;
    }
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
   * synchronously), then run the after-step. A no-op until the presenter is mounted.
   * @param input - The resolved dialogue input (advance / branch / skip).
   * @returns void
   */
  #emit(input: DialoguePresenterInput): void {
    if (this.#presenter === null) {
      return;
    }
    eventsCenter.emit(DialogueEvents.Input, input);
    this.#afterStep();
  }

  /**
   * The after-step run after every emitted input: (1) commit + persist the chosen ending
   * the instant the presenter crosses into an ending epilogue scene (latched once), and
   * (2) hand off to the Title once the terminal card is passed and the narrative is done
   * (latched once) — a FINAL-feeling landing with no dead end.
   * @returns void
   */
  #afterStep(): void {
    this.#commitEndingIfCrossed();
    this.#exitIfDone();
  }

  /**
   * Commit the chosen ending as the presenter crosses into its epilogue: read the ending
   * id from the current scene, fold it through the pure {@link chooseEnding} guard, and
   * persist it under {@link FINALE_CHOSEN_ENDING_FLAG} so the run remembers how it ended.
   * Latched so it fires exactly once; a no-op while still in the confrontation walk.
   * @returns void
   */
  #commitEndingIfCrossed(): void {
    if (this.#committed || this.#presenter === null || this.#finale === null) {
      return;
    }
    const ending = endingIdFromSceneId(this.#presenter.state.narrative.sceneId);
    if (ending === null) {
      return;
    }
    this.#committed = true;
    this.#finale = chooseEnding(this.#finale, ending);
    this.#presenter.writeFlag(FINALE_CHOSEN_ENDING_FLAG, ending);
    void this.#persistNarrative(this.#presenter.state.narrative);
  }

  /**
   * Hand the run back to the Title once the terminal node has been SHOWN and then advanced
   * past — not the instant the cursor lands on it (a single-node scene reports `done`
   * on arrival, which would flash the THE GRIST card by). The first `done` after-step marks
   * the terminal seen (the card stays on-screen); the next advance exits. Latched so the
   * hand-off fires exactly once.
   * @returns void
   */
  #exitIfDone(): void {
    if (this.#exited || this.#presenter === null || !this.#presenter.done) {
      return;
    }
    if (!this.#seenTerminal) {
      this.#seenTerminal = true;
      return;
    }
    this.#exited = true;
    this.scene.start(SceneKeys.Title);
  }

  /**
   * Persist the finale's live narrative (cursor + the just-written chosen-ending flag)
   * THROUGH to the save (#142's choice, folded into `SaveDataV3.scene.flags` via the
   * shared save queue — the same seam the Reckoning / mill beats persist through, so it
   * can never clobber a concurrent economy write). Best-effort: a storage failure is
   * swallowed so it never breaks the ending.
   * @param progress - The narrative cursor + flags snapshot to persist.
   * @returns A promise that resolves once the write is attempted.
   */
  async #persistNarrative(progress: SceneProgress): Promise<void> {
    await saveAutosave.mutate(save => foldSceneProgress(save, progress));
  }

  /**
   * The presenter's rendered model, or a done placeholder before the presenter mounts —
   * the shape the bridge snapshot reads.
   * @returns The dialogue model.
   */
  #presenterModel(): DialogueModel {
    return (
      this.#presenter?.model() ?? {
        speaker: "",
        caption: "",
        captionHeight: 0,
        portraitSlot: "",
        branching: false,
        done: true,
        choices: [],
        flags: {},
        beatMs: 0,
      }
    );
  }

  /**
   * The live link the verification bridge reads/drives (reusing the shared
   * {@link DialogueView} seam so `__VERIFY__.dialogue()` / `advanceDialogue()` /
   * `branchDialogue()` drive the finale exactly as they drive the Dialogue scene). The
   * finale carries no reveal beat, so the beat-gating hooks are inert.
   * @returns The dialogue view.
   */
  #bridgeView(): DialogueView {
    return {
      resolution: (): VerifyResolution => ({
        width: GameView.width,
        height: GameView.height,
        zoom: this.scale.zoom,
      }),
      dialogue: () => this.#presenterModel(),
      advance: () => this.#emit({ kind: "advance" }),
      branch: (choiceId: string) => this.#emit({ kind: "branch", choiceId }),
      skip: () => this.#emit({ kind: "skip" }),
      advanceLive: () => this.#emit({ kind: "advance" }),
      revealBeatGating: () => false,
      tickRevealBeat: () => undefined,
    };
  }

  /**
   * Free every external subscription on shutdown (the `require-shutdown-cleanup`
   * contract): detach the bridge, unsubscribe the intent listener, dispose the input
   * service, and dispose the presenter.
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    eventsCenter.off(DialogueEvents.Intent, this.#onIntent);
    this.#input.dispose();
    this.#presenter?.dispose();
  }
}
