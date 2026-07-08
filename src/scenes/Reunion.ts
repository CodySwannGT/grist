/**
 * Reunion scene (#273, composing #140) — the Phaser host that makes the World Map's Act II
 * reunion ("story") nodes enter their OWN self-contained recruit content, closing the
 * regression where selecting a reunion travelled to its already-cleared anchor region and
 * showed that region's stale `region-cleared` summary. It mounts the reusable dialogue
 * presenter (`ui/dialogue`, the same adapter the Dialogue / Finale scenes use) over the
 * reunion's script (`content/scenes/reunion` → {@link buildReunionScript}): the
 * environmental hook, the meeting, and the companion joining the cause.
 *
 * It owns NO reunion rules: the recruit content is authored data, and the completion is
 * recorded as the persisted `reunion:<id>` scene-flag the instant the presenter crosses
 * into the reunion's **joined** epilogue — the exact forward-compatible seam
 * `logic/narrative/finale-standing` counts, so each recruit lifts the finale's reachable
 * endings ("the finale scales to the party you bring"). Once the terminal beat is passed
 * the scene hands the run back to the World Map — no dead end.
 *
 * Mirrors the Finale scene's mount/commit/exit shape (the dialogue bridge seam, the
 * commit-once latch, the shown-then-advanced terminal latch) so the reunion is driven by
 * the exact published-intent path real input uses and the e2e reads it through
 * `__VERIFY__.dialogue()` / `advanceDialogue()`.
 * @module scenes/Reunion
 */
import Phaser from "phaser";
import { DialogueColors, DialogueEvents, GameView, SceneKeys } from "../consts";
import {
  type ReunionLaunchData,
  type WorldMapLaunchData,
} from "../world-map-consts";
import {
  buildReunionScript,
  reunionCompleteFlag,
  reunionIdFromJoinedSceneId,
  reunionMeetSceneId,
  ReunionIds,
  REUNION_ORDER,
  type ReunionId,
} from "../content";
import { ReunionStatuses } from "../logic/party/reunion";
import { type DialoguePresenterInput, type SceneDef } from "../logic/narrative";
import { foldSceneProgress, type SceneProgress } from "../logic/save";
import { saveAutosave } from "../services/save-autosave";
import { DialogueInputService } from "../services/dialogue-input";
import type { DialogueIntent } from "../services/dialogue-input-map";
import { eventsCenter } from "../services/events";
import { DialoguePresenter, type DialogueModel } from "../ui/dialogue";
import { verifyBridge, type VerifyResolution } from "../uat/bridge";
import { type DialogueView } from "../uat/dialogue-view";

/** Hosts the reunion recruit presenter over its authored script and wires it to real play. */
export class Reunion extends Phaser.Scene {
  #presenter: DialoguePresenter | null = null;
  #input!: DialogueInputService;
  #reunionId: ReunionId = REUNION_ORDER[0]!;
  #returnTo: string = SceneKeys.WorldMap;
  /** The World Map's OWN back target to restore on exit (its caller — Field/Menu). */
  #mapReturnTo: string = SceneKeys.Field;
  /** Latches the recruit-completion persist so it fires exactly once. */
  #committed = false;
  /** Whether the terminal (joined) beat has been shown at least once (the #244 latch). */
  #seenTerminal = false;
  /** Latches the hand-off back to the World Map so it fires exactly once. */
  #exited = false;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Reunion);
  }

  /**
   * Read the launched reunion (defaulting to the first for the defensive standalone case),
   * wire the live input path + the verification bridge, then load the save and mount the
   * presenter over the reunion's script (async — the presenter is null until mounted).
   * @param data - The launch payload (which reunion, and the scene to return to).
   * @returns void
   */
  create(data?: ReunionLaunchData): void {
    this.cameras.main.setBackgroundColor(DialogueColors.boxFill);
    this.#reunionId = this.#resolveReunionId(data?.reunionId);
    this.#returnTo = data?.returnTo ?? SceneKeys.WorldMap;
    this.#mapReturnTo = data?.mapReturnTo ?? SceneKeys.Field;
    this.#committed = false;
    this.#seenTerminal = false;
    this.#exited = false;
    this.#input = new DialogueInputService(this);
    eventsCenter.on(DialogueEvents.Intent, this.#onIntent);
    verifyBridge.attach(SceneKeys.Reunion, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
    this.#mount();
  }

  /**
   * Resolve a launched reunion id to a defined {@link ReunionId}, defaulting an absent or
   * unknown id to the first reunion so the standalone case never mounts an empty script.
   * @param id - The launched reunion id, or undefined.
   * @returns A defined reunion id.
   */
  #resolveReunionId(id: string | undefined): ReunionId {
    const known = Object.values(ReunionIds).find(value => value === id);
    return known ?? REUNION_ORDER[0]!;
  }

  /**
   * Mount the presenter over the launched reunion's script at its meeting scene. The recruit
   * completion is committed later, as the presenter crosses into the joined epilogue.
   * @returns void
   */
  #mount(): void {
    const table: Readonly<Record<string, SceneDef>> = buildReunionScript(
      this.#reunionId
    );
    this.#presenter = new DialoguePresenter(
      this,
      table,
      reunionMeetSceneId(this.#reunionId)
    );
    this.#presenter.onChoicePointer((index: number) =>
      this.#input.tapChoose(index)
    );
    this.#seenTerminal = this.#presenter.done;
  }

  /**
   * Handle one semantic dialogue intent on the live bus: advance, skip, or resolve a
   * `choose` index (reunions are linear, so a choose is dropped). A no-op until mounted.
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
    }
  };

  /**
   * Publish one resolved presenter input on the bus (the presenter folds it and re-renders
   * synchronously), then run the after-step. A no-op until the presenter is mounted.
   * @param input - The resolved dialogue input (advance / skip).
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
   * The after-step run after every emitted input: (1) commit + persist the reunion
   * completion the instant the presenter crosses into the joined epilogue (latched once),
   * and (2) hand off back to the World Map once the terminal beat is passed (latched once).
   * @returns void
   */
  #afterStep(): void {
    this.#commitIfJoined();
    this.#exitIfDone();
  }

  /**
   * Commit the recruit as the presenter crosses into the reunion's joined epilogue: write
   * the `reunion:<id>` completion flag (truthy — the seam `finale-standing` counts) into
   * the presenter AND persist it through to the save, so the recruit survives a reload and
   * the finale's standing scales to it. Latched so it fires exactly once; a no-op while
   * still in the meeting walk.
   * @returns void
   */
  #commitIfJoined(): void {
    if (this.#committed || this.#presenter === null) {
      return;
    }
    const joined = reunionIdFromJoinedSceneId(
      this.#presenter.state.narrative.sceneId
    );
    if (joined === null) {
      return;
    }
    this.#committed = true;
    this.#presenter.writeFlag(
      reunionCompleteFlag(joined),
      ReunionStatuses.completed
    );
    void this.#persistNarrative(this.#presenter.state.narrative);
  }

  /**
   * Hand the run back to the World Map once the terminal (joined) beat has been SHOWN and
   * then advanced past — not the instant the cursor lands on it (a single-node scene reports
   * `done` on arrival, which would flash the recruit line by). The first `done` after-step
   * marks the terminal seen; the next advance exits. Latched so the hand-off fires once.
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
    this.scene.start(this.#returnTo, {
      returnTo: this.#mapReturnTo,
    } as WorldMapLaunchData);
  }

  /**
   * Persist the reunion's live narrative (cursor + the just-written completion flag) THROUGH
   * to the save (folded into `SaveDataV3.scene.flags` via the shared save queue — the same
   * seam the Reckoning / mill / finale beats persist through, so it can never clobber a
   * concurrent economy write). Best-effort: a storage failure is swallowed so it never
   * breaks the recruit.
   * @param progress - The narrative cursor + flags snapshot to persist.
   * @returns A promise that resolves once the write is attempted.
   */
  async #persistNarrative(progress: SceneProgress): Promise<void> {
    await saveAutosave.mutate(save => foldSceneProgress(save, progress));
  }

  /**
   * The presenter's rendered model, or a done placeholder before the presenter mounts — the
   * shape the bridge snapshot reads.
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
   * {@link DialogueView} seam so `__VERIFY__.dialogue()` / `advanceDialogue()` drive the
   * reunion exactly as they drive the Dialogue / Finale scenes). The reunion carries no
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
      dialogue: () => this.#presenterModel(),
      advance: () => this.#emit({ kind: "advance" }),
      branch: () => this.#emit({ kind: "advance" }),
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
    this.#presenter?.dispose();
  }
}
