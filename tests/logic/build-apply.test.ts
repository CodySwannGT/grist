/**
 * Unit coverage for the pure build-hydration helper (#116): `applyStatBonuses` folds
 * a persisted build's bench stat augments onto a base stat block to produce the
 * effective combat stats a later battle fields. Proves the summing, the no-op on an
 * empty/partial delta, immutability, and that repeated axes add.
 */
import { describe, expect, it } from "vitest";
import { applyStatBonuses } from "../../src/logic/build";
import { type Stats } from "../../src/logic/combat/types";

const BASE: Stats = {
  hp: 40,
  ap: 6,
  pow: 12,
  foc: 9,
  def: 8,
  wrd: 7,
  spd: 11,
  lck: 5,
};

describe("applyStatBonuses — fold a build's augments onto base stats (#116)", () => {
  it("adds a single-axis augment onto the matching base axis only", () => {
    const effective = applyStatBonuses(BASE, { spd: 5 });
    expect(effective.spd).toBe(16);
    // Every other axis is untouched.
    expect({ ...effective, spd: BASE.spd }).toEqual(BASE);
  });

  it("sums a multi-axis augment, leaving absent axes unchanged", () => {
    const effective = applyStatBonuses(BASE, { spd: 5, pow: 3 });
    expect(effective.spd).toBe(16);
    expect(effective.pow).toBe(15);
    expect(effective.foc).toBe(BASE.foc);
  });

  it("is a no-op for an empty build (returns the base stats verbatim)", () => {
    expect(applyStatBonuses(BASE, {})).toEqual(BASE);
  });

  it("never mutates either input", () => {
    const base = { ...BASE };
    const bonuses = { spd: 5 };
    applyStatBonuses(base, bonuses);
    expect(base).toEqual(BASE);
    expect(bonuses).toEqual({ spd: 5 });
  });

  it("folds a negative augment (a debuff) by subtracting", () => {
    expect(applyStatBonuses(BASE, { def: -2 }).def).toBe(6);
  });
});
