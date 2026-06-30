/**
 * Unit coverage for **Velith the Deep-bound's free-vs-wield site** in the Roots /
 * the Deep (#144, PRD #43 FR5 / AC1 / AC7). The Roots region sites Velith
 * (`content/regions` → `boundSite: velith-deepbound`), and this suite proves —
 * headless, with ZERO Phaser imports (FR9) — that anchoring that site through the
 * shipped Bound-site template (#135) and the Phase-2 free-vs-wield kit (#69, reused
 * verbatim — never re-spec'd here) yields the franchise's core moral fork:
 *
 * - **free** — the weaker Velith shard, karma+, and NO corruption.
 * - **wield** — the stronger carry that accrues corruption (karma−).
 *
 * Velith is "near-free" (the ancient power that remembers the Choir, almost beyond
 * the Reckoning's leash — `wiki/design/bestiary.md`), so its wield cost is the
 * *gentlest* of any Bound — strictly less than the Marrow Bound's — but still
 * **non-zero**: the issue's AC scenario 2 requires that wielding Velith *accrues*
 * corruption, so a zero rate would be a content bug, not lore fidelity. The unit
 * twin proves the rule headlessly; `tests/e2e/velith-bound-site.spec.ts` proves it
 * persists across a genuine reload on the live `__VERIFY__` canvas.
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

/** The Roots / the Deep region — the one that sites Velith. */
const ROOTS = REGIONS[RegionIds.roots];
/** The Bound the Roots region sites: Velith, the Deep-bound. */
const VELITH = BoundIds.velithDeepbound;

describe("Velith Bound data — the Roots site's near-free Bound (#144)", () => {
  it("the Roots region sites exactly Velith", () => {
    expect(ROOTS.boundSite).toBe(VELITH);
  });

  it("free accrues no corruption (the safe attunement)", () => {
    expect(BOUNDS[VELITH].variants.free.corruptionRate).toBe(0);
  });

  it("wield accrues corruption — non-zero (AC scenario 2 requires it accrues)", () => {
    expect(BOUNDS[VELITH].variants.wield.corruptionRate).toBeGreaterThan(0);
  });

  it("is the gentlest carry: Velith's wield cost is strictly below the Marrow Bound's (near-free)", () => {
    expect(BOUNDS[VELITH].variants.wield.corruptionRate).toBeLessThan(
      BOUNDS[BoundIds.marrowBound].variants.wield.corruptionRate
    );
  });
});

describe("openBoundSite(roots) — anchoring Velith's site (#144 / #135)", () => {
  it("sites exactly Velith and offers its content-table variants", () => {
    const session = openBoundSite(ROOTS, newMoralLedger());
    expect(boundSiteShard(session)).toBe(VELITH);
    expect(session.regionId).toBe(ROOTS.id);
    expect(session.variants).toEqual(BOUNDS[VELITH].variants);
  });

  it("opens unsettled: Velith's free-vs-wield choice is pending, the shard acquired", () => {
    const session = openBoundSite(ROOTS, newMoralLedger());
    expect(isBoundSiteSettled(session)).toBe(false);
    expect(session.choice.resolved).toBe(false);
    expect(session.run.pendingChoiceShard).toBe(VELITH);
    expect(session.run.shards).toEqual([VELITH]);
  });
});

describe("chooseAtBoundSite(roots) — free (AC1 / scenario 1)", () => {
  it("grants the weaker Velith shard with karma+ and no corruption", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(ROOTS, newMoralLedger()),
      "free"
    );
    expect(isBoundSiteSettled(settled)).toBe(true);
    expect(settled.choice).toEqual({
      resolved: true,
      shard: VELITH,
      variant: "free",
    });
    expect(settled.corruptionAccrued).toBe(0);
    expect(settled.ledger.karma).toBe(1);
    expect(settled.ledger.freeChoices).toBe(1);
    expect(settled.ledger.wieldChoices).toBe(0);
    // The choice persists on the run: pending cleared, Velith retained.
    expect(settled.run.pendingChoiceShard).toBeNull();
    expect(settled.run.shards).toEqual([VELITH]);
  });
});

describe("chooseAtBoundSite(roots) — wield (AC7 / scenario 2)", () => {
  it("grants the stronger Velith carry with accruing corruption and karma-", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(ROOTS, newMoralLedger()),
      "wield"
    );
    expect(settled.choice).toEqual({
      resolved: true,
      shard: VELITH,
      variant: "wield",
    });
    expect(settled.corruptionAccrued).toBe(
      BOUNDS[VELITH].variants.wield.corruptionRate
    );
    expect(settled.corruptionAccrued).toBeGreaterThan(0);
    expect(settled.ledger.karma).toBe(-1);
    expect(settled.ledger.wieldChoices).toBe(1);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("Velith site — measurable divergence, determinism, idempotence", () => {
  it("free and wield yield measurably different settled state (the moral fork)", () => {
    const free = chooseAtBoundSite(
      openBoundSite(ROOTS, newMoralLedger()),
      "free"
    );
    const wield = chooseAtBoundSite(
      openBoundSite(ROOTS, newMoralLedger()),
      "wield"
    );
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
    expect(hashBoundSite(free)).not.toBe(hashBoundSite(wield));
  });

  it("is deterministic: same region + ledger + mode ⇒ identical settled session + hash", () => {
    const a = chooseAtBoundSite(
      openBoundSite(ROOTS, newMoralLedger()),
      "wield"
    );
    const b = chooseAtBoundSite(
      openBoundSite(ROOTS, newMoralLedger()),
      "wield"
    );
    expect(a).toEqual(b);
    expect(hashBoundSite(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashBoundSite(b)).toBe(hashBoundSite(a));
  });

  it("a second choice against a settled Velith site is a no-op (cannot re-count)", () => {
    const first = chooseAtBoundSite(
      openBoundSite(ROOTS, newMoralLedger()),
      "wield"
    );
    const second = chooseAtBoundSite(first, "free");
    expect(second.choice).toEqual(first.choice);
    expect(second.ledger).toEqual(first.ledger);
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });
});
