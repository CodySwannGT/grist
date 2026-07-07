/**
 * The pure, Phaser-free **world-map navigation model** (#241) — the cursor ring over
 * the World Map's selectable entries and the raw-key → semantic intent map, mirroring
 * the `logic/pause-menu` + `services/*-input-map` split the rest of the game uses. The
 * World Map scene is a thin adapter that renders this model and maps an intent to an
 * action; the *rules* (wrap-around cursor, which key means what) live here so they are
 * unit-tested headless.
 *
 * The scene owns the ordered list of selectable entries (region rows first, then the
 * Act-specific nodes — the Reckoning hook in Act I, the reunion frontier + finale in
 * Act II); this module only moves a cursor within that count and classifies keys.
 * @module logic/world-map-nav
 */

/** A semantic World Map input intent (device-agnostic). */
export type WorldMapIntent = "up" | "down" | "select" | "back";

/** The raw `event.code`s that mean "move up the entry list". */
const UP_CODES: ReadonlySet<string> = new Set(["ArrowUp", "KeyW"]);
/** The raw `event.code`s that mean "move down the entry list". */
const DOWN_CODES: ReadonlySet<string> = new Set(["ArrowDown", "KeyS"]);
/** The raw `event.code`s that mean "select / travel". */
const SELECT_CODES: ReadonlySet<string> = new Set(["Enter", "Space"]);
/** The raw `event.code`s that mean "back / close". */
const BACK_CODES: ReadonlySet<string> = new Set(["Escape", "KeyQ"]);

/**
 * Classify a raw keyboard `event.code` into a semantic World Map intent, or null when
 * the key is unbound. Pure — a total function of the code.
 * @param code - The raw keyboard event code.
 * @returns The semantic intent, or null.
 */
export function keyToWorldMapIntent(code: string): WorldMapIntent | null {
  if (UP_CODES.has(code)) {
    return "up";
  }
  if (DOWN_CODES.has(code)) {
    return "down";
  }
  if (SELECT_CODES.has(code)) {
    return "select";
  }
  if (BACK_CODES.has(code)) {
    return "back";
  }
  return null;
}

/**
 * Move the cursor by `delta` within a ring of `count` entries, wrapping both ends so
 * the list is a ring (down past the last lands on the first; up past the first lands
 * on the last). Total for any integer delta; a zero/empty count clamps to 0. Pure.
 * @param cursor - The current cursor index.
 * @param delta - The signed step (−1 = up, +1 = down).
 * @param count - The number of selectable entries.
 * @returns The next cursor index.
 */
export function moveWorldMapCursor(
  cursor: number,
  delta: number,
  count: number
): number {
  if (count <= 0) {
    return 0;
  }
  return (((cursor + delta) % count) + count) % count;
}
