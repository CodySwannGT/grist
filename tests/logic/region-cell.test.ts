/**
 * Unit coverage for the verification bridge's region cell (`src/uat/region-cell`,
 * #133) — the scene-agnostic seam the `__VERIFY__` bridge owns so the region-
 * template e2e can load a template-authored region and observe it resolved through
 * a world-state, without a live scene. The cell only *holds* the loaded region and
 * delegates validation + resolution to `content/regions`; it owns no rules. ZERO
 * Phaser imports by design (FR9) — exercised headless under vitest, mirroring
 * `world-state-cell` coverage. The in-game `__VERIFY__` region journey is verified
 * separately by the e2e suite (`tests/e2e/region-template.spec.ts`).
 */
import { describe, expect, it } from "vitest";

import {
  RegionIds,
  authorRegion,
  type RegionDef,
  type RegionVariant,
} from "../../src/content";
import { BoundIds } from "../../src/content";
import { RegionCell } from "../../src/uat/region-cell";

const REACH_NAME = "Vale Reach";
const ASHFALL_NAME = "Vale Ashfall";

/**
 * A complete reach variant fixture for the adopt-an-incomplete-region cases.
 * @returns A complete reach variant.
 */
function reachVariant(): RegionVariant {
  return {
    name: REACH_NAME,
    tone: "verdant",
    keyLocations: [{ id: "vale-gate", name: "Vale Gate" }],
    encounters: [],
    sideStories: [],
  } as unknown as RegionVariant;
}

describe("RegionCell — the bridge's region seam (#133)", () => {
  it("returns null before any region has been loaded", () => {
    const cell = new RegionCell();
    expect(cell.snapshot("reach")).toBeNull();
  });

  it("loads the canonical template-authored region through the content barrel", () => {
    const cell = new RegionCell();
    cell.load();
    // [region-template-loads]: the marrow region loaded through the content barrel
    // and is schema-valid (both world-state variants present).
    const reach = cell.snapshot("reach");
    expect(reach).not.toBeNull();
    expect(reach!.id).toBe(RegionIds.marrow);
    expect(reach!.complete).toBe(true);
    expect(reach!.errors).toEqual([]);
  });

  it("exposes BOTH the Act I reach and Act II ashfall variant of a loaded region", () => {
    const cell = new RegionCell();
    cell.load();
    const reach = cell.snapshot("reach")!;
    const ashfall = cell.snapshot("ashfall")!;
    // [region-both-states-present]: a complete region exposes both variants, each
    // distinct (the same authored region reads as two worlds).
    expect(reach.hasReach).toBe(true);
    expect(reach.hasAshfall).toBe(true);
    expect(reach.tone).toBe("verdant");
    expect(ashfall.tone).toBe("ashen");
    expect(reach.variantName).not.toBe(ashfall.variantName);
  });

  it("resolves the same region to different hashes per world-state, reproducibly", () => {
    const cell = new RegionCell();
    cell.load();
    const reachA = cell.snapshot("reach")!.hash;
    const reachB = cell.snapshot("reach")!.hash;
    const ashfall = cell.snapshot("ashfall")!.hash;
    // Determinism: same region + same world-state ⇒ identical hash; a different
    // world-state diverges (the both-states content actually differs).
    expect(reachA).toBe(reachB);
    expect(reachA).not.toBe(ashfall);
  });

  it("flags an adopted region missing the ashfall variant as incomplete", () => {
    const cell = new RegionCell();
    const broken = {
      id: "broken",
      boundSite: BoundIds.emberwisp,
      states: { reach: reachVariant() },
    } as unknown as RegionDef;
    cell.adopt(broken);
    const snapshot = cell.snapshot("reach")!;
    expect(snapshot.complete).toBe(false);
    expect(snapshot.hasAshfall).toBe(false);
    expect(snapshot.errors.some(e => e.includes("ashfall"))).toBe(true);
  });

  it("accepts a fully authored region adopted via authorRegion", () => {
    const cell = new RegionCell();
    cell.adopt(
      authorRegion({
        id: "vale",
        boundSite: BoundIds.emberwisp,
        states: {
          reach: {
            name: REACH_NAME,
            tone: "verdant",
            keyLocations: [{ id: "vale-gate", name: "Vale Gate" }],
            encounters: [],
            sideStories: [],
          } as unknown as RegionVariant,
          ashfall: {
            name: ASHFALL_NAME,
            tone: "ashen",
            keyLocations: [{ id: "vale-ash", name: "Vale Ash" }],
            encounters: [],
            sideStories: [],
          } as unknown as RegionVariant,
        },
      })
    );
    expect(cell.snapshot("reach")!.hasReach).toBe(true);
    expect(cell.snapshot("ashfall")!.hasAshfall).toBe(true);
  });
});
