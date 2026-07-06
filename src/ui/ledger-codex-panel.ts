/**
 * The Ledger **codex** panel view (sub-task #221): a thin Phaser adapter that pools
 * the codex body's text lines and renders the pure {@link formatLedgerCodexPanel}
 * output into them. Extracted from the {@link import("../scenes/Menu").Menu} scene so
 * the scene stays under its line budget and the codex's Phaser plumbing lives next to
 * the pure formatter it renders (`ui/ledger-codex`). It owns NO codex rules — the
 * order, the recorded/pending resolution, the tally, and the wording all come from the
 * pure projection/formatter; this only lays the resulting lines out and holds the
 * projected {@link LedgerCodexView} for the verification bridge to read.
 * @module ui/ledger-codex-panel
 */
import Phaser from "phaser";
import { MenuLayout, MenuTextStyles } from "../menu-consts";
import type { LedgerCodexView } from "../logic/narrative";
import type { MoralLedger } from "../logic/save/types";
import { formatLedgerCodexPanel } from "./ledger-codex";

/**
 * Pools the codex body lines and renders a projected codex into them. Built once with
 * the scene; `show()` fills it from a codex + karma summary, `hide()` clears it, and
 * `codex()` returns what is currently shown (null while hidden) — the exact model the
 * verification bridge surfaces as `menuLedgerCodex()`.
 */
export class LedgerCodexPanel {
  /** The pooled body lines (karma header + tally + one per catalog row). */
  readonly #lines: readonly Phaser.GameObjects.Text[];
  /** The codex currently shown, or null while hidden. */
  #codex: LedgerCodexView | null = null;

  /**
   * Build the pooled codex body lines under the detail panel, laid out from
   * {@link MenuLayout.codexBodyY} stepping by {@link MenuLayout.codexLineGap}. Hidden
   * until {@link show}.
   * @param scene - The owning scene.
   * @param x - The left x of the panel body (the panel's padded inset).
   * @param slots - The number of body lines to pool (karma header + tally + catalog).
   */
  constructor(scene: Phaser.Scene, x: number, slots: number) {
    this.#lines = Array.from({ length: slots }, (_unused, line) =>
      scene.add
        .text(
          x,
          MenuLayout.codexBodyY + line * MenuLayout.codexLineGap,
          "",
          MenuTextStyles.codexLine
        )
        .setVisible(false)
    );
  }

  /**
   * Show the projected codex: render the karma header, the `Recorded: N of M` tally,
   * and every catalog row (recorded-with-line or pending) into the pooled lines. Extra
   * lines beyond the pool are dropped; unused slots are cleared and hidden.
   * @param codex - The projected codex view.
   * @param ledger - The moral ledger summarized in the header.
   * @returns void
   */
  show(codex: LedgerCodexView, ledger: MoralLedger): void {
    this.#codex = codex;
    const text = formatLedgerCodexPanel(codex, ledger);
    this.#lines.forEach((line, index) => {
      const value = text[index] ?? "";
      line.setText(value).setVisible(value !== "");
    });
  }

  /**
   * Hide every codex line and forget the shown codex (so the bridge read goes null).
   * @returns void
   */
  hide(): void {
    this.#codex = null;
    this.#lines.forEach(line => line.setVisible(false).setText(""));
  }

  /**
   * The codex currently shown, or null while hidden — the model the verification
   * bridge surfaces.
   * @returns The shown codex view, or null.
   */
  codex(): LedgerCodexView | null {
    return this.#codex;
  }
}
