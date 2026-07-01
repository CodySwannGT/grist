/**
 * Pause/main-menu scene — the thin Phaser adapter for the slice's pause/main menu
 * (Story #99 / sub-task #113, PRD #42 FR7 + AC9/AC10). It owns NO menu vocabulary
 * or routing rules: the pure catalog (`logic/pause-menu`) holds the six entries —
 * **Party, Builds, Items, Ledger, Map, System/Settings** — their labels, the
 * Builds → growth-screen route, and the wrap-around navigation; this scene RENDERS
 * that catalog (a titled vertical list with a keyboard-navigable highlight) and,
 * on confirm, OPENS the selected entry's route. The **Builds** entry opens the
 * *existing* Phase-2 growth screen ({@link SceneKeys.Bench}, #76) — reused, never
 * re-spec'd (AC2).
 *
 * Player actions arrive as semantic {@link MenuIntent}s on the EventsCenter bus
 * (published by {@link PauseMenuInputService} from the keyboard and the interactive
 * entry rows); no raw key/pointer is read in this scene, so the menu is
 * keyboard-navigable. Every subscription is freed on shutdown. No allocations in
 * `update()` — the menu is event-driven, so it has none. Menu state is ephemeral
 * (the highlighted index lives on the scene, never in the persisted save — OOS
 * #101).
 * @module scenes/PauseMenu
 */
import Phaser from "phaser";
import {
  GameView,
  PAUSE_MENU_DEPTH,
  PauseMenuColors,
  PauseMenuEvents,
  PauseMenuLayout,
  PauseMenuTextStyles,
  SceneKeys,
  type SceneKey,
} from "../consts";
import {
  MENU_ENTRY_ORDER,
  menuEntryLabel,
  menuEntryRoute,
  moveSelection,
  type MenuEntryId,
} from "../logic/pause-menu";
import { eventsCenter } from "../services/events";
import { PauseMenuInputService } from "../services/pause-menu-input";
import { type MenuIntent } from "../services/pause-menu-input-map";
import { verifyBridge } from "../uat/bridge";
import { type PauseMenuView } from "../uat/pause-menu-view";

/** The pooled objects for one entry row (its highlight box + label). */
interface EntryRow {
  readonly id: MenuEntryId;
  readonly box: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

/** The keyboard-navigation hint the menu shows at the bottom of the overlay. */
const HINT = "↑/↓ navigate   Enter select   Esc close";

/** Renders the pause/main menu from the pure catalog and opens the chosen route. */
export class PauseMenu extends Phaser.Scene {
  #input!: PauseMenuInputService;
  #rows: readonly EntryRow[] = [];
  /** The highlighted entry index — ephemeral menu state (never persisted, #101). */
  #selectedIndex = 0;
  /** The scene key the menu last opened via a confirmed entry (for the UAT bridge). */
  #openedRoute: SceneKey | null = null;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.PauseMenu);
  }

  /**
   * Build the overlay chrome (a scrim over the paused scene, a title banner, the
   * six entry rows, and a keyboard hint), wire the semantic input service + bus
   * subscription, attach the verification bridge, and render the initial highlight.
   * @returns void
   */
  create(): void {
    this.#selectedIndex = 0;
    this.#openedRoute = null;
    this.#input = new PauseMenuInputService(this);

    this.#buildScrim();
    this.#buildTitle();
    this.#rows = MENU_ENTRY_ORDER.map((id, row) =>
      this.#buildEntryRow(id, row)
    );
    this.#buildHint();

    eventsCenter.on(PauseMenuEvents.Input, this.#onIntent);
    verifyBridge.attach(SceneKeys.PauseMenu, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());

    this.#render();
  }

  /**
   * Apply a semantic menu intent: navigate moves the highlight (wrapping), a
   * pointer select-entry highlights the tapped entry, confirm opens the
   * highlighted entry's route, and cancel closes the menu (resume underneath).
   * A stable arrow field so it can be unsubscribed on shutdown.
   * @param intent - The semantic menu intent from the bus.
   * @param _device - The originating device (kept for telemetry symmetry).
   * @returns void
   */
  readonly #onIntent = (intent: MenuIntent, _device: string): void => {
    if (intent.kind === "navigate") {
      this.#selectedIndex = moveSelection(this.#selectedIndex, intent.delta);
      this.#render();
      return;
    }
    if (intent.kind === "select-entry") {
      this.#highlightById(intent.entry);
      return;
    }
    if (intent.kind === "confirm") {
      this.#openSelected();
      return;
    }
    // cancel — close the overlay (a no-op here beyond stopping this scene; the
    // scene that launched the menu resumes underneath).
    this.scene.stop();
  };

  /**
   * Open the currently-highlighted entry's route: the **Builds** entry starts the
   * existing Phase-2 growth screen ({@link SceneKeys.Bench}, #76) — reused, not
   * re-spec'd (AC2). An entry whose destination scene is a follow-up (`null` route)
   * records nothing and stays on the menu, so its entry is present and selectable
   * (AC1) without opening a not-yet-built scene.
   * @returns void
   */
  #openSelected(): void {
    const entry = MENU_ENTRY_ORDER[this.#selectedIndex];
    // The index is always kept in-bounds by moveSelection / highlightById, but the
    // indexed read is typed optional under noUncheckedIndexedAccess — guard it.
    if (entry === undefined) {
      return;
    }
    const route = menuEntryRoute(entry);
    if (route === null) {
      return;
    }
    this.#openedRoute = route;
    this.scene.start(route);
  }

  /**
   * Highlight the entry with the given id (a pointer tap). Ignores an id not in
   * the catalog so a stray tap can never drive the highlight off the list.
   * @param entry - The tapped entry id.
   * @returns void
   */
  #highlightById(entry: string): void {
    const index = MENU_ENTRY_ORDER.findIndex(id => id === entry);
    if (index >= 0) {
      this.#selectedIndex = index;
      this.#render();
    }
  }

  /**
   * Draw the semi-opaque scrim over the paused scene beneath the menu (so the
   * gameplay shows through faintly and the menu reads as an overlay).
   * @returns void
   */
  #buildScrim(): void {
    this.add
      .rectangle(
        0,
        0,
        GameView.width,
        GameView.height,
        PauseMenuColors.scrim,
        PauseMenuColors.scrimAlpha
      )
      .setOrigin(0, 0)
      .setDepth(PAUSE_MENU_DEPTH - 1);
  }

  /**
   * Draw the centered title banner.
   * @returns void
   */
  #buildTitle(): void {
    this.add
      .text(
        GameView.width / 2,
        PauseMenuLayout.titleY,
        "Menu",
        PauseMenuTextStyles.title
      )
      .setOrigin(0.5, 0)
      .setDepth(PAUSE_MENU_DEPTH);
  }

  /**
   * Build one entry row at the given index: a tappable box that highlights the
   * entry then confirms it, and a centered label (set on render). Stacks downward
   * by `rowGap`.
   * @param id - The menu-entry id this row renders.
   * @param row - The zero-based row index.
   * @returns The pooled entry row.
   */
  #buildEntryRow(id: MenuEntryId, row: number): EntryRow {
    const y = PauseMenuLayout.firstEntryY + row * PauseMenuLayout.rowGap;
    const box = this.add
      .rectangle(
        GameView.width / 2,
        y,
        PauseMenuLayout.entryWidth,
        PauseMenuLayout.entryHeight,
        PauseMenuColors.entryFill
      )
      .setStrokeStyle(1, PauseMenuColors.entryStroke)
      .setDepth(PAUSE_MENU_DEPTH)
      .setInteractive({ useHandCursor: true });
    box.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.#input.tapEntry(id);
      this.#input.tapConfirm();
    });
    const label = this.add
      .text(
        GameView.width / 2,
        y,
        menuEntryLabel(id),
        PauseMenuTextStyles.entry
      )
      .setOrigin(0.5)
      .setDepth(PAUSE_MENU_DEPTH);
    return { id, box, label };
  }

  /**
   * Draw the bottom keyboard-navigation hint line (the menu is keyboard-operable).
   * @returns void
   */
  #buildHint(): void {
    this.add
      .text(
        GameView.width / 2,
        PauseMenuLayout.hintY,
        HINT,
        PauseMenuTextStyles.hint
      )
      .setOrigin(0.5, 1)
      .setDepth(PAUSE_MENU_DEPTH);
  }

  /**
   * Restyle every entry row from the highlighted index: the selected row gets the
   * accent fill/stroke and text color; the rest are the default. Pure read of
   * `this.#selectedIndex` — the scene derives nothing it does not read from state.
   * @returns void
   */
  #render(): void {
    this.#rows.forEach((row, index) => {
      const selected = index === this.#selectedIndex;
      row.box
        .setFillStyle(
          selected
            ? PauseMenuColors.entryFillSelected
            : PauseMenuColors.entryFill
        )
        .setStrokeStyle(
          1,
          selected
            ? PauseMenuColors.entryStrokeSelected
            : PauseMenuColors.entryStroke
        );
      row.label.setColor(
        selected ? PauseMenuColors.entryTextSelected : PauseMenuColors.entryText
      );
    });
  }

  /**
   * The live link handed to the verification bridge (#113): the render scale, a
   * read of the rendered entry labels / highlighted index / last opened route, and
   * the three menu actions routed through the same semantic input the keyboard and
   * rows use — so the e2e drives exactly the player's path (highlight → confirm).
   * @returns The pause-menu view.
   */
  #bridgeView(): PauseMenuView {
    return {
      resolution: () => {
        const { gameSize, displaySize } = this.scale;
        return {
          width: gameSize.width,
          height: gameSize.height,
          zoom: displaySize.width / gameSize.width,
        };
      },
      entries: () => MENU_ENTRY_ORDER.map(menuEntryLabel),
      selectedIndex: () => this.#selectedIndex,
      openedRoute: () => this.#openedRoute,
      highlight: (entry: string) => this.#input.tapEntry(entry),
      navigate: (delta: -1 | 1) =>
        eventsCenter.emit(PauseMenuEvents.Input, { kind: "navigate", delta }),
      confirm: () => this.#input.tapConfirm(),
    };
  }

  /**
   * Free every external subscription on scene shutdown (the
   * `require-shutdown-cleanup` contract): detach the bridge first (so
   * `__VERIFY__.pauseMenu()` returns null out of the scene), unsubscribe the
   * menu-intent bus listener, and dispose the input service's keyboard binding.
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    eventsCenter.off(PauseMenuEvents.Input, this.#onIntent);
    this.#input.dispose();
  }
}
