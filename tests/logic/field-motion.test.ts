/**
 * Unit twin for the pure Wren-motion helpers (`src/scenes/field-motion`, extracted
 * for #233) — the per-frame normalize-and-scale step, the walkable-floor clamp, and
 * the unit-step clamp the Field scene applies to Wren's continuous render position.
 * Proves the arithmetic headless (no Phaser, no scene), the way `field-input.test`
 * proves the key→intent map.
 */
import { describe, expect, it } from "vitest";

import { FieldLayout, GameView } from "../../src/consts";
import {
  FieldMoveDirections,
  type FieldMoveDir,
} from "../../src/services/field-input-map";
import {
  clampUnit,
  clampWrenToFloor,
  stepWren,
} from "../../src/scenes/field-motion";

describe("stepWren — normalized, delta-driven advance", () => {
  it("advances one axis by moveSpeed * delta over a full second", () => {
    const next = stepWren(100, 100, FieldMoveDirections.right, 1, 1000);
    expect(next.x).toBeCloseTo(100 + FieldLayout.moveSpeed);
    expect(next.y).toBeCloseTo(100);
  });

  it("walks a held diagonal at the same speed as a straight step (normalized)", () => {
    const delta = 1000;
    const diagonal: FieldMoveDir = { dx: 1, dy: 1 };
    const len = Math.hypot(diagonal.dx, diagonal.dy);
    const next = stepWren(0, 0, diagonal, len, delta);
    // Total displacement equals moveSpeed — the diagonal is not ~41% faster.
    expect(Math.hypot(next.x, next.y)).toBeCloseTo(FieldLayout.moveSpeed);
  });

  it("scales with the frame delta (half a second is half the step)", () => {
    const full = stepWren(0, 0, FieldMoveDirections.down, 1, 1000);
    const half = stepWren(0, 0, FieldMoveDirections.down, 1, 500);
    expect(half.y).toBeCloseTo(full.y / 2);
  });
});

describe("clampWrenToFloor — the walkable band", () => {
  it("keeps an in-bounds point untouched", () => {
    expect(clampWrenToFloor({ x: 200, y: 120 })).toEqual({ x: 200, y: 120 });
  });

  it("clamps past the left/top edges to the inset and wall line", () => {
    expect(clampWrenToFloor({ x: -50, y: -50 })).toEqual({
      x: FieldLayout.edgeInset,
      y: FieldLayout.wallY + FieldLayout.edgeInset,
    });
  });

  it("clamps past the right/bottom edges to the inset", () => {
    expect(clampWrenToFloor({ x: 9999, y: 9999 })).toEqual({
      x: GameView.width - FieldLayout.edgeInset,
      y: GameView.height - FieldLayout.edgeInset,
    });
  });
});

describe("clampUnit — fractional step component", () => {
  it("passes a sub-unit magnitude through unchanged", () => {
    expect(clampUnit(0.4)).toBeCloseTo(0.4);
    expect(clampUnit(-0.4)).toBeCloseTo(-0.4);
  });

  it("clamps beyond ±1 to the unit bound", () => {
    expect(clampUnit(3)).toBe(1);
    expect(clampUnit(-3)).toBe(-1);
  });
});
