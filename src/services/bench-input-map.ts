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
 * A semantic bench action the player requested at the growth screen: equip a
 * shard (begins its learning), buy a grist sink (changes the build), or **back**
 * out of the Bench (#239) — the exit that returns to the pause Menu (which then
 * resumes the Field). Each is a discrete, one-shot intent — there is no continuous
 * bench input. `back` is the bench counterpart of the field/menu Cancel verb, so
 * the "actions, not raw keys" boundary now covers the exit too.
 */
export type BenchIntent =
  | { readonly kind: "equip"; readonly shard: BoundId }
  | { readonly kind: "buy-sink"; readonly sink: BenchSinkId }
  | { readonly kind: "back" };

/**
 * Key codes (`KeyboardEvent.code`) that back out of the Bench — the same Cancel/Back
 * verb the menu (`Escape` / `KeyQ`) and dialogue layers use, so the exit binding is
 * consistent across screens (`wiki/design/ui-ux-and-controls.md`).
 */
const BACK_CODES: ReadonlySet<string> = new Set(["Escape", "KeyQ"]);

/**
 * Translate a physical key code into a bench intent, or null when the key is
 * unbound. The Bench is otherwise a pointer-first menu, so the only bound keys are
 * the Back verb — pure and headless-testable, the bench counterpart of
 * {@link import("./menu-input-map").keyToMenuIntent}.
 * @param code - The `KeyboardEvent.code` (physical key, e.g. `"Escape"`).
 * @returns The `back` intent for a bound key, or null.
 */
export function keyToBenchIntent(code: string): BenchIntent | null {
  return BACK_CODES.has(code) ? { kind: "back" } : null;
}
