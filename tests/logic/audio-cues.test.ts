/**
 * Unit coverage for the pure temp-audio cue vocabulary + edge predicates (#115,
 * PRD #42 Scope-IN "temp-but-intentional audio", FR11 / the redundancy half of
 * AC12). This is the Phaser-free half of the Validation Journey: it proves the
 * cue set, its redundant text/icon captions, and the strict edge rules that decide
 * when a stinger fires — the same predicates the Battle scene and battler stage
 * consume — without touching Phaser. It imports ONLY from `../../src/logic/...`.
 *
 * The assertions track the issue's acceptance criteria:
 * - Every cue carries a non-empty text AND icon caption (no cue is color/audio-only).
 * - `spentGrist` fires only on a strict DECREASE (a loot credit never mis-fires it).
 * - `hasRendering` / `justRendered` are edge-triggered: the stinger plays exactly
 *   once on the false→true frame and re-arms after the status lapses.
 */
import { describe, expect, it } from "vitest";

import {
  AudioCues,
  CUE_CAPTIONS,
  hasRendering,
  justRendered,
  spentGrist,
  type AudioCueId,
} from "../../src/logic/audio";
import { Statuses, type CombatantStatus } from "../../src/logic/combat/types";

/** A rendering status fixture (the DoT the stinger keys off). */
const RENDERING: CombatantStatus = {
  id: Statuses.rendering,
  turns: 3,
  power: 4,
};
/** A non-rendering status fixture (a rooted lock — must never trigger the cue). */
const ROOTED: CombatantStatus = { id: Statuses.rooted, turns: 2 };

describe("temp-audio cues — vocabulary + captions (#115)", () => {
  it("exposes the four cues the demo hooks fire", () => {
    expect(Object.values(AudioCues)).toEqual([
      "choir",
      "grist-spend",
      "break",
      "rendering",
    ]);
  });

  it("gives every cue a non-color/non-audio text AND icon caption (FR11/AC12)", () => {
    for (const cue of Object.values(AudioCues)) {
      const caption = CUE_CAPTIONS[cue as AudioCueId];
      expect(caption.text.length).toBeGreaterThan(0);
      expect(caption.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("grist-spend edge — spentGrist (#115)", () => {
  it("fires on a strict decrease (a Bind / bench sink)", () => {
    expect(spentGrist(30, 5)).toBe(true);
  });

  it("never fires when grist is unchanged or credited (loot)", () => {
    expect(spentGrist(10, 10)).toBe(false);
    expect(spentGrist(10, 25)).toBe(false);
  });
});

describe("rendering edge — hasRendering / justRendered (#115)", () => {
  it("detects the Rendering DoT amid other statuses", () => {
    expect(hasRendering([ROOTED, RENDERING])).toBe(true);
    expect(hasRendering([ROOTED])).toBe(false);
    expect(hasRendering([])).toBe(false);
  });

  it("fires once on the false→true frame only", () => {
    // Not present → present: the stinger frame.
    expect(justRendered(false, [RENDERING])).toBe(true);
    // Already present last frame: no re-fire while it persists.
    expect(justRendered(true, [RENDERING])).toBe(false);
    // Present last frame, now lapsed: silent (and re-armed for next application).
    expect(justRendered(true, [])).toBe(false);
    // Absent both frames: silent.
    expect(justRendered(false, [ROOTED])).toBe(false);
  });
});
