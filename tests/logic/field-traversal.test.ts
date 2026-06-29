/**
 * Traversal rules, acknowledge lifecycle, and seeded-RNG determinism for the
 * field encounter-trigger + traversal logic (#80). Companion to
 * `field-logic.test.ts` which covers the AC scenarios directly.
 */
import { describe, expect, it } from "vitest";

import { EncounterIds, MarrowRoomIds } from "../../src/content";
import {
  FieldActionKinds,
  FieldPhases,
  canTraverse,
  encounterForRoom,
  startField,
  stepField,
  type FieldState,
} from "../../src/logic/field";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Canonical fixed seed used across all determinism assertions. */
const FIXED_SEED = 0x1234abcd;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a fresh field session under the canonical fixed seed.
 * @param seed - Optional override seed (defaults to {@link FIXED_SEED}).
 * @returns The initial field state.
 */
function newField(seed = FIXED_SEED): FieldState {
  return startField(seed);
}

/**
 * Enter Room A, acknowledge the trigger, traverse to Room B, acknowledge,
 * then traverse to Room C. Returns state with Room C's encounter pending.
 * @param seed - Optional override seed (defaults to {@link FIXED_SEED}).
 * @returns The field state with Room C's encounter pending.
 */
function enterRoomC(seed = FIXED_SEED): FieldState {
  let state = newField(seed);
  state = stepField(state, {
    kind: FieldActionKinds.enter,
    roomId: MarrowRoomIds.a,
  });
  state = stepField(state, { kind: FieldActionKinds.acknowledge });
  state = stepField(state, { kind: FieldActionKinds.traverse });
  state = stepField(state, { kind: FieldActionKinds.acknowledge });
  state = stepField(state, { kind: FieldActionKinds.traverse });
  return state;
}

// ---------------------------------------------------------------------------
// Traversal rules
// ---------------------------------------------------------------------------

describe("field-logic: traversal rules (A→B→C)", () => {
  it("canTraverse is false at session start (trigger not fired)", () => {
    expect(canTraverse(startField(FIXED_SEED))).toBe(false);
  });

  it("canTraverse is false while a trigger is pending acknowledgment", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.phase).toBe(FieldPhases.triggered);
    expect(canTraverse(state)).toBe(false);
  });

  it("canTraverse is true after Room A trigger is acknowledged", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(canTraverse(state)).toBe(true);
  });

  it("traverse from A moves to Room B", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, { kind: FieldActionKinds.traverse });
    expect(state.currentRoom).toBe(MarrowRoomIds.b);
  });

  it("traverse from B moves to Room C", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, { kind: FieldActionKinds.traverse });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, { kind: FieldActionKinds.traverse });
    expect(state.currentRoom).toBe(MarrowRoomIds.c);
  });

  it("canTraverse is false in Room C once all triggers are acknowledged", () => {
    let state = enterRoomC();
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(state.phase).toBe(FieldPhases.complete);
    expect(canTraverse(state)).toBe(false);
  });

  it("traverse is blocked while a trigger is pending (returns same state ref)", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.pendingEncounter).not.toBeNull();
    const before = state;
    state = stepField(state, { kind: FieldActionKinds.traverse });
    expect(state).toBe(before);
  });

  it("enter is blocked while a trigger is pending (returns same state ref)", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    const pending = state;
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.b,
    });
    expect(state).toBe(pending);
  });
});

// ---------------------------------------------------------------------------
// Acknowledge lifecycle
// ---------------------------------------------------------------------------

describe("field-logic: acknowledge lifecycle", () => {
  it("acknowledge with no pending encounter is a no-op (returns same state ref)", () => {
    const state = startField(FIXED_SEED);
    expect(stepField(state, { kind: FieldActionKinds.acknowledge })).toBe(
      state
    );
  });

  it("after acknowledge, the room trigger is marked fired with its encounter id", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(state.rooms[MarrowRoomIds.a].trigger.fired).toBe(true);
    expect(state.rooms[MarrowRoomIds.a].trigger.encounterId).toBe(
      EncounterIds.warrenStreet
    );
  });

  it("encounterForRoom returns null after the trigger has been fired + acknowledged", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(encounterForRoom(state, MarrowRoomIds.a)).toBeNull();
  });

  it("re-entering an already-triggered room does not re-fire the trigger", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.phase).toBe(FieldPhases.exploring);
    expect(state.pendingEncounter).toBeNull();
  });

  it("session moves to complete after all three triggers are acknowledged", () => {
    let state = enterRoomC();
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(state.phase).toBe(FieldPhases.complete);
  });
});

// ---------------------------------------------------------------------------
// Seeded RNG determinism (no Math.random)
// ---------------------------------------------------------------------------

describe("field-logic: seeded RNG determinism (no Math.random)", () => {
  it("rngState after identical action sequences is equal for the same seed", () => {
    const run = (seed: number): number => {
      let state = startField(seed);
      state = stepField(state, {
        kind: FieldActionKinds.enter,
        roomId: MarrowRoomIds.a,
      });
      state = stepField(state, { kind: FieldActionKinds.acknowledge });
      state = stepField(state, { kind: FieldActionKinds.traverse });
      state = stepField(state, { kind: FieldActionKinds.acknowledge });
      state = stepField(state, { kind: FieldActionKinds.traverse });
      return state.rngState;
    };
    expect(run(FIXED_SEED)).toBe(run(FIXED_SEED));
  });

  it("rngState differs between different seeds", () => {
    const run = (seed: number): number => {
      let state = startField(seed);
      state = stepField(state, {
        kind: FieldActionKinds.enter,
        roomId: MarrowRoomIds.a,
      });
      return state.rngState;
    };
    expect(run(0x1234abcd)).not.toBe(run(0x0badf00d));
  });

  it("guard against 0-test pass: reducer is actually exercised", () => {
    let state = startField(FIXED_SEED);
    const initial = state.rngState;
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.rngState).not.toBe(initial);
    expect(state.pendingEncounter).not.toBeNull();
  });
});
