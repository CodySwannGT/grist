/**
 * The pause-menu **controls & help** panel view (#228) — a thin Phaser adapter that
 * pools the reference body lines and renders the pure {@link controlsHelpDisplay}
 * output into them, the way {@link import("./ledger-codex-panel").LedgerCodexPanel}
 * renders the Ledger codex. Extracted from the {@link import("../scenes/Menu").Menu}
 * scene so the scene stays under its line budget and the reference's Phaser plumbing
 * lives next to the pure copy it renders (`logic/controls-help`).
 *
 * It owns NO copy — the sections, order, and wording all come from the pure
 * reference; this only lays the resulting lines out (headings in the panel's title
 * color, rows in body text) and holds the rendered strings for the verification
 * bridge to read, so an e2e can prove the panel showed the controls list (Shift, the
 * AP/Grist legend) without inspecting pixels.
 * @module ui/help-panel
 */
import Phaser from "phaser";
import { MenuColors, MenuLayout, MenuTextStyles } from "../menu-consts";
import {
  CONTROLS_HELP_LINE_COUNT,
  controlsHelpDisplay,
} from "../logic/controls-help";

/**
 * Pools the reference body lines and renders the controls help into them. Built
 * once with the scene; {@link show} fills and reveals it, {@link hide} clears it,
 * and {@link lines} returns what is currently shown (null while hidden) — the model
 * the verification bridge surfaces as `menuHelpControls()`.
 */
export class HelpPanel {
  /** The pooled body lines (one per reference display line). */
  readonly #lines: readonly Phaser.GameObjects.Text[];
  /** The reference lines currently shown, or null while hidden. */
  #shown: readonly string[] | null = null;

  /**
   * Build the pooled reference lines under the detail panel, laid out from
   * {@link MenuLayout.codexBodyY} stepping by {@link MenuLayout.codexLineGap} (the
   * same dense body the Ledger codex uses). Hidden until {@link show}.
   * @param scene - The owning scene.
   * @param x - The left x of the panel body (the panel's padded inset).
   */
  constructor(scene: Phaser.Scene, x: number) {
    this.#lines = Array.from(
      { length: CONTROLS_HELP_LINE_COUNT },
      (_unused, line) =>
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
   * Show the controls reference: render each tagged line into a pooled slot,
   * coloring section headings like the panel title and rows like body text.
   * @returns void
   */
  show(): void {
    const display = controlsHelpDisplay();
    this.#shown = display.map(line => line.text);
    this.#lines.forEach((slot, index) => {
      const line = display[index];
      if (line === undefined) {
        slot.setVisible(false).setText("");
        return;
      }
      slot
        .setText(line.text)
        .setColor(line.heading ? MenuColors.panelTitle : MenuColors.panelBody)
        .setVisible(true);
    });
  }

  /**
   * Hide every reference line and forget what was shown (so the bridge read goes
   * null when the panel closes).
   * @returns void
   */
  hide(): void {
    this.#shown = null;
    this.#lines.forEach(slot => slot.setVisible(false).setText(""));
  }

  /**
   * The reference lines currently shown, or null while hidden — the model the
   * verification bridge surfaces.
   * @returns The shown reference lines, or null.
   */
  lines(): readonly string[] | null {
    return this.#shown;
  }
}
