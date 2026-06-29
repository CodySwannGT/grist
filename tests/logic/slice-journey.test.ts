/**
 * Vertical-slice journey unit suite — the headless, Phaser-free twin of the
 * `tests/e2e/slice-uat.spec.ts` integration spec (sub-task #89, PRD #41 AC10).
 * Where the per-axis suites each prove ONE reducer in isolation — field traversal
 * (`field-traversal` / `field-logic`), the economy (`grist-wallet`), learning
 * (`spell-learning`), the moral choice (`free-vs-wield`), and the combat hash
 * (`combat-determinism`) — this suite threads them together into the slice's core
 * loop and asserts the WHOLE thing composes deterministically:
 *
 *   explore (A→B→C field triggers) → fight (earn grist per room) →
 *   face the Bound (free-vs-wield resolution) → grow (spend grist + learning) →
 *   replay (the same seed reproduces the same field rng + combat hash progression).
 *
 * It imports only pure `src/logic` + `src/content` — zero Phaser — so the slice's
 * field-trigger / economy / learning / choice logic is covered in the unit lane
 * (AC10's "unit tests in tests/logic … deterministically cover the new field-
 * trigger, economy (earn/spend), learning, and free-vs-wield logic"), and the
 * combat hash progression is pinned to the SAME committed fixture the e2e
 * `__VERIFY__.hash()` lane asserts against — so the headless and browser lanes
 * agree on one fact, the determinism state-hash gate (AC9). [EVIDENCE: uats-1-9-pass]
 * @module tests/logic/slice-journey
 */
import { describe, expect, it } from "vitest";

import {
  EncounterIds,
  EnemyIds,
  MarrowRoomIds,
  PARTY,
  ENCOUNTERS,
  SLICE_EARN,
  SLICE_ECONOMY,
} from "../../src/content";
import { BoundIds } from "../../src/content/bounds";
import { SpellIds } from "../../src/content/spells";
import {
  hashState,
  runToNextDecision,
  startBattle,
  step,
  type BattleAction,
} from "../../src/logic/combat";
import {
  FieldActionKinds,
  FieldPhases,
  canTraverse,
  encounterForRoom,
  startField,
  stepField,
  type FieldState,
} from "../../src/logic/field";
import {
  earnGrist,
  newWallet,
  spendGrist,
  type GristWallet,
} from "../../src/logic/grist";
import {
  isResolved,
  newMoralLedger,
  resolveChoice,
} from "../../src/logic/free-vs-wield";
import { newRunState, type RunState } from "../../src/logic/run-state";
import {
  earnLearningPoints,
  equipShard,
  isLearning,
  learningProgress,
  newLearningState,
  type LearningState,
} from "../../src/logic/spell-learning";
import {
  DETERMINISM_HASHES_SEED_A,
  DETERMINISM_HASHES_SEED_B,
  DETERMINISM_SEED_A,
  DETERMINISM_SEED_B,
} from "../fixtures/determinism-hashes";

/** The fixed seed the slice journey replays (matches the per-axis suites). */
const FIXED_SEED = 0x1234abcd;
/** Runner's Reflex draws the wallet down 25 grist (the bench stat sink). */
const RUNNERS_REFLEX_COST = 25;

/** A combatant ref the combat reducer accepts on a {@link BattleAction}. */
const WREN = { side: "party", index: 0 } as const;
const SCRAPPER = { side: "enemies", index: 0 } as const; // marrow-scrapper
const CONSTRUCT = { side: "enemies", index: 1 } as const; // render-construct

/**
 * The canonical Strike / Craft / Bind / Craft script the determinism gate pins —
 * a Strike, a Craft one-shotting the Flux-weak construct (funding the pool with
 * its loot), a grist-spending Bind, and a finishing Craft — ending in Victory.
 */
const COMBAT_SCRIPT: readonly BattleAction[] = [
  { kind: "strike", actor: WREN, target: SCRAPPER },
  { kind: "craft", id: "spark", actor: WREN, target: CONSTRUCT },
  { kind: "bind", id: "bind-wisp", actor: WREN },
  { kind: "craft", id: "spark", actor: WREN, target: SCRAPPER },
];

/**
 * Explore the three rooms via the field reducer: enter Room A, acknowledge its
 * trigger, traverse to B, acknowledge, traverse to C — the A→B→C field journey
 * (the same sequence `field-traversal` proves leg-by-leg, run here end-to-end).
 * @param seed - The field seed.
 * @returns The field state with Room C reached and its trigger pending.
 */
function exploreToRoomC(seed = FIXED_SEED): FieldState {
  let state = startField(seed);
  state = stepField(state, {
    kind: FieldActionKinds.enter,
    roomId: MarrowRoomIds.a,
  });
  state = stepField(state, { kind: FieldActionKinds.acknowledge });
  state = stepField(state, { kind: FieldActionKinds.traverse });
  state = stepField(state, { kind: FieldActionKinds.acknowledge });
  state = stepField(state, { kind: FieldActionKinds.traverse });
  return state;
}

/**
 * Play the canonical encounter headlessly under a seed, sampling {@link hashState}
 * at the opening decision and after each scripted action (advancing to the next
 * player turn between actions so enemy turns + ATB fill are part of the
 * progression). The pure twin of the e2e `__VERIFY__.hash()` lane.
 * @param seed - The battle seed.
 * @returns The hash progression and the terminal phase.
 */
function playCombat(seed: number): {
  hashes: string[];
  finalPhase: string;
} {
  let state = runToNextDecision(
    startBattle([PARTY.wren, PARTY.tobi], ENCOUNTERS["the-drip"], seed)
  );
  const hashes: string[] = [hashState(state)];
  for (const action of COMBAT_SCRIPT) {
    state = runToNextDecision(step(state, action));
    hashes.push(hashState(state));
  }
  return { hashes, finalPhase: state.phase };
}

describe("slice journey — explore (field triggers A→B→C)", () => {
  it("walks the three rooms in order, firing each encounter trigger in turn", () => {
    let state = startField(FIXED_SEED);
    expect(state.currentRoom).toBe(MarrowRoomIds.a);

    // Before entering, Room A's un-fired encounter resolves to exactly the
    // marrow-scrapper (the authored Room A fight).
    const roomAEncounter = encounterForRoom(state, MarrowRoomIds.a);
    expect(roomAEncounter).not.toBeNull();
    expect(roomAEncounter!.enemies).toEqual([EnemyIds.marrowScrapper]);

    // Room A fires the warren-street scrapper encounter on entry (the in-flight
    // pending trigger names the encounter id).
    state = stepField(state, {
      kind: FieldActionKinds.enter,
      roomId: MarrowRoomIds.a,
    });
    expect(state.phase).toBe(FieldPhases.triggered);
    expect(state.pendingEncounter).toBe(EncounterIds.warrenStreet);

    // Acknowledge → traverse to Room B (the-drip), then Room C (the-cage boss).
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(canTraverse(state)).toBe(true);
    state = stepField(state, { kind: FieldActionKinds.traverse });
    expect(state.currentRoom).toBe(MarrowRoomIds.b);
    expect(state.pendingEncounter).toBe(EncounterIds.theDrip);

    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    state = stepField(state, { kind: FieldActionKinds.traverse });
    expect(state.currentRoom).toBe(MarrowRoomIds.c);
    expect(state.pendingEncounter).toBe(EncounterIds.theCage);
  });

  it("reaches a complete session once Room C's trigger is acknowledged", () => {
    let state = exploreToRoomC();
    state = stepField(state, { kind: FieldActionKinds.acknowledge });
    expect(state.phase).toBe(FieldPhases.complete);
    expect(canTraverse(state)).toBe(false);
  });
});

describe("slice journey — fight (earn) → grow (spend) economy loop", () => {
  it("earns the slice's per-room grist ladder, then spends it at the bench and on a Bind", () => {
    // Earn: the slice's authored per-encounter grist, folded room over room on
    // top of the starting wallet — the exact ladder the field↔battle e2e walks.
    const earned = [
      SLICE_EARN.scrapper.grist,
      SLICE_EARN.vesper.grist,
      SLICE_EARN["salvage-cache"].grist,
      SLICE_EARN.ashling.grist,
    ].reduce((wallet, gain) => earnGrist(wallet, gain), newWallet());
    expect(earned.grist).toBe(
      SLICE_ECONOMY.startingGrist +
        SLICE_EARN.scrapper.grist +
        SLICE_EARN.vesper.grist +
        SLICE_EARN["salvage-cache"].grist +
        SLICE_EARN.ashling.grist
    );

    // Spend: the boss Bind: Wisp (8 grist, the in-battle sink) and a bench stat
    // (Runner's Reflex, 25) both draw down the SAME shared wallet — the two-
    // resource economy. Each spend succeeds against the earned balance.
    const afterBind = spendGrist(earned, 8);
    expect(afterBind.ok).toBe(true);
    const afterBench = spendGrist(afterBind.wallet, RUNNERS_REFLEX_COST);
    expect(afterBench.ok).toBe(true);
    expect(afterBench.wallet.grist).toBe(
      earned.grist - 8 - RUNNERS_REFLEX_COST
    );
  });

  it("rejects an unaffordable spend, leaving the wallet untouched (no debt)", () => {
    const wallet: GristWallet = newWallet(RUNNERS_REFLEX_COST - 1);
    const result = spendGrist(wallet, RUNNERS_REFLEX_COST);
    expect(result.ok).toBe(false);
    expect(result.wallet).toBe(wallet);
    expect(result.spent).toBe(0);
  });
});

describe("slice journey — grow (learning advances from equip + battle)", () => {
  it("equipping the Ashling shard begins Cinder learning, which then advances", () => {
    let learning: LearningState = equipShard(
      newLearningState(),
      BoundIds.marrowBound
    );
    expect(isLearning(learning, SpellIds.cinder)).toBe(true);
    expect(learningProgress(learning, SpellIds.cinder)).toBe(0);

    // Battle awards advance Cinder without yet completing it (a real progression).
    learning = earnLearningPoints(learning, 10);
    expect(learningProgress(learning, SpellIds.cinder)).toBeGreaterThan(0);
    expect(learningProgress(learning, SpellIds.cinder)).toBeLessThan(1);
  });
});

describe("slice journey — face the Bound (free-vs-wield diverges)", () => {
  /** A run with the Ashling reward shard's free-vs-wield choice pending. */
  const pending: RunState = {
    ...newRunState(),
    shards: [BoundIds.marrowBound],
    pendingChoiceShard: BoundIds.marrowBound,
  };

  it("resolves the choice and yields measurably different state for free vs wield", () => {
    const free = resolveChoice(pending, newMoralLedger(), "free");
    const wield = resolveChoice(pending, newMoralLedger(), "wield");

    expect(isResolved(free)).toBe(true);
    expect(isResolved(wield)).toBe(true);
    // The fork diverges on the variant, karma, and corruption — the slice's thesis.
    expect(free.choice.variant).toBe("free");
    expect(wield.choice.variant).toBe("wield");
    expect(free.ledger.karma).toBeGreaterThan(0);
    expect(wield.ledger.karma).toBeLessThan(0);
    expect(free.corruptionAccrued).toBe(0);
    expect(wield.corruptionAccrued).toBeGreaterThan(0);
    expect(free).not.toEqual(wield);
    // Resolving clears the pending trigger on both paths (the choice is consumed).
    expect(free.run.pendingChoiceShard).toBeNull();
    expect(wield.run.pendingChoiceShard).toBeNull();
  });
});

describe("slice journey — determinism state-hash gate (AC9)", () => {
  it("plays the seeded combat slice all the way to Victory (guards a no-op pass)", () => {
    const run = playCombat(DETERMINISM_SEED_A);
    expect(run.finalPhase).toBe("won");
    expect(run.hashes).toHaveLength(COMBAT_SCRIPT.length + 1);
    expect(new Set(run.hashes).size).toBeGreaterThan(1);
  });

  it("reproduces the SAME committed hash progression the e2e __VERIFY__ lane pins to", () => {
    // The headless twin and the browser lane assert against the SAME constant —
    // proving the two lanes agree on one fact, not merely with each other.
    expect(playCombat(DETERMINISM_SEED_A).hashes).toEqual(
      DETERMINISM_HASHES_SEED_A
    );
    expect(playCombat(DETERMINISM_SEED_B).hashes).toEqual(
      DETERMINISM_HASHES_SEED_B
    );
    // A different seed threads a different RNG stream ⇒ a divergent progression.
    expect(DETERMINISM_HASHES_SEED_A).not.toEqual(DETERMINISM_HASHES_SEED_B);
  });

  it("the field rng progression is itself deterministic for the same seed (whole-slice replay)", () => {
    // The field reducer is seed-deterministic too, so the WHOLE slice — field
    // exploration plus combat — replays identically under the same seed.
    expect(exploreToRoomC(FIXED_SEED).rngState).toBe(
      exploreToRoomC(FIXED_SEED).rngState
    );
    expect(exploreToRoomC(DETERMINISM_SEED_A).rngState).not.toBe(
      exploreToRoomC(DETERMINISM_SEED_B).rngState
    );
  });
});
