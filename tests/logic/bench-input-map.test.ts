/**
 * Unit coverage for the pure bench key→intent map (`services/bench-input-map`): the
 * Phaser-free `keyToBenchIntent` the live Bench scene routes through so it reads
 * "move"/"confirm"/"back", never raw key codes. The Bench was mouse-only (#246);
 * these bindings mirror the pause menu (arrows / W-S move, Confirm/Interact →
 * confirm, Cancel/Back → back) so keyboard/gamepad/Deck players can drive it, and
 * totality holds for unbound keys. The headless proof of the keyboard-operable AC.
 */
import { describe, expect, it } from "vitest";

import { keyToBenchIntent } from "../../src/services/bench-input-map";

describe("keyToBenchIntent — move / confirm / back bindings (#246)", () => {
  it("maps the up keys (ArrowUp / W) to a move of -1", () => {
    for (const code of ["ArrowUp", "KeyW"]) {
      expect(keyToBenchIntent(code)).toEqual({ kind: "move", delta: -1 });
    }
  });

  it("maps the down keys (ArrowDown / S) to a move of +1", () => {
    for (const code of ["ArrowDown", "KeyS"]) {
      expect(keyToBenchIntent(code)).toEqual({ kind: "move", delta: 1 });
    }
  });

  it("maps Confirm/Interact keys to confirm", () => {
    for (const code of ["Enter", "NumpadEnter", "Space", "KeyE"]) {
      expect(keyToBenchIntent(code)).toEqual({ kind: "confirm" });
    }
  });

  it("maps Cancel/Back keys to back (the #239 exit, unchanged)", () => {
    for (const code of ["Escape", "KeyQ"]) {
      expect(keyToBenchIntent(code)).toEqual({ kind: "back" });
    }
  });

  it("returns null for any unbound key (totality)", () => {
    for (const code of ["KeyA", "ArrowLeft", "ArrowRight", "Tab", "F5", ""]) {
      expect(keyToBenchIntent(code)).toBeNull();
    }
  });
});
