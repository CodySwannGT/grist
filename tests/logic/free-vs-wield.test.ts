/**
 * Unit suite for the pure free-vs-wield resolution model
 * (`src/logic/free-vs-wield`): the slice's moral choice (PRD #41 FR5 / AC5).
 * Given a run with a pending shard choice, the player commits to **free** (the
 * weaker, corruption-free attunement, karma+) or **wield** (the stronger carry
 * that accrues corruption, karma−); the reducer selects the variant, accrues
 * corruption from the content table, folds the {@link MoralLedger}, records the
 * persisted {@link SavedChoice}, and clears the run's pending trigger. Pure
 * data-in / data-out (it composes `content/bounds` + `logic/save/types` +
 * `logic/run-state`), so the whole divergence contract is asserted headless with
 * no Phaser and no RNG.
 */
import { describe, expect, it } from "vitest";
import { BOUNDS, BoundIds } from "../../src/content/bounds";
import {
  KARMA_FREE_DELTA,
  KARMA_WIELD_DELTA,
  isResolved,
  type MoralResolution,
  newMoralLedger,
  resolveChoice,
} from "../../src/logic/free-vs-wield";
import { newRunState, type RunState } from "../../src/logic/run-state";

/** A run with the Ashling reward shard's free-vs-wield choice pending. */
const PENDING: RunState = {
  ...newRunState(),
  shards: [BoundIds.marrowBound],
  pendingChoiceShard: BoundIds.marrowBound,
};

describe("newMoralLedger", () => {
  it("starts at neutral karma with no choices counted", () => {
    expect(newMoralLedger()).toEqual({
      karma: 0,
      freeChoices: 0,
      wieldChoices: 0,
    });
  });
});

describe("resolveChoice — free", () => {
  it("grants the free variant, accrues no corruption, and raises karma (AC: free)", () => {
    const out: MoralResolution = resolveChoice(
      PENDING,
      newMoralLedger(),
      "free"
    );
    expect(out.choice).toEqual({
      resolved: true,
      shard: BoundIds.marrowBound,
      variant: "free",
    });
    expect(out.corruptionAccrued).toBe(0);
    expect(out.ledger.karma).toBe(KARMA_FREE_DELTA);
    expect(out.ledger.freeChoices).toBe(1);
    expect(out.ledger.wieldChoices).toBe(0);
  });

  it("clears the pending choice on the returned run", () => {
    const out = resolveChoice(PENDING, newMoralLedger(), "free");
    expect(out.run.pendingChoiceShard).toBeNull();
    // The acquired shard is retained; only the pending trigger clears.
    expect(out.run.shards).toEqual([BoundIds.marrowBound]);
  });
});

describe("resolveChoice — wield", () => {
  it("grants the wield variant, accrues corruption, and lowers karma (AC: wield)", () => {
    const out = resolveChoice(PENDING, newMoralLedger(), "wield");
    expect(out.choice).toEqual({
      resolved: true,
      shard: BoundIds.marrowBound,
      variant: "wield",
    });
    expect(out.corruptionAccrued).toBe(
      BOUNDS[BoundIds.marrowBound].variants.wield.corruptionRate
    );
    expect(out.corruptionAccrued).toBeGreaterThan(0);
    expect(out.ledger.karma).toBe(KARMA_WIELD_DELTA);
    expect(out.ledger.freeChoices).toBe(0);
    expect(out.ledger.wieldChoices).toBe(1);
  });

  it("clears the pending choice on the returned run", () => {
    const out = resolveChoice(PENDING, newMoralLedger(), "wield");
    expect(out.run.pendingChoiceShard).toBeNull();
  });
});

describe("resolveChoice — measurable divergence (AC: outcomes differ)", () => {
  it("yields measurably different state for free vs wield from identical pre-state", () => {
    const free = resolveChoice(PENDING, newMoralLedger(), "free");
    const wield = resolveChoice(PENDING, newMoralLedger(), "wield");

    // The whole resolution result differs between the two paths.
    expect(free).not.toEqual(wield);
    // ...on the variant selected,
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    // ...on karma (moralLedger),
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    // ...and on corruption accrued.
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
  });

  it("is a total function of its inputs — same inputs yield deep-equal results", () => {
    expect(resolveChoice(PENDING, newMoralLedger(), "wield")).toEqual(
      resolveChoice(PENDING, newMoralLedger(), "wield")
    );
  });
});

describe("isResolved", () => {
  it("reports true for a committed resolution and false for a no-op", () => {
    expect(isResolved(resolveChoice(PENDING, newMoralLedger(), "free"))).toBe(
      true
    );
    expect(
      isResolved(resolveChoice(newRunState(), newMoralLedger(), "wield"))
    ).toBe(false);
  });
});

describe("resolveChoice — edge cases", () => {
  it("no-ops when no choice is pending (returns the same objects)", () => {
    const run = newRunState();
    const ledger = newMoralLedger();
    const out = resolveChoice(run, ledger, "free");
    expect(out.run).toBe(run);
    expect(out.ledger).toBe(ledger);
    expect(out.choice.resolved).toBe(false);
    expect(out.corruptionAccrued).toBe(0);
  });

  it("is idempotent — a second resolve cannot re-count the ledger", () => {
    const first = resolveChoice(PENDING, newMoralLedger(), "wield");
    // After the first resolution the pending trigger is cleared, so a second
    // attempt against the resulting run is a no-op that leaves the ledger intact.
    const second = resolveChoice(first.run, first.ledger, "free");
    expect(second.ledger).toBe(first.ledger);
    expect(second.run).toBe(first.run);
    expect(second.ledger.wieldChoices).toBe(1);
    expect(second.ledger.freeChoices).toBe(0);
  });

  it("never mutates the inputs", () => {
    const run: RunState = {
      ...newRunState(),
      shards: [BoundIds.marrowBound],
      pendingChoiceShard: BoundIds.marrowBound,
    };
    const ledger = newMoralLedger();
    resolveChoice(run, ledger, "wield");
    expect(run.pendingChoiceShard).toBe(BoundIds.marrowBound);
    expect(ledger).toEqual({ karma: 0, freeChoices: 0, wieldChoices: 0 });
  });

  it("accrues the chosen variant's corruption rate exactly (free=0, wield>0)", () => {
    const free = resolveChoice(PENDING, newMoralLedger(), "free");
    const wield = resolveChoice(PENDING, newMoralLedger(), "wield");
    const variants = BOUNDS[BoundIds.marrowBound].variants;
    expect(free.corruptionAccrued).toBe(variants.free.corruptionRate);
    expect(wield.corruptionAccrued).toBe(variants.wield.corruptionRate);
  });
});
