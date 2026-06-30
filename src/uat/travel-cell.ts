/**
 * The verification bridge's travel cell (#136) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the traversal e2e can earn tiers, discover
 * safehouses, and fast-travel scene-agnostically, observing the soft-gate and the
 * grist deduction on the live build. The cell only *holds* the tier / knowledge /
 * location half of the {@link TravelState}; all tier / soft-gate / fast-travel
 * *semantics* live in `logic/travel`, which this delegates to — the bridge never
 * re-implements the rules.
 *
 * **Single shared wallet (#136 contract).** The cell does NOT own a private grist
 * wallet. Its grist is the bridge's one shared {@link WalletCell} — the same balance
 * `runState().grist` reports — injected at construction. A `fastTravel()` hop reads
 * the live shared balance, prices the hop through the pure {@link fastTravel}, and
 * spends the cost back through the shared wallet, so the deduction lands on the very
 * wallet the run-state read surfaces (never a second, private balance). This is the
 * integration #136 is built on: one wallet funds combat, growth, and fast-travel.
 *
 * Mirrors `uat/world-state-cell` (#134): a module-singleton test seam, not gameplay
 * state, extracted so the bridge stays under its line budget. Zero Phaser, no I/O,
 * no RNG — the determinism digest (`hashTravel`) is exposed so the e2e can assert the
 * same action sequence reproduces an identical hash progression.
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
import { newWallet } from "../logic/grist";
import { type WalletCell } from "./wallet-cell";

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
  /** The safehouses discovered so far, in discovery order (a defensive copy). */
  readonly discovered: readonly string[];
  /** The party's current safehouse location, or null. */
  readonly location: string | null;
  /** The shared grist wallet balance (the same balance `runState().grist` reports). */
  readonly grist: number;
  /** The stable determinism digest of the held state. */
  readonly hash: string;
}

/**
 * The bridge-held travel cell: drive the mobility chain through `logic/travel`,
 * spending grist against the injected shared {@link WalletCell}, and read a
 * scene-agnostic snapshot. Starts on a fresh {@link newTravelState} so the e2e can
 * reproduce a run from a known origin; {@link TravelCell.reset} returns it there
 * (the shared wallet is reset by the bridge alongside it).
 */
export class TravelCell {
  #state: TravelState = newTravelState();
  readonly #wallet: WalletCell;

  /**
   * Construct the travel cell over the bridge's shared wallet. The cell holds no
   * wallet of its own; every grist read/spend goes through this injected
   * {@link WalletCell} so the travel feature and the run-state read share one
   * balance (the #136 single-shared-wallet contract).
   * @param wallet - The bridge's shared grist wallet cell.
   */
  constructor(wallet: WalletCell) {
    this.#wallet = wallet;
  }

  /**
   * The travel state synchronized with the live shared wallet balance — the form
   * the pure `logic/travel` functions read. Rebuilt on each access so the wallet a
   * gate/hash/fast-travel sees is always the shared balance, never a stale copy.
   * @returns The held travel state carrying the live shared grist balance.
   */
  #synced(): TravelState {
    return { ...this.#state, wallet: newWallet(this.#wallet.read()) };
  }

  /**
   * Reset the cell to a fresh foot-tier run (the e2e's known origin). Pure: drops
   * the held tier/knowledge/location state. The shared wallet is reset separately by
   * the bridge so both halves return to the slice default together.
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
   * Fast-travel between two discovered safehouses, delegating to the pure
   * {@link fastTravel} over a state carrying the **live shared wallet** balance. On a
   * successful hop the spent grist is drawn down from the shared {@link WalletCell}
   * (so `runState().grist` decreases by the same amount) and the location advances;
   * on a refused hop (gate failure or insufficient grist) nothing is spent and the
   * held state is unchanged. Returns the grist actually spent (0 when refused).
   * @param from - The origin safehouse.
   * @param to - The destination safehouse.
   * @returns The grist spent on the hop (0 when refused).
   */
  fastTravel(from: string, to: string): number {
    const result = fastTravel(this.#synced(), from, to);
    if (!result.ok) {
      return 0;
    }
    // Land the spend on the SHARED wallet (not a private copy), then advance the
    // tier/knowledge/location half. The wallet field on #state is never the source
    // of truth — #synced() always re-reads the shared balance.
    const spent = this.#wallet.spend(result.spent);
    this.#state = { ...result.state, wallet: newWallet(this.#wallet.read()) };
    return spent;
  }

  /**
   * The scene-agnostic snapshot of the held travel state — the soft-gate readings,
   * the knowledge (a defensive copy so a caller cannot mutate the cell through the
   * snapshot), the location, the shared grist balance, and the determinism digest —
   * all resolved through `logic/travel` over the live shared wallet.
   * @returns The travel snapshot.
   */
  snapshot(): VerifyTravelState {
    const synced = this.#synced();
    return {
      tier: synced.tier,
      canRegional: canTravel(synced, TravelScopes.regional),
      canFullReach: canTravel(synced, TravelScopes.fullReach),
      canFastTravel: canFastTravel(synced),
      discovered: [...synced.discovered],
      location: synced.location,
      grist: synced.wallet.grist,
      hash: hashTravel(synced),
    };
  }
}
