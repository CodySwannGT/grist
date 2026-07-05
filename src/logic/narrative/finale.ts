/**
 * The pure **finale set-piece resolver** (#142, PRD #43 — FR8 / AC6) — the payoff
 * beat at **Aurel's heart** (`wiki/narrative/main-quest.md` Ch.10; `story.md`): the
 * confrontation with **Mr. Sallow** the Renderer, where the **Choir's Song is heard
 * whole** for the first time and the player commits to one of the reachable ending
 * paths. It composes — never re-specs — the ending-gate resolver (`./endings`): the
 * reachable ending-choice the finale offers is exactly
 * {@link resolveReachableEndings} over the run's accumulated standing.
 *
 * The finale is reachable (Aurel's heart is entered, Sallow confronted, the Song
 * heard whole) once the world has turned to **ashfall** — the Ch.10 gate "into
 * Aurel's heart". Because the always-available {@link EndingIds.sunder default}
 * keeps the reachable set non-empty in `ashfall`, reaching the heart always offers
 * at least one ending; a `reach` standing enters no finale at all (the endings are
 * Act II only). {@link chooseEnding} commits one of the *reachable* ends — a choice
 * of an ungated end is a no-op (structural sharing), so the finale can never resolve
 * to an ending the run's standing never unlocked.
 *
 * Owns only the finale *state* + *rules* as pure functions: data-in / data-out, no
 * mutation, no ambient reads (no Phaser, no I/O, no `Math.random` / `Date.now`), so
 * the same standing + the same choice always yield the same {@link FinaleState} and
 * the same {@link hashFinale} digest — the determinism the DoD gate samples. The
 * finale *content* (Sallow's stat block, the ending scripts, epilogue variants) is
 * authored as this increment is built (living docs, decision 0003); this module is
 * the reachability + choice logic those scenes render.
 * @module logic/narrative/finale
 */
import {
  type EndingId,
  type EndingStanding,
  resolveReachableEndings,
} from "./endings";
import { isAshfall } from "../world";

/** FNV-1a 32-bit offset basis (matches `logic/combat/hash`). */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/**
 * The finale state at Aurel's heart — a pure projection of the run's standing plus
 * the committed ending. `atAurelsHeart` / `sallowConfronted` / `choirSongWhole` all
 * turn true together the instant the world has turned (the Ch.10 gate is a single
 * threshold: reaching the heart *is* confronting Sallow and hearing the Song whole).
 * `reachableEndings` is the ending-choice the finale offers; `chosenEnding` is the
 * committed end, or null before one is chosen. Plain serializable data.
 */
export interface FinaleState {
  /** Whether Aurel's heart is reached — true once the world has turned to ashfall. */
  readonly atAurelsHeart: boolean;
  /** Whether Sallow is confronted — coincident with reaching the heart. */
  readonly sallowConfronted: boolean;
  /** Whether the Choir's Song is heard whole — coincident with the confrontation. */
  readonly choirSongWhole: boolean;
  /** The reachable ending-choice offered at the heart (empty before the turn). */
  readonly reachableEndings: readonly EndingId[];
  /** The committed ending, or null before one is chosen. */
  readonly chosenEnding: EndingId | null;
}

/**
 * Resolve the finale for a run's accumulated standing. Reaching Aurel's heart is the
 * single Act II gate: in `ashfall` the heart is entered, Sallow confronted, and the
 * Choir's Song heard whole, and the finale offers the reachable ending-choice; in
 * `reach` no finale is entered (all flags false, no ends offered). No ending is
 * pre-chosen. Pure — a total function of the standing.
 * @param standing - The run's accumulated standing.
 * @returns The finale state at Aurel's heart (or the un-entered finale in `reach`).
 */
export function resolveFinale(standing: EndingStanding): FinaleState {
  const reached = isAshfall(standing.worldState);
  return {
    atAurelsHeart: reached,
    sallowConfronted: reached,
    choirSongWhole: reached,
    reachableEndings: reached ? resolveReachableEndings(standing) : [],
    chosenEnding: null,
  };
}

/**
 * Whether the finale has been reached — Aurel's heart entered, Sallow confronted,
 * the Choir's Song heard whole. A thin reader so a consumer need not restate the
 * three coincident flags. Pure.
 * @param finale - The finale state to inspect.
 * @returns True when the finale set-piece has been entered.
 */
export function isFinaleReached(finale: FinaleState): boolean {
  return finale.atAurelsHeart;
}

/**
 * Commit one of the finale's **reachable** endings. Choosing a reachable end records
 * it as {@link FinaleState.chosenEnding}; choosing an end that is not in
 * `reachableEndings` (one the run's standing never unlocked, or any choice before the
 * heart is reached) is a no-op that returns the SAME state object (structural
 * sharing), so the finale can never resolve to an ungated ending. Pure — returns
 * fresh state only on a real commitment.
 * @param finale - The current finale state (never mutated).
 * @param id - The ending the player chose.
 * @returns The finale with the ending committed, or the same object when ungated.
 */
export function chooseEnding(finale: FinaleState, id: EndingId): FinaleState {
  if (!finale.reachableEndings.includes(id)) {
    return finale;
  }
  return { ...finale, chosenEnding: id };
}

/**
 * A stable FNV-1a digest of the finale state — the determinism sample the DoD gate
 * compares across two identical runs (same standing + same choice ⇒ identical
 * digest). Serializes the reached flag, the reachable set (authored order), and the
 * committed ending into a canonical token. Pure — no ambient reads.
 * @param finale - The finale state to digest.
 * @returns An 8-character hex digest.
 */
export function hashFinale(finale: FinaleState): string {
  const token = [
    finale.atAurelsHeart ? 1 : 0,
    finale.reachableEndings.join(","),
    finale.chosenEnding ?? "none",
  ].join("#");
  const hash = [...token].reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (hash >>> 0).toString(16).padStart(8, "0");
}
