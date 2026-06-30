/**
 * Shared fixtures for the enemy-family + Ashfall-variant schema unit suites (#138).
 * Extracted so `enemy-family.test.ts` and `enemy-family-validation.test.ts` author
 * the same canonical complete data without duplicating it (and so each test file
 * stays under the per-file line budget). ZERO Phaser imports by design (FR9).
 */
import {
  authorEnemyFamily,
  type AshfallVariant,
  type EnemyFamilyDef,
  type RegionStatBlock,
} from "../../src/content";

/** The region the canonical example family is authored/read through. */
export const MARROW_REGION = "marrow";

/** The drained-palette marker used by the complete Ashfall fixture. */
const ASH_DRAINED = "ash-drained";

/**
 * A complete, schema-valid Reach stat block fixture for a region. Both-states
 * authoring requires a matching Ashfall variant (see {@link completeAshfallVariant}).
 * @param region - The region key the block is authored for.
 * @returns A complete reach stat block.
 */
export function completeReachBlock(region: string): RegionStatBlock {
  return {
    region,
    stats: { hp: 40, ap: 0, pow: 8, foc: 0, def: 4, wrd: 2, spd: 8, lck: 2 },
    elements: {},
    lootGrist: 6,
  };
}

/**
 * A complete, schema-valid Ashfall variant fixture — a drained palette and a new
 * Gloom attack distinct from the Reach block.
 * @returns A complete ashfall variant.
 */
export function completeAshfallVariant(): AshfallVariant {
  return {
    drainedPalette: ASH_DRAINED,
    stats: { hp: 48, ap: 0, pow: 9, foc: 4, def: 4, wrd: 3, spd: 7, lck: 2 },
    elements: { gloom: 1.5 },
    lootGrist: 6,
    attacks: [
      { id: "entropy-bite", name: "Entropy Bite", element: "gloom", power: 12 },
    ],
  };
}

/**
 * A complete authored family with a single region carrying both world-state reads.
 * @param id - The family tag to author under.
 * @returns A complete, schema-valid family.
 */
export function completeFamily(id: EnemyFamilyDef["id"]): EnemyFamilyDef {
  return authorEnemyFamily({
    id,
    name: "Test family",
    regions: [
      {
        region: MARROW_REGION,
        reach: completeReachBlock(MARROW_REGION),
        ashfall: completeAshfallVariant(),
      },
    ],
  });
}
