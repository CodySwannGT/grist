import { describe, expect, it } from "vitest";

import {
  BattleSides,
  isResolved,
  nextActor,
  readyActors,
  resolveEnemyTurns,
  runToNextDecision,
  type BattleState,
  type Combatant,
} from "../../src/logic/combat";

/**
 * #243 — a KO'd party member whose ATB gauge is full must never be treated as a
 * ready actor. Before the fix, `collectReady` mapped any full-gauge combatant to a
 * ready entry regardless of HP, so a downed party member sat at the head of the
 * turn queue: the runner paused waiting for a player command the (hp-gated) HUD
 * would never surface, and `resolveEnemyTurns` bailed on the corpse at the head of
 * the queue — a total, input-dead soft-lock only a reload escaped (the QA repro).
 * These sim-level tests pin the seam: the pure turn-order must skip the dead.
 */

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

describe("#243 — a KO'd party member never soft-locks the turn engine", () => {
  it("excludes a downed party member from the ready queue even with a full gauge", () => {
    // Wren is KO'd (HP 0) but her gauge is full and her SPD is highest — before
    // the fix she would sort to the head of the ready queue as the 'next actor'.
    const start = battle(
      [
        mk("wren", { hp: 0, spd: 20, atb: 100 }),
        mk("tobi", { hp: 140, spd: 10, atb: 100 }),
      ],
      [mk("goon", { hp: 100, spd: 5, atb: 0 })]
    );
    const ready = readyActors(start);
    // The corpse is not ready; the living survivor is the next actor.
    expect(
      ready.some(ref => ref.side === BattleSides.party && ref.index === 0)
    ).toBe(false);
    expect(nextActor(start)).toEqual({ side: BattleSides.party, index: 1 });
  });

  it("hands the turn to the surviving ally when the ready actor is KO'd mid-fight", () => {
    // The exact QA seam: the higher-SPD member is down with a full gauge; the
    // survivor's gauge is still filling and the enemy is idle. The decision-advance
    // must fill on to the LIVING ally's turn, never stall on the corpse.
    const start = battle(
      [
        mk("wren", { hp: 0, spd: 20, atb: 100 }),
        mk("tobi", { hp: 140, spd: 10, atb: 0 }),
      ],
      [mk("goon", { hp: 80, spd: 1, atb: 0 })]
    );
    const next = runToNextDecision(start);
    const actor = nextActor(next);
    // Either the battle resolved, or a *living* party member is up to act — the
    // engine is never parked on the downed member with no way forward.
    expect(
      isResolved(next) ||
        (actor?.side === BattleSides.party &&
          (next.party[actor.index]?.hp ?? 0) > 0)
    ).toBe(true);
    expect(actor).toEqual({ side: BattleSides.party, index: 1 });
  });

  it("does not let a downed party member at the head of the queue block enemy turns", () => {
    // Wren (down, full gauge, top SPD) must not shield the party: the ready enemy
    // has to be able to act. Pre-fix, the corpse sat at the head and resolveEnemyTurns
    // returned untouched — the enemy never struck.
    const start = battle(
      [
        mk("wren", { hp: 0, spd: 20, atb: 100 }),
        mk("tobi", { hp: 140, spd: 10, atb: 0 }),
      ],
      [mk("goon", { hp: 80, pow: 20, spd: 5, atb: 100 })]
    );
    const after = resolveEnemyTurns(start);
    expect(after.enemies[0]?.atb).toBe(0); // the enemy acted
    expect(after.party[1]?.hp).toBeLessThan(140); // and struck the survivor
  });

  it("routes a full-party wipe to Defeat instead of freezing (region-play case)", () => {
    // Wren is already down; the survivor is on the brink and a ready enemy finishes
    // the party. The decision-advance must resolve the battle to 'lost' — the Defeat
    // path — rather than deadlock on the first corpse.
    const start = battle(
      [
        mk("wren", { hp: 0, spd: 20, atb: 100 }),
        mk("tobi", { hp: 5, spd: 1, atb: 0 }),
      ],
      [mk("goon", { hp: 80, pow: 50, spd: 10, atb: 100 })]
    );
    const out = runToNextDecision(start);
    expect(isResolved(out)).toBe(true);
    expect(out.phase).toBe("lost");
  });
});
