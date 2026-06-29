/**
 * The pure, Phaser-free key→intent map for the dialogue presenter (sub-task #104):
 * the single place a raw key code is translated into a **named dialogue intent**
 * — advance, skip, or choose-the-Nth-branch — so the scene reads "advance", never
 * "Enter was pressed". A total function over plain strings, unit-tested headless;
 * the {@link import("./dialogue-input").DialogueInputService} owns the live Phaser
 * subscription and publishes these intents on the bus (the dialogue counterpart of
 * `keyToFieldIntent` in `services/field-input-map`).
 *
 * Bindings follow `wiki/design/ui-ux-and-controls.md`: Confirm/Interact (Enter / E
 * / Space) advances, Cancel/Back (Esc / Q) skips, and the number row (1–9) selects
 * the Nth branch choice where a fork offers them.
 * @module services/dialogue-input-map
 */

/** Advance to the next caption (or cross scenes at a scene's end). */
export interface DialogueAdvanceIntent {
  readonly kind: "advance";
}

/** Skip the rest of the narrative. */
export interface DialogueSkipIntent {
  readonly kind: "skip";
}

/**
 * Choose the branch at a zero-based index (the scene resolves the index to the
 * live node's choice id). Emitted from the number row at a fork.
 */
export interface DialogueChooseIntent {
  readonly kind: "choose";
  /** The zero-based branch index the key selected. */
  readonly index: number;
}

/** The enumerated semantic dialogue intent the input layer publishes. */
export type DialogueIntent =
  DialogueAdvanceIntent | DialogueSkipIntent | DialogueChooseIntent;

/** Key codes (Phaser/`KeyboardEvent.code`) that advance the dialogue. */
const ADVANCE_CODES: ReadonlySet<string> = new Set([
  "Enter",
  "NumpadEnter",
  "Space",
  "KeyE",
]);

/** Key codes that skip the dialogue. */
const SKIP_CODES: ReadonlySet<string> = new Set(["Escape", "KeyQ"]);

/** The `Digit1`…`Digit9` prefix the number row uses for branch selection. */
const DIGIT_PREFIX = "Digit";

/**
 * Translate a raw key code into a {@link DialogueIntent}, or `null` when the key
 * is not bound. Total and pure: `Digit1`…`Digit9` map to a zero-based `choose`
 * index (1 → 0); `Digit0` is intentionally unbound (no zeroth choice). The caller
 * decides whether a `choose` intent applies at the current node.
 * @param code - The `KeyboardEvent.code` (physical key).
 * @returns The bound intent, or `null` when the key is not mapped.
 */
export function keyToDialogueIntent(code: string): DialogueIntent | null {
  if (ADVANCE_CODES.has(code)) {
    return { kind: "advance" };
  }
  if (SKIP_CODES.has(code)) {
    return { kind: "skip" };
  }
  if (code.startsWith(DIGIT_PREFIX)) {
    const digit = Number(code.slice(DIGIT_PREFIX.length));
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      return { kind: "choose", index: digit - 1 };
    }
  }
  return null;
}
