import { describe, expect, it } from "vitest";

import { keyToMenuIntent } from "../../src/services/pause-menu-input-map";

describe("pause/main menu keyboard scheme (keyToMenuIntent)", () => {
  it("navigates the menu with Up/Down and W/S (the locked keyboard-navigable requirement)", () => {
    expect(keyToMenuIntent("ArrowUp")).toEqual({ kind: "navigate", delta: -1 });
    expect(keyToMenuIntent("KeyW")).toEqual({ kind: "navigate", delta: -1 });
    expect(keyToMenuIntent("ArrowDown")).toEqual({
      kind: "navigate",
      delta: 1,
    });
    expect(keyToMenuIntent("KeyS")).toEqual({ kind: "navigate", delta: 1 });
  });

  it("confirms the highlighted entry with Enter/Space/E", () => {
    expect(keyToMenuIntent("Enter")).toEqual({ kind: "confirm" });
    expect(keyToMenuIntent("Space")).toEqual({ kind: "confirm" });
    expect(keyToMenuIntent("KeyE")).toEqual({ kind: "confirm" });
  });

  it("closes the menu with Esc/Q (cancel — resume underneath)", () => {
    expect(keyToMenuIntent("Escape")).toEqual({ kind: "cancel" });
    expect(keyToMenuIntent("KeyQ")).toEqual({ kind: "cancel" });
  });

  it("returns null for an unbound key (no ad-hoc handling)", () => {
    expect(keyToMenuIntent("KeyZ")).toBeNull();
    expect(keyToMenuIntent("ArrowLeft")).toBeNull();
  });
});
