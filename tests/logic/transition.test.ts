/**
 * Unit coverage for the pure scene-transition state machine
 * (`src/logic/render/transition`) — the deterministic, Phaser-free timing logic
 * issue #114 AC2 names: "scene transitions are readable". A readable cut is a
 * bounded, phased fade (fade-out → hold → fade-in → done) so the handoff is
 * legible, not an instant jump. {@link beginTransition} seeds the initial state and
 * {@link stepTransition} folds an injected `dtMs` forward — no ambient clock — while
 * {@link transitionOpacity} derives the 0..1 overlay opacity the adapter renders.
 *
 * These assertions lock the AC-2 contract headless (no DOM, no Phaser) under
 * vitest: the machine begins at fade-out progress 0, accumulates dt deterministically,
 * advances its phases in order, has a total duration equal to the sum of its phase
 * durations, is fully reproducible for the same dt sequence, and its overlay opacity
 * is monotonic within each phase (rising as the screen covers, falling as it clears).
 */
import { describe, expect, it } from "vitest";

import {
  TransitionTiming,
  beginTransition,
  isTransitionDone,
  stepTransition,
  transitionOpacity,
  transitionTotalMs,
  type TransitionState,
} from "../../src/logic/render/transition";

/**
 * Fold a sequence of dt steps over a fresh transition, returning every intermediate
 * state (including the initial) so a test can assert a whole trajectory.
 * @param dts - The per-step delta-times (ms) to apply in order.
 * @returns The initial state followed by one state after each dt.
 */
function trajectory(dts: readonly number[]): readonly TransitionState[] {
  const states: TransitionState[] = [beginTransition()];
  for (const dt of dts) {
    states.push(stepTransition(states[states.length - 1]!, dt));
  }
  return states;
}

describe("beginTransition — the initial fade-out state", () => {
  it("begins in fade-out at elapsed 0 and progress 0", () => {
    const state = beginTransition();
    expect(state.phase).toBe("fade-out");
    expect(state.elapsedMs).toBe(0);
    expect(state.progress).toBe(0);
  });

  it("begins fully clear (opacity 0 — nothing covering the screen yet)", () => {
    expect(transitionOpacity(beginTransition())).toBe(0);
  });

  it("is not done at the start", () => {
    expect(isTransitionDone(beginTransition())).toBe(false);
  });
});

describe("stepTransition — fold an injected dt forward", () => {
  it("accumulates elapsed time deterministically across steps", () => {
    const a = stepTransition(beginTransition(), 10);
    const b = stepTransition(a, 15);
    expect(a.elapsedMs).toBe(10);
    expect(b.elapsedMs).toBe(25);
  });

  it("advances the phases in order: fade-out → hold → fade-in → done", () => {
    const { fadeOutMs, holdMs, fadeInMs } = TransitionTiming;
    // Sample one point inside each phase, plus one past the end.
    const inFadeOut = stepTransition(beginTransition(), fadeOutMs / 2);
    const inHold = stepTransition(beginTransition(), fadeOutMs + holdMs / 2);
    const inFadeIn = stepTransition(
      beginTransition(),
      fadeOutMs + holdMs + fadeInMs / 2
    );
    const done = stepTransition(
      beginTransition(),
      fadeOutMs + holdMs + fadeInMs + 100
    );
    expect(inFadeOut.phase).toBe("fade-out");
    expect(inHold.phase).toBe("hold");
    expect(inFadeIn.phase).toBe("fade-in");
    expect(done.phase).toBe("done");
  });

  it("clamps at done — stepping a finished transition stays done", () => {
    const done = stepTransition(beginTransition(), transitionTotalMs() + 50);
    const more = stepTransition(done, 100);
    expect(more.phase).toBe("done");
    expect(isTransitionDone(more)).toBe(true);
    expect(more.elapsedMs).toBe(transitionTotalMs());
  });

  it("has a total duration equal to the sum of its phase durations", () => {
    const { fadeOutMs, holdMs, fadeInMs } = TransitionTiming;
    expect(transitionTotalMs()).toBe(fadeOutMs + holdMs + fadeInMs);
  });

  it("reaches done exactly at the total duration", () => {
    const done = stepTransition(beginTransition(), transitionTotalMs());
    expect(done.phase).toBe("done");
    expect(isTransitionDone(done)).toBe(true);
  });

  it("keeps the total transition within a readable bound (<= 1200ms)", () => {
    // Documented bound: a scene cut must stay legible AND snappy — a bounded fade,
    // not a lingering wipe. 1200ms is the ceiling AC2 ("readable") is held to.
    expect(transitionTotalMs()).toBeLessThanOrEqual(1200);
  });
});

describe("transitionOpacity — the derived overlay opacity (0..1)", () => {
  it("rises monotonically through fade-out (screen covering)", () => {
    const { fadeOutMs } = TransitionTiming;
    const quarter = transitionOpacity(
      stepTransition(beginTransition(), fadeOutMs * 0.25)
    );
    const half = transitionOpacity(
      stepTransition(beginTransition(), fadeOutMs * 0.5)
    );
    const threeQuarter = transitionOpacity(
      stepTransition(beginTransition(), fadeOutMs * 0.75)
    );
    expect(quarter).toBeLessThan(half);
    expect(half).toBeLessThan(threeQuarter);
  });

  it("is fully opaque (1) through the hold beat (screen fully covered)", () => {
    const { fadeOutMs, holdMs } = TransitionTiming;
    expect(
      transitionOpacity(stepTransition(beginTransition(), fadeOutMs))
    ).toBeCloseTo(1, 5);
    expect(
      transitionOpacity(
        stepTransition(beginTransition(), fadeOutMs + holdMs / 2)
      )
    ).toBeCloseTo(1, 5);
  });

  it("falls monotonically through fade-in (screen clearing)", () => {
    const { fadeOutMs, holdMs, fadeInMs } = TransitionTiming;
    const base = fadeOutMs + holdMs;
    const quarter = transitionOpacity(
      stepTransition(beginTransition(), base + fadeInMs * 0.25)
    );
    const half = transitionOpacity(
      stepTransition(beginTransition(), base + fadeInMs * 0.5)
    );
    const threeQuarter = transitionOpacity(
      stepTransition(beginTransition(), base + fadeInMs * 0.75)
    );
    expect(quarter).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(threeQuarter);
  });

  it("ends fully clear (opacity 0 — the new scene is fully revealed)", () => {
    expect(
      transitionOpacity(stepTransition(beginTransition(), transitionTotalMs()))
    ).toBeCloseTo(0, 5);
  });
});

describe("purity & determinism (locked-architecture rules)", () => {
  it("same dt sequence always yields identical states", () => {
    const dts = [7, 13, 40, 55, 120, 300];
    expect(trajectory(dts)).toEqual(trajectory(dts));
  });

  it("many small steps match one equivalent large step (dt is additive)", () => {
    const target = TransitionTiming.fadeOutMs / 2;
    const oneStep = stepTransition(beginTransition(), target);
    let many = beginTransition();
    for (let i = 0; i < 10; i++) {
      many = stepTransition(many, target / 10);
    }
    expect(many.elapsedMs).toBeCloseTo(oneStep.elapsedMs, 5);
    expect(many.phase).toBe(oneStep.phase);
  });

  it("does not mutate a frozen input", () => {
    const frozen = Object.freeze(beginTransition());
    const next = stepTransition(frozen, 20);
    expect(next).not.toBe(frozen);
    expect(frozen.elapsedMs).toBe(0);
  });

  it("state is JSON-round-trippable (plain data, no Phaser)", () => {
    const state = stepTransition(beginTransition(), 42);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
