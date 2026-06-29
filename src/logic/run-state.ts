/**
 * The pure slice run-state — the cross-scene progression the Field↔Battle leg
 * threads between fights (sub-task #82): the shared grist {@link GristWallet}
 * (composed from `logic/grist`, not re-implemented), the acquired {@link BoundId}
 * shards, and the pending free-vs-wield choice a fresh shard surfaces. The single
 * pure transform {@link applyBattleResult} folds a {@link BattleResult} into the
 * run when the Field consumes a battle: a win credits the wallet and, for a boss
 * drop, acquires the shard and raises the choice trigger; a loss is a no-op.
 *
 * Zero Phaser, no I/O, no RNG — a total function of the prior run + result — so
 * the run progression is deterministic and unit-testable headless. The Phaser
 * adapter holds this in a typed wrapper over the scene registry; this module owns
 * the rules, the wrapper owns the storage.
 * @module logic/run-state
 */
import { type BoundId } from "../content/bounds";
import { BattleOutcomes, type BattleResult } from "./battle-result";
import { earnGrist, newWallet, type GristWallet } from "./grist";

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
}

/**
 * Build a fresh run at the slice starting grist with no shards and no pending
 * choice. Pure — reads nothing ambient.
 * @returns The initial run state.
 */
export function newRunState(): RunState {
  return { wallet: newWallet(), shards: [], pendingChoiceShard: null };
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
    wallet,
    shards: [...run.shards, newShard],
    pendingChoiceShard: newShard,
  };
}
