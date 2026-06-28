/**
 * The Phaser-free core of the semantic input layer: the device-agnostic battle
 * intent vocabulary, the device tags, and the pure key→intent map. Kept separate
 * from {@link import("./input").InputService} (which wires this to Phaser's
 * keyboard/pointer plugins) so the keyboard scheme is a total function that
 * unit-tests headless, with no Phaser import. Remapping a key is a change here.
 * Deliberately free of any `src/ui` import so the low-level input layer never
 * depends on the UI: a tapped command travels as a plain id string that the HUD
 * controller validates against its catalog.
 * @module services/input-map
 */

/** Which device a semantic intent originated from (for verification + telemetry). */
export const InputDevices = {
  keyboard: "keyboard",
  pointer: "pointer",
} as const;

/** An input device id (`"keyboard" | "pointer"`). */
export type InputDevice = (typeof InputDevices)[keyof typeof InputDevices];

/**
 * A device-agnostic battle UI intent. Keyboard produces the relative forms
 * (navigate/target/confirm/cancel/toggle-speed); touch additionally produces the
 * absolute selections (`select-command` from tapping a command button,
 * `select-target` from tapping an enemy). The controller is the sole interpreter.
 */
export type InputIntent =
  | { readonly kind: "navigate"; readonly delta: -1 | 1 }
  | { readonly kind: "target"; readonly delta: -1 | 1 }
  | { readonly kind: "confirm" }
  | { readonly kind: "cancel" }
  | { readonly kind: "toggle-speed" }
  | { readonly kind: "select-command"; readonly command: string }
  | { readonly kind: "select-target"; readonly index: number };

const NAV_PREV: InputIntent = { kind: "navigate", delta: -1 };
const NAV_NEXT: InputIntent = { kind: "navigate", delta: 1 };
const TARGET_PREV: InputIntent = { kind: "target", delta: -1 };
const TARGET_NEXT: InputIntent = { kind: "target", delta: 1 };
const CONFIRM: InputIntent = { kind: "confirm" };
const CANCEL: InputIntent = { kind: "cancel" };

/** The pointer/touch battle-speed toggle intent (shared by the touch widget). */
export const TOGGLE_SPEED: InputIntent = { kind: "toggle-speed" };

/**
 * The keyboard map, by physical `KeyboardEvent.code` so it is layout-stable:
 * W/S and Up/Down navigate the menu, A/D and Left/Right cycle the target,
 * Enter/Space/E confirm, Esc/Q cancel, and Shift toggles battle speed
 * (ui-ux-and-controls control table; remappable — change it here).
 */
const KEY_INTENTS: Record<string, InputIntent> = {
  ArrowUp: NAV_PREV,
  KeyW: NAV_PREV,
  ArrowDown: NAV_NEXT,
  KeyS: NAV_NEXT,
  ArrowLeft: TARGET_PREV,
  KeyA: TARGET_PREV,
  ArrowRight: TARGET_NEXT,
  KeyD: TARGET_NEXT,
  Enter: CONFIRM,
  Space: CONFIRM,
  KeyE: CONFIRM,
  Escape: CANCEL,
  KeyQ: CANCEL,
  ShiftLeft: TOGGLE_SPEED,
  ShiftRight: TOGGLE_SPEED,
};

/**
 * Translate a physical key code into its battle intent, or null when the key is
 * unbound. Pure — the headless-testable core of the keyboard scheme.
 * @param code - The `KeyboardEvent.code` (e.g. `"ArrowUp"`, `"Enter"`).
 * @returns The mapped intent, or null.
 */
export function keyToIntent(code: string): InputIntent | null {
  return KEY_INTENTS[code] ?? null;
}
