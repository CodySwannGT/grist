/**
 * Opening scene — the thin Phaser host for Ch.1 "The delivery" cold-start (sub-task
 * #105, Story #93 PD-3.2). It is the dedicated, query-gated entry the verification
 * Journey names (reached via `?scene=opening`); the DEFAULT boot stays Battle, so the
 * existing e2e + unit suites are unchanged (triage decision 1).
 *
 * It owns NO rules: it RENDERS Wren in the Marrow (the field backdrop + a movable
 * placeholder, so AC1 "in the Marrow, integer-scaled, can move/interact" holds),
 * mounts the reusable #92 {@link DialoguePresenter} over the authored
 * {@link CH1_SCRIPT}, and consumes the pure opening-flow logic (`logic/narrative/
 * opening`) verbatim. Each time the dialogue cursor reaches the reveal node it folds
 * the `sable-revealed` flag (into the flow + the narrative ledger — reducers never
 * auto-write flags); when the narrative ends it hands off to the
 * {@link CH1_AMBUSH_ENCOUNTER tutorial ambush} via the EXISTING Field↔Battle launcher
 * ({@link launchOpeningAmbush}) — the sim is never forked. Movement and dialogue input
 * flow through the same semantic services live play uses; the verification bridge
 * drives the same paths. Every subscription is freed on shutdown; `update()` allocates
 * nothing.
 * @module scenes/Opening
 */
import Phaser from "phaser";
import {
  DialogueEvents,
  FieldColors,
  FieldEvents,
  FieldLayout,
  GameView,
  SceneKeys,
} from "../consts";
import {
  CH1_OPENING_SCENE_ID,
  CH1_SCRIPT,
  SABLE_REVEALED_FLAG,
} from "../content/scenes/ch1";
import type { DialoguePresenterInput } from "../logic/narrative";
import {
  foldRevealFlag,
  isAtRevealNode,
  newOpeningFlow,
  type OpeningFlowState,
} from "../logic/narrative";
import { newRunState, type RunState } from "../logic/run-state";
import { DialogueInputService } from "../services/dialogue-input";
import type { DialogueIntent } from "../services/dialogue-input-map";
import { FieldInputService } from "../services/field-input";
import { type FieldIntent } from "../services/field-input-map";
import { eventsCenter } from "../services/events";
import { getRunState, setRunState } from "../services/run-store";
import { DialoguePresenter } from "../ui/dialogue";
import { isVerificationEnabled, verifyBridge } from "../uat/bridge";
import { earnGrist } from "../logic/grist";
import { drawFieldBackdrop } from "./field-chrome";
import { launchOpeningAmbush } from "./field-launch";
import type { OpeningView } from "../uat/opening-view";

/** Fallback cold-start seed when none is supplied via the bridge / `?seed=`. */
const DEFAULT_SEED = 0x9e3779b1;

/** Hosts the Ch.1 opening: Wren in the Marrow + the dialogue presenter over it. */
export class Opening extends Phaser.Scene {
  #presenter!: DialoguePresenter;
  #dialogueInput!: DialogueInputService;
  #fieldInput!: FieldInputService;
  #flow: OpeningFlowState = newOpeningFlow();
  #run: RunState = newRunState();
  /** The cold-start seed this opening hands the tutorial ambush. */
  #seed = DEFAULT_SEED;
  /** Wren's live logical (384×216) center — adapter render state, not sim state. */
  #wrenX: number = FieldLayout.wrenSpawnX;
  #wrenY: number = FieldLayout.wrenSpawnY;
  #wren!: Phaser.GameObjects.Rectangle;
  /** Latched once the narrative end has launched the ambush, so it fires once. */
  #ambushLaunched = false;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Opening);
  }

  /**
   * Build the Marrow backdrop + movable Wren, mount the presenter over the Ch.1
   * script, wire the live dialogue + field input services, top up the shared wallet
   * via the gated `?grist=` seam (so AC3's spend is affordable in one page session),
   * attach the verification bridge, and free every subscription on shutdown.
   * @returns void
   */
  create(): void {
    this.#seed = verifyBridge.takeSeed() ?? DEFAULT_SEED;
    this.#run = this.#seedWallet(getRunState(this.registry));
    this.#flow = newOpeningFlow();
    this.#ambushLaunched = false;
    this.#wrenX = FieldLayout.wrenSpawnX;
    this.#wrenY = FieldLayout.wrenSpawnY;

    drawFieldBackdrop(this);
    this.#buildWren();
    this.add
      .text(GameView.width / 2, 6, "The Marrow", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: FieldColors.roomName,
      })
      .setOrigin(0.5, 0);

    this.#presenter = new DialoguePresenter(
      this,
      CH1_SCRIPT,
      CH1_OPENING_SCENE_ID
    );
    this.#dialogueInput = new DialogueInputService(this);
    this.#fieldInput = new FieldInputService(this);

    eventsCenter.on(DialogueEvents.Intent, this.#onDialogueIntent);
    eventsCenter.on(FieldEvents.Input, this.#onFieldIntent);
    this.#presenter.onChoicePointer((index: number) =>
      this.#dialogueInput.tapChoose(index)
    );

    // Fold the flag if the script opened directly on the reveal node (defensive —
    // the authored opening starts on the hook, but this keeps the rule total).
    this.#maybeFoldReveal();

    verifyBridge.attach(SceneKeys.Opening, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
  }

  /**
   * A verification-only seam (the same one the Bench uses): when the page carries
   * `?grist=N` under `?uat=1`/dev, top the shared wallet up to that balance so the
   * opening's earn→spend draw-down AC (AC3) is affordable within one page session
   * (the slice starts at 10, below the bench sink costs). It only ever ADDS the
   * shortfall via the pure {@link earnGrist} and persists it so every scene observes
   * the same wallet. A no-op without the query, below the current balance, or when
   * verification is disabled — never a public economy bypass.
   * @param run - The run read from the registry.
   * @returns The run, with its wallet topped up to `?grist=N` when the seam applies.
   */
  #seedWallet(run: RunState): RunState {
    if (!isVerificationEnabled() || typeof window === "undefined") {
      return run;
    }
    const raw = new URLSearchParams(window.location.search).get("grist");
    if (raw === null) {
      return run;
    }
    const target = Number(raw);
    if (!Number.isFinite(target) || target <= run.wallet.grist) {
      return run;
    }
    const funded: RunState = {
      ...run,
      wallet: earnGrist(run.wallet, target - run.wallet.grist),
    };
    setRunState(this.registry, funded);
    return funded;
  }

  /**
   * Place Wren's movable placeholder body at her spawn (the same body the Field
   * scene draws), so the opening renders a real, movable Wren in the Marrow.
   * @returns void
   */
  #buildWren(): void {
    this.#wren = this.add.rectangle(
      this.#wrenX,
      this.#wrenY,
      FieldLayout.wrenWidth,
      FieldLayout.wrenHeight,
      FieldColors.wren
    );
  }

  /**
   * Per-frame: walk Wren toward her held direction by the frame delta (clamped to
   * the floor band), then check the two flow transitions — fold the reveal flag the
   * moment the cursor reaches the reveal node, and hand off to the ambush once the
   * narrative has ended. No allocations.
   * @param _time - Absolute time (unused; movement is delta-driven).
   * @param delta - Milliseconds since the last frame.
   * @returns void
   */
  override update(_time: number, delta: number): void {
    const dir = this.#fieldInput.heldDirection();
    const len = Math.hypot(dir.dx, dir.dy);
    if (len > 0) {
      const stepPx = (FieldLayout.moveSpeed * delta) / 1000;
      this.#wrenX += (dir.dx / len) * stepPx;
      this.#wrenY += (dir.dy / len) * stepPx;
      this.#clampWren();
      this.#wren.setPosition(this.#wrenX, this.#wrenY);
    }
    this.#maybeFoldReveal();
    this.#maybeLaunchAmbush();
  }

  /**
   * Clamp Wren's center to the walkable floor band so she can never leave the room
   * (the same bounds the Field scene uses).
   * @returns void
   */
  #clampWren(): void {
    const { edgeInset } = FieldLayout;
    this.#wrenX = Phaser.Math.Clamp(
      this.#wrenX,
      edgeInset,
      GameView.width - edgeInset
    );
    this.#wrenY = Phaser.Math.Clamp(
      this.#wrenY,
      FieldLayout.wallY + edgeInset,
      GameView.height - edgeInset
    );
  }

  /**
   * Translate a semantic dialogue intent into a presenter input and re-publish it on
   * the bus (the exact path the Dialogue scene uses), so the presenter folds it
   * through the pure reducer. A `choose` index is resolved against the current node's
   * choices. A stable arrow field so it unsubscribes by reference on shutdown.
   * @param intent - The semantic dialogue intent (advance / skip / choose).
   * @returns void
   */
  readonly #onDialogueIntent = (intent: DialogueIntent): void => {
    switch (intent.kind) {
      case "advance":
        this.#emitDialogue({ kind: "advance" });
        break;
      case "skip":
        this.#emitDialogue({ kind: "skip" });
        break;
      case "choose": {
        const choice = this.#presenter.model().choices[intent.index];
        if (choice) {
          this.#emitDialogue({ kind: "branch", choiceId: choice.id });
        }
        break;
      }
    }
    // After the presenter folds the input, the cursor may now sit at the reveal node
    // or the narrative may have ended — check both immediately so a bridge-driven
    // advance to the reveal flips the flag without waiting for the next frame.
    this.#maybeFoldReveal();
    this.#maybeLaunchAmbush();
  };

  /**
   * Movement keys are polled each frame in {@link update}; the opening has no
   * examinable props, so non-move field intents are ignored. A stable arrow field so
   * it unsubscribes by reference on shutdown.
   * @param _intent - The semantic field intent (only held movement is consumed).
   * @param _device - The originating device.
   * @returns void
   */
  readonly #onFieldIntent = (_intent: FieldIntent, _device: string): void => {};

  /**
   * Publish one resolved presenter input on the bus — the presenter (subscribed in
   * its constructor) folds it through the pure reducer and re-renders.
   * @param input - The dialogue presenter input (advance / branch / skip).
   * @returns void
   */
  #emitDialogue(input: DialoguePresenterInput): void {
    eventsCenter.emit(DialogueEvents.Input, input);
  }

  /**
   * Fold the `sable-revealed` flag when (and only when) the presenter cursor sits at
   * the Ch.1 reveal node — the "cargo opens to reveal Sable" beat. Folds into the
   * pure opening flow AND writes the serializable narrative-ledger flag (SaveService-
   * safe), so the reveal is data the adapter writes at the reveal beat, never a
   * reducer side effect. Idempotent — folding twice is a no-op.
   * @returns void
   */
  #maybeFoldReveal(): void {
    if (this.#flow.revealed) {
      return;
    }
    if (isAtRevealNode(this.#presenter.state, CH1_SCRIPT)) {
      this.#flow = foldRevealFlag(this.#flow);
      // Mirror the flow flag into the narrative ledger so a save layer persists it.
      this.#presenter.writeFlag(SABLE_REVEALED_FLAG, true);
    }
  }

  /**
   * Hand off to the tutorial ambush once the narrative has ended (the klaxon beat):
   * the reveal has landed and Sable has stirred, so the drop-goes-wrong fight begins
   * immediately after. Launches via the EXISTING Field↔Battle launcher under the
   * cold-start seed (the sim is never forked) and latches so it fires exactly once.
   * @returns void
   */
  #maybeLaunchAmbush(): void {
    if (this.#ambushLaunched || !this.#presenter.done) {
      return;
    }
    this.#ambushLaunched = true;
    launchOpeningAmbush(this, this.registry, this.#run, this.#seed);
  }

  /**
   * The live link handed to the verification bridge: the resolved integer scale,
   * Wren's live position, the rendered dialogue model, the folded reveal flag, the
   * shared grist pool, and the two presenter actions routed as bus intents (the same
   * published-intent path live input uses).
   * @returns The opening view.
   */
  #bridgeView(): OpeningView {
    return {
      resolution: () => {
        const { gameSize, displaySize } = this.scale;
        return {
          width: gameSize.width,
          height: gameSize.height,
          zoom: displaySize.width / gameSize.width,
        };
      },
      wren: () => ({ x: this.#wrenX, y: this.#wrenY }),
      dialogue: () => this.#presenter.model(),
      openingFlow: () => this.#flow.revealed,
      grist: () => this.#run.wallet.grist,
      advance: () => {
        this.#emitDialogue({ kind: "advance" });
        this.#maybeFoldReveal();
        this.#maybeLaunchAmbush();
      },
      skip: () => {
        this.#emitDialogue({ kind: "skip" });
        this.#maybeFoldReveal();
        this.#maybeLaunchAmbush();
      },
    };
  }

  /**
   * Free every external subscription on scene shutdown (the
   * `require-shutdown-cleanup` contract): detach the bridge, unsubscribe both bus
   * listeners, and dispose the input services + the presenter (which removes its own
   * bus listener and choice-button handlers).
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    eventsCenter.off(DialogueEvents.Intent, this.#onDialogueIntent);
    eventsCenter.off(FieldEvents.Input, this.#onFieldIntent);
    this.#dialogueInput.dispose();
    this.#fieldInput.dispose();
    this.#presenter.dispose();
  }
}
