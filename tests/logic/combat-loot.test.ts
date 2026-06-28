import { describe, expect, it } from "vitest";

import {
  canAfford,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
  type Combatant,
} from "../../src/logic/combat";
import {
  BOUNDS,
  ENCOUNTERS,
  ENEMIES,
  EnemyIds,
  PARTY,
} from "../../src/content";

/** Overrides for the synthetic combatant builder. */
interface MkOpts {
  readonly hp?: number;
  readonly pow?: number;
  readonly spent?: boolean;
}

/** Real enemy ids — their kills resolve loot from the {@link ENEMIES} table. */
const SCRAPPER = EnemyIds.marrowScrapper;
const CONSTRUCT = EnemyIds.renderConstruct;

/**
 * Build a synthetic combatant. The `ref` matters here: loot is resolved from the
 * {@link ENEMIES} table by ref, so a real enemy id yields its `lootGrist`.
 * @param ref - The content ref (a real enemy id to earn loot).
 * @param opts - HP / POW / spent overrides.
 * @returns A combatant.
 */
function mk(ref: string, opts: MkOpts = {}): Combatant {
  const { hp = 100, pow = 0, spent = false } = opts;
  return {
    ref,
    stats: { hp: 100, ap: 0, pow, foc: 0, def: 0, wrd: 0, spd: 10, lck: 0 },
    hp,
    ap: 0,
    atb: 0,
    statuses: [],
    pressure: 0,
    broken: false,
    spent,
  };
}

/**
 * Assemble a synthetic {@link BattleState}.
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

const HERO = { side: "party", index: 0 } as const;
const FOE = { side: "enemies", index: 0 } as const;
const SCRAPPER_LOOT = ENEMIES[SCRAPPER].lootGrist; // 6
const CONSTRUCT_LOOT = ENEMIES[CONSTRUCT].lootGrist; // 10

describe("loot grist crediting (AC: two-resource economy is funded by kills)", () => {
  it("credits the defeated enemy's lootGrist to the shared pool", () => {
    const state = battle(
      [mk("hero", { pow: 999 })],
      [mk(SCRAPPER, { hp: 1 }), mk(CONSTRUCT, { hp: 50 })]
    );
    const next = step(state, { kind: "strike", actor: HERO, target: FOE });
    expect(next.enemies[0]?.hp).toBe(0);
    expect(next.grist).toBe(SCRAPPER_LOOT);
  });

  it("does not credit loot while the enemy survives (pool unchanged, same reference)", () => {
    const state = battle([mk("hero", { pow: 1 })], [mk(SCRAPPER)], {
      grist: 4,
    });
    const next = step(state, { kind: "strike", actor: HERO, target: FOE });
    expect(next.enemies[0]?.hp).toBeGreaterThan(0);
    expect(next.grist).toBe(4);
  });

  it("denies loot for a Rendering-killed (spent) corpse", () => {
    const dying: Combatant = {
      ...mk(CONSTRUCT, { hp: 3 }),
      statuses: [{ id: "rendering", turns: 2, power: 5 }],
    };
    // A tick's DoT lands the kill and marks the corpse spent → loot is forfeit.
    const next = step(battle([mk("hero", { hp: 100 })], [dying]), {
      kind: "tick",
    });
    expect(next.enemies[0]?.hp).toBe(0);
    expect(next.enemies[0]?.spent).toBe(true);
    expect(next.grist).toBe(0);
  });

  it("a kill funds a Bind the empty pool could not previously afford", () => {
    const bindCost = BOUNDS.emberwisp.bind.gristCost ?? 0;
    const state = battle(
      [mk("hero", { pow: 999 })],
      [mk(CONSTRUCT, { hp: 1 }), mk(SCRAPPER, { hp: 50 })]
    );
    expect(canAfford(0, state.grist, { ap: 0, grist: bindCost })).toBe(false);
    const afterKill = step(state, { kind: "strike", actor: HERO, target: FOE });
    expect(afterKill.grist).toBe(CONSTRUCT_LOOT);
    expect(canAfford(0, afterKill.grist, { ap: 0, grist: bindCost })).toBe(
      true
    );
  });

  it("threads loot deterministically through a real seeded encounter", () => {
    const play = (seed: number): number => {
      let state = startBattle(
        [PARTY.wren, PARTY.tobi],
        ENCOUNTERS["the-drip"],
        seed
      );
      const kill: BattleAction = {
        kind: "craft",
        id: "spark",
        actor: { side: "party", index: 0 },
        target: { side: "enemies", index: 1 }, // render-construct (Flux-weak)
      };
      state = step(state, kill);
      return state.grist;
    };
    // Spark one-shots the Flux-weak construct; its loot lands in the pool, same
    // for any seed (loot is RNG-free).
    expect(play(0xabc)).toBe(CONSTRUCT_LOOT);
    expect(play(0xdef)).toBe(CONSTRUCT_LOOT);
  });
});
