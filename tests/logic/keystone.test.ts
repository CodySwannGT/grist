/**
 * Unit coverage for the **Chapter-5 Mourne keystone set-piece** in upper Vanta
 * (#128, PRD #43 Scope-IN 5/8; `wiki/narrative/main-quest.md` Ch.5 — The keystone;
 * `wiki/design/regions.md` the Crown's House Mourne refinery-spire). Proves —
 * headless, with ZERO Phaser imports (FR9) — that the set-piece authored on top of
 * the shipped region framework (#119/#137) and the upper-Vanta region module (this
 * increment) satisfies the issue's acceptance criteria:
 *
 * - **reachable + resolves** — with the Ch.5 prerequisite met (the run has reached
 *   House Mourne's refinery-spire), the keystone is reachable and its Ch.5 climax
 *   plays to completion deterministically; along the way Mr. Sallow steps forward
 *   and **triggers the Reckoning** (the Act I climax gate).
 * - **soft-gated** — without reaching the refinery-spire, the keystone is soft-gated
 *   (not reachable): it neither plays nor errors (`wiki/design/regions.md` "soft
 *   gating: traversal and knowledge gate the map, not invisible walls or timers").
 *
 * Unlike the Ch.4 requiem-hall (#145) whose gate is a Bound attunement, upper Vanta
 * cages NO Bound ("the Crown consumes, it doesn't hold"), so the Ch.5 gate is purely
 * *traversal* — reaching the spire. The set-piece reachability gate + play-state live
 * in `src/logic` (zero Phaser); the beat threads the seeded RNG (`src/logic/rng.ts`)
 * so the run is reproducible, and `hashKeystone` is the determinism handle the bridge
 * samples. The e2e twin (`tests/e2e/upper-vanta-increment.spec.ts`) proves the same on
 * the live `__VERIFY__` canvas; this suite proves the rules headlessly. Patterned on
 * `tests/logic/requiem-hall.test.ts` (import style, structure).
 */
import { describe, expect, it } from "vitest";

import { REGIONS, RegionIds } from "../../src/content";
import {
  KEYSTONE_LOCATION,
  KeystonePhases,
  hashKeystone,
  isKeystoneComplete,
  isKeystoneReachable,
  keystoneTriggersReckoning,
  openKeystone,
  playKeystone,
  playKeystoneToCompletion,
} from "../../src/logic/region";

/** Upper Vanta — the region that hosts the Ch.5 Mourne keystone (and cages no Bound). */
const VANTA = REGIONS[RegionIds.upperVanta];
/** A Crown location that is NOT the refinery-spire (a realistic "explored elsewhere" id). */
const CONCORD_HALL = "concord-hall";
/** A run that has NOT reached the refinery-spire (the Ch.5 prerequisite unmet). */
const NOT_REACHED: readonly string[] = [CONCORD_HALL, "grand-market"];
/** A run that HAS reached the refinery-spire (the Ch.5 prerequisite met). */
const REACHED: readonly string[] = [CONCORD_HALL, KEYSTONE_LOCATION];
/** A fixed boot seed so the suite is reproducible. */
const SEED = 0x4_e_91;

describe("upper Vanta cages no Bound — its anchor is the Ch.5 keystone (#128)", () => {
  it("declares no boundSite (the Crown consumes, it doesn't hold)", () => {
    expect(VANTA.boundSite).toBeUndefined();
  });

  it("authors the Mourne refinery-spire as a key location in BOTH world-states", () => {
    for (const state of ["reach", "ashfall"] as const) {
      const variant = VANTA.states[state];
      expect(
        variant.keyLocations.some(place => place.id === KEYSTONE_LOCATION)
      ).toBe(true);
    }
  });
});

describe("keystone reachability gate (#128 — soft-gating)", () => {
  it("a run that has NOT reached the refinery-spire leaves the keystone NOT reachable", () => {
    const session = openKeystone(VANTA, NOT_REACHED, "reach", SEED);
    expect(isKeystoneReachable(session)).toBe(false);
    expect(session.phase).toBe(KeystonePhases.gated);
  });

  it("opening a gated keystone does NOT throw and does NOT play the beat", () => {
    const session = openKeystone(VANTA, NOT_REACHED, "reach", SEED);
    expect(session.beat).toBe(0);
    expect(isKeystoneComplete(session)).toBe(false);
    expect(keystoneTriggersReckoning(session)).toBe(false);
  });

  it("playing a gated keystone is a no-op — it cannot advance past the gate", () => {
    const gated = openKeystone(VANTA, NOT_REACHED, "reach", SEED);
    const played = playKeystone(gated);
    expect(played.phase).toBe(KeystonePhases.gated);
    expect(played.beat).toBe(0);
    // A no-op returns an equal state (cannot fabricate progress through the gate).
    expect(played).toEqual(gated);
  });

  it("driving the gated keystone to completion never completes (stays gated) and never triggers", () => {
    const done = playKeystoneToCompletion(
      openKeystone(VANTA, NOT_REACHED, "reach", SEED)
    );
    expect(isKeystoneComplete(done)).toBe(false);
    expect(done.phase).toBe(KeystonePhases.gated);
    expect(keystoneTriggersReckoning(done)).toBe(false);
  });
});

describe("keystone opens when the refinery-spire is reached (#128)", () => {
  it("with the spire reached, the keystone is reachable and starts sealed at beat 0", () => {
    const session = openKeystone(VANTA, REACHED, "reach", SEED);
    expect(isKeystoneReachable(session)).toBe(true);
    expect(session.phase).toBe(KeystonePhases.sealed);
    expect(session.beat).toBe(0);
    expect(session.regionId).toBe(VANTA.id);
    expect(isKeystoneComplete(session)).toBe(false);
    // Not yet triggered — the Reckoning fires later in the beat, not at open.
    expect(keystoneTriggersReckoning(session)).toBe(false);
  });

  it("the gate keys on the refinery-spire specifically (not any reached location)", () => {
    // Reaching only OTHER Crown/Tiers locations does not open the keystone.
    expect(
      isKeystoneReachable(
        openKeystone(VANTA, [CONCORD_HALL, "tobis-workshop"], "reach", SEED)
      )
    ).toBe(false);
  });
});

describe("keystone climax plays to completion — Sallow triggers the Reckoning (#128)", () => {
  it("steps through sealed → sallow-steps → reckoning-triggered → complete", () => {
    const seq: string[] = [];
    let session = openKeystone(VANTA, REACHED, "reach", SEED);
    seq.push(session.phase);
    for (let guard = 0; guard < 16 && !isKeystoneComplete(session); guard++) {
      session = playKeystone(session);
      seq.push(session.phase);
    }
    expect(isKeystoneComplete(session)).toBe(true);
    expect(session.phase).toBe(KeystonePhases.complete);
    // Mr. Sallow steps from the background, then triggers the Reckoning.
    expect(seq).toContain(KeystonePhases.sallowSteps);
    expect(seq).toContain(KeystonePhases.reckoningTriggered);
    // The phases occur in authored order.
    expect(seq.indexOf(KeystonePhases.sealed)).toBeLessThan(
      seq.indexOf(KeystonePhases.sallowSteps)
    );
    expect(seq.indexOf(KeystonePhases.sallowSteps)).toBeLessThan(
      seq.indexOf(KeystonePhases.reckoningTriggered)
    );
  });

  it("reports the Reckoning triggered once the beat reaches reckoning-triggered", () => {
    let session = openKeystone(VANTA, REACHED, "reach", SEED);
    // sealed → not yet
    expect(keystoneTriggersReckoning(session)).toBe(false);
    session = playKeystone(session); // sallow-steps
    expect(session.phase).toBe(KeystonePhases.sallowSteps);
    expect(keystoneTriggersReckoning(session)).toBe(false);
    session = playKeystone(session); // reckoning-triggered
    expect(session.phase).toBe(KeystonePhases.reckoningTriggered);
    expect(keystoneTriggersReckoning(session)).toBe(true);
    // …and it stays triggered through completion.
    session = playKeystone(session); // complete
    expect(keystoneTriggersReckoning(session)).toBe(true);
  });

  it("playKeystoneToCompletion runs the whole beat in one call and triggers the Reckoning", () => {
    const done = playKeystoneToCompletion(
      openKeystone(VANTA, REACHED, "reach", SEED)
    );
    expect(isKeystoneComplete(done)).toBe(true);
    expect(done.phase).toBe(KeystonePhases.complete);
    expect(done.beat).toBeGreaterThan(0);
    expect(keystoneTriggersReckoning(done)).toBe(true);
  });

  it("playing past completion is idempotent — the Reckoning cannot re-trigger or over-run", () => {
    const done = playKeystoneToCompletion(
      openKeystone(VANTA, REACHED, "reach", SEED)
    );
    const again = playKeystone(done);
    expect(again).toEqual(done);
    expect(again.phase).toBe(KeystonePhases.complete);
  });
});

describe("keystone resolves through the live world-state (both variants)", () => {
  it("plays to completion in the Ashfall (Act II) variant too — not pinned to reach", () => {
    const done = playKeystoneToCompletion(
      openKeystone(VANTA, REACHED, "ashfall", SEED)
    );
    expect(done.worldState).toBe("ashfall");
    expect(isKeystoneComplete(done)).toBe(true);
    expect(keystoneTriggersReckoning(done)).toBe(true);
  });

  it("the two world-states are observably distinct (different digest at completion)", () => {
    const reach = playKeystoneToCompletion(
      openKeystone(VANTA, REACHED, "reach", SEED)
    );
    const ashfall = playKeystoneToCompletion(
      openKeystone(VANTA, REACHED, "ashfall", SEED)
    );
    // The refinery-spire reads differently across the Reckoning (Reach vs. "keystone
    // struck"), so the digest diverges.
    expect(hashKeystone(reach)).not.toBe(hashKeystone(ashfall));
  });
});

describe("keystone determinism (#128 — Validation Journey)", () => {
  it("same region + reached-set + world + seed ⇒ identical 8-hex digest progression", () => {
    const driveHashes = (): string[] => {
      let session = openKeystone(VANTA, REACHED, "reach", SEED);
      const hashes = [hashKeystone(session)];
      for (let i = 0; i < 8 && !isKeystoneComplete(session); i++) {
        session = playKeystone(session);
        hashes.push(hashKeystone(session));
      }
      return hashes;
    };
    const first = driveHashes();
    const second = driveHashes();
    expect(first).toEqual(second);
    expect(first.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);
    // The progression actually moves (more than one distinct digest).
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it("a different seed yields a different completed digest (the seed threads the beat)", () => {
    const a = playKeystoneToCompletion(
      openKeystone(VANTA, REACHED, "reach", 0x1111)
    );
    const b = playKeystoneToCompletion(
      openKeystone(VANTA, REACHED, "reach", 0x2222)
    );
    expect(hashKeystone(a)).not.toBe(hashKeystone(b));
  });

  it("the gated and reachable keystones hash differently (the gate is observable)", () => {
    const gated = openKeystone(VANTA, NOT_REACHED, "reach", SEED);
    const open = openKeystone(VANTA, REACHED, "reach", SEED);
    expect(hashKeystone(gated)).not.toBe(hashKeystone(open));
    expect(hashKeystone(gated)).toMatch(/^[0-9a-f]{8}$/);
  });
});
