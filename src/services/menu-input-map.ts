/**
 * The pure, Phaser-free key→intent map for the pause/main menu (sub-task #113):
 * the single place a raw key code becomes a **named menu intent** — move the
 * cursor up/down, confirm the focused entry, or cancel/close the menu — so the
 * {@link import("../scenes/Menu").Menu} scene reads "confirm", never "Enter was
 * pressed". A total function over plain strings, unit-tested headless (the menu
 * counterpart of `keyToDialogueIntent` in `services/dialogue-input-map`).
 *
 * Bindings follow `wiki/design/ui-ux-and-controls.md`: the cursor moves on the
 * vertical arrows or W/S, Confirm/Interact (Enter / Space / E) selects the focused
 * entry, and Cancel/Back (Esc / Q) closes the menu — the same Confirm/Cancel verbs
 * the dialogue and bench inputs use, so the controls stay consistent across screens.
 * @module services/menu-input-map
 */

/** Move the menu cursor to the previous (upward) entry. */
export interface MenuUpIntent {
  readonly kind: "up";
}

/** Move the menu cursor to the next (downward) entry. */
export interface MenuDownIntent {
  readonly kind: "down";
}

/** Confirm/open the focused entry (Builds → growth, Ledger → ledger, …). */
export interface MenuConfirmIntent {
  readonly kind: "confirm";
}

/** Cancel/close the menu (or back out of an open panel). */
export interface MenuCancelIntent {
  readonly kind: "cancel";
}

/** The enumerated semantic menu intent the input layer publishes. */
export type MenuIntent =
  MenuUpIntent | MenuDownIntent | MenuConfirmIntent | MenuCancelIntent;

/** Key codes (`KeyboardEvent.code`) that move the cursor up. */
const UP_CODES: ReadonlySet<string> = new Set(["ArrowUp", "KeyW"]);

/** Key codes that move the cursor down. */
const DOWN_CODES: ReadonlySet<string> = new Set(["ArrowDown", "KeyS"]);

/** Key codes that confirm the focused entry. */
const CONFIRM_CODES: ReadonlySet<string> = new Set([
  "Enter",
  "NumpadEnter",
  "Space",
  "KeyE",
]);

/** Key codes that cancel/close the menu. */
const CANCEL_CODES: ReadonlySet<string> = new Set(["Escape", "KeyQ"]);

/**
 * Translate a raw key code into a {@link MenuIntent}, or `null` when the key is
 * not bound. Total and pure: every supported control maps to exactly one intent
 * and any other key returns `null`, so the scene's keyboard handler stays a thin
 * "intent or nothing" switch.
 * @param code - The `KeyboardEvent.code` (physical key).
 * @returns The bound intent, or `null` when the key is not mapped.
 */
export function keyToMenuIntent(code: string): MenuIntent | null {
  if (UP_CODES.has(code)) {
    return { kind: "up" };
  }
  if (DOWN_CODES.has(code)) {
    return { kind: "down" };
  }
  if (CONFIRM_CODES.has(code)) {
    return { kind: "confirm" };
  }
  if (CANCEL_CODES.has(code)) {
    return { kind: "cancel" };
  }
  return null;
}
