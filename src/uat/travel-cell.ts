/**
 * The verification bridge's travel cell (#136) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the traversal e2e can earn tiers, discover
 * safehouses, and fast-travel scene-agnostically, observing the soft-gate and the
 * grist deduction on the live build. The cell only *holds* the {@link TravelState};
 * all tier / soft-gate / fast-travel *semantics* live in `logic/travel`, which this
 * delegates to — the bridge never re-implements the rules.
 *
 * Mirrors `uat/world-state-cell` (#134): a pure module-singleton test seam, not
 * gameplay state, extracted so the bridge stays under its line budget. Zero Phaser,
 * no I/O, no RNG — the determinism digest (`hashTravel`) is exposed so the e2e can
 * assert the same action sequence reproduces an identical hash progression.
 * @module uat/travel-cell
 */
import {
  TravelScopes,
  canFastTravel,
  canTravel,
  discoverSafehouse,
  fastTravel,
  hashTravel,
  newTravelState,
  unlockAirship,
  unlockSkiff,
  type TravelState,
} from "../logic/travel";

/** A read-only snapshot of the travel cell for e2e assertions. */
export interface VerifyTravelState {
  /** The earned traversal tier (`foot` / `skiff` / `airship`). */
  readonly tier: string;
  /** Whether regional travel is open (the skiff soft-gate). */
  readonly canRegional: boolean;
  /** Whether full-Reach travel is open (the airship soft-gate). */
  readonly canFullReach: boolean;
  /** Whether the fast-travel capability is unlocked (airship + two safehouses). */
  readonly canFastTravel: boolean;
  /** The safehouses discovered so far, in discovery order. */
  readonly discovered: readonly string[];
  /** The party's current safehouse location, or null. */
  readonly location: string | null;
  /** The shared grist wallet balance. */
  readonly grist: number;
  /** The stable determinism digest of the held state. */
  readonly hash: string;
}

/**
 * The bridge-held travel cell: drive the mobility chain through `logic/travel` and
 * read a scene-agnostic snapshot. Starts on a fresh {@link newTravelState} so the
 * e2e can reproduce a run from a known origin; {@link TravelCell.reset} returns it
 * there.
 */
export class TravelCell {
  #state: TravelState = newTravelState();

  /**
   * Reset the cell to a fresh foot-tier run (the e2e's known origin). Pure: drops
   * the held state for a new {@link newTravelState}.
   * @returns void
   */
  reset(): void {
    this.#state = newTravelState();
  }

  /**
   * Earn the skiff, delegating the ordered, idempotent transition to
   * {@link unlockSkiff}.
   * @returns void
   */
  earnSkiff(): void {
    this.#state = unlockSkiff(this.#state);
  }

  /**
   * Earn the airship, delegating to {@link unlockAirship} (a no-op before the skiff
   * — the authored order is enforced by the logic, not the cell).
   * @returns void
   */
  earnAirship(): void {
    this.#state = unlockAirship(this.#state);
  }

  /**
   * Record a discovered safehouse (knowledge), delegating to
   * {@link discoverSafehouse}.
   * @param safehouse - The safehouse the party discovered.
   * @returns void
   */
  discover(safehouse: string): void {
    this.#state = discoverSafehouse(this.#state, safehouse);
  }

  /**
   * Fast-travel between two discovered safehouses, delegating to {@link fastTravel}.
   * On a refused hop (gate failure or insufficient grist) the held state is
   * unchanged. Returns the grist actually spent (0 when refused) so the e2e can
   * assert the deduction.
   * @param from - The origin safehouse.
   * @param to - The destination safehouse.
   * @returns The grist spent on the hop (0 when refused).
   */
  fastTravel(from: string, to: string): number {
    const result = fastTravel(this.#state, from, to);
    this.#state = result.state;
    return result.spent;
  }

  /**
   * The scene-agnostic snapshot of the held travel state — the soft-gate readings,
   * the knowledge, the location, the grist, and the determinism digest — all
   * resolved through `logic/travel`.
   * @returns The travel snapshot.
   */
  snapshot(): VerifyTravelState {
    return {
      tier: this.#state.tier,
      canRegional: canTravel(this.#state, TravelScopes.regional),
      canFullReach: canTravel(this.#state, TravelScopes.fullReach),
      canFastTravel: canFastTravel(this.#state),
      discovered: this.#state.discovered,
      location: this.#state.location,
      grist: this.#state.wallet.grist,
      hash: hashTravel(this.#state),
    };
  }
}
