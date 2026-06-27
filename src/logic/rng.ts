/**
 * Deterministic, seeded pseudo-random number generator (mulberry32).
 *
 * Game logic must be reproducible — the same seed must always produce the same
 * sequence so replays, tests, and the verification (UAT) suite are stable. This
 * never uses `Math.random()` (which is lint-banned in game code); seed it from a
 * single place (e.g. a saved seed or a fixed value) and thread it through the sim.
 * @module logic/rng
 */

const UINT32 = 4294967296;
const MULBERRY_INCREMENT = 0x6d2b79f5;

/**
 * A seeded PRNG. Holds 32 bits of mutable state; advance with {@link Rng.next}.
 */
export class Rng {
  #state: number;

  /**
   * Create a seeded generator.
   * @param seed - Initial 32-bit seed.
   */
  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /**
   * Re-seed the generator in place (resets the sequence).
   * @param seed - New 32-bit seed.
   * @returns void
   */
  reseed(seed: number): void {
    this.#state = seed >>> 0;
  }

  /**
   * Next float in the half-open range [0, 1).
   * @returns A pseudo-random float.
   */
  next(): number {
    this.#state = (this.#state + MULBERRY_INCREMENT) >>> 0;
    const a = this.#state;
    const b = Math.imul(a ^ (a >>> 15), a | 1);
    const c = b ^ (b + Math.imul(b ^ (b >>> 7), b | 61));
    return ((c ^ (c >>> 14)) >>> 0) / UINT32;
  }

  /**
   * Next float in the half-open range [min, max).
   * @param min - Inclusive lower bound.
   * @param max - Exclusive upper bound.
   * @returns A pseudo-random float in range.
   */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
