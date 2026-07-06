/**
 * The Field-scene HUD widget (PD-3.3 / #107): a thin Phaser renderer over the
 * pure field-HUD model (`logic/field/hud`). It owns three quiet, always-correct
 * surfaces and nothing else:
 *
 * - **Persistent grist readout** (top-left, grist-gold) — the player should
 *   always feel the wallet (ui-ux-and-controls). Driven each frame through a
 *   churn-free {@link GuardedText}, so a static balance repaints nothing.
 * - **Context prompt** — a floating "[E] examine <prop>" that appears only while
 *   Wren is in range of the current room's interactable, hidden otherwise.
 * - **Summonable mini-map** — a centered overlay of the descent's room nodes
 *   (A→B→C, each marked current / visited / unvisited), toggled on/off. It is
 *   summonable, not always-on, so the screen stays contemplative; a top-right
 *   "[M] map" hint advertises the summon.
 *
 * The widget holds NO field rules: it is handed the current room, the in-range
 * flag, the grist balance, and the field state, and renders the pure model the
 * logic layer derives. It builds Phaser objects on construction and frees nothing
 * itself — the objects belong to the scene's display list and die with the scene;
 * the widget creates no external bus/timer subscriptions of its own. Reuses the
 * `src/ui` HUD-text primitive ({@link makeText} / {@link GuardedText}).
 * @module scenes/field-hud
 */
import Phaser from "phaser";
import { HUD_DEPTH } from "../consts";
import {
  FieldHudColors,
  FieldHudLayout,
  FieldHudTextStyles,
} from "./field-hud-layout";
import { type MarrowRoomId } from "../content/map";
import {
  RoomVisitStates,
  contextPromptFor,
  gristReadoutLabel,
  miniMapModel,
  type FieldState,
  type MiniMapNode,
  type RoomVisitState,
} from "../logic/field";
import { GuardedText, makeText } from "../ui/hud-text";

/** A pre-built mini-map node row: its marker dot and its (guarded) label. */
interface NodeRow {
  readonly marker: Phaser.GameObjects.Arc;
  readonly label: GuardedText;
}

/** The per-visit-state marker fill color. */
const NODE_FILL: Readonly<Record<RoomVisitState, number>> = {
  [RoomVisitStates.current]: FieldHudColors.nodeCurrentFill,
  [RoomVisitStates.visited]: FieldHudColors.nodeVisitedFill,
  [RoomVisitStates.unvisited]: FieldHudColors.nodeUnvisitedFill,
};

/** The per-visit-state label text color. */
const NODE_TEXT: Readonly<Record<RoomVisitState, string>> = {
  [RoomVisitStates.current]: FieldHudColors.nodeCurrentText,
  [RoomVisitStates.visited]: FieldHudColors.nodeVisitedText,
  [RoomVisitStates.unvisited]: FieldHudColors.nodeUnvisitedText,
};

/** The summon-hint label (advertises the mini-map toggle key). */
const MAP_HINT = "[M] map";
/** The pause-menu opener hint (advertises the Esc opener, #233). */
const MENU_HINT = "[Esc] menu";
/** The mini-map overlay title. */
const MAP_TITLE = "Marrow";

/**
 * Builds and drives the Field HUD. Construct once in the scene's `create` (after
 * the backdrop and props); call {@link sync} every frame with the live grist,
 * room, and in-range flag; call {@link setMiniMapOpen} when the toggle intent
 * fires. The mini-map overlay is hidden until summoned.
 */
export class FieldHud {
  readonly #grist: GuardedText;
  readonly #prompt: GuardedText;
  readonly #mapPanel: Phaser.GameObjects.Rectangle;
  readonly #mapTitle: Phaser.GameObjects.Text;
  readonly #nodeRows: readonly NodeRow[];
  /** The summon hint (kept so it can be hidden while the map is open). */
  readonly #hint: Phaser.GameObjects.Text;
  /** The pause-menu opener hint (#233), stacked under the map hint, top-right. */
  readonly #menuHint: Phaser.GameObjects.Text;
  /** The summonable-map button hit-rect (top-right), for touch summon. */
  readonly #summonButton: Phaser.GameObjects.Rectangle;
  #mapOpen = false;

  /**
   * Build the HUD surfaces on the scene's display list. The grist readout and
   * summon hint are immediately visible; the context prompt and mini-map overlay
   * start hidden (the prompt is contextual; the map is summonable).
   * @param scene - The owning Field scene.
   * @param onSummon - Called when the touch summon button is tapped.
   */
  constructor(scene: Phaser.Scene, onSummon: () => void) {
    this.#grist = makeText(
      scene,
      FieldHudLayout.gristX,
      FieldHudLayout.gristY,
      0,
      0
    );
    this.#grist.object.setStyle(FieldHudTextStyles.grist).setDepth(HUD_DEPTH);

    this.#hint = scene.add
      .text(
        FieldHudLayout.hintRightX,
        FieldHudLayout.hintY,
        MAP_HINT,
        FieldHudTextStyles.hint
      )
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    // The pause-menu opener hint (#233), same chrome style, stacked just under the
    // map hint so both discoverable openers sit together in the top-right corner.
    this.#menuHint = scene.add
      .text(
        FieldHudLayout.hintRightX,
        FieldHudLayout.menuHintY,
        MENU_HINT,
        FieldHudTextStyles.hint
      )
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    // A transparent hit-rect over the hint so touch players can summon the map.
    this.#summonButton = scene.add
      .rectangle(
        FieldHudLayout.hintRightX,
        FieldHudLayout.hintY,
        48,
        14,
        0x000000,
        0
      )
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH)
      .setInteractive({ useHandCursor: true });
    this.#summonButton.on(Phaser.Input.Events.POINTER_DOWN, onSummon);

    this.#prompt = makeText(
      scene,
      FieldHudLayout.promptX,
      FieldHudLayout.promptY,
      0.5,
      0.5
    );
    this.#prompt.object
      .setStyle(FieldHudTextStyles.contextPrompt)
      .setDepth(HUD_DEPTH)
      .setVisible(false);

    const map = this.#buildMiniMap(scene);
    this.#mapPanel = map.panel;
    this.#mapTitle = map.title;
    this.#nodeRows = map.rows;
  }

  /**
   * Build the (initially hidden) mini-map overlay: a centered panel, a title, and
   * one marker + guarded label per room node. The rows are filled by {@link sync}.
   * @param scene - The owning scene.
   * @returns The panel, title, and node rows.
   */
  #buildMiniMap(scene: Phaser.Scene): {
    readonly panel: Phaser.GameObjects.Rectangle;
    readonly title: Phaser.GameObjects.Text;
    readonly rows: readonly NodeRow[];
  } {
    const panel = scene.add
      .rectangle(
        FieldHudLayout.mapPanelX,
        FieldHudLayout.mapPanelY,
        FieldHudLayout.mapPanelWidth,
        FieldHudLayout.mapPanelHeight,
        FieldHudColors.mapPanelFill
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FieldHudColors.mapPanelStroke)
      .setDepth(FieldHudLayout.mapDepth)
      .setVisible(false);
    const title = scene.add
      .text(
        FieldHudLayout.mapPanelX + FieldHudLayout.mapPanelWidth / 2,
        FieldHudLayout.mapTitleY,
        MAP_TITLE,
        FieldHudTextStyles.mapTitle
      )
      .setOrigin(0.5, 0)
      .setDepth(FieldHudLayout.mapDepth)
      .setVisible(false);
    return { panel, title, rows: this.#buildNodeRows(scene) };
  }

  /**
   * Build one marker + guarded label per descent room node. Positions are fixed
   * (the descent is a fixed 3-room ladder); colors/labels are set in {@link sync}.
   * @param scene - The owning scene.
   * @returns The node rows in descent order.
   */
  #buildNodeRows(scene: Phaser.Scene): readonly NodeRow[] {
    const count = 3;
    return Array.from({ length: count }, (_unused, index) => {
      const y = FieldHudLayout.mapFirstNodeY + index * FieldHudLayout.mapRowH;
      const marker = scene.add
        .circle(
          FieldHudLayout.mapNodeX,
          y,
          FieldHudLayout.mapNodeRadius,
          FieldHudColors.nodeUnvisitedFill
        )
        .setDepth(FieldHudLayout.mapDepth)
        .setVisible(false);
      const label = makeText(
        scene,
        FieldHudLayout.mapNodeX + FieldHudLayout.mapLabelDx,
        y,
        0,
        0.5
      );
      label.object
        .setStyle(FieldHudTextStyles.mapNode)
        .setDepth(FieldHudLayout.mapDepth)
        .setVisible(false);
      return { marker, label };
    });
  }

  /**
   * Refresh the HUD from the live state: repaint the persistent grist readout,
   * surface/hide the context prompt for the in-range interactable, and (when the
   * mini-map is open) repaint each node from the pure model. The grist and prompt
   * repaint only on change (guarded text), so a steady field frame allocates and
   * repaints nothing.
   * @param state - The current field session state.
   * @param grist - The shared wallet's grist balance.
   * @param room - The room Wren is currently in.
   * @param examinableProp - The current room's examinable prop id, or null.
   * @param inRange - Whether Wren is within the prop's examine radius.
   * @returns void
   */
  sync(
    state: FieldState,
    grist: number,
    room: MarrowRoomId,
    examinableProp: string | null,
    inRange: boolean
  ): void {
    this.#grist.set(gristReadoutLabel(grist));

    const prompt = contextPromptFor(room, examinableProp, inRange);
    this.#prompt.object.setVisible(prompt !== null);
    if (prompt !== null) {
      this.#prompt.set(prompt);
    }

    if (this.#mapOpen) {
      this.#renderNodes(miniMapModel(state));
    }
  }

  /**
   * Paint each mini-map node row from the model: marker fill + label text/color
   * by visit state. Only invoked while the overlay is open.
   * @param nodes - The ordered mini-map nodes.
   * @returns void
   */
  #renderNodes(nodes: readonly MiniMapNode[]): void {
    nodes.forEach((node, index) => {
      const row = this.#nodeRows[index];
      if (!row) {
        return;
      }
      row.marker.setFillStyle(NODE_FILL[node.state]);
      row.label.set(node.name, NODE_TEXT[node.state]);
    });
  }

  /**
   * Show or hide the summonable mini-map overlay (and its node rows). The summon
   * hint is hidden while the map is open (it would be redundant) and restored
   * when it closes. Mirrors the pure toggle's resulting flag onto visibility.
   * @param open - Whether the mini-map should be visible.
   * @returns void
   */
  setMiniMapOpen(open: boolean): void {
    this.#mapOpen = open;
    this.#mapPanel.setVisible(open);
    this.#mapTitle.setVisible(open);
    this.#hint.setVisible(!open);
    this.#menuHint.setVisible(!open);
    this.#nodeRows.forEach(row => {
      row.marker.setVisible(open);
      row.label.object.setVisible(open);
    });
  }

  /**
   * Whether the mini-map overlay is currently summoned.
   * @returns True when the mini-map is open.
   */
  get miniMapOpen(): boolean {
    return this.#mapOpen;
  }
}
