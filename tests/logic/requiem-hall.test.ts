/**
 * Unit coverage for the **Sidhe requiem-hall Chapter 4 set-piece** in the Roots /
 * the Deep (#145, PRD #43 Scope-IN 4; `wiki/narrative/main-quest.md` Ch.4 — The
 * requiem; `wiki/design/regions.md` the Sidhe requiem-hall key location). Proves —
 * headless, with ZERO Phaser imports (FR9) — that the set-piece authored on top of
 * the shipped region framework (#119/#137) and the Roots region module (#143, reused
 * verbatim — never re-spec'd here) satisfies the issue's two acceptance scenarios:
 *
 * - **reachable** — with the Ch.4 prerequisites met (the Roots Bound, Velith, has
 *   been attuned — the "Bound shard learning in practice" the chapter teaches), the
 *   requiem-hall is reachable and its Ch.4 beat plays to completion deterministically.
 * - **soft-gated** — without the prerequisites, the requiem-hall is soft-gated (not
 *   reachable): it neither plays nor errors (`wiki/design/regions.md` "soft gating:
 *   traversal and knowledge gate the map, not invisible walls or timers").
 *
 * The set-piece reachability gate + play-state live in `src/logic` (zero Phaser);
 * the beat threads the seeded RNG (`src/logic/rng.ts`) so the run is reproducible,
 * and `hashRequiemHall` is the determinism handle the bridge samples. The e2e twin
 * (`tests/e2e/requiem-hall.spec.ts`) proves the same two scenarios on the live
 * `__VERIFY__` canvas; this suite proves the rules headlessly.
 */
import { describe, expect, it } from "vitest";

import { REGIONS, RegionIds, BoundIds } from "../../src/content";
import { newRunState, type RunState } from "../../src/logic/run-state";
import { chooseAtBoundSite, openBoundSite } from "../../src/logic/region";
import { newMoralLedger } from "../../src/logic/free-vs-wield";
import {
  RequiemHallPhases,
  hashRequiemHall,
  isRequiemHallComplete,
  isRequiemHallReachable,
  openRequiemHall,
  playRequiemHall,
  playRequiemHallToCompletion,
} from "../../src/logic/region";

/** The Roots / the Deep region — the one that hosts the Sidhe requiem-hall. */
const ROOTS = REGIONS[RegionIds.roots];
/** The Roots Bound whose attunement is the Ch.4 prerequisite. */
const VELITH = BoundIds.velithDeepbound;
/** A fixed boot seed so the suite is reproducible. */
const SEED = 0x4_e_91;

/**
 * A run that has met the Ch.4 prerequisites — the Roots Bound (Velith) attuned
 * through its site (#144), in the given mode. This is the "Bound shard learning in
 * practice" the chapter teaches: reaching + resolving the region's Bound site.
 * @param mode - The carry the player committed to at Velith's site.
 * @returns The run with Velith attuned.
 */
function runWithVelithAttuned(mode: "free" | "wield"): RunState {
  return chooseAtBoundSite(openBoundSite(ROOTS, newMoralLedger()), mode).run;
}

describe("requiem-hall reachability gate (#145 — soft-gating, scenario 2)", () => {
  it("a fresh run (no Bound attuned) leaves the requiem-hall NOT reachable", () => {
    const session = openRequiemHall(ROOTS, newRunState(), "reach", SEED);
    expect(isRequiemHallReachable(session)).toBe(false);
    expect(session.phase).toBe(RequiemHallPhases.gated);
  });

  it("opening a gated hall does NOT throw and does NOT play the beat", () => {
    const session = openRequiemHall(ROOTS, newRunState(), "reach", SEED);
    // Soft-gate: no play, no error, no progress.
    expect(session.beat).toBe(0);
    expect(isRequiemHallComplete(session)).toBe(false);
  });

  it("playing a gated hall is a no-op — it cannot advance past the gate", () => {
    const gated = openRequiemHall(ROOTS, newRunState(), "reach", SEED);
    const played = playRequiemHall(gated);
    expect(played.phase).toBe(RequiemHallPhases.gated);
    expect(played.beat).toBe(0);
    expect(isRequiemHallComplete(played)).toBe(false);
    // A no-op returns an equal state (cannot fabricate progress through the gate).
    expect(played).toEqual(gated);
  });

  it("driving the gated hall to completion never completes (stays gated)", () => {
    const done = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, newRunState(), "reach", SEED)
    );
    expect(isRequiemHallComplete(done)).toBe(false);
    expect(done.phase).toBe(RequiemHallPhases.gated);
  });
});

describe("requiem-hall opens when the Ch.4 prerequisites are met (#145 — scenario 1)", () => {
  it("with Velith FREED, the hall is reachable and starts sealed at beat 0", () => {
    const session = openRequiemHall(
      ROOTS,
      runWithVelithAttuned("free"),
      "reach",
      SEED
    );
    expect(isRequiemHallReachable(session)).toBe(true);
    expect(session.phase).toBe(RequiemHallPhases.sealed);
    expect(session.beat).toBe(0);
    expect(session.regionId).toBe(ROOTS.id);
    expect(isRequiemHallComplete(session)).toBe(false);
  });

  it("with Velith WIELDED, the hall is equally reachable (either attunement gates Ch.4)", () => {
    const session = openRequiemHall(
      ROOTS,
      runWithVelithAttuned("wield"),
      "reach",
      SEED
    );
    expect(isRequiemHallReachable(session)).toBe(true);
    expect(session.phase).toBe(RequiemHallPhases.sealed);
  });

  it("the gate keys on the ROOTS Bound (Velith) specifically", () => {
    // A run carrying some unrelated/empty shard set is not Ch.4-ready.
    const unrelated: RunState = { ...newRunState(), shards: [] };
    expect(
      isRequiemHallReachable(openRequiemHall(ROOTS, unrelated, "reach", SEED))
    ).toBe(false);
    // Attuning Velith (the region's boundSite) is what opens it.
    expect(ROOTS.boundSite).toBe(VELITH);
  });
});

describe("requiem-hall set-piece beat plays to completion (#145 — scenario 1)", () => {
  it("steps through its authored beats sealed → singing → truth → complete", () => {
    const seq: string[] = [];
    let session = openRequiemHall(
      ROOTS,
      runWithVelithAttuned("free"),
      "reach",
      SEED
    );
    seq.push(session.phase);
    for (
      let guard = 0;
      guard < 16 && !isRequiemHallComplete(session);
      guard++
    ) {
      session = playRequiemHall(session);
      seq.push(session.phase);
    }
    expect(isRequiemHallComplete(session)).toBe(true);
    expect(session.phase).toBe(RequiemHallPhases.complete);
    // The Ch.4 beat surfaces the Choir's-Song fragment before the truth cracks open.
    expect(seq).toContain(RequiemHallPhases.singing);
    expect(seq).toContain(RequiemHallPhases.truth);
    // The phases occur in authored order (sealed before singing before truth).
    expect(seq.indexOf(RequiemHallPhases.sealed)).toBeLessThan(
      seq.indexOf(RequiemHallPhases.singing)
    );
    expect(seq.indexOf(RequiemHallPhases.singing)).toBeLessThan(
      seq.indexOf(RequiemHallPhases.truth)
    );
  });

  it("playRequiemHallToCompletion runs the whole beat in one call", () => {
    const done = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, runWithVelithAttuned("free"), "reach", SEED)
    );
    expect(isRequiemHallComplete(done)).toBe(true);
    expect(done.phase).toBe(RequiemHallPhases.complete);
    expect(done.beat).toBeGreaterThan(0);
  });

  it("playing past completion is idempotent — the beat cannot re-fire or over-run", () => {
    const done = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, runWithVelithAttuned("wield"), "reach", SEED)
    );
    const again = playRequiemHall(done);
    expect(again).toEqual(done);
    expect(again.phase).toBe(RequiemHallPhases.complete);
  });
});

describe("requiem-hall resolves through the live world-state (both variants)", () => {
  it("plays to completion in the Ashfall (Act II) variant too — not pinned to reach", () => {
    const done = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, runWithVelithAttuned("free"), "ashfall", SEED)
    );
    expect(done.worldState).toBe("ashfall");
    expect(isRequiemHallComplete(done)).toBe(true);
  });

  it("the two world-states are observably distinct (different digest at completion)", () => {
    const reach = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, runWithVelithAttuned("free"), "reach", SEED)
    );
    const ashfall = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, runWithVelithAttuned("free"), "ashfall", SEED)
    );
    expect(hashRequiemHall(reach)).not.toBe(hashRequiemHall(ashfall));
  });
});

describe("requiem-hall determinism (#145 — Validation Journey)", () => {
  it("same region + run + world + seed ⇒ identical 8-hex digest progression", () => {
    const driveHashes = (): string[] => {
      let session = openRequiemHall(
        ROOTS,
        runWithVelithAttuned("free"),
        "reach",
        SEED
      );
      const hashes = [hashRequiemHall(session)];
      for (let i = 0; i < 8 && !isRequiemHallComplete(session); i++) {
        session = playRequiemHall(session);
        hashes.push(hashRequiemHall(session));
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
    const a = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, runWithVelithAttuned("free"), "reach", 0x1111)
    );
    const b = playRequiemHallToCompletion(
      openRequiemHall(ROOTS, runWithVelithAttuned("free"), "reach", 0x2222)
    );
    expect(hashRequiemHall(a)).not.toBe(hashRequiemHall(b));
  });

  it("the gated and reachable halls hash differently (the gate is observable)", () => {
    const gated = openRequiemHall(ROOTS, newRunState(), "reach", SEED);
    const open = openRequiemHall(
      ROOTS,
      runWithVelithAttuned("free"),
      "reach",
      SEED
    );
    expect(hashRequiemHall(gated)).not.toBe(hashRequiemHall(open));
    expect(hashRequiemHall(gated)).toMatch(/^[0-9a-f]{8}$/);
  });
});
