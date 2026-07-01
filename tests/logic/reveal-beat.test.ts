/**
 * Unit coverage for the pure Sable-reveal "quiet beat" logic
 * (`src/logic/narrative/reveal-beat`) — the deterministic, Phaser-free hold issue
 * #114 AC3 names: "the Sable reveal has a deliberate quiet beat". When the
 * presenter cursor lands on the Ch.1 reveal node ({@link CH1_REVEAL_NODE_ID},
 * "cargo-opens"), a non-zero {@link REVEAL_BEAT_MS} hold must elapse before an
 * advance past the reveal is permitted — the moment is held, quiet and deliberate,
 * rather than clicked straight through.
 *
 * Modelled as a pure fold exactly like the presenter: a beat state `{ remainingMs }`
 * that {@link stepRevealBeat} decrements by an injected `dtMs` (no `Date.now`), and
 * a guard {@link canAdvancePastReveal} the Dialogue adapter consults so an advance
 * at the reveal node is deferred until the beat elapses — and never blocks anywhere
 * else. These assertions lock the AC-3 contract headless under vitest: the beat is
 * non-zero, blocks-then-releases at the reveal node, is inert at every other node,
 * is fully reproducible for the same dt sequence, and round-trips through JSON.
 */
import { describe, expect, it } from "vitest";

import {
  REVEAL_BEAT_MS,
  beginRevealBeat,
  canAdvancePastReveal,
  isRevealBeatElapsed,
  stepRevealBeat,
  type RevealBeatState,
} from "../../src/logic/narrative/reveal-beat";
import { CH1_REVEAL_NODE_ID } from "../../src/content";

// A node id that is deliberately NOT the reveal node, so the "never blocks
// elsewhere" arm is observable. Hoisted for the no-duplicate-string lint.
const OTHER_NODE = "klaxon";

/**
 * Fold a total elapsed dt over a fresh beat in a single step (the beat is a linear
 * countdown, so one step of `total` equals the sum of its parts).
 * @param total - The milliseconds to elapse.
 * @returns The beat state after `total` ms have elapsed.
 */
function afterMs(total: number): RevealBeatState {
  return stepRevealBeat(beginRevealBeat(), total);
}

describe("REVEAL_BEAT_MS — a deliberate, non-zero quiet beat (AC3)", () => {
  it("is strictly positive (the beat actually holds the moment)", () => {
    expect(REVEAL_BEAT_MS).toBeGreaterThan(0);
  });
});

describe("stepRevealBeat — count the quiet beat down by injected dt", () => {
  it("begins with the full beat remaining and not elapsed", () => {
    const state = beginRevealBeat();
    expect(state.remainingMs).toBe(REVEAL_BEAT_MS);
    expect(isRevealBeatElapsed(state)).toBe(false);
  });

  it("decrements the remaining time by the injected dt", () => {
    const state = stepRevealBeat(beginRevealBeat(), 100);
    expect(state.remainingMs).toBe(REVEAL_BEAT_MS - 100);
  });

  it("clamps the remaining time at zero and reports elapsed", () => {
    const state = afterMs(REVEAL_BEAT_MS + 500);
    expect(state.remainingMs).toBe(0);
    expect(isRevealBeatElapsed(state)).toBe(true);
  });

  it("is not elapsed one tick before the beat completes", () => {
    const state = afterMs(REVEAL_BEAT_MS - 1);
    expect(isRevealBeatElapsed(state)).toBe(false);
  });
});

describe("canAdvancePastReveal — the composable advance guard", () => {
  it("blocks an advance at the reveal node while the beat is holding", () => {
    const holding = beginRevealBeat();
    expect(canAdvancePastReveal(CH1_REVEAL_NODE_ID, holding)).toBe(false);
  });

  it("releases the advance at the reveal node once the beat has elapsed", () => {
    const elapsed = afterMs(REVEAL_BEAT_MS);
    expect(canAdvancePastReveal(CH1_REVEAL_NODE_ID, elapsed)).toBe(true);
  });

  it("never blocks an advance at a non-reveal node (beat is inert there)", () => {
    // Even with the beat fully un-elapsed, a non-reveal node advances freely — the
    // quiet beat is a property of the reveal moment only.
    const holding = beginRevealBeat();
    expect(canAdvancePastReveal(OTHER_NODE, holding)).toBe(true);
    expect(canAdvancePastReveal("", holding)).toBe(true);
  });
});

describe("purity & determinism (locked-architecture rules)", () => {
  it("same dt sequence always yields the same state", () => {
    const a = stepRevealBeat(stepRevealBeat(beginRevealBeat(), 40), 90);
    const b = stepRevealBeat(stepRevealBeat(beginRevealBeat(), 40), 90);
    expect(a).toEqual(b);
  });

  it("many small steps match one equivalent large step (dt is additive)", () => {
    let many = beginRevealBeat();
    for (let i = 0; i < 8; i++) {
      many = stepRevealBeat(many, 25);
    }
    expect(many.remainingMs).toBe(afterMs(200).remainingMs);
  });

  it("does not mutate a frozen input", () => {
    const frozen = Object.freeze(beginRevealBeat());
    const next = stepRevealBeat(frozen, 30);
    expect(next).not.toBe(frozen);
    expect(frozen.remainingMs).toBe(REVEAL_BEAT_MS);
  });

  it("state is JSON-round-trippable (plain data, no Phaser)", () => {
    const state = stepRevealBeat(beginRevealBeat(), 42);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
