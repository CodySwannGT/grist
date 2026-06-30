/**
 * Unit coverage for the pure **traversal + fast-travel + soft-gate service**
 * (`src/logic/travel`, #136, PRD #43 FR4 / Scope-IN 3 / AC4) — the earned-freedom
 * mobility chain (foot → skiff → airship → fast-travel) and the capability/knowledge
 * soft-gate, with grist-deducting fast-travel that draws the single shared wallet
 * (`logic/grist`, composed — not re-implemented).
 *
 * ZERO Phaser imports by design (FR9): the service is a total function of its
 * explicit inputs, uses no RNG and nothing ambient (no `Math.random` / `Date.now` /
 * `performance.now`), so the same action sequence reproduces an identical
 * `hashTravel` digest — the determinism thesis the `__VERIFY__` e2e asserts on the
 * live canvas. Exercised headless under vitest, mirroring `grist-wallet` /
 * `world-state` / `region-runtime` coverage.
 */
import { describe, expect, it } from "vitest";

import { GristTuning, newWallet } from "../../src/logic/grist";
import {
  TravelScopes,
  TraversalTiers,
  canFastTravel,
  canTravel,
  discoverSafehouse,
  fastTravel,
  hashTravel,
  newTravelState,
  unlockAirship,
  unlockSkiff,
  type TravelState,
} from "../../src/logic/travel";

const A = "marrow-safehouse";
const B = "vale-safehouse";
const C = "ashfall-safehouse";

describe("travel — construction", () => {
  it("a fresh state begins on foot with the slice starting grist and no knowledge", () => {
    const state = newTravelState();
    expect(state.tier).toBe(TraversalTiers.foot);
    expect(state.wallet.grist).toBe(GristTuning.startingGrist);
    expect(state.discovered).toEqual([]);
  });

  it("accepts an explicit starting wallet (composed from logic/grist)", () => {
    const state = newTravelState(newWallet(42));
    expect(state.wallet.grist).toBe(42);
    expect(state.tier).toBe(TraversalTiers.foot);
  });
});

describe("travel — tiers unlock in the authored order (AC scenario 1)", () => {
  it("earns the skiff from foot, opening regional travel", () => {
    const foot = newTravelState();
    expect(canTravel(foot, TravelScopes.regional)).toBe(false);
    const skiff = unlockSkiff(foot);
    expect(skiff.tier).toBe(TraversalTiers.skiff);
    expect(canTravel(skiff, TravelScopes.regional)).toBe(true);
  });

  it("earns the airship after the skiff, opening the full Reach", () => {
    const skiff = unlockSkiff(newTravelState());
    expect(canTravel(skiff, TravelScopes.fullReach)).toBe(false);
    const airship = unlockAirship(skiff);
    expect(airship.tier).toBe(TraversalTiers.airship);
    expect(canTravel(airship, TravelScopes.fullReach)).toBe(true);
    // the airship still permits the lesser regional scope.
    expect(canTravel(airship, TravelScopes.regional)).toBe(true);
  });

  it("refuses to skip the skiff — the airship is gated on the skiff (authored order)", () => {
    const foot = newTravelState();
    const stillFoot = unlockAirship(foot);
    // earning the airship before the skiff is a no-op: the chain is ordered by
    // capability, not by a clock.
    expect(stillFoot.tier).toBe(TraversalTiers.foot);
    expect(stillFoot).toBe(foot);
    expect(canTravel(stillFoot, TravelScopes.fullReach)).toBe(false);
  });

  it("on foot, local travel is always permitted but regional/full-Reach are gated", () => {
    const foot = newTravelState();
    expect(canTravel(foot, TravelScopes.local)).toBe(true);
    expect(canTravel(foot, TravelScopes.regional)).toBe(false);
    expect(canTravel(foot, TravelScopes.fullReach)).toBe(false);
  });

  it("unlocking is idempotent (re-earning a held tier is a no-op, same object)", () => {
    const skiff = unlockSkiff(newTravelState());
    expect(unlockSkiff(skiff)).toBe(skiff);
    const airship = unlockAirship(skiff);
    expect(unlockAirship(airship)).toBe(airship);
  });

  it("the gate keys on capability, never on a clock — no Date.now path exists", () => {
    // Two states with identical capability/knowledge gate identically regardless
    // of when they are evaluated (the determinism contract).
    const a = unlockAirship(unlockSkiff(newTravelState()));
    const b = unlockAirship(unlockSkiff(newTravelState()));
    expect(canTravel(a, TravelScopes.fullReach)).toBe(
      canTravel(b, TravelScopes.fullReach)
    );
  });
});

describe("travel — safehouse knowledge", () => {
  it("discovers a safehouse, recording it once (idempotent)", () => {
    const one = discoverSafehouse(newTravelState(), A);
    expect(one.discovered).toEqual([A]);
    expect(discoverSafehouse(one, A)).toBe(one);
  });

  it("records discoveries in discovery order", () => {
    const two = discoverSafehouse(discoverSafehouse(newTravelState(), A), B);
    expect(two.discovered).toEqual([A, B]);
  });
});

describe("travel — fast-travel capability soft-gate", () => {
  it("is gated on the airship AND two discovered safehouses (knowledge)", () => {
    const grounded = newTravelState(newWallet(50));
    expect(canFastTravel(grounded)).toBe(false);
    const flying = unlockAirship(unlockSkiff(grounded));
    // airship but no knowledge yet
    expect(canFastTravel(flying)).toBe(false);
    const oneKnown = discoverSafehouse(flying, A);
    expect(canFastTravel(oneKnown)).toBe(false);
    const twoKnown = discoverSafehouse(oneKnown, B);
    expect(canFastTravel(twoKnown)).toBe(true);
  });

  it("two discovered safehouses without the airship still cannot fast-travel", () => {
    const skiffKnown = discoverSafehouse(
      discoverSafehouse(unlockSkiff(newTravelState(newWallet(50))), A),
      B
    );
    expect(canFastTravel(skiffKnown)).toBe(false);
  });
});

/**
 * A travel state with the airship, two known safehouses, and a chosen wallet —
 * the precondition for the fast-travel AC scenario.
 * @param grist - The starting wallet balance.
 * @returns A fast-travel-ready travel state.
 */
function readyToFly(grist: number): TravelState {
  return discoverSafehouse(
    discoverSafehouse(
      unlockAirship(unlockSkiff(newTravelState(newWallet(grist)))),
      A
    ),
    B
  );
}

describe("travel — fast-travel deducts grist (AC scenario 2)", () => {
  it("deducts the fast-travel cost from the shared wallet on a successful hop", () => {
    const ready = readyToFly(20);
    const result = fastTravel(ready, A, B);
    expect(result.ok).toBe(true);
    expect(result.spent).toBeGreaterThan(0);
    expect(result.state.wallet.grist).toBe(20 - result.spent);
    // the party is now located at the destination.
    expect(result.state.location).toBe(B);
  });

  it("refuses a hop with insufficient grist, leaving the balance unchanged", () => {
    const broke = readyToFly(0);
    const before = broke.wallet.grist;
    const result = fastTravel(broke, A, B);
    expect(result.ok).toBe(false);
    expect(result.spent).toBe(0);
    expect(result.state).toBe(broke);
    expect(result.state.wallet.grist).toBe(before);
  });

  it("refuses a hop to an undiscovered safehouse (knowledge gate), no spend", () => {
    const ready = readyToFly(20);
    const result = fastTravel(ready, A, C);
    expect(result.ok).toBe(false);
    expect(result.spent).toBe(0);
    expect(result.state).toBe(ready);
    expect(result.state.wallet.grist).toBe(20);
  });

  it("refuses a hop from an undiscovered origin, no spend", () => {
    const ready = readyToFly(20);
    const result = fastTravel(ready, C, B);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(ready);
  });

  it("refuses a hop to the same safehouse (a zero-distance no-op is not a paid hop)", () => {
    const ready = readyToFly(20);
    const result = fastTravel(ready, A, A);
    expect(result.ok).toBe(false);
    expect(result.spent).toBe(0);
    expect(result.state.wallet.grist).toBe(20);
  });

  it("refuses a hop without the fast-travel capability (grounded), no spend", () => {
    const grounded = discoverSafehouse(
      discoverSafehouse(newTravelState(newWallet(20)), A),
      B
    );
    const result = fastTravel(grounded, A, B);
    expect(result.ok).toBe(false);
    expect(result.spent).toBe(0);
    expect(result.state).toBe(grounded);
  });

  it("a hop costing exactly the balance is affordable and zeroes the wallet", () => {
    // construct a state whose balance equals the cost.
    const probe = fastTravel(readyToFly(1000), A, B);
    const cost = probe.spent;
    const exact = readyToFly(cost);
    const result = fastTravel(exact, A, B);
    expect(result.ok).toBe(true);
    expect(result.state.wallet.grist).toBe(0);
  });
});

describe("travel — determinism (same inputs ⇒ identical hash progression)", () => {
  it("hashes equal states to equal digests and reflects every tracked field", () => {
    const a = newTravelState();
    const b = newTravelState();
    expect(hashTravel(a)).toBe(hashTravel(b));

    const skiffA = unlockSkiff(a);
    expect(hashTravel(skiffA)).not.toBe(hashTravel(a));

    const discA = discoverSafehouse(skiffA, A);
    expect(hashTravel(discA)).not.toBe(hashTravel(skiffA));
  });

  it("the same action sequence yields an identical hash progression across two runs", () => {
    /**
     * Drive a fixed mobility sequence and collect the per-step digests.
     * @param seedWallet - The starting balance (the only run input).
     * @returns The ordered list of digests after each step.
     */
    const run = (seedWallet: number): readonly string[] => {
      const start = newTravelState(newWallet(seedWallet));
      const skiff = unlockSkiff(start);
      const airship = unlockAirship(skiff);
      const known = discoverSafehouse(discoverSafehouse(airship, A), B);
      const hop = fastTravel(known, A, B);
      return [start, skiff, airship, known, hop.state].map(hashTravel);
    };
    expect(run(30)).toEqual(run(30));
  });

  it("a fast-travel that deducts grist changes the digest (wallet is a tracked field)", () => {
    const ready = readyToFly(20);
    const hop = fastTravel(ready, A, B);
    expect(hop.ok).toBe(true);
    expect(hashTravel(hop.state)).not.toBe(hashTravel(ready));
  });
});
