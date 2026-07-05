/**
 * Unit coverage for the Ashfall enemy-variant table + encounter resolver (#141):
 * the per-base-{@link EnemyId} warped Act II reads (`ASHFALL_ENEMY_VARIANTS`) and
 * their resolution through the world-state flag ({@link resolveEncounterEnemy} /
 * {@link resolveEncounterEnemies}). These are the Phaser-free assertions the issue's
 * Validation Journey names ("variant resolution ... in `src/logic`"), exercised
 * without a DOM or canvas so they run under vitest. The in-game `__VERIFY__`
 * variant-warp journey is verified by the e2e suite
 * (`tests/e2e/ashfall-variants-economy.spec.ts`). ZERO Phaser imports by design (FR9).
 *
 * Expected values are hardcoded known constants (not derived from the source under
 * test), so a table edit that changes a variant is caught rather than silently
 * mirrored.
 */
import { describe, expect, it } from "vitest";

import {
  ASHFALL_ENEMY_VARIANTS,
  ENCOUNTERS,
  EncounterIds,
  EnemyIds,
  ashfallVariantTableErrors,
  hasAshfallVariant,
  isCompleteAshfallVariantTable,
  resolveAshfallVariant,
  resolveEncounterEnemies,
  resolveEncounterEnemy,
  validateAshfallVariant,
  type AshfallEnemyVariant,
} from "../../src/content";
import { type WorldState } from "../../src/logic/world";

const REACH: WorldState = "reach";
const ASHFALL: WorldState = "ashfall";
const ASH_DRAINED = "ash-drained";

describe("ASHFALL_ENEMY_VARIANTS — the warped Act II reads (authored as data)", () => {
  it("is a complete, correctly-keyed table", () => {
    expect(ashfallVariantTableErrors()).toEqual([]);
    expect(isCompleteAshfallVariantTable()).toBe(true);
  });

  it("authors a variant for every recurring Ashfall-encounter enemy", () => {
    // The seven foes that roll in at least one region's Ashfall encounter table.
    const recurring = [
      EnemyIds.marrowScrapper,
      EnemyIds.renderConstruct,
      EnemyIds.theAshling,
      EnemyIds.houseEnforcer,
      EnemyIds.drownedHusk,
      EnemyIds.requiemWraith,
      EnemyIds.deepAuditor,
    ] as const;
    for (const id of recurring) {
      expect(hasAshfallVariant(id)).toBe(true);
    }
  });

  it("omits a variant for the Reach-only Halcyon chase boss", () => {
    expect(hasAshfallVariant(EnemyIds.halcyonKnight)).toBe(false);
    expect(resolveAshfallVariant(EnemyIds.halcyonKnight)).toBeNull();
  });

  it("binds every entry's baseId to its table key", () => {
    for (const [key, variant] of Object.entries(ASHFALL_ENEMY_VARIANTS)) {
      expect(variant?.baseId).toBe(key);
    }
  });

  it("gives each variant a drained palette and at least one Gloom attack", () => {
    for (const variant of Object.values(ASHFALL_ENEMY_VARIANTS)) {
      expect(variant!.drainedPalette.length).toBeGreaterThan(0);
      expect(
        variant!.gloomAttacks.some(attack => attack.element === "gloom")
      ).toBe(true);
    }
  });
});

describe("resolveEncounterEnemy — reading through the world-state flag", () => {
  it("resolves the base read (no warp) in Act I reach", () => {
    const resolved = resolveEncounterEnemy(EnemyIds.marrowScrapper, REACH);
    expect(resolved.isAshfall).toBe(false);
    expect(resolved.ref).toBe(EnemyIds.marrowScrapper);
    expect(resolved.name).toBe("Marrow scrapper");
    expect(resolved.drainedPalette).toBeNull();
    expect(resolved.gloomAttacks).toEqual([]);
    // The base stat block (hardcoded known value from the ENEMIES table).
    expect(resolved.stats.hp).toBe(40);
    expect(resolved.lootGrist).toBe(6);
  });

  it("resolves the drained, Gloom-touched variant in Act II ashfall", () => {
    const resolved = resolveEncounterEnemy(EnemyIds.marrowScrapper, ASHFALL);
    expect(resolved.isAshfall).toBe(true);
    expect(resolved.ref).toBe(EnemyIds.marrowScrapper);
    expect(resolved.name).toBe("Ashen scrapper");
    expect(resolved.drainedPalette).toBe(ASH_DRAINED);
    expect(resolved.gloomAttacks.map(a => a.id)).toEqual(["entropy-scour"]);
    // The warped stat block: heavier than Reach (hp 40 -> 48) and Gloom-weak.
    expect(resolved.stats.hp).toBe(48);
    expect(resolved.elements.gloom).toBe(1.5);
  });

  it("warps every recurring foe to be observably distinct from its base", () => {
    const ids = [
      EnemyIds.renderConstruct,
      EnemyIds.theAshling,
      EnemyIds.houseEnforcer,
      EnemyIds.drownedHusk,
      EnemyIds.requiemWraith,
      EnemyIds.deepAuditor,
    ] as const;
    for (const id of ids) {
      const reach = resolveEncounterEnemy(id, REACH);
      const ashfall = resolveEncounterEnemy(id, ASHFALL);
      expect(reach.isAshfall).toBe(false);
      expect(ashfall.isAshfall).toBe(true);
      // The warped read carries a palette + a Gloom attack the base read lacks.
      expect(reach.drainedPalette).toBeNull();
      expect(ashfall.drainedPalette).not.toBeNull();
      expect(ashfall.gloomAttacks.length).toBeGreaterThan(0);
      // Higher HP than the Reach base — the escalation motif.
      expect(ashfall.stats.hp).toBeGreaterThan(reach.stats.hp);
    }
  });

  it("reads a variant-less enemy as its base block in BOTH states", () => {
    const reach = resolveEncounterEnemy(EnemyIds.halcyonKnight, REACH);
    const ashfall = resolveEncounterEnemy(EnemyIds.halcyonKnight, ASHFALL);
    expect(reach.isAshfall).toBe(false);
    expect(ashfall.isAshfall).toBe(false);
    expect(ashfall.stats.hp).toBe(reach.stats.hp);
    expect(ashfall.drainedPalette).toBeNull();
  });
});

describe("resolveEncounterEnemies — an Ashfall encounter warps its whole lineup", () => {
  it("resolves the same encounter's lineup base in reach, warped in ashfall", () => {
    // `the-drip` (marrow-scrapper + render-construct) sits in the Marrow Ashfall table.
    const encounter = ENCOUNTERS[EncounterIds.theDrip];
    const reach = resolveEncounterEnemies(encounter, REACH);
    const ashfall = resolveEncounterEnemies(encounter, ASHFALL);
    expect(reach).toHaveLength(2);
    expect(ashfall).toHaveLength(2);
    expect(reach.every(e => !e.isAshfall)).toBe(true);
    expect(ashfall.every(e => e.isAshfall)).toBe(true);
    // Positionally aligned to encounter.enemies.
    expect(ashfall[0]!.baseId).toBe(EnemyIds.marrowScrapper);
    expect(ashfall[1]!.baseId).toBe(EnemyIds.renderConstruct);
  });
});

describe("validateAshfallVariant — guarding data forced past the compiler", () => {
  it("passes a well-formed variant", () => {
    expect(
      validateAshfallVariant(ASHFALL_ENEMY_VARIANTS[EnemyIds.marrowScrapper])
    ).toEqual([]);
  });

  it("flags a missing variant", () => {
    expect(validateAshfallVariant(undefined)).toContain(
      "ashfall variant is missing"
    );
  });

  it("flags a blank drained-palette marker", () => {
    const bad: Partial<AshfallEnemyVariant> = {
      baseId: EnemyIds.marrowScrapper,
      drainedPalette: "   ",
      gloomAttacks: [{ id: "x", name: "X", element: "gloom", power: 1 }],
    };
    expect(validateAshfallVariant(bad)).toContain(
      "ashfall variant 'marrow-scrapper' has a blank drained-palette marker"
    );
  });

  it("flags a variant with no entropy/Gloom attack", () => {
    const bad: Partial<AshfallEnemyVariant> = {
      baseId: EnemyIds.marrowScrapper,
      drainedPalette: ASH_DRAINED,
      gloomAttacks: [{ id: "x", name: "X", element: "ash", power: 1 }],
    };
    expect(validateAshfallVariant(bad)).toContain(
      "ashfall variant 'marrow-scrapper' has no entropy/Gloom attack"
    );
  });

  it("flags a coerced non-array attacks field without throwing", () => {
    const bad = {
      baseId: EnemyIds.marrowScrapper,
      drainedPalette: ASH_DRAINED,
      gloomAttacks: undefined,
    } as unknown as Partial<AshfallEnemyVariant>;
    expect(validateAshfallVariant(bad)).toContain(
      "ashfall variant 'marrow-scrapper' has no entropy/Gloom attack"
    );
  });
});

describe("determinism — the resolver is a total function of its inputs", () => {
  it("returns identical reads for identical inputs", () => {
    const a = resolveEncounterEnemy(EnemyIds.deepAuditor, ASHFALL);
    const b = resolveEncounterEnemy(EnemyIds.deepAuditor, ASHFALL);
    expect(a).toEqual(b);
  });
});
