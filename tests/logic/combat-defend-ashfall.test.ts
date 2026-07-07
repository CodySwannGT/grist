/**
 * Coverage for the two combat-engine changes the #266 balance pass introduced:
 *  1. The **Defend guard** — a combatant that spends its turn on `defend` is
 *     Guarding, so the next incoming hit is mitigated by
 *     {@link CombatTuning.guardMod}; the guard is set on Defend and cleared the
 *     instant the combatant next acts.
 *  2. **Ashfall-aware {@link startBattle}** — fielding an encounter under the
 *     `ashfall` world-state builds enemies from their warped #141 variant stat
 *     blocks (harsher HP/POW) instead of the base blocks, so the same encounter
 *     genuinely bites harder after the Reckoning. `reach` (the default) is
 *     unchanged.
 * @module tests/logic/combat-defend-ashfall.test
 */
import { describe, expect, it } from "vitest";

import {
  guardMod,
  startBattle,
  step,
  type BattleState,
  type Combatant,
} from "../../src/logic/combat";
import { ENCOUNTERS, PARTY, type PartyMemberDef } from "../../src/content";

const ENEMY0 = { side: "enemies", index: 0 } as const;
const WREN = { side: "party", index: 0 } as const;

/**
 * A fixed, generous Wren-like stat block (LCK 0 ⇒ no crit; HP high ⇒ no overkill).
 * @returns The test stat block.
 */
function partyStats() {
  return {
    hp: 400,
    ap: 20,
    pow: 18,
    foc: 10,
    def: 10,
    wrd: 8,
    spd: 14,
    lck: 0,
  };
}

/**
 * A single-member party: Wren re-statted to the generous test block.
 * @returns A one-member party for the guard/startBattle tests.
 */
function tankParty(): readonly PartyMemberDef[] {
  return [{ ...PARTY.wren, baseStats: partyStats() }];
}

/**
 * Field the two-foe Marrow encounter under a seed + world-state.
 * @param seed - The 32-bit battle seed.
 * @param world - The world-state to field (`reach` or `ashfall`).
 * @returns The initial battle state.
 */
function drip(seed: number, world: "reach" | "ashfall"): BattleState {
  return startBattle(tankParty(), ENCOUNTERS["the-drip"], seed, world);
}

/**
 * The HP the enemy's Strike took off Wren between two states.
 * @param before - The pre-strike state.
 * @param after - The post-strike state.
 * @returns The HP lost by Wren (party index 0).
 */
function damageTaken(before: BattleState, after: BattleState): number {
  return (before.party[0]?.hp ?? 0) - (after.party[0]?.hp ?? 0);
}

describe("Defend guard — bracing mitigates the next incoming hit", () => {
  it("exposes a guard multiplier below 1 only while Guarding", () => {
    expect(guardMod(true)).toBeLessThan(1);
    expect(guardMod(false)).toBe(1);
  });

  it("halves an identical enemy Strike when the target is Guarding", () => {
    // LCK 0 ⇒ no crit branch, so the only difference between the two runs is the
    // guard flag; the shared rngState makes the variance roll identical.
    const base = drip(0x51a1, "reach");
    const guarding: BattleState = {
      ...base,
      party: base.party.map((c, i): Combatant =>
        i === 0 ? { ...c, defending: true } : c
      ),
    };
    const openStrike = step(base, {
      kind: "strike",
      actor: ENEMY0,
      target: WREN,
    });
    const guardedStrike = step(guarding, {
      kind: "strike",
      actor: ENEMY0,
      target: WREN,
    });
    const open = damageTaken(base, openStrike);
    const guarded = damageTaken(guarding, guardedStrike);
    expect(open).toBeGreaterThan(0);
    expect(guarded).toBeGreaterThan(0);
    expect(guarded).toBeLessThan(open);
    // ~half, within integer rounding.
    expect(guarded).toBeLessThanOrEqual(Math.round(open * 0.5) + 1);
  });

  it("sets the guard on Defend and clears it the moment the actor next acts", () => {
    const s = drip(7, "reach");
    const defended = step(s, { kind: "defend", actor: WREN });
    expect(defended.party[0]?.defending).toBe(true);
    // Acting again (a Strike) ends the guard.
    const acted = step(defended, {
      kind: "strike",
      actor: WREN,
      target: ENEMY0,
    });
    expect(acted.party[0]?.defending).toBe(false);
  });
});

describe("Ashfall-aware startBattle — the encounter warps after the Reckoning", () => {
  it("fields base enemy stats in reach (the default) and warped stats in ashfall", () => {
    const reach = startBattle(tankParty(), ENCOUNTERS["the-drip"], 1, "reach");
    const ashfall = startBattle(
      tankParty(),
      ENCOUNTERS["the-drip"],
      1,
      "ashfall"
    );
    // marrow-scrapper: base HP 40 → Ashen scrapper HP 48; render-construct 70 → 130.
    expect(reach.enemies[0]?.stats.hp).toBe(40);
    expect(ashfall.enemies[0]?.stats.hp).toBe(48);
    expect(reach.enemies[1]?.stats.hp).toBe(70);
    expect(ashfall.enemies[1]?.stats.hp).toBe(130);
    // The warped foes hit harder (higher POW) than their base reads.
    expect(ashfall.enemies[0]!.stats.pow).toBeGreaterThan(
      reach.enemies[0]!.stats.pow
    );
    expect(ashfall.enemies[1]!.stats.pow).toBeGreaterThan(
      reach.enemies[1]!.stats.pow
    );
  });

  it("defaults to the reach (base) read when no world-state is passed", () => {
    const def = startBattle(tankParty(), ENCOUNTERS["the-drip"], 1);
    expect(def.enemies[0]?.stats.hp).toBe(40);
  });
});
