/**
 * Bench-sink definitions for the vertical slice ("The Bound in the Marrow") as a
 * typed TS-module table. The bench is the out-of-battle grist sink (FR7 / the
 * economy-spec): the party spends the shared grist pool on permanent stat
 * augments and on accelerating a shard's spell unlock. Grist costs are
 * authoritative from the vertical-slice-build. Pure data — no Phaser.
 * @module content/bench
 */
import { type Stats } from "../logic/combat/types";
import { SpellIds, type SpellId } from "./spells";

/**
 * A bench sink: a one-time, grist-costed purchase made outside battle. Exactly
 * one of `statBonus` (a permanent stat augment) or `teaches` (accelerate a
 * shard spell unlock) is present — the sink either grows a combatant or speeds a
 * Craft unlock, never both.
 */
export interface BenchSinkDef {
  readonly id: BenchSinkId;
  readonly name: string;
  readonly gristCost: number;
  readonly statBonus?: Partial<Stats>;
  readonly teaches?: SpellId;
}

/** Canonical bench-sink ids. */
export const BenchSinkIds = {
  runnersReflex: "runners-reflex",
  accelerateCinder: "accelerate-cinder",
} as const;

/** A bench-sink id (the literal-union of every defined bench key). */
export type BenchSinkId = (typeof BenchSinkIds)[keyof typeof BenchSinkIds];

/**
 * The slice bench sinks. The mapped type binds each entry's `id` to its table
 * key, so the key and the `id` can never drift. Runner's Reflex is the +2 SPD
 * stat augment; accelerate-Cinder buys an early Cinder unlock off the Ashling
 * shard.
 */
export const BENCH_SINKS: {
  readonly [K in BenchSinkId]: BenchSinkDef & { readonly id: K };
} = {
  "runners-reflex": {
    id: BenchSinkIds.runnersReflex,
    name: "Runner's Reflex",
    gristCost: 25,
    statBonus: { spd: 2 },
  },
  "accelerate-cinder": {
    id: BenchSinkIds.accelerateCinder,
    name: "Accelerate: Cinder",
    gristCost: 20,
    teaches: SpellIds.cinder,
  },
};
