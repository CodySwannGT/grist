/**
 * The unified **grist wallet** — the single shared party pool that funds both
 * combat and growth, surfaced outside battle. Grist is earned across the slice
 * (enemy loot, the salvage cache, the boss) and spent on the strongest combat
 * actions (the grist-costed Bind from the shared pool) and the bench sinks
 * (equip / grow). One wallet, two demands: the "spend the world to win?" tension
 * is the spine of the slice's thesis (PRD #41 FR3 / FR7 / AC4, the
 * [economy-spec](../../wiki/design/economy-spec.md), and the
 * [vertical-slice-build](../../wiki/production/vertical-slice-build.md) numbers).
 *
 * Every function here is a total function of explicit inputs — zero Phaser, no
 * I/O, no RNG, no `Math.random` / `Date.now`, nothing ambient — so the wallet is
 * deterministic and reproducible under test and the verification (UAT) suite.
 * Balances are whole grist; earning never removes and spending never mints, and
 * over-/under-spend is rejected rather than clamped into debt.
 * @module logic/grist
 */

/**
 * First-pass economy tuning for the slice (economy-spec / vertical-slice-build).
 * The starting balance is the contract the AC asserts; per-source gains
 * (enemy `lootGrist`, the salvage cache, the boss) live in the content tables,
 * not here — this wallet only models the pool, not what fills it.
 */
export const GristTuning = {
  /** Grist the party holds at the start of the slice. */
  startingGrist: 10,
} as const;

/** The shared party grist pool. A balance is always whole, non-negative grist. */
export interface GristWallet {
  /** Current grist in the shared pool. */
  readonly grist: number;
}

/** The outcome of a spend attempt against the shared pool. */
export interface GristSpendResult {
  /** Whether the cost was paid (false on over-spend or an invalid cost). */
  readonly ok: boolean;
  /** The wallet after the spend — unchanged (same object) when `ok` is false. */
  readonly wallet: GristWallet;
  /** The grist actually drawn down (0 when the spend was rejected). */
  readonly spent: number;
}

/**
 * Normalize a raw grist amount to a whole, non-negative balance: fractional
 * grist truncates toward zero and a negative balance floors at zero (the pool
 * never carries debt).
 * @param amount - The raw grist amount.
 * @returns The whole, non-negative grist.
 */
function normalize(amount: number): number {
  return Math.max(0, Math.trunc(amount));
}

/**
 * Create a wallet at the given balance, defaulting to
 * {@link GristTuning.startingGrist}. A negative start floors at zero and a
 * fractional start truncates to whole grist.
 * @param grist - The starting balance (default: the slice starting grist).
 * @returns A new wallet.
 */
export function newWallet(
  grist: number = GristTuning.startingGrist
): GristWallet {
  return { grist: normalize(grist) };
}

/**
 * Earn grist into the shared pool. A positive amount adds to the balance (after
 * truncation to whole grist); a zero or negative gain is a no-op that returns
 * the same wallet object, so a no-gain step keeps structural sharing. Earning
 * never removes grist.
 * @param wallet - The wallet to credit.
 * @param amount - The grist gained (truncated to whole grist; ≤ 0 is ignored).
 * @returns The wallet with the gain applied, or the same object on a no-op.
 */
export function earnGrist(wallet: GristWallet, amount: number): GristWallet {
  const gain = normalize(amount);
  return gain === 0 ? wallet : { grist: wallet.grist + gain };
}

/**
 * Whether the shared pool can cover a cost. A zero or negative cost is always
 * affordable; otherwise the pool must hold at least the (truncated) cost.
 * @param wallet - The wallet to test.
 * @param cost - The grist cost (truncated to whole grist).
 * @returns True when the pool covers the cost.
 */
export function canSpendGrist(wallet: GristWallet, cost: number): boolean {
  const owed = Math.trunc(cost);
  return owed <= 0 || wallet.grist >= owed;
}

/**
 * Spend grist from the shared pool (a Bind summon in battle, a bench sink out of
 * it — both draw the *same* wallet). The cost is truncated to whole grist:
 * - a zero cost is a no-op success that returns the same wallet object;
 * - a negative cost is rejected (spending never mints grist);
 * - an over-spend is rejected and leaves the wallet untouched;
 * - otherwise the balance is drawn down by the cost.
 * @param wallet - The wallet to debit.
 * @param cost - The grist cost (truncated to whole grist).
 * @returns The spend result: whether it paid, the resulting wallet, and the grist spent.
 */
export function spendGrist(
  wallet: GristWallet,
  cost: number
): GristSpendResult {
  const owed = Math.trunc(cost);
  if (owed === 0) {
    return { ok: true, wallet, spent: 0 };
  }
  if (owed < 0 || wallet.grist < owed) {
    return { ok: false, wallet, spent: 0 };
  }
  return { ok: true, wallet: { grist: wallet.grist - owed }, spent: owed };
}
