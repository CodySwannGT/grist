/**
 * The dialogue/cutscene presenter — the thin Phaser adapter over the pure
 * presenter state machine (`logic/narrative/presenter`). It owns the on-screen
 * chrome (a bottom caption banner with a portrait slot, the speaker name, and a
 * right-aligned list of branch-choice buttons at a fork) and the bus subscription,
 * but **no** branching logic: it folds device-tagged dialogue intents
 * ({@link DialogueEvents.Input}) through the pure reducer and re-renders from the
 * derived {@link DialogueView}. Captions are full subtitles (no typewriter) per
 * ui-ux-and-controls.
 *
 * Locked-architecture discipline (mirrors `ui/battle-controller`):
 * - All game objects are created once in {@link create}; {@link refresh} only
 *   updates churn-free {@link GuardedText} wrappers and toggles visibility — it
 *   allocates nothing, so a per-frame caller never churns the GC.
 * - Asset/scene/event/style keys come from typed constants — no string literals.
 * - The single bus listener added in {@link create} is removed in {@link dispose};
 *   the owning scene calls `dispose()` from its `shutdown` so the leak gate holds.
 * - No `Math.random` / `Date.now`: advancement is the deterministic pure reducer.
 *
 * The presenter exposes {@link model} (the {@link DialogueView} plus the choice
 * hit-rects) for the UAT bridge to drive advance/branch/skip and assert the
 * rendered caption + speaker + portrait slot under `?uat=1`.
 * @module ui/dialogue
 */
import Phaser from "phaser";
import {
  DialogueColors,
  DialogueEvents,
  DialogueLayout,
  DialogueTextStyles,
  DIALOGUE_DEPTH,
} from "../consts";
import {
  dialogueView,
  initialDialoguePresenter,
  presentDialogue,
  type DialogueChoiceView,
  type DialoguePresenterInput,
  type DialoguePresenterState,
  type SceneDef,
} from "../logic/narrative";
import { eventsCenter } from "../services/events";
import { GuardedText } from "./hud-text";
import { dialogueChoiceRect } from "./dialogue-layout";
import type { Rect } from "./layout";

/** The scene-definition table the presenter plays through, keyed by scene id. */
type SceneTable = Readonly<Record<string, SceneDef>>;

/** The max branch choices the presenter pre-builds button slots for. */
const MAX_CHOICES = 4;

/** One pre-built choice-button slot: its background rect, label, and hit-rect. */
interface ChoiceSlot {
  readonly fill: Phaser.GameObjects.Rectangle;
  readonly label: GuardedText;
  readonly rect: Rect;
}

/** A branch choice as the UAT bridge sees it: id + label + its on-screen hit-rect. */
export interface DialogueChoiceModel {
  readonly id: string;
  readonly label: string;
  readonly rect: Rect;
}

/** The whole dialogue view-model the UAT bridge exposes under `?uat=1`. */
export interface DialogueModel {
  readonly speaker: string;
  readonly caption: string;
  readonly portraitSlot: string;
  readonly branching: boolean;
  readonly done: boolean;
  readonly choices: readonly DialogueChoiceModel[];
}

/**
 * Drives a scripted scene through the presenter UI. Construct with the scene table
 * and the id of the scene to open; the presenter renders the opening node and
 * advances/branches/skips as intents arrive on the bus. A scene that fails to open
 * (unknown/empty) leaves the presenter immediately {@link DialogueView.done}.
 */
export class DialoguePresenter {
  readonly #scene: Phaser.Scene;
  readonly #table: SceneTable;
  #state: DialoguePresenterState;

  #box!: Phaser.GameObjects.Rectangle;
  #portrait!: Phaser.GameObjects.Rectangle;
  #speaker!: GuardedText;
  #caption!: GuardedText;
  #choiceSlots: readonly ChoiceSlot[] = [];

  /**
   * Open `sceneId` from `table` and subscribe to the dialogue intent bus.
   * @param scene - The owning Phaser scene (for the display list + shutdown).
   * @param table - The scene-definition table to play through.
   * @param sceneId - The id of the scene to open the presenter at.
   */
  constructor(scene: Phaser.Scene, table: SceneTable, sceneId: string) {
    this.#scene = scene;
    this.#table = table;
    const opened = initialDialoguePresenter(
      table[sceneId] ?? { id: sceneId, nodes: [] }
    );
    // An unknown/empty scene yields no cursor — start in the terminal done state at
    // the requested scene so the presenter renders nothing rather than crashing.
    this.#state = opened ?? {
      narrative: { sceneId, nodeId: "", flags: {} },
      done: true,
    };
    this.#create();
    eventsCenter.on(DialogueEvents.Input, this.#onInput);
  }

  /**
   * Build every game object once (the box, portrait slot, speaker + caption text,
   * and the pre-allocated choice-button slots), then render the opening node.
   * Nothing here runs per-frame; {@link refresh} only mutates these objects.
   * @returns void
   */
  #create(): void {
    const add = this.#scene.add;
    this.#box = add
      .rectangle(
        DialogueLayout.boxX,
        DialogueLayout.boxY,
        DialogueLayout.boxWidth,
        DialogueLayout.boxHeight,
        DialogueColors.boxFill
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, DialogueColors.boxStroke)
      .setDepth(DIALOGUE_DEPTH);
    this.#portrait = add
      .rectangle(
        DialogueLayout.portraitX,
        DialogueLayout.portraitY,
        DialogueLayout.portraitSize,
        DialogueLayout.portraitSize,
        DialogueColors.portraitFill
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, DialogueColors.portraitStroke)
      .setDepth(DIALOGUE_DEPTH);
    this.#speaker = this.#makeText(
      DialogueLayout.speakerX,
      DialogueLayout.speakerY,
      DialogueTextStyles.speaker
    );
    this.#caption = this.#makeText(
      DialogueLayout.captionX,
      DialogueLayout.captionY,
      DialogueTextStyles.caption
    );
    this.#choiceSlots = Array.from({ length: MAX_CHOICES }, (_unused, index) =>
      this.#makeChoiceSlot(index)
    );
    this.refresh();
  }

  /**
   * Create one depth-stamped {@link GuardedText} at a logical position with a typed
   * style (top-left origin).
   * @param x - Logical x.
   * @param y - Logical y.
   * @param style - The typed Phaser text style.
   * @returns The guarded label.
   */
  #makeText(
    x: number,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): GuardedText {
    const text = this.#scene.add
      .text(x, y, "", style)
      .setOrigin(0, 0)
      .setDepth(DIALOGUE_DEPTH);
    return new GuardedText(text);
  }

  /**
   * Pre-build one branch-choice button slot (background rect + label) at its
   * computed hit-rect. Hidden until a fork populates it.
   * @param index - The choice slot index.
   * @returns The choice slot.
   */
  #makeChoiceSlot(index: number): ChoiceSlot {
    const rect = dialogueChoiceRect(index);
    const fill = this.#scene.add
      .rectangle(
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        DialogueColors.choiceFill
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, DialogueColors.choiceStroke)
      .setDepth(DIALOGUE_DEPTH)
      .setVisible(false);
    const label = this.#makeText(
      rect.x + DialogueLayout.choicePadX,
      rect.y + 4,
      DialogueTextStyles.choice
    );
    label.object.setVisible(false);
    return { fill, label, rect };
  }

  /**
   * Handle one dialogue intent off the bus: fold it through the pure reducer and
   * re-render. A stable arrow field so it unsubscribes by reference in
   * {@link dispose}.
   * @param input - The dialogue presenter input (advance / branch / skip).
   * @returns void
   */
  readonly #onInput = (input: DialoguePresenterInput): void => {
    this.#state = presentDialogue(this.#state, input, this.#table);
    this.refresh();
  };

  /**
   * Re-render the chrome from the current {@link DialogueView}: update the speaker
   * and caption text (guarded — repaints only on change), show the box/portrait
   * while a caption is on screen (so the final line stays visible; only a skip /
   * end blanks it), and populate the choice buttons at a fork. Allocates nothing
   * and is safe to call every frame.
   * @returns void
   */
  refresh(): void {
    const view = dialogueView(this.#state, this.#table);
    const visible = view.caption !== "";
    this.#box.setVisible(visible);
    this.#portrait.setVisible(visible);
    this.#speaker.object.setVisible(visible);
    this.#caption.object.setVisible(visible);
    this.#speaker.set(view.speaker);
    this.#caption.set(view.caption);
    this.#renderChoices(view.choices);
  }

  /**
   * Reveal the choice buttons for the active choices and hide the rest. Reads from
   * the pre-built slots; never allocates a game object.
   * @param choices - The active branch choices (possibly empty).
   * @returns void
   */
  #renderChoices(choices: readonly DialogueChoiceView[]): void {
    this.#choiceSlots.forEach((slot, index) => {
      const choice = choices[index];
      const show = choice !== undefined;
      slot.fill.setVisible(show);
      slot.label.object.setVisible(show);
      if (choice) {
        slot.label.set(choice.label);
      }
    });
  }

  /**
   * The current presenter state (for the owning scene / tests to read).
   * @returns The presenter state.
   */
  get state(): DialoguePresenterState {
    return this.#state;
  }

  /**
   * Whether the narrative has ended (skipped or off its final node).
   * @returns True when done.
   */
  get done(): boolean {
    return dialogueView(this.#state, this.#table).done;
  }

  /**
   * Build the full dialogue view-model for the UAT bridge: the derived
   * {@link DialogueView} plus each active choice's on-screen hit-rect. Allocates —
   * called on demand under `?uat=1`, never from the per-frame render path.
   * @returns The dialogue model.
   */
  model(): DialogueModel {
    const view = dialogueView(this.#state, this.#table);
    return {
      speaker: view.speaker,
      caption: view.caption,
      portraitSlot: view.portraitSlot,
      branching: view.branching,
      done: view.done,
      choices: view.choices.map((choice, index) => ({
        id: choice.id,
        label: choice.label,
        rect: dialogueChoiceRect(index),
      })),
    };
  }

  /**
   * Unsubscribe from the dialogue intent bus. Call from the owning scene's
   * shutdown so the listener never doubles after a scene restart (the leak rule).
   * @returns void
   */
  dispose(): void {
    eventsCenter.off(DialogueEvents.Input, this.#onInput);
  }
}
