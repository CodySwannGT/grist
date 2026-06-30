/**
 * Rendering-house lore prop suite for #106 ("3+ connected Marrow spaces with
 * environmental-lore props"). The Phase-2 base (#71/#80) shipped a single lore
 * prop — the Room-A `warren-sign` rendering notice. This sub-task adds the
 * **rendering-house** lore prop in the rendering-house space (Room B, "The
 * Drip", whose encounter is the render-construct) carrying environmental lore
 * about **what the city eats** — sourced from `wiki/narrative/world.md`
 * ("the Houses render people ... into black grist; the Marrow runs on the
 * dead"). These assertions lock the AC: examining a rendering-house prop
 * surfaces that lore, the per-room examinable-prop selector resolves it, and the
 * new prop obeys the same once-only/idempotent/deterministic contract the
 * existing lore prop does — without perturbing the seeded encounter sequence.
 * @module tests/logic/field-rendering-house
 */
import { describe, expect, it } from "vitest";

import { MARROW_MAP, MarrowRoomIds } from "../../src/content";
import {
  FieldActionKinds,
  examinablePropForRoom,
  loreForProp,
  startField,
  stepField,
  type FieldState,
} from "../../src/logic/field";

/** Canonical fixed seed used across the determinism assertions. */
const FIXED_SEED = 0x1234abcd;

/** The examinable rendering-notice prop in the runner-warrens (Room A). */
const WARREN_SIGN = "warren-sign";

/** The examinable rendering-house prop in the rendering-house space (Room B). */
const RENDER_VAT = "render-vat";

/**
 * Walk a fresh session into Room B (the rendering-house space): enter Room A,
 * acknowledge its trigger, then traverse to Room B and acknowledge its trigger —
 * leaving the player exploring in Room B with no fight pending.
 * @param seed - Optional override seed (defaults to {@link FIXED_SEED}).
 * @returns The field state exploring in Room B.
 */
function enterRoomBCleared(seed = FIXED_SEED): FieldState {
  let state = startField(seed);
  state = stepField(state, {
    kind: FieldActionKinds.enter,
    roomId: MarrowRoomIds.a,
  });
  state = stepField(state, { kind: FieldActionKinds.acknowledge });
  state = stepField(state, { kind: FieldActionKinds.traverse });
  state = stepField(state, { kind: FieldActionKinds.acknowledge });
  return state;
}

// ---------------------------------------------------------------------------
// Scenario: the rendering-house space carries an examinable lore prop (#106 AC2)
// ---------------------------------------------------------------------------

describe("field-logic: rendering-house lore prop (#106 AC2)", () => {
  it("Room B (the rendering-house space) defines an examinable render-vat prop", () => {
    const propIds = MARROW_MAP[MarrowRoomIds.b].props.map(prop => prop.id);
    expect(propIds).toContain(RENDER_VAT);
  });

  it("examining the render-vat in Room B surfaces lore about what the city eats", () => {
    let state = enterRoomBCleared();
    expect(state.currentRoom).toBe(MarrowRoomIds.b);

    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: RENDER_VAT,
    });
    const lore = loreForProp(state, RENDER_VAT);
    expect(lore).not.toBeNull();
    expect(typeof lore).toBe("string");
    // "What the city eats": the Marrow runs on rendered people / black grist.
    // Source: wiki/narrative/world.md §"Grist (what the world runs on)".
    expect(lore!.toLowerCase()).toContain("grist");
    expect(lore!).toMatch(/render|dead|people|black grist/i);
  });

  it("examining the render-vat marks it examined (once-only flip)", () => {
    let state = enterRoomBCleared();
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: RENDER_VAT,
    });
    expect(state.rooms[MarrowRoomIds.b].props[RENDER_VAT]?.examined).toBe(true);
  });

  it("examining the render-vat twice is idempotent (second call is a no-op)", () => {
    let state = enterRoomBCleared();
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: RENDER_VAT,
    });
    const afterFirst = state;
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: RENDER_VAT,
    });
    expect(state.rooms).toBe(afterFirst.rooms);
  });

  it("loreForProp returns null for the render-vat before it is examined", () => {
    const state = enterRoomBCleared();
    expect(loreForProp(state, RENDER_VAT)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario: per-room examinable-prop selector resolves each room's lore prop
// ---------------------------------------------------------------------------

describe("field-logic: examinablePropForRoom selector (#106)", () => {
  it("resolves the warren-sign as the runner-warrens (Room A) examinable prop", () => {
    expect(examinablePropForRoom(MarrowRoomIds.a)).toBe(WARREN_SIGN);
  });

  it("resolves the render-vat as the rendering-house (Room B) examinable prop", () => {
    expect(examinablePropForRoom(MarrowRoomIds.b)).toBe(RENDER_VAT);
  });

  it("returns null for the descent (Room C), which has no authored lore prop", () => {
    expect(examinablePropForRoom(MarrowRoomIds.c)).toBeNull();
  });

  it("only returns prop ids the room actually defines", () => {
    const propA = examinablePropForRoom(MarrowRoomIds.a);
    const propB = examinablePropForRoom(MarrowRoomIds.b);
    expect(MARROW_MAP[MarrowRoomIds.a].props.map(p => p.id)).toContain(propA);
    expect(MARROW_MAP[MarrowRoomIds.b].props.map(p => p.id)).toContain(propB);
  });
});

// ---------------------------------------------------------------------------
// Scenario: the new lore prop does not perturb the seeded encounter sequence
// ---------------------------------------------------------------------------

describe("field-logic: rendering-house prop preserves determinism (#106)", () => {
  it("examining the render-vat does not advance the seeded RNG", () => {
    let state = enterRoomBCleared();
    const rngBefore = state.rngState;
    state = stepField(state, {
      kind: FieldActionKinds.examine,
      propId: RENDER_VAT,
    });
    expect(state.rngState).toBe(rngBefore);
  });

  it("the encounter sequence is unchanged whether or not the prop is examined", () => {
    const walkAndCollect = (examine: boolean): readonly (string | null)[] => {
      let state = startField(FIXED_SEED);
      const seq: (string | null)[] = [];
      state = stepField(state, {
        kind: FieldActionKinds.enter,
        roomId: MarrowRoomIds.a,
      });
      seq.push(state.pendingEncounter);
      state = stepField(state, { kind: FieldActionKinds.acknowledge });
      state = stepField(state, { kind: FieldActionKinds.traverse });
      seq.push(state.pendingEncounter);
      if (examine) {
        state = stepField(state, {
          kind: FieldActionKinds.acknowledge,
        });
        state = stepField(state, {
          kind: FieldActionKinds.examine,
          propId: RENDER_VAT,
        });
        state = stepField(state, { kind: FieldActionKinds.traverse });
        seq.push(state.pendingEncounter);
      }
      return seq;
    };
    // The first two triggers are identical regardless of the Room-B examine.
    const withoutExamine = walkAndCollect(false);
    const withExamine = walkAndCollect(true).slice(0, 2);
    expect(withExamine).toEqual(withoutExamine);
  });
});
