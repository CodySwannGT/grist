/**
 * The pause/main-menu slice of the verification (UAT) bridge (#113). Extracted
 * from `uat/bridge.ts` so the bridge stays under its line budget and the menu
 * read/drive surface lives next to the scene it serves — the same split the
 * bench/dialogue cells use. Holds the menu view contract the PauseMenu scene
 * registers, the read-only snapshot the e2e asserts on (the six rendered entries,
 * the highlighted index, and the last opened route), and the pure mapper between
 * them. No Phaser, no gameplay state — a thin test seam.
 * @module uat/pause-menu-view
 */
import { type VerifyResolution } from "./bridge";

/** A read-only snapshot of the pause/main-menu screen for assertions (#113). */
export interface VerifyPauseMenuState {
  readonly scene: string;
  /** The rendered entry labels, top-to-bottom (AC1: exactly the six entries). */
  readonly entries: readonly string[];
  /** The currently-highlighted entry index (keyboard navigation). */
  readonly selectedIndex: number;
  /**
   * The scene key the menu last opened via a confirmed entry, or null before any
   * selection — the AC2 assertion surface (selecting Builds records the Bench key).
   */
  readonly openedRoute: string | null;
}

/**
 * The live link the PauseMenu scene registers with the bridge (#113). Lets the
 * menu e2e read the resolved integer scale (scene-agnostic — the same shape
 * Battle / Field / Bench use), the rendered entry list + highlight + last opened
 * route, and drive the menu without a real pointer: highlight an entry by id,
 * move the highlight, and confirm the highlighted entry (opening its route). Kept
 * separate from the other views so no path constrains the others; the controller
 * stores whichever is attached and dispatches by which is present.
 */
export interface PauseMenuView {
  readonly resolution: () => VerifyResolution;
  readonly entries: () => readonly string[];
  readonly selectedIndex: () => number;
  readonly openedRoute: () => string | null;
  /** Highlight the entry with the given id (a no-op for an unknown id). */
  readonly highlight: (entry: string) => void;
  /** Move the highlight one step (-1 up, +1 down), wrapping around. */
  readonly navigate: (delta: -1 | 1) => void;
  /** Confirm the highlighted entry — opens its route (Builds → the growth screen). */
  readonly confirm: () => void;
}

/**
 * Map an attached {@link PauseMenuView} to its read-only snapshot for the bridge.
 * Internal to {@link PauseMenuCell} — the controller reads snapshots through the cell.
 * @param scene - The active scene key.
 * @param view - The attached pause-menu view.
 * @returns The read-only pause-menu snapshot.
 */
function toVerifyPauseMenuState(
  scene: string,
  view: PauseMenuView
): VerifyPauseMenuState {
  return {
    scene,
    entries: view.entries(),
    selectedIndex: view.selectedIndex(),
    openedRoute: view.openedRoute(),
  };
}

/**
 * The pause-menu slice of the verification controller — holds the attached
 * {@link PauseMenuView}, produces its snapshot, and exposes the view for the
 * bridge to drive menu actions through. Composed by the main `VerifyController`
 * so the menu plumbing lives next to its types (and the bridge stays under its
 * line budget), mirroring the bench cell split. Only the menu view exposes
 * `openedRoute()`, so {@link claims} discriminates it from the other views
 * without a tag field.
 */
export class PauseMenuCell {
  #view: PauseMenuView | null = null;

  /**
   * Whether a freshly-attached gameplay view is a {@link PauseMenuView} (vs the
   * battle/field/bench/dialogue/region shapes). The single discriminating
   * property is `openedRoute`.
   * @param view - The attached gameplay view (any of the view shapes).
   * @returns True when the view is a pause-menu view.
   */
  static claims<T extends object>(view: T): view is T & PauseMenuView {
    return "openedRoute" in view;
  }

  /**
   * Adopt the attached pause-menu view (or clear it with null on a scene change).
   * @param view - The pause-menu view, or null to clear.
   * @returns void
   */
  attach(view: PauseMenuView | null): void {
    this.#view = view;
  }

  /**
   * The pause-menu snapshot for the active scene, or null outside the PauseMenu
   * scene.
   * @param scene - The active scene key.
   * @returns The pause-menu snapshot, or null.
   */
  snapshot(scene: string): VerifyPauseMenuState | null {
    return this.#view ? toVerifyPauseMenuState(scene, this.#view) : null;
  }

  /**
   * The attached pause-menu view, or null — the bridge drives
   * highlight/navigate/confirm straight through it (each a no-op when null).
   * @returns The pause-menu view, or null.
   */
  view(): PauseMenuView | null {
    return this.#view;
  }
}
