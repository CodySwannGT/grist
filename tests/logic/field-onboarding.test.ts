/**
 * Unit coverage for the pure **Field travel onboarding** flag
 * (`src/logic/field-onboarding`, #261) — the once-per-save signpost ledger riding
 * `scene.flags`. ZERO Phaser, exercised headless. Mirrors
 * `world-map-onboarding.test.ts`.
 */
import { describe, expect, it } from "vitest";

import { freshSave } from "../../src/logic/save";
import {
  FIELD_TRAVEL_ONBOARDING_HINT,
  hasSeenFieldTravelOnboarding,
  markFieldTravelOnboardingSeen,
} from "../../src/logic/field-onboarding";

describe("field travel onboarding flag", () => {
  it("is unseen on a fresh save and seen after marking", () => {
    const save = freshSave();
    expect(hasSeenFieldTravelOnboarding(save)).toBe(false);
    const marked = markFieldTravelOnboardingSeen(save);
    expect(hasSeenFieldTravelOnboarding(marked)).toBe(true);
  });

  it("preserves the existing scene cursor + other flags", () => {
    const save = {
      ...freshSave(),
      scene: {
        sceneId: "dialogue",
        nodeId: "n5",
        flags: { "reunion:cal": "completed" },
      },
    };
    const marked = markFieldTravelOnboardingSeen(save);
    expect(marked.scene?.sceneId).toBe("dialogue");
    expect(marked.scene?.nodeId).toBe("n5");
    expect(marked.scene?.flags["reunion:cal"]).toBe("completed");
  });

  it("points the player at the World Map travel affordance", () => {
    // The copy must name the real road onward (the world map) and the key that
    // opens it, so a dead-ended player is never left guessing (#261).
    expect(FIELD_TRAVEL_ONBOARDING_HINT).toContain("world map");
    expect(FIELD_TRAVEL_ONBOARDING_HINT).toContain("[T]");
  });
});
