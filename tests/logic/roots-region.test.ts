/**
 * Unit coverage for **the Roots / the Deep** region (#143) — the buried
 * pre-Sundering ruins authored as a {@link RegionDef} against the shipped
 * region-production framework (template #133, world-state #134, family schema #138,
 * boot harness #137). This suite is the Phaser-free half of the Validation Journey:
 * it proves the authored DATA resolves correctly in both world-states and digests
 * deterministically through the pure harness, mirroring the import style and
 * conventions of `tests/logic/region-runtime.test.ts` (it imports ONLY from
 * `../../src/content` and `../../src/logic/...` — ZERO Phaser, FR9).
 *
 * The assertions track the issue's acceptance criteria:
 * - AC1: the `roots` region resolves its identity and key locations (the drowned
 *   old kingdom + the Sidhe requiem-hall) in BOTH variants and passes
 *   {@link isCompleteRegion} / {@link validateRegion}.
 * - AC2: Ashfall is observably different from Reach — a different tone, a different
 *   encounter set, and at least one enemy-family Ashfall variant carrying a Gloom
 *   attack (read through {@link resolveFamilyStatBlock}).
 * - Determinism: {@link bootRegion} + {@link hashRegionRun} reproduce an identical
 *   digest for the same seed + actions and diverge for a different seed.
 */
import { describe, expect, it } from "vitest";

import {
  ENEMY_FAMILIES,
  REGIONS,
  RegionIds,
  isCompleteRegion,
  resolveFamilyStatBlock,
  resolveRegionVariant,
  validateRegion,
  type AshfallVariant,
} from "../../src/content";
import {
  actRegion,
  bootRegion,
  hashRegionRun,
  RegionActionKinds,
  RegionPhases,
  type RegionRunState,
} from "../../src/logic/region";

const SEED = 0x51ed;

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

/**
 * Whether a resolved family stat block is an Ashfall variant carrying at least one
 * Gloom attack — the runtime read of "the Reckoning warped this family". Narrows the
 * `RegionStatBlock | AshfallVariant | null` union to an {@link AshfallVariant} so the
 * `attacks` array is type-safe to inspect.
 * @param block - The block resolved by {@link resolveFamilyStatBlock}.
 * @returns True when `block` is an Ashfall variant with a Gloom attack.
 */
function hasGloomAttack(
  block: ReturnType<typeof resolveFamilyStatBlock>
): boolean {
  const variant = block as AshfallVariant | null;
  if (variant === null || !Array.isArray(variant.attacks)) {
    return false;
  }
  return variant.attacks.some(attack => attack.element === "gloom");
}

describe("the Roots / the Deep region (#143)", () => {
  it("is registered and passes both-states validation", () => {
    const roots = REGIONS[RegionIds.roots];
    expect(roots.id).toBe("roots");
    expect(validateRegion(roots)).toEqual([]);
    expect(isCompleteRegion(roots)).toBe(true);
  });

  it("resolves its identity and key locations in the Reach (Act I) variant", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.roots], "reach");
    expect(reach.name.length).toBeGreaterThan(0);
    expect(reach.tone).toBe("verdant");
    const names = reach.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The two wiki-authoritative landmarks of the Roots are present in the Reach.
    expect(names.some(name => name.includes("drowned old kingdom"))).toBe(true);
    expect(names.some(name => name.includes("requiem-hall"))).toBe(true);
    expect(reach.encounters.length).toBeGreaterThan(0);
  });

  it("resolves a warped identity and the same landmarks in the Ashfall (Act II) variant", () => {
    const ashfall = resolveRegionVariant(REGIONS[RegionIds.roots], "ashfall");
    expect(ashfall.name.length).toBeGreaterThan(0);
    expect(ashfall.tone).toBe("ashen");
    const names = ashfall.keyLocations.map(location =>
      location.name.toLowerCase()
    );
    // The same places persist across the Reckoning (warped names are still the
    // drowned kingdom and the requiem-hall).
    expect(names.some(name => name.includes("drowned old kingdom"))).toBe(true);
    expect(names.some(name => name.includes("requiem-hall"))).toBe(true);
    expect(ashfall.encounters.length).toBeGreaterThan(0);
  });

  it("makes Ashfall observably different from Reach (tone + encounter set)", () => {
    const reach = resolveRegionVariant(REGIONS[RegionIds.roots], "reach");
    const ashfall = resolveRegionVariant(REGIONS[RegionIds.roots], "ashfall");
    // Different tone is the first observable divergence.
    expect(ashfall.tone).not.toBe(reach.tone);
    // The encounter tables differ as SETS (different ids and/or order), so the
    // region reads as a different place in Act II.
    const sortIds = (ids: readonly string[]): string =>
      [...ids].sort((a, b) => a.localeCompare(b)).join("|");
    expect(sortIds(ashfall.encounters)).not.toBe(sortIds(reach.encounters));
  });

  it("sites at least one Roots enemy family whose Ashfall variant carries a Gloom attack", () => {
    // Find every family that authors a Roots region entry, then assert at least one
    // resolves to an Ashfall variant carrying a Gloom attack — the warped read.
    const rootsFamilies = Object.values(ENEMY_FAMILIES).filter(family =>
      family.regions.some(entry => entry.region === "roots")
    );
    expect(rootsFamilies.length).toBeGreaterThan(0);

    const anyGloom = rootsFamilies.some(family =>
      hasGloomAttack(resolveFamilyStatBlock(family, "roots", "ashfall"))
    );
    expect(anyGloom).toBe(true);

    // The Reach read of the SAME family carries no Gloom attack (it is the base
    // stat block, not an Ashfall variant) — the variant is observably different.
    const reachBlock = resolveFamilyStatBlock(
      rootsFamilies[0]!,
      "roots",
      "reach"
    );
    expect(hasGloomAttack(reachBlock)).toBe(false);
  });

  it("boots and walks the Reach encounter playlist to completion", () => {
    const booted = bootRegion(REGIONS[RegionIds.roots], SEED, "reach");
    expect(booted.regionId).toBe("roots");
    expect(booted.scene).toBe("region:roots");
    expect(booted.worldState).toBe("reach");
    expect(booted.phase).toBe(RegionPhases.exploring);

    const done = playToComplete(booted);
    expect(done.phase).toBe(RegionPhases.complete);
    expect(done.cleared).toEqual([
      ...REGIONS[RegionIds.roots].states.reach.encounters,
    ]);
  });

  it("is deterministic: same seed + actions ⇒ identical hash; a different seed diverges", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.roots], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.roots], SEED, "reach")
    );
    expect(hashRegionRun(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashRegionRun(b)).toBe(hashRegionRun(a));

    const c = playToComplete(
      bootRegion(REGIONS[RegionIds.roots], SEED + 1, "reach")
    );
    expect(hashRegionRun(c)).not.toBe(hashRegionRun(a));
  });

  it("resolves a different variant — and hash — once the Reckoning fires", () => {
    const reach = bootRegion(REGIONS[RegionIds.roots], SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    expect(ashfall.worldState).toBe("ashfall");
    // The Ashfall encounter table differs, so the digest diverges in place.
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
  });
});
