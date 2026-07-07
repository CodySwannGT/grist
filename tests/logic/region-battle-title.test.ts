/**
 * Unit coverage for the battle-banner title resolver (#248): `regionBattleTitle`
 * derives a fight's top-center banner from the region it is fought in, reading the
 * live world-state variant's authored name so the banner changes as the player
 * travels AND turns with the Reckoning — instead of the fixed "MARROW DESCENT" the
 * Battle scene used to hardcode for every fight regardless of region.
 *
 * The Phaser-free twin of the region-battle e2e (`tests/e2e/*-region.spec.ts` +
 * `field-battle.spec.ts`): these assertions prove the pure derivation headlessly;
 * the e2e proves the banner actually renders that string on the live canvas. ZERO
 * Phaser imports by design.
 */
import { describe, expect, it } from "vitest";

import {
  REGIONS,
  RegionIds,
  regionBattleTitle,
  resolveRegionVariant,
  type RegionId,
} from "../../src/content";
import { type WorldState } from "../../src/logic/world";

/** The fixed banner the scene used to hardcode for every fight (the #248 regression). */
const LEGACY_FIXED_TITLE = "MARROW DESCENT";
/** Both world-states, so every case is asserted in Act I and Act II. */
const WORLD_STATES: readonly WorldState[] = ["reach", "ashfall"];

describe("regionBattleTitle (#248 — battle banner reflects the region)", () => {
  it("is the region's live variant name, upper-cased for the banner chrome", () => {
    expect(regionBattleTitle(REGIONS[RegionIds.marrow], "reach")).toBe(
      "THE MARROW REACH"
    );
    expect(regionBattleTitle(REGIONS[RegionIds.marrow], "ashfall")).toBe(
      "THE MARROW ASHFALL"
    );
  });

  it("turns with the Reckoning — the Ashfall banner differs from the Reach one", () => {
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      expect(regionBattleTitle(region, "reach")).not.toBe(
        regionBattleTitle(region, "ashfall")
      );
    }
  });

  it("reads a different banner per region (a travelled fight names its place)", () => {
    const marrow = regionBattleTitle(REGIONS[RegionIds.marrow], "reach");
    const vanta = regionBattleTitle(REGIONS[RegionIds.upperVanta], "reach");
    expect(vanta).not.toBe(marrow);
    expect(vanta).toContain("UPPER VANTA");
  });

  it("is never the fixed 'MARROW DESCENT' — the exact string the bug reported", () => {
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      for (const state of WORLD_STATES) {
        expect(regionBattleTitle(region, state)).not.toBe(LEGACY_FIXED_TITLE);
      }
    }
  });

  it("is content-as-data — exactly the authored variant name, upper-cased", () => {
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      for (const state of WORLD_STATES) {
        expect(regionBattleTitle(region, state)).toBe(
          resolveRegionVariant(region, state).name.toUpperCase()
        );
      }
    }
  });

  it("fits the 384-wide banner: at 10px monospace no banner overflows the canvas", () => {
    // The banner is origin-centered at GameView.width/2 in TITLE_STYLE (monospace
    // 10px ≈ 6px/glyph). A string wider than the 384px canvas would truncate — the
    // #248 acceptance risk. Assert every authored region banner stays within it.
    const CANVAS_WIDTH = 384;
    const GLYPH_WIDTH_PX = 6;
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      for (const state of WORLD_STATES) {
        const width = regionBattleTitle(region, state).length * GLYPH_WIDTH_PX;
        expect(width).toBeLessThanOrEqual(CANVAS_WIDTH);
      }
    }
  });
});
