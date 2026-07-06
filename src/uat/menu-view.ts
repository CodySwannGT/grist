/**
 * The pause/main-menu slice of the verification (UAT) bridge (sub-task #221). The
 * Menu scene had no bridge view of its own (#113 left the full `__VERIFY__` menu
 * surface to a later sub-task); this adds the seam the Ledger **codex** panel needs —
 * the {@link LedgerCodexView} the scene projected from the persisted save when the
 * player opened the Ledger route. Extracted next to the scene it serves, the way the
 * bench / dialogue cells are, so the bridge stays under its line budget.
 *
 * The read is null until the Ledger panel has opened and loaded its codex, so an e2e
 * polls `menuLedgerCodex()` until it resolves — proving the panel opened AND the model
 * it rendered (the recorded/pending rows + the `Recorded: N of M` tally) in one read.
 * No Phaser, no gameplay state — a thin test seam.
 * @module uat/menu-view
 */
import type { LedgerCodexView } from "../logic/narrative";

/**
 * The live link the Menu scene registers with the bridge (#221). The scene exposes
 * the codex it projected for the open Ledger panel (or null when no Ledger panel is
 * open / its save has not resolved yet). Kept separate from the gameplay views so no
 * path constrains the others; the controller stores whichever view is attached and
 * dispatches by which is present. Only the menu view exposes `ledgerCodex`, so
 * {@link MenuCell.claims} discriminates it without a tag field.
 */
export interface MenuView {
  /** The codex the open Ledger panel rendered, or null when none is open/loaded. */
  readonly ledgerCodex: () => LedgerCodexView | null;
}

/**
 * The menu slice of the verification controller — holds the attached {@link MenuView}
 * and reads the Ledger codex through it. Composed by the main `VerifyController` so
 * the menu plumbing lives next to its type, mirroring the bench cell split.
 */
export class MenuCell {
  #view: MenuView | null = null;

  /**
   * Whether a freshly-attached view is a {@link MenuView} (vs the gameplay shapes).
   * The single discriminating property is `ledgerCodex`.
   * @param view - The attached view (any of the registered shapes).
   * @returns True when the view is a menu view.
   */
  static claims<T extends object>(view: T): view is T & MenuView {
    return "ledgerCodex" in view;
  }

  /**
   * Adopt the attached menu view (or clear it with null on a scene change).
   * @param view - The menu view, or null to clear.
   * @returns void
   */
  attach(view: MenuView | null): void {
    this.#view = view;
  }

  /**
   * The codex the open Ledger panel rendered, or null outside the Menu scene / before
   * a Ledger panel has loaded.
   * @returns The codex view, or null.
   */
  ledgerCodex(): LedgerCodexView | null {
    return this.#view?.ledgerCodex() ?? null;
  }
}
