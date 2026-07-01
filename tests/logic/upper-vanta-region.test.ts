/**
 * Unit coverage for **upper Vanta — the Crown & the Tiers** (#128) — the FIRST of
 * Story #121's serial Act I regions, authored as a {@link RegionDef} against the
 * shipped region-production framework (template #133, world-state #134, boot harness
 * #137). This suite is the Phaser-free half of the Validation Journey: it proves the
 * authored DATA resolves correctly in both world-states and digests deterministically
 * through the pure harness, mirroring the import style and conventions of
 * `tests/logic/roots-region.test.ts` (it imports ONLY from `../../src/content` and
 * `../../src/logic/...` — ZERO Phaser, FR9).
 *
 * The assertions track the issue's acceptance criteria:
 * - The `upper-vanta` region resolves its identity and its Crown + Tiers key
 *   locations (Concord Hall, the Mourne refinery-spire, the Founding plaza; Tobi's
 *   workshop, the grand market, the Quill media-halls) in BOTH variants and passes
 *   {@link isCompleteRegion} / {@link validateRegion}.
 * - Ashfall is observably different from Reach — a different tone, a different
 *   encounter set (the half-collapsed grey Crown, the shuttered scavenger-run Tiers).
 * - Determinism: {@link bootRegion} + {@link hashRegionRun} reproduce an identical
 *   digest for the same seed + actions and diverge for a different seed.
 * - Unlike every other Act I region, upper Vanta cages NO Bound (its anchor is the
 *   Ch.5 keystone, covered by `tests/logic/keystone.test.ts`).
 */
import { describe, expect, it } from "vitest";

import {
  REGIONS,
  RegionIds,
  isCompleteRegion,
  resolveRegionVariant,
  validateRegion,
} from "../../src/content";
import {
  RegionActionKinds,
  RegionPhases,
  actRegion,
  bootRegion,
  hashRegionRun,
  type RegionRunState,
} from "../../src/logic/region";

const SEED = 0x5_a_17;

/** The Crown key locations upper Vanta must surface (wiki-authoritative). */
const CROWN_LOCATIONS = [
  "concord-hall",
  "mourne-refinery-spire",
  "founding-plaza",
];
/** The Tiers key locations upper Vanta must surface (wiki-authoritative). */
const TIERS_LOCATIONS = ["tobis-workshop", "grand-market", "quill-media-halls"];

/**
 * Drive the harness to completion by advancing until the run reports complete.
 * @param start - The booted (or partway) session to drive.
 * @returns The session once it has reached the `complete` phase.
 */
function playToComplete(start: RegionRunState): RegionRunState {
  let state = start;
  let guard = 0;
  while (state.phase !== RegionPhases.complete && guard < 100) {
    state = actRegion(state, { kind: RegionActionKinds.advance });
    guard += 1;
  }
  return state;
}

describe("upper Vanta — the Crown & the Tiers region (#128)", () => {
  it("is registered and passes both-states validation", () => {
    const vanta = REGIONS[RegionIds.upperVanta];
    expect(vanta.id).toBe("upper-vanta");
    expect(validateRegion(vanta)).toEqual([]);
    expect(isCompleteRegion(vanta)).toBe(true);
  });

  it("cages no Bound — the Crown consumes, it doesn't hold (no boundSite)", () => {
    expect(REGIONS[RegionIds.upperVanta].boundSite).toBeUndefined();
  });

  it("resolves its identity and Crown + Tiers key locations in the Reach (Act I) variant", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.upperVanta], "reach");
    expect(reach.name.length).toBeGreaterThan(0);
    expect(reach.tone).toBe("verdant");
    const ids = reach.keyLocations.map(location => location.id);
    for (const loc of [...CROWN_LOCATIONS, ...TIERS_LOCATIONS]) {
      expect(ids).toContain(loc);
    }
    expect(reach.encounters.length).toBeGreaterThan(0);
  });

  it("resolves a warped identity and the same landmarks in the Ashfall (Act II) variant", () => {
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.upperVanta],
      "ashfall"
    );
    expect(ashfall.name.length).toBeGreaterThan(0);
    expect(ashfall.tone).toBe("ashen");
    const ids = ashfall.keyLocations.map(location => location.id);
    // The same places persist across the Reckoning (the Crown grey, the Tiers
    // shuttered — but the same landmark ids).
    for (const loc of [...CROWN_LOCATIONS, ...TIERS_LOCATIONS]) {
      expect(ids).toContain(loc);
    }
    expect(ashfall.encounters.length).toBeGreaterThan(0);
  });

  it("makes Ashfall observably different from Reach (tone + encounter set + names)", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.upperVanta], "reach");
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.upperVanta],
      "ashfall"
    );
    // Different tone is the first observable divergence.
    expect(ashfall.tone).not.toBe(reach.tone);
    // The encounter tables differ as SETS (different ids and/or order), so the
    // region reads as a different place in Act II.
    const sortIds = (ids: readonly string[]): string =>
      [...ids].sort((a, b) => a.localeCompare(b)).join("|");
    expect(sortIds(ashfall.encounters)).not.toBe(sortIds(reach.encounters));
    // The refinery-spire is renamed after the keystone is struck.
    const spireName = (variant: typeof reach): string =>
      variant.keyLocations.find(l => l.id === "mourne-refinery-spire")!.name;
    expect(spireName(ashfall)).not.toBe(spireName(reach));
  });

  it("boots and walks the Reach encounter playlist to completion", () => {
    const booted = bootRegion(REGIONS[RegionIds.upperVanta], SEED, "reach");
    expect(booted.regionId).toBe("upper-vanta");
    expect(booted.scene).toBe("region:upper-vanta");
    expect(booted.worldState).toBe("reach");
    expect(booted.phase).toBe(RegionPhases.exploring);

    const done = playToComplete(booted);
    expect(done.phase).toBe(RegionPhases.complete);
    expect(done.cleared).toEqual([
      ...REGIONS[RegionIds.upperVanta].states.reach.encounters,
    ]);
  });

  it("is deterministic: same seed + actions ⇒ identical hash; a different seed diverges", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.upperVanta], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.upperVanta], SEED, "reach")
    );
    expect(hashRegionRun(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashRegionRun(b)).toBe(hashRegionRun(a));

    const c = playToComplete(
      bootRegion(REGIONS[RegionIds.upperVanta], SEED + 1, "reach")
    );
    expect(hashRegionRun(c)).not.toBe(hashRegionRun(a));
  });

  it("resolves a different variant — and hash — once the Reckoning fires", () => {
    const reach = bootRegion(REGIONS[RegionIds.upperVanta], SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    expect(ashfall.worldState).toBe("ashfall");
    // The Ashfall encounter table differs, so the digest diverges in place.
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
  });
});
