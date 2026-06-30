/**
 * The Ch.1 OPENING slice of the verification (UAT) bridge (#105, PD-3.2). Extracted
 * from `uat/bridge.ts` so the bridge stays under its line budget and the opening
 * read/drive surface lives next to the scene it serves — the same cell split the
 * bench / dialogue / region / world-state cells use. Holds the opening view contract
 * the Opening scene registers, the read-only snapshot the opening e2e asserts on
 * (Wren's position, the rendered dialogue beat, the `sable-revealed` flag, the
 * shared grist pool), the pure mapper between them, and the cell + api factory the
 * bridge composes. No gameplay state — a thin test seam.
 *
 * The opening e2e drives the cold-start beats through this seam: read the resolved
 * 384×216 integer scale + Wren in the Marrow (AC1), advance the dialogue to the
 * reveal and observe `sableRevealed` flip (AC2), then let the narrative end so the
 * scene hands off to the tutorial ambush (AC2/AC3). Every action is routed through
 * the same path live input uses, so a bridge-driven change is end-to-end proof.
 * @module uat/opening-view
 */
import type { DialogueModel } from "../ui/dialogue";
import { type VerifyResolution } from "./bridge";

/** A read-only snapshot of Wren's logical (384×216) position in the opening. */
export interface VerifyOpeningPosition {
  /** Wren's logical x in the 384×216 space. */
  readonly x: number;
  /** Wren's logical y in the 384×216 space. */
  readonly y: number;
}

/** A read-only snapshot of the running Ch.1 opening for assertions (#105). */
export interface VerifyOpeningState {
  /** The active scene key. */
  readonly scene: string;
  /** Wren's live logical position (asserted to change after a move). */
  readonly wren: VerifyOpeningPosition;
  /** The current speaker content id of the dialogue beat on screen. */
  readonly speaker: string;
  /** The full caption line currently shown ("" once the narrative ends). */
  readonly caption: string;
  /** Whether the cursor has reached the reveal node and folded the flag. */
  readonly sableRevealed: boolean;
  /** Whether the opening narrative has ended (the ambush-handoff cue). */
  readonly done: boolean;
  /** The shared run-state grist pool the opening carries (AC3 earn/spend base). */
  readonly grist: number;
}

/**
 * The live link the Opening scene registers with the bridge (#105). Lets the
 * opening e2e read the resolved integer scale (the scene-agnostic shape battle /
 * field / bench use), Wren's live position, the rendered dialogue model, the
 * folded `sable-revealed` flag, and the shared grist pool — and drive the dialogue
 * (advance the caption, skip the rest). Only the opening view exposes `openingFlow`,
 * so {@link OpeningCell.claims} discriminates it from the other gameplay views
 * without a tag field.
 */
export interface OpeningView {
  readonly resolution: () => VerifyResolution;
  /** Wren's live logical position. */
  readonly wren: () => VerifyOpeningPosition;
  /** The rendered dialogue model (speaker, caption, done). */
  readonly dialogue: () => DialogueModel;
  /** Whether the reveal flag has been folded (the discriminating property). */
  readonly openingFlow: () => boolean;
  /** The shared run-state grist pool the opening carries. */
  readonly grist: () => number;
  /** Advance the opening dialogue one beat (handing off to the ambush at its end). */
  readonly advance: () => void;
  /** Skip the rest of the opening dialogue (jump to the ambush handoff). */
  readonly skip: () => void;
}

/**
 * Map an attached {@link OpeningView} to its read-only snapshot for the bridge.
 * @param scene - The active scene key.
 * @param view - The attached opening view.
 * @returns The read-only opening snapshot.
 */
function toVerifyOpeningState(
  scene: string,
  view: OpeningView
): VerifyOpeningState {
  const model = view.dialogue();
  return {
    scene,
    wren: view.wren(),
    speaker: model.speaker,
    caption: model.caption,
    sableRevealed: view.openingFlow(),
    done: model.done,
    grist: view.grist(),
  };
}

/**
 * The opening slice of the verification controller — holds the attached
 * {@link OpeningView}, produces its snapshot, and exposes the view for the bridge to
 * drive advance/skip through. Composed by the main `VerifyController` so the opening
 * plumbing lives next to its types (and the bridge stays under its line budget),
 * mirroring the dialogue cell. Only the opening view exposes `openingFlow`, so
 * {@link claims} discriminates it from the other gameplay views.
 */
export class OpeningCell {
  #view: OpeningView | null = null;

  /**
   * Whether a freshly-attached gameplay view is an {@link OpeningView} (vs the
   * battle/field/bench/dialogue/region shapes). The single discriminating property
   * is `openingFlow`.
   * @param view - The attached gameplay view (any of the shapes).
   * @returns True when the view is an opening view.
   */
  static claims<T extends object>(view: T): view is T & OpeningView {
    return "openingFlow" in view;
  }

  /**
   * Adopt the attached opening view (or clear it with null on a scene change).
   * @param view - The opening view, or null to clear.
   * @returns void
   */
  attach(view: OpeningView | null): void {
    this.#view = view;
  }

  /**
   * The opening snapshot for the active scene, or null outside the Opening scene.
   * @param scene - The active scene key.
   * @returns The opening snapshot, or null.
   */
  snapshot(scene: string): VerifyOpeningState | null {
    return this.#view ? toVerifyOpeningState(scene, this.#view) : null;
  }

  /**
   * The integer render scale the attached opening view resolved, or null outside
   * the Opening scene — so the bridge's scene-agnostic `resolution()` serves the
   * opening too.
   * @returns The resolution snapshot, or null.
   */
  resolution(): VerifyResolution | null {
    return this.#view?.resolution() ?? null;
  }

  /**
   * The attached opening view, or null — the bridge drives advance/skip straight
   * through it (each a no-op when null).
   * @returns The opening view, or null.
   */
  view(): OpeningView | null {
    return this.#view;
  }
}

/** The opening slice of the `window.__VERIFY__` surface (#105). */
export interface OpeningApi {
  /** A snapshot of the Ch.1 opening, or null outside the Opening scene. */
  readonly opening: () => VerifyOpeningState | null;
  /** Advance the opening dialogue one beat (the ambush fires at its end). */
  readonly advanceOpening: () => void;
  /** Skip the rest of the opening dialogue (jump to the ambush handoff). */
  readonly skipOpening: () => void;
}

/**
 * Build the opening slice of the verification API, bound to an {@link OpeningCell}
 * and a live scene-key reader. Spread into `window.__VERIFY__` by the bridge so the
 * three opening entry points live next to the cell they drive (keeping `uat/bridge`
 * under its line budget, like the rest of the cell split).
 * @param cell - The opening cell holding the attached view.
 * @param scene - A reader for the active scene key (for the snapshot's `scene`).
 * @returns The opening verification API slice.
 */
export function openingApi(cell: OpeningCell, scene: () => string): OpeningApi {
  return {
    opening: () => cell.snapshot(scene()),
    advanceOpening: () => cell.view()?.advance(),
    skipOpening: () => cell.view()?.skip(),
  };
}
