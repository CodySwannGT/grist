/**
 * The pure **Act II ending-gate resolver** (#142, PRD #43 — FR8 / AC6) — the
 * "weight of the slow burn" payoff where the four ending paths a dying world can
 * take (`wiki/narrative/story.md`, "Endings"; `main-quest.md` Ch.9-10) are gated
 * by *who the party became*: which ends are **reachable** resolves from the
 * accumulated standing the run carried in — the moral ledger (Free-vs-Wield karma
 * + the per-mode tally, `logic/free-vs-wield`) and how much of the lost party was
 * reunited (`logic/party/reunion`) — evaluated against per-ending thresholds. It
 * is the FFVI tradition: the finale scales to the run, so a merciful, fully-
 * gathered party unlocks ends a corrupt, alone one never sees.
 *
 * This module owns only the *gating table* (content-as-data — the four
 * {@link ENDING_GATES}) and the *resolve rules* as pure functions: data-in /
 * data-out, no mutation, no ambient reads (no Phaser, no I/O, no `Math.random` /
 * `Date.now`), so the same {@link EndingStanding} always yields the same reachable
 * set — deterministic and unit-testable headless. It re-uses — never re-specs —
 * the world-state flag (`logic/world`: endings resolve only after the Reckoning
 * has turned the world to **ashfall**; an Act I `reach` standing reaches nothing)
 * and consumes the accumulated moral/reunion state the earlier slices persist. The
 * finale set-piece at Aurel's heart (Sallow, the Choir's Song heard whole) is the
 * sibling `logic/narrative/finale` module, which composes this resolver.
 *
 * The **exact threshold numbers** are authored here per the living-doc convention
 * (decision 0003): karma accrues ±1 per Free/Wield resolution
 * (`KARMA_FREE_DELTA` / `KARMA_WIELD_DELTA`) and there are four reunions, so the
 * gates are calibrated to that scale — the always-available damning default
 * ({@link EndingIds.sunder}) guarantees the finale is never a dead end, while the
 * hardest, quietest end ({@link EndingIds.letDie}) demands a near-pure Free run
 * with most of the party found.
 * @module logic/narrative/endings
 */
import { isAshfall, type WorldState } from "../world";
import type { MoralLedger } from "../save/types";

/**
 * The four ending paths (`wiki/narrative/story.md`, "Endings"): **wake** the god
 * (restore the Weave), **let-die** (allow Aurel to finish dying — the hardest,
 * quietest, most hopeful end), **sunder** (finish the Sundering, Sallow's oblivion
 * — available and damning), and **third-way** (mortal stewardship — break the
 * Houses, the time of mortals begins). Stable string ids so the set round-trips
 * through `JSON.stringify` and reads as content, never an enum ordinal.
 */
export const EndingIds = {
  /** Wake the god — restore the Weave and the age of wonders. */
  wake: "wake",
  /** Let it die — allow Aurel to finish dying in peace. The hardest end. */
  letDie: "let-die",
  /** Finish the Sundering (Sallow's end) — oblivion as mercy. Always reachable. */
  sunder: "sunder",
  /** The third way — mortal stewardship; the time of mortals begins. */
  thirdWay: "third-way",
} as const;

/** An ending-path id (the literal-union of {@link EndingIds}). */
export type EndingId = (typeof EndingIds)[keyof typeof EndingIds];

/**
 * The accumulated **standing** the ending gates read — the distilled record of who
 * the party became, drawn from the state the earlier slices persist: the
 * world-state flag (endings resolve only in `ashfall`), the net Free-vs-Wield
 * `karma`, the per-mode `freeChoices` / `wieldChoices` tallies, and how many
 * reunions were completed. Plain serializable data — no Phaser, no behavior.
 */
export interface EndingStanding {
  /** The world-state the endings resolve through (reachable only in `ashfall`). */
  readonly worldState: WorldState;
  /** Net moral-ledger karma: positive leans Free/merciful, negative leans Wield. */
  readonly karma: number;
  /** How many resolutions chose the Free (merciful) attunement. */
  readonly freeChoices: number;
  /** How many resolutions chose the Wield (corruption) carry. */
  readonly wieldChoices: number;
  /** How many Act II reunions were completed (the party the run reassembled). */
  readonly reunionsCompleted: number;
}

/**
 * One ending's **gate** — content-as-data: its id, its player-facing title, and the
 * standing thresholds that must all be met (in `ashfall`) for the ending to be
 * reachable. A threshold field left absent is not tested. `alwaysInAshfall` marks
 * the damning default that is reachable the instant the world has turned, with no
 * standing bar — so the finale can never offer zero paths.
 */
export interface EndingGate {
  /** The ending this gate governs. */
  readonly id: EndingId;
  /** The player-facing ending title (`wiki/narrative/story.md`). */
  readonly title: string;
  /** Minimum net karma required (absent = not tested). */
  readonly minKarma?: number;
  /** Maximum Wield choices allowed — a purity cap (absent = not tested). */
  readonly maxWieldChoices?: number;
  /** Minimum reunions completed required (absent = not tested). */
  readonly minReunionsCompleted?: number;
  /** When true, reachable in `ashfall` with no standing bar (the damning default). */
  readonly alwaysInAshfall?: boolean;
}

/**
 * The four ending gates (content-as-data), calibrated to the ±1-per-choice karma
 * scale and the four reunions:
 *
 * - **sunder** — always reachable once the world has turned (oblivion is always on
 *   the table; "available, and damning"), so the finale is never a dead end.
 * - **wake** — restoring the age of wonders needs allies gathered: ≥1 reunion.
 * - **third-way** — mortal stewardship needs a positive-leaning run that gathered a
 *   party: karma ≥ 2 and ≥ 2 reunions.
 * - **let-die** — the hardest, quietest, most hopeful end: a near-pure Free run
 *   (karma ≥ 3, **zero** Wield carries) that reassembled most of the party (≥ 3).
 */
export const ENDING_GATES: readonly EndingGate[] = [
  {
    id: EndingIds.sunder,
    title: "Finish the Sundering",
    alwaysInAshfall: true,
  },
  { id: EndingIds.wake, title: "Wake the God", minReunionsCompleted: 1 },
  {
    id: EndingIds.thirdWay,
    title: "The Third Way",
    minKarma: 2,
    minReunionsCompleted: 2,
  },
  {
    id: EndingIds.letDie,
    title: "Let It Die",
    minKarma: 3,
    maxWieldChoices: 0,
    minReunionsCompleted: 3,
  },
] as const;

/**
 * Whether a single {@link EndingGate} is reachable for the given standing. Endings
 * resolve only after the Reckoning — a `reach` standing reaches nothing. In
 * `ashfall`, the `alwaysInAshfall` default is reachable unconditionally; otherwise
 * every present threshold (min karma, max Wield, min reunions) must hold. Pure —
 * reads only its inputs.
 * @param standing - The accumulated standing to evaluate.
 * @param gate - The ending gate to test.
 * @returns True when the ending is reachable for this standing.
 */
export function isGateReachable(
  standing: EndingStanding,
  gate: EndingGate
): boolean {
  if (!isAshfall(standing.worldState)) {
    return false;
  }
  if (gate.alwaysInAshfall === true) {
    return true;
  }
  const karmaOk =
    gate.minKarma === undefined || standing.karma >= gate.minKarma;
  const wieldOk =
    gate.maxWieldChoices === undefined ||
    standing.wieldChoices <= gate.maxWieldChoices;
  const reunionsOk =
    gate.minReunionsCompleted === undefined ||
    standing.reunionsCompleted >= gate.minReunionsCompleted;
  return karmaOk && wieldOk && reunionsOk;
}

/**
 * Whether a specific ending id is reachable for the given standing. A thin reader
 * over {@link isGateReachable} that locates the gate by id — returns false for an
 * unknown id rather than throwing, so a caller can probe any ending safely. Pure.
 * @param standing - The accumulated standing to evaluate.
 * @param id - The ending id to probe.
 * @returns True when that ending is reachable.
 */
export function isEndingReachable(
  standing: EndingStanding,
  id: EndingId
): boolean {
  const gate = ENDING_GATES.find(candidate => candidate.id === id);
  return gate !== undefined && isGateReachable(standing, gate);
}

/**
 * Resolve the full set of reachable endings for a standing — the ending-choice the
 * finale offers. Filters {@link ENDING_GATES} in authored order, so the set is
 * stable and deterministic; an Act I `reach` standing yields the empty set (the
 * endings are Act II only). Pure — returns a fresh array each call.
 * @param standing - The accumulated standing to evaluate.
 * @returns The reachable ending ids, in authored order (empty in `reach`).
 */
export function resolveReachableEndings(
  standing: EndingStanding
): readonly EndingId[] {
  return ENDING_GATES.filter(gate => isGateReachable(standing, gate)).map(
    gate => gate.id
  );
}

/**
 * Build an {@link EndingStanding} from the persisted state the run accumulated: the
 * world-state flag, the {@link MoralLedger} (karma + Free/Wield tally), and the
 * count of completed reunions. The single seam that maps saved run state into the
 * gate resolver's input, so the endings read from the *same* accumulated ledger the
 * mill beat and Bound sites folded — not a re-derivation. Pure.
 * @param worldState - The world-state the endings resolve through.
 * @param ledger - The persisted moral ledger (karma + per-mode tally).
 * @param reunionsCompleted - The number of reunions completed this run.
 * @returns The distilled standing the ending gates read.
 */
export function standingFromLedger(
  worldState: WorldState,
  ledger: MoralLedger,
  reunionsCompleted: number
): EndingStanding {
  return {
    worldState,
    karma: ledger.karma,
    freeChoices: ledger.freeChoices,
    wieldChoices: ledger.wieldChoices,
    reunionsCompleted,
  };
}
