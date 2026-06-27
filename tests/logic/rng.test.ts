import { describe, expect, it } from "vitest";
import { Rng } from "../../src/logic/rng";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(123);
    const b = new Rng(123);
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces floats in [0, 1)", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range() stays within [min, max)", () => {
    const rng = new Rng(9);
    for (let i = 0; i < 200; i++) {
      const v = rng.range(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it("reseed() restarts the sequence", () => {
    const rng = new Rng(1);
    const first = rng.next();
    rng.next();
    rng.reseed(1);
    expect(rng.next()).toBe(first);
  });

  it("different seeds produce different sequences", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });
});
