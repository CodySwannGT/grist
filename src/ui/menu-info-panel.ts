/**
 * The pause-menu **info panel** view — the reusable detail-panel chrome (the 9-slice
 * box, the title, and the four pooled body lines) the Menu scene opens for a
 * description entry (Items) and reuses as the framed title + fallback surface behind
 * the denser body panels (the Ledger codex #221, the controls & help #228, and the
 * Party roster #249). Extracted from the {@link import("../scenes/Menu").Menu} scene so
 * the scene stays under its line budget and the info panel's Phaser plumbing lives in
 * one place, the way {@link import("./help-panel").HelpPanel} and the ledger / party
 * panels were split out.
 *
 * It owns NO menu rules — it only lays out the frame and renders the title + up to
 * {@link INFO_PANEL_LINE_SLOTS} caller-supplied lines; the scene decides *when* to show
 * the frame alone (a dense body panel fills the rest) versus the framed description.
 * @module ui/menu-info-panel
 */
import Phaser from "phaser";
import { MenuLayout, MenuTextStyles } from "../menu-consts";
import { addPanel } from "./chrome";
import { menuPanelInnerWidth } from "./menu-panel-fit";

/** The number of body lines the info panel can show at once. */
const INFO_PANEL_LINE_SLOTS = 4;

/**
 * Pools the detail-panel chrome (box, title, body lines) and renders a title + lines
 * into it. Built once with the scene; {@link showFrame} reveals the framed title,
 * {@link show} fills the body, {@link clear} empties the body, and {@link hide} hides
 * the whole panel.
 */
export class MenuInfoPanel {
  /** The 9-slice panel box. */
  readonly #box: Phaser.GameObjects.NineSlice;
  /** The panel title. */
  readonly #title: Phaser.GameObjects.Text;
  /** The pooled body lines (set/cleared on render). */
  readonly #lines: readonly Phaser.GameObjects.Text[];

  /**
   * Build the panel box, title, and pooled body lines, hidden until a caller shows
   * them. Laid out from {@link MenuLayout}.
   * @param scene - The owning scene.
   */
  constructor(scene: Phaser.Scene) {
    this.#box = addPanel(
      scene,
      MenuLayout.panelX,
      MenuLayout.panelY,
      MenuLayout.panelWidth,
      MenuLayout.panelHeight
    ).setOrigin(0, 0);
    this.#title = scene.add.text(
      MenuLayout.panelX + MenuLayout.panelPadX,
      MenuLayout.panelTitleY,
      "",
      MenuTextStyles.panelTitle
    );
    this.#lines = Array.from(
      { length: INFO_PANEL_LINE_SLOTS },
      (_unused, line) =>
        scene.add.text(
          MenuLayout.panelX + MenuLayout.panelPadX,
          MenuLayout.panelBodyY + line * MenuLayout.panelLineGap,
          "",
          {
            ...MenuTextStyles.panelBody,
            wordWrap: { width: menuPanelInnerWidth() },
          }
        )
    );
  }

  /**
   * Show the panel frame (box + title) without touching the body lines — the state the
   * dense body panels (codex / help / party) sit inside.
   * @param title - The panel title.
   * @returns void
   */
  showFrame(title: string): void {
    this.#box.setVisible(true);
    this.#title.setVisible(true).setText(title);
  }

  /**
   * Hide and clear the four body lines (used when a dense body panel fills the frame
   * instead, or before re-showing a description).
   * @returns void
   */
  clear(): void {
    this.#lines.forEach(line => line.setVisible(false).setText(""));
  }

  /**
   * Show the framed panel with a title and up to {@link INFO_PANEL_LINE_SLOTS} body
   * lines (extra lines are dropped; unused slots are cleared).
   * @param title - The panel title.
   * @param lines - The body lines to render.
   * @returns void
   */
  show(title: string, lines: readonly string[]): void {
    this.showFrame(title);
    this.#lines.forEach((line, index) => {
      line.setVisible(true).setText(lines[index] ?? "");
    });
  }

  /**
   * Hide the whole panel and clear its retained text.
   * @returns void
   */
  hide(): void {
    this.#box.setVisible(false);
    this.#title.setVisible(false).setText("");
    this.clear();
  }
}
