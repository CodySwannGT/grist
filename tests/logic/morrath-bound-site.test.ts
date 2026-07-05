/**
 * Unit coverage for **Morrath the Cinder-bound's free-vs-wield site** in the
 * Cinderfen (#131, PRD #43 FR5 / AC7). The Cinderfen region sites Morrath
 * (`content/regions` → `boundSite: morrath`), and this suite proves — headless, with
 * ZERO Phaser imports (FR9) — that anchoring that site through the shipped Bound-site
 * template (#135) and the Phase-2 free-vs-wield kit (#69, reused verbatim — never
 * re-spec'd here) yields the franchise's core moral fork:
 *
 * - **free** — the weaker Morrath shard, karma+, and NO corruption: the MERCY of
 *   letting a dying, half-rendered Bound guttering out amid the dead refineries go.
 * - **wield** — the stronger carry that accrues corruption (karma−): draining a
 *   dying god for raw power, the desecration.
 *
 * Morrath is the atrocity DYING — a moral gut-punch more than a fight — so its wield
 * cost is heavy (strictly above the Marrow Bound's) yet still sits BELOW Korrholt's
 * openly-run reactor: Korrholt (harnessed in the open) remains the heaviest authored
 * Bound, so Morrath's fork is measurable without over-claiming. The unit twin proves
 * the rule headlessly; `tests/e2e/morrath-bound-site.spec.ts` proves it persists
 * across a genuine reload on the live `__VERIFY__` canvas.
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

/** The Cinderfen region — the one that sites Morrath. */
const CINDERFEN = REGIONS[RegionIds.cinderfen];
/** The Bound the Cinderfen region sites: Morrath, the Cinder-bound. */
const MORRATH = BoundIds.morrath;

describe("Morrath Bound data — the Cinderfen site's Cinder-bound (#131)", () => {
  it("the Cinderfen region sites exactly Morrath", () => {
    expect(CINDERFEN.boundSite).toBe(MORRATH);
  });

  it("free accrues no corruption (the mercy — the dying Bound let go)", () => {
    expect(BOUNDS[MORRATH].variants.free.corruptionRate).toBe(0);
  });

  it("wield accrues corruption — non-zero (AC7 requires the fork be measurable)", () => {
    expect(BOUNDS[MORRATH].variants.wield.corruptionRate).toBeGreaterThan(0);
  });

  it("is a heavy decision: Morrath's wield cost is strictly above the Marrow Bound's", () => {
    expect(BOUNDS[MORRATH].variants.wield.corruptionRate).toBeGreaterThan(
      BOUNDS[BoundIds.marrowBound].variants.wield.corruptionRate
    );
  });

  it("the atrocity dying, not industrialized: Morrath's wield cost sits below Korrholt's openly-run reactor", () => {
    expect(BOUNDS[MORRATH].variants.wield.corruptionRate).toBeLessThan(
      BOUNDS[BoundIds.korrholt].variants.wield.corruptionRate
    );
  });
});

describe("openBoundSite(cinderfen) — anchoring Morrath's site (#131 / #135)", () => {
  it("sites exactly Morrath and offers its content-table variants", () => {
    const session = openBoundSite(CINDERFEN, newMoralLedger());
    expect(boundSiteShard(session)).toBe(MORRATH);
    expect(session.regionId).toBe(CINDERFEN.id);
    expect(session.variants).toEqual(BOUNDS[MORRATH].variants);
  });

  it("opens unsettled: Morrath's free-vs-wield choice is pending, the shard acquired", () => {
    const session = openBoundSite(CINDERFEN, newMoralLedger());
    expect(isBoundSiteSettled(session)).toBe(false);
    expect(session.choice.resolved).toBe(false);
    expect(session.run.pendingChoiceShard).toBe(MORRATH);
    expect(session.run.shards).toEqual([MORRATH]);
  });
});

describe("chooseAtBoundSite(cinderfen) — free (mercy, AC scenario)", () => {
  it("grants the weaker Morrath shard with karma+ and no corruption", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(CINDERFEN, newMoralLedger()),
      "free"
    );
    expect(isBoundSiteSettled(settled)).toBe(true);
    expect(settled.choice).toEqual({
      resolved: true,
      shard: MORRATH,
      variant: "free",
    });
    expect(settled.corruptionAccrued).toBe(0);
    expect(settled.ledger.karma).toBe(1);
    expect(settled.ledger.freeChoices).toBe(1);
    expect(settled.ledger.wieldChoices).toBe(0);
    // The choice persists on the run: pending cleared, Morrath retained.
    expect(settled.run.pendingChoiceShard).toBeNull();
    expect(settled.run.shards).toEqual([MORRATH]);
  });
});

describe("chooseAtBoundSite(cinderfen) — wield (wielded, AC7)", () => {
  it("grants the stronger Morrath carry with accruing corruption and karma-", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(CINDERFEN, newMoralLedger()),
      "wield"
    );
    expect(settled.choice).toEqual({
      resolved: true,
      shard: MORRATH,
      variant: "wield",
    });
    expect(settled.corruptionAccrued).toBe(
      BOUNDS[MORRATH].variants.wield.corruptionRate
    );
    expect(settled.corruptionAccrued).toBeGreaterThan(0);
    expect(settled.ledger.karma).toBe(-1);
    expect(settled.ledger.wieldChoices).toBe(1);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("Morrath site — measurable divergence, determinism, idempotence", () => {
  it("free and wield yield measurably different settled state (the moral fork)", () => {
    const free = chooseAtBoundSite(
      openBoundSite(CINDERFEN, newMoralLedger()),
      "free"
    );
    const wield = chooseAtBoundSite(
      openBoundSite(CINDERFEN, newMoralLedger()),
      "wield"
    );
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
    expect(hashBoundSite(free)).not.toBe(hashBoundSite(wield));
  });

  it("is deterministic: same region + ledger + mode ⇒ identical settled session + hash", () => {
    const a = chooseAtBoundSite(
      openBoundSite(CINDERFEN, newMoralLedger()),
      "wield"
    );
    const b = chooseAtBoundSite(
      openBoundSite(CINDERFEN, newMoralLedger()),
      "wield"
    );
    expect(a).toEqual(b);
    expect(hashBoundSite(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashBoundSite(b)).toBe(hashBoundSite(a));
  });

  it("a second choice against a settled Morrath site is a no-op (cannot re-count)", () => {
    const first = chooseAtBoundSite(
      openBoundSite(CINDERFEN, newMoralLedger()),
      "wield"
    );
    const second = chooseAtBoundSite(first, "free");
    expect(second.choice).toEqual(first.choice);
    expect(second.ledger).toEqual(first.ledger);
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });
});
