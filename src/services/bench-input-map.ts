/**
 * The pure intent vocabulary for the growth/bench screen (#86). The Bench scene's
 * interactive buttons feed the semantic {@link import("./bench-input")
 * .BenchInputService}, which publishes these named intents on the EventsCenter
 * bus; the Bench scene subscribes and threads each through the pure run-state
 * reducers. No gameplay code reads a raw pointer — only these intents cross the
 * boundary ("actions, not raw keys/pointers", the bench counterpart of
 * {@link import("./field-input-map").FieldIntent}). Pure data — no Phaser.
 * @module services/bench-input-map
 */
import { type BenchSinkId } from "../content/bench";
import { type BoundId } from "../content/bounds";

/**
 * A semantic bench action the player requested at the growth screen: **move** the
 * focus cursor up/down its controls, **confirm** the focused control, equip a
 * shard (begins its learning), buy a grist sink (changes the build), or **back**
 * out of the Bench (#239) — the exit that returns to the pause Menu (which then
 * resumes the Field). `equip` / `buy-sink` are the concrete taps a pointer emits
 * (it knows exactly what it hit); `move` / `confirm` are the keyboard's navigate-
 * then-activate verbs (#246), mirroring the pause menu's up/down/confirm so the
 * Bench is keyboard/gamepad/Deck-operable, not mouse-only. `back` is the bench
 * counterpart of the field/menu Cancel verb, so the "actions, not raw keys"
 * boundary covers the exit too. Each is a discrete, one-shot intent.
 */
export type BenchIntent =
  | { readonly kind: "move"; readonly delta: -1 | 1 }
  | { readonly kind: "confirm" }
  | { readonly kind: "equip"; readonly shard: BoundId }
  | { readonly kind: "buy-sink"; readonly sink: BenchSinkId }
  | { readonly kind: "back" };

/** Key codes (`KeyboardEvent.code`) that move the focus cursor up (previous control). */
const UP_CODES: ReadonlySet<string> = new Set(["ArrowUp", "KeyW"]);

/** Key codes that move the focus cursor down (next control). */
const DOWN_CODES: ReadonlySet<string> = new Set(["ArrowDown", "KeyS"]);

/**
 * Key codes that confirm/activate the focused control — the same Confirm/Interact
 * verb (`Enter` / `NumpadEnter` / `Space` / `KeyE`) the menu and dialogue layers use.
 */
const CONFIRM_CODES: ReadonlySet<string> = new Set([
  "Enter",
  "NumpadEnter",
  "Space",
  "KeyE",
]);

/**
 * Key codes (`KeyboardEvent.code`) that back out of the Bench — the same Cancel/Back
 * verb the menu (`Escape` / `KeyQ`) and dialogue layers use, so the exit binding is
 * consistent across screens (`wiki/design/ui-ux-and-controls.md`).
 */
const BACK_CODES: ReadonlySet<string> = new Set(["Escape", "KeyQ"]);

/**
 * Translate a physical key code into a bench intent, or null when the key is
 * unbound. The Bench is a cursor menu (#246): the vertical arrows / W-S move the
 * focus, Confirm/Interact activates the focused control, and Cancel/Back exits —
 * the same bindings as the pause menu, so the controls stay consistent across
 * screens. Pure and headless-testable, the bench counterpart of
 * {@link import("./menu-input-map").keyToMenuIntent}.
 * @param code - The `KeyboardEvent.code` (physical key, e.g. `"Escape"`).
 * @returns The bound bench intent, or null when the key is unmapped.
 */
export function keyToBenchIntent(code: string): BenchIntent | null {
  if (UP_CODES.has(code)) {
    return { kind: "move", delta: -1 };
  }
  if (DOWN_CODES.has(code)) {
    return { kind: "move", delta: 1 };
  }
  if (CONFIRM_CODES.has(code)) {
    return { kind: "confirm" };
  }
  if (BACK_CODES.has(code)) {
    return { kind: "back" };
  }
  return null;
}
