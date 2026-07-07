/**
 * The **World Map roster painter** (#241) — the thin Phaser renderer the World Map
 * scene draws its navigable entry column with. It owns no rules: it pools a fixed
 * {@link WorldMapLayout.maxRows} row panels + labels (no per-render allocation), a
 * moving selection cursor, plus a bottom detail line and the grist / world-state
 * readouts, and paints them from the row views the scene computes off the pure surface
 * projection + cursor. Mirrors the shared `ui/*` painter convention (the bench /
 * help-panel split) so the scene stays a thin adapter.
 * @module ui/world-map-panel
 */
import Phaser from "phaser";
import { GameView } from "../consts";
import {
  WorldMapColors,
  WorldMapLayout,
  WorldMapTextStyles,
} from "../world-map-consts";
import { addCursor, addPanel, enablePanelTap } from "./chrome";

/** One row's presentation, computed by the scene from a surface entry + the cursor. */
export interface WorldMapRowView {
  /** The row label (e.g. "The Marrow Reach — AVAILABLE"). */
  readonly label: string;
  /** The row panel tint (a {@link PanelTint} value graded by status). */
  readonly tint: number;
  /** The label text color. */
  readonly labelColor: string;
}

/** The pointer callbacks the World Map scene wires to the panel (keyboard mirrors these). */
interface WorldMapPanelCallbacks {
  /** Tap a row: focus + select the entry at that index. */
  readonly onSelectRow: (index: number) => void;
  /** Tap the controls hint: back / close the map. */
  readonly onBack: () => void;
}

/** Renders the World Map's pooled entry rows, selection cursor, detail line, and readouts. */
export class WorldMapPanel {
  readonly #rows: readonly {
    readonly panel: Phaser.GameObjects.NineSlice;
    readonly label: Phaser.GameObjects.Text;
  }[];
  readonly #cursor: Phaser.GameObjects.Image;
  readonly #grist: Phaser.GameObjects.Text;
  readonly #state: Phaser.GameObjects.Text;
  readonly #detail: Phaser.GameObjects.Text;

  /**
   * Build the static chrome (backdrop, title, grist + world-state readouts, the bottom
   * hint with a tap target) and pool {@link WorldMapLayout.maxRows} hidden row panels +
   * labels + a selection cursor. Each row is a tap target and the hint is a Back tap
   * target, so the pointer path drives the same actions the keyboard does (#239).
   * @param scene - The owning World Map scene.
   * @param callbacks - The row-select / back pointer handlers.
   */
  constructor(scene: Phaser.Scene, callbacks: WorldMapPanelCallbacks) {
    scene.cameras.main.setBackgroundColor(WorldMapColors.backdrop);
    scene.add
      .text(GameView.width / 2, WorldMapLayout.titleY, "World Map — Travel", {
        ...WorldMapTextStyles.title,
      })
      .setOrigin(0.5, 0);
    this.#grist = scene.add.text(
      WorldMapLayout.gristX,
      WorldMapLayout.gristY,
      "",
      { ...WorldMapTextStyles.grist }
    );
    this.#state = scene.add
      .text(WorldMapLayout.stateX, WorldMapLayout.stateY, "", {
        ...WorldMapTextStyles.state,
      })
      .setOrigin(1, 0);
    scene.add
      .text(
        GameView.width / 2,
        WorldMapLayout.hintY,
        "[Enter] travel · [Esc] back",
        { ...WorldMapTextStyles.hint }
      )
      .setOrigin(0.5);
    // A transparent hit-rect over the hint gives touch players a Back exit (the Menu
    // pointer-parity trick), so the surface is never a dead end.
    scene.add
      .rectangle(GameView.width / 2, WorldMapLayout.hintY, 160, 14, 0x000000, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, callbacks.onBack);
    this.#detail = scene.add.text(
      WorldMapLayout.rowX,
      WorldMapLayout.detailY,
      "",
      { ...WorldMapTextStyles.detail }
    );
    this.#rows = Array.from({ length: WorldMapLayout.maxRows }, (_u, index) => {
      const y = WorldMapLayout.firstRowY + index * WorldMapLayout.rowGap;
      const panel = addPanel(
        scene,
        WorldMapLayout.rowCenterX,
        y + WorldMapLayout.rowHeight / 2,
        WorldMapLayout.rowWidth,
        WorldMapLayout.rowHeight
      )
        .setOrigin(0.5)
        .setVisible(false);
      enablePanelTap(
        panel,
        WorldMapLayout.rowWidth,
        WorldMapLayout.rowHeight,
        () => callbacks.onSelectRow(index)
      );
      const label = scene.add
        .text(WorldMapLayout.rowX + 8, y + 2, "", { ...WorldMapTextStyles.row })
        .setVisible(false);
      return { panel, label };
    });
    this.#cursor = addCursor(scene, 0, 0, -Math.PI / 2).setVisible(false);
  }

  /**
   * Free the row + hint tap listeners (the `require-shutdown-cleanup` contract) — the
   * scene calls this from its SHUTDOWN handler.
   * @returns void
   */
  destroy(): void {
    this.#rows.forEach(row => row.panel.off(Phaser.Input.Events.POINTER_DOWN));
  }

  /**
   * Paint the rows, the grist / world-state readouts, the focused entry's detail line,
   * and the selection cursor at the focused row. Rows beyond `rows.length` are hidden.
   * @param rows - The row views to render, in order.
   * @param focus - The focused row index (the cursor rests here).
   * @param grist - The player's grist balance.
   * @param worldState - The live world-state label.
   * @param detail - The focused entry's detail/cue text.
   * @returns void
   */
  render(
    rows: readonly WorldMapRowView[],
    focus: number,
    grist: number,
    worldState: string,
    detail: string
  ): void {
    this.#grist.setText(`Grist ${grist}`);
    this.#state.setText(worldState === "ashfall" ? "ASHFALL" : "REACH");
    this.#detail.setText(detail);
    this.#rows.forEach((row, index) => {
      const view = rows[index];
      if (view === undefined) {
        row.panel.setVisible(false);
        row.label.setVisible(false);
        return;
      }
      row.panel.setVisible(true).setTint(view.tint);
      row.label.setVisible(true).setText(view.label).setColor(view.labelColor);
    });
    const focusY =
      WorldMapLayout.firstRowY +
      focus * WorldMapLayout.rowGap +
      WorldMapLayout.rowHeight / 2;
    this.#cursor
      .setVisible(focus >= 0 && focus < rows.length)
      .setPosition(WorldMapLayout.rowX, focusY);
  }
}
