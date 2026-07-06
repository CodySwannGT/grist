/**
 * Unit coverage for the **Reckoning world-turn set-piece** — Sallow's Second
 * Sundering (#125, PRD #43 FR7 / AC5 / Scope-IN 6; `wiki/narrative/main-quest.md`
 * "The Reckoning — the world-turn"; `wiki/narrative/themes-and-tone.md`). Proves —
 * headless, with ZERO Phaser imports (FR9) — that the pure set-piece composed on top
 * of the shipped world-flip (`logic/world`), keystone trigger (`logic/region/keystone`),
 * and reunion structure (`logic/party/reunion`) satisfies all five acceptance clauses:
 *
 * 1. the Reckoning flips world-state `reach → ashfall`;
 * 2. lower Vanta and a whole region are rendered to ash;
 * 3. the party is scattered (reduced to the POV survivor);
 * 4. Sable is lost;
 * 5. the overworld is visibly transformed (color/music drained).
 *
 * Plus the invariants the sibling set-pieces hold: keystone-gating (an un-triggered
 * set-piece is a soft-gate that neither plays nor errors), idempotence (the turn fires
 * once), determinism (same trigger + roster + seed + actions ⇒ identical hash
 * progression), and the scene-flag projection that persists the transform with no
 * save-schema change. The e2e twin (`tests/e2e/reckoning.spec.ts`) proves the same on
 * the live `__VERIFY__` canvas; this suite proves the rules headlessly. Patterned on
 * `tests/logic/keystone.test.ts` (import style, structure).
 */
import { describe, expect, it } from "vitest";

import { PartyMemberIds } from "../../src/content";
import { ReunionIds } from "../../src/content/reunions";
import {
  dialogueView,
  initialDialoguePresenter,
  presentDialogue,
} from "../../src/logic/narrative";
import {
  RECKONING_ASH_SWATH,
  RECKONING_SCENE_ID,
  RECKONING_SURVIVORS,
  ReckoningPhases,
  SABLE_LOST_FLAG,
  hashReckoning,
  isReckoningComplete,
  isReckoningTriggered,
  openReckoning,
  playReckoning,
  playReckoningToCompletion,
  reckoningAshedSwath,
  reckoningDrained,
  reckoningRoster,
  reckoningSableLost,
  reckoningScattered,
  reckoningStatusFlags,
  reckoningWorldState,
  reckoningWorldTurned,
} from "../../src/logic/narrative/reckoning";
import {
  RECKONING_SCRIPT,
  RECKONING_TURN_BEAT_MS,
} from "../../src/content/scenes/reckoning";

/** A fixed boot seed so the suite is reproducible. */
const SEED = 0x2e_c0;
/** The full Act I party carried into the Reckoning (Wren + Tobi + Halcyon). */
const ACT_ONE_ROSTER = [
  PartyMemberIds.wren,
  PartyMemberIds.tobi,
  PartyMemberIds.halcyon,
] as const;

/**
 * A triggered set-piece in Act I reach over the full Act I party.
 * @returns A keystone-triggered Reckoning session at its sealed boot.
 */
function triggered() {
  return openReckoning(true, "reach", ACT_ONE_ROSTER, SEED);
}

describe("Reckoning keystone-trigger soft-gate (#125)", () => {
  it("an un-triggered set-piece is gated: it never turns the world, and playing is a no-op", () => {
    const gated = openReckoning(false, "reach", ACT_ONE_ROSTER, SEED);
    expect(isReckoningTriggered(gated)).toBe(false);
    expect(gated.phase).toBe(ReckoningPhases.gated);

    const played = playReckoningToCompletion(gated);
    expect(played.phase).toBe(ReckoningPhases.gated);
    expect(reckoningWorldTurned(played)).toBe(false);
    expect(reckoningWorldState(played)).toBe("reach");
    expect(reckoningRoster(played)).toEqual(ACT_ONE_ROSTER);
    expect(reckoningSableLost(played)).toBe(false);
    // A single play() on a gated session returns the SAME logical state.
    expect(playReckoning(gated)).toEqual(gated);
  });

  it("a triggered set-piece boots sealed at beat 0 with nothing yet transformed", () => {
    const session = triggered();
    expect(isReckoningTriggered(session)).toBe(true);
    expect(session.phase).toBe(ReckoningPhases.sealed);
    expect(reckoningWorldState(session)).toBe("reach");
    expect(reckoningAshedSwath(session)).toEqual([]);
    expect(reckoningScattered(session)).toEqual([]);
    expect(reckoningSableLost(session)).toBe(false);
    expect(reckoningDrained(session)).toBe(false);
  });
});

describe("the Reckoning transform — all five AC clauses (#125)", () => {
  const done = playReckoningToCompletion(triggered());

  it("clause 1 — flips world-state reach → ashfall", () => {
    expect(done.worldStateBefore).toBe("reach");
    expect(reckoningWorldTurned(done)).toBe(true);
    expect(reckoningWorldState(done)).toBe("ashfall");
  });

  it("clause 2 — renders lower Vanta and a whole region to ash", () => {
    const ashed = reckoningAshedSwath(done);
    expect(ashed).toEqual(RECKONING_ASH_SWATH);
    expect(ashed).toContain("lower-vanta");
    expect(ashed).toContain("upper-vanta");
    expect(ashed).toHaveLength(2);
  });

  it("clause 3 — scatters the party down to the POV survivor (Wren)", () => {
    expect(reckoningRoster(done)).toEqual([PartyMemberIds.wren]);
    expect(RECKONING_SURVIVORS).toEqual([PartyMemberIds.wren]);
    // Everyone else in the Act I party is scattered (reassembled in Act II).
    expect(reckoningScattered(done)).toEqual([
      PartyMemberIds.tobi,
      PartyMemberIds.halcyon,
    ]);
  });

  it("clause 4 — Sable is lost (a flag, not a roster removal)", () => {
    expect(reckoningSableLost(done)).toBe(true);
    // Sable is never a party member — losing her is narrative, not a roster change.
    expect(reckoningRoster(done)).not.toContain("sable");
  });

  it("clause 5 — the overworld's color/music drain once the world turns", () => {
    expect(reckoningDrained(done)).toBe(true);
    expect(isReckoningComplete(done)).toBe(true);
  });
});

describe("the world turns before the party scatters (beat ordering)", () => {
  it("the world tips into Ashfall a beat before the scatter + Sable-loss", () => {
    // sealed(0) → sallow-overloads(1) → world-turns(2): the world has turned, but the
    // party has not yet scattered and Sable is not yet lost.
    const atTurn = playReckoning(playReckoning(triggered()));
    expect(atTurn.phase).toBe(ReckoningPhases.worldTurns);
    expect(reckoningWorldTurned(atTurn)).toBe(true);
    expect(reckoningWorldState(atTurn)).toBe("ashfall");
    // …but the hard cut (scatter + Sable) has not landed yet.
    expect(reckoningRoster(atTurn)).toEqual(ACT_ONE_ROSTER);
    expect(reckoningSableLost(atTurn)).toBe(false);

    const atScatter = playReckoning(atTurn);
    expect(atScatter.phase).toBe(ReckoningPhases.scattered);
    expect(reckoningSableLost(atScatter)).toBe(true);
    expect(reckoningRoster(atScatter)).toEqual([PartyMemberIds.wren]);
  });
});

describe("idempotence — the turn fires once (#125)", () => {
  it("advancing past complete is a no-op (the world can never re-turn)", () => {
    const done = playReckoningToCompletion(triggered());
    expect(playReckoning(done)).toEqual(done);
    expect(playReckoningToCompletion(done)).toEqual(done);
  });
});

describe("determinism — same trigger + roster + seed + actions ⇒ identical hash", () => {
  it("reproduces a byte-identical, strictly-progressing hash sequence", () => {
    const sample = () => {
      let session = triggered();
      const hashes = [hashReckoning(session)];
      for (let i = 0; i < 5; i++) {
        session = playReckoning(session);
        hashes.push(hashReckoning(session));
      }
      return hashes;
    };
    const first = sample();
    const second = sample();
    expect(second).toEqual(first);
    // Every hash is an 8-hex digest and the sequence actually progresses.
    expect(first.every(h => /^[0-9a-f]{8}$/.test(h))).toBe(true);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it("a different seed yields a different completed digest", () => {
    const a = hashReckoning(playReckoningToCompletion(triggered()));
    const b = hashReckoning(
      playReckoningToCompletion(
        openReckoning(true, "reach", ACT_ONE_ROSTER, 0x1234)
      )
    );
    expect(a).not.toBe(b);
  });
});

describe("scene-flag projection — persists the transform with no save-schema bump", () => {
  it("before the turn, only the (false) Sable flag is projected", () => {
    const flags = reckoningStatusFlags(triggered());
    expect(flags[SABLE_LOST_FLAG]).toBe(false);
    // The reunion board is NOT seeded until the world turns.
    expect(flags[`reunion:${ReunionIds.quietus}`]).toBeUndefined();
  });

  it("after the turn, Sable-lost is set and the Act II reunion board is seeded available", () => {
    const flags = reckoningStatusFlags(playReckoningToCompletion(triggered()));
    expect(flags[SABLE_LOST_FLAG]).toBe(true);
    // Every reunion is seeded `available` — the scatter's downstream (the reunions the
    // player reassembles the scattered party through).
    for (const id of Object.values(ReunionIds)) {
      expect(flags[`reunion:${id}`]).toBe("available");
    }
  });
});

describe("the authored Reckoning scene (dialogue presenter pattern)", () => {
  const scene = RECKONING_SCRIPT[RECKONING_SCENE_ID]!;

  it("authors a linear, well-formed set-piece script the presenter can walk", () => {
    expect(scene.id).toBe(RECKONING_SCENE_ID);
    expect(scene.nodes.length).toBeGreaterThan(0);
    // Every non-terminal node's `next` resolves to a real node in the scene.
    const ids = new Set(scene.nodes.map(node => node.id));
    for (const node of scene.nodes) {
      if (node.next !== undefined) {
        expect(ids.has(node.next)).toBe(true);
      }
    }
  });

  it("holds a deliberate quiet beat on the world-turns node so the hard cut lands", () => {
    const turn = scene.nodes.find(node => node.beatMs !== undefined);
    expect(turn?.beatMs).toBe(RECKONING_TURN_BEAT_MS);
  });

  it("walks to a terminal done state through the presenter (Phaser-free)", () => {
    let state = initialDialoguePresenter(scene);
    expect(state).not.toBeNull();
    for (let guard = 0; guard < 32 && state && !state.done; guard++) {
      state = presentDialogue(state, { kind: "advance" }, RECKONING_SCRIPT);
    }
    expect(state!.done).toBe(true);
    // The final view renders without crashing and reports done.
    expect(dialogueView(state!, RECKONING_SCRIPT).done).toBe(true);
  });
});
