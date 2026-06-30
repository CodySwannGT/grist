/**
 * Unit coverage for the enemy-family + Ashfall-variant stat-block schema (#138):
 * the eight {@link EnemyFamily} tags, the `ENEMY_FAMILIES` table, and resolution of
 * the per-region both-states (`reach` / `ashfall`) blocks through the world-state
 * flag. These are the Phaser-free assertions the issue's Validation Journey names
 * ("EnemyDef family schema + Ashfall-variant resolution"), exercised without a DOM
 * or canvas so they run under vitest. The validation-hardening cases (unknown tag,
 * missing/duplicate/mismatched regions, malformed coerced shapes) live in the
 * sibling `enemy-family-validation.test.ts`; the in-game `__VERIFY__` family-load +
 * variant-warp journey is verified by the e2e suite (`tests/e2e/enemy-family.spec.ts`).
 * ZERO Phaser imports by design (FR9).
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
  isCompleteEnemyFamily,
  isEnemyFamily,
  resolveFamilyStatBlock,
  validateEnemyFamily,
} from "../../src/content";
import {
  INITIAL_WORLD_STATE,
  reckon,
  type WorldState,
} from "../../src/logic/world";

import { MARROW_REGION, completeFamily } from "./enemy-family-fixtures";

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
