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
import { codexWrapWidth } from "./menu-panel-fit";

/**
 * Pools the codex body lines and renders a projected codex into them. Built once with
 * the scene; `show()` fills it from a codex + karma summary, `hide()` clears it, and
 * `codex()` returns what is currently shown (null while hidden) — the exact model the
 * verification bridge surfaces as `menuLedgerCodex()`.
 */
export class LedgerCodexPanel {
  /** The pooled body lines (karma header + tally + one per catalog row). */
  readonly #lines: readonly Phaser.GameObjects.Text[];
  /** The left x of the panel body (the panel's padded inset) — the flow's x anchor. */
  readonly #x: number;
  /** The codex currently shown, or null while hidden. */
  #codex: LedgerCodexView | null = null;

  /**
   * Build the pooled codex body lines under the detail panel. Each line word-wraps to
   * the panel's inner width ({@link codexWrapWidth}) so a long recorded line never
   * clips the panel's right border (#265); {@link show} then *flows* the lines by their
   * rendered height so a wrapped (multi-row) line never overlaps the next. Hidden until
   * {@link show}.
   * @param scene - The owning scene.
   * @param x - The left x of the panel body (the panel's padded inset).
   * @param slots - The number of body lines to pool (karma header + tally + catalog).
   */
  constructor(scene: Phaser.Scene, x: number, slots: number) {
    this.#x = x;
    this.#lines = Array.from({ length: slots }, (_unused, line) =>
      scene.add
        .text(x, MenuLayout.codexBodyY + line * MenuLayout.codexLineGap, "", {
          ...MenuTextStyles.codexLine,
          wordWrap: { width: codexWrapWidth() },
        })
        .setVisible(false)
    );
  }

  /**
   * Show the projected codex: render the compact karma header, the `Recorded: N of M`
   * tally, and every catalog row (recorded-with-line or pending) into the pooled lines,
   * each wrapped to the panel width and flowed down from {@link MenuLayout.codexBodyY}
   * by its rendered height (so a two-row recorded line pushes the next row down rather
   * than overlapping it). Extra lines beyond the pool are dropped; unused slots are
   * cleared and hidden.
   * @param codex - The projected codex view.
   * @param ledger - The moral ledger summarized in the header.
   * @returns void
   */
  show(codex: LedgerCodexView, ledger: MoralLedger): void {
    this.#codex = codex;
    const text = formatLedgerCodexPanel(codex, ledger);
    // Flow: thread the running y through the pooled lines, advancing past each visible
    // line's rendered (wrapped) height so a two-row line never overlaps the next.
    this.#lines.reduce((cursorY: number, line, index) => {
      const value = text[index] ?? "";
      if (value === "") {
        line.setVisible(false).setText("");
        return cursorY;
      }
      line.setText(value).setPosition(this.#x, cursorY).setVisible(true);
      return cursorY + line.height + MenuLayout.codexRowGap;
    }, MenuLayout.codexBodyY as number);
  }

  /**
   * The right-edge x of the widest visible codex line — its left x plus its rendered
   * (wrapped) width — or null while the codex is hidden. The verification bridge reads
   * this against the panel's inner right bound so an e2e can prove no codex line clips
   * the panel's right border (#265).
   * @returns The widest line's right edge, or null when hidden.
   */
  maxLineRight(): number | null {
    if (this.#codex === null) {
      return null;
    }
    return this.#lines
      .filter(line => line.visible)
      .reduce((max, line) => Math.max(max, line.x + line.width), 0);
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
