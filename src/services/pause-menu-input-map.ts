/**
 * The Phaser-free core of the pause/main-menu semantic input layer (#113): the
 * device-agnostic menu intent vocabulary and the pure key→intent map. Kept
 * separate from {@link import("./pause-menu-input").PauseMenuInputService} (which
 * wires this to Phaser's keyboard/pointer plugins) so the keyboard scheme is a
 * total function that unit-tests headless, with no Phaser import. Remapping a key
 * is a change here. The menu counterpart of {@link
 * import("./input-map").keyToIntent} — deliberately free of any `src/ui` import so
 * the low-level input layer never depends on the UI: a tapped entry travels as a
 * plain id string the scene validates against its catalog.
 * @module services/pause-menu-input-map
 */

/**
 * A device-agnostic pause/main-menu UI intent. Keyboard produces the relative
 * navigate (Up/Down) plus confirm/cancel; a pointer additionally produces the
 * absolute `select-entry` (tapping an entry row). The scene is the sole
 * interpreter — it maps the highlighted index or a tapped entry id to a route.
 */
export type MenuIntent =
  | { readonly kind: "navigate"; readonly delta: -1 | 1 }
  | { readonly kind: "confirm" }
  | { readonly kind: "cancel" }
  | { readonly kind: "select-entry"; readonly entry: string };

const NAV_PREV: MenuIntent = { kind: "navigate", delta: -1 };
const NAV_NEXT: MenuIntent = { kind: "navigate", delta: 1 };
const CONFIRM: MenuIntent = { kind: "confirm" };
const CANCEL: MenuIntent = { kind: "cancel" };

/**
 * The keyboard map, by physical `KeyboardEvent.code` so it is layout-stable:
 * Up/Down and W/S move the highlight, Enter/Space/E confirm the highlighted
 * entry, and Esc/Q cancel (close the menu, resume underneath). A vertical list,
 * so Left/Right are intentionally unbound (ui-ux-and-controls control table;
 * remappable — change it here).
 */
const KEY_INTENTS: Record<string, MenuIntent> = {
  ArrowUp: NAV_PREV,
  KeyW: NAV_PREV,
  ArrowDown: NAV_NEXT,
  KeyS: NAV_NEXT,
  Enter: CONFIRM,
  Space: CONFIRM,
  KeyE: CONFIRM,
  Escape: CANCEL,
  KeyQ: CANCEL,
};

/**
 * Translate a physical key code into its menu intent, or null when the key is
 * unbound. Pure — the headless-testable core of the menu keyboard scheme.
 * @param code - The `KeyboardEvent.code` (e.g. `"ArrowUp"`, `"Enter"`).
 * @returns The mapped intent, or null.
 */
export function keyToMenuIntent(code: string): MenuIntent | null {
  return KEY_INTENTS[code] ?? null;
}
