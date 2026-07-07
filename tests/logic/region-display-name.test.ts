/**
 * Unit coverage for the region-display-name resolver (#247): `regionDisplayName`
 * derives the region-play banner from the region the player travelled into, reading
 * the live world-state variant's authored name — instead of the raw `regionId` slug
 * ("upper-vanta" / "wrack" / "cinderfen") the Region scene used to print verbatim.
 *
 * The Phaser-free twin of the region-scene e2e (`tests/e2e/region-title.spec.ts`):
 * these assertions prove the pure derivation headlessly (never a slug, turns with the
 * Reckoning, agrees with the World-Map row, and is the shared seam the battle banner
 * upper-cases); the e2e proves the banner actually renders that string on the live
 * canvas. ZERO Phaser imports by design.
 */
import { describe, expect, it } from "vitest";

import {
  REGIONS,
  RegionIds,
  regionBattleTitle,
  regionDisplayName,
  resolveRegionVariant,
  type RegionId,
} from "../../src/content";
import { RegionLayout, RegionTextStyles } from "../../src/consts";
import { resolveWorldMap } from "../../src/logic/region";
import { type WorldState } from "../../src/logic/world";

/** Both world-states, so every case is asserted in Act I and Act II. */
const WORLD_STATES: readonly WorldState[] = ["reach", "ashfall"];

describe("regionDisplayName (#247 — region-play title uses the human name)", () => {
  it("is the region's live variant name, verbatim (mixed-case, as authored)", () => {
    expect(regionDisplayName(REGIONS[RegionIds.marrow], "reach")).toBe(
      "The Marrow Reach"
    );
    expect(regionDisplayName(REGIONS[RegionIds.upperVanta], "reach")).toBe(
      "Upper Vanta — the Crown & the Tiers"
    );
  });

  it("is NEVER the raw slug — the exact defect the bug reported", () => {
    // "upper-vanta" / "wrack" / "cinderfen" appeared as the region-play title. The
    // display name must differ from the region's own id (the slug) in every state.
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      for (const state of WORLD_STATES) {
        const name = regionDisplayName(region, state);
        expect(name).not.toBe(region.id);
        expect(name).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    }
  });

  it("turns with the Reckoning — the Ashfall name differs from the Reach one", () => {
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      expect(regionDisplayName(region, "reach")).not.toBe(
        regionDisplayName(region, "ashfall")
      );
    }
  });

  it("reads a different name per region (a travelled region names its place)", () => {
    const marrow = regionDisplayName(REGIONS[RegionIds.marrow], "reach");
    const vanta = regionDisplayName(REGIONS[RegionIds.upperVanta], "reach");
    const wrack = regionDisplayName(REGIONS[RegionIds.wrack], "reach");
    expect(new Set([marrow, vanta, wrack]).size).toBe(3);
  });

  it("agrees with the World-Map row for the same region + state (no drift)", () => {
    // The map row and the region-play title MUST show the same name (the visible
    // mismatch the bug called out). Both resolve the same variant name; prove it.
    for (const state of WORLD_STATES) {
      const map = resolveWorldMap(state);
      for (const node of map.regions) {
        expect(regionDisplayName(REGIONS[node.id], state)).toBe(node.name);
      }
    }
  });

  it("is content-as-data — exactly the authored variant name", () => {
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      for (const state of WORLD_STATES) {
        expect(regionDisplayName(region, state)).toBe(
          resolveRegionVariant(region, state).name
        );
      }
    }
  });

  it("is the shared seam the battle banner upper-cases (one source, two chromes)", () => {
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      for (const state of WORLD_STATES) {
        expect(regionBattleTitle(region, state)).toBe(
          regionDisplayName(region, state).toUpperCase()
        );
      }
    }
  });

  it("fits the region banner at its min font: the shrink-to-fit always succeeds (#247)", () => {
    // The banner is origin-centered and shrunk by whole-pixel font steps until it fits
    // RegionLayout.titleMaxWidth so it clears the play-mode "‹ Map" button (its panel
    // left edge at x≈310). The shrink STOPS at titleMinFontPx, so a name too long even
    // at that floor would still overlap. Prove no authored name is that long: at the
    // min font (a conservative 0.62 monospace glyph advance) every name fits the cap.
    const GLYPH_ADVANCE_RATIO = 0.62;
    const minGlyphPx = RegionLayout.titleMinFontPx * GLYPH_ADVANCE_RATIO;
    for (const id of Object.values(RegionIds)) {
      const region = REGIONS[id as RegionId];
      for (const state of WORLD_STATES) {
        const width = regionDisplayName(region, state).length * minGlyphPx;
        expect(width).toBeLessThanOrEqual(RegionLayout.titleMaxWidth);
      }
    }
  });

  it("keeps the full 12px chrome for a short name (only long names shrink)", () => {
    // A short authored name must not be shrunk at all: at the base font it already
    // fits the cap. The Marrow's Reach ("The Marrow Reach") is the shortest.
    const baseFontPx = Number.parseInt(RegionTextStyles.title.fontSize, 10);
    const GLYPH_ADVANCE_RATIO = 0.62;
    const marrow = regionDisplayName(REGIONS[RegionIds.marrow], "reach");
    const width = marrow.length * baseFontPx * GLYPH_ADVANCE_RATIO;
    expect(width).toBeLessThanOrEqual(RegionLayout.titleMaxWidth);
  });
});
