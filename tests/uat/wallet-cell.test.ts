/**
 * Unit coverage for the verification-bridge shared-wallet cell
 * (`src/uat/wallet-cell.ts`) — the single live grist wallet both the run-state read
 * (#88) and the travel fast-travel spend (#136) draw on. The cell only *holds* the
 * balance; earn/spend/affordability semantics live in `logic/grist`, which it
 * delegates to. These assertions exercise the hold/spend/adopt/reset contract
 * without a DOM. ZERO Phaser imports by design.
 */
import { describe, expect, it } from "vitest";

import { GristTuning } from "../../src/logic/grist";
import { WalletCell } from "../../src/uat/wallet-cell";

describe("WalletCell — construction + reset", () => {
  it("starts at the slice default balance", () => {
    expect(new WalletCell().read()).toBe(GristTuning.startingGrist);
  });

  it("reset returns the wallet to the slice default", () => {
    const cell = new WalletCell();
    cell.adopt(42);
    cell.spend(10);
    expect(cell.read()).toBe(32);
    cell.reset();
    expect(cell.read()).toBe(GristTuning.startingGrist);
  });
});

describe("WalletCell — adopt", () => {
  it("seeds the live balance from a persisted save's grist", () => {
    const cell = new WalletCell();
    cell.adopt(25);
    expect(cell.read()).toBe(25);
  });
});

describe("WalletCell — spend (delegated to logic/grist)", () => {
  it("draws the balance down on an affordable spend and returns the amount", () => {
    const cell = new WalletCell();
    cell.adopt(20);
    expect(cell.spend(4)).toBe(4);
    expect(cell.read()).toBe(16);
  });

  it("rejects an over-spend, leaving the balance untouched and returning 0", () => {
    const cell = new WalletCell();
    cell.adopt(3);
    expect(cell.spend(4)).toBe(0);
    expect(cell.read()).toBe(3);
  });

  it("accumulates repeated spends against the same balance", () => {
    const cell = new WalletCell();
    cell.adopt(10);
    cell.spend(4);
    cell.spend(4);
    expect(cell.read()).toBe(2);
    // the next 4-cost spend is now unaffordable.
    expect(cell.spend(4)).toBe(0);
    expect(cell.read()).toBe(2);
  });
});
