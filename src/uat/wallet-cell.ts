/**
 * The verification bridge's shared-wallet cell — the single live {@link GristWallet}
 * the bridge owns so every grist-spending seam reads and writes the **same** balance,
 * exactly the single-shared-wallet contract the slice and the traversal feature
 * (#136) are built on. Both the run-state read (`runState().grist`, #88) and the
 * travel cell's fast-travel spend (#136) go through this one cell, so a `fastTravel()`
 * hop visibly decreases the very wallet `runState()` reports — there is no second,
 * private wallet anywhere in the bridge.
 *
 * The cell only *holds* the wallet; all earn/spend/affordability *semantics* live in
 * `logic/grist`, which this delegates to — the bridge never re-implements the
 * economy. The persistence path {@link WalletCell.adopt adopts} a save's balance into
 * the live wallet so the in-memory reads agree with what was persisted. Zero Phaser,
 * no I/O, no RNG.
 * @module uat/wallet-cell
 */
import { newWallet, spendGrist, type GristWallet } from "../logic/grist";

/**
 * The bridge-held shared grist wallet: read the balance, spend against it (the
 * single source of truth a fast-travel hop draws down), and adopt a persisted
 * balance into it. A module singleton shared by the run-state and travel cells so
 * they cannot drift onto separate balances.
 */
export class WalletCell {
  #wallet: GristWallet = newWallet();

  /**
   * Reset the wallet to a fresh slice-default balance — the seam the persistence
   * path uses on a `clearSave` so the live balance does not survive a reset. Pure:
   * drops the held wallet for a new {@link newWallet}.
   * @returns void
   */
  reset(): void {
    this.#wallet = newWallet();
  }

  /**
   * Adopt a persisted balance into the live wallet — the seam the persistence path
   * uses so a restored/seeded save's grist becomes the live shared balance both the
   * run-state read and the travel spend observe. Pure: stores the balance.
   * @param grist - The persisted grist balance to hold.
   * @returns void
   */
  adopt(grist: number): void {
    this.#wallet = newWallet(grist);
  }

  /**
   * The live shared grist balance — what `runState().grist` reports and what a
   * fast-travel hop draws down.
   * @returns The current grist balance.
   */
  read(): number {
    return this.#wallet.grist;
  }

  /**
   * Spend grist from the live shared wallet (delegating to the pure
   * {@link spendGrist}). On a rejected spend — an over-spend or an invalid cost —
   * the wallet is left untouched and 0 is returned; otherwise the balance is drawn
   * down and the amount spent is returned. This is the single mutation seam a
   * fast-travel hop uses, so the spend lands on the **shared** wallet.
   * @param cost - The grist cost to spend.
   * @returns The grist actually spent (0 when the spend was rejected).
   */
  spend(cost: number): number {
    const result = spendGrist(this.#wallet, cost);
    this.#wallet = result.wallet;
    return result.spent;
  }
}
