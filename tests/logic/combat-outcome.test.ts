import { describe, expect, it } from "vitest";

import {
  isDefeat,
  isDefeated,
  isResolved,
  isVictory,
  resolveOutcome,
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
  readonly def?: number;
  readonly spd?: number;
  readonly atb?: number;
}

/**
 * Build a synthetic combatant with full control over current HP and the few
 * stats the outcome tests exercise (POW/DEF drive a guaranteed-lethal Strike).
 * @param ref - The content ref.
 * @param opts - HP / stat overrides.
 * @returns A combatant.
 */
function mk(ref: string, opts: MkOpts = {}): Combatant {
  const { hp = 100, pow = 0, def = 0, spd = 10, atb = 0 } = opts;
  return {
    ref,
    stats: { hp: 100, ap: 0, pow, foc: 0, def, wrd: 0, spd, lck: 0 },
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
 * @param over - State field overrides (e.g. a terminal `phase`).
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

const HERO = { side: "party", index: 0 } as const;
const FOE = { side: "enemies", index: 0 } as const;

describe("victory — all enemies defeated (AC: victory predicate)", () => {
  it("reaches the won phase when a Strike defeats the last living enemy", () => {
    const state = battle([mk("hero", { pow: 50 })], [mk("goon", { hp: 1 })]);
    const next = step(state, { kind: "strike", actor: HERO, target: FOE });
    expect(next.enemies[0]?.hp).toBe(0);
    expect(next.phase).toBe("won");
  });

  it("stays live (select) while any enemy still survives", () => {
    const state = battle(
      [mk("hero", { pow: 50 })],
      [mk("dying", { hp: 1 }), mk("survivor", { hp: 99 })]
    );
    const next = step(state, { kind: "strike", actor: HERO, target: FOE });
    expect(next.enemies[0]?.hp).toBe(0);
    expect(next.enemies[1]?.hp).toBe(99);
    expect(next.phase).toBe("select");
  });

  it("resolves victory on a tick when a Rendering DoT kills the last enemy", () => {
    const dying: Combatant = {
      ...mk("goon", { hp: 1 }),
      statuses: [{ id: "rendering", turns: 2, power: 5 }],
    };
    const next = step(battle([mk("hero")], [dying]), { kind: "tick" });
    expect(next.enemies[0]?.hp).toBe(0);
    expect(next.phase).toBe("won");
  });
});

describe("defeat — party wipe (AC: defeat predicate)", () => {
  it("reaches the lost phase when a Strike defeats the last living party member", () => {
    const state = battle([mk("hero", { hp: 1 })], [mk("goon", { pow: 50 })]);
    const next = step(state, { kind: "strike", actor: FOE, target: HERO });
    expect(next.party[0]?.hp).toBe(0);
    expect(next.phase).toBe("lost");
  });

  it("stays live (select) while any party member still survives", () => {
    const state = battle(
      [mk("dying", { hp: 1 }), mk("survivor", { hp: 99 })],
      [mk("goon", { pow: 50 })]
    );
    const next = step(state, { kind: "strike", actor: FOE, target: HERO });
    expect(next.party[0]?.hp).toBe(0);
    expect(next.party[1]?.hp).toBe(99);
    expect(next.phase).toBe("select");
  });

  it("treats a simultaneous mutual wipe as defeat (survival is required to win)", () => {
    const next = step(
      battle([mk("hero", { hp: 0 })], [mk("goon", { hp: 0 })]),
      {
        kind: "tick",
      }
    );
    expect(next.phase).toBe("lost");
    expect(isDefeat(next)).toBe(true);
    expect(isVictory(next)).toBe(false);
  });
});

describe("a resolved battle rejects further actions (AC: terminal guard)", () => {
  const won = battle([mk("hero", { pow: 50 })], [mk("goon", { hp: 0 })], {
    phase: "won",
  });
  const lost = battle([mk("hero", { hp: 0 })], [mk("goon", { pow: 50 })], {
    phase: "lost",
  });

  it("returns the won state unchanged for an acting turn (same reference)", () => {
    const action: BattleAction = { kind: "strike", actor: HERO, target: FOE };
    expect(step(won, action)).toBe(won);
  });

  it("returns the lost state unchanged for an acting turn (same reference)", () => {
    const action: BattleAction = { kind: "strike", actor: FOE, target: HERO };
    expect(step(lost, action)).toBe(lost);
  });

  it("rejects even a tick once resolved, holding the terminal state stable", () => {
    expect(step(won, { kind: "tick" })).toBe(won);
    expect(step(lost, { kind: "tick" })).toBe(lost);
  });
});

describe("outcome predicates are pure functions of state", () => {
  it("isDefeated is true exactly when HP has reached 0", () => {
    expect(isDefeated(mk("x", { hp: 0 }))).toBe(true);
    expect(isDefeated(mk("x", { hp: 1 }))).toBe(false);
  });

  it("isVictory requires every enemy defeated and a surviving party", () => {
    expect(isVictory(battle([mk("h")], [mk("e", { hp: 0 })]))).toBe(true);
    expect(isVictory(battle([mk("h")], [mk("e", { hp: 1 })]))).toBe(false);
    // A mutual wipe is not a victory — defeat dominates.
    expect(isVictory(battle([mk("h", { hp: 0 })], [mk("e", { hp: 0 })]))).toBe(
      false
    );
  });

  it("isDefeat requires the whole party defeated", () => {
    expect(
      isDefeat(battle([mk("a", { hp: 0 }), mk("b", { hp: 0 })], [mk("e")]))
    ).toBe(true);
    expect(
      isDefeat(battle([mk("a", { hp: 0 }), mk("b", { hp: 5 })], [mk("e")]))
    ).toBe(false);
  });

  it("isResolved is true only in a terminal phase", () => {
    expect(isResolved(battle([mk("h")], [mk("e")], { phase: "won" }))).toBe(
      true
    );
    expect(isResolved(battle([mk("h")], [mk("e")], { phase: "lost" }))).toBe(
      true
    );
    expect(isResolved(battle([mk("h")], [mk("e")], { phase: "select" }))).toBe(
      false
    );
  });

  it("resolveOutcome leaves a live battle untouched (same reference, RNG intact)", () => {
    const live = battle([mk("h")], [mk("e", { hp: 5 })], { rngState: 42 });
    const out = resolveOutcome(live);
    expect(out).toBe(live);
    expect(out.rngState).toBe(42);
  });

  it("resolveOutcome sets won/lost without consuming the RNG", () => {
    const win = battle([mk("h")], [mk("e", { hp: 0 })], { rngState: 42 });
    expect(resolveOutcome(win).phase).toBe("won");
    expect(resolveOutcome(win).rngState).toBe(42);
    const wipe = battle([mk("h", { hp: 0 })], [mk("e")], { rngState: 42 });
    expect(resolveOutcome(wipe).phase).toBe("lost");
    expect(resolveOutcome(wipe).rngState).toBe(42);
  });
});

describe("integration with the real content + reducer", () => {
  it("a freshly started canonical battle is live, and a tick never resolves it", () => {
    const start = startBattle(
      [PARTY.wren, PARTY.tobi],
      ENCOUNTERS["the-drip"],
      7
    );
    expect(isResolved(start)).toBe(false);
    expect(start.phase).toBe("select");
    expect(step(start, { kind: "tick" }).phase).toBe("select");
  });
});
