/**
 * The dialogue-presenter slice of the verification (UAT) bridge (#104). Extracted
 * from `uat/bridge.ts` so the bridge stays under its line budget and the dialogue
 * read/drive surface lives next to the presenter it serves — the same split the
 * bench and world-state cells use. Holds the dialogue view contract the Dialogue
 * scene registers, the read-only snapshot the opening e2e asserts on, the pure
 * mapper between them, and a tiny verification-only demo script (NOT game content —
 * scene content is #93/#97/#98) the scene plays so an agent can exercise advance /
 * branch / skip + captions on the live canvas. No gameplay state — a thin test seam.
 * @module uat/dialogue-view
 */
import type { SceneDef } from "../logic/narrative";
import type { DialogueModel } from "../ui/dialogue";
import { type VerifyResolution } from "./bridge";

/**
 * One branch choice in the verification snapshot: its stable `id` (what
 * `branchDialogue` selects on) alongside the player-facing `label`. Keeping the id
 * — not just the label — lets the UAT contract drive arbitrary authored forks and
 * disambiguate duplicate / localized labels without hard-coding fixture internals.
 */
interface VerifyDialogueChoice {
  readonly id: string;
  readonly label: string;
}

/** A read-only snapshot of the dialogue presenter for assertions (#104). */
export interface VerifyDialogueState {
  readonly scene: string;
  /** The current speaker content id. */
  readonly speaker: string;
  /** The full caption line currently shown ("" once done). */
  readonly caption: string;
  /** The portrait-slot content id rendered beside the caption. */
  readonly portraitSlot: string;
  /** Whether the current node is a fork offering choices. */
  readonly branching: boolean;
  /** Whether the narrative has ended (skipped or off its final node). */
  readonly done: boolean;
  /** The active branch choices — id + label (empty on a linear / ended node). */
  readonly choices: readonly VerifyDialogueChoice[];
}

/**
 * The live link the Dialogue scene registers with the bridge (#104). Lets the
 * opening e2e read the resolved integer scale (scene-agnostic — the same shape
 * Battle / Field / Bench use) and the rendered dialogue model, and drive the three
 * presenter actions: advance the caption, take a branch choice by id, and skip the
 * rest. Kept separate from the other gameplay views so no path constrains the
 * others; the controller stores whichever is attached and dispatches by which is
 * present. Only the dialogue view exposes `dialogue()`, so {@link DialogueCell.claims}
 * discriminates it without a tag field.
 */
export interface DialogueView {
  readonly resolution: () => VerifyResolution;
  /** The rendered dialogue model (speaker, caption, portrait, choices, done). */
  readonly dialogue: () => DialogueModel;
  /** Advance the caption one node (or cross scenes at a scene's end). */
  readonly advance: () => void;
  /** Take the branch choice with this id at a fork (a no-op otherwise). */
  readonly branch: (choiceId: string) => void;
  /** Skip the rest of the narrative (jump to done). */
  readonly skip: () => void;
}

/**
 * Map an attached {@link DialogueView} to its read-only snapshot for the bridge.
 * Internal to {@link DialogueCell} — the controller reads snapshots through the cell.
 * @param scene - The active scene key.
 * @param view - The attached dialogue view.
 * @returns The read-only dialogue snapshot.
 */
function toVerifyDialogueState(
  scene: string,
  view: DialogueView
): VerifyDialogueState {
  const model = view.dialogue();
  return {
    scene,
    speaker: model.speaker,
    caption: model.caption,
    portraitSlot: model.portraitSlot,
    branching: model.branching,
    done: model.done,
    choices: model.choices.map(choice => ({
      id: choice.id,
      label: choice.label,
    })),
  };
}

/**
 * The dialogue slice of the verification controller — holds the attached
 * {@link DialogueView}, produces its snapshot, and exposes the view for the bridge
 * to drive advance/branch/skip through. Composed by the main `VerifyController` so
 * the dialogue plumbing lives next to its types (and the bridge stays under its
 * line budget), mirroring the bench cell. Only the dialogue view exposes
 * `dialogue()`, so {@link claims} discriminates it from the other gameplay views.
 */
export class DialogueCell {
  #view: DialogueView | null = null;

  /**
   * Whether a freshly-attached gameplay view is a {@link DialogueView} (vs the
   * battle/field/bench shapes). The single discriminating property is `dialogue`.
   * @param view - The attached gameplay view (any of the shapes).
   * @returns True when the view is a dialogue view.
   */
  static claims<T extends object>(view: T): view is T & DialogueView {
    return "dialogue" in view;
  }

  /**
   * Adopt the attached dialogue view (or clear it with null on a scene change).
   * @param view - The dialogue view, or null to clear.
   * @returns void
   */
  attach(view: DialogueView | null): void {
    this.#view = view;
  }

  /**
   * The dialogue snapshot for the active scene, or null outside the Dialogue scene.
   * @param scene - The active scene key.
   * @returns The dialogue snapshot, or null.
   */
  snapshot(scene: string): VerifyDialogueState | null {
    return this.#view ? toVerifyDialogueState(scene, this.#view) : null;
  }

  /**
   * The attached dialogue view, or null — the bridge drives advance/branch/skip
   * straight through it (each a no-op when null).
   * @returns The dialogue view, or null.
   */
  view(): DialogueView | null {
    return this.#view;
  }
}

/** The dialogue slice of the `window.__VERIFY__` surface (#104). */
export interface DialogueApi {
  /** A snapshot of the dialogue presenter, or null outside the Dialogue scene. */
  readonly dialogue: () => VerifyDialogueState | null;
  /** Advance the dialogue presenter one caption (or cross scenes at a scene's end). */
  readonly advanceDialogue: () => void;
  /** Take the dialogue branch choice with this id at a fork (a no-op otherwise). */
  readonly branchDialogue: (choiceId: string) => void;
  /** Skip the rest of the dialogue (jump to done). */
  readonly skipDialogue: () => void;
}

/**
 * Build the dialogue slice of the verification API, bound to a {@link DialogueCell}
 * and a live scene-key reader. Spread into `window.__VERIFY__` by the bridge so the
 * four dialogue entry points live next to the cell they drive (keeping `uat/bridge`
 * under its line budget, like the rest of the cell split).
 * @param cell - The dialogue cell holding the attached view.
 * @param scene - A reader for the active scene key (for the snapshot's `scene`).
 * @returns The dialogue verification API slice.
 */
export function dialogueApi(
  cell: DialogueCell,
  scene: () => string
): DialogueApi {
  return {
    dialogue: () => cell.snapshot(scene()),
    advanceDialogue: () => cell.view()?.advance(),
    branchDialogue: (choiceId: string) => cell.view()?.branch(choiceId),
    skipDialogue: () => cell.view()?.skip(),
  };
}

// Verification-only demo script ids (hoisted so the repeated literals across the
// fixture below don't trip the no-duplicate-string lint).
const OPENING = "opening";
const FORK = "fork";
const FREED = "freed";
const WIELDED = "wielded";
const WREN = "wren";
const TOBI = "tobi";

/**
 * A tiny two-leg demo script the Dialogue scene plays under `?uat=1` so the opening
 * e2e can exercise the presenter end-to-end: a linear opening (two captioned
 * lines), a fork (free vs. wield — the slice's moral beat) crossing to one of two
 * terminal scenes. This is a **verification fixture**, not authored game content
 * (PD-3.2 opening / PD-3.6 recruitment author the real scripts) — it exists only to
 * drive advance / branch / skip + captions deterministically on the live canvas.
 * @returns The demo scene-definition table keyed by scene id.
 */
export function demoDialogueScript(): Readonly<Record<string, SceneDef>> {
  return {
    [OPENING]: {
      id: OPENING,
      nodes: [
        {
          id: "open",
          speaker: WREN,
          text: "The Drip stirs in the marrow.",
          next: "reply",
        },
        { id: "reply", speaker: TOBI, text: "Then we move." },
      ],
      nextScene: FORK,
    },
    [FORK]: {
      id: FORK,
      nodes: [
        {
          id: "choose",
          speaker: WREN,
          text: "Free the shard, or wield it?",
          portrait: WREN,
          choices: [
            { id: FREED, label: "Free it", to: FREED },
            { id: WIELDED, label: "Wield it", to: WIELDED },
          ],
        },
      ],
    },
    [FREED]: {
      id: FREED,
      nodes: [{ id: "end", speaker: WREN, text: "The shard drifts free." }],
    },
    [WIELDED]: {
      id: WIELDED,
      nodes: [
        { id: "end", speaker: WREN, text: "The shard answers your hand." },
      ],
    },
  };
}

/** The id of the demo script's opening scene the Dialogue scene starts at. */
export const DEMO_DIALOGUE_OPENING = OPENING;
