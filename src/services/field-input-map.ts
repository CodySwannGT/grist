/**
 * The Phaser-free core of the field semantic input layer: the device-agnostic
 * field intent vocabulary (a directional MOVE plus an EXAMINE) and the pure
 * key→intent map. This is the field counterpart of {@link import("./input-map")}
 * (the battle key→intent map): a total function that unit-tests headless with no
 * Phaser import, so the field control scheme stays "actions, not raw keys" — the
 * Field scene never reads `event.key`; it consumes these named intents. Remapping
 * a field key is a change here and nowhere else.
 *
 * MOVE is a *directional* intent (a screen-space unit vector) rather than the
 * battle layer's relative navigate/target intents, because field traversal is
 * continuous 2-D movement, not menu cursoring — but it is still a semantic intent
 * published on the bus, not a raw key read in the scene.
 * @module services/field-input-map
 */

/** A screen-space unit step (y grows downward, matching canvas coordinates). */
export interface FieldMoveDir {
  /** Horizontal component: -1 left, 0 none, 1 right. */
  readonly dx: -1 | 0 | 1;
  /** Vertical component: -1 up, 0 none, 1 down (screen coords). */
  readonly dy: -1 | 0 | 1;
}

/**
 * The four cardinal move directions as screen-space unit vectors. The Field
 * scene multiplies the active direction by its frame-delta movement speed, so
 * movement stays delta-driven and deterministic (no per-key pixel constants leak
 * into the keyboard map).
 */
export const FieldMoveDirections = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
} as const satisfies Readonly<Record<string, FieldMoveDir>>;

/**
 * A device-agnostic field intent. `move` carries a cardinal direction the player
 * holds (keyboard); `move-to` carries a logical (384×216) destination the player
 * tapped (touch/pointer); `examine` asks the scene to inspect the prop nearest
 * Wren (the rendering-notice sign in Room A). The scene is the sole interpreter —
 * it maps directional/destination intents to delta-driven position updates and
 * `examine` to a field `examine` action through the pure sim selector. Keyboard
 * produces `move` + `examine`; touch produces `move-to` + `examine`.
 */
export type FieldIntent =
  | { readonly kind: "move"; readonly dir: FieldMoveDir }
  | { readonly kind: "move-to"; readonly x: number; readonly y: number }
  | { readonly kind: "examine" };

const MOVE_UP: FieldIntent = { kind: "move", dir: FieldMoveDirections.up };
const MOVE_DOWN: FieldIntent = { kind: "move", dir: FieldMoveDirections.down };
const MOVE_LEFT: FieldIntent = { kind: "move", dir: FieldMoveDirections.left };
const MOVE_RIGHT: FieldIntent = {
  kind: "move",
  dir: FieldMoveDirections.right,
};
const EXAMINE: FieldIntent = { kind: "examine" };

/**
 * The field keyboard map, keyed by physical `KeyboardEvent.code` so it is
 * layout-stable: W/S/A/D and the arrow keys step the four cardinals, and
 * Enter/Space/E examine the nearest prop (ui-ux-and-controls control table —
 * remappable, change it here).
 */
const FIELD_KEY_INTENTS: Readonly<Record<string, FieldIntent>> = {
  KeyW: MOVE_UP,
  ArrowUp: MOVE_UP,
  KeyS: MOVE_DOWN,
  ArrowDown: MOVE_DOWN,
  KeyA: MOVE_LEFT,
  ArrowLeft: MOVE_LEFT,
  KeyD: MOVE_RIGHT,
  ArrowRight: MOVE_RIGHT,
  Enter: EXAMINE,
  Space: EXAMINE,
  KeyE: EXAMINE,
};

/**
 * Translate a physical key code into its field intent, or null when the key is
 * unbound. Pure — the headless-testable core of the field keyboard scheme.
 * @param code - The `KeyboardEvent.code` (e.g. `"KeyW"`, `"ArrowLeft"`, `"Enter"`).
 * @returns The mapped field intent, or null.
 */
export function keyToFieldIntent(code: string): FieldIntent | null {
  return FIELD_KEY_INTENTS[code] ?? null;
}
