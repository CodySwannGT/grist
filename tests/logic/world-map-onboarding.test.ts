/**
 * Unit coverage for the pure **World Map first-open onboarding** flag
 * (`src/logic/world-map-onboarding`, #241) — the once-per-save hint ledger riding
 * `scene.flags`. ZERO Phaser, exercised headless.
 */
import { describe, expect, it } from "vitest";

import { freshSave } from "../../src/logic/save";
import {
  hasSeenWorldMapOnboarding,
  markWorldMapOnboardingSeen,
} from "../../src/logic/world-map-onboarding";

describe("world-map onboarding flag", () => {
  it("is unseen on a fresh save and seen after marking", () => {
    const save = freshSave();
    expect(hasSeenWorldMapOnboarding(save)).toBe(false);
    const marked = markWorldMapOnboardingSeen(save);
    expect(hasSeenWorldMapOnboarding(marked)).toBe(true);
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
    const marked = markWorldMapOnboardingSeen(save);
    expect(marked.scene?.sceneId).toBe("dialogue");
    expect(marked.scene?.nodeId).toBe("n5");
    expect(marked.scene?.flags["reunion:cal"]).toBe("completed");
  });
});
