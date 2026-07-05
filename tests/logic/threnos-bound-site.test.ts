/**
 * Unit coverage for **Threnos the Unmade's free-vs-wield site** in the Wrack (#132,
 * PRD #43 FR5 / AC7). The Wrack region sites Threnos (`content/regions` →
 * `boundSite: threnos`), and this suite proves — headless, with ZERO Phaser imports
 * (FR9) — that anchoring that site through the shipped Bound-site template (#135) and
 * the Phase-2 free-vs-wield kit (#69, reused verbatim — never re-spec'd here) yields
 * the franchise's core moral fork:
 *
 * - **free** — the weaker Threnos shard, karma+, and NO corruption: quieting the
 *   Sundering's rawest wound the oblivion-cult courts — the mercy that refuses the end.
 * - **wield** — the stronger carry that accrues corruption (karma−): drawing raw
 *   entropy from a piece of the end itself, the desecration.
 *
 * Threnos is the finale foreshadow — the most alien, entropy-touched power on the
 * roster — so its wield cost is the HEAVIEST authored to date: strictly above
 * Korrholt's openly-run reactor (previously the heaviest). The unit twin proves the
 * rule headlessly; `tests/e2e/threnos-bound-site.spec.ts` proves it persists across a
 * genuine reload on the live `__VERIFY__` canvas.
 */
import { describe, expect, it } from "vitest";

import { BOUNDS, BoundIds, REGIONS, RegionIds } from "../../src/content";
import { newMoralLedger } from "../../src/logic/free-vs-wield";
import {
  boundSiteShard,
  chooseAtBoundSite,
  hashBoundSite,
  isBoundSiteSettled,
  openBoundSite,
} from "../../src/logic/region";

/** The Wrack region — the one that sites Threnos. */
const WRACK = REGIONS[RegionIds.wrack];
/** The Bound the Wrack region sites: Threnos, the Unmade. */
const THRENOS = BoundIds.threnos;

describe("Threnos Bound data — the Wrack site's Unmade (#132)", () => {
  it("the Wrack region sites exactly Threnos", () => {
    expect(WRACK.boundSite).toBe(THRENOS);
  });

  it("free accrues no corruption (the mercy — the wound quieted, the end refused)", () => {
    expect(BOUNDS[THRENOS].variants.free.corruptionRate).toBe(0);
  });

  it("wield accrues corruption — non-zero (AC7 requires the fork be measurable)", () => {
    expect(BOUNDS[THRENOS].variants.wield.corruptionRate).toBeGreaterThan(0);
  });

  it("is a heavy decision: Threnos's wield cost is strictly above the Marrow Bound's", () => {
    expect(BOUNDS[THRENOS].variants.wield.corruptionRate).toBeGreaterThan(
      BOUNDS[BoundIds.marrowBound].variants.wield.corruptionRate
    );
  });

  it("the finale foreshadow: Threnos's wield cost is the heaviest authored — above Korrholt's reactor", () => {
    expect(BOUNDS[THRENOS].variants.wield.corruptionRate).toBeGreaterThan(
      BOUNDS[BoundIds.korrholt].variants.wield.corruptionRate
    );
  });

  it("teaches its OWN element (Gloom's Unmake), not a borrowed craft", () => {
    expect(BOUNDS[THRENOS].element).toBe("gloom");
    expect(BOUNDS[THRENOS].bind.element).toBe("gloom");
    expect(BOUNDS[THRENOS].teaches).toContain("unmake");
  });
});

describe("openBoundSite(wrack) — anchoring Threnos's site (#132 / #135)", () => {
  it("sites exactly Threnos and offers its content-table variants", () => {
    const session = openBoundSite(WRACK, newMoralLedger());
    expect(boundSiteShard(session)).toBe(THRENOS);
    expect(session.regionId).toBe(WRACK.id);
    expect(session.variants).toEqual(BOUNDS[THRENOS].variants);
  });

  it("opens unsettled: Threnos's free-vs-wield choice is pending, the shard acquired", () => {
    const session = openBoundSite(WRACK, newMoralLedger());
    expect(isBoundSiteSettled(session)).toBe(false);
    expect(session.choice.resolved).toBe(false);
    expect(session.run.pendingChoiceShard).toBe(THRENOS);
    expect(session.run.shards).toEqual([THRENOS]);
  });
});

describe("chooseAtBoundSite(wrack) — free (mercy, AC scenario)", () => {
  it("grants the weaker Threnos shard with karma+ and no corruption", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(WRACK, newMoralLedger()),
      "free"
    );
    expect(isBoundSiteSettled(settled)).toBe(true);
    expect(settled.choice).toEqual({
      resolved: true,
      shard: THRENOS,
      variant: "free",
    });
    expect(settled.corruptionAccrued).toBe(0);
    expect(settled.ledger.karma).toBe(1);
    expect(settled.ledger.freeChoices).toBe(1);
    expect(settled.ledger.wieldChoices).toBe(0);
    // The choice persists on the run: pending cleared, Threnos retained.
    expect(settled.run.pendingChoiceShard).toBeNull();
    expect(settled.run.shards).toEqual([THRENOS]);
  });
});

describe("chooseAtBoundSite(wrack) — wield (wielded, AC7)", () => {
  it("grants the stronger Threnos carry with accruing corruption and karma-", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(WRACK, newMoralLedger()),
      "wield"
    );
    expect(settled.choice).toEqual({
      resolved: true,
      shard: THRENOS,
      variant: "wield",
    });
    expect(settled.corruptionAccrued).toBe(
      BOUNDS[THRENOS].variants.wield.corruptionRate
    );
    expect(settled.corruptionAccrued).toBeGreaterThan(0);
    expect(settled.ledger.karma).toBe(-1);
    expect(settled.ledger.wieldChoices).toBe(1);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("Threnos site — measurable divergence, determinism, idempotence", () => {
  it("free and wield yield measurably different settled state (the moral fork)", () => {
    const free = chooseAtBoundSite(
      openBoundSite(WRACK, newMoralLedger()),
      "free"
    );
    const wield = chooseAtBoundSite(
      openBoundSite(WRACK, newMoralLedger()),
      "wield"
    );
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
    expect(hashBoundSite(free)).not.toBe(hashBoundSite(wield));
  });

  it("is deterministic: same region + ledger + mode ⇒ identical settled session + hash", () => {
    const a = chooseAtBoundSite(
      openBoundSite(WRACK, newMoralLedger()),
      "wield"
    );
    const b = chooseAtBoundSite(
      openBoundSite(WRACK, newMoralLedger()),
      "wield"
    );
    expect(a).toEqual(b);
    expect(hashBoundSite(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashBoundSite(b)).toBe(hashBoundSite(a));
  });

  it("a second choice against a settled Threnos site is a no-op (cannot re-count)", () => {
    const first = chooseAtBoundSite(
      openBoundSite(WRACK, newMoralLedger()),
      "wield"
    );
    const second = chooseAtBoundSite(first, "free");
    expect(second.choice).toEqual(first.choice);
    expect(second.ledger).toEqual(first.ledger);
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });
});
