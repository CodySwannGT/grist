import { describe, expect, it } from "vitest";

import {
  battleLogLines,
  formatLogEvent,
  BattleLogTuning,
} from "../../src/logic/battle-log";
import {
  ActionKinds,
  BattleSides,
  type BattleEvent,
  type BattleState,
} from "../../src/logic/combat";

const WREN = { side: BattleSides.party, index: 0 } as const;
const FOE = { side: BattleSides.enemies, index: 0 } as const;

/**
 * A minimal battle state carrying just the log the formatter reads.
 * @param log - The event log to project into lines.
 * @returns A battle state whose only meaningful field is `log`.
 */
function stateWithLog(log: readonly BattleEvent[]): BattleState {
  return {
    party: [],
    enemies: [],
    grist: 0,
    seed: 1,
    rngState: 1,
    tick: 0,
    phase: "select",
    log,
  };
}

describe("battle log formatter", () => {
  it("formats a damaging strike as actor → target with the damage", () => {
    const event: BattleEvent = {
      tick: 3,
      kind: ActionKinds.strike,
      actor: WREN,
      target: FOE,
      damage: 12,
    };
    // Names resolve through the content tables: party index 0 is unknown here
    // (no party array), so it falls back to a side-tagged label — still readable.
    expect(formatLogEvent(event)).toContain("Strike");
    expect(formatLogEvent(event)).toContain("12");
  });

  it("omits the damage clause for a non-damaging action (Defend)", () => {
    const event: BattleEvent = {
      tick: 4,
      kind: ActionKinds.defend,
      actor: WREN,
    };
    expect(formatLogEvent(event)).toContain("Defend");
    // A non-damaging action carries no damage clause at all.
    expect(formatLogEvent(event)).not.toContain("dmg");
  });

  it("never surfaces the internal tick action as a log line", () => {
    const log: readonly BattleEvent[] = [
      { tick: 1, kind: ActionKinds.tick },
      {
        tick: 2,
        kind: ActionKinds.strike,
        actor: WREN,
        target: FOE,
        damage: 5,
      },
    ];
    const lines = battleLogLines(stateWithLog(log));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Strike");
  });

  it("returns the most-recent actions last, capped at the visible budget", () => {
    const log: readonly BattleEvent[] = Array.from(
      { length: BattleLogTuning.maxLines + 5 },
      (_unused, index) => ({
        tick: index,
        kind: ActionKinds.strike,
        actor: WREN,
        target: FOE,
        damage: index,
      })
    );
    const lines = battleLogLines(stateWithLog(log));
    expect(lines).toHaveLength(BattleLogTuning.maxLines);
    // The last visible line is the most recent event (highest damage value here).
    const tail = log[log.length - 1];
    expect(lines[lines.length - 1]).toContain(String(tail?.damage));
  });

  it("returns an empty list for a fresh battle with no resolved actions", () => {
    expect(battleLogLines(stateWithLog([]))).toEqual([]);
    expect(
      battleLogLines(stateWithLog([{ tick: 1, kind: ActionKinds.tick }]))
    ).toEqual([]);
  });
});
