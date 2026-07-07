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
  miniMapLockCue,
  miniMapModel,
  miniMapNodeLabel,
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
/** The travel front-door hint (advertises the World Map opener, #261). */
const TRAVEL_HINT = "[T] travel";
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
  /** The footer "why is the next node locked" cue line (#250). */
  readonly #mapDetail: GuardedText;
  /** The summon hint (kept so it can be hidden while the map is open). */
  readonly #hint: Phaser.GameObjects.Text;
  /** The pause-menu opener hint (#233), stacked under the map hint, top-right. */
  readonly #menuHint: Phaser.GameObjects.Text;
  /** The World Map travel hint (#261), stacked under the menu hint, top-right. */
  readonly #travelHint: Phaser.GameObjects.Text;
  /** The once-per-save travel signpost banner (#261), hidden until surfaced. */
  readonly #onboarding: Phaser.GameObjects.Text;
  #mapOpen = false;

  /**
   * Build the HUD surfaces on the scene's display list. The grist readout and
   * summon hint are immediately visible; the context prompt and mini-map overlay
   * start hidden (the prompt is contextual; the map is summonable).
   * @param scene - The owning Field scene.
   * @param onSummon - Called when the touch summon button is tapped.
   * @param onOpenMenu - Called when the touch menu-opener button is tapped (#233).
   * @param onTravel - Called when the touch travel button is tapped (#261).
   */
  constructor(
    scene: Phaser.Scene,
    onSummon: () => void,
    onOpenMenu: () => void,
    onTravel: () => void
  ) {
    this.#grist = makeText(
      scene,
      FieldHudLayout.gristX,
      FieldHudLayout.gristY,
      0,
      0
    );
    this.#grist.object.setStyle(FieldHudTextStyles.grist).setDepth(HUD_DEPTH);

    // Three stacked top-right hints — "[M] map", "[Esc] menu" (#233), and "[T] travel"
    // (#261) — each with a matching transparent hit-rect so touch players (no keyboard)
    // get every opener. The rects are sized to `hintHitHeight` so they never overlap,
    // keeping each opener independently tappable; the menu and travel taps are ignored
    // while the map is open (its overlay takes the screen).
    this.#hint = hintText(scene, FieldHudLayout.hintY, MAP_HINT);
    this.#menuHint = hintText(scene, FieldHudLayout.menuHintY, MENU_HINT);
    this.#travelHint = hintText(scene, FieldHudLayout.travelHintY, TRAVEL_HINT);
    hintButton(scene, FieldHudLayout.hintY, onSummon);
    hintButton(scene, FieldHudLayout.menuHintY, () => {
      if (!this.#mapOpen) {
        onOpenMenu();
      }
    });
    hintButton(scene, FieldHudLayout.travelHintY, () => {
      if (!this.#mapOpen) {
        onTravel();
      }
    });

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
    this.#mapDetail = map.detail;

    // The once-per-save travel signpost (#261) — built hidden, surfaced by
    // #showOnboarding when the player first lands in the intro Field, dismissed on
    // their first input. A plain centered line above the bottom examine band.
    this.#onboarding = scene.add
      .text(
        FieldHudLayout.onboardingX,
        FieldHudLayout.onboardingY,
        "",
        FieldHudTextStyles.onboarding
      )
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setVisible(false);
  }

  /**
   * Surface the once-per-save travel signpost banner (#261): the first-landing hint
   * that tells a dead-ended new player how to reach the World Map. Shown by the scene
   * only when the pure onboarding flag is unseen and the hint gate allows it.
   * @param text - The hint copy to show.
   * @returns void
   */
  showOnboarding(text: string): void {
    this.#onboarding.setText(text).setVisible(true);
  }

  /**
   * Dismiss the travel signpost banner (#261) — called on the player's first input, so
   * the hint never lingers over play. Idempotent.
   * @returns void
   */
  hideOnboarding(): void {
    this.#onboarding.setVisible(false);
  }

  /**
   * The travel signpost copy currently on screen, or null when the banner is hidden
   * (#261) — the model the verification bridge surfaces so an e2e can prove it shows
   * once and then clears, without a separate flag on the scene.
   * @returns The visible hint text, or null.
   */
  onboardingText(): string | null {
    return this.#onboarding.visible ? this.#onboarding.text : null;
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
    readonly detail: GuardedText;
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
    // The footer "why is the next node locked" cue, centered under the node list
    // (#250) — a churn-free guarded text so a steady map repaints nothing.
    const detail = makeText(
      scene,
      FieldHudLayout.mapPanelX + FieldHudLayout.mapPanelWidth / 2,
      FieldHudLayout.mapDetailY,
      0.5,
      0.5
    );
    detail.object
      .setStyle(FieldHudTextStyles.mapDetail)
      .setDepth(FieldHudLayout.mapDepth)
      .setVisible(false);
    return { panel, title, rows: this.#buildNodeRows(scene), detail };
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
   * @param loreVisible - Whether the examine lore banner is currently on screen
   *   (the context prompt is suppressed while it is, so the two never overlap — #234).
   * @returns void
   */
  sync(
    state: FieldState,
    grist: number,
    room: MarrowRoomId,
    examinableProp: string | null,
    inRange: boolean,
    loreVisible: boolean
  ): void {
    this.#grist.set(gristReadoutLabel(grist));

    const prompt = contextPromptFor(room, examinableProp, inRange, loreVisible);
    this.#prompt.object.setVisible(prompt !== null);
    if (prompt !== null) {
      this.#prompt.set(prompt);
    }

    if (this.#mapOpen) {
      this.#renderNodes(miniMapModel(state));
    }
  }

  /**
   * Paint each mini-map node row from the model: marker fill + label (with the
   * "— LOCKED" tag on a locked node) / color by visit state, then the footer cue
   * that explains the next locked node — so a dimmed node no longer dead-airs a
   * curious player (#250). Only invoked while the overlay is open.
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
      row.label.set(miniMapNodeLabel(node), NODE_TEXT[node.state]);
    });
    const cue = miniMapLockCue(nodes);
    this.#mapDetail.object.setVisible(cue !== "");
    if (cue !== "") {
      this.#mapDetail.set(cue);
    }
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
    this.#travelHint.setVisible(!open);
    this.#nodeRows.forEach(row => {
      row.marker.setVisible(open);
      row.label.object.setVisible(open);
    });
    // The footer cue is re-shown (and re-set) by the next sync's #renderNodes when
    // there is a locked node; closing the map always hides it.
    if (!open) {
      this.#mapDetail.object.setVisible(false);
    }
  }

  /**
   * Whether the mini-map overlay is currently summoned.
   * @returns True when the mini-map is open.
   */
  get miniMapOpen(): boolean {
    return this.#mapOpen;
  }
}

/**
 * Build one right-aligned top-right hint label in the shared HUD chrome style.
 * @param scene - The owning scene.
 * @param y - The hint's top Y (logical px).
 * @param label - The hint text (e.g. "[M] map").
 * @returns The hint text object.
 */
function hintText(
  scene: Phaser.Scene,
  y: number,
  label: string
): Phaser.GameObjects.Text {
  return scene.add
    .text(FieldHudLayout.hintRightX, y, label, FieldHudTextStyles.hint)
    .setOrigin(1, 0)
    .setDepth(HUD_DEPTH);
}

/**
 * Build one transparent, interactive touch hit-rect over a top-right hint (#233).
 * Sized to `hintHitHeight` so stacked hints never share a hit area.
 * @param scene - The owning scene.
 * @param y - The hit-rect's top Y (logical px), matching its hint.
 * @param onTap - The pointer-down handler.
 * @returns The interactive hit-rect.
 */
function hintButton(
  scene: Phaser.Scene,
  y: number,
  onTap: () => void
): Phaser.GameObjects.Rectangle {
  const button = scene.add
    .rectangle(
      FieldHudLayout.hintRightX,
      y,
      FieldHudLayout.hintHitWidth,
      FieldHudLayout.hintHitHeight,
      0x000000,
      0
    )
    .setOrigin(1, 0)
    .setDepth(HUD_DEPTH)
    .setInteractive({ useHandCursor: true });
  button.on(Phaser.Input.Events.POINTER_DOWN, onTap);
  return button;
}
