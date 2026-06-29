/**
 * Pure battle-result extraction — the consume side of the Field↔Battle leg of the
 * scene machine (sub-task #82). Given the terminal {@link BattleState} an
 * encounter resolved to and the {@link EncounterDef} that ran, it derives the
 * four observable outcomes the Field consumes on return: the win/lose
 * {@link BattleOutcome}, the grist gained (the battle pool on a win, nothing on a
 * loss), the {@link BoundId} shard acquired (a boss encounter's `shardReward`,
 * only on a win), and whether that acquisition surfaces the free-vs-wield choice
 * trigger (consumed by #75). Reuses the Phase-1 sim's terminal-phase predicates —
 * it authors no combat rules. Zero Phaser, no I/O, no RNG: a total function of
 * the state + encounter, so the Field's result-consumption is unit-testable
 * headless and deterministic.
 * @module logic/battle-result
 */
import { ENEMIES, type EnemyId } from "../content/enemies";
import { type BoundId } from "../content/bounds";
import { type EncounterDef } from "../content/encounters";
import { isResolved, isVictory, type BattleState } from "./combat";

/**
 * The terminal outcome of a battle from the Field's perspective: the party either
 * won (every enemy down, party survived) or lost (party wiped). A mutual wipe is
 * a loss — this mirrors the sim's {@link isVictory}/{@link isDefeat} dominance.
 */
export const BattleOutcomes = {
  win: "win",
  lose: "lose",
} as const;

/** A battle outcome id (`"win" | "lose"`). */
export type BattleOutcome =
  (typeof BattleOutcomes)[keyof typeof BattleOutcomes];

/**
 * The consumable result of one encounter the Field threads back into the run:
 * the win/lose outcome, the grist the fight yielded, the shard it dropped (or
 * null), and whether a shard acquisition surfaced the free-vs-wield choice.
 * Plain, serializable data — no object identity, no Phaser.
 */
export interface BattleResult {
  /** Whether the party won or lost the encounter. */
  readonly outcome: BattleOutcome;
  /** The grist gained — the battle pool on a win, 0 on a loss. */
  readonly gristGained: number;
  /** The Bound shard acquired on a winning boss fight, or null. */
  readonly shard: BoundId | null;
  /**
   * Whether a shard acquisition surfaced the free-vs-wield choice trigger. True
   * exactly when {@link shard} is non-null; the resolution of that choice is the
   * job of #75 (this leg only surfaces the trigger).
   */
  readonly choiceTriggered: boolean;
}

/**
 * The Bound shard an encounter drops on victory: the `shardReward` of the first
 * enemy in its lineup that carries one (the slice's only shard-dropper is the
 * Ashling boss). Returns null when no enemy in the encounter drops a shard.
 * @param encounter - The encounter that ran.
 * @returns The dropped shard id, or null.
 */
function shardRewardFor(encounter: EncounterDef): BoundId | null {
  for (const enemyId of encounter.enemies) {
    const shard = ENEMIES[enemyId as EnemyId]?.shardReward;
    if (shard) {
      return shard;
    }
  }
  return null;
}

/**
 * Extract the Field-consumable {@link BattleResult} from a resolved battle, or
 * `null` while the battle is still live ({@link isResolved} false) — the Field
 * only consumes a result once the fight has terminated. On a win the grist gained
 * is the battle's accumulated pool ({@link BattleState.grist}) and the encounter's
 * shard reward (if any) is acquired, which surfaces the free-vs-wield choice; on
 * a loss nothing is granted. Pure: reads only the passed state + encounter.
 * @param state - The (resolved) battle state to consume.
 * @param encounter - The encounter definition that ran.
 * @returns The consumable result, or null when the battle has not resolved.
 */
export function extractBattleResult(
  state: BattleState,
  encounter: EncounterDef
): BattleResult | null {
  if (!isResolved(state)) {
    return null;
  }
  const won = isVictory(state);
  if (!won) {
    return {
      outcome: BattleOutcomes.lose,
      gristGained: 0,
      shard: null,
      choiceTriggered: false,
    };
  }
  const shard = shardRewardFor(encounter);
  return {
    outcome: BattleOutcomes.win,
    gristGained: state.grist,
    shard,
    choiceTriggered: shard !== null,
  };
}
