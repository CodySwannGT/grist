/**
 * Unit coverage for the enemy-family + Ashfall-variant stat-block schema (#138):
 * the eight {@link EnemyFamily} tags, the `ENEMY_FAMILIES` table, the per-region
 * stat blocks, and the both-states (`reach` / `ashfall`) Ashfall-variant schema +
 * validation + resolution through the world-state flag. These are the Phaser-free
 * assertions the issue's Validation Journey names ("EnemyDef family schema +
 * Ashfall-variant resolution"), exercised without a DOM or canvas so they run under
 * vitest. The in-game `__VERIFY__` family-load + variant-warp journey is verified
 * separately by the e2e suite (`tests/e2e/enemy-family.spec.ts`). ZERO Phaser
 * imports by design (FR9).
 *
 * The schema is the framework, not the content (per #138 Out of Scope / decision
 * 0003): a single example family is authored here as the canonical "a family is
 * added by authoring data" proof — the data shape every later family fills in.
 */
import { describe, expect, it } from "vitest";

import {
  ENEMY_FAMILIES,
  EnemyFamilies,
  RegisteredFamilyIds,
  authorEnemyFamily,
  isCompleteEnemyFamily,
  isEnemyFamily,
  resolveFamilyStatBlock,
  validateEnemyFamily,
  type AshfallVariant,
  type EnemyFamilyDef,
  type RegionStatBlock,
} from "../../src/content";
import {
  INITIAL_WORLD_STATE,
  reckon,
  type WorldState,
} from "../../src/logic/world";

const MARROW_REGION = "marrow";
const ASH_DRAINED = "ash-drained";

/**
 * A complete, schema-valid Reach stat block fixture for a region. Both-states
 * authoring requires a matching Ashfall variant (see {@link completeAshfallVariant}).
 * @param region - The region key the block is authored for.
 * @returns A complete reach stat block.
 */
function completeReachBlock(region: string): RegionStatBlock {
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
function completeAshfallVariant(): AshfallVariant {
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
function completeFamily(id: EnemyFamilyDef["id"]): EnemyFamilyDef {
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

describe("EnemyFamily tags — the closed eight-family union", () => {
  it("declares exactly the eight families", () => {
    expect(Object.values(EnemyFamilies)).toHaveLength(8);
  });

  it("accepts every defined family tag", () => {
    for (const tag of Object.values(EnemyFamilies)) {
      expect(isEnemyFamily(tag)).toBe(true);
    }
  });

  it("rejects an unknown family tag (AC: unknown tag fails validation)", () => {
    expect(isEnemyFamily("not-a-family")).toBe(false);
    expect(isEnemyFamily("")).toBe(false);
  });
});

describe("ENEMY_FAMILIES table — authoring as data (AC: data-only)", () => {
  it("exposes the example family through the content barrel", () => {
    expect(ENEMY_FAMILIES[RegisteredFamilyIds.marrowGangs]).toBeDefined();
    expect(ENEMY_FAMILIES[RegisteredFamilyIds.marrowGangs].id).toBe(
      EnemyFamilies.marrowGangs
    );
  });

  it("binds each table key to its entry id (key/id can never drift)", () => {
    for (const [key, family] of Object.entries(ENEMY_FAMILIES)) {
      expect(family.id).toBe(key);
    }
  });

  it("every registered family passes schema validation", () => {
    for (const family of Object.values(ENEMY_FAMILIES)) {
      expect(isCompleteEnemyFamily(family)).toBe(true);
      expect(validateEnemyFamily(family)).toEqual([]);
    }
  });

  it("every registered family carries only known tags and a Gloom attack per region", () => {
    for (const family of Object.values(ENEMY_FAMILIES)) {
      expect(isEnemyFamily(family.id)).toBe(true);
      for (const entry of family.regions) {
        const gloom = entry.ashfall.attacks.filter(a => a.element === "gloom");
        expect(gloom.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("per-region stat blocks validate against the schema (AC scenario 1)", () => {
  it("accepts a family with a complete per-region block", () => {
    const family = completeFamily(EnemyFamilies.frames);
    expect(validateEnemyFamily(family)).toEqual([]);
    expect(isCompleteEnemyFamily(family)).toBe(true);
  });

  it("rejects a family with an unknown tag forced past the compiler", () => {
    const broken = {
      id: "rogue-family",
      name: "Rogue",
      regions: [
        {
          region: MARROW_REGION,
          reach: completeReachBlock(MARROW_REGION),
          ashfall: completeAshfallVariant(),
        },
      ],
    } as unknown as EnemyFamilyDef;
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("unknown family tag"))).toBe(true);
    expect(isCompleteEnemyFamily(broken)).toBe(false);
  });

  it("rejects a family declaring no per-region stat blocks", () => {
    const broken = authorEnemyFamily({
      id: EnemyFamilies.quillDrones,
      name: "Quill drones",
      regions: [],
    });
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("no per-region stat blocks"))).toBe(
      true
    );
    expect(isCompleteEnemyFamily(broken)).toBe(false);
  });

  it("rejects a region entry missing its reach stat block", () => {
    const broken = {
      id: EnemyFamilies.houseEnforcers,
      name: "House enforcers",
      regions: [{ region: MARROW_REGION, ashfall: completeAshfallVariant() }],
    } as unknown as EnemyFamilyDef;
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("reach stat block"))).toBe(true);
  });
});

describe("Ashfall variant warps a family with a Gloom attack (AC scenario 2)", () => {
  it("rejects an Ashfall variant with a blank drained-palette marker", () => {
    const broken = authorEnemyFamily({
      id: EnemyFamilies.renderedHusks,
      name: "Rendered husks",
      regions: [
        {
          region: MARROW_REGION,
          reach: completeReachBlock(MARROW_REGION),
          ashfall: { ...completeAshfallVariant(), drainedPalette: "" },
        },
      ],
    });
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("drained-palette"))).toBe(true);
  });

  it("rejects an Ashfall variant with no new attacks", () => {
    const broken = authorEnemyFamily({
      id: EnemyFamilies.ashlandHorrors,
      name: "Ashland horrors",
      regions: [
        {
          region: MARROW_REGION,
          reach: completeReachBlock(MARROW_REGION),
          ashfall: { ...completeAshfallVariant(), attacks: [] },
        },
      ],
    });
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("no new attacks"))).toBe(true);
    expect(errors.some(e => e.includes("Gloom"))).toBe(true);
  });

  it("rejects an Ashfall variant whose attacks are all non-Gloom", () => {
    const broken = authorEnemyFamily({
      id: EnemyFamilies.auditors,
      name: "The Auditors",
      regions: [
        {
          region: MARROW_REGION,
          reach: completeReachBlock(MARROW_REGION),
          ashfall: {
            ...completeAshfallVariant(),
            attacks: [
              {
                id: "iron-edict",
                name: "Iron Edict",
                element: "iron",
                power: 9,
              },
            ],
          },
        },
      ],
    });
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("entropy/Gloom attack"))).toBe(true);
  });
});

describe("resolveFamilyStatBlock — reading through the world-state flag (AC scenario 2)", () => {
  it("resolves the Reach block before the Reckoning", () => {
    const family = ENEMY_FAMILIES[RegisteredFamilyIds.marrowGangs];
    const block = resolveFamilyStatBlock(family, MARROW_REGION, "reach");
    expect(block).not.toBeNull();
    // The Reach block carries no drained-palette marker and no Gloom attacks.
    expect(block !== null && "drainedPalette" in block).toBe(false);
  });

  it("resolves the warped Ashfall variant after the Reckoning, distinct from Reach", () => {
    const family = ENEMY_FAMILIES[RegisteredFamilyIds.marrowGangs];
    const reach = resolveFamilyStatBlock(family, MARROW_REGION, "reach");
    const ashfall = resolveFamilyStatBlock(family, MARROW_REGION, "ashfall");
    expect(ashfall).not.toBeNull();
    // The Ashfall variant has the drained palette + at least one Gloom attack.
    expect(ashfall !== null && "drainedPalette" in ashfall).toBe(true);
    if (ashfall !== null && "drainedPalette" in ashfall) {
      expect(ashfall.drainedPalette.length).toBeGreaterThan(0);
      const gloom = ashfall.attacks.filter(a => a.element === "gloom");
      expect(gloom.length).toBeGreaterThan(0);
    }
    // The Ashfall variant's combat block is distinct from the Reach block.
    expect(JSON.stringify(ashfall)).not.toBe(JSON.stringify(reach));
  });

  it("the same family switches block the instant the world-state flips", () => {
    const family = ENEMY_FAMILIES[RegisteredFamilyIds.marrowGangs];
    const before: WorldState = INITIAL_WORLD_STATE;
    const after = reckon(before);
    const reachBlock = resolveFamilyStatBlock(family, MARROW_REGION, before);
    const ashfallBlock = resolveFamilyStatBlock(family, MARROW_REGION, after);
    expect(reachBlock !== null && "drainedPalette" in reachBlock).toBe(false);
    expect(ashfallBlock !== null && "drainedPalette" in ashfallBlock).toBe(
      true
    );
  });

  it("returns null for a region the family does not appear in", () => {
    const family = ENEMY_FAMILIES[RegisteredFamilyIds.marrowGangs];
    expect(resolveFamilyStatBlock(family, "nowhere", "reach")).toBeNull();
    expect(resolveFamilyStatBlock(family, "nowhere", "ashfall")).toBeNull();
  });
});

describe("authorEnemyFamily — the data-only authoring seam (AC: no engine-code edits)", () => {
  it("produces an EnemyFamilyDef from plain data with no engine wiring", () => {
    const family = completeFamily(EnemyFamilies.vesperConstructs);
    expect(family.id).toBe(EnemyFamilies.vesperConstructs);
    expect(isCompleteEnemyFamily(family)).toBe(true);
    // The authored family resolves through the same world-state seam the table
    // uses — proving a new family needs only data, not engine code.
    const ashfall = resolveFamilyStatBlock(family, MARROW_REGION, "ashfall");
    expect(ashfall !== null && "drainedPalette" in ashfall).toBe(true);
  });
});
