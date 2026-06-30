import { describe, expect, it } from "vitest";

import {
  enemyTelegraph,
  TelegraphTuning,
} from "../../src/logic/combat/telegraph";
import {
  ActionKinds,
  type BattleState,
  type Combatant,
  type Stats,
} from "../../src/logic/combat";

const STATS: Stats = {
  hp: 30,
  ap: 10,
  pow: 8,
  foc: 8,
  def: 4,
  wrd: 4,
  spd: 10,
  lck: 4,
};

/**
 * A combatant fixture at a chosen HP / ATB.
 * @param ref - The combatant content ref.
 * @param hp - The current HP (0 marks it downed).
 * @param atb - The current ATB gauge value.
 * @returns The combatant fixture.
 */
function foe(ref: string, hp: number, atb: number): Combatant {
  return {
    ref,
    stats: STATS,
    hp,
    ap: STATS.ap,
    atb,
    statuses: [],
    pressure: 0,
    broken: false,
    spent: false,
  };
}

/**
 * A battle state with the given enemies (party irrelevant to the telegraph).
 * @param enemies - The enemy lineup the telegraph reads.
 * @returns A battle state with a single living party member and those enemies.
 */
function withEnemies(enemies: readonly Combatant[]): BattleState {
  return {
    party: [foe("wren", 40, 0)],
    enemies,
    grist: 0,
    seed: 1,
    rngState: 1,
    tick: 0,
    phase: "select",
    log: [],
  };
}

describe("enemy telegraph", () => {
  it("telegraphs the living enemy closest to acting (highest ATB)", () => {
    const state = withEnemies([foe("a", 30, 20), foe("b", 30, 80)]);
    const tele = enemyTelegraph(state);
    expect(tele).not.toBeNull();
    expect(tele?.index).toBe(1);
    // The deterministic AI spends its turn on a Strike.
    expect(tele?.kind).toBe(ActionKinds.strike);
  });

  it("ignores downed enemies — telegraphs the next living threat", () => {
    // The corpse has the highest gauge, but only the living enemy (charged past
    // the warn threshold) can be telegraphed.
    const state = withEnemies([foe("dead", 0, 99), foe("alive", 30, 90)]);
    expect(enemyTelegraph(state)?.index).toBe(1);
  });

  it("only telegraphs once an enemy has charged past the warn threshold", () => {
    const cold = withEnemies([foe("a", 30, TelegraphTuning.warnAtb - 1)]);
    expect(enemyTelegraph(cold)).toBeNull();
    const warm = withEnemies([foe("a", 30, TelegraphTuning.warnAtb)]);
    expect(enemyTelegraph(warm)?.index).toBe(0);
  });

  it("exposes the imminence ratio so the HUD can fill a telegraph meter", () => {
    const state = withEnemies([foe("a", 30, 100)]);
    expect(enemyTelegraph(state)?.charge).toBe(1);
  });

  it("returns null when no enemy is alive", () => {
    expect(enemyTelegraph(withEnemies([foe("x", 0, 100)]))).toBeNull();
    expect(enemyTelegraph(withEnemies([]))).toBeNull();
  });
});
