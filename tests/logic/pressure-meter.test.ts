import { describe, expect, it } from "vitest";

import {
  CombatTuning,
  pressureMeter,
  type Combatant,
  type Stats,
} from "../../src/logic/combat";

const ZERO_STATS: Stats = {
  hp: 0,
  ap: 0,
  pow: 0,
  foc: 0,
  def: 0,
  wrd: 0,
  spd: 0,
  lck: 0,
};

/**
 * Build a combatant with explicit overrides over a zeroed default block.
 * @param over - Runtime-field overrides (pressure, broken, ...).
 * @returns A fully-formed combatant at full (zeroed) stats plus the overrides.
 */
function combatant(over: Partial<Combatant> = {}): Combatant {
  const stats: Stats = { ...ZERO_STATS, hp: 100 };
  return {
    ref: "x",
    stats,
    hp: stats.hp,
    ap: stats.ap,
    atb: 0,
    statuses: [],
    pressure: 0,
    broken: false,
    spent: false,
    ...over,
  };
}

describe("Pressure meter fill (AC: Pressure/Break meters render)", () => {
  it("is empty for a fresh, unpressured target", () => {
    const meter = pressureMeter(combatant());
    expect(meter.fill).toBe(0);
    expect(meter.broken).toBe(false);
  });

  it("fills as a 0→1 ratio of pressure toward the Break threshold", () => {
    const half = CombatTuning.breakThreshold / 2;
    const meter = pressureMeter(combatant({ pressure: half }));
    expect(meter.fill).toBeCloseTo(0.5);
    expect(meter.broken).toBe(false);
  });

  it("caps the fill at 1 and reports the Break state once broken", () => {
    const meter = pressureMeter(
      combatant({
        pressure: CombatTuning.breakThreshold * 3,
        broken: true,
      })
    );
    expect(meter.fill).toBe(1);
    expect(meter.broken).toBe(true);
  });

  it("reaches a full fill exactly at the Break threshold", () => {
    const meter = pressureMeter(
      combatant({ pressure: CombatTuning.breakThreshold })
    );
    expect(meter.fill).toBe(1);
  });
});
