/**
 * Unit coverage for the pure dialogue/cutscene presenter logic
 * (`src/logic/narrative/presenter`) — the deterministic, Phaser-free state
 * machine sub-task #104 (Story #92, PD-3.1) delivers. The presenter folds an
 * enumerated input — advance, branch (where a node offers choices), and skip —
 * over the existing PD-3.0 scene model and surfaces a serializable
 * {@link DialogueView} (speaker, full caption, portrait slot, branch choices,
 * done) the thin Phaser adapter renders and the UAT bridge reads.
 *
 * These are the assertions the issue's Acceptance Criteria name: advancing,
 * branching, and skipping all work and resolve to the right node deterministically;
 * the speaker + caption + portrait-slot view-model is derived purely; and the whole
 * thing runs headless (no DOM, no Phaser) under vitest — branching *logic* stays in
 * `logic/narrative`, exactly as the parent Story scopes it. Pure: the same
 * `(state, input, table)` always yields the same next state, frozen inputs are
 * never mutated, and nothing reads `Math.random` / `Date.now`.
 */
import { describe, expect, it } from "vitest";

import {
  advanceDialogue,
  dialogueView,
  initialDialoguePresenter,
  isDialogueDone,
  presentDialogue,
  type DialoguePresenterInput,
  type DialoguePresenterState,
} from "../../src/logic/narrative";
import type { DialogueNode, SceneDef } from "../../src/logic/narrative";

// Shared fixture ids hoisted so the repeated literals across cases don't trip the
// no-duplicate-string lint.
const PROLOGUE = "prologue";
const FORK = "fork";
const ASHFALL = "ashfall-vigil";
const OPEN = "open";
const REPLY = "reply";
const CLOSE = "close";
const WREN = "wren";
const TOBI = "tobi";
const FREE_PATH = "free-path";
const WIELD_PATH = "wield-path";

/**
 * A three-scene script: a linear prologue (open → reply → close, close crosses to
 * the fork scene), a branching fork node (two choices, each crossing to the final
 * scene), and a terminal scene. A plain content table — no Phaser, no functions.
 * The fork node carries `choices` (the optional branch arm) while the prologue
 * nodes carry only `next` (the linear arm) — proving the model is backward
 * compatible with PD-3.0's linear nodes.
 * @returns The scene-definition table keyed by scene id.
 */
function script(): Readonly<Record<string, SceneDef>> {
  const prologueNodes: readonly DialogueNode[] = [
    { id: OPEN, speaker: WREN, text: "The Drip stirs.", next: REPLY },
    { id: REPLY, speaker: TOBI, text: "Then we move.", next: CLOSE },
    { id: CLOSE, speaker: WREN, text: "To the vigil." },
  ];
  const forkNodes: readonly DialogueNode[] = [
    {
      id: OPEN,
      speaker: WREN,
      text: "Free the shard, or wield it?",
      portrait: WREN,
      choices: [
        { id: FREE_PATH, label: "Free it", to: ASHFALL },
        { id: WIELD_PATH, label: "Wield it", to: ASHFALL },
      ],
    },
  ];
  return {
    [PROLOGUE]: { id: PROLOGUE, nodes: prologueNodes, nextScene: FORK },
    [FORK]: { id: FORK, nodes: forkNodes },
    [ASHFALL]: {
      id: ASHFALL,
      nodes: [{ id: OPEN, speaker: WREN, text: "Ashfall." }],
    },
  };
}

/**
 * A fresh presenter parked at the prologue's opening node.
 * @returns The initial presenter state.
 */
function start(): DialoguePresenterState {
  return initialDialoguePresenter(script()[PROLOGUE]!)!;
}

const ADVANCE: DialoguePresenterInput = { kind: "advance" };
const SKIP: DialoguePresenterInput = { kind: "skip" };

describe("initialDialoguePresenter — open a scene at its first node", () => {
  it("parks at the scene's first node with an empty ledger and not done", () => {
    const state = start();
    expect(state.narrative.sceneId).toBe(PROLOGUE);
    expect(state.narrative.nodeId).toBe(OPEN);
    expect(state.narrative.flags).toEqual({});
    expect(state.done).toBe(false);
  });

  it("returns null for a scene with no nodes (totality)", () => {
    expect(initialDialoguePresenter({ id: "empty", nodes: [] })).toBeNull();
  });
});

describe("advance — walk the dialogue chain, then cross scenes", () => {
  it("advances to the next dialogue node within the scene", () => {
    const next = presentDialogue(start(), ADVANCE, script());
    expect(next.narrative.nodeId).toBe(REPLY);
    expect(next.done).toBe(false);
  });

  it("walks the full linear chain node by node, deterministically", () => {
    const table = script();
    const a = presentDialogue(start(), ADVANCE, table);
    const b = presentDialogue(a, ADVANCE, table);
    expect(a.narrative.nodeId).toBe(REPLY);
    expect(b.narrative.nodeId).toBe(CLOSE);
  });

  it("crosses to the next scene's opening node at a scene's terminal node", () => {
    const table = script();
    const atClose: DialoguePresenterState = {
      narrative: { sceneId: PROLOGUE, nodeId: CLOSE, flags: {} },
      done: false,
    };
    const next = presentDialogue(atClose, ADVANCE, table);
    expect(next.narrative.sceneId).toBe(FORK);
    expect(next.narrative.nodeId).toBe(OPEN);
  });

  it("marks the presenter done at the final node of the final scene", () => {
    const table = script();
    const end: DialoguePresenterState = {
      narrative: { sceneId: ASHFALL, nodeId: OPEN, flags: {} },
      done: false,
    };
    const next = presentDialogue(end, ADVANCE, table);
    expect(next.done).toBe(true);
    expect(isDialogueDone(next, table)).toBe(true);
  });

  it("advancing INTO a fork node lands on the fork, not done (regression)", () => {
    // Walking off a scene's terminal node into a next scene whose opening node is a
    // fork must surface the fork (branching) — never prematurely flip done, even
    // though a fork node looks scene-complete to isSceneComplete (no next/nextScene).
    const table = script();
    const atClose: DialoguePresenterState = {
      narrative: { sceneId: PROLOGUE, nodeId: CLOSE, flags: {} },
      done: false,
    };
    const atFork = presentDialogue(atClose, ADVANCE, table);
    expect(atFork.narrative.sceneId).toBe(FORK);
    expect(atFork.done).toBe(false);
    const view = dialogueView(atFork, table);
    expect(view.branching).toBe(true);
  });

  it("advance on a branching node is a no-op (a choice must be made)", () => {
    const table = script();
    const atFork: DialoguePresenterState = {
      narrative: { sceneId: FORK, nodeId: OPEN, flags: {} },
      done: false,
    };
    const next = presentDialogue(atFork, ADVANCE, table);
    expect(next.narrative.nodeId).toBe(OPEN);
    expect(next.narrative.sceneId).toBe(FORK);
  });
});

describe("branch — choose among a node's choices (where present)", () => {
  it("crosses to the chosen choice's target scene", () => {
    const table = script();
    const atFork: DialoguePresenterState = {
      narrative: { sceneId: FORK, nodeId: OPEN, flags: {} },
      done: false,
    };
    const branch: DialoguePresenterInput = {
      kind: "branch",
      choiceId: FREE_PATH,
    };
    const next = presentDialogue(atFork, branch, table);
    expect(next.narrative.sceneId).toBe(ASHFALL);
    expect(next.narrative.nodeId).toBe(OPEN);
  });

  it("ignores a branch with an unknown choice id (totality)", () => {
    const table = script();
    const atFork: DialoguePresenterState = {
      narrative: { sceneId: FORK, nodeId: OPEN, flags: {} },
      done: false,
    };
    const bad: DialoguePresenterInput = { kind: "branch", choiceId: "nope" };
    const next = presentDialogue(atFork, bad, table);
    expect(next).toBe(atFork);
  });

  it("ignores a branch on a non-branching (linear) node", () => {
    const table = script();
    const from = start();
    const bad: DialoguePresenterInput = { kind: "branch", choiceId: FREE_PATH };
    const next = presentDialogue(from, bad, table);
    expect(next).toBe(from);
  });
});

describe("skip — jump straight to the end of the narrative", () => {
  it("marks the presenter done from anywhere in the chain", () => {
    const table = script();
    const next = presentDialogue(start(), SKIP, table);
    expect(next.done).toBe(true);
  });

  it("skip is idempotent (skipping a done presenter stays done)", () => {
    const table = script();
    const once = presentDialogue(start(), SKIP, table);
    const twice = presentDialogue(once, SKIP, table);
    expect(twice.done).toBe(true);
  });

  it("an advance after a skip is a no-op (the narrative has ended)", () => {
    const table = script();
    const skipped = presentDialogue(start(), SKIP, table);
    const after = presentDialogue(skipped, ADVANCE, table);
    expect(after.done).toBe(true);
  });
});

describe("dialogueView — the serializable speaker/caption/portrait view-model", () => {
  it("renders the current node's speaker, full caption, and portrait slot", () => {
    const view = dialogueView(start(), script());
    expect(view.speaker).toBe(WREN);
    expect(view.caption).toBe("The Drip stirs.");
    expect(view.done).toBe(false);
    expect(view.branching).toBe(false);
    expect(view.choices).toEqual([]);
  });

  it("falls back to the speaker id for the portrait slot when no portrait is set", () => {
    const view = dialogueView(start(), script());
    // The prologue's open node has no explicit portrait → slot resolves to speaker.
    expect(view.portraitSlot).toBe(WREN);
  });

  it("surfaces the explicit portrait slot when the node sets one", () => {
    const table = script();
    const atFork: DialoguePresenterState = {
      narrative: { sceneId: FORK, nodeId: OPEN, flags: {} },
      done: false,
    };
    const view = dialogueView(atFork, table);
    expect(view.portraitSlot).toBe(WREN);
  });

  it("exposes the branch choices and the branching flag at a fork node", () => {
    const table = script();
    const atFork: DialoguePresenterState = {
      narrative: { sceneId: FORK, nodeId: OPEN, flags: {} },
      done: false,
    };
    const view = dialogueView(atFork, table);
    expect(view.branching).toBe(true);
    expect(view.choices).toEqual([
      { id: FREE_PATH, label: "Free it" },
      { id: WIELD_PATH, label: "Wield it" },
    ]);
  });

  it("keeps the final line on screen when the narrative ends naturally", () => {
    // Reaching the final node of the final scene (via advance/branch) is done, but
    // the last line stays visible — done means "no further advance", not "blank".
    const table = script();
    const atEnd: DialoguePresenterState = {
      narrative: { sceneId: ASHFALL, nodeId: OPEN, flags: {} },
      done: false,
    };
    const view = dialogueView(atEnd, table);
    expect(view.done).toBe(true);
    expect(view.caption).toBe("Ashfall.");
    expect(view.choices).toEqual([]);
  });

  it("renders blank once skipped (the dialogue is dismissed)", () => {
    const table = script();
    const skipped = presentDialogue(start(), SKIP, table);
    const view = dialogueView(skipped, table);
    expect(view.done).toBe(true);
    expect(view.caption).toBe("");
    expect(view.speaker).toBe("");
    expect(view.choices).toEqual([]);
  });

  it("renders blank-and-done for a cursor that addresses no node (totality)", () => {
    const table = script();
    const orphan: DialoguePresenterState = {
      narrative: { sceneId: "nope", nodeId: OPEN, flags: {} },
      done: false,
    };
    const view = dialogueView(orphan, table);
    expect(view.caption).toBe("");
    expect(view.done).toBe(true);
  });
});

describe("purity & determinism (locked-architecture rules)", () => {
  it("does not mutate a frozen input and returns fresh state on advance", () => {
    const table = script();
    const frozen = Object.freeze({
      ...start(),
      narrative: Object.freeze({ ...start().narrative }),
    });
    const next = presentDialogue(frozen, ADVANCE, table);
    expect(next).not.toBe(frozen);
    expect(frozen.narrative.nodeId).toBe(OPEN);
    expect(next.narrative.nodeId).toBe(REPLY);
  });

  it("is referentially stable for repeated identical inputs (deterministic)", () => {
    const table = script();
    const a = presentDialogue(start(), ADVANCE, table);
    const b = presentDialogue(start(), ADVANCE, table);
    expect(a).toEqual(b);
  });

  it("advanceDialogue is the bare-advance convenience over presentDialogue", () => {
    const table = script();
    expect(advanceDialogue(start(), table)).toEqual(
      presentDialogue(start(), ADVANCE, table)
    );
  });

  it("the presenter source imports no phaser (assert via no engine state leak)", () => {
    // A behavioral proxy for "zero phaser import": the whole view-model round-trips
    // through JSON (no class instances, no functions, no Phaser objects embedded).
    const view = dialogueView(start(), script());
    const restored = JSON.parse(JSON.stringify(view));
    expect(restored).toEqual(view);
  });
});
