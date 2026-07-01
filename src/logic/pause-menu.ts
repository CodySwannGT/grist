/**
 * The pause/main menu catalog (#113, PRD #42 FR7/AC9/AC10, ui-ux-and-controls
 * "menus"): the six player-facing menu entries — **Party, Builds, Items, Ledger,
 * Map, System/Settings** — their display labels, and the pure mapping from a
 * selected entry to the {@link SceneKeys scene} it opens. The **Builds** entry
 * routes to the *existing* Phase-2 growth screen ({@link SceneKeys.Bench}, #76) —
 * reused, never re-spec'd; the other entries name scenes that arrive in follow-up
 * sub-tasks, so their route is `null` (present-but-unrouted) while the entry still
 * exists in the menu. Also holds the pure, wrap-around navigation reducer the
 * keyboard-navigable menu drives its highlight with.
 *
 * Phaser-free, content-free, and total — no `Math.random` / `Date.now`, no I/O —
 * so the whole catalog typechecks under plain `tsc` and unit-tests headless. The
 * PauseMenu scene layers only rendering + input wiring on top of these ids; the
 * labels, order, and routes have exactly one source here so they can never drift.
 * @module logic/pause-menu
 */
import { SceneKeys, type SceneKey } from "../consts";

/**
 * Canonical pause/main-menu entry ids, in the default (rendered) menu order.
 * Reference the keyed values rather than inline strings so a typo is a compile
 * error and the order has one source (mirrors {@link import("./commands").Commands}).
 */
export const MenuEntries = {
  party: "party",
  builds: "builds",
  items: "items",
  ledger: "ledger",
  map: "map",
  system: "system",
} as const;

/**
 * A menu-entry id (the literal-union of every {@link MenuEntries} value:
 * `"party" | "builds" | "items" | "ledger" | "map" | "system"`).
 */
export type MenuEntryId = (typeof MenuEntries)[keyof typeof MenuEntries];

/**
 * The exact ordered set of entries the pause/main menu exposes (#113 AC1): Party,
 * Builds, Items, Ledger, Map, System/Settings — no more, no fewer, in this order.
 * The scene renders this list top-to-bottom; the navigation reducer wraps around
 * its length.
 */
export const MENU_ENTRY_ORDER: readonly MenuEntryId[] = [
  MenuEntries.party,
  MenuEntries.builds,
  MenuEntries.items,
  MenuEntries.ledger,
  MenuEntries.map,
  MenuEntries.system,
];

/** A menu entry's static definition: its display label and the scene it opens. */
interface MenuEntryDef {
  /** The menu label rendered for the entry (ui-ux-and-controls display name). */
  readonly label: string;
  /**
   * The scene the entry opens, or `null` when its destination scene is a
   * follow-up sub-task (the entry is present in the menu but not yet routed).
   * **Builds** is the only wired route in this slice — the existing #76 growth
   * screen ({@link SceneKeys.Bench}); routing it anywhere else would re-spec the
   * growth loop, which AC2 forbids.
   */
  readonly route: SceneKey | null;
}

/**
 * The entry table. **Builds → {@link SceneKeys.Bench}** is the reused Phase-2
 * growth screen (#76). The remaining entries name their destination scenes as
 * follow-ups (Party/Items/Map/System-Settings screens; Ledger surfaces the moral
 * ledger #98, whose scene is not built here), so their route is `null` until those
 * scenes land — the entry still renders and is selectable (AC1) meanwhile.
 */
const MENU_ENTRIES: Record<MenuEntryId, MenuEntryDef> = {
  party: { label: "Party", route: null },
  builds: { label: "Builds", route: SceneKeys.Bench },
  items: { label: "Items", route: null },
  ledger: { label: "Ledger", route: null },
  map: { label: "Map", route: null },
  system: { label: "System/Settings", route: null },
};

/**
 * The display label for a menu entry (e.g. `"Builds"`).
 * @param entry - The menu-entry id.
 * @returns The rendered label.
 */
export function menuEntryLabel(entry: MenuEntryId): string {
  return MENU_ENTRIES[entry].label;
}

/**
 * The scene a menu entry opens when confirmed, or `null` when its destination is
 * a follow-up sub-task. **Builds** returns {@link SceneKeys.Bench} — the existing
 * Phase-2 growth screen (#76), reused not re-spec'd (AC2). A `null` route means
 * the entry is present in the menu but selecting it opens nothing yet.
 * @param entry - The menu-entry id.
 * @returns The target scene key, or null when unrouted.
 */
export function menuEntryRoute(entry: MenuEntryId): SceneKey | null {
  return MENU_ENTRIES[entry].route;
}

/**
 * Move the highlighted menu index by one step, wrapping around the six-entry list
 * so Up on the first entry lands on the last and Down on the last lands on the
 * first (a keyboard-navigable menu never dead-ends). Pure and total — the whole
 * navigation rule is this one modular step, so it unit-tests headless.
 * @param index - The current highlighted index (0-based).
 * @param delta - The step: -1 for previous (Up), +1 for next (Down).
 * @returns The next highlighted index, wrapped into `[0, MENU_ENTRY_ORDER.length)`.
 */
export function moveSelection(index: number, delta: -1 | 1): number {
  const count = MENU_ENTRY_ORDER.length;
  return (index + delta + count) % count;
}
