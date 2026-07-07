/**
 * Unit tests for the Phaser-free core of the field semantic input layer: the
 * directional move-intent vocabulary and the pure `keyToFieldIntent` map. These
 * mirror `input.test.ts` (the battle key→intent map) and prove the field
 * keyboard scheme is a total function that unit-tests headless — no Phaser, no
 * scene. This is the "actions, not raw keys" contract for the Field scene: the
 * scene never reads `event.key`; it consumes the named intents this map yields.
 */
import { describe, expect, it } from "vitest";

import {
  FieldMoveDirections,
  keyToFieldIntent,
  type FieldIntent,
} from "../../src/services/field-input-map";

describe("field key -> intent map", () => {
  it("maps the four cardinal moves from WASD", () => {
    expect(keyToFieldIntent("KeyW")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.up,
    });
    expect(keyToFieldIntent("KeyS")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.down,
    });
    expect(keyToFieldIntent("KeyA")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.left,
    });
    expect(keyToFieldIntent("KeyD")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.right,
    });
  });

  it("maps the four cardinal moves from the arrow keys", () => {
    expect(keyToFieldIntent("ArrowUp")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.up,
    });
    expect(keyToFieldIntent("ArrowDown")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.down,
    });
    expect(keyToFieldIntent("ArrowLeft")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.left,
    });
    expect(keyToFieldIntent("ArrowRight")).toEqual({
      kind: "move",
      dir: FieldMoveDirections.right,
    });
  });

  it("maps confirm/examine to Enter/Space/E", () => {
    expect(keyToFieldIntent("Enter")).toEqual({ kind: "examine" });
    expect(keyToFieldIntent("Space")).toEqual({ kind: "examine" });
    expect(keyToFieldIntent("KeyE")).toEqual({ kind: "examine" });
  });

  it("maps the summonable mini-map toggle to M", () => {
    expect(keyToFieldIntent("KeyM")).toEqual({ kind: "toggle-map" });
  });

  it("maps the pause-menu opener to Escape (#233)", () => {
    // Esc is the universal pause/menu opener from the Field, the primary gameplay
    // surface — the Menu's own Esc closes back to where the player was.
    expect(keyToFieldIntent("Escape")).toEqual({ kind: "open-menu" });
  });

  it("maps the World Map travel front door to T (#261)", () => {
    // T is the first-class road onward out of the intro Field — the intro Field has
    // no in-scene action that advances the descent, so a discoverable travel key
    // keeps a new player from dead-ending.
    expect(keyToFieldIntent("KeyT")).toEqual({ kind: "open-world-map" });
  });

  it("leaves Tab unbound so it cannot blur the canvas", () => {
    // Tab is the browser's focus-navigation key; binding it without a capture
    // path would move focus off the canvas and stop later keyboard input.
    expect(keyToFieldIntent("Tab")).toBeNull();
  });

  it("returns null for unbound keys", () => {
    expect(keyToFieldIntent("KeyZ")).toBeNull();
    expect(keyToFieldIntent("F5")).toBeNull();
    expect(keyToFieldIntent("")).toBeNull();
  });

  it("exposes a unit vector per cardinal direction", () => {
    // Each direction is a screen-space unit step the scene multiplies by the
    // frame-delta movement speed. y grows downward (screen coords).
    const vectors = [
      FieldMoveDirections.up,
      FieldMoveDirections.down,
      FieldMoveDirections.left,
      FieldMoveDirections.right,
    ].map(dir => `${dir.dx},${dir.dy}`);
    expect(new Set(vectors).size).toBe(4);
    expect(FieldMoveDirections.up).toEqual({ dx: 0, dy: -1 });
    expect(FieldMoveDirections.down).toEqual({ dx: 0, dy: 1 });
    expect(FieldMoveDirections.left).toEqual({ dx: -1, dy: 0 });
    expect(FieldMoveDirections.right).toEqual({ dx: 1, dy: 0 });
  });

  it("narrows a move intent to its direction vector", () => {
    const intent: FieldIntent = {
      kind: "move",
      dir: FieldMoveDirections.right,
    };
    expect(intent.kind === "move" ? intent.dir.dx : 0).toBe(1);
  });
});
