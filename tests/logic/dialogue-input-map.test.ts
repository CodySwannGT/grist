/**
 * Unit coverage for the pure dialogue key→intent map (`services/dialogue-input-map`):
 * the Phaser-free `keyToDialogueIntent` the live Dialogue scene routes through so it
 * reads "advance"/"skip"/"choose", never raw key codes. Asserts the
 * ui-ux-and-controls bindings (Confirm/Interact → advance, Cancel/Back → skip,
 * number row → choose-Nth) and totality for unbound keys.
 */
import { describe, expect, it } from "vitest";

import { keyToDialogueIntent } from "../../src/services/dialogue-input-map";

describe("keyToDialogueIntent — advance / skip / choose bindings", () => {
  it("maps Confirm/Interact keys to advance", () => {
    for (const code of ["Enter", "NumpadEnter", "Space", "KeyE"]) {
      expect(keyToDialogueIntent(code)).toEqual({ kind: "advance" });
    }
  });

  it("maps Cancel/Back keys to skip", () => {
    for (const code of ["Escape", "KeyQ"]) {
      expect(keyToDialogueIntent(code)).toEqual({ kind: "skip" });
    }
  });

  it("maps the number row to a zero-based choose index (1 → 0)", () => {
    expect(keyToDialogueIntent("Digit1")).toEqual({ kind: "choose", index: 0 });
    expect(keyToDialogueIntent("Digit2")).toEqual({ kind: "choose", index: 1 });
    expect(keyToDialogueIntent("Digit9")).toEqual({ kind: "choose", index: 8 });
  });

  it("leaves Digit0 unbound (there is no zeroth choice)", () => {
    expect(keyToDialogueIntent("Digit0")).toBeNull();
  });

  it("returns null for any unbound key (totality)", () => {
    for (const code of ["KeyA", "ArrowLeft", "Tab", "F5", ""]) {
      expect(keyToDialogueIntent(code)).toBeNull();
    }
  });
});
