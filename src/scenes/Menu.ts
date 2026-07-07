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
import {
  GameView,
  SceneKeys,
  type BenchLaunchData,
  type FieldResumeData,
  type MenuLaunchData,
} from "../consts";
import { type WorldMapLaunchData } from "../world-map-consts";
import { MenuColors, MenuLayout, MenuTextStyles } from "../menu-consts";
import { addCursor, addPanel } from "../ui/chrome";
import {
  PAUSE_MENU_ENTRIES,
  PauseMenuEntryIds,
  moveCursor,
  newPauseMenuState,
  resolveMenuCancel,
  selectedEntry,
  type PauseMenuEntry,
  type PauseMenuEntryId,
  type PauseMenuRoute,
  type PauseMenuState,
} from "../logic/pause-menu";
import { projectLedgerCodex } from "../logic/narrative";
import {
  LEDGER_CODEX_CATALOG,
  LEDGER_CODEX_TOTAL,
} from "../content/ledger-codex";
import { keyToMenuIntent, type MenuIntent } from "../services/menu-input-map";
import { saveService } from "../services/save-service";
import { verifyBridge } from "../uat/bridge";
import type { MenuView } from "../uat/menu-view";
import { LedgerCodexPanel } from "../ui/ledger-codex-panel";
import { HelpPanel } from "../ui/help-panel";

/** The karma summary header line count (`formatMoralLedger` returns three lines). */
const KARMA_HEADER_LINES = 3;
/** The codex body pool size: karma header + the tally + one line per catalog choice. */
const CODEX_LINE_SLOTS = KARMA_HEADER_LINES + 1 + LEDGER_CODEX_TOTAL;

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
  // Map now opens the World Map travel scene (#241) instead of a placeholder panel, so
  // it is no longer keyed here. System/Settings opens the controls & help reference
  // (#228) via the dense HelpPanel, so it is keyed nowhere here either.
};

/** Renders the pause/main menu from the pure model and routes confirmed entries. */
export class Menu extends Phaser.Scene {
  /** The live cursor state of the menu (which entry is focused). */
  #state: PauseMenuState = newPauseMenuState();
  /** The entry whose detail panel is open, or null when the panel is hidden. */
  #openPanel: PauseMenuEntryId | null = null;
  /**
   * The caller gameplay scene to resume when the menu is closed with Cancel/Back
   * (#233), or null when the menu was reached standalone via `?scene=menu` (the
   * verification seam) — a standalone menu has no caller and Cancel stays put.
   */
  #returnTo: string | null = null;
  /** The pooled per-entry label texts, parallel to {@link PAUSE_MENU_ENTRIES}. */
  #entryLabels: readonly Phaser.GameObjects.Text[] = [];
  #caret!: Phaser.GameObjects.Image;
  #panelBox!: Phaser.GameObjects.NineSlice;
  #panelTitle!: Phaser.GameObjects.Text;
  /** The pooled detail-panel body lines (text set/cleared on render). */
  #panelLines: readonly Phaser.GameObjects.Text[] = [];
  /** The Ledger codex panel (#221) — renders the recorded/pending catalog. */
  #codexPanel!: LedgerCodexPanel;
  /** The controls & help panel (#228) — the System/Settings controls reference. */
  #helpPanel!: HelpPanel;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Menu);
  }

  /**
   * Build the static chrome (title, the six stacked entry labels, the cursor
   * caret, the detail panel, the controls hint), subscribe the keyboard, register
   * the scene with the verification bridge, and render the initial state. A
   * {@link MenuLaunchData} caller (#233) is remembered so Cancel/Back resumes that
   * gameplay scene; absent (the `?scene=menu` seam) the menu has no caller.
   * @param data - The launch payload naming the caller scene, or undefined standalone.
   * @returns void
   */
  create(data?: MenuLaunchData): void {
    this.#returnTo = data?.returnTo ?? null;
    // The Phaser SceneManager reuses this scene instance across opens, so reset the
    // cursor + open-panel each time the menu is (re)entered (#233): a pause always
    // opens fresh on Party with no panel showing, never the last session's cursor.
    this.#state = newPauseMenuState();
    this.#openPanel = null;
    this.cameras.main.setBackgroundColor(MenuColors.backdrop);
    this.#buildTitle();
    this.#entryLabels = PAUSE_MENU_ENTRIES.map((entry, row) =>
      this.#buildEntry(entry, row)
    );
    // The grist-gold `arrow` cursor rotated a quarter-turn to point right at the
    // focused entry (the pack art points down), replacing the old "▶" text glyph.
    this.#caret = addCursor(
      this,
      MenuLayout.caretX,
      MenuLayout.firstEntryY,
      -Math.PI / 2
    ).setOrigin(0.5);
    this.#buildPanel();
    this.#buildHint();

    this.input.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKey
    );
    verifyBridge.attach(SceneKeys.Menu, this.#menuView());
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
    this.#panelBox = addPanel(
      this,
      MenuLayout.panelX,
      MenuLayout.panelY,
      MenuLayout.panelWidth,
      MenuLayout.panelHeight
    ).setOrigin(0, 0);
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
    this.#codexPanel = new LedgerCodexPanel(
      this,
      MenuLayout.panelX + MenuLayout.panelPadX,
      CODEX_LINE_SLOTS
    );
    this.#helpPanel = new HelpPanel(
      this,
      MenuLayout.panelX + MenuLayout.panelPadX
    );
  }

  /**
   * The verification-bridge view the Menu registers (#221): it surfaces the Ledger
   * codex the panel rendered, so an e2e can prove the panel opened and assert the
   * recorded/pending model. Null until a Ledger panel loads (and cleared when it
   * closes), the way the async ledger body itself resolves.
   * @returns The menu bridge view.
   */
  #menuView(): MenuView {
    return {
      ledgerCodex: () => this.#codexPanel.codex(),
      helpControls: () => this.#helpPanel.lines(),
    };
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
        "↑↓ move   ·   Enter open   ·   Esc / tap close",
        MenuTextStyles.hint
      )
      .setOrigin(0.5);
    // A transparent hit-rect over the hint (#239): touch players reach the Menu via
    // the Field's tappable "[Esc] menu" affordance but have no Esc key, so tapping the
    // hint runs the same Cancel/Back peel — the Menu is never a pointer dead-end.
    this.add
      .rectangle(
        GameView.width / 2,
        MenuLayout.hintY,
        MenuLayout.hintHitWidth,
        MenuLayout.hintHitHeight,
        0x000000,
        0
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, () => this.#cancel());
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
      this.#cancel();
      return;
    }
    this.#confirm(selectedEntry(this.#state));
  };

  /**
   * Apply a Cancel/Back press via the pure {@link resolveMenuCancel} decision (#233):
   * an open detail panel closes first; once the entry list is bare, Cancel resumes
   * the caller gameplay scene (the Field, restored exactly where the player paused)
   * or — standalone (`?scene=menu`) — simply stays in the menu. A `fromMenu` resume
   * tells the Field to restore the stashed session + Wren position, not respawn her.
   * @returns void
   */
  #cancel(): void {
    const outcome = resolveMenuCancel(this.#openPanel, this.#returnTo);
    if (outcome.kind === "return") {
      const resume: FieldResumeData = { resumed: false, fromMenu: true };
      this.scene.start(outcome.scene, resume);
      return;
    }
    // close-panel and stay both collapse to the bare entry list.
    this.#openPanel = null;
    this.#render();
  }

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
      // Hand the Bench a return path (#239): it closes back to THIS menu, carrying the
      // menu's own caller so the re-opened menu's Esc then resumes the Field exactly
      // where the player paused. A standalone menu (no caller) passes no resume payload.
      const launch: BenchLaunchData = {
        returnTo: SceneKeys.Menu,
        ...(this.#returnTo !== null
          ? { resume: { returnTo: this.#returnTo } }
          : {}),
      };
      this.scene.start(SceneKeys.Bench, launch);
      return;
    }
    if (route.kind === "ledger") {
      this.#openPanel = entry.id;
      this.#render();
      void this.#loadLedger();
      return;
    }
    if (route.kind === "worldmap") {
      // Open the travel front door (#241). It returns to the caller the menu was opened
      // over (the Field), so closing the map drops the player back where they paused;
      // a standalone menu (no caller) opens a standalone map (its Back stays put).
      const launch: WorldMapLaunchData | undefined =
        this.#returnTo !== null ? { returnTo: this.#returnTo } : undefined;
      this.scene.start(SceneKeys.WorldMap, launch);
      return;
    }
    this.#openPanel = route.panel;
    this.#render();
  }

  /**
   * Read the persisted save and, while the Ledger panel is still the open one, render
   * the moral-ledger **codex** (#221): the karma summary header (#98, kept — additive)
   * plus every catalog choice tagged recorded/pending and the `Recorded: N of M`
   * tally, projected from the save's `scene.flags`. Guarded against a panel the player
   * has since closed or changed so a late load never clobbers the view.
   * @returns A promise that resolves once the codex has been read and rendered.
   */
  async #loadLedger(): Promise<void> {
    try {
      const save = await saveService.load();
      if (this.#openPanel !== PauseMenuEntryIds.ledger) {
        return;
      }
      const codex = projectLedgerCodex(
        LEDGER_CODEX_CATALOG,
        save.scene?.flags ?? {}
      );
      this.#clearPanelLines();
      this.#codexPanel.show(codex, save.moralLedger);
    } catch {
      if (this.#openPanel === PauseMenuEntryIds.ledger) {
        this.#codexPanel.hide();
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
    this.#caret.setY(MenuLayout.firstEntryY + focused * MenuLayout.rowGap);
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
    if (open === PauseMenuEntryIds.system) {
      // System/Settings opens the persistent controls & help reference (#228) — the
      // dense HelpPanel, not a one-line description.
      this.#showHelp(open);
      return;
    }
    this.#helpPanel.hide();
    if (open === PauseMenuEntryIds.ledger) {
      // The codex body is filled by #loadLedger; show the frame + title now and leave
      // the info-panel lines cleared (the ledger uses the denser codex pool instead).
      this.#showFrame("Ledger");
      this.#clearPanelLines();
      return;
    }
    this.#codexPanel.hide();
    const entry = PAUSE_MENU_ENTRIES.find(candidate => candidate.id === open);
    this.#showPanel(entry?.label ?? "", PANEL_DESCRIPTIONS[open] ?? []);
  }

  /**
   * Show the controls & help reference (#228) under the System/Settings entry: the
   * panel frame titled by the entry, its info/codex bodies cleared, and the dense
   * HelpPanel filled with the field + battle controls and the AP/Grist legend.
   * @param entryId - The System entry id (its label titles the panel).
   * @returns void
   */
  #showHelp(entryId: PauseMenuEntryId): void {
    this.#codexPanel.hide();
    const entry = PAUSE_MENU_ENTRIES.find(
      candidate => candidate.id === entryId
    );
    this.#showFrame(entry?.label ?? "");
    this.#clearPanelLines();
    this.#helpPanel.show();
  }

  /**
   * Show the detail panel frame (box + title) without touching either body pool.
   * @param title - The panel title.
   * @returns void
   */
  #showFrame(title: string): void {
    this.#panelBox.setVisible(true);
    this.#panelTitle.setVisible(true).setText(title);
  }

  /**
   * Hide and clear the four-slot info-panel body lines (used by the non-ledger
   * panels; the ledger renders through the codex pool instead).
   * @returns void
   */
  #clearPanelLines(): void {
    this.#panelLines.forEach(line => line.setVisible(false).setText(""));
  }

  /**
   * Show the detail panel with a title and up to {@link PANEL_LINE_SLOTS} info body
   * lines (extra lines are dropped; unused slots are cleared).
   * @param title - The panel title.
   * @param lines - The body lines to render.
   * @returns void
   */
  #showPanel(title: string, lines: readonly string[]): void {
    this.#showFrame(title);
    this.#panelLines.forEach((line, index) => {
      line.setVisible(true).setText(lines[index] ?? "");
    });
  }

  /**
   * Hide the detail panel and clear its retained text (both the info body lines and
   * the codex panel, so the bridge's codex read goes null when the panel closes).
   * @returns void
   */
  #hidePanel(): void {
    this.#panelBox.setVisible(false);
    this.#panelTitle.setVisible(false).setText("");
    this.#codexPanel.hide();
    this.#helpPanel.hide();
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
