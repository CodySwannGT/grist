/**
 * The finale set-piece CONTENT + script builder (#244, composing #142). Asserts the
 * authored finale data over the pure narrative presenter: {@link buildFinaleScript}
 * assembles the confrontation walk into an ending fork whose choices are exactly the
 * reachable endings (so the offered ends diverge by standing), each ending crosses to its
 * epilogue and on to the shared THE GRIST card, and the card ends the narrative (the
 * Finale scene then lands on the Title). Pure data + the pure presenter — zero Phaser.
 */
import { describe, expect, it } from "vitest";

import {
  buildFinaleScript,
  endingIdFromSceneId,
  finaleEndingSceneId,
  FINALE_CARD_SCENE_ID,
  FINALE_CHOICE_NODE_ID,
  FINALE_SCENE_ID,
} from "../../src/content";
import {
  dialogueView,
  EndingIds,
  initialDialoguePresenter,
  presentDialogue,
  resolveReachableEndings,
  type DialoguePresenterState,
  type SceneDef,
} from "../../src/logic/narrative";

const ALL_ENDINGS = [
  EndingIds.sunder,
  EndingIds.wake,
  EndingIds.thirdWay,
  EndingIds.letDie,
] as const;

/**
 * Advance the presenter over a table until it reaches a fork (or a guard trips).
 * @param start - The opened presenter state.
 * @param table - The finale table being walked.
 * @returns The presenter state at the first fork reached.
 */
function advanceToFork(
  start: DialoguePresenterState,
  table: Readonly<Record<string, SceneDef>>
): DialoguePresenterState {
  let state = start;
  for (let guard = 0; guard < 50; guard += 1) {
    if (dialogueView(state, table).branching) {
      return state;
    }
    const next = presentDialogue(state, { kind: "advance" }, table);
    if (next === state) {
      return state;
    }
    state = next;
  }
  return state;
}

describe("finale ending-scene id round-trip (#244)", () => {
  it("recovers the ending id from its epilogue scene id, null otherwise", () => {
    for (const id of ALL_ENDINGS) {
      expect(endingIdFromSceneId(finaleEndingSceneId(id))).toBe(id);
    }
    expect(endingIdFromSceneId(FINALE_SCENE_ID)).toBeNull();
    expect(endingIdFromSceneId(FINALE_CARD_SCENE_ID)).toBeNull();
  });
});

describe("buildFinaleScript (#244)", () => {
  it("the confrontation names Sallow + the Choir's Song and walks into the fork", () => {
    const table = buildFinaleScript(ALL_ENDINGS);
    const nodes = table[FINALE_SCENE_ID]!.nodes;
    // Sallow is confronted (a beat is spoken by him) and the Choir's Song is named.
    expect(nodes.some(n => n.speaker === "sallow")).toBe(true);
    expect(nodes.map(n => n.text).join("\n")).toMatch(/choir/i);
    const opened = initialDialoguePresenter(table[FINALE_SCENE_ID]!)!;
    const atFork = advanceToFork(opened, table);
    expect(atFork.narrative.nodeId).toBe(FINALE_CHOICE_NODE_ID);
    expect(dialogueView(atFork, table).branching).toBe(true);
  });

  it("offers exactly the reachable endings as fork choices (diverges by standing)", () => {
    const full = buildFinaleScript(ALL_ENDINGS);
    const fullFork = advanceToFork(
      initialDialoguePresenter(full[FINALE_SCENE_ID]!)!,
      full
    );
    expect(dialogueView(fullFork, full).choices.map(c => c.id)).toEqual([
      ...ALL_ENDINGS,
    ]);

    // A neutral run reaches only the Sundering default — one choice, the divergence.
    const only = resolveReachableEndings({
      worldState: "ashfall",
      karma: 0,
      freeChoices: 0,
      wieldChoices: 0,
      reunionsCompleted: 0,
    });
    const lean = buildFinaleScript(only);
    const leanFork = advanceToFork(
      initialDialoguePresenter(lean[FINALE_SCENE_ID]!)!,
      lean
    );
    const choices = dialogueView(leanFork, lean).choices;
    expect(choices).toHaveLength(1);
    expect(choices[0]?.id).toBe(EndingIds.sunder);
  });

  it("each ending crosses to its epilogue, then to the shared THE GRIST card, then ends", () => {
    const table = buildFinaleScript(ALL_ENDINGS);
    for (const id of ALL_ENDINGS) {
      const atFork = advanceToFork(
        initialDialoguePresenter(table[FINALE_SCENE_ID]!)!,
        table
      );
      const epilogue = presentDialogue(
        atFork,
        { kind: "branch", choiceId: id },
        table
      );
      expect(epilogue.narrative.sceneId).toBe(finaleEndingSceneId(id));
      // Advance off the epilogue: it crosses to the shared final card.
      const card = presentDialogue(epilogue, { kind: "advance" }, table);
      expect(card.narrative.sceneId).toBe(FINALE_CARD_SCENE_ID);
      expect(card.narrative.nodeId).toBe("finale-card");
      // Advancing off the card ends the narrative (the scene then lands on the Title).
      const ended = presentDialogue(card, { kind: "advance" }, table);
      expect(dialogueView(ended, table).done).toBe(true);
    }
  });

  it("the card text carries the final THE GRIST beat", () => {
    const table = buildFinaleScript(ALL_ENDINGS);
    const card = table[FINALE_CARD_SCENE_ID]!.nodes[0]!.text;
    expect(card).toMatch(/THE GRIST/);
  });

  it("the built table round-trips through JSON (content-table safe)", () => {
    const table = buildFinaleScript(ALL_ENDINGS);
    expect(JSON.parse(JSON.stringify(table))).toEqual(table);
  });
});
