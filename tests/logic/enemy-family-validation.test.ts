/**
 * Validation-hardening coverage for the enemy-family + Ashfall-variant schema
 * (#138): the runtime guards in `validateEnemyFamily` / `isCompleteEnemyFamily`
 * that turn malformed or inconsistent authored data into named authoring errors
 * rather than crashes. Covers AC scenario 1 (per-region blocks validate; an unknown
 * family tag fails) and AC scenario 2 (an Ashfall variant must warp with a Gloom
 * attack), plus the coerced-data guards (regions/ashfall forced past the compiler)
 * and the duplicate / region-mismatch rejections. Splits the schema suite so each
 * file stays under the per-file line budget; the happy-path table + resolve cases
 * live in the sibling `enemy-family.test.ts`. ZERO Phaser imports by design (FR9).
 */
import { describe, expect, it } from "vitest";

import {
  EnemyFamilies,
  authorEnemyFamily,
  isCompleteEnemyFamily,
  validateEnemyFamily,
  type EnemyFamilyDef,
} from "../../src/content";

import {
  MARROW_REGION,
  completeAshfallVariant,
  completeFamily,
  completeReachBlock,
} from "./enemy-family-fixtures";

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

  it("rejects a duplicate region entry (one would shadow the other on resolve)", () => {
    const broken = authorEnemyFamily({
      id: EnemyFamilies.frames,
      name: "Frames",
      regions: [
        {
          region: MARROW_REGION,
          reach: completeReachBlock(MARROW_REGION),
          ashfall: completeAshfallVariant(),
        },
        {
          region: MARROW_REGION,
          reach: completeReachBlock(MARROW_REGION),
          ashfall: completeAshfallVariant(),
        },
      ],
    });
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("duplicate region entry"))).toBe(true);
    expect(isCompleteEnemyFamily(broken)).toBe(false);
  });

  it("rejects a reach block tagged for a different region than its entry", () => {
    const broken = authorEnemyFamily({
      id: EnemyFamilies.quillDrones,
      name: "Quill drones",
      regions: [
        {
          region: MARROW_REGION,
          // The reach block's own `region` disagrees with the enclosing entry.
          reach: completeReachBlock("elsewhere"),
          ashfall: completeAshfallVariant(),
        },
      ],
    });
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("tagged for a different region"))).toBe(
      true
    );
    expect(isCompleteEnemyFamily(broken)).toBe(false);
  });

  it("returns errors (does not throw) for coerced regions that are not an array", () => {
    const broken = {
      id: EnemyFamilies.renderedHusks,
      name: "Rendered husks",
      // A malformed shape forced past the compiler: `regions` is an object, not
      // an array. The validator must convert this to an authoring error, never
      // throw on `.flatMap()`.
      regions: {},
    } as unknown as EnemyFamilyDef;
    expect(() => validateEnemyFamily(broken)).not.toThrow();
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("no per-region stat blocks"))).toBe(
      true
    );
    expect(isCompleteEnemyFamily(broken)).toBe(false);
  });

  it("returns errors (does not throw) for a coerced empty ashfall variant", () => {
    const broken = {
      id: EnemyFamilies.ashlandHorrors,
      name: "Ashland horrors",
      regions: [
        {
          region: MARROW_REGION,
          reach: completeReachBlock(MARROW_REGION),
          // `ashfall: {}` has no string palette and no attacks array — the
          // validator must report errors, not throw on `.trim()` / `.some()`.
          ashfall: {},
        },
      ],
    } as unknown as EnemyFamilyDef;
    expect(() => validateEnemyFamily(broken)).not.toThrow();
    const errors = validateEnemyFamily(broken);
    expect(errors.some(e => e.includes("drained-palette"))).toBe(true);
    expect(errors.some(e => e.includes("no new attacks"))).toBe(true);
    expect(errors.some(e => e.includes("entropy/Gloom attack"))).toBe(true);
    expect(isCompleteEnemyFamily(broken)).toBe(false);
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
