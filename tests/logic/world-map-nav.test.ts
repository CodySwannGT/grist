/**
 * Unit coverage for the pure **world-map navigation model** (`src/logic/world-map-nav`,
 * #241) — the key→intent map and the wrap-around cursor. ZERO Phaser, exercised headless.
 */
import { describe, expect, it } from "vitest";

import {
  keyToWorldMapIntent,
  moveWorldMapCursor,
} from "../../src/logic/world-map-nav";

describe("world-map-nav — key mapping", () => {
  it("maps directional / select / back keys", () => {
    expect(keyToWorldMapIntent("ArrowUp")).toBe("up");
    expect(keyToWorldMapIntent("KeyW")).toBe("up");
    expect(keyToWorldMapIntent("ArrowDown")).toBe("down");
    expect(keyToWorldMapIntent("Enter")).toBe("select");
    expect(keyToWorldMapIntent("Space")).toBe("select");
    expect(keyToWorldMapIntent("Escape")).toBe("back");
    expect(keyToWorldMapIntent("KeyQ")).toBe("back");
    expect(keyToWorldMapIntent("KeyZ")).toBeNull();
  });
});

describe("world-map-nav — cursor ring", () => {
  it("wraps at both ends", () => {
    expect(moveWorldMapCursor(0, -1, 3)).toBe(2);
    expect(moveWorldMapCursor(2, 1, 3)).toBe(0);
    expect(moveWorldMapCursor(1, 1, 3)).toBe(2);
  });

  it("clamps a zero/empty count to 0", () => {
    expect(moveWorldMapCursor(0, 1, 0)).toBe(0);
  });
});
