/**
 * Unit suite for the pure Field↔Battle scene-machine sequences added in #82:
 * {@link beginDescent} (start + enter Room A → first trigger), {@link pendingLaunch}
 * (the launch *decision* the Field adapter polls), {@link advanceAfterBattle}
 * (acknowledge the cleared room → back to `exploring`, Field visible), and
 * {@link traverseToNext} (walk to the next room → its trigger). These compose the
 * existing field reducer, so the whole A→B→C launch/return walk is asserted
 * headless with no Phaser.
 */
import { describe, expect, it } from "vitest";
import { EncounterIds } from "../../src/content/encounters";
import { MarrowRoomIds } from "../../src/content/map";
import {
  FieldPhases,
  advanceAfterBattle,
  beginDescent,
  pendingLaunch,
  traverseToNext,
} from "../../src/logic/field";

const SEED = 0x1234abcd;

describe("beginDescent", () => {
  it("starts in Room A with its encounter triggered and pending", () => {
    const state = beginDescent(SEED);
    expect(state.currentRoom).toBe(MarrowRoomIds.a);
    expect(state.phase).toBe(FieldPhases.triggered);
    expect(state.pendingEncounter).toBe(EncounterIds.warrenStreet);
  });
});

describe("pendingLaunch", () => {
  it("surfaces the pending encounter + a derived battle seed when triggered", () => {
    const state = beginDescent(SEED);
    const launch = pendingLaunch(state);
    expect(launch).not.toBeNull();
    expect(launch?.encounterId).toBe(EncounterIds.warrenStreet);
    expect(typeof launch?.seed).toBe("number");
    // The battle seed is a 32-bit unsigned value derived from the field RNG state.
    expect(launch?.seed).toBe(state.rngState >>> 0);
  });

  it("returns null once the room has been acknowledged (back to exploring)", () => {
    const acknowledged = advanceAfterBattle(beginDescent(SEED));
    expect(acknowledged.phase).toBe(FieldPhases.exploring);
    expect(pendingLaunch(acknowledged)).toBeNull();
  });
});

describe("advanceAfterBattle", () => {
  it("acknowledges the cleared room and returns to exploring (no fight pending)", () => {
    const after = advanceAfterBattle(beginDescent(SEED));
    expect(after.currentRoom).toBe(MarrowRoomIds.a);
    expect(after.phase).toBe(FieldPhases.exploring);
    expect(after.pendingEncounter).toBeNull();
    expect(after.rooms[MarrowRoomIds.a].trigger.fired).toBe(true);
  });
});

describe("traverseToNext", () => {
  it("walks A→B→C, firing each room's encounter in order after a clear", () => {
    // Room A cleared → traverse fires Room B's trigger.
    const b = traverseToNext(advanceAfterBattle(beginDescent(SEED)));
    expect(b.currentRoom).toBe(MarrowRoomIds.b);
    expect(b.phase).toBe(FieldPhases.triggered);
    expect(b.pendingEncounter).toBe(EncounterIds.theDrip);

    // Room B cleared → traverse fires Room C's (Ashling) trigger.
    const c = traverseToNext(advanceAfterBattle(b));
    expect(c.currentRoom).toBe(MarrowRoomIds.c);
    expect(c.phase).toBe(FieldPhases.triggered);
    expect(c.pendingEncounter).toBe(EncounterIds.theCage);
  });

  it("completes the descent once the final (Ashling) room is cleared", () => {
    const b = traverseToNext(advanceAfterBattle(beginDescent(SEED)));
    const c = traverseToNext(advanceAfterBattle(b));
    // Acknowledge the final room, then a traverse past Room C completes the slice.
    const done = traverseToNext(advanceAfterBattle(c));
    expect(done.phase).toBe(FieldPhases.complete);
    expect(done.pendingEncounter).toBeNull();
    expect(pendingLaunch(done)).toBeNull();
  });
});
