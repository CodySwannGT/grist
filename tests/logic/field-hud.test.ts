/**
 * Unit tests for the pure, Phaser-free field-HUD model (PD-3.3 / #107): the
 * mini-map model + open/close toggle, the context-prompt selector, and the
 * grist-readout formatter. These prove the HUD's shape is a total function that
 * unit-tests headless — no Phaser, no scene — so the Field scene can render the
 * context prompt, persistent grist readout, and summonable mini-map as a thin
 * adapter over this logic. Mirrors `field-input.test.ts` in spirit: assert the
 * pure model the scene consumes.
 */
import { describe, expect, it } from "vitest";

import { MarrowRoomIds } from "../../src/content/map";
import {
  advanceAfterBattle,
  beginDescent,
  startField,
  traverseToNext,
  type FieldState,
} from "../../src/logic/field";
import {
  MARROW_ROOM_ORDER,
  RoomVisitStates,
  contextPromptFor,
  gristReadoutLabel,
  miniMapModel,
  toggleMiniMap,
} from "../../src/logic/field/hud";

const SEED = 12345;

/**
 * A field state advanced to the given linear room (A→B→C) from a fresh descent.
 * Walks the real scene-machine sequence — begin (enter A, triggers) then, per
 * step, acknowledge the fired encounter and traverse to the next room — so the
 * mini-map model is asserted against states the engine actually produces.
 * @param room - The target room to advance the descent to.
 * @returns The field state with Wren in the target room.
 */
function fieldAtRoom(room: (typeof MarrowRoomIds)[keyof typeof MarrowRoomIds]) {
  let state: FieldState = beginDescent(SEED);
  while (state.currentRoom !== room) {
    const next = traverseToNext(advanceAfterBattle(state));
    // Guard against an infinite loop if traversal ever stops advancing.
    if (next.currentRoom === state.currentRoom) {
      break;
    }
    state = next;
  }
  return state;
}

describe("field HUD — mini-map model", () => {
  it("lists the three Marrow rooms in descent order A -> B -> C", () => {
    const model = miniMapModel(startField(SEED));
    expect(model.map(node => node.room)).toEqual([
      MarrowRoomIds.a,
      MarrowRoomIds.b,
      MarrowRoomIds.c,
    ]);
    expect(MARROW_ROOM_ORDER).toEqual([
      MarrowRoomIds.a,
      MarrowRoomIds.b,
      MarrowRoomIds.c,
    ]);
  });

  it("carries each room's authored display name", () => {
    const model = miniMapModel(startField(SEED));
    expect(model[0]?.name).toBe("Warren Street");
    expect(model[1]?.name).toBe("The Drip");
    expect(model[2]?.name).toBe("The Cage");
  });

  it("marks Room A current and the rest unvisited at the start", () => {
    const model = miniMapModel(startField(SEED));
    expect(model[0]?.state).toBe(RoomVisitStates.current);
    expect(model[1]?.state).toBe(RoomVisitStates.unvisited);
    expect(model[2]?.state).toBe(RoomVisitStates.unvisited);
  });

  it("marks earlier rooms visited and later rooms unvisited from Room B", () => {
    const model = miniMapModel(fieldAtRoom(MarrowRoomIds.b));
    expect(model[0]?.state).toBe(RoomVisitStates.visited);
    expect(model[1]?.state).toBe(RoomVisitStates.current);
    expect(model[2]?.state).toBe(RoomVisitStates.unvisited);
  });

  it("marks every earlier room visited in the final room", () => {
    const model = miniMapModel(fieldAtRoom(MarrowRoomIds.c));
    expect(model[0]?.state).toBe(RoomVisitStates.visited);
    expect(model[1]?.state).toBe(RoomVisitStates.visited);
    expect(model[2]?.state).toBe(RoomVisitStates.current);
  });

  it("always reports exactly one current node", () => {
    for (const room of MARROW_ROOM_ORDER) {
      const model = miniMapModel(fieldAtRoom(room));
      const current = model.filter(
        node => node.state === RoomVisitStates.current
      );
      expect(current).toHaveLength(1);
      expect(current[0]?.room).toBe(room);
    }
  });
});

describe("field HUD — mini-map toggle (summonable, not always-on)", () => {
  it("opens a closed mini-map", () => {
    expect(toggleMiniMap(false)).toBe(true);
  });

  it("dismisses an open mini-map", () => {
    expect(toggleMiniMap(true)).toBe(false);
  });

  it("returns to the original state after two toggles", () => {
    expect(toggleMiniMap(toggleMiniMap(false))).toBe(false);
    expect(toggleMiniMap(toggleMiniMap(true))).toBe(true);
  });
});

describe("field HUD — context prompt", () => {
  /** Room A's examinable lore prop id (shared across the prompt cases). */
  const WARREN_SIGN = "warren-sign";

  it("shows the examine prompt with the prop name when in range", () => {
    const prompt = contextPromptFor(MarrowRoomIds.a, WARREN_SIGN, true, false);
    expect(prompt).toBe('[E] examine Faded "Warren St." sign');
  });

  it("shows the rendering-house prop name in Room B", () => {
    const prompt = contextPromptFor(MarrowRoomIds.b, "render-vat", true, false);
    expect(prompt).toBe("[E] examine Rendering vat");
  });

  it("shows no prompt when Wren is out of range", () => {
    expect(
      contextPromptFor(MarrowRoomIds.a, WARREN_SIGN, false, false)
    ).toBeNull();
  });

  it("shows no prompt when the room has no examinable prop", () => {
    expect(contextPromptFor(MarrowRoomIds.c, null, true, false)).toBeNull();
  });

  it("suppresses the prompt while the lore banner is on screen (#234)", () => {
    // In range with the banner up, the prompt would sit in the banner's bottom
    // band and garble its text — so the model hides it until the banner clears.
    expect(
      contextPromptFor(MarrowRoomIds.a, WARREN_SIGN, true, true)
    ).toBeNull();
    // The rendering-house prop is gated the same way.
    expect(
      contextPromptFor(MarrowRoomIds.b, "render-vat", true, true)
    ).toBeNull();
  });

  it("falls back to the prop id when the prop is not in the room table", () => {
    expect(contextPromptFor(MarrowRoomIds.a, "ghost-prop", true, false)).toBe(
      "[E] examine ghost-prop"
    );
  });
});

describe("field HUD — grist readout", () => {
  it("formats the wallet balance as a persistent label", () => {
    expect(gristReadoutLabel(0)).toBe("Grist 0");
    expect(gristReadoutLabel(120)).toBe("Grist 120");
  });
});
