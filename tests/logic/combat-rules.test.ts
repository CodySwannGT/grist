import { describe, expect, it } from "vitest";

import {
  CombatTuning,
  addPressure,
  applyRendering,
  combatantAt,
  computeDamage,
  computeHeal,
  computeRenderingTick,
  elementMultiplier,
  lootGristFor,
  severanceAvailable,
  startBattle,
  step,
  tickStatuses,
  varianceFromRoll,
  type BattleState,
  type Combatant,
  type CombatantRef,
  type Stats,
} from "../../src/logic/combat";
import { ENCOUNTERS, ENEMIES, PARTY, SPELLS } from "../../src/content";

const WREN: CombatantRef = { side: "party", index: 0 };
const ENEMY: CombatantRef = { side: "enemies", index: 0 };
const ASHLING = "the-ashling"; // Flux-weak boss ref (for survivable status/pressure tests)

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
 * @param ref - The content ref.
 * @param stats - Stat overrides merged onto a zeroed block.
 * @param over - Runtime-field overrides (hp, statuses, pressure, ...).
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
 * Wrap a party actor and an enemy into a minimal battle state.
 * @param party - The party combatants.
 * @param enemies - The enemy combatants.
 * @param seed - The battle seed.
 * @returns A battle state ready for the reducer.
 */
function battle(
  party: readonly Combatant[],
  enemies: readonly Combatant[],
  seed = 1
): BattleState {
  return {
    party,
    enemies,
    grist: 0,
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

describe("damage / heal formula (AC: matches combat-spec)", () => {
  it("applies attacker stat, skill power, and DEF mitigation", () => {
    // base = 10*10 = 100; mitigated = 100 * 100/(100+0) = 100; ×1×1×1×1 = 100.
    expect(
      computeDamage({
        attackerStat: 10,
        skillPower: 10,
        defStat: 0,
        elementMod: 1,
        critMod: 1,
        variance: 1,
        pressureMod: 1,
      })
    ).toBe(100);
    // DEF 100 halves the hit: 100 * 100/200 = 50.
    expect(
      computeDamage({
        attackerStat: 10,
        skillPower: 10,
        defStat: 100,
        elementMod: 1,
        critMod: 1,
        variance: 1,
        pressureMod: 1,
      })
    ).toBe(50);
  });

  it("multiplies element, crit, variance, and pressure into the final", () => {
    const base = {
      attackerStat: 10,
      skillPower: 10,
      defStat: 0,
      elementMod: 1,
      critMod: 1,
      variance: 1,
      pressureMod: 1,
    };
    expect(computeDamage({ ...base, elementMod: 1.5 })).toBe(150);
    expect(
      computeDamage({ ...base, critMod: CombatTuning.critMultiplier })
    ).toBe(150);
    expect(
      computeDamage({ ...base, pressureMod: CombatTuning.brokenPressureMod })
    ).toBe(200);
    expect(computeDamage({ ...base, elementMod: 0 })).toBe(0); // immune
  });

  it("heals FOC-based with no DEF mitigation", () => {
    expect(computeHeal({ foc: 10, power: 10, variance: 1 })).toBe(100);
    expect(
      computeHeal({ foc: 10, power: 10, variance: CombatTuning.varianceMin })
    ).toBe(95);
  });

  it("maps a [0,1) roll to the variance band", () => {
    expect(varianceFromRoll(0)).toBe(CombatTuning.varianceMin);
    expect(varianceFromRoll(0.5)).toBeCloseTo(1, 10);
  });
});

describe("Flux element multiplier (AC: weakness and resistance)", () => {
  it("reads weakness, resistance, immunity, and neutral from the table", () => {
    expect(
      elementMultiplier(ENEMIES["render-construct"].elements, "flux")
    ).toBe(1.5);
    expect(elementMultiplier({ flux: 0.5 }, "flux")).toBe(0.5);
    expect(elementMultiplier({ flux: 0 }, "flux")).toBe(0);
    // An omitted element is neutral (×1).
    expect(
      elementMultiplier(ENEMIES["render-construct"].elements, "iron")
    ).toBe(CombatTuning.neutralElement);
  });

  it("makes a Flux hit on a weak target hit harder than a neutral one", () => {
    const construct = ENEMIES["render-construct"];
    // defStat 0 keeps the pre-round base integral, so the ×1.5 weakness factor
    // is exact (no brittle double-rounding of an already-rounded hit).
    const base = {
      attackerStat: 10,
      skillPower: SPELLS.spark.power,
      defStat: 0,
      critMod: 1,
      variance: 1,
      pressureMod: 1,
    };
    const fluxMod = elementMultiplier(construct.elements, SPELLS.spark.element);
    const weak = computeDamage({ ...base, elementMod: fluxMod });
    const neutral = computeDamage({ ...base, elementMod: 1 });
    expect(fluxMod).toBe(1.5);
    expect(weak).toBe(neutral * 1.5);
  });
});

describe("Rendering status (AC: applies and ticks each turn)", () => {
  it("applyRendering attaches a DoT status carrying its per-tick power", () => {
    const target = applyRendering(combatant("x", { hp: 50 }), 8, 3);
    expect(target.statuses).toEqual([{ id: "rendering", turns: 3, power: 8 }]);
  });

  it("computeRenderingTick derives the per-tick DoT from FOC and power", () => {
    expect(computeRenderingTick({ foc: 10, power: 8 })).toBe(
      Math.max(1, Math.round(10 * 8 * CombatTuning.renderingDotCoefficient))
    );
  });

  it("tickStatuses subtracts the DoT and decrements the timer", () => {
    const afflicted = applyRendering(combatant("x", { hp: 50 }), 8, 3);
    const after = tickStatuses(afflicted);
    expect(after.hp).toBe(42);
    expect(after.statuses).toEqual([{ id: "rendering", turns: 2, power: 8 }]);
  });

  it("expires a status when its timer runs out", () => {
    const afflicted = applyRendering(combatant("x", { hp: 50 }), 8, 1);
    expect(tickStatuses(afflicted).statuses).toEqual([]);
  });

  it("ticks Rendering through the reducer on each ATB tick", () => {
    const enemy = applyRendering(
      combatant("render-construct", { hp: 70 }),
      8,
      3
    );
    const start = battle([combatant("wren", { spd: 0 })], [enemy]);
    const after = step(start, { kind: "tick" });
    expect(get(after, ENEMY).hp).toBe(62);
  });

  it("a craft with the render spell applies Rendering and adds pressure", () => {
    const wren = combatant("wren", { foc: 10 });
    // High WRD + HP so the boss survives and we isolate status + pressure.
    const boss = combatant(ASHLING, { hp: 100000, wrd: 100000 });
    const start = battle([wren], [boss]);
    const after = step(start, {
      kind: "craft",
      id: SPELLS.render.id,
      actor: WREN,
      target: ENEMY,
    });
    const hit = get(after, ENEMY);
    expect(hit.statuses).toEqual([
      { id: "rendering", turns: CombatTuning.renderingTurns, power: 8 },
    ]);
    expect(hit.pressure).toBe(CombatTuning.pressureOnStatus);
  });
});

describe("Rendering-kill denies loot (AC)", () => {
  it("a normal corpse yields enemy loot; party/unknown refs yield none", () => {
    const dead = combatant("marrow-scrapper", { hp: 40 }, { hp: 0 });
    expect(lootGristFor(dead)).toBe(ENEMIES["marrow-scrapper"].lootGrist);
    expect(lootGristFor(combatant("wren", { hp: 1 }, { hp: 0 }))).toBe(0);
  });

  it("a Rendering tick that lands the kill marks the corpse spent → no loot", () => {
    const enemy = applyRendering(
      combatant("marrow-scrapper", { hp: 40 }, { hp: 5 }),
      8,
      3
    );
    const start = battle([combatant("wren", { spd: 0 })], [enemy]);
    const after = step(start, { kind: "tick" });
    const corpse = get(after, ENEMY);
    expect(corpse.hp).toBe(0);
    expect(corpse.spent).toBe(true);
    expect(lootGristFor(corpse)).toBe(0);
  });
});

describe("Pressure → Break → Severance (AC)", () => {
  it("accumulates pressure and breaks at the threshold", () => {
    const fresh = combatant("x", { hp: 100 });
    const once = addPressure(fresh, CombatTuning.pressureOnWeakness);
    expect(once.pressure).toBe(CombatTuning.pressureOnWeakness);
    expect(once.broken).toBe(false);
    const twice = addPressure(once, CombatTuning.pressureOnWeakness);
    expect(twice.pressure).toBe(2 * CombatTuning.pressureOnWeakness);
    expect(twice.broken).toBe(true);
  });

  it("enables Severance once broken, not before", () => {
    expect(severanceAvailable(combatant("x", { hp: 1 }))).toBe(false);
    expect(
      severanceAvailable(combatant("x", { hp: 1 }, { broken: true }))
    ).toBe(true);
  });

  it("breaks a weak target across repeated Flux crafts via the reducer", () => {
    const wren = combatant("wren", { foc: 10 });
    const boss = combatant(ASHLING, { hp: 100000, wrd: 100000 });
    const start = battle([wren], [boss]);
    const craft = {
      kind: "craft" as const,
      id: SPELLS.spark.id,
      actor: WREN,
      target: ENEMY,
    };
    const once = step(start, craft);
    expect(get(once, ENEMY).pressure).toBe(CombatTuning.pressureOnWeakness);
    expect(get(once, ENEMY).broken).toBe(false);
    const twice = step(once, craft);
    expect(get(twice, ENEMY).broken).toBe(true);
    expect(severanceAvailable(get(twice, ENEMY))).toBe(true);
  });
});

describe("damage resolution through the reducer", () => {
  it("a strike reduces the target HP by the logged damage, deterministically", () => {
    const start = startBattle([PARTY.wren], ENCOUNTERS["the-drip"], 7);
    const action = { kind: "strike" as const, actor: WREN, target: ENEMY };
    const after = step(start, action);
    const dealt = get(start, ENEMY).hp - get(after, ENEMY).hp;
    expect(dealt).toBeGreaterThan(0);
    expect(after.log.at(-1)?.damage).toBe(dealt);
    // Same seed → identical resolution.
    const again = step(start, action);
    expect(get(again, ENEMY).hp).toBe(get(after, ENEMY).hp);
  });

  it("a broken target takes more from the same strike (pressure multiplier)", () => {
    const stats = { pow: 40 };
    const calm = battle(
      [combatant("wren", stats)],
      [combatant(ASHLING, { hp: 10000, def: 0 })],
      3
    );
    const broken = battle(
      [combatant("wren", stats)],
      [combatant(ASHLING, { hp: 10000, def: 0 }, { broken: true })],
      3
    );
    const strike = { kind: "strike" as const, actor: WREN, target: ENEMY };
    // Same seed + RNG state in both battles → the strike shares one variance/crit
    // roll, so only the pressure multiplier differs (±1 is integer rounding).
    const calmDmg = get(calm, ENEMY).hp - get(step(calm, strike), ENEMY).hp;
    const brokenDmg =
      get(broken, ENEMY).hp - get(step(broken, strike), ENEMY).hp;
    expect(brokenDmg).toBeGreaterThan(calmDmg);
    expect(
      Math.abs(brokenDmg - calmDmg * CombatTuning.brokenPressureMod)
    ).toBeLessThanOrEqual(1);
  });
});
