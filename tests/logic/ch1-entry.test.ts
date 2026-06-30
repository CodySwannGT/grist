import { describe, expect, it } from "vitest";

import { EncounterIds } from "../../src/content";
import { CH1_AMBUSH_ENCOUNTER } from "../../src/content/scenes/ch1";
import { FieldPhases, pendingLaunch } from "../../src/logic/field";
import { ch1AmbushSession } from "../../src/scenes/field-launch";

/**
 * Ch.1 ambush field-entry (#105 AC2). The reveal→ambush handoff (the opening
 * dialogue ending hands straight to the tutorial ambush) is driven by a synthetic
 * field session that is already `triggered` on the Ch.1 tutorial-ambush encounter,
 * so the existing #82 `launchPendingBattle` path can launch it byte-identically —
 * without forking the field sim or touching `MARROW_MAP` / the Room-A binding.
 * `ch1AmbushSession` is pure (Phaser-free at type level), so it is asserted here
 * directly; the scene-level launch is exercised on the live canvas by the e2e.
 */
describe("Ch.1 ambush field-entry session (#105 AC2)", () => {
  it("is a triggered session pending exactly the Ch.1 tutorial ambush", () => {
    const session = ch1AmbushSession(12345);
    expect(session.phase).toBe(FieldPhases.triggered);
    expect(session.pendingEncounter).toBe(CH1_AMBUSH_ENCOUNTER);
    expect(session.pendingEncounter).toBe(EncounterIds.tutorialAmbush);
  });

  it("yields a pending launch the #82 launcher can hand to the Battle scene", () => {
    const launch = pendingLaunch(ch1AmbushSession(777));
    expect(launch).not.toBeNull();
    expect(launch?.encounterId).toBe(CH1_AMBUSH_ENCOUNTER);
    // The battle seed is derived from the session RNG (deterministic, no ambient read).
    expect(Number.isFinite(launch?.seed)).toBe(true);
  });

  it("is deterministic — same seed yields an identical session, and is JSON-round-trippable", () => {
    const a = ch1AmbushSession(42);
    const b = ch1AmbushSession(42);
    expect(a).toEqual(b);
    const roundTripped = JSON.parse(JSON.stringify(a)) as typeof a;
    expect(roundTripped).toEqual(a);
  });

  it("does not pre-fire Room A — the synthetic trigger is the ambush, not warren-street", () => {
    const session = ch1AmbushSession(9);
    // Room A's own trigger record is still unfired; the pending encounter is the
    // Ch.1 ambush we injected at the launch boundary, never the Room-A binding.
    expect(session.rooms["room-a"].trigger.fired).toBe(false);
    expect(session.pendingEncounter).not.toBe("warren-street");
  });
});
