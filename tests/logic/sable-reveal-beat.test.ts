import { describe, expect, it } from "vitest";

import {
  CH1_OPENING_SCENE_ID,
  CH1_REVEAL_NODE_ID,
  CH1_SCRIPT,
  SABLE_REVEAL_BEAT_MS,
} from "../../src/content/scenes/ch1";
import {
  advanceDialogue,
  dialogueView,
  initialDialoguePresenter,
  type DialoguePresenterState,
  type SceneDef,
} from "../../src/logic/narrative";

/**
 * The "deliberate quiet beat" on the Sable reveal (PD-3.9 / #114). The reveal is a
 * narrative moment, so its beat is a serializable timing property on the reveal
 * node — a hold the presenter surfaces and the Dialogue adapter honors as a one-shot
 * pause. These assertions prove the beat is data (deterministic, save-round-trippable)
 * and that it lands exactly on the reveal, nowhere else, so the ambush handoff and
 * the `sable-revealed` flag are untouched (asserted by the existing ch1-content suite
 * and the ch1 e2e).
 */

const CH1_TABLE: Record<string, SceneDef> = { ...CH1_SCRIPT };

/**
 * The Ch.1 opening scene, resolved once (throws if the fixture is malformed).
 * @returns The Ch.1 opening {@link SceneDef}.
 */
function openingScene(): SceneDef {
  const scene = CH1_SCRIPT[CH1_OPENING_SCENE_ID];
  if (!scene) {
    throw new Error("Ch.1 opening scene is missing from the script table");
  }
  return scene;
}

/**
 * Walk the presenter to the node with the given id, or throw if unreachable.
 * @param nodeId - The dialogue node id to advance the presenter to.
 * @returns The presenter state parked at `nodeId`.
 */
function presenterAt(nodeId: string): DialoguePresenterState {
  let state = initialDialoguePresenter(openingScene());
  if (!state) {
    throw new Error("Ch.1 opening scene has no nodes");
  }
  for (let step = 0; step < 32; step++) {
    if (state.narrative.nodeId === nodeId) {
      return state;
    }
    state = advanceDialogue(state, CH1_TABLE);
  }
  throw new Error(`node ${nodeId} was not reached`);
}

describe("Sable-reveal quiet beat (#114)", () => {
  it("gives the reveal node a deliberate, non-trivial quiet beat", () => {
    // The beat is perceptible — a real hold, not a single frame.
    expect(SABLE_REVEAL_BEAT_MS).toBeGreaterThanOrEqual(400);
  });

  it("attaches the beat to the cargo-opens reveal node in the script", () => {
    const reveal = openingScene().nodes.find(
      node => node.id === CH1_REVEAL_NODE_ID
    );
    expect(reveal?.beatMs).toBe(SABLE_REVEAL_BEAT_MS);
  });

  it("surfaces the beat on the reveal node's view-model", () => {
    const view = dialogueView(presenterAt(CH1_REVEAL_NODE_ID), CH1_TABLE);
    expect(view.beatMs).toBe(SABLE_REVEAL_BEAT_MS);
    // The reveal line still names SABLE — the beat does not replace the reveal.
    expect(view.caption).toContain("SABLE");
  });

  it("does not put a quiet beat on ordinary lines", () => {
    // The opening "hook" line reads normally — no imposed hold.
    const hook = dialogueView(presenterAt("hook"), CH1_TABLE);
    expect(hook.beatMs).toBeUndefined();
  });

  it("keeps the beat serializable (a plain number that round-trips)", () => {
    const roundTripped = JSON.parse(JSON.stringify(openingScene())) as SceneDef;
    const reveal = roundTripped.nodes.find(
      node => node.id === CH1_REVEAL_NODE_ID
    );
    expect(reveal?.beatMs).toBe(SABLE_REVEAL_BEAT_MS);
  });
});
