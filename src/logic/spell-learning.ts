/**
 * The pure **spell-learning model** — the Bound-shard learning loop (PRD #41 FR6,
 * Story #74): equipping a shard begins learning the spells it teaches, those
 * spells advance as the party earns learning-points in battle (or is accelerated
 * at the bench), and on completion a spell is **permanently** learned. The slice's
 * headline thread is the Ashling reward shard (`marrow-bound`) teaching **Cinder**.
 *
 * This module owns only the learning *rules* as pure reducers — data-in /
 * data-out, never mutating inputs, returning fresh state. It composes the content
 * tables (`content/bounds.teaches`) for *which* spells a shard begins, and never
 * re-specifies combat. Deliberately out of scope (and never touched here): the
 * bench UI that equips/accelerates (#86), the grist wallet deduction the bench
 * acceleration pays for (#73, done) — {@link accelerateLearning} advances learning
 * but never sees or mutates a wallet — and the free-vs-wield resolution (#85).
 *
 * Zero Phaser, no I/O, no RNG, no `Math.random` / `Date.now` — every function is a
 * total function of its explicit inputs, so learning is deterministic and
 * reproducible under a fixed seed (the seed never enters: learning advances on the
 * *points* passed in as data, so the same calls always yield the same result).
 * Progress is reported in the [0, 1] range so it maps directly onto the persisted
 * `SavedLearning.progress` shape in `logic/save/types`.
 * @module logic/spell-learning
 */
import { BOUNDS, type BoundId } from "../content/bounds";
import { type SpellId } from "../content/spells";

/**
 * First-pass learning tuning. The wiki fixes the *shape* — "a spell needs N
 * learning-points, earned per encounter" ([economy-spec](../../wiki/design/economy-spec.md))
 * and the **20-grist** Accelerate-Cinder bench sink
 * ([vertical-slice-build](../../wiki/production/vertical-slice-build.md)) — but
 * leaves the concrete `N` and the acceleration magnitude unspecified. These are
 * the deterministic constants chosen for the slice; the bench *grist cost* lives
 * in `content/bench`, these are the *learning* numbers the reducers apply.
 */
export const LearningTuning = {
  /**
   * Learning-points a spell needs before it is permanently learned. Chosen so a
   * handful of slice encounters (or two-to-three bench accelerations) complete a
   * spell — a sensible first-pass `N` since the wiki leaves it open.
   */
  pointsToLearn: 100,
  /**
   * Learning-points one bench **Accelerate** purchase grants. Half the bar, so a
   * single 20-grist accelerate visibly shortens learning (the bench's draw) yet
   * never instantly completes it — the grist *spend* itself is owned by #86/#73,
   * not here.
   */
  acceleratePoints: 50,
} as const;

/** Progress reported for a spell that is fully, permanently learned. */
const FULLY_LEARNED = 1;
/** Progress reported for a spell that has not been begun. */
const NOT_BEGUN = 0;

/**
 * One spell's in-progress unlock: the spell being learned and the learning-points
 * accrued toward {@link LearningTuning.pointsToLearn} so far. A spell only appears
 * here while it is *in progress* — once complete it moves to
 * {@link LearningState.learned} and is dropped from this list.
 */
export interface LearningProgress {
  /** The spell id being learned. */
  readonly spell: SpellId;
  /** Learning-points accrued so far (0 ≤ points < {@link LearningTuning.pointsToLearn}). */
  readonly points: number;
}

/**
 * The pure learning progression: the spells permanently learned and the spells
 * currently in progress. Immutable — every reducer returns fresh state. Maps onto
 * the persisted `learned` / `learning` fields in `logic/save/types` (a learned id
 * list + spell/progress pairs).
 */
export interface LearningState {
  /** Spells permanently learned (kept forever). */
  readonly learned: readonly SpellId[];
  /** Spells currently being learned, with their accrued points. */
  readonly learning: readonly LearningProgress[];
}

/**
 * Build a fresh learning state with nothing learned and nothing in progress.
 * Pure — reads nothing ambient.
 * @returns The initial learning state.
 */
export function newLearningState(): LearningState {
  return { learned: [], learning: [] };
}

/**
 * Whether a spell has been permanently learned.
 * @param state - The learning state to query.
 * @param spell - The spell id to test.
 * @returns True when the spell is fully learned.
 */
export function isLearned(state: LearningState, spell: SpellId): boolean {
  return state.learned.includes(spell);
}

/**
 * Whether a spell is currently in progress (begun but not yet learned).
 * @param state - The learning state to query.
 * @param spell - The spell id to test.
 * @returns True when the spell is being learned and is not yet complete.
 */
export function isLearning(state: LearningState, spell: SpellId): boolean {
  return state.learning.some(entry => entry.spell === spell);
}

/**
 * A spell's unlock progress in the [0, 1] range: 0 when never begun or just
 * started, the accrued fraction of {@link LearningTuning.pointsToLearn} while in
 * progress, and exactly 1 once permanently learned. Shaped to drop straight into
 * the persisted `SavedLearning.progress` field.
 * @param state - The learning state to query.
 * @param spell - The spell id to measure.
 * @returns The unlock progress in [0, 1].
 */
export function learningProgress(state: LearningState, spell: SpellId): number {
  if (isLearned(state, spell)) {
    return FULLY_LEARNED;
  }
  const entry = state.learning.find(item => item.spell === spell);
  return entry === undefined
    ? NOT_BEGUN
    : entry.points / LearningTuning.pointsToLearn;
}

/**
 * Begin learning every spell an equipped shard teaches (AC1). For each spell in
 * the shard's `teaches` list that is neither already learned nor already in
 * progress, a fresh in-progress entry is seeded at zero points; spells already
 * learned or already being learned are left untouched, so re-equipping the same
 * shard is a no-op that returns the **same** state object (structural sharing).
 * The Ashling (Marrow) shard begins **Cinder**, the slice's headline unlock.
 * @param state - The current learning state (never mutated).
 * @param boundId - The shard being equipped.
 * @returns The state with the shard's not-yet-known spells begun, or the same object on a no-op.
 */
export function equipShard(
  state: LearningState,
  boundId: BoundId
): LearningState {
  const begun = BOUNDS[boundId].teaches.filter(
    spell => !isLearned(state, spell) && !isLearning(state, spell)
  );
  if (begun.length === 0) {
    return state;
  }
  const added: readonly LearningProgress[] = begun.map(spell => ({
    spell,
    points: NOT_BEGUN,
  }));
  return { ...state, learning: [...state.learning, ...added] };
}

/**
 * Fold a single in-progress entry forward by the given points: if the new total
 * reaches {@link LearningTuning.pointsToLearn} the spell is complete; otherwise it
 * stays in progress with the points clamped below the bar. Pure helper for the
 * advance reducers.
 * @param entry - The in-progress entry to advance.
 * @param points - The (positive) learning-points to add.
 * @returns Either the completed spell id, or the advanced entry.
 */
function advanceEntry(
  entry: LearningProgress,
  points: number
): { readonly completed: SpellId } | { readonly entry: LearningProgress } {
  const total = entry.points + points;
  if (total >= LearningTuning.pointsToLearn) {
    return { completed: entry.spell };
  }
  return { entry: { spell: entry.spell, points: total } };
}

/**
 * Apply a learning-point award to **all** in-progress spells, completing any that
 * cross the bar. This is the shared advance core behind both {@link
 * earnLearningPoints} (battle awards) and {@link accelerateLearning} (a single
 * bench-accelerated spell); both pass already-validated positive points and a
 * filter for which entries to advance.
 * @param state - The current learning state (never mutated).
 * @param points - The positive learning-points to apply to each matched entry.
 * @param shouldAdvance - Predicate selecting which in-progress spells advance.
 * @returns Fresh state with the matched entries advanced/completed, or the same object on a no-op.
 */
function applyPoints(
  state: LearningState,
  points: number,
  shouldAdvance: (spell: SpellId) => boolean
): LearningState {
  // Fold the in-progress list once into the (learned, learning, changed)
  // accumulator — no mutation of any input or interim array, per the functional
  // lint rules: each step spreads a fresh accumulator.
  const folded = state.learning.reduce<{
    readonly learned: readonly SpellId[];
    readonly learning: readonly LearningProgress[];
    readonly changed: boolean;
  }>(
    (acc, entry) => {
      if (!shouldAdvance(entry.spell)) {
        return { ...acc, learning: [...acc.learning, entry] };
      }
      const result = advanceEntry(entry, points);
      return "completed" in result
        ? {
            ...acc,
            learned: [...acc.learned, result.completed],
            changed: true,
          }
        : {
            ...acc,
            learning: [...acc.learning, result.entry],
            changed: true,
          };
    },
    { learned: state.learned, learning: [], changed: false }
  );
  return folded.changed
    ? { learned: folded.learned, learning: folded.learning }
    : state;
}

/**
 * Advance every in-progress spell by the learning-points earned in a battle
 * (AC2). On completion a spell moves permanently into `learned` and is dropped
 * from `learning`; a learned spell is never re-advanced. A zero or negative award
 * is rejected (learning never regresses) and returns the same state object, as
 * does advancing when nothing is in progress.
 * @param state - The current learning state (never mutated).
 * @param points - The learning-points earned (≤ 0 is ignored).
 * @returns Fresh state with progress advanced/completed, or the same object on a no-op.
 */
export function earnLearningPoints(
  state: LearningState,
  points: number
): LearningState {
  if (points <= 0 || state.learning.length === 0) {
    return state;
  }
  return applyPoints(state, points, () => true);
}

/**
 * Advance a **single** spell by one bench-accelerate award (AC2: acceleration
 * shortens learning). Mirrors the 20-grist Accelerate bench sink, but models only
 * the *learning* advance — it takes no wallet and performs no grist deduction (the
 * spend is owned by the bench #86 / wallet #73, deliberately out of scope here).
 * Accelerating a spell that is not in progress (already learned, or never begun)
 * is a no-op that returns the same state object.
 * @param state - The current learning state (never mutated).
 * @param spell - The in-progress spell to accelerate.
 * @returns Fresh state with that spell advanced/completed, or the same object on a no-op.
 */
export function accelerateLearning(
  state: LearningState,
  spell: SpellId
): LearningState {
  if (!isLearning(state, spell)) {
    return state;
  }
  return applyPoints(
    state,
    LearningTuning.acceleratePoints,
    candidate => candidate === spell
  );
}
