/**
 * Unit coverage for the verification-bridge travel cell (`src/uat/travel-cell.ts`,
 * #136) — the in-memory holder the `__VERIFY__` bridge owns so the traversal e2e can
 * earn tiers, discover safehouses, and fast-travel scene-agnostically. The cell owns
 * NO private wallet: it spends through the injected shared {@link WalletCell} (the
 * single-shared-wallet contract), and its snapshot returns a defensive copy of the
 * discovered list so a bridge caller cannot mutate the cell through it. Tier /
 * soft-gate / fast-travel semantics live in `logic/travel`, which the cell delegates
 * to. ZERO Phaser imports by design.
 */
import { describe, expect, it } from "vitest";

import { GristTuning } from "../../src/logic/grist";
import { TravelCell } from "../../src/uat/travel-cell";
import { WalletCell } from "../../src/uat/wallet-cell";

const MARROW = "marrow-safehouse";
const VALE = "vale-safehouse";

/**
 * A travel cell over a freshly-seeded shared wallet, plus that wallet, with the
 * airship earned and two safehouses discovered — the fast-travel precondition.
 * @param grist - The shared wallet balance to seed.
 * @returns The wired travel cell and its shared wallet.
 */
function readyCell(grist: number): {
  cell: TravelCell;
  wallet: WalletCell;
} {
  const wallet = new WalletCell();
  const cell = new TravelCell(wallet);
  wallet.adopt(grist);
  cell.earnSkiff();
  cell.earnAirship();
  cell.discover(MARROW);
  cell.discover(VALE);
  return { cell, wallet };
}

describe("TravelCell — tier unlocks delegate to logic/travel", () => {
  it("unlocks foot → skiff → airship in the authored order", () => {
    const cell = new TravelCell(new WalletCell());
    expect(cell.snapshot().tier).toBe("foot");
    // airship before skiff is refused (no-op).
    cell.earnAirship();
    expect(cell.snapshot().tier).toBe("foot");
    cell.earnSkiff();
    expect(cell.snapshot().tier).toBe("skiff");
    expect(cell.snapshot().canRegional).toBe(true);
    cell.earnAirship();
    expect(cell.snapshot().tier).toBe("airship");
    expect(cell.snapshot().canFullReach).toBe(true);
  });
});

describe("TravelCell — fast-travel spends the SHARED wallet (#136 contract)", () => {
  it("draws the spend from the injected wallet, not a private balance", () => {
    const { cell, wallet } = readyCell(10);
    expect(cell.snapshot().grist).toBe(10);
    expect(wallet.read()).toBe(10);

    const spent = cell.fastTravel(MARROW, VALE);
    expect(spent).toBeGreaterThan(0);
    // The SAME wallet decreased by the spend — the cell holds no private wallet.
    expect(wallet.read()).toBe(10 - spent);
    expect(cell.snapshot().grist).toBe(wallet.read());
    expect(cell.snapshot().location).toBe(VALE);
  });

  it("a refused (insufficient-grist) hop leaves the shared wallet untouched", () => {
    const { cell, wallet } = readyCell(2); // below the 4-grist hop cost
    const spent = cell.fastTravel(MARROW, VALE);
    expect(spent).toBe(0);
    expect(wallet.read()).toBe(2);
    expect(cell.snapshot().grist).toBe(2);
  });

  it("a spend made directly on the shared wallet is visible to the travel snapshot", () => {
    // Proves the travel cell reads the live shared balance, not a cached copy.
    const { cell, wallet } = readyCell(10);
    wallet.spend(6);
    expect(cell.snapshot().grist).toBe(4);
  });

  it("starts from the slice default balance when no save seeds the wallet", () => {
    const wallet = new WalletCell();
    const cell = new TravelCell(wallet);
    expect(cell.snapshot().grist).toBe(GristTuning.startingGrist);
  });
});

describe("TravelCell — snapshot is defensive (cannot mutate the cell through it)", () => {
  it("returns a COPY of discovered, so mutating it does not change the cell", () => {
    const { cell } = readyCell(10);
    const snap = cell.snapshot();
    expect(snap.discovered).toEqual([MARROW, VALE]);
    // Mutate the returned array (a bridge caller could, in untyped JS).
    (snap.discovered as string[]).push("phantom-safehouse");
    // The cell's own knowledge is unchanged — the gate/hash are not corrupted.
    expect(cell.snapshot().discovered).toEqual([MARROW, VALE]);
  });

  it("reset returns the cell to a fresh foot-tier run", () => {
    const { cell } = readyCell(10);
    cell.fastTravel(MARROW, VALE);
    cell.reset();
    const snap = cell.snapshot();
    expect(snap.tier).toBe("foot");
    expect(snap.discovered).toEqual([]);
    expect(snap.location).toBeNull();
  });
});
