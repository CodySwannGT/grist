import { describe, expect, it } from "vitest";

import {
  GristTuning,
  type GristSpendResult,
  type GristWallet,
  canSpendGrist,
  earnGrist,
  newWallet,
  spendGrist,
} from "../../src/logic/grist";

describe("grist wallet — construction", () => {
  it("starts at the slice default of 10", () => {
    expect(newWallet().grist).toBe(GristTuning.startingGrist);
    expect(newWallet().grist).toBe(10);
  });

  it("accepts an explicit non-negative starting balance", () => {
    expect(newWallet(0).grist).toBe(0);
    expect(newWallet(25).grist).toBe(25);
  });

  it("floors a negative starting balance at zero (no debt)", () => {
    expect(newWallet(-5).grist).toBe(0);
  });

  it("truncates a fractional starting balance to whole grist", () => {
    expect(newWallet(12.9).grist).toBe(12);
  });
});

describe("grist wallet — earning (AC: gains across the slice)", () => {
  it("adds a positive amount to the balance", () => {
    expect(earnGrist(newWallet(10), 6).grist).toBe(16);
  });

  it("accumulates the slice's earnable run to ≈48 from a start of 10", () => {
    // start 10 → scrapper 6 → Vesper/construct 10 → salvage cache +12 → boss 20.
    const earned = [6, 10, 12, 20].reduce(
      (wallet, gain) => earnGrist(wallet, gain),
      newWallet()
    );
    expect(earned.grist).toBe(10 + 6 + 10 + 12 + 20);
    expect(earned.grist).toBe(58);
    // 48 is earnable on top of the starting 10.
    expect(earned.grist - GristTuning.startingGrist).toBe(48);
  });

  it("ignores a zero gain (no-op, same object for structural sharing)", () => {
    const wallet = newWallet(10);
    expect(earnGrist(wallet, 0)).toBe(wallet);
  });

  it("rejects a negative gain (earning never removes grist)", () => {
    const wallet = newWallet(10);
    expect(earnGrist(wallet, -5)).toBe(wallet);
  });

  it("truncates a fractional gain to whole grist", () => {
    expect(earnGrist(newWallet(10), 6.7).grist).toBe(16);
  });

  it("returns a new wallet object on a real gain (immutability)", () => {
    const before = newWallet(10);
    const after = earnGrist(before, 6);
    expect(after).not.toBe(before);
    expect(before.grist).toBe(10);
  });
});

describe("grist wallet — affordability", () => {
  it("affords a cost the pool covers", () => {
    expect(canSpendGrist(newWallet(10), 8)).toBe(true);
  });

  it("affords a cost exactly equal to the pool", () => {
    expect(canSpendGrist(newWallet(8), 8)).toBe(true);
  });

  it("rejects a cost exceeding the pool", () => {
    expect(canSpendGrist(newWallet(7), 8)).toBe(false);
  });

  it("treats a zero or negative cost as always affordable", () => {
    expect(canSpendGrist(newWallet(0), 0)).toBe(true);
    expect(canSpendGrist(newWallet(0), -3)).toBe(true);
  });
});

describe("grist wallet — spending (AC4: two-resource tension + draw-down)", () => {
  it("spends the 8-grist Bind from the same shared pool the bench uses", () => {
    const result: GristSpendResult = spendGrist(newWallet(10), 8);
    expect(result.ok).toBe(true);
    expect(result.wallet.grist).toBe(2);
    expect(result.spent).toBe(8);
  });

  it("draws the balance down by a bench sink cost", () => {
    const result = spendGrist(newWallet(20), 12);
    expect(result.ok).toBe(true);
    expect(result.wallet.grist).toBe(8);
  });

  it("rejects an over-spend and leaves the wallet untouched", () => {
    const before = newWallet(5);
    const result = spendGrist(before, 8);
    expect(result.ok).toBe(false);
    expect(result.wallet).toBe(before);
    expect(result.wallet.grist).toBe(5);
    expect(result.spent).toBe(0);
  });

  it("allows spending the entire balance to zero", () => {
    const result = spendGrist(newWallet(8), 8);
    expect(result.ok).toBe(true);
    expect(result.wallet.grist).toBe(0);
  });

  it("treats a zero spend as a no-op success (same wallet)", () => {
    const before = newWallet(10);
    const result = spendGrist(before, 0);
    expect(result.ok).toBe(true);
    expect(result.wallet).toBe(before);
    expect(result.spent).toBe(0);
  });

  it("rejects a negative spend rather than minting grist", () => {
    const before = newWallet(10);
    const result = spendGrist(before, -5);
    expect(result.ok).toBe(false);
    expect(result.wallet).toBe(before);
    expect(result.spent).toBe(0);
  });

  it("truncates a fractional spend to whole grist", () => {
    const result = spendGrist(newWallet(10), 8.9);
    expect(result.ok).toBe(true);
    expect(result.wallet.grist).toBe(2);
    expect(result.spent).toBe(8);
  });
});

describe("grist wallet — determinism (AC: pure, seed-free, reproducible)", () => {
  it("is a total function of its inputs — identical inputs, identical outputs", () => {
    const a = spendGrist(earnGrist(newWallet(), 12), 8);
    const b = spendGrist(earnGrist(newWallet(), 12), 8);
    expect(a).toEqual(b);
    expect(a.wallet.grist).toBe(b.wallet.grist);
  });

  it("reproduces the full earn/spend journey under repetition", () => {
    const run = (): GristWallet => {
      const earned = [6, 10, 12, 20].reduce(
        (wallet, gain) => earnGrist(wallet, gain),
        newWallet()
      );
      const afterBind = spendGrist(earned, 8).wallet; // boss Bind: Wisp
      return spendGrist(afterBind, 12).wallet; // bench sink
    };
    expect(run()).toEqual(run());
    expect(run().grist).toBe(58 - 8 - 12);
  });
});
