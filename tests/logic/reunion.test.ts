/**
 * Unit coverage for the **Act II reunion structure** (#140, PRD #43 — FR8 / AC6) —
 * the open, nonlinear, optional/missable reunion quests that reassemble the secondary
 * roster (Quietus, Brother Asch, Calliope "Cal" Quill, the Shrike) in Act II's FFVI
 * "World of Ruin" beat (`wiki/narrative/main-quest.md` Ch.7 — "Gathering the lost").
 * Proves — headless, with ZERO Phaser imports (FR9) — that the pure reunion logic
 * (`src/logic/party/reunion.ts`) + the authored catalog (`content/reunions.ts`) +
 * companion content (`content/party.ts`) satisfy the issue's acceptance scenario:
 *
 *   Given the world has turned to Ashfall and the secondary roster is scattered
 *   When the player completes one reunion quest but bypasses another and reaches a
 *   later beat
 *   Then the completed companion (e.g. Quietus) has joined the party, the bypassed
 *   reunion is recorded as missable/missed, and play proceeds without requiring it.
 *
 * Reunions are reachable only after the world turns (the Ashfall soft-gate); each is
 * independent (nonlinear) and optional (bypass → missed, or sealed missed by advancing
 * past the window); a completion recruits its companion; the digest threads the seeded
 * RNG so the same actions reproduce an identical hash. The e2e twin
 * (`tests/e2e/act2-reunion.spec.ts`) proves the same scenario on the live `__VERIFY__`
 * canvas; this suite proves the rules headlessly.
 */
import { describe, expect, it } from "vitest";

import { PARTY, PartyMemberIds, REUNIONS, ReunionIds } from "../../src/content";
import { newRunState } from "../../src/logic/run-state";
import {
  ReunionStatuses,
  advancePastReunions,
  bypassReunion,
  completeReunion,
  completedCompanions,
  hashReunions,
  isReunionCompleted,
  isReunionMissed,
  isReunionsReachable,
  openReunions,
  reunionRoster,
  reunionSessionFromFlags,
  reunionStatus,
  reunionStatusFlags,
  type ReunionSession,
} from "../../src/logic/party/reunion";

/** A fixed boot seed so the suite is reproducible. */
const SEED = 0x5e17;
/** The base roster carried into Act II (the starting party for this suite). */
const BASE_ROSTER = newRunState().roster;

/**
 * A reachable (Ashfall) reunion board opened under the fixed seed.
 * @returns A freshly opened, reachable Ashfall reunion board.
 */
function ashfallBoard(): ReunionSession {
  return openReunions("ashfall", SEED);
}

describe("Act II secondary roster content (#140 — content/party.ts)", () => {
  it("registers Quietus, Asch, Cal, and the Shrike as party members", () => {
    expect(PartyMemberIds.quietus).toBe("quietus");
    expect(PartyMemberIds.asch).toBe("asch");
    expect(PartyMemberIds.cal).toBe("cal");
    expect(PartyMemberIds.shrike).toBe("shrike");
    expect(PARTY.quietus.id).toBe("quietus");
    expect(PARTY.asch.id).toBe("asch");
    expect(PARTY.cal.id).toBe("cal");
    expect(PARTY.shrike.id).toBe("shrike");
  });

  it("gives each companion an authored signature kit and no starting shard", () => {
    expect(PARTY.quietus.signatureKit).toEqual(["Soul-Chorus"]);
    expect(PARTY.asch.signatureKit).toEqual(["Ashfast-Kata"]);
    expect(PARTY.cal.signatureKit).toEqual(["Long-Odds"]);
    expect(PARTY.shrike.signatureKit).toEqual(["Killstroke"]);
    expect(PARTY.quietus.shard).toBeUndefined();
    expect(PARTY.asch.shard).toBeUndefined();
    expect(PARTY.cal.shard).toBeUndefined();
    expect(PARTY.shrike.shard).toBeUndefined();
  });

  it("reads each companion's identity through its stat block", () => {
    // Quietus the esper: the roster's biggest AP pool + highest FOC (it channels the
    // souls it is made of), lowest DEF (incorporeal).
    expect(PARTY.quietus.baseStats.foc).toBe(22);
    expect(PARTY.quietus.baseStats.def).toBe(8);
    // Asch the grist-renouncing monk: the lowest AP of the roster (no grist actives).
    expect(PARTY.asch.baseStats.ap).toBe(8);
    // Cal the gambler: the highest LCK.
    expect(PARTY.cal.baseStats.lck).toBe(16);
    // The Shrike the assassin: the highest SPD.
    expect(PARTY.shrike.baseStats.spd).toBe(18);
  });

  it("specifies every required 8-axis stat for each companion (totality)", () => {
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
    for (const member of [PARTY.quietus, PARTY.asch, PARTY.cal, PARTY.shrike]) {
      for (const axis of axes) {
        expect(typeof member.baseStats[axis]).toBe("number");
      }
    }
  });
});

describe("Act II reunion catalog (#140 — content/reunions.ts)", () => {
  it("authors one reunion per secondary companion, each recruiting a defined member", () => {
    expect(REUNIONS.quietus.companion).toBe(PartyMemberIds.quietus);
    expect(REUNIONS.asch.companion).toBe(PartyMemberIds.asch);
    expect(REUNIONS.cal.companion).toBe(PartyMemberIds.cal);
    expect(REUNIONS.shrike.companion).toBe(PartyMemberIds.shrike);
  });

  it("gives each reunion a self-contained story name and an environmental hook", () => {
    for (const id of ["quietus", "asch", "cal", "shrike"] as const) {
      expect(REUNIONS[id].name.length).toBeGreaterThan(0);
      expect(REUNIONS[id].hook.length).toBeGreaterThan(0);
    }
  });
});

describe("Reunion structure — the Ashfall soft-gate (#140)", () => {
  it("a board opened in Act II ashfall is reachable", () => {
    expect(isReunionsReachable(openReunions("ashfall", SEED))).toBe(true);
  });

  it("a board opened in Act I reach is NOT reachable (the world has not turned)", () => {
    expect(isReunionsReachable(openReunions("reach", SEED))).toBe(false);
  });

  it("completing a reunion on a gated (reach) board is a NO-OP (same object)", () => {
    const gated = openReunions("reach", SEED);
    const after = completeReunion(gated, ReunionIds.quietus);
    expect(after).toBe(gated);
    expect(reunionStatus(after, ReunionIds.quietus)).toBe(
      ReunionStatuses.available
    );
  });

  it("bypassing a reunion on a gated (reach) board is a NO-OP (same object)", () => {
    const gated = openReunions("reach", SEED);
    expect(bypassReunion(gated, ReunionIds.asch)).toBe(gated);
  });

  it("advancing past the window on a gated (reach) board is a NO-OP (same object)", () => {
    const gated = openReunions("reach", SEED);
    expect(advancePastReunions(gated)).toBe(gated);
  });
});

describe("Reunion structure — completing a reunion recruits its companion (#140)", () => {
  it("completing Quietus's reunion joins Quietus to the active roster", () => {
    const board = completeReunion(ashfallBoard(), ReunionIds.quietus);
    expect(isReunionCompleted(board, ReunionIds.quietus)).toBe(true);
    expect(reunionRoster(BASE_ROSTER, board)).toEqual([
      PartyMemberIds.wren,
      PartyMemberIds.tobi,
      PartyMemberIds.quietus,
    ]);
  });

  it("is nonlinear — reunions complete in any order and stay independent", () => {
    // Complete Cal first, then the Shrike — an order different from the catalog order.
    let board = ashfallBoard();
    board = completeReunion(board, ReunionIds.cal);
    board = completeReunion(board, ReunionIds.shrike);
    expect(isReunionCompleted(board, ReunionIds.cal)).toBe(true);
    expect(isReunionCompleted(board, ReunionIds.shrike)).toBe(true);
    // The other two are untouched (independent).
    expect(reunionStatus(board, ReunionIds.quietus)).toBe(
      ReunionStatuses.available
    );
    expect(reunionStatus(board, ReunionIds.asch)).toBe(
      ReunionStatuses.available
    );
  });

  it("projects recruits in canonical order regardless of completion order", () => {
    // Complete out of order (shrike, then quietus): the roster still reads in the
    // canonical REUNION_ORDER (quietus before shrike), not completion order.
    let board = ashfallBoard();
    board = completeReunion(board, ReunionIds.shrike);
    board = completeReunion(board, ReunionIds.quietus);
    expect(completedCompanions(board)).toEqual([
      PartyMemberIds.quietus,
      PartyMemberIds.shrike,
    ]);
  });

  it("re-completing a reunion is a NO-OP (same object) — never a duplicate join", () => {
    const board = completeReunion(ashfallBoard(), ReunionIds.quietus);
    const again = completeReunion(board, ReunionIds.quietus);
    expect(again).toBe(board);
    expect(
      reunionRoster(BASE_ROSTER, again).filter(
        id => id === PartyMemberIds.quietus
      )
    ).toHaveLength(1);
  });
});

describe("Reunion structure — optional/missable (#140 — the AC scenario)", () => {
  it("completes one reunion, bypasses another, advances — the completed joins, the bypassed is missed, play proceeds", () => {
    // Given the world has turned to Ashfall and the roster is scattered.
    let board = ashfallBoard();
    // When the player completes Quietus but bypasses Asch, then reaches a later beat.
    board = completeReunion(board, ReunionIds.quietus);
    board = bypassReunion(board, ReunionIds.asch);
    board = advancePastReunions(board);

    // Then Quietus has joined the party...
    expect(isReunionCompleted(board, ReunionIds.quietus)).toBe(true);
    expect(reunionRoster(BASE_ROSTER, board)).toContain(PartyMemberIds.quietus);
    // ...the bypassed reunion (Asch) is recorded missed...
    expect(isReunionMissed(board, ReunionIds.asch)).toBe(true);
    // ...advancing sealed the still-open reunions (Cal, the Shrike) missed too...
    expect(isReunionMissed(board, ReunionIds.cal)).toBe(true);
    expect(isReunionMissed(board, ReunionIds.shrike)).toBe(true);
    // ...and play proceeds without requiring the missed reunions — the roster simply
    // scales to who was found (only Quietus joined; the missed companions are absent).
    expect(reunionRoster(BASE_ROSTER, board)).toEqual([
      PartyMemberIds.wren,
      PartyMemberIds.tobi,
      PartyMemberIds.quietus,
    ]);
  });

  it("advancing preserves completed and already-missed reunions (only seals the open ones)", () => {
    let board = ashfallBoard();
    board = completeReunion(board, ReunionIds.quietus);
    board = bypassReunion(board, ReunionIds.asch);
    board = advancePastReunions(board);
    expect(reunionStatus(board, ReunionIds.quietus)).toBe(
      ReunionStatuses.completed
    );
    expect(reunionStatus(board, ReunionIds.asch)).toBe(ReunionStatuses.missed);
  });

  it("advancing a second time is a NO-OP (same object) — nothing left to seal", () => {
    const sealed = advancePastReunions(ashfallBoard());
    expect(advancePastReunions(sealed)).toBe(sealed);
  });

  it("a bypassed reunion cannot be completed afterward (missable is permanent)", () => {
    const bypassed = bypassReunion(ashfallBoard(), ReunionIds.asch);
    const after = completeReunion(bypassed, ReunionIds.asch);
    // No-op: the same object, still missed, companion never recruited.
    expect(after).toBe(bypassed);
    expect(reunionRoster(BASE_ROSTER, after)).not.toContain(
      PartyMemberIds.asch
    );
  });
});

describe("Reunion structure — determinism digest (#140 — Validation Journey)", () => {
  it("same seed + same action sequence ⇒ identical 8-hex digest", () => {
    const drive = (): string => {
      let board = ashfallBoard();
      board = completeReunion(board, ReunionIds.quietus);
      board = completeReunion(board, ReunionIds.cal);
      return hashReunions(board);
    };
    const first = drive();
    const second = drive();
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}$/);
  });

  it("completing a reunion changes the digest (a completion is observable)", () => {
    const before = ashfallBoard();
    const after = completeReunion(before, ReunionIds.quietus);
    expect(hashReunions(before)).not.toBe(hashReunions(after));
  });

  it("the reach (gated) and ashfall (reachable) boards digest differently", () => {
    expect(hashReunions(openReunions("reach", SEED))).not.toBe(
      hashReunions(openReunions("ashfall", SEED))
    );
  });
});

describe("Reunion structure — persistence projection (#140)", () => {
  it("projects per-reunion statuses into a scene-flag ledger keyed by reunion:<id>", () => {
    let board = ashfallBoard();
    board = completeReunion(board, ReunionIds.quietus);
    board = bypassReunion(board, ReunionIds.asch);
    const flags = reunionStatusFlags(board);
    expect(flags["reunion:quietus"]).toBe(ReunionStatuses.completed);
    expect(flags["reunion:asch"]).toBe(ReunionStatuses.missed);
    expect(flags["reunion:cal"]).toBe(ReunionStatuses.available);
  });

  it("restores completed/missed statuses from a persisted flag ledger", () => {
    let board = ashfallBoard();
    board = completeReunion(board, ReunionIds.quietus);
    board = bypassReunion(board, ReunionIds.asch);
    // Round-trip through the scene-flag ledger the save persists.
    const restored = reunionSessionFromFlags(
      reunionStatusFlags(board),
      "ashfall",
      SEED
    );
    expect(isReunionCompleted(restored, ReunionIds.quietus)).toBe(true);
    expect(isReunionMissed(restored, ReunionIds.asch)).toBe(true);
    expect(reunionRoster(BASE_ROSTER, restored)).toContain(
      PartyMemberIds.quietus
    );
  });

  it("defaults an absent/malformed flag to available (a corrupt save never crashes)", () => {
    const restored = reunionSessionFromFlags(
      { "reunion:quietus": "bogus", other: 1 },
      "ashfall",
      SEED
    );
    expect(reunionStatus(restored, ReunionIds.quietus)).toBe(
      ReunionStatuses.available
    );
  });
});
