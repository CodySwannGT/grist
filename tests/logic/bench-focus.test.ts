/**
 * Unit coverage for the pure bench focus-ring model (`logic/bench-focus`) — the
 * headless proof for sub-task #246's keyboard navigation. The Bench was mouse-only
 * (arrows/Enter did nothing); this model gives it the pause menu's cursor idiom.
 * Asserts the control order, the fresh cursor, the wrap-around ring in both
 * directions, the focused-control read, and the stable id projection the
 * verification bridge surfaces. Mirrors `tests/logic/pause-menu.test.ts`.
 */
import { describe, expect, it } from "vitest";

import {
  BENCH_CONTROL_ORDER,
  controlId,
  focusedControl,
  moveBenchFocus,
  newBenchFocus,
} from "../../src/logic/bench-focus";
import { BenchSinkIds } from "../../src/content/bench";

describe("BENCH_CONTROL_ORDER — the bench's focus-visitable controls (#246)", () => {
  it("visits equip, both sinks, then Back — top to bottom", () => {
    expect(BENCH_CONTROL_ORDER).toEqual([
      { kind: "equip" },
      { kind: "sink", sink: BenchSinkIds.runnersReflex },
      { kind: "sink", sink: BenchSinkIds.accelerateCinder },
      { kind: "back" },
    ]);
  });
});

describe("newBenchFocus — the opening focus state", () => {
  it("rests the cursor on the first control (equip)", () => {
    expect(newBenchFocus()).toEqual({ cursor: 0 });
    expect(focusedControl(newBenchFocus())).toEqual({ kind: "equip" });
  });
});

describe("moveBenchFocus — the wrap-around ring", () => {
  it("steps down through the controls in order", () => {
    let state = newBenchFocus();
    state = moveBenchFocus(state, 1);
    expect(focusedControl(state)).toEqual({
      kind: "sink",
      sink: BenchSinkIds.runnersReflex,
    });
    state = moveBenchFocus(state, 1);
    expect(focusedControl(state)).toEqual({
      kind: "sink",
      sink: BenchSinkIds.accelerateCinder,
    });
    state = moveBenchFocus(state, 1);
    expect(focusedControl(state)).toEqual({ kind: "back" });
  });

  it("wraps from the last control down to the first (no dead end)", () => {
    const last = { cursor: BENCH_CONTROL_ORDER.length - 1 };
    expect(moveBenchFocus(last, 1)).toEqual({ cursor: 0 });
  });

  it("wraps from the first control up to the last (no dead end)", () => {
    expect(moveBenchFocus(newBenchFocus(), -1)).toEqual({
      cursor: BENCH_CONTROL_ORDER.length - 1,
    });
    expect(focusedControl(moveBenchFocus(newBenchFocus(), -1))).toEqual({
      kind: "back",
    });
  });

  it("never mutates the input state (pure)", () => {
    const state = newBenchFocus();
    moveBenchFocus(state, 1);
    expect(state).toEqual({ cursor: 0 });
  });
});

describe("controlId — the stable id the verification bridge surfaces", () => {
  it("names equip and back by their kind, and a sink by its own id", () => {
    expect(controlId({ kind: "equip" })).toBe("equip");
    expect(controlId({ kind: "back" })).toBe("back");
    expect(controlId({ kind: "sink", sink: BenchSinkIds.runnersReflex })).toBe(
      BenchSinkIds.runnersReflex
    );
  });
});
