import { describe, expect, it } from "vitest";

import {
  InputDevices,
  keyToIntent,
  TOGGLE_SPEED,
} from "../../src/services/input-map";

describe("keyboard key -> intent map", () => {
  it("maps menu navigation (W/S and arrows)", () => {
    expect(keyToIntent("ArrowUp")).toEqual({ kind: "navigate", delta: -1 });
    expect(keyToIntent("KeyW")).toEqual({ kind: "navigate", delta: -1 });
    expect(keyToIntent("ArrowDown")).toEqual({ kind: "navigate", delta: 1 });
    expect(keyToIntent("KeyS")).toEqual({ kind: "navigate", delta: 1 });
  });

  it("maps target cycling (A/D and left/right)", () => {
    expect(keyToIntent("ArrowLeft")).toEqual({ kind: "target", delta: -1 });
    expect(keyToIntent("KeyA")).toEqual({ kind: "target", delta: -1 });
    expect(keyToIntent("ArrowRight")).toEqual({ kind: "target", delta: 1 });
    expect(keyToIntent("KeyD")).toEqual({ kind: "target", delta: 1 });
  });

  it("maps confirm, cancel, and the speed toggle", () => {
    expect(keyToIntent("Enter")).toEqual({ kind: "confirm" });
    expect(keyToIntent("Space")).toEqual({ kind: "confirm" });
    expect(keyToIntent("KeyE")).toEqual({ kind: "confirm" });
    expect(keyToIntent("Escape")).toEqual({ kind: "cancel" });
    expect(keyToIntent("KeyQ")).toEqual({ kind: "cancel" });
    expect(keyToIntent("ShiftLeft")).toEqual(TOGGLE_SPEED);
    expect(keyToIntent("ShiftRight")).toEqual(TOGGLE_SPEED);
  });

  it("returns null for unbound keys", () => {
    expect(keyToIntent("KeyZ")).toBeNull();
    expect(keyToIntent("F5")).toBeNull();
    expect(keyToIntent("")).toBeNull();
  });

  it("exposes the two input device tags", () => {
    expect(InputDevices.keyboard).toBe("keyboard");
    expect(InputDevices.pointer).toBe("pointer");
  });
});
