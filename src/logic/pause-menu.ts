/**
 * The pure, Phaser-free model for the pause/main menu (sub-task #113, Story #99 /
 * PD-3.8, PRD #42 FR7 + AC9/AC10): the single source of the six menu entries —
 * **Party, Builds, Items, Ledger, Map, System/Settings** — their display order,
 * the semantic {@link PauseMenuRoute} each resolves to, and the cursor navigation
 * (move with wrap, read the selected entry). Data in, data out: it owns the menu
 * *rules*, never the rendering. The {@link import("../scenes/Menu").Menu} scene is
 * a thin adapter that renders this model and maps a route to a scene transition —
 * notably **Builds → the existing Phase-2 growth screen** (the Bench, #76), reused
 * rather than re-spec'd (AC: "the existing growth screen opens, not a re-spec'd
 * one"). Unit-tested headless; mirrors the `logic/run-state` / input-map split the
 * rest of the slice uses.
 * @module logic/pause-menu
 */
import { type MoralLedger } from "./save/types";

/** The stable ids of the six pause/main-menu entries (the only place they live). */
export const PauseMenuEntryIds = {
  party: "party",
  builds: "builds",
  items: "items",
  ledger: "ledger",
  map: "map",
  system: "system",
} as const;

/** One pause/main-menu entry id. */
export type PauseMenuEntryId =
  (typeof PauseMenuEntryIds)[keyof typeof PauseMenuEntryIds];

/**
 * Open the existing Phase-2 growth screen (the Bench, #76). The **Builds** entry
 * resolves to this route; the scene maps it to `scene.start(SceneKeys.Bench)`, so
 * Builds *reuses* the shipped growth loop (equip shard / install augment / spend
 * grist) and never re-spec's it.
 */
export interface PauseMenuGrowthRoute {
  readonly kind: "growth";
}

/** Surface the moral ledger (#98) — the **Ledger** entry resolves to this. */
export interface PauseMenuLedgerRoute {
  readonly kind: "ledger";
}

/**
 * Open the in-menu information panel for an entry that has no dedicated scene yet
 * (Party / Items / Map / System-Settings). Carries the entry id so the scene can
 * title and route the panel without a second lookup.
 */
export interface PauseMenuPanelRoute {
  readonly kind: "panel";
  readonly panel: PauseMenuEntryId;
}

/** The semantic destination a menu entry resolves to when confirmed. */
export type PauseMenuRoute =
  PauseMenuGrowthRoute | PauseMenuLedgerRoute | PauseMenuPanelRoute;

/** One pause/main-menu entry: its id, its display label, and its route. */
export interface PauseMenuEntry {
  readonly id: PauseMenuEntryId;
  readonly label: string;
  readonly route: PauseMenuRoute;
}

/**
 * The six pause/main-menu entries in their committed display order
 * (`wiki/design/ui-ux-and-controls.md`): Party, Builds, Items, Ledger, Map,
 * System/Settings. **Builds** routes to the existing growth screen (#76) and
 * **Ledger** surfaces the moral ledger (#98); the rest open in-menu panels. This
 * array IS the contract the six-entries acceptance criterion asserts.
 */
export const PAUSE_MENU_ENTRIES: readonly PauseMenuEntry[] = [
  {
    id: PauseMenuEntryIds.party,
    label: "Party",
    route: { kind: "panel", panel: PauseMenuEntryIds.party },
  },
  { id: PauseMenuEntryIds.builds, label: "Builds", route: { kind: "growth" } },
  {
    id: PauseMenuEntryIds.items,
    label: "Items",
    route: { kind: "panel", panel: PauseMenuEntryIds.items },
  },
  { id: PauseMenuEntryIds.ledger, label: "Ledger", route: { kind: "ledger" } },
  {
    id: PauseMenuEntryIds.map,
    label: "Map",
    route: { kind: "panel", panel: PauseMenuEntryIds.map },
  },
  {
    id: PauseMenuEntryIds.system,
    label: "System/Settings",
    route: { kind: "panel", panel: PauseMenuEntryIds.system },
  },
] as const;

/** The live cursor state of the pause/main menu (which entry is focused). */
export interface PauseMenuState {
  /** The zero-based index of the focused entry within {@link PAUSE_MENU_ENTRIES}. */
  readonly cursor: number;
}

/**
 * The initial menu state: the cursor rests on the first entry (Party).
 * @returns A fresh pause-menu state.
 */
export function newPauseMenuState(): PauseMenuState {
  return { cursor: 0 };
}

/**
 * Move the cursor by `delta` entries, wrapping around both ends so the list is a
 * ring (down past the last entry lands on the first; up past the first lands on
 * the last). Pure and total — any integer delta lands on a valid index.
 * @param state - The current menu state (never mutated).
 * @param delta - The signed step (−1 = up, +1 = down).
 * @returns The next menu state.
 */
export function moveCursor(
  state: PauseMenuState,
  delta: number
): PauseMenuState {
  const count = PAUSE_MENU_ENTRIES.length;
  const next = (((state.cursor + delta) % count) + count) % count;
  return { cursor: next };
}

/**
 * Read the entry the cursor currently focuses.
 * @param state - The current menu state.
 * @returns The focused {@link PauseMenuEntry}.
 */
export function selectedEntry(state: PauseMenuState): PauseMenuEntry {
  const count = PAUSE_MENU_ENTRIES.length;
  const index = ((state.cursor % count) + count) % count;
  const entry = PAUSE_MENU_ENTRIES[index];
  if (entry === undefined) {
    throw new RangeError(`pause-menu cursor out of range: ${state.cursor}`);
  }
  return entry;
}

/**
 * Format a {@link MoralLedger} into the human-readable lines the **Ledger** panel
 * renders (#98): the net karma with its lean, and the per-mode resolution tally.
 * Pure — the scene reads the live ledger (from the save) and renders these lines;
 * the wording lives here so it is unit-tested headless.
 * @param ledger - The moral ledger to summarize.
 * @returns The ordered display lines for the ledger panel.
 */
export function formatMoralLedger(ledger: MoralLedger): readonly string[] {
  const lean =
    ledger.karma > 0 ? "Free" : ledger.karma < 0 ? "Wield" : "Balanced";
  return [
    `Karma: ${ledger.karma >= 0 ? "+" : ""}${ledger.karma} (${lean})`,
    `Freed: ${ledger.freeChoices}`,
    `Wielded: ${ledger.wieldChoices}`,
  ];
}
