/**
 * Unit coverage for **the Sylvemarch** region (#129) — the surviving forest, the
 * Green Mother's march, authored as a {@link RegionDef} against the shipped
 * region-production framework (template #133, world-state #134, Bound-site template
 * #135, boot harness #137). This suite is the Phaser-free half of the Validation
 * Journey: it proves the authored DATA resolves correctly in both world-states,
 * sites Sylvath the Green Wyrm, and digests deterministically through the pure
 * harness, mirroring the import style and conventions of
 * `tests/logic/roots-region.test.ts` (it imports ONLY from `../../src/content` and
 * `../../src/logic/...` — ZERO Phaser, FR9).
 *
 * The assertions track the issue's acceptance criteria:
 * - AC1: the `sylvemarch` region resolves its identity and key locations (the Sidhe
 *   enclave, the Weave-spring, the overgrown ruins) in BOTH variants and passes
 *   {@link isCompleteRegion} / {@link validateRegion}.
 * - AC1: Ashfall is observably different from Reach — a different tone AND a
 *   different encounter set (the forest greying and dying across the Reckoning).
 * - AC2: the region sites exactly one Bound — Sylvath, the Green Wyrm (Bloom); the
 *   free-vs-wield resolution itself is covered in `sylvath-bound-site.test.ts`.
 * - Determinism: {@link bootRegion} + {@link hashRegionRun} reproduce an identical
 *   digest for the same seed + actions and diverge for a different seed.
 */
import { describe, expect, it } from "vitest";

import {
  BoundIds,
  REGIONS,
  RegionIds,
  isCompleteRegion,
  resolveRegionVariant,
  validateRegion,
} from "../../src/content";
import {
  actRegion,
  bootRegion,
  hashRegionRun,
  RegionActionKinds,
  RegionPhases,
  type RegionRunState,
} from "../../src/logic/region";

const SEED = 0x5417;

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

describe("the Sylvemarch region (#129)", () => {
  it("is registered, sites Sylvath, and passes both-states validation", () => {
    const sylvemarch = REGIONS[RegionIds.sylvemarch];
    expect(sylvemarch.id).toBe("sylvemarch");
    // The region cages exactly one Bound: Sylvath, the Green Wyrm.
    expect(sylvemarch.boundSite).toBe(BoundIds.sylvath);
    expect(validateRegion(sylvemarch)).toEqual([]);
    expect(isCompleteRegion(sylvemarch)).toBe(true);
  });

  it("resolves its identity and key locations in the Reach (Act I) variant", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.sylvemarch], "reach");
    expect(reach.name.length).toBeGreaterThan(0);
    // The Reach is the brightest, most alive place in Act I — the verdant read.
    expect(reach.tone).toBe("verdant");
    const names = reach.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The wiki-authoritative landmarks of the Sylvemarch are present in the Reach.
    expect(names.some(name => name.includes("sidhe enclave"))).toBe(true);
    expect(names.some(name => name.includes("weave-spring"))).toBe(true);
    expect(reach.encounters.length).toBeGreaterThan(0);
  });

  it("resolves a warped identity and the same landmarks in the Ashfall (Act II) variant", () => {
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.sylvemarch],
      "ashfall"
    );
    expect(ashfall.name.length).toBeGreaterThan(0);
    // The forest greying and dying — the ashen read.
    expect(ashfall.tone).toBe("ashen");
    const names = ashfall.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The same places persist across the Reckoning (warped, but still the enclave
    // and the Weave-spring).
    expect(names.some(name => name.includes("sidhe enclave"))).toBe(true);
    expect(names.some(name => name.includes("weave-spring"))).toBe(true);
    expect(ashfall.encounters.length).toBeGreaterThan(0);
  });

  it("makes Ashfall observably different from Reach (tone + encounter set)", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.sylvemarch], "reach");
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.sylvemarch],
      "ashfall"
    );
    // Different tone is the first observable divergence (verdant → ashen).
    expect(ashfall.tone).not.toBe(reach.tone);
    // The encounter tables differ as SETS (different ids and/or order), so the
    // region reads as a different place in Act II — its most painful transformation.
    const sortIds = (ids: readonly string[]): string =>
      [...ids].sort((a, b) => a.localeCompare(b)).join("|");
    expect(sortIds(ashfall.encounters)).not.toBe(sortIds(reach.encounters));
  });

  it("boots and walks the Reach encounter playlist to completion", () => {
    const booted = bootRegion(REGIONS[RegionIds.sylvemarch], SEED, "reach");
    expect(booted.regionId).toBe("sylvemarch");
    expect(booted.scene).toBe("region:sylvemarch");
    expect(booted.worldState).toBe("reach");
    expect(booted.phase).toBe(RegionPhases.exploring);

    const done = playToComplete(booted);
    expect(done.phase).toBe(RegionPhases.complete);
    expect(done.cleared).toEqual([
      ...REGIONS[RegionIds.sylvemarch].states.reach.encounters,
    ]);
  });

  it("is deterministic: same seed + actions ⇒ identical hash; a different seed diverges", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.sylvemarch], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.sylvemarch], SEED, "reach")
    );
    expect(hashRegionRun(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashRegionRun(b)).toBe(hashRegionRun(a));

    const c = playToComplete(
      bootRegion(REGIONS[RegionIds.sylvemarch], SEED + 1, "reach")
    );
    expect(hashRegionRun(c)).not.toBe(hashRegionRun(a));
  });

  it("resolves a different variant — and hash — once the Reckoning fires", () => {
    const reach = bootRegion(REGIONS[RegionIds.sylvemarch], SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    expect(ashfall.worldState).toBe("ashfall");
    // The Ashfall encounter table differs, so the digest diverges in place.
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
  });
});
