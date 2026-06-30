/**
 * "What the mill took" side-story CONTENT (#111 / PRD #42 FR5/AC7). Asserts the
 * authored scene data over the Phase-2 narrative engine: the discoverable beat's
 * dialogue graph (find the mill → read its ledger → recognize Lira's mark) walks into
 * a render-or-not fork whose two choices cross to the rendered / spared terminal
 * scenes. Pure data + the pure narrative presenter — zero Phaser. The sim is NOT
 * forked: the scene consumes #91's {@link SceneDef} model verbatim and the persisted
 * consequence lives in `logic/side-story/mill` (the persisted `MoralLedger`), not
 * here — this suite only proves the beat is reachable and its fork renders both
 * branches.
 */
import { describe, expect, it } from "vitest";

import {
  MILL_CHOICE_NODE_ID,
  MILL_RENDERED_SCENE_ID,
  MILL_RENDER_CHOICE_ID,
  MILL_SPARED_SCENE_ID,
  MILL_SPARE_CHOICE_ID,
  SIDE_MILL_SCENE_ID,
  SIDE_MILL_SCRIPT,
} from "../../src/content/scenes/side-mill";
import {
  initialDialoguePresenter,
  presentDialogue,
  dialogueView,
  type DialoguePresenterState,
} from "../../src/logic/narrative";

/**
 * Advance the presenter until it reaches a fork (or a guard trips).
 * @param start - The opened presenter state to walk from.
 * @returns The presenter state at the first fork node reached.
 */
function advanceToFork(start: DialoguePresenterState): DialoguePresenterState {
  let state = start;
  for (let guard = 0; guard < 50; guard += 1) {
    if (dialogueView(state, SIDE_MILL_SCRIPT).branching) {
      return state;
    }
    const next = presentDialogue(state, { kind: "advance" }, SIDE_MILL_SCRIPT);
    if (next === state) {
      return state;
    }
    state = next;
  }
  return state;
}

describe("mill side-story scene (#111 reachability)", () => {
  it("the entry scene speaks as Wren and walks multiple discovery beats", () => {
    const entry = SIDE_MILL_SCRIPT[SIDE_MILL_SCENE_ID];
    expect(entry).toBeDefined();
    expect(entry?.id).toBe(SIDE_MILL_SCENE_ID);
    // A real authored graph (the discovery walk), not a single-node fixture.
    expect(entry?.nodes.length ?? 0).toBeGreaterThan(1);
    expect(entry?.nodes.every(node => node.speaker === "wren")).toBe(true);
  });

  it("names Lira and the mill (the side-story's subject)", () => {
    const captions = Object.values(SIDE_MILL_SCRIPT)
      .flatMap(scene => scene.nodes)
      .map(node => node.text)
      .join("\n");
    expect(captions).toMatch(/lira/i);
    expect(captions).toMatch(/mill/i);
  });

  it("advancing the discovery walk reaches the render-or-not fork with both choices", () => {
    const opened = initialDialoguePresenter(
      SIDE_MILL_SCRIPT[SIDE_MILL_SCENE_ID]!
    );
    expect(opened).not.toBeNull();
    const atFork = advanceToFork(opened!);
    const view = dialogueView(atFork, SIDE_MILL_SCRIPT);
    expect(view.branching).toBe(true);
    expect(atFork.narrative.nodeId).toBe(MILL_CHOICE_NODE_ID);
    const ids = view.choices
      .map(choice => choice.id)
      .sort((a, b) => a.localeCompare(b));
    expect(ids).toEqual(
      [MILL_RENDER_CHOICE_ID, MILL_SPARE_CHOICE_ID].sort((a, b) =>
        a.localeCompare(b)
      )
    );
  });

  it("the render choice crosses to the rendered scene; spare crosses to the spared scene", () => {
    const opened = initialDialoguePresenter(
      SIDE_MILL_SCRIPT[SIDE_MILL_SCENE_ID]!
    )!;
    const atFork = advanceToFork(opened);

    const rendered = presentDialogue(
      atFork,
      { kind: "branch", choiceId: MILL_RENDER_CHOICE_ID },
      SIDE_MILL_SCRIPT
    );
    expect(rendered.narrative.sceneId).toBe(MILL_RENDERED_SCENE_ID);
    expect(dialogueView(rendered, SIDE_MILL_SCRIPT).done).toBe(true);

    const spared = presentDialogue(
      atFork,
      { kind: "branch", choiceId: MILL_SPARE_CHOICE_ID },
      SIDE_MILL_SCRIPT
    );
    expect(spared.narrative.sceneId).toBe(MILL_SPARED_SCENE_ID);
    // The two branches reach distinct terminal scenes (the fork is real).
    expect(spared.narrative.sceneId).not.toBe(rendered.narrative.sceneId);
  });

  it("the script round-trips through JSON (SaveService / content-table safe)", () => {
    expect(JSON.parse(JSON.stringify(SIDE_MILL_SCRIPT))).toEqual(
      SIDE_MILL_SCRIPT
    );
  });
});
