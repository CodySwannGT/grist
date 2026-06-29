/**
 * Codified verification (UAT) playthrough for the pure narrative model + reducers
 * (issue #103, Story #91 under Epic #90, PRD #42 FR1/FR5/FR9, AC13/AC14). This is
 * the deterministic, headless analogue of the issue's Validation Journey: it
 * drives the two pure reducers — {@link advanceScene} and {@link writeLedgerFlag}
 * — across a small authored two-scene script from a single frozen initial state
 * and asserts the observable outcomes the journey names:
 *
 * 1. a scene advances and a ledger flag is written by pure functions that produce
 *    the new state, never mutating the input (proven against a frozen input);
 * 2. the moral-ledger flag is a serializable field consumable by SaveService —
 *    asserted by a JSON round-trip that is deep-equal to the written state.
 *
 * The browser-driven proof over `window.__VERIFY__` at `?uat=1` lands in the
 * opening e2e (#102), which consumes these very reducers end-to-end; this codifies
 * the same assertions at the deterministic logic layer the bridge will read —
 * exactly the completion evidence the issue's Validation Journey requires (the
 * verification suite resolving the reducers from a fixed state with exact,
 * asserted values, not merely compiling). ZERO Phaser imports by design (FR9).
 * @module tests/verification/narrative.verify
 */
import { describe, expect, it } from "vitest";

import {
  advanceScene,
  readLedgerFlag,
  writeLedgerFlag,
  type DialogueNode,
  type NarrativeState,
  type SceneDef,
} from "../../src/logic/narrative";

// Authored fixture ids, hoisted so the repeated literals don't trip the
// no-duplicate-string lint.
const PROLOGUE = "prologue";
const VIGIL = "ashfall-vigil";
const OPEN = "open";
const REPLY = "reply";
const CLOSE = "close";
const FREED_SHARD = "freedShard";

/**
 * A frozen two-scene script the journey drives: the prologue's three-node chain
 * (open → reply → close) crosses to a terminal second scene. Plain content data —
 * no Phaser, no functions, no randomness.
 * @returns The scene-definition table keyed by scene id.
 */
function script(): Readonly<Record<string, SceneDef>> {
  const prologueNodes: readonly DialogueNode[] = [
    { id: OPEN, speaker: "wren", text: "The Drip stirs.", next: REPLY },
    { id: REPLY, speaker: "tobi", text: "Then we move.", next: CLOSE },
    { id: CLOSE, speaker: "wren", text: "To the vigil." },
  ];
  return {
    [PROLOGUE]: { id: PROLOGUE, nodes: prologueNodes, nextScene: VIGIL },
    [VIGIL]: {
      id: VIGIL,
      nodes: [{ id: OPEN, speaker: "wren", text: "Ashfall." }],
    },
  };
}

/** The frozen initial narrative state both reducers are driven from. */
const START: NarrativeState = Object.freeze({
  sceneId: PROLOGUE,
  nodeId: OPEN,
  flags: {},
});

describe("verification: narrative reducers (PRD #42 AC13/AC14)", () => {
  it("advanceScene walks the full dialogue chain then crosses scenes, deterministically", () => {
    const table = script();
    const afterReply = advanceScene(START, table);
    const afterClose = advanceScene(afterReply, table);
    const afterCross = advanceScene(afterClose, table);

    expect(afterReply.nodeId).toBe(REPLY);
    expect(afterClose.nodeId).toBe(CLOSE);
    // Terminal node of the prologue crosses to the next scene's opening node.
    expect(afterCross).toEqual({ sceneId: VIGIL, nodeId: OPEN, flags: {} });

    // Re-running the same step from the same input yields a deep-equal result.
    expect(advanceScene(START, table)).toEqual(advanceScene(START, table));
  });

  it("advanceScene produces new state without mutating the frozen input", () => {
    const next = advanceScene(START, script());
    expect(next).not.toBe(START);
    expect(START.nodeId).toBe(OPEN); // frozen input untouched
    expect(next.nodeId).toBe(REPLY);
  });

  it("writeLedgerFlag folds a serializable moral-ledger flag by pure function", () => {
    const written = writeLedgerFlag(START, FREED_SHARD, true);
    expect(written).not.toBe(START);
    expect(START.flags).toEqual({}); // frozen input untouched
    expect(readLedgerFlag(written, FREED_SHARD)).toBe(true);
    // The cursor is carried forward unchanged — only the ledger folds.
    expect(written.sceneId).toBe(PROLOGUE);
    expect(written.nodeId).toBe(OPEN);
  });

  it("the moral-ledger flag is serializable — a JSON round-trip is deep-equal (SaveService)", () => {
    // Advance the scene AND write flags, then prove the whole state — cursor +
    // ledger — survives the round-trip SaveService performs, verbatim.
    const table = script();
    const advanced = advanceScene(START, table);
    const withBool = writeLedgerFlag(advanced, FREED_SHARD, true);
    const withNumber = writeLedgerFlag(withBool, "karma", -2);
    const withString = writeLedgerFlag(withNumber, "shardMode", "wield");

    const restored = JSON.parse(JSON.stringify(withString)) as NarrativeState;
    expect(restored).toEqual(withString);
    expect(restored.flags).toEqual({
      [FREED_SHARD]: true,
      karma: -2,
      shardMode: "wield",
    });
  });
});
