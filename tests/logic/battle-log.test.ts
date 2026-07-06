import { describe, expect, it } from "vitest";

import {
  battleLogLines,
  formatLogEvent,
  BattleLogTuning,
} from "../../src/logic/battle-log";
import {
  ActionKinds,
  BattleSides,
  startBattle,
  type BattleEvent,
  type BattleState,
  type Combatant,
} from "../../src/logic/combat";
import {
  ENCOUNTERS,
  EncounterIds,
  ENEMIES,
  EnemyIds,
  PARTY,
  PartyMemberIds,
} from "../../src/content";

const WREN = { side: BattleSides.party, index: 0 } as const;
const FOE = { side: BattleSides.enemies, index: 0 } as const;

/**
 * A minimal battle state carrying just the log the formatter reads (empty
 * rosters). With no live combatant behind a ref, its name falls back to the
 * terse side-tagged slot label — the degenerate/headless path.
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

/** A zeroed stat block for a fixture combatant (the formatter reads none of it). */
const ZERO_STATS = {
  hp: 1,
  ap: 0,
  pow: 0,
  foc: 0,
  def: 0,
  wrd: 0,
  spd: 0,
  lck: 0,
} as const;

/**
 * A fixture combatant carrying just the `ref` content id the name-resolver reads.
 * @param ref - The party-member / enemy content id.
 * @returns A minimal live combatant.
 */
function combatant(ref: string): Combatant {
  return {
    ref,
    stats: ZERO_STATS,
    hp: 1,
    ap: 0,
    atb: 0,
    statuses: [],
    pressure: 0,
    broken: false,
    spent: false,
  };
}

/**
 * A battle state with the given rosters and log — for exercising name resolution
 * against live combatants (which carry the content `ref`).
 * @param party - The party members' content ids.
 * @param enemies - The enemies' content ids.
 * @param log - The event log to project.
 * @returns A battle state with populated rosters.
 */
function withRosters(
  party: readonly string[],
  enemies: readonly string[],
  log: readonly BattleEvent[]
): BattleState {
  return {
    ...stateWithLog(log),
    party: party.map(combatant),
    enemies: enemies.map(combatant),
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
    // With no live combatant behind the refs, names fall back to a side-tagged
    // slot label — still a legible, structured line.
    const line = formatLogEvent(event, stateWithLog([]));
    expect(line).toContain("Strike");
    expect(line).toContain("12");
  });

  it("names the actor and target through the content tables", () => {
    const state = withRosters(
      [PartyMemberIds.wren],
      [EnemyIds.marrowScrapper],
      []
    );
    const line = formatLogEvent(
      {
        tick: 3,
        kind: ActionKinds.strike,
        actor: WREN,
        target: FOE,
        damage: 17,
      },
      state
    );
    expect(line).toBe(
      `${PARTY.wren.name} Strike ${ENEMIES[EnemyIds.marrowScrapper].name} (17 dmg)`
    );
  });

  it("never leaves a raw actor ID (P1/E2) in a resolved line", () => {
    const state = withRosters(
      [PartyMemberIds.wren, PartyMemberIds.tobi],
      [EnemyIds.marrowScrapper, EnemyIds.renderConstruct],
      []
    );
    const line = formatLogEvent(
      {
        tick: 3,
        kind: ActionKinds.strike,
        actor: { side: BattleSides.party, index: 1 },
        target: { side: BattleSides.enemies, index: 1 },
        damage: 8,
      },
      state
    );
    expect(line).toContain(PARTY.tobi.name);
    expect(line).toContain(ENEMIES[EnemyIds.renderConstruct].name);
    expect(line).not.toMatch(/\b[PE]\d\b/);
  });

  it("disambiguates two same-id enemies with a trailing letter", () => {
    const state = withRosters(
      [PartyMemberIds.wren],
      [EnemyIds.marrowScrapper, EnemyIds.marrowScrapper],
      []
    );
    const first = formatLogEvent(
      {
        tick: 1,
        kind: ActionKinds.strike,
        actor: WREN,
        target: { side: BattleSides.enemies, index: 0 },
        damage: 5,
      },
      state
    );
    const second = formatLogEvent(
      {
        tick: 2,
        kind: ActionKinds.strike,
        actor: WREN,
        target: { side: BattleSides.enemies, index: 1 },
        damage: 6,
      },
      state
    );
    expect(first).toContain(`${ENEMIES[EnemyIds.marrowScrapper].name} A`);
    expect(second).toContain(`${ENEMIES[EnemyIds.marrowScrapper].name} B`);
  });

  it("leaves a lone enemy's name undecorated (no disambiguator)", () => {
    const state = withRosters(
      [PartyMemberIds.wren],
      [EnemyIds.marrowScrapper],
      []
    );
    const line = formatLogEvent(
      {
        tick: 1,
        kind: ActionKinds.strike,
        actor: WREN,
        target: FOE,
        damage: 5,
      },
      state
    );
    expect(line).toContain(ENEMIES[EnemyIds.marrowScrapper].name);
    expect(line).not.toContain(`${ENEMIES[EnemyIds.marrowScrapper].name} A`);
  });

  it("omits the damage clause for a non-damaging action (Defend)", () => {
    const event: BattleEvent = {
      tick: 4,
      kind: ActionKinds.defend,
      actor: WREN,
    };
    const line = formatLogEvent(event, stateWithLog([]));
    expect(line).toContain("Defend");
    // A non-damaging action carries no damage clause at all.
    expect(line).not.toContain("dmg");
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

  it("projects live rosters into named lines end-to-end", () => {
    const base = startBattle(
      [PARTY.wren, PARTY.tobi],
      ENCOUNTERS[EncounterIds.theDrip],
      1
    );
    const state: BattleState = {
      ...base,
      log: [
        {
          tick: 1,
          kind: ActionKinds.strike,
          actor: WREN,
          target: FOE,
          damage: 17,
        },
      ],
    };
    const lines = battleLogLines(state);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      `${PARTY.wren.name} Strike ${ENEMIES[EnemyIds.marrowScrapper].name} (17 dmg)`
    );
    expect(lines[0]).not.toMatch(/\b[PE]\d\b/);
  });

  it("returns an empty list for a fresh battle with no resolved actions", () => {
    expect(battleLogLines(stateWithLog([]))).toEqual([]);
    expect(
      battleLogLines(stateWithLog([{ tick: 1, kind: ActionKinds.tick }]))
    ).toEqual([]);
  });
});
