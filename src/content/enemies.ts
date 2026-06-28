/**
 * Enemy definitions for the vertical slice ("The Bound in the Marrow") as a typed
 * TS-module table. HP, per-element weakness multipliers, and loot-grist are
 * authoritative from the vertical-slice-build; the remaining stats are first-pass
 * placeholders scaled to each enemy's role. Pure data — no Phaser.
 * @module content/enemies
 */
import { type ElementId, type Stats } from "../logic/combat";

/**
 * An enemy definition. `elements` maps an element to its damage multiplier
 * (1.5 = weak, 0.5 = resist, 0 = immune); an omitted element is normal (×1).
 * `ai` is the behavior-profile id the sim will dispatch on; `lootGrist` is the
 * grist awarded on defeat.
 */
export interface EnemyDef {
  readonly id: string;
  readonly name: string;
  readonly stats: Stats;
  readonly elements: Partial<Record<ElementId, number>>;
  readonly ai: string;
  readonly lootGrist: number;
}

/** Canonical enemy ids. */
export const EnemyIds = {
  marrowScrapper: "marrow-scrapper",
  renderConstruct: "render-construct",
  theAshling: "the-ashling",
} as const;

/** An enemy id (the literal-union of every defined enemy key). */
export type EnemyId = (typeof EnemyIds)[keyof typeof EnemyIds];

/**
 * The slice enemy roster. Keys are {@link EnemyId}s. Non-HP stats are first-pass.
 */
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  "marrow-scrapper": {
    id: EnemyIds.marrowScrapper,
    name: "Marrow scrapper",
    stats: { hp: 40, ap: 0, pow: 8, foc: 0, def: 4, wrd: 2, spd: 8, lck: 2 },
    elements: {},
    ai: "tempo",
    lootGrist: 6,
  },
  "render-construct": {
    id: EnemyIds.renderConstruct,
    name: "Render-construct",
    stats: { hp: 70, ap: 6, pow: 6, foc: 10, def: 8, wrd: 6, spd: 7, lck: 4 },
    elements: { flux: 1.5 },
    ai: "render-pressure",
    lootGrist: 10,
  },
  "the-ashling": {
    id: EnemyIds.theAshling,
    name: "The Ashling",
    stats: {
      hp: 220,
      ap: 20,
      pow: 16,
      foc: 18,
      def: 14,
      wrd: 12,
      spd: 10,
      lck: 8,
    },
    elements: { flux: 1.5 },
    ai: "break-boss",
    lootGrist: 20,
  },
};
