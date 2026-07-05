/**
 * The verification bridge's **Act II endings cell** (#142) — the in-memory holder the
 * `__VERIFY__` bridge owns so the endings e2e can load an accumulated-standing profile
 * and read, scene-agnostically, (a) the reachable ending set the run's standing unlocks
 * and (b) the finale at Aurel's heart (Sallow confronted, the Choir's Song heard whole)
 * with its committed ending — the same way {@link import("./reunion-cell").ReunionCell}
 * drives the Act II reunions. The cell only *holds* an {@link EndingStanding} profile
 * and *composes* the shipped kit (the pure `logic/narrative/endings` gate resolver +
 * `logic/narrative/finale` set-piece); every rule (Ashfall-gating, the per-ending
 * thresholds, finale reachability, the choice, the determinism digest) lives in `logic`.
 *
 * The endings path is the exact player journey the issue describes: load two standing
 * profiles and observe the reachable ending set differ (an above-threshold path is
 * offered; a below-threshold path is gated out — AC "gated by standing"), then reach
 * the finale and confirm Aurel's heart is reachable, Sallow confronted, and the
 * Choir's-Song-whole finale entered (AC finale). Determinism rides the pure
 * {@link hashFinale} digest — same profile + same choice ⇒ identical hash. Zero Phaser,
 * no I/O, no RNG of its own.
 * @module uat/endings-cell
 */
import {
  chooseEnding,
  hashFinale,
  resolveFinale,
  resolveReachableEndings,
  type EndingId,
  type EndingStanding,
  type FinaleState,
} from "../logic/narrative";
import { type WorldState } from "../logic/world";

/**
 * A neutral starting standing — Act II `ashfall`, no karma, no choices, no reunions.
 * Under {@link ENDING_GATES} this reaches only the always-available `sunder` default,
 * so a fresh cell surfaces the "damning default only" floor an e2e can contrast a
 * gathered, merciful profile against. A module constant (authored once, not rebuilt).
 */
const NEUTRAL_STANDING: EndingStanding = {
  worldState: "ashfall",
  karma: 0,
  freeChoices: 0,
  wieldChoices: 0,
  reunionsCompleted: 0,
};

/**
 * The options an e2e passes to load a standing profile — a partial {@link EndingStanding}
 * layered over {@link NEUTRAL_STANDING}. All optional so a spec can vary only the axes
 * it is probing (e.g. `{ worldState: "reach" }` to load the Act-I un-turned world, or
 * `{ karma: 3, wieldChoices: 0, reunionsCompleted: 3 }` to load a Let-It-Die run).
 */
export interface OpenEndingsOptions {
  /** The world-state the endings resolve through (defaults to `ashfall`). */
  readonly worldState?: WorldState;
  /** Net moral-ledger karma (defaults to 0). */
  readonly karma?: number;
  /** How many Free (merciful) resolutions (defaults to 0). */
  readonly freeChoices?: number;
  /** How many Wield (corruption) resolutions (defaults to 0). */
  readonly wieldChoices?: number;
  /** How many reunions completed (defaults to 0). */
  readonly reunionsCompleted?: number;
}

/**
 * A read-only, scene-agnostic snapshot of the endings state — the accumulated standing,
 * the reachable ending set the standing unlocks, the finale set-piece state (Aurel's
 * heart / Sallow / Choir's Song / chosen ending), and the determinism digest. Bundled
 * like the bridge's other cell snapshots so the e2e reads the whole surface in one call.
 */
export interface VerifyEndingsState {
  /** The accumulated standing the gates read. */
  readonly standing: EndingStanding;
  /** The reachable ending ids the standing unlocks (empty in Act I `reach`). */
  readonly reachableEndings: readonly EndingId[];
  /** Whether Aurel's heart is reached (the world has turned). */
  readonly atAurelsHeart: boolean;
  /** Whether Sallow is confronted at the heart. */
  readonly sallowConfronted: boolean;
  /** Whether the Choir's Song is heard whole. */
  readonly choirSongWhole: boolean;
  /** The committed ending, or null before one is chosen. */
  readonly chosenEnding: EndingId | null;
  /** A stable digest of the finale state for the determinism gate. */
  readonly hash: string;
}

/**
 * The bridge-held endings cell: load a standing profile and read its reachable ending
 * set + finale state as one scene-agnostic {@link VerifyEndingsState} snapshot, and
 * commit one of the reachable endings. Holds only the profile + the committed finale;
 * all rules live in `logic/narrative`.
 */
export class EndingsCell {
  #standing: EndingStanding = NEUTRAL_STANDING;
  #finale: FinaleState = resolveFinale(NEUTRAL_STANDING);

  /**
   * Load a standing profile — the "an agent reached the endings with this accumulated
   * standing" setup. Layers the given options over the neutral baseline and re-resolves
   * the finale, so a re-open starts from a clean, fully-specified standing (no stale
   * choice bleeds across profiles).
   * @param options - The partial standing to load (defaults fill the rest).
   * @returns void
   */
  open(options?: OpenEndingsOptions): void {
    this.#standing = {
      worldState: options?.worldState ?? NEUTRAL_STANDING.worldState,
      karma: options?.karma ?? NEUTRAL_STANDING.karma,
      freeChoices: options?.freeChoices ?? NEUTRAL_STANDING.freeChoices,
      wieldChoices: options?.wieldChoices ?? NEUTRAL_STANDING.wieldChoices,
      reunionsCompleted:
        options?.reunionsCompleted ?? NEUTRAL_STANDING.reunionsCompleted,
    };
    this.#finale = resolveFinale(this.#standing);
  }

  /**
   * Commit one of the finale's reachable endings (a no-op on an ungated end or before
   * the heart is reached — the pure {@link chooseEnding} enforces the guard).
   * @param id - The ending the player chose.
   * @returns void
   */
  choose(id: EndingId): void {
    this.#finale = chooseEnding(this.#finale, id);
  }

  /**
   * Reset the cell back to the neutral starting standing — the seam a `clearSave` uses
   * so a reset leaves the endings reading the damning-default floor, not a stale
   * post-choice state.
   * @returns void
   */
  reset(): void {
    this.#standing = NEUTRAL_STANDING;
    this.#finale = resolveFinale(NEUTRAL_STANDING);
  }

  /**
   * The bundled {@link VerifyEndingsState} snapshot — the standing, the reachable ending
   * set, the finale flags + chosen ending, and the determinism digest.
   * @returns The endings snapshot.
   */
  snapshot(): VerifyEndingsState {
    return {
      standing: this.#standing,
      reachableEndings: resolveReachableEndings(this.#standing),
      atAurelsHeart: this.#finale.atAurelsHeart,
      sallowConfronted: this.#finale.sallowConfronted,
      choirSongWhole: this.#finale.choirSongWhole,
      chosenEnding: this.#finale.chosenEnding,
      hash: hashFinale(this.#finale),
    };
  }
}
