/**
 * Increment-level unit twin for **the Roots / the Deep** vertical slice (#147) —
 * the Phaser-free half of the increment integration gate. Where the per-piece
 * suites prove each part in isolation (`roots-region.test.ts` #143 the region +
 * encounter tables, `velith-bound-site.test.ts` #144 the Velith free-vs-wield
 * resolution, `requiem-hall.test.ts` #145 the set-piece), THIS suite proves the
 * three pillars the issue's binding deliverables call out compose into ONE
 * continuous, deterministic increment:
 *
 *   1. The roots **encounter tables** — the enemy families an increment play-through
 *      fights — resolve in both world-states (the `advance`-through-each-family
 *      ladder the e2e drives), and the booted roots run walks its whole playlist to
 *      completion.
 *   2. **Velith free-vs-wield resolution** — reached at the end of the roots run —
 *      forks measurably (free: weaker, karma+, no corruption; wield: stronger,
 *      karma−, accruing corruption), the choice the e2e persists.
 *   3. The **world-state reads digest deterministically**: the SAME seed + SAME
 *      action sequence replayed across the roots region reproduces a byte-for-byte
 *      identical `hashRegionRun` progression (and a different seed diverges) — the
 *      headless twin of the `__VERIFY__.hash()` determinism gate.
 *
 * It imports ONLY from `../../src/content` and `../../src/logic/...` — ZERO Phaser
 * (FR9) — mirroring `roots-region.test.ts` / `combat-determinism.test.ts`. This is
 * the increment-level integration assertion; it does not re-assert the per-piece
 * specs' isolated facts, it proves they hold together as one play-through.
 *
 * Evidence: the e2e markers this unit twin backs are
 * `[EVIDENCE: roots-e2e-play-to-velith]` and `[EVIDENCE: roots-determinism-hash-stable]`
 * in `tests/e2e/roots-increment.spec.ts`.
 */
import { describe, expect, it } from "vitest";

import {
  BOUNDS,
  BoundIds,
  ENEMY_FAMILIES,
  REGIONS,
  RegionIds,
  resolveFamilyStatBlock,
  resolveRegionVariant,
} from "../../src/content";
import { newMoralLedger } from "../../src/logic/free-vs-wield";
import {
  actRegion,
  bootRegion,
  chooseAtBoundSite,
  hashRegionRun,
  isBoundSiteSettled,
  openBoundSite,
  RegionActionKinds,
  RegionPhases,
  type RegionRunState,
} from "../../src/logic/region";

/** The fixed increment seed — the same `0x51ed` the per-region specs pin to. */
const SEED = 0x51ed;
/** The Roots / the Deep region the increment plays through. */
const ROOTS = REGIONS[RegionIds.roots];
/** The Bound the roots run reaches at its end: Velith, the Deep-bound. */
const VELITH = BoundIds.velithDeepbound;

/**
 * The fixed increment action script: advance through the roots encounter ladder
 * (fighting its enemy families), fire the Reckoning mid-run, then advance once more
 * against the warped Ashfall variant — the headless analogue of the e2e's driven
 * sequence. A constant so both runs replay the identical sequence.
 */
const SCRIPT = [
  { kind: RegionActionKinds.advance },
  { kind: RegionActionKinds.advance },
  { kind: RegionActionKinds.reckon },
  { kind: RegionActionKinds.advance },
] as const;

/**
 * Replay the roots region under a seed, sampling {@link hashRegionRun} at boot and
 * after each scripted action — the per-step digest progression the determinism gate
 * compares across two runs (and across the e2e's `__VERIFY__.hash()` lane).
 * @param seed - The 32-bit region seed.
 * @returns The hash sampled at boot and after each driven action.
 */
function sampleHashes(seed: number): readonly string[] {
  let state = bootRegion(ROOTS, seed, "reach");
  const hashes: string[] = [hashRegionRun(state)];
  for (const action of SCRIPT) {
    state = actRegion(state, action);
    hashes.push(hashRegionRun(state));
  }
  return hashes;
}

/**
 * Drive the booted roots run to completion by advancing until it reports complete —
 * the "fight through every roots encounter family" ladder, headless.
 * @param start - The booted roots session.
 * @returns The session once it reaches the `complete` phase.
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

describe("Roots increment — the encounter ladder the play-through fights (#147)", () => {
  it("sites at least one roots enemy family to fight, resolvable in both world-states", () => {
    // The families an increment play-through advances through: every family that
    // authors a roots-region block. The increment fights this ladder.
    const rootsFamilies = Object.values(ENEMY_FAMILIES).filter(family =>
      family.regions.some(entry => entry.region === "roots")
    );
    expect(rootsFamilies.length).toBeGreaterThan(0);

    // Each roots family resolves a stat block in BOTH world-states (the run reads
    // them as it advances through Reach then, post-Reckoning, Ashfall).
    for (const family of rootsFamilies) {
      expect(resolveFamilyStatBlock(family, "roots", "reach")).not.toBeNull();
      expect(resolveFamilyStatBlock(family, "roots", "ashfall")).not.toBeNull();
    }
  });

  it("boots the roots run and walks its whole Reach encounter playlist to completion", () => {
    const booted = bootRegion(ROOTS, SEED, "reach");
    expect(booted.regionId).toBe("roots");
    expect(booted.scene).toBe("region:roots");
    expect(booted.phase).toBe(RegionPhases.exploring);

    const done = playToComplete(booted);
    expect(done.phase).toBe(RegionPhases.complete);
    // It cleared exactly the Reach variant's authored encounter table, in order —
    // the increment fought the whole roots playlist.
    expect(done.cleared).toEqual([
      ...resolveRegionVariant(ROOTS, "reach").encounters,
    ]);
  });
});

describe("Roots increment — Velith free-vs-wield at the run's end (#147)", () => {
  it("the roots run reaches Velith's site (the increment's moral fork)", () => {
    const opened = openBoundSite(ROOTS, newMoralLedger());
    expect(opened.shard).toBe(VELITH);
    expect(opened.regionId).toBe("roots");
    expect(isBoundSiteSettled(opened)).toBe(false);
  });

  it("free and wield fork measurably — the choice the increment persists", () => {
    const ledger = newMoralLedger();
    const free = chooseAtBoundSite(openBoundSite(ROOTS, ledger), "free");
    const wield = chooseAtBoundSite(openBoundSite(ROOTS, ledger), "wield");

    // Free: weaker carry, karma+, no corruption.
    expect(free.choice).toEqual({
      resolved: true,
      shard: VELITH,
      variant: "free",
    });
    expect(free.corruptionAccrued).toBe(0);
    expect(free.ledger.karma).toBe(1);

    // Wield: stronger carry, karma−, accruing corruption (Velith is near-free but
    // its wield cost is non-zero).
    expect(wield.choice).toEqual({
      resolved: true,
      shard: VELITH,
      variant: "wield",
    });
    expect(wield.corruptionAccrued).toBeGreaterThan(0);
    expect(wield.corruptionAccrued).toBe(
      BOUNDS[VELITH].variants.wield.corruptionRate
    );
    expect(wield.ledger.karma).toBe(-1);

    // The forks are measurably distinct — the persisted payload differs by variant,
    // karma, and corruption (what reload-persistence round-trips on the e2e).
    expect(wield.choice.variant).not.toBe(free.choice.variant);
    expect(wield.ledger.karma).not.toBe(free.ledger.karma);
    expect(wield.corruptionAccrued).not.toBe(free.corruptionAccrued);
  });
});

describe("Roots increment — world-state reads digest deterministically (#147)", () => {
  it("same seed + same action sequence ⇒ a byte-for-byte identical hash progression", () => {
    const first = sampleHashes(SEED);
    const second = sampleHashes(SEED);

    // Every sample is a well-formed 8-hex digest, and the two independent replays
    // are byte-for-byte identical (the determinism gate, AC scenario 2).
    expect(first.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);
    expect(second).toEqual(first);
    // A real progression, not a single trivially-equal snapshot.
    expect(first).toHaveLength(SCRIPT.length + 1);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it("a different seed diverges the terminal digest (a real seeded stream)", () => {
    const a = sampleHashes(SEED);
    const b = sampleHashes(SEED + 1);
    expect(b[b.length - 1]).not.toBe(a[a.length - 1]);
  });

  it("the Reckoning warps the world-state read in place (Reach ⇒ Ashfall digest)", () => {
    const reach = bootRegion(ROOTS, SEED, "reach");
    const ashfall = actRegion(reach, { kind: RegionActionKinds.reckon });
    expect(reach.worldState).toBe("reach");
    expect(ashfall.worldState).toBe("ashfall");
    // The Ashfall encounter table differs, so the digest diverges the instant the
    // Reckoning fires — the world-state read folds into the determinism digest.
    expect(hashRegionRun(ashfall)).not.toBe(hashRegionRun(reach));
  });
});
