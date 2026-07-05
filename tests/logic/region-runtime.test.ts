/**
 * Unit coverage for the pure per-region boot/runtime harness
 * (`src/logic/region/region-runtime`, #137) — the reusable framework that boots a
 * region authored against the {@link RegionDef} template into a deterministic,
 * scene-agnostic "session" the `__VERIFY__` bridge drives with
 * `scene()` / `state()` / `act()` / `hash()`. The harness owns NO Phaser: it is a
 * total function of (region, seed, world-state, action sequence), so the same
 * inputs reproduce an identical hash progression — the determinism thesis the e2e
 * proves on the live canvas (`tests/e2e/region-harness.spec.ts`).
 *
 * ZERO Phaser imports by design (FR9) — exercised headless under vitest, mirroring
 * `region-cell` / `world-state-cell` coverage. The boot-throws negative path is
 * proven here (the compiler-forced incomplete region) AND on the live canvas.
 */
import { describe, expect, it } from "vitest";

import {
  EncounterIds,
  RegionIds,
  authorRegion,
  type RegionDef,
  type RegionVariant,
} from "../../src/content";
import { BoundIds } from "../../src/content";
import { REGIONS } from "../../src/content";
import {
  actRegion,
  bootRegion,
  hashRegionRun,
  RegionActionKinds,
  RegionPhases,
  regionScene,
  type RegionRunState,
} from "../../src/logic/region";

const SEED = 0x51ed;

/**
 * A complete reach variant fixture for the incomplete-region negative case.
 * @returns A reach variant (forced past the compiler to forge a broken region).
 */
function reachVariant(): RegionVariant {
  return {
    name: "Vale Reach",
    tone: "verdant",
    keyLocations: [{ id: "vale-gate", name: "Vale Gate" }],
    encounters: [],
    sideStories: [],
  } as unknown as RegionVariant;
}

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

describe("region-runtime — the per-region boot harness (#137)", () => {
  it("boots a template-authored region into a playable, scene-keyed session", () => {
    const state = bootRegion(REGIONS[RegionIds.marrow], SEED, "reach");
    // [region-e2e-harness-runs]: the region booted through the harness with a
    // region-scoped scene key and is exploring its first encounter, not complete.
    expect(state.regionId).toBe(RegionIds.marrow);
    expect(state.scene).toBe(regionScene(RegionIds.marrow));
    expect(state.scene).toBe("region:marrow");
    expect(state.worldState).toBe("reach");
    expect(state.phase).toBe(RegionPhases.exploring);
    expect(state.cleared).toEqual([]);
    expect(state.cursor).toBe(0);
  });

  it("advances through the resolved variant's encounter table to completion", () => {
    const booted = bootRegion(REGIONS[RegionIds.marrow], SEED, "reach");
    const reachEncounters =
      REGIONS[RegionIds.marrow].states.reach.encounters.length;
    const done = playToComplete(booted);
    // The harness walked the whole encounter playlist exactly once and finished.
    expect(done.phase).toBe(RegionPhases.complete);
    expect(done.cleared).toHaveLength(reachEncounters);
    expect(done.cleared).toEqual([
      ...REGIONS[RegionIds.marrow].states.reach.encounters,
    ]);
    // Advancing past completion is an idempotent no-op (no over-run).
    expect(actRegion(done, { kind: RegionActionKinds.advance })).toEqual(done);
  });

  it("is deterministic: same region + seed + action sequence ⇒ identical hash", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.marrow], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.marrow], SEED, "reach")
    );
    // Same seed + same actions ⇒ byte-identical terminal hash and an 8-hex digest.
    expect(hashRegionRun(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashRegionRun(b)).toBe(hashRegionRun(a));
  });

  it("threads a real RNG stream: a different seed diverges the hash", () => {
    const a = playToComplete(
      bootRegion(REGIONS[RegionIds.marrow], SEED, "reach")
    );
    const b = playToComplete(
      bootRegion(REGIONS[RegionIds.marrow], SEED + 1, "reach")
    );
    expect(hashRegionRun(b)).not.toBe(hashRegionRun(a));
  });

  it("samples a non-trivial hash progression as the session advances", () => {
    let state = bootRegion(REGIONS[RegionIds.marrow], SEED, "reach");
    const progression = [hashRegionRun(state)];
    while (state.phase !== RegionPhases.complete) {
      state = actRegion(state, { kind: RegionActionKinds.advance });
      progression.push(hashRegionRun(state));
    }
    // The progression moved through more than one distinct state-hash (a real
    // multi-step run, not a no-op pass) — the scene-agnostic analogue of the
    // battle state-hash gate.
    expect(progression.length).toBeGreaterThan(1);
    expect(new Set(progression).size).toBeGreaterThan(1);
  });

  it("resolves a different variant — and hash — once the Reckoning fires", () => {
    const reach = bootRegion(REGIONS[RegionIds.marrow], SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    // The same booted region warps to its Ashfall variant in place (no re-boot),
    // and the variant's distinct encounter table yields a distinct hash.
    expect(ashfall.worldState).toBe("ashfall");
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
    // The Reckoning consumed no progress — the cursor/cleared are untouched.
    expect(ashfall.cursor).toBe(reach.cursor);
    expect(ashfall.cleared).toEqual(reach.cleared);
  });

  it("throws on boot when the region is incomplete (missing a variant)", () => {
    const broken = {
      id: "broken",
      boundSite: BoundIds.emberwisp,
      states: { reach: reachVariant() },
    } as unknown as RegionDef;
    // [region-boot-no-console-errors]: a region that fails both-states validation
    // throws on boot — the harness rejects it rather than booting a broken scene.
    expect(() => bootRegion(broken, SEED, "reach")).toThrow(
      /incomplete|ashfall/i
    );
  });

  it("boots an arbitrary author-supplied region (the harness is per-region, not Marrow-pinned)", () => {
    const vale = authorRegion({
      id: "vale",
      boundSite: BoundIds.emberwisp,
      states: {
        reach: {
          name: "Vale Reach",
          tone: "verdant",
          keyLocations: [{ id: "vale-gate", name: "Vale Gate" }],
          encounters: [EncounterIds.warrenStreet],
          sideStories: [],
        } as unknown as RegionVariant,
        ashfall: {
          name: "Vale Ashfall",
          tone: "ashen",
          keyLocations: [{ id: "vale-ash", name: "Vale Ash" }],
          encounters: [EncounterIds.theCage],
          sideStories: [],
        } as unknown as RegionVariant,
      },
    });
    const state = bootRegion(vale, SEED, "reach");
    // The harness boots an entirely different authored region — its own scene key,
    // its own encounter playlist — proving it reads the region's data, not Marrow's.
    expect(state.scene).toBe("region:vale");
    // Until per-region art exists, every region resolves to the shared placeholder
    // backdrop key the Preloader generates — an asset the loader can actually load
    // (the run state never claims a per-region texture Phaser can't resolve).
    expect(state.backdrop).toBe("img-marrow/bg-far");
    expect(state.phase).toBe(RegionPhases.exploring);
    const done = playToComplete(state);
    expect(done.cleared).toEqual([EncounterIds.warrenStreet]);
    // A region authored with a distinct id digests distinctly from Marrow under the
    // same seed — the per-region streams don't collide.
    expect(hashRegionRun(done)).not.toBe(
      hashRegionRun(
        playToComplete(bootRegion(REGIONS[RegionIds.marrow], SEED, "reach"))
      )
    );
  });
});
