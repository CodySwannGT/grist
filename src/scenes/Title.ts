/**
 * Title / main-menu scene — the game's DEFAULT cold-boot front door (sub-task #226).
 * A plain URL lands here (the Preloader's no-param default), not in a raw battle: the
 * screen composes title art from the shipped Marrow parallax plates behind a
 * grist-gold **GRIST** wordmark, and offers two entries from the pure
 * {@link import("../logic/title-menu") title-menu model} — **New Game** (always
 * available) and **Continue** (enabled only when a persisted save exists, read from
 * {@link saveService}). It owns NO menu rules: the pure model holds the entries, the
 * ring cursor, and the Continue gate; this scene RENDERS that model and maps a
 * confirmed entry to a transition — **New Game → the Ch.1 opening** (which itself hands
 * off to the tutorial ambush → Field) and **Continue → the Field with the saved run**
 * (rebuilt by {@link runStateFromSave}).
 *
 * Both input paths work, matching the rest of the slice: keyboard arrives as semantic
 * {@link MenuIntent}s via the pure {@link keyToMenuIntent} map (up/down move, Enter/
 * Space/E confirm), and each entry label is a pointer tap target (click = focus +
 * confirm). Every external subscription (keyboard + per-label pointer + the
 * verification bridge) is freed on shutdown (`require-shutdown-cleanup`). The
 * `?scene=`/`?start=` seams still route straight to any scene — they are the DEV/UAT
 * verification entry points, unchanged; only the no-param default became Title.
 * @module scenes/Title
 */
import Phaser from "phaser";
import { ImageKeys } from "../assets";
import { GameView, SceneKeys } from "../consts";
import { addCursor } from "../ui/chrome";
import { HudColors } from "../ui/layout";
import {
  TITLE_MENU_ENTRIES,
  TitleMenuEntryIds,
  isEntryEnabled,
  moveCursor,
  newTitleMenuState,
  selectedEntry,
  withHasSave,
  type TitleMenuEntry,
  type TitleMenuState,
} from "../logic/title-menu";
import { keyToMenuIntent, type MenuIntent } from "../services/menu-input-map";
import { newRunState } from "../logic/run-state";
import { runStateFromSave } from "../logic/save-run";
import { setRunState } from "../services/run-store";
import { saveService } from "../services/save-service";
import { verifyBridge } from "../uat/bridge";

/** The Marrow parallax plates (Ch.1 setting) composed behind the title wordmark. */
const BACKDROP_LAYERS: readonly string[] = [
  ImageKeys.marrowBgFar,
  ImageKeys.marrowBgMid,
  ImageKeys.marrowBgNear,
];

/** Readability scrim over the backdrop so the wordmark + menu stay legible. */
const SCRIM_COLOR = 0x0b0e16;
const SCRIM_ALPHA = 0.55;

/** Title-screen layout in logical (384×216) pixels. */
const TitleLayout = {
  wordmarkY: 54,
  taglineY: 84,
  firstEntryY: 128,
  rowGap: 22,
  caretGap: 58,
  hintY: 198,
} as const;

/** Title-screen text colors — grist-gold wordmark, per-state entry colors. */
const TitleColors = {
  wordmark: HudColors.grist,
  tagline: HudColors.dim,
  entry: HudColors.text,
  entryFocused: HudColors.grist,
  entryDisabled: HudColors.dim,
  hint: HudColors.dim,
} as const;

/** Title-screen text styles (monospace chrome, matching the menu family). */
const TitleTextStyles = {
  wordmark: {
    fontFamily: "monospace",
    fontSize: "40px",
    color: TitleColors.wordmark,
  },
  tagline: {
    fontFamily: "monospace",
    fontSize: "9px",
    color: TitleColors.tagline,
  },
  entry: {
    fontFamily: "monospace",
    fontSize: "14px",
    color: TitleColors.entry,
  },
  hint: { fontFamily: "monospace", fontSize: "8px", color: TitleColors.hint },
} as const;

/** Renders the Title front door from the pure model and routes confirmed entries. */
export class Title extends Phaser.Scene {
  /** The live Title-menu state (cursor + whether a save exists). */
  #state: TitleMenuState = newTitleMenuState();
  /** The pooled per-entry label texts, parallel to {@link TITLE_MENU_ENTRIES}. */
  #entryLabels: readonly Phaser.GameObjects.Text[] = [];
  #caret!: Phaser.GameObjects.Image;
  /** False once the scene has shut down, so a late `saveService.has()` is dropped. */
  #alive = true;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Title);
  }

  /**
   * Build the title art (parallax backdrop + scrim + grist-gold wordmark), the two
   * entry labels (each a keyboard + pointer target), the cursor caret, and the
   * controls hint; subscribe the keyboard; register the verification bridge; then
   * resolve whether a save exists so Continue can enable. Renders the initial state.
   * @returns void
   */
  create(): void {
    this.#alive = true;
    this.#state = newTitleMenuState();
    this.#buildBackdrop();
    this.#buildWordmark();
    this.#entryLabels = TITLE_MENU_ENTRIES.map((entry, row) =>
      this.#buildEntry(entry, row)
    );
    // The shared grist-gold `arrow` cursor, rotated a quarter-turn to point right at
    // the focused entry (the pack art points down) — the same helper the Menu uses.
    this.#caret = addCursor(this, 0, 0, -Math.PI / 2).setOrigin(0.5);
    this.#buildHint();

    this.input.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKey
    );
    // The Title is a non-gameplay menu (like Boot/Preloader), so it attaches a null
    // view — `scene()` reports "Title" for the front-door e2e, and the save-gating of
    // Continue is proven behaviourally (a disabled confirm stays on Title; an enabled
    // one loads the Field), not through a bespoke bridge read.
    verifyBridge.attach(SceneKeys.Title, null);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());

    this.#render();
    void this.#resolveSave();
  }

  /**
   * Compose the Marrow parallax plates (bottom-anchored so taller art crops at the
   * top) under a readability scrim — title art from the shipped assets, no new plate.
   * @returns void
   */
  #buildBackdrop(): void {
    for (const layer of BACKDROP_LAYERS) {
      this.add.image(0, GameView.height, layer).setOrigin(0, 1);
    }
    this.add
      .rectangle(
        0,
        0,
        GameView.width,
        GameView.height,
        SCRIM_COLOR,
        SCRIM_ALPHA
      )
      .setOrigin(0, 0);
  }

  /**
   * Build the centered grist-gold GRIST wordmark and its tagline.
   * @returns void
   */
  #buildWordmark(): void {
    this.add
      .text(
        GameView.width / 2,
        TitleLayout.wordmarkY,
        "GRIST",
        TitleTextStyles.wordmark
      )
      .setOrigin(0.5);
    this.add
      .text(
        GameView.width / 2,
        TitleLayout.taglineY,
        "Move the crate. Ask nothing.",
        TitleTextStyles.tagline
      )
      .setOrigin(0.5);
  }

  /**
   * Build one entry label at the given row and make it a pointer tap target (click =
   * focus that entry + confirm it, mirroring the keyboard confirm). Its color is set
   * per focus/enabled on render.
   * @param entry - The entry this label renders.
   * @param row - The zero-based row index (stacks downward by `rowGap`).
   * @returns The pooled label text.
   */
  #buildEntry(entry: TitleMenuEntry, row: number): Phaser.GameObjects.Text {
    const y = TitleLayout.firstEntryY + row * TitleLayout.rowGap;
    const label = this.add
      .text(GameView.width / 2, y, entry.label, TitleTextStyles.entry)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    label.on(Phaser.Input.Events.POINTER_OVER, () => this.#focusRow(row));
    label.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.#focusRow(row);
      this.#confirm(selectedEntry(this.#state));
    });
    return label;
  }

  /**
   * Build the bottom controls hint — the first-run clarity cue that both inputs work.
   * @returns void
   */
  #buildHint(): void {
    this.add
      .text(
        GameView.width / 2,
        TitleLayout.hintY,
        "↑↓ select   ·   Enter / click to choose",
        TitleTextStyles.hint
      )
      .setOrigin(0.5);
  }

  /**
   * Read whether a persisted save exists and, if the scene is still alive, fold the
   * answer into the model so **Continue** enables. Guarded against a scene the player
   * has already left (a late resolve never touches a torn-down scene). Best-effort —
   * a storage error is swallowed (Continue simply stays disabled).
   * @returns A promise that resolves once the save check has been folded in.
   */
  async #resolveSave(): Promise<void> {
    try {
      const has = await saveService.has();
      if (!this.#alive) {
        return;
      }
      this.#state = withHasSave(this.#state, has);
      this.#render();
    } catch {
      // No save affordance on a storage failure — Continue stays disabled.
    }
  }

  /**
   * Translate a key press into a {@link MenuIntent} and apply it: up/down move the
   * ring cursor, confirm activates the focused entry. Cancel is ignored (the Title is
   * the root — there is nothing to back out to). A stable arrow field so it can be
   * unsubscribed on shutdown. Unbound keys are ignored.
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
      this.#render();
      return;
    }
    if (intent.kind === "confirm") {
      this.#confirm(selectedEntry(this.#state));
    }
  };

  /**
   * Move the cursor to focus a specific row (a pointer hover/tap), then re-render.
   * @param row - The entry row to focus.
   * @returns void
   */
  #focusRow(row: number): void {
    this.#state = { ...this.#state, cursor: row };
    this.#render();
  }

  /**
   * Dispatch a confirmed entry: **New Game** starts a fresh run and plays the Ch.1
   * opening; **Continue** (only when enabled) loads the saved run into the Field. A
   * disabled Continue is a no-op — the affordance renders dimmed and does nothing.
   * @param entry - The focused entry being confirmed.
   * @returns void
   */
  #confirm(entry: TitleMenuEntry): void {
    if (!isEntryEnabled(this.#state, entry)) {
      return;
    }
    if (entry.id === TitleMenuEntryIds.newGame) {
      this.#startNewGame();
      return;
    }
    void this.#startContinue();
  }

  /**
   * New Game: seed a fresh run into the registry (so a prior session/save never leaks
   * in) and start the Ch.1 opening — the Dialogue scene plays the authored opening,
   * which hands off to the tutorial ambush and lands the player in the Field. The
   * explicit `{ script: "opening" }` selects the opening without a `?scene=` URL.
   * @returns void
   */
  #startNewGame(): void {
    setRunState(this.registry, newRunState());
    this.scene.start(SceneKeys.Dialogue, { script: "opening" });
  }

  /**
   * Continue: load the persisted save, rebuild the live run from it
   * ({@link runStateFromSave} — wallet, build, roster), seed the registry, and start
   * the Field so the player resumes with their saved run. Guarded against a torn-down
   * scene so a slow load never starts the Field after the player left.
   * @returns A promise that resolves once the Field has been started (or skipped).
   */
  async #startContinue(): Promise<void> {
    const save = await saveService.load();
    if (!this.#alive) {
      return;
    }
    setRunState(this.registry, runStateFromSave(save));
    this.scene.start(SceneKeys.Field);
  }

  /**
   * Render the whole screen from the live model: recolor each entry by focus and
   * enabled state (a disabled Continue reads dimmed), and park the caret beside the
   * focused entry. Pure read of `this.#state`.
   * @returns void
   */
  #render(): void {
    const focused = this.#state.cursor;
    this.#entryLabels.forEach((label, row) => {
      const entry = TITLE_MENU_ENTRIES[row];
      const enabled = entry !== undefined && isEntryEnabled(this.#state, entry);
      label.setColor(this.#entryColor(row === focused, enabled));
    });
    this.#caret.setPosition(
      GameView.width / 2 - TitleLayout.caretGap,
      TitleLayout.firstEntryY + focused * TitleLayout.rowGap
    );
  }

  /**
   * Resolve an entry label's color from its focus + enabled state: focused = gold,
   * disabled = dim, otherwise the neutral entry text.
   * @param focused - Whether the entry is the focused one.
   * @param enabled - Whether the entry is selectable.
   * @returns The CSS color string.
   */
  #entryColor(focused: boolean, enabled: boolean): string {
    if (!enabled) {
      return TitleColors.entryDisabled;
    }
    return focused ? TitleColors.entryFocused : TitleColors.entry;
  }

  /**
   * Free every external subscription on scene shutdown (the
   * `require-shutdown-cleanup` contract): mark the scene dead (so a late save resolve
   * is dropped), detach the bridge, unbind each label's pointer handlers, and
   * unsubscribe the keyboard.
   * @returns void
   */
  #shutdown(): void {
    this.#alive = false;
    verifyBridge.attach("", null);
    this.#entryLabels.forEach(label =>
      label
        .off(Phaser.Input.Events.POINTER_OVER)
        .off(Phaser.Input.Events.POINTER_DOWN)
    );
    this.input.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKey
    );
  }
}
