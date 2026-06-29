/**
 * Unit coverage for the typed region-authoring template (#133): the `RegionDef`
 * type, the `REGIONS` table, and the both-states (`reach` / `ashfall`) schema +
 * validation. These are the Phaser-free assertions the issue's Validation Journey
 * names ("RegionDef schema + both-states validation"), exercised without a DOM or
 * canvas so they run under vitest. The in-game `__VERIFY__` region-load journey is
 * verified separately by the e2e suite (`tests/e2e/region-template.spec.ts`).
 * ZERO Phaser imports by design (FR9).
 *
 * The template is the framework, not the content (per Out of Scope / decision
 * 0003): a single example region is authored here as the canonical "a new region
 * is added by authoring data" proof — the data shape every later region fills in.
 */
import { describe, expect, it } from "vitest";

import {
  EncounterIds,
  REGIONS,
  RegionIds,
  authorRegion,
  isCompleteRegion,
  resolveRegionVariant,
  validateRegion,
  type RegionDef,
  type RegionVariant,
} from "../../src/content";
import { BoundIds } from "../../src/content";
import {
  INITIAL_WORLD_STATE,
  reckon,
  type WorldState,
} from "../../src/logic/world";

// Hoisted literals so the repeated strings across cases don't trip the
// no-duplicate-string lint.
const MARROW_REGION = "marrow";
const REACH_NAME = "The Marrow Reach";
const ASHFALL_NAME = "The Marrow Ashfall";

/**
 * A complete, schema-valid Reach variant fixture — both-states authoring requires
 * a matching Ashfall variant (see {@link completeAshfallVariant}).
 * @returns A complete reach variant.
 */
function completeReachVariant(): RegionVariant {
  return {
    name: REACH_NAME,
    tone: "verdant",
    keyLocations: [{ id: "warren-gate", name: "Warren Gate" }],
    encounters: [EncounterIds.warrenStreet],
    sideStories: [{ id: "the-lost-runner", name: "The Lost Runner" }],
  };
}

/**
 * A complete, schema-valid Ashfall variant fixture.
 * @returns A complete ashfall variant.
 */
function completeAshfallVariant(): RegionVariant {
  return {
    name: ASHFALL_NAME,
    tone: "ashen",
    keyLocations: [{ id: "warren-gate", name: "Warren Gate (collapsed)" }],
    encounters: [EncounterIds.theCage],
    sideStories: [{ id: "the-lost-runner", name: "The Lost Runner (echo)" }],
  };
}

describe("RegionDef table — authoring as data (AC: data-only)", () => {
  it("exposes the example region through the content barrel", () => {
    expect(REGIONS[RegionIds.marrow]).toBeDefined();
    expect(REGIONS[RegionIds.marrow].id).toBe(MARROW_REGION);
  });

  it("binds each table key to its entry id (key/id can never drift)", () => {
    for (const [key, region] of Object.entries(REGIONS)) {
      expect(region.id).toBe(key);
    }
  });

  it("references exactly one Bound site (cardinality is type-enforced as a single id)", () => {
    const region = REGIONS[RegionIds.marrow];
    expect(typeof region.boundSite).toBe("string");
    expect(
      BoundIds[region.boundSite as keyof typeof BoundIds] ?? region.boundSite
    ).toBeTruthy();
  });

  it("only references defined encounter ids in both variants", () => {
    const region = REGIONS[RegionIds.marrow];
    const known = new Set<string>(Object.values(EncounterIds));
    for (const e of region.states.reach.encounters) {
      expect(known.has(e)).toBe(true);
    }
    for (const e of region.states.ashfall.encounters) {
      expect(known.has(e)).toBe(true);
    }
  });
});

describe("both-states schema (AC: both world-state variants)", () => {
  it("every region in the table declares both a Reach and an Ashfall variant", () => {
    for (const region of Object.values(REGIONS)) {
      expect(region.states.reach).toBeDefined();
      expect(region.states.ashfall).toBeDefined();
      expect(isCompleteRegion(region)).toBe(true);
      expect(validateRegion(region)).toEqual([]);
    }
  });

  it("resolves the live variant through the world-state flag", () => {
    const region = REGIONS[RegionIds.marrow];
    const reach = resolveRegionVariant(region, "reach");
    const ashfall = resolveRegionVariant(region, "ashfall");
    expect(reach.name).toBe(REACH_NAME);
    expect(ashfall.name).toBe(ASHFALL_NAME);
  });

  it("the same region switches variant the instant the world-state flips (the both-states thesis)", () => {
    const region = REGIONS[RegionIds.marrow];
    const before: WorldState = INITIAL_WORLD_STATE;
    const after = reckon(before);
    expect(resolveRegionVariant(region, before).tone).toBe("verdant");
    expect(resolveRegionVariant(region, after).tone).toBe("ashen");
  });
});

describe("validateRegion / isCompleteRegion — both-states validation (AC: missing variant fails)", () => {
  it("accepts a region with both complete variants", () => {
    const region = authorRegion({
      id: "elsewhere",
      boundSite: BoundIds.emberwisp,
      states: {
        reach: completeReachVariant(),
        ashfall: completeAshfallVariant(),
      },
    });
    expect(validateRegion(region)).toEqual([]);
    expect(isCompleteRegion(region)).toBe(true);
  });

  it("rejects a region missing the Ashfall variant", () => {
    // Force the invalid shape past the compiler the way authored data with a
    // dropped variant would reach the runtime validator.
    const broken = {
      id: "broken-no-ashfall",
      boundSite: BoundIds.emberwisp,
      states: { reach: completeReachVariant() },
    } as unknown as RegionDef;
    const errors = validateRegion(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("ashfall"))).toBe(true);
    expect(isCompleteRegion(broken)).toBe(false);
  });

  it("rejects a region missing the Reach variant", () => {
    const broken = {
      id: "broken-no-reach",
      boundSite: BoundIds.emberwisp,
      states: { ashfall: completeAshfallVariant() },
    } as unknown as RegionDef;
    const errors = validateRegion(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("reach"))).toBe(true);
    expect(isCompleteRegion(broken)).toBe(false);
  });

  it("rejects a variant with an empty encounter table", () => {
    const broken = authorRegion({
      id: "broken-empty-encounters",
      boundSite: BoundIds.emberwisp,
      states: {
        reach: { ...completeReachVariant(), encounters: [] },
        ashfall: completeAshfallVariant(),
      },
    });
    const errors = validateRegion(broken);
    expect(errors.some(e => e.includes("encounter"))).toBe(true);
    expect(isCompleteRegion(broken)).toBe(false);
  });

  it("rejects a variant with a blank name", () => {
    const broken = authorRegion({
      id: "broken-blank-name",
      boundSite: BoundIds.emberwisp,
      states: {
        reach: { ...completeReachVariant(), name: "" },
        ashfall: completeAshfallVariant(),
      },
    });
    const errors = validateRegion(broken);
    expect(errors.some(e => e.includes("name"))).toBe(true);
  });

  it("rejects a region with no key locations in a variant", () => {
    const broken = authorRegion({
      id: "broken-no-locations",
      boundSite: BoundIds.emberwisp,
      states: {
        reach: completeReachVariant(),
        ashfall: { ...completeAshfallVariant(), keyLocations: [] },
      },
    });
    const errors = validateRegion(broken);
    expect(errors.some(e => e.includes("location"))).toBe(true);
  });
});

describe("authorRegion — the data-only authoring seam (AC: no engine-code edits)", () => {
  it("produces a RegionDef from plain data with no engine wiring", () => {
    const region = authorRegion({
      id: "authored-only",
      boundSite: BoundIds.emberwisp,
      states: {
        reach: completeReachVariant(),
        ashfall: completeAshfallVariant(),
      },
    });
    expect(region.id).toBe("authored-only");
    expect(isCompleteRegion(region)).toBe(true);
    // The authored region resolves through the same world-state seam the table
    // uses — proving a new region needs only data, not engine code.
    expect(resolveRegionVariant(region, "reach").name).toBe(REACH_NAME);
  });
});
