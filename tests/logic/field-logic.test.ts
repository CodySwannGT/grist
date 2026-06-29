import { describe, expect, it } from "vitest";

import { EncounterIds, EnemyIds, MarrowRoomIds } from "../../src/content";
import {
  FieldActionKinds,
  FieldPhases,
  encounterForRoom,
  loreForProp,
  startField,
  stepField,
  type FieldState,
} from "../../src/logic/field";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Canonical fixed seed used across all determinism assertions. */
const FIXED_SEED = 0x1234abcd;

/** The examinable rendering-notice prop in Room A. */
const WARREN_SIGN = "warren-sign";

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
 * then traverse to Room C — so Room C can trigger. Returns state just after
 * entering Room C (trigger pending, not yet acknowledged).
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
// Scenario: Encounter triggers fire deterministically (#80 AC 1)
// ---------------------------------------------------------------------------

describe("field-logic: encounter triggers fire deterministically (#80 AC 1)", () => {
  it("Room A triggers the warren-street encounter (scrapper) on first enter", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.phase).toBe(FieldPhases.triggered);
    expect(state.pendingEncounter).toBe(EncounterIds.warrenStreet);
  });

  it("Room B triggers the-drip encounter (scrapper + Vesper) after Room A is cleared", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, { kind: FieldActionKinds.traverse });
    expect(state.phase).toBe(FieldPhases.triggered);
    expect(state.pendingEncounter).toBe(EncounterIds.theDrip);
  });

  it("Room C triggers the-cage encounter (the Ashling) after Rooms A and B are cleared", () => {
    const state = enterRoomC();
    expect(state.phase).toBe(FieldPhases.triggered);
    expect(state.pendingEncounter).toBe(EncounterIds.theCage);
  });

  it("the warren-street encounter contains exactly the marrow-scrapper", () => {
    const encounter = encounterForRoom(startField(FIXED_SEED), MarrowRoomIds.a);
    expect(encounter).not.toBeNull();
    expect(encounter!.enemies).toEqual([EnemyIds.marrowScrapper]);
  });

  it("the-drip encounter is exactly the marrow-scrapper + render-construct (Vesper)", () => {
    const encounter = encounterForRoom(startField(FIXED_SEED), MarrowRoomIds.b);
    expect(encounter).not.toBeNull();
    // Lock the full composition, not just membership: the AC calls for
    // scrapper + Vesper specifically — an extra enemy must fail this.
    expect(encounter!.enemies).toEqual([
      EnemyIds.marrowScrapper,
      EnemyIds.renderConstruct,
    ]);
  });

  it("the-cage encounter contains only the Ashling", () => {
    const encounter = encounterForRoom(startField(FIXED_SEED), MarrowRoomIds.c);
    expect(encounter).not.toBeNull();
    expect(encounter!.enemies).toEqual([EnemyIds.theAshling]);
  });

  it("same seed + same movement inputs produce the identical trigger sequence", () => {
    const runSequence = (): string[] => {
      let state = startField(FIXED_SEED);
      const events: string[] = [];
      state = stepField(state, {
        kind: FieldActionKinds.enter,
        roomId: MarrowRoomIds.a,
      });
      events.push(state.pendingEncounter ?? "none");
      state = stepField(state, { kind: FieldActionKinds.acknowledge });
      state = stepField(state, { kind: FieldActionKinds.traverse });
      events.push(state.pendingEncounter ?? "none");
      state = stepField(state, { kind: FieldActionKinds.acknowledge });
      state = stepField(state, { kind: FieldActionKinds.traverse });
      events.push(state.pendingEncounter ?? "none");
      return events;
    };
    expect(runSequence()).toEqual(runSequence());
  });

  it("triggers are content-driven: different seeds produce the same encounter order", () => {
    const runWith = (seed: number): string[] => {
      let state = startField(seed);
      const encounters: string[] = [];
      state = stepField(state, {
        kind: FieldActionKinds.enter,
        roomId: MarrowRoomIds.a,
      });
      encounters.push(state.pendingEncounter ?? "none");
      state = stepField(state, { kind: FieldActionKinds.acknowledge });
      state = stepField(state, { kind: FieldActionKinds.traverse });
      encounters.push(state.pendingEncounter ?? "none");
      state = stepField(state, { kind: FieldActionKinds.acknowledge });
      state = stepField(state, { kind: FieldActionKinds.traverse });
      encounters.push(state.pendingEncounter ?? "none");
      return encounters;
    };
    expect(runWith(0x1234abcd)).toEqual(runWith(0x0badf00d));
  });

  it("rngState advances with each room entry (seeded sequence is consumed)", () => {
    let state = newField();
    const initialRng = state.rngState;
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.rngState).not.toBe(initialRng);
  });
});

// ---------------------------------------------------------------------------
// Scenario: Examinable props — the rendering notice in Room A (#80 AC 2)
// ---------------------------------------------------------------------------

describe("field-logic: examinable props (#80 AC 2)", () => {
  it("examining the warren-sign exposes a non-empty lore beat string", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: WARREN_SIGN,
    });
    const lore = loreForProp(state, WARREN_SIGN);
    expect(lore).not.toBeNull();
    expect(typeof lore).toBe("string");
    expect(lore!.length).toBeGreaterThan(0);
  });

  it("examining the warren-sign marks it as examined", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: WARREN_SIGN,
    });
    expect(state.rooms[MarrowRoomIds.a].props[WARREN_SIGN]?.examined).toBe(
      true
    );
  });

  it("examining a non-lore prop (warren-rubble) is a no-op", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    const before = state;
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: "warren-rubble",
    });
    expect(loreForProp(state, "warren-rubble")).toBeNull();
    expect(state.rooms[MarrowRoomIds.a].props["warren-rubble"]?.examined).toBe(
      false
    );
    expect(state.rooms).toBe(before.rooms);
  });

  it("examining the same prop twice is idempotent (second call is a no-op)", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: WARREN_SIGN,
    });
    const afterFirst = state;
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: WARREN_SIGN,
    });
    expect(state.rooms).toBe(afterFirst.rooms);
  });

  it("loreForProp returns null before the prop is examined", () => {
    let state = newField();
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(loreForProp(state, WARREN_SIGN)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario: Architecture — pure reducer, zero Phaser imports (#80 AC 3)
// ---------------------------------------------------------------------------

describe("field-logic: architecture constraints (#80 AC 3)", () => {
  it("startField is a pure function: same seed → same initial shape", () => {
    const a = startField(42);
    const b = startField(42);
    expect(a.seed).toBe(b.seed);
    expect(a.rngState).toBe(b.rngState);
    expect(a.currentRoom).toBe(b.currentRoom);
    expect(a.phase).toBe(b.phase);
    expect(a.pendingEncounter).toBe(b.pendingEncounter);
  });

  it("stepField never mutates the input state", () => {
    const state = startField(42);
    const originalRoom = state.currentRoom;
    const originalPhase = state.phase;
    stepField(state, { kind: FieldActionKinds.enter, roomId: MarrowRoomIds.a });
    expect(state.currentRoom).toBe(originalRoom);
    expect(state.phase).toBe(originalPhase);
  });

  it("a complete session rejects further actions (terminal state)", () => {
    let state = enterRoomC();
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(state.phase).toBe(FieldPhases.complete);
    const completedState = state;
    const after = stepField(completedState, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(after).toBe(completedState);
  });
});

// ---------------------------------------------------------------------------
// Progression integrity — `enter` cannot skip rooms (A→B→C is enforced)
// ---------------------------------------------------------------------------

describe("field-logic: progression integrity", () => {
  it("enter cannot jump from fresh Room A straight to Room B (no skip)", () => {
    const state = startField(FIXED_SEED);
    const after = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.b,
    });
    // Cross-room enter is rejected — state is unchanged and Room B never fires.
    expect(after).toBe(state);
    expect(after.currentRoom).toBe(MarrowRoomIds.a);
    expect(after.pendingEncounter).toBeNull();
    expect(after.rooms[MarrowRoomIds.b].trigger.encounterId).toBeNull();
  });

  it("enter cannot jump from fresh Room A straight to Room C (the Ashling cannot be reached early)", () => {
    const state = startField(FIXED_SEED);
    const after = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.c,
    });
    expect(after).toBe(state);
    expect(after.rooms[MarrowRoomIds.c].trigger.encounterId).toBeNull();
  });

  it("enter fires only the current room's trigger", () => {
    let state = startField(FIXED_SEED);
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.pendingEncounter).toBe(EncounterIds.warrenStreet);
    expect(state.currentRoom).toBe(MarrowRoomIds.a);
  });
});

// ---------------------------------------------------------------------------
// encounterForRoom availability semantics (pending encounter is "in flight")
// ---------------------------------------------------------------------------

describe("field-logic: encounterForRoom availability", () => {
  it("returns null for the current room while its encounter is pending acknowledgment", () => {
    let state = startField(FIXED_SEED);
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    // Entered but not yet acknowledged: the encounter is in flight, not available.
    expect(state.phase).toBe(FieldPhases.triggered);
    expect(encounterForRoom(state, MarrowRoomIds.a)).toBeNull();
  });

  it("still reports a downstream room's encounter as available while another is in flight", () => {
    let state = startField(FIXED_SEED);
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    // Room A is pending, but Room C's encounter is still unfired/available.
    const cage = encounterForRoom(state, MarrowRoomIds.c);
    expect(cage).not.toBeNull();
    expect(cage!.enemies).toEqual([EnemyIds.theAshling]);
  });
});
