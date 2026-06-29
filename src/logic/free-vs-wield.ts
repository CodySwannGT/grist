/**
 * The pure **free-vs-wield resolution model** — the moral heart of the vertical
 * slice (PRD #41 FR5 / AC5, Story #75). When a boss drop surfaces a shard's
 * free-vs-wield choice (the `pendingChoiceShard` trigger {@link RunState} raises
 * in `logic/run-state`), the player commits to one of two carries:
 *
 * - **free** — the weaker, corruption-free attunement; karma rises (the safe path).
 * - **wield** — the stronger carry that accrues corruption; karma falls (the cost).
 *
 * {@link resolveChoice} folds that commitment into persistent state: it selects
 * the shard variant, accrues the variant's corruption from the content table
 * (`content/bounds` #79 — free = 0, wield > 0), updates the {@link MoralLedger}
 * (karma ± and the per-mode tally), records the persisted {@link SavedChoice}
 * (PRD #41 AC5 shape from `logic/save/types` #77), and clears the run's pending
 * trigger so the choice can never be re-counted. Free and wield therefore yield
 * measurably different persistent state from identical pre-choice input — the
 * slice's thesis, a choice with a real consequence.
 *
 * This module owns only the resolution *rules* as a pure reducer: data-in /
 * data-out, never mutating inputs, returning fresh state (with structural sharing
 * on a no-op). It composes the content table for the corruption rate and the save
 * types for the persisted shapes, and never re-specifies either. Deliberately out
 * of scope (and never touched here): persisting the outcome across a reload
 * (#77, done — this module produces the shapes it persists), surfacing the prompt
 * UI or consuming the result in the Field (#72), and corruption's downstream
 * gameplay depth (Phase 3+ — only the flag + accrual here).
 *
 * Zero Phaser, no I/O, no RNG, no `Math.random` / `Date.now` — every output is a
 * total function of its explicit inputs, so the resolution is deterministic and
 * reproducible under a fixed seed (the seed never enters: the outcome is decided
 * by the player's `mode`, not chance, so the same call always yields the same
 * result).
 * @module logic/free-vs-wield
 */
import { BOUNDS } from "../content/bounds";
import type { MoralLedger, SavedChoice, ShardMode } from "./save/types";
import type { RunState } from "./run-state";

/** Karma awarded for choosing the **free** (safe, corruption-free) attunement. */
export const KARMA_FREE_DELTA = 1;
/** Karma applied for choosing the **wield** (stronger, corrupting) carry. */
export const KARMA_WIELD_DELTA = -1;

/** No corruption accrues / a neutral ledger starts at zero. */
const ZERO = 0;

/**
 * The full result of resolving a pending free-vs-wield choice: the persisted
 * {@link SavedChoice} the player committed to, the folded {@link MoralLedger}, the
 * corruption accrued by the chosen variant (0 for free), and the next
 * {@link RunState} with the pending trigger cleared. Immutable — the reducer
 * returns fresh state and never mutates its inputs.
 */
export interface MoralResolution {
  /** The next run state, with `pendingChoiceShard` cleared. */
  readonly run: RunState;
  /** The persisted resolution (PRD #41 AC5 shape). */
  readonly choice: SavedChoice;
  /** The folded moral tally after this resolution. */
  readonly ledger: MoralLedger;
  /** Corruption accrued by the chosen variant — 0 for free, > 0 for wield. */
  readonly corruptionAccrued: number;
}

/**
 * Whether a resolution actually committed a choice (vs. the no-op {@link
 * resolveChoice} returns when nothing was pending). A thin reader over
 * {@link MoralResolution.choice} so the consumer (the Field, #72) can branch on
 * "did this resolve?" without reaching into the persisted shape. Pure.
 * @param resolution - The resolution to inspect.
 * @returns True when a free-vs-wield choice was committed.
 */
export function isResolved(resolution: MoralResolution): boolean {
  return resolution.choice.resolved;
}

/**
 * Build a fresh, neutral moral ledger: zero net karma and no resolutions counted.
 * Mirrors the initial `moralLedger` the save layer seeds (`logic/save/serialize`)
 * so a fresh run and a fresh save agree. Pure — reads nothing ambient.
 * @returns The initial moral ledger.
 */
export function newMoralLedger(): MoralLedger {
  return { karma: ZERO, freeChoices: ZERO, wieldChoices: ZERO };
}

/**
 * Fold a free-vs-wield commitment into the ledger: free raises karma by
 * {@link KARMA_FREE_DELTA} and increments `freeChoices`; wield applies
 * {@link KARMA_WIELD_DELTA} and increments `wieldChoices`. Pure — returns fresh
 * state.
 * @param ledger - The current ledger (never mutated).
 * @param mode - The carry the player chose.
 * @returns The folded ledger.
 */
function foldLedger(ledger: MoralLedger, mode: ShardMode): MoralLedger {
  return mode === "free"
    ? {
        karma: ledger.karma + KARMA_FREE_DELTA,
        freeChoices: ledger.freeChoices + 1,
        wieldChoices: ledger.wieldChoices,
      }
    : {
        karma: ledger.karma + KARMA_WIELD_DELTA,
        freeChoices: ledger.freeChoices,
        wieldChoices: ledger.wieldChoices + 1,
      };
}

/**
 * Resolve the run's pending free-vs-wield choice in the player's chosen `mode`
 * (PRD #41 FR5 / AC5). When a choice is pending, this:
 *
 * 1. selects the shard variant for `mode` and accrues its corruption from
 *    `content/bounds` (free = 0, wield = the shard's wield `corruptionRate`),
 * 2. folds the {@link MoralLedger} (karma ± and the per-mode tally),
 * 3. records the persisted {@link SavedChoice} (`resolved` with the shard + variant),
 * 4. clears `run.pendingChoiceShard` so a second resolve cannot re-count.
 *
 * Free and wield therefore diverge measurably (variant + karma + corruption) from
 * identical pre-choice state. When **no** choice is pending — the run never raised
 * one, or it was already resolved — this is a no-op: the **same** run and ledger
 * objects are returned (structural sharing) with an unresolved choice and zero
 * corruption, so the call is idempotent. Pure — never mutates its inputs.
 * @param run - The current run state (never mutated).
 * @param ledger - The current moral ledger (never mutated).
 * @param mode - The carry the player committed to (`free` or `wield`).
 * @returns The resolution, or a no-op result preserving the inputs when nothing is pending.
 */
export function resolveChoice(
  run: RunState,
  ledger: MoralLedger,
  mode: ShardMode
): MoralResolution {
  const shard = run.pendingChoiceShard;
  if (shard === null) {
    return {
      run,
      ledger,
      choice: { resolved: false },
      corruptionAccrued: ZERO,
    };
  }
  return {
    run: { ...run, pendingChoiceShard: null },
    choice: { resolved: true, shard, variant: mode },
    ledger: foldLedger(ledger, mode),
    corruptionAccrued: BOUNDS[shard].variants[mode].corruptionRate,
  };
}
