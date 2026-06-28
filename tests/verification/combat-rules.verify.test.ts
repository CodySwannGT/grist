/**
 * Codified verification (UAT) playthrough for the GRIST combat-rules layer
 * (issue #27). This is the deterministic, headless analogue of the Validation
 * Journey: it drives the pure `step` reducer through a scripted battle and
 * asserts the observable state snapshots the journey calls for — Rendering
 * ticking the enemy down each turn, a Rendering-kill denying loot, Pressure
 * building to Break, and Severance enabling the ×2 finisher. The browser-driven
 * played battle over `window.__VERIFY__` lands in #40 once the Battle scene
 * (#38) and the verification bridge exist; this codifies the same assertions at
 * the deterministic logic layer the bridge will read.
 * @module tests/verification/combat-rules.verify
 */
import { describe, expect, it } from "vitest";

import {
  combatantAt,
  hashState,
  lootGristFor,
  severanceAvailable,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
  type Combatant,
  type CombatantRef,
  type Stats,
} from "../../src/logic/combat";
import { ENCOUNTERS, ENEMIES, PARTY } from "../../src/content";

const WREN: CombatantRef = { side: "party", index: 0 };
const FOE: CombatantRef = { side: "enemies", index: 0 };
const SPARK = "spark";
const RENDER = "render";
const TICK: BattleAction = { kind: "tick" };

const ZERO: Stats = {
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
 * Build a combatant with stat and runtime overrides over a zeroed block.
 * @param ref - The content ref.
 * @param stats - Stat overrides.
 * @param over - Runtime-field overrides.
 * @returns A fully-formed combatant.
 */
function combatant(
  ref: string,
  stats: Partial<Stats>,
  over: Partial<Combatant> = {}
): Combatant {
  const merged: Stats = { ...ZERO, ...stats };
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
 * Wrap a Wren actor and a single foe into a battle state with a fixed seed.
 * @param wren - The acting party combatant.
 * @param foe - The enemy combatant.
 * @param seed - The battle seed.
 * @returns A battle state ready for the reducer.
 */
function arena(wren: Combatant, foe: Combatant, seed = 0xc0ffee): BattleState {
  return {
    party: [wren],
    enemies: [foe],
    grist: 0,
    seed,
    rngState: seed,
    tick: 0,
    phase: "select",
    log: [],
  };
}

/**
 * Read the combatant a ref points at, throwing when absent.
 * @param state - The battle state.
 * @param ref - The combatant ref.
 * @returns The combatant.
 */
function at(state: BattleState, ref: CombatantRef): Combatant {
  const found = combatantAt(state, ref);
  if (!found) {
    throw new Error(`no combatant at ${ref.side}#${ref.index}`);
  }
  return found;
}

/**
 * The Rendering per-tick magnitude a combatant currently carries (0 if none).
 * @param combatant - The combatant to inspect.
 * @returns The Rendering DoT, or 0.
 */
function renderingPower(combatant: Combatant): number {
  return (
    combatant.statuses.find(status => status.id === "rendering")?.power ?? 0
  );
}

describe("GRIST combat rules — codified played-battle (verification)", () => {
  it("[EVIDENCE: rendering-ticks] Rendering ticks the enemy down each turn", () => {
    // Wren casts Render on a construct hardy enough to survive the direct hit,
    // then time passes (ATB ticks) and the DoT chips it down.
    const construct = combatant("render-construct", { hp: 200, wrd: 6 });
    // Ample AP so the Craft is affordable (#36); this test isolates the DoT.
    // Wren is a live actor (positive HP) so the party is not wiped: the battle
    // stays live across the Rendering ticks rather than resolving to a loss.
    let state = arena(
      combatant("wren", { hp: 100, foc: 10, spd: 0, ap: 100 }),
      construct
    );
    state = step(state, {
      kind: "craft",
      id: RENDER,
      actor: WREN,
      target: FOE,
    });

    const afterCast = at(state, FOE);
    const dot = renderingPower(afterCast);
    expect(dot).toBeGreaterThan(0); // Rendering landed, carrying its per-tick DoT.

    // Snapshot HP and the status timer down each of the 3 Rendering turns.
    const hpTrail = [afterCast.hp];
    const turnTrail: number[] = [];
    for (let turn = 0; turn < 3; turn++) {
      state = step(state, TICK);
      hpTrail.push(at(state, FOE).hp);
      turnTrail.push(
        at(state, FOE).statuses.find(s => s.id === "rendering")?.turns ?? 0
      );
    }
    // HP strictly drops by exactly the DoT each turn; the timer counts 2→1→0 (gone).
    expect(hpTrail).toEqual([
      afterCast.hp,
      afterCast.hp - dot,
      afterCast.hp - 2 * dot,
      afterCast.hp - 3 * dot,
    ]);
    expect(turnTrail).toEqual([2, 1, 0]);
    expect(renderingPower(at(state, FOE))).toBe(0); // expired after its turns.
  });

  it("[EVIDENCE: rendering-kill-loot-denied] a Rendering kill grants no loot", () => {
    // A scrapper low enough that a Rendering tick lands the killing blow.
    const scrapper = combatant("marrow-scrapper", { hp: 40 }, { hp: 4 });
    const withDot: Combatant = {
      ...scrapper,
      statuses: [{ id: "rendering", turns: 3, power: 8 }],
    };
    const before = arena(combatant("wren", { spd: 0 }), withDot);
    const after = step(before, TICK);

    const corpse = at(after, FOE);
    expect(corpse.hp).toBe(0); // the DoT killed it.
    expect(corpse.spent).toBe(true); // marked spent by the Rendering kill.
    expect(lootGristFor(corpse)).toBe(0); // loot denied…
    // …whereas the same enemy felled by a normal blow yields its loot.
    expect(lootGristFor({ ...corpse, spent: false })).toBe(
      ENEMIES["marrow-scrapper"].lootGrist
    );
  });

  it("[EVIDENCE: overkill-log] a lethal hit logs the applied HP loss, not the raw hit", () => {
    // A big Strike into a 1-HP foe: the logged damage is the HP actually lost (1),
    // never the larger raw formula result (BattleEvent.damage contract).
    const foe = combatant("marrow-scrapper", { hp: 40 }, { hp: 1 });
    const after = step(arena(combatant("wren", { pow: 40 }), foe), {
      kind: "strike",
      actor: WREN,
      target: FOE,
    });
    expect(at(after, FOE).hp).toBe(0);
    expect(after.log.at(-1)?.damage).toBe(1);
  });

  it("[EVIDENCE: break-severance] Pressure builds to Break, enabling the ×2 finisher", () => {
    // A Flux-weak boss tanky enough to survive while Pressure accumulates.
    const boss = combatant("the-ashling", { hp: 100000, wrd: 100000, def: 0 });
    const flux: BattleAction = {
      kind: "craft",
      id: SPARK,
      actor: WREN,
      target: FOE,
    };
    // Ample AP so both Sparks are affordable (#36); this test isolates Break.
    // Wren stays alive (positive HP) so the party is not wiped while Pressure
    // accumulates over the two Sparks.
    let state = arena(
      combatant("wren", { hp: 100, foc: 10, pow: 40, ap: 100 }),
      boss
    );

    state = step(state, flux);
    expect(at(state, FOE).broken).toBe(false); // one weakness hit: not yet Broken.
    expect(severanceAvailable(at(state, FOE))).toBe(false);

    state = step(state, flux);
    expect(at(state, FOE).broken).toBe(true); // threshold crossed → Broken.
    expect(severanceAvailable(at(state, FOE))).toBe(true); // Severance unlocked.

    // The Severance window doubles the finisher: compare the Strike on the Broken
    // boss to the same Strike on an un-Broken copy that shares this exact RNG
    // state, so only the pressure multiplier differs (±1 is integer rounding).
    const strike: BattleAction = { kind: "strike", actor: WREN, target: FOE };
    const brokenFoe = at(state, FOE);
    const calm: BattleState = {
      ...state,
      enemies: [{ ...brokenFoe, broken: false }],
    };
    const calmDmg = brokenFoe.hp - at(step(calm, strike), FOE).hp;
    const brokenDmg = brokenFoe.hp - at(step(state, strike), FOE).hp;
    expect(calmDmg).toBeGreaterThan(0);
    expect(Math.abs(brokenDmg - 2 * calmDmg)).toBeLessThanOrEqual(1);
  });

  it("[EVIDENCE: determinism] the played battle is reproducible per seed", () => {
    const script: readonly BattleAction[] = [
      { kind: "craft", id: RENDER, actor: WREN, target: FOE },
      TICK,
      { kind: "craft", id: SPARK, actor: WREN, target: FOE },
      TICK,
      { kind: "strike", actor: WREN, target: FOE },
      TICK,
    ];
    const play = (seed: number): string[] => {
      let state = arena(
        // Ample AP so the Render + Spark casts resolve (#36), and positive HP so
        // Wren survives the whole script — otherwise a wiped party would resolve
        // the battle to a loss and the later actions would no-op against it.
        combatant("wren", { hp: 100, foc: 12, pow: 16, lck: 8, ap: 100 }),
        combatant("render-construct", { hp: 400, wrd: 6 }),
        seed
      );
      const hashes: string[] = [];
      for (const action of script) {
        state = step(state, action);
        hashes.push(hashState(state));
      }
      return hashes;
    };
    expect(play(0xabc123)).toEqual(play(0xabc123)); // same seed → same battle.
    expect(play(1)).not.toEqual(play(2)); // RNG truly threads through state.
  });
});

// Smoke: the canonical content battle still starts (the layer wires to content).
describe("content wiring", () => {
  it("starts the Drip battle from real party + encounter content", () => {
    const state = startBattle([PARTY.wren], ENCOUNTERS["the-drip"], 1);
    expect(state.enemies).toHaveLength(2);
    expect(at(state, FOE).spent).toBe(false);
  });
});
