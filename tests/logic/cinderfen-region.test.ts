/**
 * Unit coverage for the **Cinderfen** — the ashlands (#131), the strip-mined,
 * magic-dead wastes of abandoned grist-mines and dead refineries, authored as a
 * {@link RegionDef} against the shipped region-production framework (template #133,
 * world-state #134, Bound-site template #135, boot harness #137). This suite is the
 * Phaser-free half of the Validation Journey: it proves the authored DATA resolves
 * correctly in both world-states, sites Morrath the Cinder-bound, and digests
 * deterministically through the pure harness, mirroring the import style and
 * conventions of `tests/logic/holtspire-region.test.ts` (it imports ONLY from
 * `../../src/content` and `../../src/logic/...` — ZERO Phaser, FR9).
 *
 * The assertions track the issue's acceptance criteria:
 * - AC1: the `cinderfen` region resolves its identity and key locations (the
 *   abandoned grist-mines, the Ashfast enclave, the bones of a felled Bound) in BOTH
 *   variants and passes {@link isCompleteRegion} / {@link validateRegion}.
 * - AC1: Ashfall is observably different from Reach. Unlike the other regions the
 *   Cinderfen is ALREADY ruin in the Reach and BARELY changes across the Reckoning
 *   ("now the rest of the world looks like it"), so its two variants share the
 *   `ashen` tone BY DESIGN — the observable divergence is the ENCOUNTER SET (the
 *   strip-mines still picked over in the Reach, gone to silent haunted cinder-wastes
 *   in the Ashfall), which is what makes the run digest differently across the flag.
 * - AC2: the region sites exactly one Bound — Morrath, the Cinder-bound (Ash); the
 *   free-vs-wield resolution itself is covered in `morrath-bound-site.test.ts`.
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

const SEED = 0xc1de;

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

describe("the Cinderfen region (#131)", () => {
  it("is registered, sites Morrath, and passes both-states validation", () => {
    const cinderfen = REGIONS[RegionIds.cinderfen];
    expect(cinderfen.id).toBe("cinderfen");
    // The region cages exactly one Bound: Morrath, the Cinder-bound.
    expect(cinderfen.boundSite).toBe(BoundIds.morrath);
    expect(validateRegion(cinderfen)).toEqual([]);
    expect(isCompleteRegion(cinderfen)).toBe(true);
  });

  it("resolves its identity and key locations in the Reach (Act I) variant", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.cinderfen], "reach");
    expect(reach.name.length).toBeGreaterThan(0);
    // The Cinderfen is already ruin amid a still-living world — ashen even in Act I.
    expect(reach.tone).toBe("ashen");
    const names = reach.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The wiki-authoritative landmarks of the Cinderfen are present in the Reach.
    expect(names.some(name => name.includes("grist-mines"))).toBe(true);
    expect(names.some(name => name.includes("ashfast enclave"))).toBe(true);
    expect(reach.encounters.length).toBeGreaterThan(0);
  });

  it("resolves the same landmarks, barely changed, in the Ashfall (Act II) variant", () => {
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.cinderfen],
      "ashfall"
    );
    expect(ashfall.name.length).toBeGreaterThan(0);
    // Barely changed — now the rest of the world looks like it: still ashen.
    expect(ashfall.tone).toBe("ashen");
    const names = ashfall.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The same places persist across the Reckoning (the grist-mines and the enclave).
    expect(names.some(name => name.includes("grist-mines"))).toBe(true);
    expect(names.some(name => name.includes("ashfast enclave"))).toBe(true);
    expect(ashfall.encounters.length).toBeGreaterThan(0);
  });

  it("makes Ashfall observably different from Reach via the encounter set (tone is ashen in both by design)", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.cinderfen], "reach");
    const ashfall = resolveRegionVariant(
      REGIONS[RegionIds.cinderfen],
      "ashfall"
    );
    // The Cinderfen is the region that BARELY changes across the Reckoning — already
    // fallen in the Reach — so both variants share the `ashen` tone on purpose.
    expect(reach.tone).toBe("ashen");
    expect(ashfall.tone).toBe("ashen");
    // The observable divergence is therefore the encounter table: it differs as a
    // SET (different ids and/or order), so the region reads — and digests — as a
    // different place in Act II even though its tone is unchanged.
    const sortIds = (ids: readonly string[]): string =>
      [...ids].sort((a, b) => a.localeCompare(b)).join("|");
    expect(sortIds(ashfall.encounters)).not.toBe(sortIds(reach.encounters));
  });

  it("boots and walks the Reach encounter playlist to completion", () => {
    const booted = bootRegion(REGIONS[RegionIds.cinderfen], SEED, "reach");
    expect(booted.regionId).toBe("cinderfen");
    expect(booted.scene).toBe("region:cinderfen");
    expect(booted.worldState).toBe("reach");
    expect(booted.phase).toBe(RegionPhases.exploring);

    const done = playToComplete(booted);
    expect(done.phase).toBe(RegionPhases.complete);
    expect(done.cleared).toEqual([
      ...REGIONS[RegionIds.cinderfen].states.reach.encounters,
    ]);
  });

  it("is deterministic: same seed + actions ⇒ identical hash; a different seed diverges", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.cinderfen], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.cinderfen], SEED, "reach")
    );
    expect(hashRegionRun(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashRegionRun(b)).toBe(hashRegionRun(a));

    const c = playToComplete(
      bootRegion(REGIONS[RegionIds.cinderfen], SEED + 1, "reach")
    );
    expect(hashRegionRun(c)).not.toBe(hashRegionRun(a));
  });

  it("resolves a different variant — and hash — once the Reckoning fires", () => {
    const reach = bootRegion(REGIONS[RegionIds.cinderfen], SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    expect(ashfall.worldState).toBe("ashfall");
    // The Ashfall encounter table differs, so the digest diverges in place — the
    // region digests as a different place across the Reckoning even at ashen→ashen.
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
  });
});
