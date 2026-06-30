/**
 * The registered enemy-family **data table** (`ENEMY_FAMILIES`) — the per-region,
 * both-world-state stat-block content authored against the family schema in
 * `./enemies` (#138). Split out of `enemies.ts` so the schema (the types,
 * validators, and the {@link resolveFamilyStatBlock} read-seam) and the authored
 * data live in separate modules: the schema is the framework, this table is the
 * content that grows per region increment (decision 0003). The mapped type binds
 * each entry's `id` to its table key, so the key and the `id` can never drift — the
 * same idiom `ENEMIES` / `ENCOUNTERS` / `BOUNDS` / `REGIONS` use.
 *
 * Registered families:
 * - `marrow-gangs` — the canonical #138 example (Marrow under-city scrappers).
 * - `rendered-husks` — the hollowed dead of the drowned old kingdom (the Roots, #143).
 * - `auditors` — the cold arbiters that audit the Deep (the Roots, #143).
 *
 * Each entry carries a Reach (Act I) stat block and a drained-palette Ashfall
 * (Act II) variant with at least one Gloom attack, so {@link resolveFamilyStatBlock}
 * surfaces an OBSERVABLY different block the instant the Reckoning flips the flag
 * (AC scenario 2). Pure data — ZERO Phaser imports (FR9), no I/O, no RNG.
 * @module content/enemy-families
 */
import { Elements } from "../logic/combat/types";
import { EnemyFamilies, type EnemyFamilyDef } from "./enemies";

/** Canonical ids of the families registered in {@link ENEMY_FAMILIES}. */
export const RegisteredFamilyIds = {
  marrowGangs: EnemyFamilies.marrowGangs,
  renderedHusks: EnemyFamilies.renderedHusks,
  auditors: EnemyFamilies.auditors,
} as const;

/** A registered family id (the literal-union of every {@link ENEMY_FAMILIES} key). */
export type RegisteredFamilyId =
  (typeof RegisteredFamilyIds)[keyof typeof RegisteredFamilyIds];

/**
 * The enemy-family table. The mapped type binds each entry's `id` to its table key,
 * so the key and the `id` can never drift. `marrow-gangs` is the canonical #138
 * example; `rendered-husks` and `auditors` are the Roots / the Deep families (#143),
 * each authored with a Roots-region Reach block and a drained-palette Ashfall
 * variant carrying a Gloom attack. First-pass stats (decision 0003); the schema
 * (this table's *type*) is complete for all eight tags now.
 */
export const ENEMY_FAMILIES: {
  readonly [K in RegisteredFamilyId]: EnemyFamilyDef & { readonly id: K };
} = {
  "marrow-gangs": {
    id: RegisteredFamilyIds.marrowGangs,
    name: "Marrow gangs",
    regions: [
      {
        region: "marrow",
        reach: {
          region: "marrow",
          stats: {
            hp: 40,
            ap: 0,
            pow: 8,
            foc: 0,
            def: 4,
            wrd: 2,
            spd: 8,
            lck: 2,
          },
          elements: {},
          lootGrist: 6,
        },
        ashfall: {
          drainedPalette: "ash-drained",
          stats: {
            hp: 48,
            ap: 0,
            pow: 9,
            foc: 4,
            def: 4,
            wrd: 3,
            spd: 7,
            lck: 2,
          },
          // Warped: gains a Gloom weakness/affinity read distinct from the Reach
          // block (which had none).
          elements: { gloom: 1.5 },
          lootGrist: 6,
          attacks: [
            {
              id: "entropy-bite",
              name: "Entropy Bite",
              element: Elements.gloom,
              power: 12,
            },
          ],
        },
      },
    ],
  },
  // The hollowed dead of the drowned old kingdom (#143): the rendered-husk family
  // sited in the Roots/Deep. Reach is the base read of the lingering dead; the
  // Ashfall variant warps stronger and gains a Gloom attack as the guttering Weave
  // sours. First-pass stats (decision 0003); the Ashfall block is OBSERVABLY
  // different from Reach (higher pow/foc, a Gloom weakness, a Gloom attack).
  "rendered-husks": {
    id: RegisteredFamilyIds.renderedHusks,
    name: "Rendered husks",
    regions: [
      {
        region: "roots",
        reach: {
          region: "roots",
          stats: {
            hp: 52,
            ap: 0,
            pow: 9,
            foc: 2,
            def: 5,
            wrd: 3,
            spd: 5,
            lck: 2,
          },
          elements: { flux: 1.5 },
          lootGrist: 8,
        },
        ashfall: {
          drainedPalette: "deep-drained",
          stats: {
            hp: 60,
            ap: 0,
            pow: 11,
            foc: 6,
            def: 5,
            wrd: 4,
            spd: 5,
            lck: 2,
          },
          elements: { gloom: 1.5, flux: 1 },
          lootGrist: 9,
          attacks: [
            {
              id: "drowning-gloom",
              name: "Drowning Gloom",
              element: Elements.gloom,
              power: 14,
            },
          ],
        },
      },
    ],
  },
  // The cold arbiters that audit the Deep (#143): the Auditor family sited in the
  // Roots/Deep. Reach is the impassive base read; the Ashfall variant is the
  // Reckoning-warped arbiter — harder, Gloom-suffused, gaining an entropy verdict.
  // First-pass stats (decision 0003); Ashfall is OBSERVABLY different from Reach.
  auditors: {
    id: RegisteredFamilyIds.auditors,
    name: "The Auditors",
    regions: [
      {
        region: "roots",
        reach: {
          region: "roots",
          stats: {
            hp: 90,
            ap: 12,
            pow: 10,
            foc: 14,
            def: 10,
            wrd: 12,
            spd: 8,
            lck: 6,
          },
          elements: { gloom: 0.5 },
          lootGrist: 16,
        },
        ashfall: {
          drainedPalette: "deep-drained",
          stats: {
            hp: 110,
            ap: 16,
            pow: 12,
            foc: 18,
            def: 11,
            wrd: 14,
            spd: 8,
            lck: 7,
          },
          // Warped: the Auditor stops resisting Gloom and starts wielding it.
          elements: { gloom: 1 },
          lootGrist: 18,
          attacks: [
            {
              id: "entropy-verdict",
              name: "Entropy Verdict",
              element: Elements.gloom,
              power: 20,
            },
          ],
        },
      },
    ],
  },
};
