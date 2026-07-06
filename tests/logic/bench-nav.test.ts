/**
 * Unit coverage for the pure bench-navigation model (`logic/bench-nav`) — the
 * headless proof for sub-task #239's exit decision. Asserts that a Back/Esc press
 * at the Bench returns to the caller scene when the Bench was launched from one (the
 * pause Menu via Builds), and stays put when the Bench was reached standalone (the
 * `?scene=bench` verification seam) — the symmetric counterpart of the pause menu's
 * `resolveMenuCancel` peel. Mirrors `tests/logic/pause-menu.test.ts`.
 */
import { describe, expect, it } from "vitest";

import { resolveBenchBack } from "../../src/logic/bench-nav";
import { SceneKeys } from "../../src/consts";

describe("resolveBenchBack — the Bench's Back/Esc exit decision (#239)", () => {
  it("returns to the caller scene when the Bench was opened from one (Menu via Builds)", () => {
    expect(resolveBenchBack(SceneKeys.Menu)).toEqual({
      kind: "return",
      scene: SceneKeys.Menu,
    });
  });

  it("carries whatever caller it was given (it never hard-codes the Menu)", () => {
    expect(resolveBenchBack(SceneKeys.Field)).toEqual({
      kind: "return",
      scene: SceneKeys.Field,
    });
  });

  it("stays put when the Bench was reached standalone (the ?scene=bench seam)", () => {
    expect(resolveBenchBack(null)).toEqual({ kind: "stay" });
  });
});
