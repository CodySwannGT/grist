/**
 * The pure, Phaser-free model for the Title / main-menu (sub-task #226): the single
 * source of the front-door menu's two entries — **New Game** and **Continue** — their
 * display order, the ring-wrapping cursor, and the one availability rule that matters
 * (Continue is selectable only when a persisted save exists). Data in, data out: it
 * owns the menu *rules*, never the rendering. The {@link import("../scenes/Title").Title}
 * scene is a thin adapter that renders this model, reads `saveService.has()` to learn
 * whether a save exists, and maps a confirmed entry to a scene transition — **New Game
 * → the Ch.1 opening** (→ tutorial ambush → Field) and **Continue → the Field with the
 * saved run**. Unit-tested headless; mirrors the `logic/pause-menu` split the rest of
 * the slice uses.
 * @module logic/title-menu
 */

/** The stable ids of the two Title-menu entries (the only place they live). */
export const TitleMenuEntryIds = {
  newGame: "new-game",
  continue: "continue",
} as const;

/** One Title-menu entry id. */
export type TitleMenuEntryId =
  (typeof TitleMenuEntryIds)[keyof typeof TitleMenuEntryIds];

/** One Title-menu entry: its stable id and its display label. */
export interface TitleMenuEntry {
  readonly id: TitleMenuEntryId;
  readonly label: string;
}

/**
 * The two Title-menu entries in their committed display order: **New Game** first
 * (the always-available start), then **Continue** (gated on a save existing). This
 * array IS the contract the entries acceptance criterion asserts.
 */
export const TITLE_MENU_ENTRIES: readonly TitleMenuEntry[] = [
  { id: TitleMenuEntryIds.newGame, label: "New Game" },
  { id: TitleMenuEntryIds.continue, label: "Continue" },
] as const;

/**
 * The live Title-menu state: which entry the cursor focuses and whether a persisted
 * save exists (so the scene and this model agree on whether Continue is selectable).
 */
export interface TitleMenuState {
  /** The zero-based index of the focused entry within {@link TITLE_MENU_ENTRIES}. */
  readonly cursor: number;
  /** Whether a persisted save exists — the one input the Continue gate reads. */
  readonly hasSave: boolean;
}

/**
 * The initial Title-menu state: the cursor rests on the first entry (New Game), so
 * the always-available "press Enter to start" affordance is focused by default. A
 * fresh boot passes `hasSave = false` and folds in the real answer once
 * `saveService.has()` resolves via {@link withHasSave}.
 * @param hasSave - Whether a persisted save exists (default false).
 * @returns A fresh Title-menu state.
 */
export function newTitleMenuState(hasSave = false): TitleMenuState {
  return { cursor: 0, hasSave };
}

/**
 * Move the cursor by `delta` entries, wrapping around both ends so the list is a
 * ring (down past the last entry lands on the first; up past the first lands on the
 * last). Pure and total — any integer delta lands on a valid index. Availability is
 * unchanged (a disabled Continue can still be focused; confirming it is the scene's
 * no-op, matching the pause-menu's focus-then-confirm split).
 * @param state - The current menu state (never mutated).
 * @param delta - The signed step (−1 = up, +1 = down).
 * @returns The next menu state.
 */
export function moveCursor(
  state: TitleMenuState,
  delta: number
): TitleMenuState {
  const count = TITLE_MENU_ENTRIES.length;
  const cursor = (((state.cursor + delta) % count) + count) % count;
  return { ...state, cursor };
}

/**
 * Fold a freshly-resolved save-existence answer into the state, preserving the
 * cursor. Called once the async `saveService.has()` resolves so Continue enables
 * without moving the player's focus.
 * @param state - The current menu state.
 * @param hasSave - Whether a persisted save exists.
 * @returns The next menu state with the updated availability.
 */
export function withHasSave(
  state: TitleMenuState,
  hasSave: boolean
): TitleMenuState {
  return { ...state, hasSave };
}

/**
 * Read the entry the cursor currently focuses.
 * @param state - The current menu state.
 * @returns The focused {@link TitleMenuEntry}.
 */
export function selectedEntry(state: TitleMenuState): TitleMenuEntry {
  const count = TITLE_MENU_ENTRIES.length;
  const index = ((state.cursor % count) + count) % count;
  const entry = TITLE_MENU_ENTRIES[index];
  if (entry === undefined) {
    throw new RangeError(`title-menu cursor out of range: ${state.cursor}`);
  }
  return entry;
}

/**
 * Whether an entry is selectable right now: **New Game** always is; **Continue** is
 * only selectable when a persisted save exists (`state.hasSave`). The single gate the
 * scene consults before acting on a confirm — a disabled Continue renders dimmed and
 * confirming it is a no-op.
 * @param state - The current menu state.
 * @param entry - The entry to test.
 * @returns True when the entry may be confirmed.
 */
export function isEntryEnabled(
  state: TitleMenuState,
  entry: TitleMenuEntry
): boolean {
  return entry.id === TitleMenuEntryIds.continue ? state.hasSave : true;
}
