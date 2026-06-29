/**
 * Unit suite for the pure run-state reducer (`src/logic/run-state`): the slice's
 * cross-scene run progression — the shared grist wallet, the acquired shards, and
 * the pending free-vs-wield choice — and the pure transform that folds a
 * {@link BattleResult} into it when the Field consumes a battle. Pure data-in/
 * data-out (it composes the grist wallet), so the whole accumulation contract is
 * asserted headless with no Phaser.
 */
import { describe, expect, it } from "vitest";
import { BoundIds } from "../../src/content/bounds";
import { GristTuning } from "../../src/logic/grist";
import {
  BattleOutcomes,
  type BattleResult,
} from "../../src/logic/battle-result";
import { applyBattleResult, newRunState } from "../../src/logic/run-state";

const WIN_NO_SHARD: BattleResult = {
  outcome: BattleOutcomes.win,
  gristGained: 16,
  shard: null,
  choiceTriggered: false,
};
const LOSE: BattleResult = {
  outcome: BattleOutcomes.lose,
  gristGained: 0,
  shard: null,
  choiceTriggered: false,
};
const WIN_BOSS: BattleResult = {
  outcome: BattleOutcomes.win,
  gristGained: 20,
  shard: BoundIds.marrowBound,
  choiceTriggered: true,
};

describe("newRunState", () => {
  it("starts at the slice starting grist with no shards and no pending choice", () => {
    const run = newRunState();
    expect(run.wallet.grist).toBe(GristTuning.startingGrist);
    expect(run.shards).toEqual([]);
    expect(run.pendingChoiceShard).toBeNull();
  });
});

describe("applyBattleResult", () => {
  it("credits the wallet with grist gained on a win", () => {
    const run = applyBattleResult(newRunState(), WIN_NO_SHARD);
    expect(run.wallet.grist).toBe(GristTuning.startingGrist + 16);
    expect(run.shards).toEqual([]);
    expect(run.pendingChoiceShard).toBeNull();
  });

  it("leaves the run untouched on a loss (no grist, no shard, no choice)", () => {
    const start = newRunState();
    const run = applyBattleResult(start, LOSE);
    expect(run.wallet.grist).toBe(GristTuning.startingGrist);
    expect(run.shards).toEqual([]);
    expect(run.pendingChoiceShard).toBeNull();
  });

  it("acquires the shard and surfaces the pending choice on a boss win", () => {
    const run = applyBattleResult(newRunState(), WIN_BOSS);
    expect(run.wallet.grist).toBe(GristTuning.startingGrist + 20);
    expect(run.shards).toEqual([BoundIds.marrowBound]);
    expect(run.pendingChoiceShard).toBe(BoundIds.marrowBound);
  });

  it("accumulates across multiple consumed battles", () => {
    const run = applyBattleResult(
      applyBattleResult(newRunState(), WIN_NO_SHARD),
      WIN_BOSS
    );
    expect(run.wallet.grist).toBe(GristTuning.startingGrist + 16 + 20);
    expect(run.shards).toEqual([BoundIds.marrowBound]);
  });

  it("does not double-acquire a shard already held", () => {
    const once = applyBattleResult(newRunState(), WIN_BOSS);
    const twice = applyBattleResult(once, WIN_BOSS);
    expect(twice.shards).toEqual([BoundIds.marrowBound]);
  });
});
