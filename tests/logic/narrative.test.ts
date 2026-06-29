/**
 * Unit coverage for the pure narrative core (`src/logic/narrative`): the typed,
 * Phaser-free scene/dialogue/flag model and its two deterministic reducers —
 * {@link advanceScene} (walk dialogue → scene) and {@link writeLedgerFlag} (set a
 * serializable moral-ledger flag). These are the assertions the issue's
 * Acceptance Criteria name: pure functions produce the new state with no Phaser
 * import, the moral-ledger flag is a serializable field, and that flag survives a
 * JSON round-trip the way `SaveService` would persist it. Exercised headless
 * (no DOM, no Phaser) so they run under vitest.
 */
import { describe, expect, it } from "vitest";

import { serialize, type MoralLedger } from "../../src/logic/save";
import {
  advanceScene,
  initialNarrativeState,
  isSceneComplete,
  newNarrativeLedger,
  readLedgerFlag,
  writeLedgerFlag,
  type DialogueNode,
  type NarrativeState,
  type SceneDef,
  type SceneFlag,
} from "../../src/logic/narrative";

// Shared fixture ids, hoisted so the repeated literals across cases below don't
// trip the no-duplicate-string lint.
const PROLOGUE = "prologue";
const ASHFALL = "ashfall-vigil";
const OPEN = "open";
const REPLY = "reply";
const CLOSE = "close";
const FREED_SHARD = "freedShard";

/**
 * A two-scene script: the prologue's three-node dialogue chain (open → reply →
 * close, where `close` ends the scene by pointing at the next scene) and a
 * terminal second scene. A plain content table — no Phaser, no functions.
 * @returns The scene-definition table keyed by scene id.
 */
function script(): Readonly<Record<string, SceneDef>> {
  const prologueNodes: readonly DialogueNode[] = [
    { id: OPEN, speaker: "wren", text: "The Drip stirs.", next: REPLY },
    { id: REPLY, speaker: "tobi", text: "Then we move.", next: CLOSE },
    // The scene's terminal node omits `next` (exactOptionalPropertyTypes).
    { id: CLOSE, speaker: "wren", text: "To the vigil." },
  ];
  return {
    [PROLOGUE]: { id: PROLOGUE, nodes: prologueNodes, nextScene: ASHFALL },
    [ASHFALL]: {
      id: ASHFALL,
      // The final scene's only node omits `next`; the scene omits `nextScene`.
      nodes: [{ id: OPEN, speaker: "wren", text: "Ashfall." }],
    },
  };
}

/**
 * A fresh narrative state parked at the prologue's opening node with an empty
 * flag ledger.
 * @returns The initial narrative state.
 */
function start(): NarrativeState {
  return { sceneId: PROLOGUE, nodeId: OPEN, flags: {} };
}

describe("advanceScene — walk dialogue, then cross to the next scene", () => {
  it("advances to the next dialogue node within the scene", () => {
    const next = advanceScene(start(), script());
    expect(next).toEqual({ sceneId: PROLOGUE, nodeId: REPLY, flags: {} });
  });

  it("walks the full chain node by node, deterministically", () => {
    const table = script();
    const afterReply = advanceScene(start(), table);
    const afterClose = advanceScene(afterReply, table);
    expect(afterReply.nodeId).toBe(REPLY);
    expect(afterClose.nodeId).toBe(CLOSE);
  });

  it("crosses to the next scene's opening node when a node has no successor", () => {
    const table = script();
    const atClose: NarrativeState = {
      sceneId: PROLOGUE,
      nodeId: CLOSE,
      flags: {},
    };
    const next = advanceScene(atClose, table);
    expect(next).toEqual({ sceneId: ASHFALL, nodeId: OPEN, flags: {} });
  });

  it("is terminal at the final node of the final scene (returns state unchanged)", () => {
    const table = script();
    const end: NarrativeState = { sceneId: ASHFALL, nodeId: OPEN, flags: {} };
    expect(advanceScene(end, table)).toBe(end);
  });

  it("carries the flag ledger forward verbatim across an advance", () => {
    const table = script();
    const withFlag: NarrativeState = {
      sceneId: PROLOGUE,
      nodeId: OPEN,
      flags: { [FREED_SHARD]: true },
    };
    expect(advanceScene(withFlag, table).flags).toEqual({
      [FREED_SHARD]: true,
    });
  });

  it("is pure: does not mutate a frozen input and returns fresh state", () => {
    const table = script();
    const frozen = Object.freeze(start());
    const next = advanceScene(frozen, table);
    expect(next).not.toBe(frozen);
    expect(frozen.nodeId).toBe(OPEN);
    expect(next.nodeId).toBe(REPLY);
  });

  it("is a no-op for an unknown scene/node (totality)", () => {
    const table = script();
    const orphan: NarrativeState = { sceneId: "nope", nodeId: OPEN, flags: {} };
    expect(advanceScene(orphan, table)).toBe(orphan);
  });
});

describe("writeLedgerFlag — set a serializable moral-ledger flag", () => {
  it("writes a boolean flag into a fresh ledger", () => {
    const next = writeLedgerFlag(start(), FREED_SHARD, true);
    expect(next.flags).toEqual({ [FREED_SHARD]: true });
  });

  it("supports string and number flag values (all serializable primitives)", () => {
    const withString = writeLedgerFlag(start(), "shardMode", "wield");
    expect(withString.flags["shardMode"]).toBe("wield");
    const withNumber = writeLedgerFlag(start(), "karma", -2);
    expect(withNumber.flags["karma"]).toBe(-2);
  });

  it("overwrites an existing flag without disturbing the others", () => {
    const seeded = writeLedgerFlag(
      writeLedgerFlag(start(), FREED_SHARD, false),
      "metEnvoy",
      true
    );
    const updated = writeLedgerFlag(seeded, FREED_SHARD, true);
    expect(updated.flags).toEqual({ [FREED_SHARD]: true, metEnvoy: true });
  });

  it("leaves the scene cursor untouched", () => {
    const next = writeLedgerFlag(start(), FREED_SHARD, true);
    expect(next.sceneId).toBe(PROLOGUE);
    expect(next.nodeId).toBe(OPEN);
  });

  it("is pure: does not mutate the input state or its flag record", () => {
    const before = start();
    const frozen: NarrativeState = {
      ...before,
      flags: Object.freeze({ ...before.flags }),
    };
    const next = writeLedgerFlag(frozen, FREED_SHARD, true);
    expect(next).not.toBe(frozen);
    expect(next.flags).not.toBe(frozen.flags);
    expect(frozen.flags).toEqual({});
  });
});

describe("builders & readers — fresh state and thin accessors", () => {
  it("newNarrativeLedger is an empty record", () => {
    expect(newNarrativeLedger()).toEqual({});
  });

  it("initialNarrativeState opens a scene at its first node with an empty ledger", () => {
    const scene = script()[PROLOGUE]!;
    expect(initialNarrativeState(scene)).toEqual({
      sceneId: PROLOGUE,
      nodeId: OPEN,
      flags: {},
    });
  });

  it("initialNarrativeState returns null for a scene with no nodes", () => {
    expect(initialNarrativeState({ id: "empty", nodes: [] })).toBeNull();
  });

  it("readLedgerFlag returns the written value, or undefined when unwritten", () => {
    const state = writeLedgerFlag(start(), FREED_SHARD, true);
    expect(readLedgerFlag(state, FREED_SHARD)).toBe(true);
    expect(readLedgerFlag(state, "never")).toBeUndefined();
  });

  it("isSceneComplete is true only at the final node of the final scene", () => {
    const table = script();
    expect(isSceneComplete(start(), table)).toBe(false);
    expect(
      isSceneComplete({ sceneId: ASHFALL, nodeId: OPEN, flags: {} }, table)
    ).toBe(true);
  });
});

describe("the ledger flag is serializable / consumable by SaveService (AC)", () => {
  it("round-trips the flag ledger through JSON deep-equal", () => {
    const written = writeLedgerFlag(
      writeLedgerFlag(start(), FREED_SHARD, true),
      "karma",
      -2
    );
    const restored = JSON.parse(JSON.stringify(written)) as NarrativeState;
    expect(restored).toEqual(written);
  });

  it("a flag value is a plain serializable primitive (no functions / class instances)", () => {
    const flag: SceneFlag = writeLedgerFlag(start(), FREED_SHARD, true).flags[
      FREED_SHARD
    ]!;
    expect(["boolean", "string", "number"]).toContain(typeof flag);
  });

  it("the flag feeds the existing save MoralLedger shape without redeclaring it", () => {
    // The narrative flag (a boolean Free/Wield resolution) is consumable by the
    // existing persisted save `MoralLedger` — the AC's "consumable by SaveService"
    // — and the composed save payload survives the real save serializer.
    const state = writeLedgerFlag(start(), FREED_SHARD, true);
    const freed = state.flags[FREED_SHARD] === true;
    const ledger: MoralLedger = {
      karma: freed ? 1 : -1,
      freeChoices: freed ? 1 : 0,
      wieldChoices: freed ? 0 : 1,
    };
    const text = serialize({
      version: 2,
      party: [],
      grist: 0,
      inventory: [],
      learned: [],
      learning: [],
      choice: { resolved: true, shard: "emberwisp", variant: "free" },
      moralLedger: ledger,
      rng: { seed: 0, state: 0 },
      worldState: "reach",
    });
    expect(JSON.parse(text).moralLedger).toEqual({
      karma: 1,
      freeChoices: 1,
      wieldChoices: 0,
    });
  });
});
