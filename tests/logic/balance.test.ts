/**
 * Combat-balance band gate (issue #266). The evidence-based counterpart to the
 * QA finding that reachable combat was trivially easy: it runs the headless
 * {@link sweep} harness — batches of seeded fights under the three mandated
 * policies (naive Strike-spam, telegraph-aware Defend, Craft/Break mixed) — and
 * asserts the declared target bands so future content can never silently
 * trivialize combat again. The sweeps are deterministic (a fixed seed list, a
 * pure sim), so these bands are stable, not flaky: the same seeds always play
 * the same fights. The numbers here mirror the sweep tables in the PR body.
 *
 * Bands (design intent from wiki/design/combat-spec.md + the ticket):
 *  - Tutorial gentle: ~100% win, ~0 KO for every policy.
 *  - Act I bites: careless Strike-spam loses real HP; the mixed line is safer
 *    and faster.
 *  - Ashfall: Strike-spam degrades materially (a regular encounter drops it
 *    below 60% win; the boss/finale wipe it) while the mixed line stays high;
 *    KOs occur under spam (live-exercising the #243 KO handling); the mixed line
 *    strictly beats spam on turns AND survival.
 *  - Defend matters: bracing on a telegraph mitigates real damage (higher HP
 *    remaining than blind spam in a punishing-but-survivable Ashfall fight).
 * @module tests/logic/balance.test
 */
import { describe, expect, it } from "vitest";

import { ENCOUNTERS } from "../../src/content";
import { POLICIES, SLICE_PARTY, seeds, sweep } from "./balance/harness";
import { type WorldState } from "../../src/logic/world";

/** The shared batch — matches the PR sweep tables (deterministic seeds). */
const BATCH = seeds(60);

/**
 * Run all three policies against one encounter/world-state, keyed by name.
 * @param encounter - The encounter id to sweep.
 * @param world - The world-state (`reach` or `ashfall`).
 * @returns The three policies' aggregated sweep stats.
 */
function tier(encounter: keyof typeof ENCOUNTERS, world: WorldState) {
  const enc = ENCOUNTERS[encounter];
  return {
    spam: sweep(SLICE_PARTY, enc, world, POLICIES["strike-spam"]!, BATCH),
    defend: sweep(
      SLICE_PARTY,
      enc,
      world,
      POLICIES["telegraph-defend"]!,
      BATCH
    ),
    mixed: sweep(SLICE_PARTY, enc, world, POLICIES["craft-mixed"]!, BATCH),
  };
}

describe("combat balance — tutorial is gentle", () => {
  const t = tier("tutorial-ambush", "reach");
  it("every policy wins the tutorial ambush ~always with ~no KOs", () => {
    for (const stats of [t.spam, t.defend, t.mixed]) {
      expect(stats.winRate).toBeGreaterThanOrEqual(0.98);
      expect(stats.koRate).toBeLessThanOrEqual(0.02);
      expect(stats.avgHpRemaining).toBeGreaterThan(0.9);
    }
  });
});

describe("combat balance — Act I bites but is winnable", () => {
  const t = tier("the-drip", "reach");
  it("Strike-spam still wins Act I mid but loses real HP", () => {
    expect(t.spam.winRate).toBeGreaterThanOrEqual(0.9);
    // "Threatens real HP loss with careless play": spam ends materially hurt.
    expect(t.spam.avgHpRemaining).toBeLessThan(0.9);
  });
  it("the mixed line is safer and faster than blind spam", () => {
    expect(t.mixed.avgHpRemaining).toBeGreaterThan(t.spam.avgHpRemaining);
    expect(t.mixed.meanTurns).toBeLessThan(t.spam.meanTurns);
  });
});

describe("combat balance — Ashfall degrades Strike-spam", () => {
  const regular = tier("deep-audit", "ashfall");
  const boss = tier("the-cage", "ashfall");

  it("a regular Ashfall encounter drops Strike-spam below 60% win", () => {
    // The ticket's headline band: Strike-spam degraded materially (<60%)…
    expect(regular.spam.winRate).toBeLessThan(0.6);
    // …while the systems-literate mixed line stays high.
    expect(regular.mixed.winRate).toBeGreaterThanOrEqual(0.85);
  });

  it("the Ashfall boss wipes Strike-spam while the mixed line survives", () => {
    expect(boss.spam.winRate).toBeLessThanOrEqual(0.3);
    expect(boss.mixed.winRate).toBeGreaterThanOrEqual(0.8);
    // Even the winning mixed line bleeds for it (not a faceroll).
    expect(boss.mixed.avgHpRemaining).toBeLessThan(0.9);
  });

  it("the mixed line strictly beats Strike-spam on turns AND survival", () => {
    for (const t of [regular, boss]) {
      expect(t.mixed.winRate).toBeGreaterThan(t.spam.winRate);
      expect(t.mixed.meanTurns).toBeLessThan(t.spam.meanTurns);
      expect(t.mixed.avgHpRemaining).toBeGreaterThan(t.spam.avgHpRemaining);
    }
  });
});

describe("combat balance — KOs occur in Ashfall (live-exercises #243)", () => {
  it("Strike-spam gets party members KO'd across Ashfall sweeps", () => {
    // The #243 KO handling could never fire in real play when combat was
    // trivial; a biting Ashfall now KOs the party under spam in most fights.
    const drip = tier("the-drip", "ashfall");
    const audit = tier("deep-audit", "ashfall");
    expect(drip.spam.koRate).toBeGreaterThanOrEqual(0.5);
    expect(audit.spam.koRate).toBeGreaterThanOrEqual(0.5);
  });
});

describe("combat balance — Defend mitigates a telegraphed blow", () => {
  it("bracing on a telegraph survives with more HP than blind spam", () => {
    // A punishing-but-survivable Ashfall fight: the telegraph-aware Defend line
    // ends with more HP than naive Strike-spam — proving Defend now mitigates.
    const t = tier("the-drip", "ashfall");
    expect(t.defend.avgHpRemaining).toBeGreaterThan(t.spam.avgHpRemaining);
  });
});
