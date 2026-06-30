/**
 * Unit coverage for **Halcyon's defection and party expansion** (#146, PRD #43) in
 * the Roots / the Deep. Proves — headless, with ZERO Phaser imports (FR9) — that the
 * pure defection reducer (`src/logic/party/defection.ts`) and Halcyon's authored
 * content (`content/party.ts::PARTY.halcyon`) satisfy the issue's acceptance
 * scenario 1:
 *
 *   Given an agent has reached Halcyon's defection trigger within the Roots / the Deep
 *   When the defection event fires
 *   Then Halcyon is added to the active party roster with her authored stat block and
 *   signature kit.
 *
 * The defection trigger gates on the **Sidhe requiem-hall set-piece (#145) reaching
 * its `truth`/`complete` beat** — "Halcyon defects after the requiem reveals the
 * truth" (`wiki/narrative/main-quest.md` Ch.4). Firing before that is a NO-OP (the
 * same object, structural-sharing); re-firing is idempotent (the same object, no
 * duplicate). The set-piece reachability gate + play-state live in `src/logic` (zero
 * Phaser); the defection digest threads the seeded RNG so the join is reproducible.
 * The e2e twin (`tests/e2e/halcyon-defection.spec.ts`) proves the same scenario on the
 * live `__VERIFY__` canvas; this suite proves the rules headlessly.
 */
import { describe, expect, it } from "vitest";

import { PARTY, PartyMemberIds, REGIONS, RegionIds } from "../../src/content";
import { chooseAtBoundSite, openBoundSite } from "../../src/logic/region";
import { newMoralLedger } from "../../src/logic/free-vs-wield";
import { newRunState, type RunState } from "../../src/logic/run-state";
import {
  applyHalcyonDefection,
  hashDefection,
  isHalcyonInParty,
} from "../../src/logic/party/defection";
import {
  openRequiemHall,
  playRequiemHall,
  playRequiemHallToCompletion,
  type RequiemHallSession,
} from "../../src/logic/region";

/** The Roots / the Deep region — the one that hosts the Sidhe requiem-hall. */
const ROOTS = REGIONS[RegionIds.roots];
/** A fixed boot seed so the suite is reproducible. */
const SEED = 0x4_e_91;

/**
 * A run that has met the Ch.4 prerequisites — the Roots Bound (Velith) attuned
 * through its site (#144). This is the run the requiem-hall opens reachable against.
 * @param mode - The carry the player committed to at Velith's site.
 * @returns The run with Velith attuned.
 */
function runWithVelithAttuned(mode: "free" | "wield"): RunState {
  return chooseAtBoundSite(openBoundSite(ROOTS, newMoralLedger()), mode).run;
}

/**
 * The requiem-hall session driven to the `truth`/`complete` beat — the point the
 * Ch.4 requiem "reveals the truth" and Halcyon defects. Opens the hall reachable
 * (Velith attuned) and plays it to completion.
 * @returns A completed (truth-revealed) requiem-hall session.
 */
function requiemAtTruth(): RequiemHallSession {
  return playRequiemHallToCompletion(
    openRequiemHall(ROOTS, runWithVelithAttuned("free"), "reach", SEED)
  );
}

describe("Halcyon's authored content (#146 — PARTY.halcyon)", () => {
  it("is registered under the halcyon party-member id", () => {
    expect(PartyMemberIds.halcyon).toBe("halcyon");
    expect(PARTY.halcyon.id).toBe("halcyon");
  });

  it("reads as the heavier frame unit — the party's anvil", () => {
    const halcyon = PARTY.halcyon;
    // The anvil: highest HP + DEF + POW of the level-3 party, lowest SPD.
    expect(halcyon.baseStats.hp).toBeGreaterThan(PARTY.wren.baseStats.hp);
    expect(halcyon.baseStats.hp).toBeGreaterThan(PARTY.tobi.baseStats.hp);
    expect(halcyon.baseStats.def).toBeGreaterThan(PARTY.wren.baseStats.def);
    expect(halcyon.baseStats.def).toBeGreaterThan(PARTY.tobi.baseStats.def);
    expect(halcyon.baseStats.pow).toBeGreaterThan(PARTY.wren.baseStats.pow);
    expect(halcyon.baseStats.pow).toBeGreaterThan(PARTY.tobi.baseStats.pow);
    expect(halcyon.baseStats.spd).toBeLessThan(PARTY.wren.baseStats.spd);
    expect(halcyon.baseStats.spd).toBeLessThan(PARTY.tobi.baseStats.spd);
  });

  it("scales at the current party tier (level 3) with a signature frame active and no starting shard", () => {
    expect(PARTY.halcyon.level).toBe(3);
    // Frame specialist: a hand-authored frame active (catalog.md — "frame actives").
    expect(PARTY.halcyon.signatureKit).toEqual(["Frame-Lance"]);
    // She has no starting shard (like Tobi) — she defects shard-less.
    expect(PARTY.halcyon.shard).toBeUndefined();
  });

  it("specifies every required 8-axis stat (totality)", () => {
    const axes = [
      "hp",
      "ap",
      "pow",
      "foc",
      "def",
      "wrd",
      "spd",
      "lck",
    ] as const;
    for (const axis of axes) {
      expect(typeof PARTY.halcyon.baseStats[axis]).toBe("number");
    }
  });
});

describe("Halcyon defection — the starting roster (#146)", () => {
  it("the fresh run roster is the starting party [wren, tobi] — Halcyon is NOT in it yet", () => {
    const run = newRunState();
    expect(run.roster).toEqual([PartyMemberIds.wren, PartyMemberIds.tobi]);
    expect(isHalcyonInParty(run)).toBe(false);
  });
});

describe("Halcyon defection — gated on the requiem truth (#146 — scenario 1)", () => {
  it("firing BEFORE the requiem reaches truth/complete is a NO-OP (same object)", () => {
    const run = runWithVelithAttuned("free");
    // The requiem is reachable but only at `sealed` (beat 0) — the truth is not out.
    const sealed = openRequiemHall(ROOTS, run, "reach", SEED);
    const after = applyHalcyonDefection(run, sealed);
    // No-op: the SAME object back (structural-sharing), Halcyon absent.
    expect(after).toBe(run);
    expect(isHalcyonInParty(after)).toBe(false);
  });

  it("firing against a SOFT-GATED (unreachable) requiem is a NO-OP (same object)", () => {
    const run = newRunState();
    const gated = openRequiemHall(ROOTS, run, "reach", SEED);
    const after = applyHalcyonDefection(run, gated);
    expect(after).toBe(run);
    expect(isHalcyonInParty(after)).toBe(false);
  });

  it("firing mid-beat (singing, before truth) is a NO-OP (same object)", () => {
    const run = runWithVelithAttuned("free");
    const singing = playRequiemHall(openRequiemHall(ROOTS, run, "reach", SEED));
    const after = applyHalcyonDefection(run, singing);
    expect(after).toBe(run);
    expect(isHalcyonInParty(after)).toBe(false);
  });
});

describe("Halcyon defection — she joins once the truth is revealed (#146 — scenario 1)", () => {
  it("fires once the requiem completes: Halcyon is appended to the active roster", () => {
    const run = runWithVelithAttuned("free");
    const after = applyHalcyonDefection(run, requiemAtTruth());
    expect(isHalcyonInParty(after)).toBe(true);
    // Appended in join order AFTER the starting party.
    expect(after.roster).toEqual([
      PartyMemberIds.wren,
      PartyMemberIds.tobi,
      PartyMemberIds.halcyon,
    ]);
  });

  it("fires at the `truth` beat too (not only `complete`)", () => {
    const run = runWithVelithAttuned("wield");
    // Step to truth without completing: sealed → singing → truth.
    let session = openRequiemHall(ROOTS, run, "reach", SEED);
    session = playRequiemHall(session); // singing
    session = playRequiemHall(session); // truth
    expect(session.phase).toBe("truth");
    const after = applyHalcyonDefection(run, session);
    expect(isHalcyonInParty(after)).toBe(true);
  });

  it("re-firing is idempotent — the SAME object back, no duplicate Halcyon", () => {
    const run = runWithVelithAttuned("free");
    const joined = applyHalcyonDefection(run, requiemAtTruth());
    const again = applyHalcyonDefection(joined, requiemAtTruth());
    // Structural-sharing no-op on re-fire.
    expect(again).toBe(joined);
    // Exactly one Halcyon in the roster.
    expect(
      again.roster.filter(id => id === PartyMemberIds.halcyon)
    ).toHaveLength(1);
  });

  it("leaves every other RunState field intact (only the roster grows)", () => {
    const run = runWithVelithAttuned("free");
    const after = applyHalcyonDefection(run, requiemAtTruth());
    expect(after.wallet).toBe(run.wallet);
    expect(after.shards).toBe(run.shards);
    expect(after.pendingChoiceShard).toBe(run.pendingChoiceShard);
    expect(after.equippedShards).toBe(run.equippedShards);
    expect(after.learning).toBe(run.learning);
    expect(after.statBonuses).toBe(run.statBonuses);
  });
});

describe("Halcyon defection — determinism digest (#146 — Validation Journey)", () => {
  it("same seed + same action sequence ⇒ identical 8-hex digest", () => {
    const driveDigest = (): string => {
      const run = runWithVelithAttuned("free");
      const joined = applyHalcyonDefection(run, requiemAtTruth());
      return hashDefection(joined);
    };
    const first = driveDigest();
    const second = driveDigest();
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}$/);
  });

  it("the pre-join and post-join digests differ (the join is observable)", () => {
    const run = runWithVelithAttuned("free");
    const joined = applyHalcyonDefection(run, requiemAtTruth());
    expect(hashDefection(run)).not.toBe(hashDefection(joined));
  });
});
