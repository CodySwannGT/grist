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
import { AtlasKeys, Frames } from "../assets";
import {
  DialogueEvents,
  DialogueLayout,
  DialogueTextStyles,
  DIALOGUE_DEPTH,
} from "../consts";
import {
  dialogueView,
  initialDialoguePresenter,
  presentDialogue,
  writeLedgerFlag,
  type DialogueChoiceView,
  type DialoguePresenterInput,
  type DialoguePresenterState,
  type NarrativeLedger,
  type SceneDef,
  type SceneFlag,
} from "../logic/narrative";
import { eventsCenter } from "../services/events";
import { GuardedText } from "./hud-text";
import { addPanel, enablePanelTap, PanelTint } from "./chrome";
import { dialogueChoiceFontPx, dialogueChoiceRect } from "./dialogue-layout";
import type { Rect } from "./layout";

/** The scene-definition table the presenter plays through, keyed by scene id. */
type SceneTable = Readonly<Record<string, SceneDef>>;

/** One choice-button slot: its 9-slice panel, label, and hit-rect. */
interface ChoiceSlot {
  readonly fill: Phaser.GameObjects.NineSlice;
  readonly label: GuardedText;
  readonly rect: Rect;
}

/** A pointer handler the owning scene registers for a tapped choice (by index). */
type ChoicePointerHandler = (index: number) => void;

/**
 * Speaker id → portrait frame in the `portraits` atlas. Speakers without an
 * entry (narration, minor voices) show the empty portrait slot — never a wrong
 * face. Extend alongside the cast in `scripts/ingest-assets.mjs`.
 */
const PORTRAIT_FRAMES: Readonly<Record<string, string>> = {
  wren: Frames.portraits.wren,
  tobi: Frames.portraits.tobi,
  sable: Frames.portraits.sable,
  halcyon: Frames.portraits.halcyon,
};

/** A branch choice as the UAT bridge sees it: id + label + its on-screen hit-rect. */
export interface DialogueChoiceModel {
  readonly id: string;
  readonly label: string;
  readonly rect: Rect;
  /**
   * The choice label's **actual** rendered width in logical px (the live Phaser text
   * object's width, after the fit-to-button font step). Carried on the model so the
   * finale-choice-fit e2e can assert every ending label fits inside its button and the
   * visible viewport with real browser monospace metrics, not an estimate (#262).
   */
  readonly labelWidth: number;
}

/** The whole dialogue view-model the UAT bridge exposes under `?uat=1`. */
export interface DialogueModel {
  readonly speaker: string;
  readonly caption: string;
  readonly portraitSlot: string;
  readonly branching: boolean;
  readonly done: boolean;
  readonly choices: readonly DialogueChoiceModel[];
  /**
   * The live narrative-ledger flags (e.g. the Ch.1 `sable-revealed` flag the
   * scene folds at the reveal node). Carried on the model so the verification
   * bridge can assert "the hook landed" without a separate bridge surface (#105).
   */
  readonly flags: NarrativeLedger;
  /**
   * The current node's declared **quiet beat** in milliseconds, or 0 when the line
   * carries none (#114 AC3). Surfaced on the model so the reveal-beat e2e can assert
   * the Sable-reveal node holds a deliberate, non-trivial beat on the live canvas.
   */
  readonly beatMs: number;
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

  #box!: Phaser.GameObjects.NineSlice;
  #portrait!: Phaser.GameObjects.NineSlice;
  /** The speaker's faceset, shown over the portrait slot for known speakers. */
  #portraitImage!: Phaser.GameObjects.Image;
  #speaker!: GuardedText;
  #caption!: GuardedText;
  // The choice-button slot pool. Grown on demand to the largest fork seen so far
  // (no fixed cap → no choice is ever silently dropped) and reused thereafter, so
  // steady-state renders allocate nothing. Index i always draws choice i.
  #choiceSlots: ChoiceSlot[] = [];
  #onChoicePointer: ChoicePointerHandler | null = null;

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
    this.#box = addPanel(
      this.#scene,
      DialogueLayout.boxX,
      DialogueLayout.boxY,
      DialogueLayout.boxWidth,
      DialogueLayout.boxHeight
    )
      .setOrigin(0, 0)
      .setDepth(DIALOGUE_DEPTH);
    this.#portrait = addPanel(
      this.#scene,
      DialogueLayout.portraitX,
      DialogueLayout.portraitY,
      DialogueLayout.portraitSize,
      DialogueLayout.portraitSize
    )
      .setOrigin(0, 0)
      .setTint(PanelTint.active)
      .setDepth(DIALOGUE_DEPTH);
    this.#portraitImage = add
      .image(
        DialogueLayout.portraitX + DialogueLayout.portraitSize / 2,
        DialogueLayout.portraitY + DialogueLayout.portraitSize / 2,
        AtlasKeys.portraits,
        PORTRAIT_FRAMES["wren"]
      )
      .setDisplaySize(DialogueLayout.portraitSize, DialogueLayout.portraitSize)
      .setDepth(DIALOGUE_DEPTH)
      .setVisible(false);
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
    // Choice slots are NOT pre-allocated to a fixed count; the pool grows to the
    // node with the most choices the first time it is shown (see #ensureSlots), so
    // a script with any number of choices renders every one of them.
    this.refresh();
  }

  /**
   * Register the scene's pointer handler for a tapped choice button (the touch
   * path). Called once after construction; the handler receives the tapped choice
   * index, which the scene routes through its semantic input layer.
   * @param handler - The per-index tap handler.
   * @returns void
   */
  onChoicePointer(handler: ChoicePointerHandler): void {
    this.#onChoicePointer = handler;
  }

  /**
   * Grow the choice-slot pool until it has at least `count` slots. Idempotent and
   * monotonic — it only ever appends (never reallocates existing slots), so once a
   * fork of N choices has been shown, re-rendering it allocates nothing.
   * @param count - The number of slots required for the current node.
   * @returns void
   */
  #ensureSlots(count: number): void {
    while (this.#choiceSlots.length < count) {
      this.#choiceSlots.push(this.#makeChoiceSlot(this.#choiceSlots.length));
    }
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
    const fill = addPanel(this.#scene, rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setDepth(DIALOGUE_DEPTH)
      .setVisible(false);
    // The touch path: a tapped choice button reports its index to the scene's
    // pointer handler (set via onChoicePointer), which routes it through the
    // semantic input layer — the same intent a number-key press produces.
    enablePanelTap(fill, rect.width, rect.height, () =>
      this.#onChoicePointer?.(index)
    );
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
    const portraitFrame = PORTRAIT_FRAMES[view.speaker];
    this.#portraitImage.setVisible(visible && portraitFrame !== undefined);
    if (
      portraitFrame !== undefined &&
      this.#portraitImage.frame.name !== portraitFrame
    ) {
      this.#portraitImage.setFrame(portraitFrame);
    }
    this.#speaker.object.setVisible(visible);
    this.#caption.object.setVisible(visible);
    this.#speaker.set(view.speaker);
    this.#caption.set(view.caption);
    this.#renderChoices(view.choices);
  }

  /**
   * Grow the slot pool to the choice count, then reveal a button for each active
   * choice and hide any surplus slots. Because the pool is grown to `choices.length`
   * first, **every** choice is rendered and selectable — none is silently dropped,
   * however many a fork offers. Growth only happens the first time a larger fork is
   * shown; thereafter this allocates nothing.
   * @param choices - The active branch choices (possibly empty).
   * @returns void
   */
  #renderChoices(choices: readonly DialogueChoiceView[]): void {
    this.#ensureSlots(choices.length);
    this.#choiceSlots.forEach((slot, index) => {
      const choice = choices[index];
      const show = choice !== undefined;
      slot.fill.setVisible(show);
      slot.label.object.setVisible(show);
      if (choice) {
        slot.label.set(choice.label);
        // Fit the label to the button: base font when it fits the inner width,
        // shrunk by whole pixels (to the legible floor) otherwise — so no authored
        // choice, however long, clips the button or the right screen edge (#262).
        slot.label.object.setFontSize(dialogueChoiceFontPx(choice.label));
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
   * The id of the dialogue node the presenter cursor currently addresses (the
   * underlying narrative cursor). The owning scene reads this after a driven
   * advance to detect when an authored beat — e.g. the Ch.1 reveal node — has been
   * reached, so it can fold the matching ledger flag at the adapter level (reducers
   * never auto-write flags). Empty once a skip has cleared the cursor.
   * @returns The current node id.
   */
  get nodeId(): string {
    return this.#state.narrative.nodeId;
  }

  /**
   * Fold one named, serializable ledger flag into the presenter's narrative state
   * via the pure {@link writeLedgerFlag} reducer. This is the **adapter-level** flag
   * write the architecture reserves for the scene (the pure presenter/scene reducers
   * never auto-write flags): the Ch.1 scene calls this when the cursor reaches the
   * reveal node to record that the hook has landed. Mutates nothing — it swaps in a
   * fresh state with the flag folded — and re-renders so the model reflects it.
   * @param name - The flag name to write (e.g. the Ch.1 `sable-revealed` flag).
   * @param value - The serializable flag value.
   * @returns void
   */
  writeFlag(name: string, value: SceneFlag): void {
    this.#state = {
      ...this.#state,
      narrative: writeLedgerFlag(this.#state.narrative, name, value),
    };
    this.refresh();
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
        // The live text object's width reflects the fit-to-button font applied in
        // refresh(); 0 before the fork has rendered its slots (never on a live fork).
        labelWidth: this.#choiceSlots[index]?.label.object.width ?? 0,
      })),
      flags: this.#state.narrative.flags,
      // The node's declared quiet beat (#114 AC3), or 0 on a line that carries none —
      // under exactOptionalPropertyTypes the pure view omits `beatMs` on ordinary lines.
      beatMs: view.beatMs ?? 0,
    };
  }

  /**
   * Unsubscribe from the dialogue input bus and tear down the choice buttons'
   * pointer listeners. Call from the owning scene's shutdown so neither the bus
   * listener nor the per-button pointer handlers double after a scene restart (the
   * leak rule). The scene's own display objects die with the scene; the bus
   * listener and the registered choice-pointer handler do not, so they are freed
   * explicitly here.
   * @returns void
   */
  dispose(): void {
    eventsCenter.off(DialogueEvents.Input, this.#onInput);
    for (const slot of this.#choiceSlots) {
      slot.fill.off(Phaser.Input.Events.POINTER_DOWN);
    }
    this.#onChoicePointer = null;
  }
}
