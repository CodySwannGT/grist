/**
 * Unit coverage for the **Wrack** — the Sundering coast (#132), the broken tidal
 * coast where the Sundering's wound is rawest, home to an oblivion-cult that courts
 * the end, authored as a {@link RegionDef} against the shipped region-production
 * framework (template #133, world-state #134, Bound-site template #135, boot harness
 * #137). This suite is the Phaser-free half of the Validation Journey: it proves the
 * authored DATA resolves correctly in both world-states, sites Threnos the Unmade,
 * and digests deterministically through the pure harness, mirroring the import style
 * and conventions of `tests/logic/cinderfen-region.test.ts` (it imports ONLY from
 * `../../src/content` and `../../src/logic/...` — ZERO Phaser, FR9).
 *
 * The assertions track the issue's acceptance criteria:
 * - AC1: the `wrack` region resolves its identity and key locations (the
 *   Sundering-scar, the oblivion-cult's hold, the sunken Choir-shrine) in BOTH
 *   variants and passes {@link isCompleteRegion} / {@link validateRegion}.
 * - AC1: Ashfall is observably different from Reach. The Wrack DOES turn across the
 *   Reckoning — `verdant` (the Reach: the raw scar and the cult's hold) → `ashen`
 *   (the Ashfall: the sea pulling back, the scar widening — the edge of the end) —
 *   AND its encounter set diverges (the retreating sea lays the drowned Choir-shrine
 *   bare), so the region reads and digests as two places.
 * - AC2: the region sites exactly one Bound — Threnos, the Unmade (Gloom); the
 *   free-vs-wield resolution itself is covered in `threnos-bound-site.test.ts`.
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

const SEED = 0x77ac;

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

describe("the Wrack region (#132)", () => {
  it("is registered, sites Threnos, and passes both-states validation", () => {
    const wrack = REGIONS[RegionIds.wrack];
    expect(wrack.id).toBe("wrack");
    // The region cages exactly one Bound: Threnos, the Unmade.
    expect(wrack.boundSite).toBe(BoundIds.threnos);
    expect(validateRegion(wrack)).toEqual([]);
    expect(isCompleteRegion(wrack)).toBe(true);
  });

  it("resolves its identity and key locations in the Reach (Act I) variant", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.wrack], "reach");
    expect(reach.name.length).toBeGreaterThan(0);
    // Act I read of the Sundering coast — the raw scar and the cult still holding.
    expect(reach.tone).toBe("verdant");
    const names = reach.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The wiki-authoritative landmarks of the Wrack are present in the Reach.
    expect(names.some(name => name.includes("sundering-scar"))).toBe(true);
    expect(names.some(name => name.includes("oblivion-cult"))).toBe(true);
    expect(names.some(name => name.includes("choir-shrine"))).toBe(true);
    expect(reach.encounters.length).toBeGreaterThan(0);
  });

  it("resolves the same landmarks, warped, in the Ashfall (Act II) variant", () => {
    const ashfall = resolveRegionVariant(REGIONS[RegionIds.wrack], "ashfall");
    expect(ashfall.name.length).toBeGreaterThan(0);
    // Act II read — the edge of the end: the map has gone ashen.
    expect(ashfall.tone).toBe("ashen");
    const names = ashfall.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The same places persist across the Reckoning (the scar and the Choir-shrine).
    expect(names.some(name => name.includes("sundering-scar"))).toBe(true);
    expect(names.some(name => name.includes("choir-shrine"))).toBe(true);
    expect(ashfall.encounters.length).toBeGreaterThan(0);
  });

  it("makes Ashfall observably different from Reach — in BOTH tone and encounter set", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.wrack], "reach");
    const ashfall = resolveRegionVariant(REGIONS[RegionIds.wrack], "ashfall");
    // The Wrack turns across the Reckoning: verdant (Act I) → ashen (Act II).
    expect(reach.tone).toBe("verdant");
    expect(ashfall.tone).toBe("ashen");
    expect(ashfall.tone).not.toBe(reach.tone);
    // AND the encounter table diverges as a SET (different ids and/or order), so the
    // region reads — and digests — as a different place in Act II.
    const sortIds = (ids: readonly string[]): string =>
      [...ids].sort((a, b) => a.localeCompare(b)).join("|");
    expect(sortIds(ashfall.encounters)).not.toBe(sortIds(reach.encounters));
  });

  it("boots and walks the Reach encounter playlist to completion", () => {
    const booted = bootRegion(REGIONS[RegionIds.wrack], SEED, "reach");
    expect(booted.regionId).toBe("wrack");
    expect(booted.scene).toBe("region:wrack");
    expect(booted.worldState).toBe("reach");
    expect(booted.phase).toBe(RegionPhases.exploring);

    const done = playToComplete(booted);
    expect(done.phase).toBe(RegionPhases.complete);
    expect(done.cleared).toEqual([
      ...REGIONS[RegionIds.wrack].states.reach.encounters,
    ]);
  });

  it("is deterministic: same seed + actions ⇒ identical hash; a different seed diverges", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.wrack], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.wrack], SEED, "reach")
    );
    expect(hashRegionRun(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashRegionRun(b)).toBe(hashRegionRun(a));

    const c = playToComplete(
      bootRegion(REGIONS[RegionIds.wrack], SEED + 1, "reach")
    );
    expect(hashRegionRun(c)).not.toBe(hashRegionRun(a));
  });

  it("resolves a different variant — and hash — once the Reckoning fires", () => {
    const reach = bootRegion(REGIONS[RegionIds.wrack], SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    expect(ashfall.worldState).toBe("ashfall");
    // The Ashfall encounter table differs, so the digest diverges in place — the
    // region digests as a different place across the Reckoning.
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
  });
});
