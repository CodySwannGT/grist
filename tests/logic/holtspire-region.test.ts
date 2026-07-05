/**
 * Unit coverage for **Holtspire** (#130) — the Anvil-city, House Caldecott's rival
 * industrial city-state, authored as a {@link RegionDef} against the shipped
 * region-production framework (template #133, world-state #134, Bound-site template
 * #135, boot harness #137). This suite is the Phaser-free half of the Validation
 * Journey: it proves the authored DATA resolves correctly in both world-states, sites
 * Korrholt the Anvil-Heart, and digests deterministically through the pure harness,
 * mirroring the import style and conventions of `tests/logic/sylvemarch-region.test.ts`
 * (it imports ONLY from `../../src/content` and `../../src/logic/...` — ZERO Phaser,
 * FR9).
 *
 * The assertions track the issue's acceptance criteria:
 * - AC1: the `holtspire` region resolves its identity and key locations (the great
 *   foundry, the frame-yards, ripper row) in BOTH variants and passes
 *   {@link isCompleteRegion} / {@link validateRegion}.
 * - AC1: Ashfall is observably different from Reach — a different tone AND a
 *   different encounter set (the foundry banked and the fires gone cold).
 * - AC2: the region sites exactly one Bound — Korrholt, the Anvil-Heart (Iron); the
 *   free-vs-wield resolution itself is covered in `korrholt-bound-site.test.ts`.
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

const SEED = 0x4017;

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

describe("the Holtspire region (#130)", () => {
  it("is registered, sites Korrholt, and passes both-states validation", () => {
    const holtspire = REGIONS[RegionIds.holtspire];
    expect(holtspire.id).toBe("holtspire");
    // The region cages exactly one Bound: Korrholt, the Anvil-Heart.
    expect(holtspire.boundSite).toBe(BoundIds.korrholt);
    expect(validateRegion(holtspire)).toEqual([]);
    expect(isCompleteRegion(holtspire)).toBe(true);
  });

  it("resolves its identity and key locations in the Reach (Act I) variant", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.holtspire], "reach");
    expect(reach.name.length).toBeGreaterThan(0);
    expect(reach.tone).toBe("verdant");
    const names = reach.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The wiki-authoritative landmarks of Holtspire are present in the Reach.
    expect(names.some(name => name.includes("foundry"))).toBe(true);
    expect(names.some(name => name.includes("frame-yards"))).toBe(true);
    expect(reach.encounters.length).toBeGreaterThan(0);
  });

  it("resolves a warped identity and the same landmarks in the Ashfall (Act II) variant", () => {
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.holtspire],
      "ashfall"
    );
    expect(ashfall.name.length).toBeGreaterThan(0);
    expect(ashfall.tone).toBe("ashen");
    const names = ashfall.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The same places persist across the Reckoning (warped, but still the foundry
    // and the frame-yards).
    expect(names.some(name => name.includes("foundry"))).toBe(true);
    expect(names.some(name => name.includes("frame-yards"))).toBe(true);
    expect(ashfall.encounters.length).toBeGreaterThan(0);
  });

  it("makes Ashfall observably different from Reach (tone + encounter set)", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.holtspire], "reach");
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.holtspire],
      "ashfall"
    );
    // Different tone is the first observable divergence (verdant → ashen).
    expect(ashfall.tone).not.toBe(reach.tone);
    // The encounter tables differ as SETS (different ids and/or order), so the region
    // reads as a different place in Act II — the fires gone cold.
    const sortIds = (ids: readonly string[]): string =>
      [...ids].sort((a, b) => a.localeCompare(b)).join("|");
    expect(sortIds(ashfall.encounters)).not.toBe(sortIds(reach.encounters));
  });

  it("boots and walks the Reach encounter playlist to completion", () => {
    const booted = bootRegion(REGIONS[RegionIds.holtspire], SEED, "reach");
    expect(booted.regionId).toBe("holtspire");
    expect(booted.scene).toBe("region:holtspire");
    expect(booted.worldState).toBe("reach");
    expect(booted.phase).toBe(RegionPhases.exploring);

    const done = playToComplete(booted);
    expect(done.phase).toBe(RegionPhases.complete);
    expect(done.cleared).toEqual([
      ...REGIONS[RegionIds.holtspire].states.reach.encounters,
    ]);
  });

  it("is deterministic: same seed + actions ⇒ identical hash; a different seed diverges", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.holtspire], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.holtspire], SEED, "reach")
    );
    expect(hashRegionRun(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashRegionRun(b)).toBe(hashRegionRun(a));

    const c = playToComplete(
      bootRegion(REGIONS[RegionIds.holtspire], SEED + 1, "reach")
    );
    expect(hashRegionRun(c)).not.toBe(hashRegionRun(a));
  });

  it("resolves a different variant — and hash — once the Reckoning fires", () => {
    const reach = bootRegion(REGIONS[RegionIds.holtspire], SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    expect(ashfall.worldState).toBe("ashfall");
    // The Ashfall encounter table differs, so the digest diverges in place.
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
  });
});
