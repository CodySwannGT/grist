/**
 * Unit coverage for the pure pause-menu key→intent map (`services/menu-input-map`):
 * the Phaser-free `keyToMenuIntent` the live Menu scene routes through so it reads
 * "up"/"down"/"confirm"/"cancel", never raw key codes. Asserts the
 * ui-ux-and-controls bindings (arrows / W-S move, Confirm/Interact → confirm,
 * Cancel/Back → cancel) and totality for unbound keys — the keyboard-operable
 * acceptance criterion's headless proof (#113).
 */
import { describe, expect, it } from "vitest";

import { keyToMenuIntent } from "../../src/services/menu-input-map";

describe("keyToMenuIntent — up / down / confirm / cancel bindings", () => {
  it("maps the up keys (ArrowUp / W) to up", () => {
    for (const code of ["ArrowUp", "KeyW"]) {
      expect(keyToMenuIntent(code)).toEqual({ kind: "up" });
    }
  });

  it("maps the down keys (ArrowDown / S) to down", () => {
    for (const code of ["ArrowDown", "KeyS"]) {
      expect(keyToMenuIntent(code)).toEqual({ kind: "down" });
    }
  });

  it("maps Confirm/Interact keys to confirm", () => {
    for (const code of ["Enter", "NumpadEnter", "Space", "KeyE"]) {
      expect(keyToMenuIntent(code)).toEqual({ kind: "confirm" });
    }
  });

  it("maps Cancel/Back keys to cancel", () => {
    for (const code of ["Escape", "KeyQ"]) {
      expect(keyToMenuIntent(code)).toEqual({ kind: "cancel" });
    }
  });

  it("returns null for any unbound key (totality)", () => {
    for (const code of ["KeyA", "ArrowLeft", "ArrowRight", "Tab", "F5", ""]) {
      expect(keyToMenuIntent(code)).toBeNull();
    }
  });
});
