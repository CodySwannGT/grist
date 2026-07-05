/**
 * The slice economy table ("The Bound in the Marrow") as a typed TS-module: the
 * starting grist balance plus every authored earn source across the descent. The
 * shared-pool wallet mechanics live in `src/logic/grist`; this module is the
 * content side — *what fills the pool* (FR7 / the economy-spec /
 * vertical-slice-build numbers). Per-enemy gains mirror each enemy's `lootGrist`
 * so the single source of truth stays the enemy table; the salvage cache is the
 * only off-enemy source. First-pass numbers; pure data — no Phaser.
 * @module content/economy
 */
import { GristTuning } from "../logic/grist";
import {
  resolveByWorldState,
  type WorldState,
  type WorldStateResolver,
} from "../logic/world";
import { ENEMIES, EnemyIds } from "./enemies";

/**
 * Slice economy tuning. `startingGrist` re-exports the wallet's starting balance
 * so the content layer and the wallet can never disagree (the AC asserts 10).
 */
export const SLICE_ECONOMY = {
  /** Grist the party holds at the start of the slice. */
  startingGrist: GristTuning.startingGrist,
} as const;

/**
 * A single grist earn source: a named event in the slice that credits the
 * shared pool. `grist` is the whole-grist gain.
 */
export interface SliceEarnSource {
  readonly id: SliceEarnSourceId;
  readonly name: string;
  readonly grist: number;
}

/** Canonical earn-source ids. */
export const SliceEarnSourceIds = {
  scrapper: "scrapper",
  vesper: "vesper",
  salvageCache: "salvage-cache",
  ashling: "ashling",
} as const;

/** An earn-source id (the literal-union of every defined source key). */
export type SliceEarnSourceId =
  (typeof SliceEarnSourceIds)[keyof typeof SliceEarnSourceIds];

/**
 * The slice earn table: start 10, earn 6 / 10 / 12 / 20. The three enemy-loot
 * gains are read from the enemy table (so they can never drift from each
 * enemy's `lootGrist`); the salvage cache (12) is the lone off-enemy source.
 * The mapped type binds each entry's `id` to its table key.
 */
export const SLICE_EARN: {
  readonly [K in SliceEarnSourceId]: SliceEarnSource & { readonly id: K };
} = {
  scrapper: {
    id: SliceEarnSourceIds.scrapper,
    name: "Marrow scrapper loot",
    grist: ENEMIES[EnemyIds.marrowScrapper].lootGrist,
  },
  vesper: {
    id: SliceEarnSourceIds.vesper,
    name: "Vesper loot",
    grist: ENEMIES[EnemyIds.renderConstruct].lootGrist,
  },
  "salvage-cache": {
    id: SliceEarnSourceIds.salvageCache,
    name: "Salvage cache (The Drip)",
    grist: 12,
  },
  ashling: {
    id: SliceEarnSourceIds.ashling,
    name: "The Ashling loot",
    grist: ENEMIES[EnemyIds.theAshling].lootGrist,
  },
};

// ───────────────────────────────────────────────────────────────────────────
// The two-world-state economy (#141, PRD #43 FR6 / economy-spec "Two-world-state
// economy")
// ───────────────────────────────────────────────────────────────────────────
//
// After the Reckoning, Ashfall **tightens the economy**: grist is scarcer (earns
// pay LEANER) and survival costs MORE (sinks/services strain as the Weave gutters) —
// "the same systems, mourned" (economy-spec). The dial is a pair of multipliers
// resolved through the live world-state flag (`logic/world`, #134), applied over the
// existing earn/sink numbers rather than re-authoring every table twice: the same
// authored economy reads harsher the instant the world turns, with no per-call-site
// branching. First-pass constants (decision 0003): the RATIO (leaner rewards, harsher
// costs) is the design; the exact factors tune against the prototype.

/**
 * The economy multipliers for one world-state: how much of an earn actually pays out
 * (`rewardMultiplier`, ≤ 1 tightens income) and how much a sink actually costs
 * (`costMultiplier`, ≥ 1 tightens spending). Act I `reach` is the neutral baseline
 * (1×/1×); Act II `ashfall` is the harsher read.
 */
export interface EconomyProfile {
  /** The fraction of an earn that pays out (1 = neutral; < 1 = leaner Ashfall income). */
  readonly rewardMultiplier: number;
  /** The multiple a sink actually costs (1 = neutral; > 1 = harsher Ashfall costs). */
  readonly costMultiplier: number;
}

/**
 * The per-world-state economy profiles as a {@link WorldStateResolver} pair. `reach`
 * is the neutral Act I baseline; `ashfall` is the tightened Act II read — rewards
 * pay 60% (leaner) and costs run 1.5× (harsher). Reuses the resolver shape from
 * `logic/world` so the economy reads through the flag with the same machinery
 * regions / enemies use.
 */
export const ECONOMY_PROFILES: WorldStateResolver<EconomyProfile> = {
  reach: { rewardMultiplier: 1, costMultiplier: 1 },
  ashfall: { rewardMultiplier: 0.6, costMultiplier: 1.5 },
};

/**
 * Resolve the {@link EconomyProfile} for the current world-state — read *through* the
 * flag. The neutral Reach baseline before the Reckoning, the tightened Ashfall
 * profile after. Pure — delegates to {@link resolveByWorldState}.
 * @param state - The current world-state.
 * @returns The economy profile for `state`.
 */
export function resolveEconomyProfile(state: WorldState): EconomyProfile {
  return resolveByWorldState(state, ECONOMY_PROFILES);
}

/**
 * Apply the world-state reward multiplier to a base earn — the LEANER-income half of
 * the harsher Act II economy. Whole grist: the scaled reward truncates toward zero
 * (Ashfall pays less, never more), so a positive earn pays strictly less in Ashfall
 * than in Reach (and a base of 0 stays 0). Pure.
 * @param baseGrist - The neutral (Reach) earn amount.
 * @param state - The current world-state.
 * @returns The earn actually paid out in `state` (whole grist).
 */
export function applyEconomyReward(
  baseGrist: number,
  state: WorldState
): number {
  const { rewardMultiplier } = resolveEconomyProfile(state);
  return Math.max(0, Math.trunc(baseGrist * rewardMultiplier));
}

/**
 * Apply the world-state cost multiplier to a base sink — the HARSHER-cost half of the
 * harsher Act II economy. Whole grist: the scaled cost rounds UP (Ashfall costs more,
 * never less), so a positive cost is strictly higher in Ashfall than in Reach (and a
 * base of 0 stays 0). Pure.
 * @param baseCost - The neutral (Reach) sink cost.
 * @param state - The current world-state.
 * @returns The cost actually charged in `state` (whole grist).
 */
export function applyEconomyCost(baseCost: number, state: WorldState): number {
  const { costMultiplier } = resolveEconomyProfile(state);
  return Math.max(0, Math.ceil(baseCost * costMultiplier));
}
