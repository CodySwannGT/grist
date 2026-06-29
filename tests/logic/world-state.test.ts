/**
 * Unit coverage for the pure world-state core (`src/logic/world`): the
 * {@link WorldState} flag, its initial value, the idempotent Reckoning
 * {@link reckon} flip, the `reach` / `ashfall` predicates, and the
 * {@link WorldStateResolver} read-through framework. These are the Phaser-free
 * assertions the issue's Validation Journey names ("WorldState resolvers + flip
 * semantics"), exercised without a DOM or canvas so they run under vitest. The
 * in-game `__VERIFY__` flip + resolver-switch journey is verified separately by
 * the e2e suite. ZERO Phaser imports by design (FR9).
 */
import { describe, expect, it } from "vitest";

import {
  INITIAL_WORLD_STATE,
  isAshfall,
  isReach,
  reckon,
  resolveByWorldState,
  type WorldState,
  type WorldStateResolver,
} from "../../src/logic/world";

// Hoisted resolver values so the repeated literals across the resolve cases below
// don't trip the no-duplicate-string lint.
const REACH_WILDS = "reach-wilds";
const ASHFALL_WASTES = "ashfall-wastes";

describe("world-state — the flag", () => {
  it("starts in Act I reach", () => {
    expect(INITIAL_WORLD_STATE).toBe("reach");
  });
});

describe("reckon — the Reckoning flip", () => {
  it("flips reach to ashfall", () => {
    expect(reckon("reach")).toBe("ashfall");
  });

  it("is idempotent: ashfall stays ashfall", () => {
    expect(reckon("ashfall")).toBe("ashfall");
  });

  it("flipping twice stays ashfall (the Reckoning fires once)", () => {
    expect(reckon(reckon("reach"))).toBe("ashfall");
  });

  it("is referentially transparent: same input → same output (no RNG, no ambient state)", () => {
    // Calling it repeatedly never drifts — the flip consumes no RNG and reads
    // nothing ambient, so it is a total function of its single input.
    expect(reckon("reach")).toBe(reckon("reach"));
    expect(reckon("ashfall")).toBe(reckon("ashfall"));
  });
});

describe("isReach / isAshfall — the predicates", () => {
  it("isReach is true only in reach", () => {
    expect(isReach("reach")).toBe(true);
    expect(isReach("ashfall")).toBe(false);
  });

  it("isAshfall is true only in ashfall", () => {
    expect(isAshfall("ashfall")).toBe(true);
    expect(isAshfall("reach")).toBe(false);
  });

  it("the predicates agree with reckon's flip", () => {
    expect(isAshfall(reckon("reach"))).toBe(true);
    expect(isReach(reckon("reach"))).toBe(false);
  });
});

describe("resolveByWorldState — reading through the flag", () => {
  // A representative economy resolver: a vendor price that the Reckoning raises.
  const PRICE: WorldStateResolver<number> = { reach: 10, ashfall: 25 };
  // A representative encounter-table resolver: which table the region rolls on.
  const ENCOUNTER_TABLE: WorldStateResolver<string> = {
    reach: REACH_WILDS,
    ashfall: ASHFALL_WASTES,
  };

  it("returns the reach value while the world is in reach", () => {
    expect(resolveByWorldState("reach", PRICE)).toBe(10);
    expect(resolveByWorldState("reach", ENCOUNTER_TABLE)).toBe(REACH_WILDS);
  });

  it("returns the ashfall value once the world is in ashfall", () => {
    expect(resolveByWorldState("ashfall", PRICE)).toBe(25);
    expect(resolveByWorldState("ashfall", ENCOUNTER_TABLE)).toBe(
      ASHFALL_WASTES
    );
  });

  it("the same resolver switches value the instant the flag flips (the slice thesis)", () => {
    const before: WorldState = "reach";
    const after = reckon(before);
    // Identical authored pair, different live value after the Reckoning — proving
    // resolvers return their Ashfall values once the flip fires.
    expect(resolveByWorldState(before, ENCOUNTER_TABLE)).toBe(REACH_WILDS);
    expect(resolveByWorldState(after, ENCOUNTER_TABLE)).toBe(ASHFALL_WASTES);
    expect(resolveByWorldState(before, PRICE)).toBe(10);
    expect(resolveByWorldState(after, PRICE)).toBe(25);
  });
});
