import { describe, expect, it } from "vitest";
import {
  hashWorldMap,
  resolveWorldMap,
} from "../../src/logic/region/world-map";

/** The one warm signal that never drains — grist-gold (`logic/render`). */
const GRIST_GOLD = 0xffd166;

/** The Act-I-loved place's name while loved (the reach name the mourned form diverges from). */
const SIDHE_ENCLAVE = "The Sidhe Enclave";

/**
 * Whether a packed 0xRRGGBB colour has collapsed to a pure grey (r == g == b).
 * @param hex - The packed colour to test.
 * @returns True when the colour has zero chroma (fully desaturated).
 */
function isGrey(hex: number): boolean {
  return (
    ((hex >> 16) & 0xff) === ((hex >> 8) & 0xff) &&
    ((hex >> 8) & 0xff) === (hex & 0xff)
  );
}

describe("resolveWorldMap — the map-wide desaturation grade", () => {
  it("reads at full colour (desaturation 0) in Act I reach", () => {
    const map = resolveWorldMap("reach");
    expect(map.desaturation).toBe(0);
    // The verdant source tones read un-drained in reach.
    expect(map.palette).toEqual({
      land: 0x3f7d3a,
      water: 0x2f6f9f,
      path: 0x8a6f3b,
      ruin: 0x7a4fa0,
      highlight: GRIST_GOLD,
    });
  });

  it("drains every structural tone to grey at full strength (desaturation 1) in ashfall", () => {
    const map = resolveWorldMap("ashfall");
    expect(map.desaturation).toBe(1);
    expect(isGrey(map.palette.land)).toBe(true);
    expect(isGrey(map.palette.water)).toBe(true);
    expect(isGrey(map.palette.path)).toBe(true);
    expect(isGrey(map.palette.ruin)).toBe(true);
  });

  it("leaves the grist-gold signal vivid through the turn", () => {
    expect(resolveWorldMap("reach").palette.highlight).toBe(GRIST_GOLD);
    expect(resolveWorldMap("ashfall").palette.highlight).toBe(GRIST_GOLD);
    expect(isGrey(GRIST_GOLD)).toBe(false);
  });

  it("observably transforms the palette across the Reckoning", () => {
    expect(resolveWorldMap("ashfall").palette.land).not.toBe(
      resolveWorldMap("reach").palette.land
    );
  });
});

describe("resolveWorldMap — the same map, transformed", () => {
  it("resolves every registered region through the one flag (same map ids)", () => {
    const reachIds = resolveWorldMap("reach").regions.map(region => region.id);
    const ashfallIds = resolveWorldMap("ashfall").regions.map(
      region => region.id
    );
    expect(reachIds).toEqual([
      "marrow",
      "roots",
      "upper-vanta",
      "sylvemarch",
      "holtspire",
      "cinderfen",
      "wrack",
    ]);
    // The SAME map — identical region ids across the flag; only the read changes.
    expect(ashfallIds).toEqual(reachIds);
  });

  it("carries the flag it resolved through (world-state = ashfall everywhere)", () => {
    expect(resolveWorldMap("reach").worldState).toBe("reach");
    expect(resolveWorldMap("ashfall").worldState).toBe("ashfall");
  });

  it("reads verdant in reach and ashen everywhere in ashfall", () => {
    const reach = resolveWorldMap("reach");
    // The Cinderfen is authored ashen even in reach (ruin amid a living world), so the
    // reach map is NOT uniformly ashen — the whole map is not yet turned.
    expect(reach.regions.every(region => region.tone === "ashen")).toBe(false);
    const ashfall = resolveWorldMap("ashfall");
    // Once the world turns, every region reads its ashen variant — turned everywhere.
    expect(ashfall.regions.every(region => region.tone === "ashen")).toBe(true);
  });

  it("transforms the loved region's name across the Reckoning", () => {
    const reachName = resolveWorldMap("reach").regions.find(
      region => region.id === "sylvemarch"
    )?.name;
    const ashfallName = resolveWorldMap("ashfall").regions.find(
      region => region.id === "sylvemarch"
    )?.name;
    expect(reachName).toBe("The Sylvemarch Reach");
    expect(ashfallName).toBe("The Sylvemarch Ashfall");
  });
});

describe("resolveWorldMap — a loved place observably mourned", () => {
  it("targets the Sylvemarch's Sidhe Enclave", () => {
    const place = resolveWorldMap("reach").lovedPlace;
    expect(place.regionId).toBe("sylvemarch");
    expect(place.locationId).toBe("sidhe-enclave");
  });

  it("is not mourned while loved in Act I reach", () => {
    const place = resolveWorldMap("reach").lovedPlace;
    expect(place.mourned).toBe(false);
    expect(place.name).toBe(SIDHE_ENCLAVE);
    expect(place.lovedName).toBe(SIDHE_ENCLAVE);
    expect(place.name).toBe(place.lovedName);
  });

  it("is observably mourned once the world turns to ashfall", () => {
    const place = resolveWorldMap("ashfall").lovedPlace;
    expect(place.mourned).toBe(true);
    expect(place.lovedName).toBe(SIDHE_ENCLAVE);
    expect(place.name).toBe(`${SIDHE_ENCLAVE} (fled)`);
    // Observably mourned: the live name diverges from what it was called when loved.
    expect(place.name).not.toBe(place.lovedName);
  });
});

describe("hashWorldMap — determinism", () => {
  it("is stable for an identical flag across runs", () => {
    expect(hashWorldMap(resolveWorldMap("ashfall"))).toBe(
      hashWorldMap(resolveWorldMap("ashfall"))
    );
    expect(hashWorldMap(resolveWorldMap("reach"))).toBe(
      hashWorldMap(resolveWorldMap("reach"))
    );
  });

  it("changes when the world turns (the transform is observable in the digest)", () => {
    expect(hashWorldMap(resolveWorldMap("reach"))).not.toBe(
      hashWorldMap(resolveWorldMap("ashfall"))
    );
  });

  it("is an 8-character hex digest", () => {
    expect(hashWorldMap(resolveWorldMap("ashfall"))).toMatch(/^[0-9a-f]{8}$/);
  });
});
