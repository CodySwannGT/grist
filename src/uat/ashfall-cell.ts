/**
 * The verification bridge's **Ashfall enemy-variant + harsher-economy cell** (#141)
 * — a stateless reader over the pure `content/enemy-variants` and `content/economy`
 * resolvers, so the Ashfall e2e can observe, scene-agnostically and through the live
 * world-state flag, (a) a recurring encounter enemy resolve to its warped Ashfall
 * variant (drained palette + entropy/Gloom attack) once the Reckoning fires, and
 * (b) the Act II economy tighten (leaner rewards, harsher costs) versus the Act I
 * baseline. The cell holds NO state and re-implements NO rules: it reads the same
 * shipped content resolvers the game consumes and folds the result into an
 * assertable snapshot with a stable determinism digest — the scene-agnostic
 * analogue of the battle state-hash gate, mirroring `uat/enemy-cell.ts` and
 * `uat/world-map-cell.ts`. Zero Phaser, no I/O, no RNG.
 * @module uat/ashfall-cell
 */
import {
  EnemyIds,
  applyEconomyCost,
  applyEconomyReward,
  resolveEconomyProfile,
  resolveEncounterEnemy,
  type EnemyId,
} from "../content";
import { isAshfall, type WorldState } from "../logic/world";

/**
 * The recurring Marrow-descent enemy the cell reads through the flag: `marrow-scrapper`
 * rolls in `the-drip`, which sits in the Marrow **Ashfall** encounter table, so it is
 * a genuine Act II encounter foe whose warp the e2e can observe.
 */
const SAMPLE_ENEMY: EnemyId = EnemyIds.marrowScrapper;

/** A neutral base earn the economy read scales, so the e2e can compare Act I vs Ashfall payout. */
const SAMPLE_BASE_REWARD = 10;

/** A neutral base sink the economy read scales, so the e2e can compare Act I vs Ashfall cost. */
const SAMPLE_BASE_COST = 10;

/**
 * A read-only snapshot of a recurring encounter enemy resolved through a world-state
 * — the shape the Ashfall-variant e2e asserts on. `isAshfall` distinguishes the
 * warped read from the base read; `drainedPalette` and `gloomAttacks` are populated
 * only in Ashfall, so the e2e proves the variant differs across the flip.
 */
export interface VerifyAshfallEnemyState {
  readonly baseId: EnemyId;
  readonly ref: EnemyId;
  readonly name: string;
  readonly worldState: WorldState;
  readonly isAshfall: boolean;
  readonly lootGrist: number;
  readonly drainedPalette: string | null;
  readonly gloomAttacks: readonly string[];
  /** A stable digest of the resolved enemy read for the determinism gate. */
  readonly hash: string;
}

/**
 * A read-only snapshot of the two-world-state economy resolved through a world-state
 * — the shape the harsher-economy e2e asserts on. Carries the resolved multipliers
 * and a worked example (`sampleReward` scaled from {@link SAMPLE_BASE_REWARD},
 * `sampleCost` from {@link SAMPLE_BASE_COST}), so the e2e proves Ashfall pays leaner
 * and costs harsher than the Act I baseline.
 */
export interface VerifyAshfallEconomyState {
  readonly worldState: WorldState;
  readonly isAshfall: boolean;
  readonly rewardMultiplier: number;
  readonly costMultiplier: number;
  readonly baseReward: number;
  readonly sampleReward: number;
  readonly baseCost: number;
  readonly sampleCost: number;
  /** A stable digest of the resolved economy read for the determinism gate. */
  readonly hash: string;
}

/**
 * Stable FNV-1a digest of a canonical struct — the determinism digest both snapshots
 * expose. Same world-state ⇒ identical digest, so the e2e can assert reproducibility
 * across a genuine reload without a battle scene. Pure: a total function of its input.
 * @param canonical - The canonical JSON string to digest.
 * @returns An 8-char hex digest.
 */
function fnv1a(canonical: string): string {
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 0x01000193),
    0x811c9dc5
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}

/**
 * The bridge-held Ashfall cell: a stateless reader that resolves the sample encounter
 * enemy and the economy through a world-state. No held state — every read is a total
 * function of the passed world-state and the shipped content tables.
 */
export class AshfallCell {
  /**
   * A snapshot of the sample recurring encounter enemy resolved through `state`: its
   * base read before the Reckoning (no drained palette / no Gloom attacks) and its
   * warped Ashfall variant after (drained palette + ≥1 entropy/Gloom attack). Lets
   * the e2e prove an encounter enemy warps across the flip.
   * @param state - The world-state to resolve the enemy through.
   * @returns The resolved-enemy snapshot.
   */
  enemy(state: WorldState): VerifyAshfallEnemyState {
    const resolved = resolveEncounterEnemy(SAMPLE_ENEMY, state);
    const gloomAttacks = resolved.gloomAttacks.map(attack => attack.id);
    const canonical = JSON.stringify({
      baseId: resolved.baseId,
      state,
      isAshfall: resolved.isAshfall,
      lootGrist: resolved.lootGrist,
      stats: resolved.stats,
      elements: Object.entries(resolved.elements).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
      ),
      drainedPalette: resolved.drainedPalette,
      gloomAttacks,
    });
    return {
      baseId: resolved.baseId,
      ref: resolved.ref,
      name: resolved.name,
      worldState: state,
      isAshfall: resolved.isAshfall,
      lootGrist: resolved.lootGrist,
      drainedPalette: resolved.drainedPalette,
      gloomAttacks,
      hash: fnv1a(canonical),
    };
  }

  /**
   * A snapshot of the two-world-state economy resolved through `state`: the neutral
   * Act I baseline (1×/1×) before the Reckoning and the tightened Ashfall read after
   * (leaner rewards, harsher costs), with a worked reward/cost example. Lets the e2e
   * prove the harsher Act II economy applies versus the Act I baseline.
   * @param state - The world-state to resolve the economy through.
   * @returns The resolved-economy snapshot.
   */
  economy(state: WorldState): VerifyAshfallEconomyState {
    const profile = resolveEconomyProfile(state);
    const sampleReward = applyEconomyReward(SAMPLE_BASE_REWARD, state);
    const sampleCost = applyEconomyCost(SAMPLE_BASE_COST, state);
    const canonical = JSON.stringify({
      state,
      rewardMultiplier: profile.rewardMultiplier,
      costMultiplier: profile.costMultiplier,
      sampleReward,
      sampleCost,
    });
    return {
      worldState: state,
      isAshfall: isAshfall(state),
      rewardMultiplier: profile.rewardMultiplier,
      costMultiplier: profile.costMultiplier,
      baseReward: SAMPLE_BASE_REWARD,
      sampleReward,
      baseCost: SAMPLE_BASE_COST,
      sampleCost,
      hash: fnv1a(canonical),
    };
  }
}
