/**
 * Unit suite for the pure bench reducer (`src/logic/bench`): the growth/bench
 * sink rules that sub-task #86's scene drives. Equipping the Ashling shard begins
 * its learning (composing `spell-learning`), and spending grist on a bench sink
 * draws the shared wallet down (composing `grist`) and changes the build — a stat
 * augment (Runner's Reflex → +2 SPD, recorded in the run's stat-bonus accumulator)
 * or a learning acceleration (Accelerate: Cinder → faster Cinder unlock). Every
 * rule lives here so the Bench scene stays a thin, sim-authoritative renderer
 * (AC: "the scene renders state and emits actions; it holds no economy/learning
 * rules"). Pure data-in/data-out, asserted headless with no Phaser.
 */
import { describe, expect, it } from "vitest";
import { BoundIds } from "../../src/content/bounds";
import { BenchSinkIds, BENCH_SINKS } from "../../src/content/bench";
import { SpellIds } from "../../src/content/spells";
import {
  BattleOutcomes,
  type BattleResult,
} from "../../src/logic/battle-result";
import { GristTuning } from "../../src/logic/grist";
import {
  isLearning,
  learningProgress,
  LearningTuning,
} from "../../src/logic/spell-learning";
import {
  applyBattleResult,
  applyBenchSink,
  equipShardAtBench,
  newRunState,
  type BenchSinkResult,
  type RunState,
} from "../../src/logic/run-state";

/**
 * Assert a {@link BenchSinkResult} was rejected and left the run untouched: `ok`
 * is false and the *same* run object is returned (structural sharing — no debt,
 * no partial apply). Anchors the public result contract.
 * @param result - The purchase result under test.
 * @param expectedRun - The run the rejection must hand back unchanged.
 */
function expectRejected(result: BenchSinkResult, expectedRun: RunState): void {
  expect(result.ok).toBe(false);
  expect(result.run).toBe(expectedRun);
}

/**
 * A run funded well above both sink costs, with the Ashling shard equipped (so
 * Cinder is in progress and accelerable).
 * @param grist - The wallet balance to seed (default 100).
 * @returns The funded, shard-equipped run.
 */
function fundedEquippedRun(grist = 100): RunState {
  return equipShardAtBench(
    { ...newRunState(), wallet: { grist } },
    BoundIds.marrowBound
  );
}

describe("newRunState — learning + stat-bonus fields", () => {
  it("starts with empty learning state and no stat bonuses", () => {
    const run = newRunState();
    expect(run.learning).toEqual({ learned: [], learning: [] });
    expect(run.statBonuses).toEqual({});
  });
});

describe("equipShardAtBench", () => {
  it("begins learning the spells the equipped shard teaches (Cinder)", () => {
    const run = equipShardAtBench(newRunState(), BoundIds.marrowBound);
    expect(isLearning(run.learning, SpellIds.cinder)).toBe(true);
    expect(learningProgress(run.learning, SpellIds.cinder)).toBe(0);
  });

  it("records the equipped shard on equippedShards, NOT the acquisition list", () => {
    const run = equipShardAtBench(newRunState(), BoundIds.marrowBound);
    expect(run.equippedShards).toContain(BoundIds.marrowBound);
    // Acquisition state is untouched — equip is not acquisition.
    expect(run.shards).toEqual([]);
  });

  it("does not re-equip a shard already equipped (idempotent)", () => {
    const once = equipShardAtBench(newRunState(), BoundIds.marrowBound);
    const twice = equipShardAtBench(once, BoundIds.marrowBound);
    expect(twice.equippedShards).toEqual([BoundIds.marrowBound]);
  });

  it("does NOT suppress a later real drop's pending-choice (regression)", () => {
    // Equip the Marrow shard at the bench first — this must not write the
    // acquisition list, or applyBattleResult would treat the subsequent boss
    // drop as already-owned and skip raising its free-vs-wield choice.
    const equipped = equipShardAtBench(newRunState(), BoundIds.marrowBound);
    expect(equipped.shards).toEqual([]);
    const bossDrop: BattleResult = {
      outcome: BattleOutcomes.win,
      gristGained: 20,
      shard: BoundIds.marrowBound,
      choiceTriggered: true,
    };
    const afterDrop = applyBattleResult(equipped, bossDrop);
    // The drop is correctly detected as new: acquired + choice surfaced.
    expect(afterDrop.shards).toEqual([BoundIds.marrowBound]);
    expect(afterDrop.pendingChoiceShard).toBe(BoundIds.marrowBound);
    // The learning the equip began survives the battle-result fold.
    expect(isLearning(afterDrop.learning, SpellIds.cinder)).toBe(true);
  });

  it("leaves the wallet untouched — equipping is free", () => {
    const run = equipShardAtBench(newRunState(), BoundIds.marrowBound);
    expect(run.wallet.grist).toBe(GristTuning.startingGrist);
  });
});

describe("applyBenchSink — Runner's Reflex (stat augment, AC6)", () => {
  const cost = BENCH_SINKS[BenchSinkIds.runnersReflex].gristCost;

  it("draws the wallet down by the sink cost and applies +2 SPD", () => {
    const start = fundedEquippedRun(100);
    const result = applyBenchSink(start, BenchSinkIds.runnersReflex);
    expect(result.ok).toBe(true);
    expect(result.run.wallet.grist).toBe(100 - cost);
    expect(result.run.statBonuses.spd).toBe(2);
  });

  it("accumulates SPD across repeated purchases", () => {
    const once = applyBenchSink(
      fundedEquippedRun(100),
      BenchSinkIds.runnersReflex
    );
    const twice = applyBenchSink(once.run, BenchSinkIds.runnersReflex);
    expect(twice.run.statBonuses.spd).toBe(4);
    expect(twice.run.wallet.grist).toBe(100 - cost * 2);
  });

  it("rejects the purchase when the wallet cannot cover the cost", () => {
    const start = fundedEquippedRun(cost - 1);
    const result = applyBenchSink(start, BenchSinkIds.runnersReflex);
    // Wallet untouched, build unchanged — no debt, no partial apply.
    expectRejected(result, start);
    expect(result.run.wallet.grist).toBe(cost - 1);
    expect(result.run.statBonuses.spd).toBeUndefined();
  });
});

describe("applyBenchSink — Accelerate: Cinder (learning, AC6)", () => {
  const cost = BENCH_SINKS[BenchSinkIds.accelerateCinder].gristCost;

  it("draws the wallet down and advances Cinder learning", () => {
    const start = fundedEquippedRun(100);
    const result = applyBenchSink(start, BenchSinkIds.accelerateCinder);
    expect(result.ok).toBe(true);
    expect(result.run.wallet.grist).toBe(100 - cost);
    // One accelerate grants acceleratePoints toward pointsToLearn.
    expect(learningProgress(result.run.learning, SpellIds.cinder)).toBeCloseTo(
      LearningTuning.acceleratePoints / LearningTuning.pointsToLearn
    );
  });

  it("rejects acceleration when Cinder is not in progress (no equip yet)", () => {
    // A funded run that never equipped the shard: Cinder is not in progress, so
    // there is nothing to accelerate — the spend must not draw down.
    const start: RunState = { ...newRunState(), wallet: { grist: 100 } };
    const result = applyBenchSink(start, BenchSinkIds.accelerateCinder);
    expectRejected(result, start);
    expect(result.run.wallet.grist).toBe(100);
  });

  it("rejects acceleration when the wallet cannot cover the cost", () => {
    const start = fundedEquippedRun(cost - 1);
    const result = applyBenchSink(start, BenchSinkIds.accelerateCinder);
    expectRejected(result, start);
    expect(result.run.wallet.grist).toBe(cost - 1);
  });
});

describe("applyBenchSink — sim-authoritative invariants", () => {
  it("never mutates the input run", () => {
    const start = fundedEquippedRun(100);
    const before = JSON.stringify(start);
    applyBenchSink(start, BenchSinkIds.runnersReflex);
    expect(JSON.stringify(start)).toBe(before);
  });
});
