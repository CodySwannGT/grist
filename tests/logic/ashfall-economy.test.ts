/**
 * Unit coverage for the two-world-state (harsher Act II) economy (#141): the
 * per-world-state {@link EconomyProfile} multipliers (`ECONOMY_PROFILES`) and the
 * pure earn/cost math ({@link applyEconomyReward} / {@link applyEconomyCost}) resolved
 * through the world-state flag. These are the Phaser-free assertions the issue's
 * Validation Journey names ("economy math in `src/logic`"), exercised without a DOM.
 * The in-game `__VERIFY__` harsher-economy journey is verified by the e2e suite
 * (`tests/e2e/ashfall-variants-economy.spec.ts`). ZERO Phaser imports by design (FR9).
 *
 * Expected values are hardcoded known constants (not derived from the multipliers
 * under test), so a tuning edit is caught rather than silently mirrored.
 */
import { describe, expect, it } from "vitest";

import {
  ECONOMY_PROFILES,
  applyEconomyCost,
  applyEconomyReward,
  resolveEconomyProfile,
} from "../../src/content";
import { type WorldState } from "../../src/logic/world";

const REACH: WorldState = "reach";
const ASHFALL: WorldState = "ashfall";

describe("ECONOMY_PROFILES — the two-world-state dials", () => {
  it("keeps Act I reach neutral (1x / 1x)", () => {
    expect(ECONOMY_PROFILES.reach).toEqual({
      rewardMultiplier: 1,
      costMultiplier: 1,
    });
  });

  it("tightens Act II ashfall (leaner rewards, harsher costs)", () => {
    const ashfall = ECONOMY_PROFILES.ashfall;
    expect(ashfall.rewardMultiplier).toBeLessThan(1);
    expect(ashfall.costMultiplier).toBeGreaterThan(1);
  });

  it("resolves the profile through the flag", () => {
    expect(resolveEconomyProfile(REACH)).toBe(ECONOMY_PROFILES.reach);
    expect(resolveEconomyProfile(ASHFALL)).toBe(ECONOMY_PROFILES.ashfall);
  });
});

describe("applyEconomyReward — leaner Ashfall income", () => {
  it("pays a base earn in full in reach", () => {
    expect(applyEconomyReward(10, REACH)).toBe(10);
    expect(applyEconomyReward(6, REACH)).toBe(6);
  });

  it("pays strictly less in ashfall for a positive earn", () => {
    // 10 * 0.6 -> 6; 6 * 0.6 = 3.6 -> trunc 3.
    expect(applyEconomyReward(10, ASHFALL)).toBe(6);
    expect(applyEconomyReward(6, ASHFALL)).toBe(3);
    expect(applyEconomyReward(20, ASHFALL)).toBeLessThan(
      applyEconomyReward(20, REACH)
    );
  });

  it("keeps a zero earn at zero and never mints negative", () => {
    expect(applyEconomyReward(0, ASHFALL)).toBe(0);
    expect(applyEconomyReward(-5, ASHFALL)).toBe(0);
  });

  it("returns whole grist", () => {
    expect(Number.isInteger(applyEconomyReward(7, ASHFALL))).toBe(true);
  });
});

describe("applyEconomyCost — harsher Ashfall costs", () => {
  it("charges a base cost in full in reach", () => {
    expect(applyEconomyCost(10, REACH)).toBe(10);
    expect(applyEconomyCost(4, REACH)).toBe(4);
  });

  it("charges strictly more in ashfall for a positive cost", () => {
    // 10 * 1.5 -> 15; 4 * 1.5 = 6.
    expect(applyEconomyCost(10, ASHFALL)).toBe(15);
    expect(applyEconomyCost(4, ASHFALL)).toBe(6);
    expect(applyEconomyCost(7, ASHFALL)).toBeGreaterThan(
      applyEconomyCost(7, REACH)
    );
  });

  it("rounds a fractional scaled cost UP (Ashfall costs more, never less)", () => {
    // 5 * 1.5 = 7.5 -> ceil 8.
    expect(applyEconomyCost(5, ASHFALL)).toBe(8);
  });

  it("keeps a zero cost at zero", () => {
    expect(applyEconomyCost(0, ASHFALL)).toBe(0);
  });
});

describe("determinism — the economy math is a total function of its inputs", () => {
  it("returns identical results for identical inputs", () => {
    expect(applyEconomyReward(13, ASHFALL)).toBe(
      applyEconomyReward(13, ASHFALL)
    );
    expect(applyEconomyCost(13, ASHFALL)).toBe(applyEconomyCost(13, ASHFALL));
  });
});
