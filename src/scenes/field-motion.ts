/**
 * Pure, Phaser-free helpers for Wren's adapter-level field motion (#81 / #233): the
 * per-frame normalize-and-scale step and the walkable-floor clamp the Field scene
 * applies to her continuous in-room position. That position is render state the pure
 * field sim deliberately omits, so the arithmetic lives here — data in, point out —
 * keeping the Field scene a thin renderer under its line budget and letting the
 * motion math be unit-tested headless (no Phaser, no scene).
 * @module scenes/field-motion
 */
import { FieldLayout, GameView } from "../consts";
import { type FieldMoveDir } from "../services/field-input-map";

/** A logical (384×216) point — Wren's render position, data-in / data-out. */
interface FieldPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Advance a point by its normalized heading × `moveSpeed` × the frame delta.
 * Normalizing before scaling keeps every heading — single-axis, held diagonal, or a
 * fractional tap-to-move vector — walking at the same speed (a raw held diagonal
 * would otherwise move ~41% faster). `len` is the caller's precomputed vector length.
 * Takes loose x/y (not a point object) so the per-frame caller passes fields
 * directly — no object literal allocated in the scene's hot `update()` loop.
 * @param x - Wren's current X.
 * @param y - Wren's current Y.
 * @param dir - This frame's movement direction (pre-normalization).
 * @param len - The direction's magnitude (`Math.hypot(dir.dx, dir.dy)`), > 0.
 * @param delta - Milliseconds since the last frame.
 * @returns The stepped position (unclamped).
 */
export function stepWren(
  x: number,
  y: number,
  dir: FieldMoveDir,
  len: number,
  delta: number
): FieldPoint {
  const stepPx = (FieldLayout.moveSpeed * delta) / 1000;
  return {
    x: x + (dir.dx / len) * stepPx,
    y: y + (dir.dy / len) * stepPx,
  };
}

/**
 * Clamp a point to the walkable floor band — below the wall line, inside the edge
 * inset on every side — so Wren can never leave the room.
 * @param point - The (possibly out-of-bounds) position.
 * @returns The position clamped into the walkable band.
 */
export function clampWrenToFloor(point: FieldPoint): FieldPoint {
  const { edgeInset } = FieldLayout;
  return {
    x: clamp(point.x, edgeInset, GameView.width - edgeInset),
    y: clamp(
      point.y,
      FieldLayout.wallY + edgeInset,
      GameView.height - edgeInset
    ),
  };
}

/**
 * Clamp a signed scalar to the -1..1 range used as a fractional step component for
 * tap-to-move; preserves sub-unit magnitude so diagonal approach stays smooth while
 * keeping each axis within a unit step.
 * @param value - The raw axis component.
 * @returns The clamped component in [-1, 1].
 */
export function clampUnit(value: number): number {
  return clamp(value, -1, 1);
}

/**
 * Clamp a scalar to an inclusive range (the Phaser-free `Phaser.Math.Clamp`).
 * @param value - The value to clamp.
 * @param lo - The lower bound.
 * @param hi - The upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
