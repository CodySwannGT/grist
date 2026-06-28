import { describe, expect, it } from "vitest";

import {
  ResourceTuning,
  actionCost,
  canAfford,
  combatantAt,
  hashState,
  regenAp,
  step,
  type BattleAction,
  type BattleState,
  type Combatant,
  type CombatantRef,
  type Stats,
} from "../../src/logic/combat";
import { BOUNDS, SPELLS, SpellIds } from "../../src/content";

const WREN: CombatantRef = { side: "party", index: 0 };
const TOBI: CombatantRef = { side: "party", index: 1 };
const ENEMY: CombatantRef = { side: "enemies", index: 0 };

const SPARK = SPELLS[SpellIds.spark];
const BIND_WISP = BOUNDS.emberwisp.bind; // Flux Bind: AP 0, grist 8.

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
 * Build a combatant with explicit stat and runtime overrides over a zeroed block.
 * @param ref - The content ref.
 * @param stats - Stat overrides merged onto a zeroed block (stats.ap is max AP).
 * @param over - Runtime-field overrides (hp, ap, atb, ...).
 * @returns A fully-formed combatant.
 */
function combatant(
  ref: string,
  stats: Partial<Stats>,
  over: Partial<Combatant> = {}
): Combatant {
  const merged: Stats = { ...ZERO_STATS, ...stats };
  return {
    ref,
    stats: merged,
    hp: merged.hp,
    ap: merged.ap,
    atb: 0,
    statuses: [],
    pressure: 0,
    broken: false,
    spent: false,
    ...over,
  };
}

/**
 * Wrap party + enemy combatants into a battle state with a seed and a shared
 * grist pool.
 * @param party - The party combatants.
 * @param enemies - The enemy combatants.
 * @param seed - The battle seed.
 * @param grist - The shared party grist pool.
 * @returns A battle state ready for the reducer.
 */
function arena(
  party: readonly Combatant[],
  enemies: readonly Combatant[],
  seed = 1,
  grist = 0
): BattleState {
  return {
    party,
    enemies,
    grist,
    seed,
    rngState: seed,
    tick: 0,
    phase: "select",
    log: [],
  };
}

/**
 * Fetch the combatant a ref points at, throwing if absent (test-only helper).
 * @param state - The battle state.
 * @param ref - The combatant ref.
 * @returns The combatant.
 */
function get(state: BattleState, ref: CombatantRef): Combatant {
  const found = combatantAt(state, ref);
  if (!found) {
    throw new Error(`no combatant at ${ref.side}#${ref.index}`);
  }
  return found;
}

describe("AP (Anima) regenerates per turn (AC: AP regen)", () => {
  it("regenAp adds the configured amount, clamped to the combatant's max AP", () => {
    const below = combatant("x", { ap: 20 }, { ap: 5 });
    expect(regenAp(below).ap).toBe(
      Math.min(5 + ResourceTuning.apRegenPerTurn, 20)
    );
    // At max, regen is a no-op and the same object is returned (structural share).
    const full = combatant("x", { ap: 20 }, { ap: 20 });
    expect(regenAp(full)).toBe(full);
    // Never overshoots the max even when a step would exceed it.
    const nearMax = combatant("x", { ap: 20 }, { ap: 19 });
    expect(regenAp(nearMax).ap).toBe(20);
  });

  it("a turn (ATB tick) regenerates a below-max actor's AP, clamped to max", () => {
    const start = arena(
      [combatant("wren", { ap: 20, spd: 0 }, { ap: 4 })],
      [combatant("foe", { hp: 10 })]
    );
    const after = step(start, { kind: "tick" });
    expect(get(after, WREN).ap).toBe(
      Math.min(4 + ResourceTuning.apRegenPerTurn, 20)
    );
  });

  it("a full-AP combatant stays at max across a tick (no overshoot)", () => {
    const start = arena(
      [combatant("wren", { ap: 20, spd: 0 }, { ap: 20 })],
      [combatant("foe", { hp: 10 })]
    );
    expect(get(step(start, { kind: "tick" }), WREN).ap).toBe(20);
  });

  it("AP regen on a tick consumes no RNG (the tick stays deterministic)", () => {
    const start = arena([combatant("wren", { ap: 20 }, { ap: 4 })], []);
    expect(step(start, { kind: "tick" }).rngState).toBe(start.rngState);
  });
});

describe("Craft spends AP (AC: cast reduces AP by the spell cost)", () => {
  it("casting a Craft reduces the actor's AP by the spell's apCost and lands", () => {
    const start = arena(
      [combatant("wren", { ap: 20, foc: 10 }, { ap: 20 })],
      [combatant("foe", { hp: 1000 })]
    );
    const after = step(start, {
      kind: "craft",
      id: SPARK.id,
      actor: WREN,
      target: ENEMY,
    });
    expect(get(after, WREN).ap).toBe(20 - SPARK.apCost);
    // The cast actually resolved: the target took damage and the RNG advanced.
    expect(get(after, ENEMY).hp).toBeLessThan(get(start, ENEMY).hp);
    expect(after.rngState).not.toBe(start.rngState);
  });
});

describe("Craft is blocked when AP is insufficient (AC: cast blocked, AP unchanged)", () => {
  it("a craft the actor cannot afford is a no-op: AP unchanged, no damage", () => {
    const start = arena(
      [combatant("wren", { ap: 20, foc: 10 }, { ap: SPARK.apCost - 1 })],
      [combatant("foe", { hp: 1000 })]
    );
    const after = step(start, {
      kind: "craft",
      id: SPARK.id,
      actor: WREN,
      target: ENEMY,
    });
    // Blocked: the reducer returns the input state untouched (AP + target + RNG).
    expect(after).toBe(start);
    expect(get(after, WREN).ap).toBe(SPARK.apCost - 1);
    expect(get(after, ENEMY).hp).toBe(1000);
  });
});

describe("Bind spends grist from the shared pool (AC: Bind reduces the pool)", () => {
  it("using Bind reduces the shared grist pool by the bind's gristCost", () => {
    const start = arena(
      [combatant("wren", { ap: 20 }, { ap: 20, atb: 100 })],
      [combatant("foe", { hp: 50 })],
      1,
      20
    );
    const after = step(start, {
      kind: "bind",
      id: BIND_WISP.id,
      actor: WREN,
    });
    expect(after.grist).toBe(20 - (BIND_WISP.gristCost ?? 0));
    // The actor spent its turn (gauge reset); a free-AP Bind leaves AP untouched.
    expect(get(after, WREN).atb).toBe(0);
    expect(get(after, WREN).ap).toBe(20);
  });

  it("the grist pool is a single shared wallet drawn by any party member", () => {
    const start = arena(
      [
        combatant("wren", { ap: 20 }, { ap: 20 }),
        combatant("tobi", { ap: 20 }, { ap: 20 }),
      ],
      [combatant("foe", { hp: 50 })],
      1,
      20
    );
    const bind = (state: BattleState, actor: CombatantRef): BattleState =>
      step(state, { kind: "bind", id: BIND_WISP.id, actor });
    const cost = BIND_WISP.gristCost ?? 0;
    const afterWren = bind(start, WREN); // 20 - 8 = 12
    expect(afterWren.grist).toBe(20 - cost);
    const afterTobi = bind(afterWren, TOBI); // 12 - 8 = 4, same pool
    expect(afterTobi.grist).toBe(20 - 2 * cost);
    // A third Bind cannot be paid from the shared pool: blocked, pool unchanged.
    expect(bind(afterTobi, WREN)).toBe(afterTobi);
  });
});

describe("Bind is blocked when grist is insufficient (AC: blocked, pool unchanged)", () => {
  it("a Bind the shared pool cannot afford is a no-op: pool unchanged", () => {
    const start = arena(
      [combatant("wren", { ap: 20 }, { ap: 20, atb: 100 })],
      [combatant("foe", { hp: 50 })],
      1,
      (BIND_WISP.gristCost ?? 0) - 1
    );
    const after = step(start, {
      kind: "bind",
      id: BIND_WISP.id,
      actor: WREN,
    });
    expect(after).toBe(start);
    expect(after.grist).toBe((BIND_WISP.gristCost ?? 0) - 1);
    expect(get(after, WREN).atb).toBe(100);
  });
});

describe("actionCost / canAfford (the resource-gate primitives)", () => {
  it("actionCost reads AP from a Craft, grist from a Bind, nothing else", () => {
    expect(actionCost({ kind: "craft", id: SPARK.id })).toEqual({
      ap: SPARK.apCost,
      grist: 0,
    });
    expect(actionCost({ kind: "bind", id: BIND_WISP.id })).toEqual({
      ap: BIND_WISP.apCost,
      grist: BIND_WISP.gristCost ?? 0,
    });
    expect(actionCost({ kind: "strike" })).toEqual({ ap: 0, grist: 0 });
    // An unknown spell/bind id costs nothing (no phantom debit).
    expect(actionCost({ kind: "craft", id: "nope" })).toEqual({
      ap: 0,
      grist: 0,
    });
    expect(actionCost({ kind: "bind" })).toEqual({ ap: 0, grist: 0 });
  });

  it("canAfford gates on BOTH the actor's AP and the shared grist pool", () => {
    expect(canAfford(4, 0, { ap: 4, grist: 0 })).toBe(true);
    expect(canAfford(3, 0, { ap: 4, grist: 0 })).toBe(false);
    expect(canAfford(0, 8, { ap: 0, grist: 8 })).toBe(true);
    expect(canAfford(0, 7, { ap: 0, grist: 8 })).toBe(false);
    // A mixed-cost action needs both resources at once.
    expect(canAfford(4, 7, { ap: 4, grist: 8 })).toBe(false);
  });
});

describe("the two-resource battle is reproducible (determinism)", () => {
  const script: readonly BattleAction[] = [
    { kind: "tick" },
    { kind: "craft", id: SPARK.id, actor: WREN, target: ENEMY },
    { kind: "tick" },
    { kind: "bind", id: BIND_WISP.id, actor: WREN },
    { kind: "strike", actor: WREN, target: ENEMY },
  ];
  const play = (seed: number): string[] => {
    let state = arena(
      [combatant("wren", { ap: 20, foc: 12, pow: 16, lck: 8 }, { ap: 4 })],
      [combatant("render-construct", { hp: 4000, wrd: 6 })],
      seed,
      30
    );
    return script.map(action => {
      state = step(state, action);
      return hashState(state);
    });
  };

  it("yields identical AP/grist progression for the same seed", () => {
    expect(play(0xabc123)).toEqual(play(0xabc123));
  });

  it("diverges for a different seed (RNG threads through the resourced state)", () => {
    expect(play(1)).not.toEqual(play(2));
  });
});
