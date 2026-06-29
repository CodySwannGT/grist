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
