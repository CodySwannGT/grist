/**
 * Pure enemy-telegraph derivation: which enemy is about to act, and the action it
 * will take, so the HUD can warn the player *before* the blow lands (PD-3.8
 * "telegraphs"). It is a read-only projection of the live {@link BattleState} —
 * it consults the same SPD-ordered ATB gauges the engine fills and the same
 * deterministic enemy AI ({@link import("./ai").resolveEnemyTurns}, a Strike at
 * the front party member), so the telegraph can never disagree with what the
 * enemy actually does. No Phaser, no RNG, no I/O — it unit-tests headless and the
 * HUD stays a thin renderer.
 *
 * A telegraph appears only once an enemy has charged past a warn threshold (so
 * the HUD does not flicker an intent the instant a fight opens) and always points
 * at the living enemy closest to its turn (highest ATB), exposing a 0→1 charge
 * ratio the HUD fills as a telegraph meter.
 * @module logic/combat/telegraph
 */
import { AtbTuning } from "./engine";
import {
  ActionKinds,
  type ActionKind,
  type BattleState,
  type Combatant,
} from "./types";

/** Telegraph tuning. `warnAtb` is the gauge value at which the intent surfaces. */
export const TelegraphTuning = {
  /** Show the telegraph once a living enemy's ATB reaches this (of `ready`=100). */
  warnAtb: 60,
} as const;

/** The enemy intent the HUD telegraphs: who acts next and what they will do. */
export interface EnemyTelegraph {
  /** The telegraphed enemy's index in {@link BattleState.enemies}. */
  readonly index: number;
  /** The action the deterministic AI will spend the turn on. */
  readonly kind: ActionKind;
  /** The 0→1 charge toward acting (ATB ÷ ready), for a telegraph meter fill. */
  readonly charge: number;
}

/** A living enemy paired with its index, for the closest-to-acting search. */
interface EnemyEntry {
  readonly index: number;
  readonly combatant: Combatant;
}

/**
 * Every living enemy with its index — the candidates a telegraph can point at.
 * @param state - The battle state.
 * @returns The living enemies, index-paired.
 */
function livingEnemies(state: BattleState): readonly EnemyEntry[] {
  return state.enemies.flatMap((combatant, index) =>
    combatant.hp > 0 ? [{ index, combatant }] : []
  );
}

/**
 * The living enemy closest to its turn — the highest ATB gauge — or null when no
 * enemy is alive. Ties keep the lower index (the deterministic, RNG-free choice).
 * @param entries - The living enemy entries.
 * @returns The most-charged living enemy, or null.
 */
function mostCharged(entries: readonly EnemyEntry[]): EnemyEntry | null {
  return entries.reduce<EnemyEntry | null>((best, entry) => {
    if (best === null || entry.combatant.atb > best.combatant.atb) {
      return entry;
    }
    return best;
  }, null);
}

/**
 * The enemy intent to telegraph for the live state: the living enemy closest to
 * acting, once it has charged past {@link TelegraphTuning.warnAtb}, with the
 * deterministic AI's action ({@link ActionKinds.strike}) and its 0→1 charge.
 * Returns null when no enemy is alive or none has charged enough to warn — the
 * HUD then shows no telegraph. Pure and total.
 * @param state - The live battle state.
 * @returns The enemy telegraph, or null.
 */
export function enemyTelegraph(state: BattleState): EnemyTelegraph | null {
  const next = mostCharged(livingEnemies(state));
  if (next === null || next.combatant.atb < TelegraphTuning.warnAtb) {
    return null;
  }
  return {
    index: next.index,
    kind: ActionKinds.strike,
    charge: Math.min(next.combatant.atb / AtbTuning.ready, 1),
  };
}
