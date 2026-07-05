/**
 * Unit coverage for **Sylvath the Green Wyrm's free-vs-wield site** in the
 * Sylvemarch (#129, PRD #43 FR5 / AC7). The Sylvemarch region sites Sylvath
 * (`content/regions` → `boundSite: sylvath`), and this suite proves — headless, with
 * ZERO Phaser imports (FR9) — that anchoring that site through the shipped
 * Bound-site template (#135) and the Phase-2 free-vs-wield kit (#69, reused verbatim
 * — never re-spec'd here) yields the franchise's core moral fork:
 *
 * - **free** — the weaker Sylvath shard, karma+, and NO corruption (the Green Wyrm
 *   set loose).
 * - **wield** — the stronger carry that accrues corruption (karma−): caging the
 *   great wyrm and paying for it.
 *
 * Sylvath is a MAJOR free-vs-wield decision (a great caged wyrm, not the near-free
 * Deep-bound), so its wield cost is the HEAVIEST authored Bound — strictly above the
 * Marrow Bound's — while freeing it stays corruption-free. The unit twin proves the
 * rule headlessly; `tests/e2e/sylvath-bound-site.spec.ts` proves it persists across a
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

/** The Sylvemarch region — the one that sites Sylvath. */
const SYLVEMARCH = REGIONS[RegionIds.sylvemarch];
/** The Bound the Sylvemarch region sites: Sylvath, the Green Wyrm. */
const SYLVATH = BoundIds.sylvath;

describe("Sylvath Bound data — the Sylvemarch site's Green Wyrm (#129)", () => {
  it("the Sylvemarch region sites exactly Sylvath", () => {
    expect(SYLVEMARCH.boundSite).toBe(SYLVATH);
  });

  it("free accrues no corruption (the safe attunement — the wyrm set loose)", () => {
    expect(BOUNDS[SYLVATH].variants.free.corruptionRate).toBe(0);
  });

  it("wield accrues corruption — non-zero (AC7 requires the fork be measurable)", () => {
    expect(BOUNDS[SYLVATH].variants.wield.corruptionRate).toBeGreaterThan(0);
  });

  it("is a major decision: Sylvath's wield cost is strictly above the Marrow Bound's", () => {
    expect(BOUNDS[SYLVATH].variants.wield.corruptionRate).toBeGreaterThan(
      BOUNDS[BoundIds.marrowBound].variants.wield.corruptionRate
    );
  });
});

describe("openBoundSite(sylvemarch) — anchoring Sylvath's site (#129 / #135)", () => {
  it("sites exactly Sylvath and offers its content-table variants", () => {
    const session = openBoundSite(SYLVEMARCH, newMoralLedger());
    expect(boundSiteShard(session)).toBe(SYLVATH);
    expect(session.regionId).toBe(SYLVEMARCH.id);
    expect(session.variants).toEqual(BOUNDS[SYLVATH].variants);
  });

  it("opens unsettled: Sylvath's free-vs-wield choice is pending, the shard acquired", () => {
    const session = openBoundSite(SYLVEMARCH, newMoralLedger());
    expect(isBoundSiteSettled(session)).toBe(false);
    expect(session.choice.resolved).toBe(false);
    expect(session.run.pendingChoiceShard).toBe(SYLVATH);
    expect(session.run.shards).toEqual([SYLVATH]);
  });
});

describe("chooseAtBoundSite(sylvemarch) — free (freed, AC scenario)", () => {
  it("grants the weaker Sylvath shard with karma+ and no corruption", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(SYLVEMARCH, newMoralLedger()),
      "free"
    );
    expect(isBoundSiteSettled(settled)).toBe(true);
    expect(settled.choice).toEqual({
      resolved: true,
      shard: SYLVATH,
      variant: "free",
    });
    expect(settled.corruptionAccrued).toBe(0);
    expect(settled.ledger.karma).toBe(1);
    expect(settled.ledger.freeChoices).toBe(1);
    expect(settled.ledger.wieldChoices).toBe(0);
    // The choice persists on the run: pending cleared, Sylvath retained.
    expect(settled.run.pendingChoiceShard).toBeNull();
    expect(settled.run.shards).toEqual([SYLVATH]);
  });
});

describe("chooseAtBoundSite(sylvemarch) — wield (wielded, AC7)", () => {
  it("grants the stronger Sylvath carry with accruing corruption and karma-", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(SYLVEMARCH, newMoralLedger()),
      "wield"
    );
    expect(settled.choice).toEqual({
      resolved: true,
      shard: SYLVATH,
      variant: "wield",
    });
    expect(settled.corruptionAccrued).toBe(
      BOUNDS[SYLVATH].variants.wield.corruptionRate
    );
    expect(settled.corruptionAccrued).toBeGreaterThan(0);
    expect(settled.ledger.karma).toBe(-1);
    expect(settled.ledger.wieldChoices).toBe(1);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("Sylvath site — measurable divergence, determinism, idempotence", () => {
  it("free and wield yield measurably different settled state (the moral fork)", () => {
    const free = chooseAtBoundSite(
      openBoundSite(SYLVEMARCH, newMoralLedger()),
      "free"
    );
    const wield = chooseAtBoundSite(
      openBoundSite(SYLVEMARCH, newMoralLedger()),
      "wield"
    );
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
    expect(hashBoundSite(free)).not.toBe(hashBoundSite(wield));
  });

  it("is deterministic: same region + ledger + mode ⇒ identical settled session + hash", () => {
    const a = chooseAtBoundSite(
      openBoundSite(SYLVEMARCH, newMoralLedger()),
      "wield"
    );
    const b = chooseAtBoundSite(
      openBoundSite(SYLVEMARCH, newMoralLedger()),
      "wield"
    );
    expect(a).toEqual(b);
    expect(hashBoundSite(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashBoundSite(b)).toBe(hashBoundSite(a));
  });

  it("a second choice against a settled Sylvath site is a no-op (cannot re-count)", () => {
    const first = chooseAtBoundSite(
      openBoundSite(SYLVEMARCH, newMoralLedger()),
      "wield"
    );
    const second = chooseAtBoundSite(first, "free");
    expect(second.choice).toEqual(first.choice);
    expect(second.ledger).toEqual(first.ledger);
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });
});
