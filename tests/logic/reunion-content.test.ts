/**
 * The Act II reunion set-piece CONTENT + script builder (#273, composing #140). Asserts the
 * authored reunion data over the pure narrative presenter: {@link buildReunionScript}
 * assembles a self-contained recruit walk (the hook + meeting) that crosses into a terminal
 * **joined** scene, the joined-scene id round-trips to its reunion id (so the Reunion scene
 * can detect the recruit committing), and the completion flag key matches the
 * `reunion:<id>` namespace the finale's standing counts. Pure data + the pure presenter —
 * zero Phaser.
 */
import { describe, expect, it } from "vitest";

import {
  buildReunionScript,
  reunionCompleteFlag,
  reunionIdFromJoinedSceneId,
  reunionJoinedSceneId,
  reunionMeetSceneId,
  ReunionIds,
  REUNION_ORDER,
} from "../../src/content";
import {
  reunionsCompletedFromFlags,
  dialogueView,
  initialDialoguePresenter,
  presentDialogue,
  type DialoguePresenterState,
  type SceneDef,
} from "../../src/logic/narrative";

/**
 * Walk the presenter over a table until it is done (or a guard trips), collecting every
 * scene id visited so a test can assert the recruit crossed into its joined epilogue.
 * @param start - The opened presenter state.
 * @param table - The reunion table being walked.
 * @returns The visited scene ids in order.
 */
function walk(
  start: DialoguePresenterState,
  table: Readonly<Record<string, SceneDef>>
): string[] {
  let state = start;
  const scenes = [state.narrative.sceneId];
  for (let guard = 0; guard < 50; guard += 1) {
    if (dialogueView(state, table).done) {
      break;
    }
    const next = presentDialogue(state, { kind: "advance" }, table);
    if (next === state) {
      break;
    }
    state = next;
    scenes.push(state.narrative.sceneId);
  }
  return scenes;
}

describe("reunion joined-scene id round-trip (#273)", () => {
  it("recovers the reunion id from its joined scene id, null otherwise", () => {
    for (const id of REUNION_ORDER) {
      expect(reunionIdFromJoinedSceneId(reunionJoinedSceneId(id))).toBe(id);
    }
    expect(
      reunionIdFromJoinedSceneId(reunionMeetSceneId(ReunionIds.quietus))
    ).toBeNull();
    expect(reunionIdFromJoinedSceneId("region-cleared")).toBeNull();
  });
});

describe("buildReunionScript (#273)", () => {
  it("walks the hook + meeting into a terminal joined recruit beat for every reunion", () => {
    for (const id of REUNION_ORDER) {
      const table = buildReunionScript(id);
      const opened = initialDialoguePresenter(table[reunionMeetSceneId(id)]!)!;
      const scenes = walk(opened, table);
      // The recruit walk crosses out of the meeting into the joined epilogue and ends there.
      expect(scenes).toContain(reunionJoinedSceneId(id));
      expect(scenes[scenes.length - 1]).toBe(reunionJoinedSceneId(id));
      // The joined beat names the recruit joining the cause (the payoff).
      const joinedNodes = table[reunionJoinedSceneId(id)]!.nodes;
      expect(joinedNodes.map(n => n.text).join("\n")).toMatch(/join/i);
    }
  });

  it("its completion flag lands in the reunion namespace the finale standing counts", () => {
    // The Reunion scene writes reunionCompleteFlag(id) truthy on the recruit; the finale's
    // standing counts truthy `reunion:` flags — so a completed reunion lifts the finale.
    const flags = {
      [reunionCompleteFlag(ReunionIds.quietus)]: "completed",
      [reunionCompleteFlag(ReunionIds.cal)]: "completed",
    };
    expect(reunionsCompletedFromFlags(flags)).toBe(2);
  });
});
