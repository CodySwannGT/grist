/**
 * The pure slice run-state — the cross-scene progression the Field↔Battle leg
 * threads between fights (sub-task #82): the shared grist {@link GristWallet}
 * (composed from `logic/grist`, not re-implemented), the acquired {@link BoundId}
 * shards, the pending free-vs-wield choice a fresh shard surfaces, the
 * {@link LearningState} a shard's spells advance through (composed from
 * `logic/spell-learning`), and the {@link Stats} bonuses the bench grows the build
 * with. The pure transform {@link applyBattleResult} folds a {@link BattleResult}
 * into the run when the Field consumes a battle: a win credits the wallet and, for
 * a boss drop, acquires the shard and raises the choice trigger; a loss is a no-op.
 *
 * The growth/bench leg (sub-task #86) adds two more pure transforms the Bench
 * scene drives — {@link equipShardAtBench} begins a shard's learning, and
 * {@link applyBenchSink} spends grist on a sink to change the build (a stat augment
 * or a learning acceleration). The Bench scene holds none of these rules: it reads
 * this state and emits these actions, satisfying the "sim-authoritative" AC.
 *
 * Zero Phaser, no I/O, no RNG — every transform is a total function of its inputs —
 * so the run progression is deterministic and unit-testable headless. The Phaser
 * adapter holds this in a typed wrapper over the scene registry; this module owns
 * the rules, the wrapper owns the storage.
 * @module logic/run-state
 */
import { type BoundId } from "../content/bounds";
import { BENCH_SINKS, type BenchSinkId } from "../content/bench";
import { type Stats } from "./combat/types";
import { BattleOutcomes, type BattleResult } from "./battle-result";
import {
  canSpendGrist,
  earnGrist,
  newWallet,
  spendGrist,
  type GristWallet,
} from "./grist";
import {
  accelerateLearning,
  equipShard,
  isLearning,
  newLearningState,
  type LearningState,
} from "./spell-learning";

/**
 * The full run progression carried across the Field↔Battle scene transition: the
 * shared grist pool, the shards acquired so far, and the shard whose free-vs-wield
 * choice is awaiting resolution (null when none is pending). Immutable — the
 * reducer returns fresh state.
 */
export interface RunState {
  /** The shared party grist wallet (funds Binds + bench sinks). */
  readonly wallet: GristWallet;
  /** The Bound shards acquired this run, in acquisition order. */
  readonly shards: readonly BoundId[];
  /**
   * The shard whose free-vs-wield choice the Field has surfaced but not yet
   * resolved, or null when no choice is pending. #75 consumes and clears this.
   */
  readonly pendingChoiceShard: BoundId | null;
  /**
   * The spell-learning progression for the run's equipped shards — the spells
   * permanently learned and the spells in progress (composed from
   * `logic/spell-learning`). The bench equips shards into this and accelerates
   * the spells in progress.
   */
  readonly learning: LearningState;
  /**
   * The permanent stat augments the bench has bought into the build (the
   * "spend grist → change the build" half of AC6). A partial {@link Stats} delta
   * applied on top of base stats; only the bonused axes are present.
   */
  readonly statBonuses: Partial<Stats>;
}

/**
 * The outcome of a bench-sink purchase. `ok` is false on a rejected spend (the
 * wallet cannot cover the cost, or the sink's effect cannot apply — e.g.
 * accelerating a spell that is not in progress); on rejection `run` is the same
 * input object (structural sharing — no debt, no partial apply).
 */
export interface BenchSinkResult {
  /** Whether the purchase was made. */
  readonly ok: boolean;
  /** The run after the purchase — the same object when `ok` is false. */
  readonly run: RunState;
}

/**
 * Build a fresh run at the slice starting grist: no shards, no pending choice, an
 * empty learning state, and no stat bonuses. Pure — reads nothing ambient.
 * @returns The initial run state.
 */
export function newRunState(): RunState {
  return {
    wallet: newWallet(),
    shards: [],
    pendingChoiceShard: null,
    learning: newLearningState(),
    statBonuses: {},
  };
}

/**
 * Fold a consumed {@link BattleResult} into the run. A loss is a no-op (the same
 * state object — no grist, no shard, no choice). A win credits the grist gained
 * to the shared wallet; if the fight dropped a shard the party does not already
 * hold, it is appended and its free-vs-wield choice is surfaced as pending (the
 * trigger #75 consumes). Re-winning a fight whose shard is already held neither
 * duplicates the shard nor re-raises the choice. Pure — returns fresh state.
 * @param run - The current run state (never mutated).
 * @param result - The battle result the Field is consuming.
 * @returns The next run state.
 */
export function applyBattleResult(
  run: RunState,
  result: BattleResult
): RunState {
  if (result.outcome === BattleOutcomes.lose) {
    return run;
  }
  const wallet = earnGrist(run.wallet, result.gristGained);
  const newShard =
    result.shard !== null && !run.shards.includes(result.shard)
      ? result.shard
      : null;
  if (newShard === null) {
    return { ...run, wallet };
  }
  return {
    ...run,
    wallet,
    shards: [...run.shards, newShard],
    pendingChoiceShard: newShard,
  };
}

/**
 * Equip a shard at the bench: record it on the run (without re-acquiring one the
 * party already holds) and begin learning every spell it teaches via the pure
 * {@link equipShard} reducer (AC: "equip the Ashling shard → learning Cinder
 * begins"). Equipping is free — it never touches the wallet. Pure — returns fresh
 * state (or the same object when nothing changed: shard already held and its
 * spells already begun).
 * @param run - The current run state (never mutated).
 * @param shard - The shard being equipped.
 * @returns The run with the shard recorded and its learning begun.
 */
export function equipShardAtBench(run: RunState, shard: BoundId): RunState {
  const learning = equipShard(run.learning, shard);
  const shards = run.shards.includes(shard)
    ? run.shards
    : [...run.shards, shard];
  if (learning === run.learning && shards === run.shards) {
    return run;
  }
  return { ...run, learning, shards };
}

/**
 * Spend grist on a bench sink and change the build (AC6). The wallet is drawn down
 * by the sink's grist cost (composing the pure {@link spendGrist}) and the sink's
 * effect is applied: a `statBonus` sink accumulates its stat delta onto the run's
 * {@link RunState.statBonuses} (Runner's Reflex → +2 SPD); a `teaches` sink
 * accelerates that spell's learning (Accelerate: Cinder → faster unlock). The
 * spend is all-or-nothing: it is rejected (`ok: false`, the same run object
 * returned) when the wallet cannot cover the cost, or when a `teaches` sink names
 * a spell that is not currently in progress (nothing to accelerate). Pure —
 * returns fresh state on success, never mutating the input.
 * @param run - The current run state (never mutated).
 * @param sinkId - The bench sink being purchased.
 * @returns The purchase result: whether it was made and the resulting run.
 */
export function applyBenchSink(
  run: RunState,
  sinkId: BenchSinkId
): BenchSinkResult {
  const sink = BENCH_SINKS[sinkId];
  // Reject a teach-sink whose spell is not in progress *before* drawing down, so
  // an un-equipped accelerate never spends grist for a no-op.
  if (sink.teaches !== undefined && !isLearning(run.learning, sink.teaches)) {
    return { ok: false, run };
  }
  if (!canSpendGrist(run.wallet, sink.gristCost)) {
    return { ok: false, run };
  }
  const spend = spendGrist(run.wallet, sink.gristCost);
  if (!spend.ok) {
    return { ok: false, run };
  }
  const learning =
    sink.teaches !== undefined
      ? accelerateLearning(run.learning, sink.teaches)
      : run.learning;
  const statBonuses =
    sink.statBonus !== undefined
      ? mergeStatBonuses(run.statBonuses, sink.statBonus)
      : run.statBonuses;
  return {
    ok: true,
    run: { ...run, wallet: spend.wallet, learning, statBonuses },
  };
}

/**
 * Add a sink's stat delta onto the run's accumulated stat bonuses, summing each
 * bonused axis (so repeated purchases stack). Pure — returns a fresh partial
 * {@link Stats}, never mutating either input.
 * @param current - The run's accumulated stat bonuses.
 * @param delta - The sink's stat delta to add.
 * @returns The merged stat bonuses.
 */
function mergeStatBonuses(
  current: Partial<Stats>,
  delta: Partial<Stats>
): Partial<Stats> {
  return (Object.keys(delta) as (keyof Stats)[]).reduce<Partial<Stats>>(
    (acc, axis) => ({
      ...acc,
      [axis]: (acc[axis] ?? 0) + (delta[axis] ?? 0),
    }),
    current
  );
}
