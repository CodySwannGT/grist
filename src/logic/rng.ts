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

/** One advance of the mulberry32 stream: the next value and the successor state. */
interface RngStep {
  /** The pseudo-random float in the half-open range [0, 1). */
  readonly value: number;
  /** The 32-bit generator state to feed into the next {@link rngStep}. */
  readonly state: number;
}

/**
 * Pure mulberry32 advance: given a 32-bit generator state, return the next float
 * in [0, 1) and the successor state, mutating nothing and reading nothing
 * ambient. This is the engine-free core the seeded {@link Rng} class wraps, and
 * the form the pure combat reducer threads through `BattleState` — so the sim
 * stays a side-effect-free function while reusing one RNG implementation.
 * @param state - The current 32-bit generator state.
 * @returns The next value and the successor state.
 */
export function rngStep(state: number): RngStep {
  const next = (state + MULBERRY_INCREMENT) >>> 0;
  const mixed = Math.imul(next ^ (next >>> 15), next | 1);
  const scrambled =
    mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61));
  const value = ((scrambled ^ (scrambled >>> 14)) >>> 0) / UINT32;
  return { value, state: next };
}

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
    const stepped = rngStep(this.#state);
    this.#state = stepped.state;
    return stepped.value;
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
