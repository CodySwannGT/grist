import { describe, expect, it } from "vitest";

import {
  isResolved,
  nextActor,
  resolveEnemyTurns,
  runToNextDecision,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
  type Combatant,
} from "../../src/logic/combat";
import { ENCOUNTERS, PARTY } from "../../src/content";

/** Overrides for the synthetic combatant builder. */
interface MkOpts {
  readonly hp?: number;
  readonly pow?: number;
  readonly spd?: number;
  readonly atb?: number;
}

/**
 * Build a synthetic combatant with control over HP, POW, SPD, and the ATB gauge
 * (atb 100 = ready). DEF/WRD are 0 so a Strike's damage is easy to reason about.
 * @param ref - The content ref.
 * @param opts - HP / stat / gauge overrides.
 * @returns A combatant.
 */
function mk(ref: string, opts: MkOpts = {}): Combatant {
  const { hp = 100, pow = 10, spd = 10, atb = 0 } = opts;
  return {
    ref,
    stats: { hp: 100, ap: 0, pow, foc: 0, def: 0, wrd: 0, spd, lck: 0 },
    hp,
    ap: 0,
    atb,
    statuses: [],
    pressure: 0,
    broken: false,
    spent: false,
  };
}

/**
 * Assemble a synthetic {@link BattleState} from explicit sides.
 * @param party - The party side.
 * @param enemies - The enemy side.
 * @param over - State field overrides.
 * @returns A battle state.
 */
function battle(
  party: readonly Combatant[],
  enemies: readonly Combatant[],
  over: Partial<BattleState> = {}
): BattleState {
  return {
    party,
    enemies,
    grist: 0,
    seed: 1,
    rngState: 1,
    tick: 0,
    phase: "select",
    log: [],
    ...over,
  };
}

describe("resolveEnemyTurns — deterministic enemy turn resolution", () => {
  it("spends a ready enemy's turn on a Strike against the party and clears its gauge", () => {
    const start = battle(
      [mk("hero", { hp: 100, spd: 5 })],
      [mk("goon", { pow: 20, spd: 10, atb: 100 })]
    );
    const after = resolveEnemyTurns(start);
    // The enemy hit the party member and its gauge was reset, so it is no longer
    // the next actor (no deadlock on a ready enemy).
    expect(after.party[0]?.hp).toBeLessThan(100);
    expect(after.enemies[0]?.atb).toBe(0);
    expect(nextActor(after)?.side).not.toBe("enemies");
  });

  it("leaves a ready party member's turn for the player (same reference)", () => {
    const start = battle(
      [mk("hero", { atb: 100, spd: 10 })],
      [mk("goon", { atb: 0, spd: 10 })]
    );
    // The head of the ready queue is the party member, so nothing is auto-resolved.
    expect(resolveEnemyTurns(start)).toBe(start);
  });

  it("is a no-op once the battle has resolved (same reference)", () => {
    const won = battle([mk("hero")], [mk("goon", { hp: 0 })], { phase: "won" });
    expect(resolveEnemyTurns(won)).toBe(won);
  });

  it("resolves several simultaneously-ready enemies in one pass", () => {
    const start = battle(
      [mk("hero", { hp: 200, spd: 1 })],
      [
        mk("a", { pow: 10, spd: 9, atb: 100 }),
        mk("b", { pow: 10, spd: 8, atb: 100 }),
      ]
    );
    const after = resolveEnemyTurns(start);
    expect(after.enemies[0]?.atb).toBe(0);
    expect(after.enemies[1]?.atb).toBe(0);
    expect(after.party[0]?.hp).toBeLessThan(200);
  });

  it("targets the next living party member when the front one is down", () => {
    const start = battle(
      [mk("down", { hp: 0, spd: 1 }), mk("alive", { hp: 100, spd: 1 })],
      [mk("goon", { pow: 20, spd: 10, atb: 100 })]
    );
    const after = resolveEnemyTurns(start);
    expect(after.party[0]?.hp).toBe(0); // untouched corpse
    expect(after.party[1]?.hp).toBeLessThan(100); // the living member was hit
  });
});

describe("runToNextDecision — fill to the next player turn (no deadlock)", () => {
  it("advances a fresh canonical battle to a ready PARTY member, never stalling on an enemy", () => {
    const start = startBattle(
      [PARTY.wren, PARTY.tobi],
      ENCOUNTERS["the-drip"],
      7
    );
    const decision = runToNextDecision(start);
    const actor = nextActor(decision);
    expect(isResolved(decision)).toBe(false);
    expect(actor).not.toBeNull();
    expect(actor?.side).toBe("party");
  });

  it("is deterministic — the same seed yields the same decision state", () => {
    const a = runToNextDecision(
      startBattle([PARTY.wren, PARTY.tobi], ENCOUNTERS["the-drip"], 99)
    );
    const b = runToNextDecision(
      startBattle([PARTY.wren, PARTY.tobi], ENCOUNTERS["the-drip"], 99)
    );
    expect(a).toEqual(b);
  });

  it("never deadlocks: the canonical encounter can be played to a terminal outcome", () => {
    // Drive the real encounter with a high-damage Strike each player turn; absent
    // enemy-turn resolution the ATB would freeze the instant an enemy filled and
    // the loop below would spin to its guard. It reaches `won` in a few turns.
    let state = startBattle(
      [PARTY.wren, PARTY.tobi],
      ENCOUNTERS["the-drip"],
      3
    );
    for (let turn = 0; turn < 50 && !isResolved(state); turn += 1) {
      state = runToNextDecision(state);
      if (isResolved(state)) {
        break;
      }
      const actor = nextActor(state);
      expect(actor?.side).toBe("party");
      const targetIndex = state.enemies.findIndex(enemy => enemy.hp > 0);
      const action: BattleAction = {
        kind: "craft",
        id: "spark",
        actor: actor ?? { side: "party", index: 0 },
        target: { side: "enemies", index: targetIndex },
      };
      state = step(state, action);
    }
    expect(state.phase).toBe("won");
  });

  it("returns the terminal state untouched once the battle is resolved", () => {
    const lost = battle([mk("hero", { hp: 0 })], [mk("goon")], {
      phase: "lost",
    });
    expect(runToNextDecision(lost)).toBe(lost);
  });
});
