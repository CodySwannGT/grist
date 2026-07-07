import { describe, expect, it } from "vitest";

import { BoundIds } from "../../src/content/bounds";
import { SpellIds } from "../../src/content/spells";
import {
  LearningTuning,
  type LearningState,
  accelerateLearning,
  earnLearningPoints,
  equipShard,
  isLearned,
  isLearning,
  learningProgress,
  learningStateFromPersisted,
  newLearningState,
  toPersistedLearning,
} from "../../src/logic/spell-learning";

/**
 * Drive a fresh learner to the point of having the Ashling (Marrow) shard
 * equipped, which is the precondition for every learning-advance assertion.
 * @returns A learning state with the Marrow shard's spells in progress.
 */
function withMarrowEquipped(): LearningState {
  return equipShard(newLearningState(), BoundIds.marrowBound);
}

describe("spell-learning — construction", () => {
  it("starts with nothing learned and nothing in progress", () => {
    const state = newLearningState();
    expect(state.learned).toEqual([]);
    expect(state.learning).toEqual([]);
  });
});

describe("spell-learning — AC1: equipping the shard begins learning Cinder", () => {
  it("begins learning Cinder when the Ashling (Marrow) shard is equipped", () => {
    const state = withMarrowEquipped();
    expect(isLearning(state, SpellIds.cinder)).toBe(true);
    expect(isLearned(state, SpellIds.cinder)).toBe(false);
  });

  it("seeds Cinder learning at zero progress", () => {
    const state = withMarrowEquipped();
    expect(learningProgress(state, SpellIds.cinder)).toBe(0);
  });

  it("begins every spell the shard teaches (Cinder and Render)", () => {
    const state = withMarrowEquipped();
    expect(isLearning(state, SpellIds.cinder)).toBe(true);
    expect(isLearning(state, SpellIds.render)).toBe(true);
  });

  it("does not mutate the input state (immutability)", () => {
    const before = newLearningState();
    const after = equipShard(before, BoundIds.marrowBound);
    expect(after).not.toBe(before);
    expect(before.learning).toEqual([]);
  });

  it("is idempotent — re-equipping an already-equipping shard is a no-op", () => {
    const once = withMarrowEquipped();
    const twice = equipShard(once, BoundIds.marrowBound);
    expect(twice).toBe(once);
    expect(twice.learning).toHaveLength(once.learning.length);
  });

  it("does not re-begin a spell that is already permanently learned", () => {
    // Drive Cinder to completion, then re-equip the shard.
    const completed = earnLearningPoints(
      withMarrowEquipped(),
      LearningTuning.pointsToLearn
    );
    expect(isLearned(completed, SpellIds.cinder)).toBe(true);
    const reEquipped = equipShard(completed, BoundIds.marrowBound);
    expect(isLearning(reEquipped, SpellIds.cinder)).toBe(false);
    expect(isLearned(reEquipped, SpellIds.cinder)).toBe(true);
  });
});

describe("spell-learning — AC2: learning advances and completes", () => {
  it("advances Cinder progress when learning-points are earned in battle", () => {
    const advanced = earnLearningPoints(withMarrowEquipped(), 10);
    expect(learningProgress(advanced, SpellIds.cinder)).toBeGreaterThan(0);
    expect(learningProgress(advanced, SpellIds.cinder)).toBeLessThan(1);
    expect(isLearned(advanced, SpellIds.cinder)).toBe(false);
  });

  it("accumulates points across multiple battles toward the threshold", () => {
    const half = Math.floor(LearningTuning.pointsToLearn / 2);
    const afterTwo = earnLearningPoints(
      earnLearningPoints(withMarrowEquipped(), half),
      half
    );
    const expected = (half * 2) / LearningTuning.pointsToLearn;
    expect(learningProgress(afterTwo, SpellIds.cinder)).toBeCloseTo(
      expected,
      5
    );
  });

  it("permanently learns Cinder when progress reaches the threshold", () => {
    const completed = earnLearningPoints(
      withMarrowEquipped(),
      LearningTuning.pointsToLearn
    );
    expect(isLearned(completed, SpellIds.cinder)).toBe(true);
    expect(isLearning(completed, SpellIds.cinder)).toBe(false);
    expect(completed.learned).toContain(SpellIds.cinder);
  });

  it("learns Cinder even when points overshoot the threshold (caps, no overflow)", () => {
    const completed = earnLearningPoints(
      withMarrowEquipped(),
      LearningTuning.pointsToLearn * 5
    );
    expect(isLearned(completed, SpellIds.cinder)).toBe(true);
    // A learned spell reports full (1) progress, never above.
    expect(learningProgress(completed, SpellIds.cinder)).toBe(1);
  });

  it("keeps a learned spell learned forever — further points are a no-op for it", () => {
    const completed = earnLearningPoints(
      withMarrowEquipped(),
      LearningTuning.pointsToLearn
    );
    const more = earnLearningPoints(completed, 50);
    expect(isLearned(more, SpellIds.cinder)).toBe(true);
  });

  it("ignores a zero or negative point award (no-op, same object)", () => {
    const state = withMarrowEquipped();
    expect(earnLearningPoints(state, 0)).toBe(state);
    expect(earnLearningPoints(state, -10)).toBe(state);
  });

  it("does not mutate the input state when advancing (immutability)", () => {
    const before = withMarrowEquipped();
    const after = earnLearningPoints(before, 10);
    expect(after).not.toBe(before);
    expect(learningProgress(before, SpellIds.cinder)).toBe(0);
  });

  it("earning points with nothing in progress is a no-op", () => {
    const empty = newLearningState();
    expect(earnLearningPoints(empty, 25)).toBe(empty);
  });
});

describe("spell-learning — AC2: bench acceleration shortens learning", () => {
  it("accelerating advances Cinder faster than a single battle's points", () => {
    const accelerated = accelerateLearning(
      withMarrowEquipped(),
      SpellIds.cinder
    );
    expect(learningProgress(accelerated, SpellIds.cinder)).toBeGreaterThan(0);
    expect(LearningTuning.acceleratePoints).toBeGreaterThan(0);
  });

  it("reaches completion in fewer steps than battle-only learning", () => {
    // Battle-only: number of equal battle awards needed to learn.
    const perBattle = 10;
    const battlesNeeded = Math.ceil(LearningTuning.pointsToLearn / perBattle);
    // Accelerate once, then count remaining battles.
    const afterBench = accelerateLearning(
      withMarrowEquipped(),
      SpellIds.cinder
    );
    const remaining =
      LearningTuning.pointsToLearn - LearningTuning.acceleratePoints;
    const battlesAfterBench = Math.ceil(Math.max(0, remaining) / perBattle);
    expect(battlesAfterBench).toBeLessThan(battlesNeeded);
    expect(learningProgress(afterBench, SpellIds.cinder)).toBeGreaterThan(0);
  });

  it("can complete learning when the acceleration meets the threshold", () => {
    let state = withMarrowEquipped();
    // Apply enough bench accelerations to cross the bar.
    const steps = Math.ceil(
      LearningTuning.pointsToLearn / LearningTuning.acceleratePoints
    );
    for (let i = 0; i < steps; i++) {
      state = accelerateLearning(state, SpellIds.cinder);
    }
    expect(isLearned(state, SpellIds.cinder)).toBe(true);
  });

  it("accelerating a spell that is not in progress is a no-op", () => {
    const empty = newLearningState();
    expect(accelerateLearning(empty, SpellIds.cinder)).toBe(empty);
  });

  it("does not mutate the input state when accelerating (immutability)", () => {
    const before = withMarrowEquipped();
    const after = accelerateLearning(before, SpellIds.cinder);
    expect(after).not.toBe(before);
    expect(learningProgress(before, SpellIds.cinder)).toBe(0);
  });

  it("does NOT touch the grist wallet — acceleration is points-only (spend owned elsewhere)", () => {
    // The function signature takes only learning state + spell — no wallet in or out.
    const accelerated = accelerateLearning(
      withMarrowEquipped(),
      SpellIds.cinder
    );
    expect(Object.keys(accelerated)).toEqual(["learned", "learning"]);
  });
});

describe("spell-learning — AC3: deterministic and reproducible", () => {
  it("is a total function of its inputs — identical inputs, identical outputs", () => {
    const a = earnLearningPoints(withMarrowEquipped(), 30);
    const b = earnLearningPoints(withMarrowEquipped(), 30);
    expect(a).toEqual(b);
  });

  it("reproduces the full equip → battles → bench → completion journey", () => {
    const run = (): LearningState => {
      let state = equipShard(newLearningState(), BoundIds.marrowBound);
      state = earnLearningPoints(state, 20);
      state = earnLearningPoints(state, 20);
      state = accelerateLearning(state, SpellIds.cinder);
      return earnLearningPoints(state, LearningTuning.pointsToLearn);
    };
    expect(run()).toEqual(run());
    expect(isLearned(run(), SpellIds.cinder)).toBe(true);
  });

  it("progress is order-independent for the same total points", () => {
    const oneShot = earnLearningPoints(withMarrowEquipped(), 40);
    const split = earnLearningPoints(
      earnLearningPoints(earnLearningPoints(withMarrowEquipped(), 10), 15),
      15
    );
    expect(learningProgress(oneShot, SpellIds.cinder)).toBeCloseTo(
      learningProgress(split, SpellIds.cinder),
      5
    );
  });
});

describe("spell-learning — progress queries", () => {
  it("reports zero progress for a spell that was never begun", () => {
    expect(learningProgress(newLearningState(), SpellIds.cinder)).toBe(0);
  });

  it("reports full progress (1) for a permanently learned spell", () => {
    const completed = earnLearningPoints(
      withMarrowEquipped(),
      LearningTuning.pointsToLearn
    );
    expect(learningProgress(completed, SpellIds.cinder)).toBe(1);
  });

  it("isLearning is false once a spell is learned", () => {
    const completed = earnLearningPoints(
      withMarrowEquipped(),
      LearningTuning.pointsToLearn
    );
    expect(isLearning(completed, SpellIds.cinder)).toBe(false);
  });
});

describe("spell-learning — persistence projection (#264)", () => {
  it("projects an in-progress spell to its [0,1) fraction", () => {
    // Marrow teaches cinder + render; accelerate advances only cinder to 50%.
    const half = accelerateLearning(withMarrowEquipped(), SpellIds.cinder);
    const persisted = toPersistedLearning(half);
    expect(persisted.learned).toEqual([]);
    expect(persisted.learning).toContainEqual({
      spell: SpellIds.cinder,
      progress: 0.5,
    });
  });

  it("projects a just-equipped (0%) spell to progress 0", () => {
    expect(toPersistedLearning(withMarrowEquipped()).learning).toContainEqual({
      spell: SpellIds.cinder,
      progress: 0,
    });
  });

  it("projects a completed spell into the learned list (never in learning)", () => {
    const done = earnLearningPoints(
      withMarrowEquipped(),
      LearningTuning.pointsToLearn
    );
    const persisted = toPersistedLearning(done);
    expect(persisted.learned).toContain(SpellIds.cinder);
    expect(persisted.learning).toEqual([]);
  });

  it("round-trips a mid-progress state through project → rehydrate", () => {
    const half = accelerateLearning(withMarrowEquipped(), SpellIds.cinder);
    const persisted = toPersistedLearning(half);
    const rehydrated = learningStateFromPersisted(
      persisted.learned,
      persisted.learning
    );
    expect(rehydrated).toEqual(half);
    expect(isLearning(rehydrated, SpellIds.cinder)).toBe(true);
    expect(learningProgress(rehydrated, SpellIds.cinder)).toBe(0.5);
  });

  it("rehydrates a just-equipped (0%) spell as in-progress, not not-begun", () => {
    const rehydrated = learningStateFromPersisted(
      [],
      [{ spell: SpellIds.cinder, progress: 0 }]
    );
    // The #264 fix: the Bench's "begun" test (isLearning || progress>0) must be true,
    // so an equipped shard never reads "not begun (equip the shard)" after Continue.
    expect(isLearning(rehydrated, SpellIds.cinder)).toBe(true);
  });

  it("drops an unrecognized spell id from a foreign/corrupt save (total)", () => {
    const rehydrated = learningStateFromPersisted(
      ["not-a-spell"],
      [{ spell: "also-bogus", progress: 0.4 }]
    );
    expect(rehydrated).toEqual(newLearningState());
  });

  it("drops an in-progress entry that duplicates an already-learned spell", () => {
    const rehydrated = learningStateFromPersisted(
      [SpellIds.cinder],
      [{ spell: SpellIds.cinder, progress: 0.4 }]
    );
    expect(rehydrated.learned).toEqual([SpellIds.cinder]);
    expect(rehydrated.learning).toEqual([]);
  });

  it("clamps a fraction at/over 1 below the bar so it stays in-progress", () => {
    const rehydrated = learningStateFromPersisted(
      [],
      [{ spell: SpellIds.cinder, progress: 1 }]
    );
    expect(isLearning(rehydrated, SpellIds.cinder)).toBe(true);
    expect(isLearned(rehydrated, SpellIds.cinder)).toBe(false);
    expect(learningProgress(rehydrated, SpellIds.cinder)).toBeLessThan(1);
  });
});
