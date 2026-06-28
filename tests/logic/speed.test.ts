import { describe, expect, it } from "vitest";

import { BattleTiming } from "../../src/consts";
import {
  BattleSpeeds,
  DEFAULT_SPEED,
  nextSpeed,
  speedLabel,
  speedTickMs,
} from "../../src/game/speed";

describe("battle-speed model", () => {
  it("opens in Normal speed by default", () => {
    expect(DEFAULT_SPEED).toBe(BattleSpeeds.normal);
  });

  it("cycles Wait -> Normal -> Fast -> Wait", () => {
    expect(nextSpeed(BattleSpeeds.wait)).toBe(BattleSpeeds.normal);
    expect(nextSpeed(BattleSpeeds.normal)).toBe(BattleSpeeds.fast);
    expect(nextSpeed(BattleSpeeds.fast)).toBe(BattleSpeeds.wait);
  });

  it("freezes the fill in Wait and speeds the cadence in Fast", () => {
    expect(speedTickMs(BattleSpeeds.wait)).toBeNull();
    expect(speedTickMs(BattleSpeeds.normal)).toBe(BattleTiming.atbTickMs);
    expect(speedTickMs(BattleSpeeds.fast)).toBe(BattleTiming.fastTickMs);
    // Fast is a strictly shorter interval than Normal — a faster observed cadence.
    expect(BattleTiming.fastTickMs).toBeLessThan(BattleTiming.atbTickMs);
  });

  it("labels each speed for the HUD", () => {
    expect(speedLabel(BattleSpeeds.wait)).toBe("WAIT");
    expect(speedLabel(BattleSpeeds.normal)).toBe("NORMAL");
    expect(speedLabel(BattleSpeeds.fast)).toBe("FAST");
  });
});
