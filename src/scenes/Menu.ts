/**
 * Menu (pause/main menu) scene — the thin Phaser adapter for sub-task #113 (Story
 * #99 / PD-3.8, PRD #42 FR7 + AC9/AC10). It owns NO menu rules: the pure
 * {@link import("../logic/pause-menu") pause-menu model} holds the six entries
 * (Party, Builds, Items, Ledger, Map, System/Settings), their display order, the
 * route each resolves to, and the ring-wrapping cursor; this scene RENDERS that
 * model and maps a confirmed route to an effect — most importantly **Builds → the
 * existing Phase-2 growth screen** (`scene.start(SceneKeys.Bench)`, #76), reused
 * rather than re-spec'd, and **Ledger → the moral ledger** (#98), surfaced in a
 * side panel from the persisted save.
 *
 * Input arrives as semantic {@link MenuIntent}s from the pure
 * {@link keyToMenuIntent} map (the scene reads "confirm"/"up", never a raw key
 * code); the keyboard subscription is the scene's one external listener and is
 * freed on shutdown (`require-shutdown-cleanup`). The menu is event-driven, so it
 * has no `update()` and makes no per-frame allocations. Reached on demand via
 * `?scene=menu`; the full `__VERIFY__` bridge surface + e2e are the verification
 * sub-task (#117).
 * @module scenes/Menu
 */
import Phaser from "phaser";
import { GameView, SceneKeys } from "../consts";
import { MenuColors, MenuLayout, MenuTextStyles } from "../menu-consts";
import {
  PAUSE_MENU_ENTRIES,
  PauseMenuEntryIds,
  formatMoralLedger,
  moveCursor,
  newPauseMenuState,
  selectedEntry,
  type PauseMenuEntry,
  type PauseMenuEntryId,
  type PauseMenuRoute,
  type PauseMenuState,
} from "../logic/pause-menu";
import { keyToMenuIntent, type MenuIntent } from "../services/menu-input-map";
import { saveService } from "../services/save-service";
import { verifyBridge } from "../uat/bridge";

/** The number of body lines the reusable detail panel can show at once. */
const PANEL_LINE_SLOTS = 4;

/**
 * The short descriptive copy each in-menu panel entry shows (Party / Items / Map /
 * System-Settings) — entries without a dedicated scene yet. Builds and Ledger have
 * their own effects and are not keyed here.
 */
const PANEL_DESCRIPTIONS: Readonly<Record<string, readonly string[]>> = {
  [PauseMenuEntryIds.party]: ["Your party roster and bonds."],
  [PauseMenuEntryIds.items]: ["Carried items and key relics."],
  [PauseMenuEntryIds.map]: ["The world map and waypoints."],
  [PauseMenuEntryIds.system]: ["Settings, save, and audio."],
};

/** Renders the pause/main menu from the pure model and routes confirmed entries. */
export class Menu extends Phaser.Scene {
  /** The live cursor state of the menu (which entry is focused). */
  #state: PauseMenuState = newPauseMenuState();
  /** The entry whose detail panel is open, or null when the panel is hidden. */
  #openPanel: PauseMenuEntryId | null = null;
  /** The pooled per-entry label texts, parallel to {@link PAUSE_MENU_ENTRIES}. */
  #entryLabels: readonly Phaser.GameObjects.Text[] = [];
  #caret!: Phaser.GameObjects.Text;
  #panelBox!: Phaser.GameObjects.Rectangle;
  #panelTitle!: Phaser.GameObjects.Text;
  /** The pooled detail-panel body lines (text set/cleared on render). */
  #panelLines: readonly Phaser.GameObjects.Text[] = [];

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Menu);
  }

  /**
   * Build the static chrome (title, the six stacked entry labels, the cursor
   * caret, the detail panel, the controls hint), subscribe the keyboard, register
   * the scene with the verification bridge, and render the initial state.
   * @returns void
   */
  create(): void {
    this.cameras.main.setBackgroundColor(MenuColors.backdrop);
    this.#buildTitle();
    this.#entryLabels = PAUSE_MENU_ENTRIES.map((entry, row) =>
      this.#buildEntry(entry, row)
    );
    this.#caret = this.add
      .text(
        MenuLayout.caretX,
        MenuLayout.firstEntryY,
        "▶",
        MenuTextStyles.entry
      )
      .setOrigin(0.5);
    this.#buildPanel();
    this.#buildHint();

    this.input.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKey
    );
    verifyBridge.attach(SceneKeys.Menu, null);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());

    this.#render();
  }

  /**
   * Build the centered title banner.
   * @returns void
   */
  #buildTitle(): void {
    this.add
      .text(GameView.width / 2, MenuLayout.titleY, "Menu", MenuTextStyles.title)
      .setOrigin(0.5, 0);
  }

  /**
   * Build one entry label at the given row (its color is set per focus on render).
   * @param entry - The entry this label renders.
   * @param row - The zero-based row index (stacks downward by `rowGap`).
   * @returns The pooled label text.
   */
  #buildEntry(entry: PauseMenuEntry, row: number): Phaser.GameObjects.Text {
    const y = MenuLayout.firstEntryY + row * MenuLayout.rowGap;
    return this.add
      .text(MenuLayout.entryX, y, entry.label, MenuTextStyles.entry)
      .setOrigin(0.5);
  }

  /**
   * Build the reusable detail panel (box, title, pooled body lines), hidden until
   * an entry is confirmed.
   * @returns void
   */
  #buildPanel(): void {
    this.#panelBox = this.add
      .rectangle(
        MenuLayout.panelX,
        MenuLayout.panelY,
        MenuLayout.panelWidth,
        MenuLayout.panelHeight,
        MenuColors.panelFill
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, MenuColors.panelStroke);
    this.#panelTitle = this.add.text(
      MenuLayout.panelX + MenuLayout.panelPadX,
      MenuLayout.panelTitleY,
      "",
      MenuTextStyles.panelTitle
    );
    this.#panelLines = Array.from(
      { length: PANEL_LINE_SLOTS },
      (_unused, line) =>
        this.add.text(
          MenuLayout.panelX + MenuLayout.panelPadX,
          MenuLayout.panelBodyY + line * MenuLayout.panelLineGap,
          "",
          MenuTextStyles.panelBody
        )
    );
  }

  /**
   * Build the bottom controls hint.
   * @returns void
   */
  #buildHint(): void {
    this.add
      .text(
        GameView.width / 2,
        MenuLayout.hintY,
        "↑↓ move   ·   Enter open   ·   Esc close",
        MenuTextStyles.hint
      )
      .setOrigin(0.5);
  }

  /**
   * Translate a key press into a {@link MenuIntent} via the pure map and apply it:
   * up/down move the cursor (closing any open panel), confirm dispatches the
   * focused entry's route, and cancel closes an open panel. A stable arrow field
   * so it can be unsubscribed on shutdown. Unbound keys are ignored.
   * @param event - The raw keyboard event Phaser forwards.
   * @returns void
   */
  readonly #onKey = (event: KeyboardEvent): void => {
    const intent: MenuIntent | null = keyToMenuIntent(event.code);
    if (intent === null) {
      return;
    }
    if (intent.kind === "up" || intent.kind === "down") {
      this.#state = moveCursor(this.#state, intent.kind === "up" ? -1 : 1);
      this.#openPanel = null;
      this.#render();
      return;
    }
    if (intent.kind === "cancel") {
      this.#openPanel = null;
      this.#render();
      return;
    }
    this.#confirm(selectedEntry(this.#state));
  };

  /**
   * Dispatch a confirmed entry's route: **growth** opens the existing Phase-2
   * growth screen (the Bench, #76) — the reuse acceptance criterion — **ledger**
   * surfaces the moral ledger (#98) in the side panel from the persisted save, and
   * a **panel** route opens that entry's in-menu info panel.
   * @param entry - The focused entry being confirmed.
   * @returns void
   */
  #confirm(entry: PauseMenuEntry): void {
    const route: PauseMenuRoute = entry.route;
    if (route.kind === "growth") {
      this.scene.start(SceneKeys.Bench);
      return;
    }
    if (route.kind === "ledger") {
      this.#openPanel = entry.id;
      this.#render();
      void this.#loadLedger();
      return;
    }
    this.#openPanel = route.panel;
    this.#render();
  }

  /**
   * Read the moral ledger from the persisted save and, while the Ledger panel is
   * still the open one, render its summary (#98). Guarded against a panel the
   * player has since closed or changed so a late load never clobbers the view.
   * @returns A promise that resolves once the ledger has been read and rendered.
   */
  async #loadLedger(): Promise<void> {
    try {
      const save = await saveService.load();
      if (this.#openPanel !== PauseMenuEntryIds.ledger) {
        return;
      }
      this.#showPanel("Ledger", formatMoralLedger(save.moralLedger));
    } catch {
      if (this.#openPanel === PauseMenuEntryIds.ledger) {
        this.#showPanel("Ledger", ["Unable to load ledger."]);
      }
    }
  }

  /**
   * Render the whole screen from the live model: recolor each entry by focus, park
   * the caret beside the focused entry, and show/hide the detail panel. Pure read
   * of `this.#state` / `this.#openPanel`.
   * @returns void
   */
  #render(): void {
    const focused = this.#state.cursor;
    this.#entryLabels.forEach((label, row) => {
      label.setColor(
        row === focused ? MenuColors.entryFocused : MenuColors.entry
      );
    });
    this.#caret
      .setY(MenuLayout.firstEntryY + focused * MenuLayout.rowGap)
      .setColor(MenuColors.entryFocused);
    this.#renderPanel();
  }

  /**
   * Show or hide the detail panel from `this.#openPanel`. The ledger panel's body
   * is filled asynchronously by {@link #loadLedger}; a freshly-opened ledger panel
   * shows its title immediately and its lines once the save resolves.
   * @returns void
   */
  #renderPanel(): void {
    const open = this.#openPanel;
    if (open === null) {
      this.#hidePanel();
      return;
    }
    if (open === PauseMenuEntryIds.ledger) {
      // The ledger body is filled by #loadLedger; show the frame + title now.
      this.#showPanel("Ledger", []);
      return;
    }
    const entry = PAUSE_MENU_ENTRIES.find(candidate => candidate.id === open);
    this.#showPanel(entry?.label ?? "", PANEL_DESCRIPTIONS[open] ?? []);
  }

  /**
   * Show the detail panel with a title and up to {@link PANEL_LINE_SLOTS} body
   * lines (extra lines are dropped; unused slots are cleared).
   * @param title - The panel title.
   * @param lines - The body lines to render.
   * @returns void
   */
  #showPanel(title: string, lines: readonly string[]): void {
    this.#panelBox.setVisible(true);
    this.#panelTitle.setVisible(true).setText(title);
    this.#panelLines.forEach((line, index) => {
      line.setVisible(true).setText(lines[index] ?? "");
    });
  }

  /**
   * Hide the detail panel and clear its retained text.
   * @returns void
   */
  #hidePanel(): void {
    this.#panelBox.setVisible(false);
    this.#panelTitle.setVisible(false).setText("");
    this.#panelLines.forEach(line => line.setVisible(false).setText(""));
  }

  /**
   * Free every external subscription on scene shutdown (the
   * `require-shutdown-cleanup` contract): detach the bridge first (so
   * `__VERIFY__` reads null out of the scene), then unsubscribe the keyboard.
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    this.input.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKey
    );
  }
}
