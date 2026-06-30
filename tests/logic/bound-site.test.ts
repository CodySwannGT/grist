/**
 * Unit coverage for the pure per-region **Bound-site template**
 * (`src/logic/region/bound-site`, #135) — the reusable framework that anchors a
 * region's single Bound site (the region's `boundSite` {@link BoundId}, exactly one
 * per region, type-enforced in `content/regions`) and wires it through the proven
 * Phase-2 free-vs-wield kit (#69, `logic/free-vs-wield`). The template owns NO new
 * resolution rules: it sites the Bound, raises its free-vs-wield choice as pending,
 * and folds the player's commitment with the existing `resolveChoice` reducer, so
 * *free* (weaker shard, karma+, no corruption) and *wield* (stronger shard, accruing
 * corruption) diverge measurably and persist (the persisted {@link SavedChoice} +
 * {@link MoralLedger} the save layer writes).
 *
 * ZERO Phaser imports by design (FR9) — exercised headless under vitest, mirroring
 * `free-vs-wield` / `region-runtime` coverage. The site rides only the seeded model:
 * the divergence is decided by the player's `mode`, not chance, so the same inputs
 * reproduce an identical settled session + hash — the determinism thesis the e2e
 * proves on the live canvas through `__VERIFY__` (`tests/e2e/bound-site.spec.ts`).
 */
import { describe, expect, it } from "vitest";

import { BOUNDS, BoundIds, REGIONS, RegionIds } from "../../src/content";
import { newMoralLedger } from "../../src/logic/free-vs-wield";
import {
  type BoundSiteSession,
  boundSiteShard,
  chooseAtBoundSite,
  hashBoundSite,
  isBoundSiteSettled,
  openBoundSite,
} from "../../src/logic/region";

/** The canonical example region whose single Bound site the template anchors. */
const MARROW = REGIONS[RegionIds.marrow];
/** The shard the Marrow region sites (the Ashling reward Bound). */
const SHARD = BoundIds.marrowBound;

describe("openBoundSite — anchoring a region's single Bound site (#135)", () => {
  it("sites exactly the region's boundSite and offers its free/wield variants", () => {
    const session = openBoundSite(MARROW, newMoralLedger());
    expect(boundSiteShard(session)).toBe(SHARD);
    expect(session.regionId).toBe(MARROW.id);
    // The offered variants are read from the content table — never re-spec'd.
    expect(session.variants).toEqual(BOUNDS[SHARD].variants);
  });

  it("opens unsettled: the choice is pending, nothing committed", () => {
    const session = openBoundSite(MARROW, newMoralLedger());
    expect(isBoundSiteSettled(session)).toBe(false);
    expect(session.choice.resolved).toBe(false);
    // The run raised the sited shard's free-vs-wield choice as pending.
    expect(session.run.pendingChoiceShard).toBe(SHARD);
    // The sited shard is acquired (so a reload/bench can read it).
    expect(session.run.shards).toEqual([SHARD]);
  });

  it("starts from the supplied ledger (no choices counted yet)", () => {
    const session = openBoundSite(MARROW, newMoralLedger());
    expect(session.ledger).toEqual({
      karma: 0,
      freeChoices: 0,
      wieldChoices: 0,
    });
    expect(session.corruptionAccrued).toBe(0);
  });

  it("throws for a region whose boundSite is not a defined shard (rejects a broken site)", () => {
    const broken = {
      ...MARROW,
      boundSite: "no-such-bound",
    } as unknown as typeof MARROW;
    expect(() => openBoundSite(broken, newMoralLedger())).toThrow(
      /bound site/i
    );
  });
});

describe("chooseAtBoundSite — free (AC scenario 1)", () => {
  it("grants the weaker shard with karma+ and no corruption", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(MARROW, newMoralLedger()),
      "free"
    );
    expect(isBoundSiteSettled(settled)).toBe(true);
    expect(settled.choice).toEqual({
      resolved: true,
      shard: SHARD,
      variant: "free",
    });
    expect(settled.corruptionAccrued).toBe(0);
    expect(settled.ledger.karma).toBe(1);
    expect(settled.ledger.freeChoices).toBe(1);
    expect(settled.ledger.wieldChoices).toBe(0);
    // The choice persists on the run: pending cleared, shard retained.
    expect(settled.run.pendingChoiceShard).toBeNull();
    expect(settled.run.shards).toEqual([SHARD]);
  });
});

describe("chooseAtBoundSite — wield (AC scenario 2)", () => {
  it("grants the stronger shard with accruing corruption and karma-", () => {
    const settled = chooseAtBoundSite(
      openBoundSite(MARROW, newMoralLedger()),
      "wield"
    );
    expect(settled.choice).toEqual({
      resolved: true,
      shard: SHARD,
      variant: "wield",
    });
    expect(settled.corruptionAccrued).toBe(
      BOUNDS[SHARD].variants.wield.corruptionRate
    );
    expect(settled.corruptionAccrued).toBeGreaterThan(0);
    expect(settled.ledger.karma).toBe(-1);
    expect(settled.ledger.wieldChoices).toBe(1);
    expect(settled.run.pendingChoiceShard).toBeNull();
  });
});

describe("chooseAtBoundSite — measurable divergence + persistence", () => {
  it("yields measurably different settled state for free vs wield", () => {
    const free = chooseAtBoundSite(
      openBoundSite(MARROW, newMoralLedger()),
      "free"
    );
    const wield = chooseAtBoundSite(
      openBoundSite(MARROW, newMoralLedger()),
      "wield"
    );
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
    expect(hashBoundSite(free)).not.toBe(hashBoundSite(wield));
  });

  it("is a total function — same region + ledger + mode yields a deep-equal session", () => {
    const a = chooseAtBoundSite(
      openBoundSite(MARROW, newMoralLedger()),
      "wield"
    );
    const b = chooseAtBoundSite(
      openBoundSite(MARROW, newMoralLedger()),
      "wield"
    );
    expect(a).toEqual(b);
    expect(hashBoundSite(a)).toBe(hashBoundSite(b));
  });
});

describe("chooseAtBoundSite — idempotence (a settled site cannot re-count)", () => {
  it("a second choice against a settled session is a no-op", () => {
    const first = chooseAtBoundSite(
      openBoundSite(MARROW, newMoralLedger()),
      "wield"
    );
    const second = chooseAtBoundSite(first, "free");
    // The ledger and run are preserved — wield stays counted, free never lands.
    expect(second.ledger).toEqual(first.ledger);
    expect(second.choice).toEqual(first.choice);
    expect(second.run.pendingChoiceShard).toBeNull();
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });
});

describe("openBoundSite / chooseAtBoundSite — purity", () => {
  it("never mutates the supplied ledger", () => {
    const ledger = newMoralLedger();
    const session: BoundSiteSession = openBoundSite(MARROW, ledger);
    chooseAtBoundSite(session, "wield");
    expect(ledger).toEqual({ karma: 0, freeChoices: 0, wieldChoices: 0 });
  });
});
