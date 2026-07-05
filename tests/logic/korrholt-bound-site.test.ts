/**
 * Unit coverage for **Korrholt the Anvil-Heart's free-vs-wield site** in Holtspire
 * (#130, PRD #43 FR5 / AC7). The Holtspire region sites Korrholt
 * (`content/regions` → `boundSite: korrholt`), and this suite proves — headless, with
 * ZERO Phaser imports (FR9) — that anchoring that site through the shipped Bound-site
 * template (#135) and the Phase-2 free-vs-wield kit (#69, reused verbatim — never
 * re-spec'd here) yields the franchise's core moral fork:
 *
 * - **free** — the weaker Korrholt shard, karma+, and NO corruption (the city reactor
 *   banked, the atrocity refused).
 * - **wield** — the stronger carry that accrues corruption (karma−): running the
 *   Anvil-Heart openly and paying for it.
 *
 * Korrholt is the atrocity INDUSTRIALIZED — harnessed openly as the city reactor — so
 * the free-vs-wield choice is at its STARKEST: its wield cost is the HEAVIEST authored
 * Bound to date, strictly above Sylvath the Green Wyrm's, while freeing it stays
 * corruption-free. The unit twin proves the rule headlessly;
 * `tests/e2e/korrholt-bound-site.spec.ts` proves it persists across a genuine reload on
 * the live `__VERIFY__` canvas.
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

/** The Holtspire region — the one that sites Korrholt. */
const HOLTSPIRE = REGIONS[RegionIds.holtspire];
/** The Bound the Holtspire region sites: Korrholt, the Anvil-Heart. */
const KORRHOLT = BoundIds.korrholt;

describe("Korrholt Bound data — the Holtspire site's Anvil-Heart (#130)", () => {
  it("the Holtspire region sites exactly Korrholt", () => {
    expect(HOLTSPIRE.boundSite).toBe(KORRHOLT);
  });

  it("free accrues no corruption (the safe attunement — the reactor banked)", () => {
    expect(BOUNDS[KORRHOLT].variants.free.corruptionRate).toBe(0);
  });

  it("wield accrues corruption — non-zero (AC7 requires the fork be measurable)", () => {
    expect(BOUNDS[KORRHOLT].variants.wield.corruptionRate).toBeGreaterThan(0);
  });

  it("is the starkest decision: Korrholt's wield cost is strictly above the Marrow Bound's", () => {
    expect(BOUNDS[KORRHOLT].variants.wield.corruptionRate).toBeGreaterThan(
      BOUNDS[BoundIds.marrowBound].variants.wield.corruptionRate
    );
  });

  it("the atrocity industrialized: Korrholt's wield cost is the heaviest — above Sylvath's", () => {
    expect(BOUNDS[KORRHOLT].variants.wield.corruptionRate).toBeGreaterThan(
      BOUNDS[BoundIds.sylvath].variants.wield.corruptionRate
    );
  });
});

describe("openBoundSite(holtspire) — anchoring Korrholt's site (#130 / #135)", () => {
  it("sites exactly Korrholt and offers its content-table variants", () => {
    const session = openBoundSite(HOLTSPIRE, newMoralLedger());
    expect(boundSiteShard(session)).toBe(KORRHOLT);
    expect(session.regionId).toBe(HOLTSPIRE.id);
    expect(session.variants).toEqual(BOUNDS[KORRHOLT].variants);
  });

  it("opens unsettled: Korrholt's free-vs-wield choice is pending, the shard acquired", () => {
    const session = openBoundSite(HOLTSPIRE, newMoralLedger());
    expect(isBoundSiteSettled(session)).toBe(false);
    expect(session.choice.resolved).toBe(false);
    expect(session.run.pendingChoiceShard).toBe(KORRHOLT);
    expect(session.run.shards).toEqual([KORRHOLT]);
  });
});

describe("chooseAtBoundSite(holtspire) — free (banked, AC scenario)", () => {
  it("grants the weaker Korrholt shard with karma+ and no corruption", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(HOLTSPIRE, newMoralLedger()),
      "free"
    );
    expect(isBoundSiteSettled(settled)).toBe(true);
    expect(settled.choice).toEqual({
      resolved: true,
      shard: KORRHOLT,
      variant: "free",
    });
    expect(settled.corruptionAccrued).toBe(0);
    expect(settled.ledger.karma).toBe(1);
    expect(settled.ledger.freeChoices).toBe(1);
    expect(settled.ledger.wieldChoices).toBe(0);
    // The choice persists on the run: pending cleared, Korrholt retained.
    expect(settled.run.pendingChoiceShard).toBeNull();
    expect(settled.run.shards).toEqual([KORRHOLT]);
  });
});

describe("chooseAtBoundSite(holtspire) — wield (wielded, AC7)", () => {
  it("grants the stronger Korrholt carry with accruing corruption and karma-", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(HOLTSPIRE, newMoralLedger()),
      "wield"
    );
    expect(settled.choice).toEqual({
      resolved: true,
      shard: KORRHOLT,
      variant: "wield",
    });
    expect(settled.corruptionAccrued).toBe(
      BOUNDS[KORRHOLT].variants.wield.corruptionRate
    );
    expect(settled.corruptionAccrued).toBeGreaterThan(0);
    expect(settled.ledger.karma).toBe(-1);
    expect(settled.ledger.wieldChoices).toBe(1);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("Korrholt site — measurable divergence, determinism, idempotence", () => {
  it("free and wield yield measurably different settled state (the moral fork)", () => {
    const free = chooseAtBoundSite(
      openBoundSite(HOLTSPIRE, newMoralLedger()),
      "free"
    );
    const wield = chooseAtBoundSite(
      openBoundSite(HOLTSPIRE, newMoralLedger()),
      "wield"
    );
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
    expect(hashBoundSite(free)).not.toBe(hashBoundSite(wield));
  });

  it("is deterministic: same region + ledger + mode ⇒ identical settled session + hash", () => {
    const a = chooseAtBoundSite(
      openBoundSite(HOLTSPIRE, newMoralLedger()),
      "wield"
    );
    const b = chooseAtBoundSite(
      openBoundSite(HOLTSPIRE, newMoralLedger()),
      "wield"
    );
    expect(a).toEqual(b);
    expect(hashBoundSite(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashBoundSite(b)).toBe(hashBoundSite(a));
  });

  it("a second choice against a settled Korrholt site is a no-op (cannot re-count)", () => {
    const first = chooseAtBoundSite(
      openBoundSite(HOLTSPIRE, newMoralLedger()),
      "wield"
    );
    const second = chooseAtBoundSite(first, "free");
    expect(second.choice).toEqual(first.choice);
    expect(second.ledger).toEqual(first.ledger);
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });
});
