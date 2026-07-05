/**
 * The sim-side contract the #201 render work depends on: a resolved Craft logs
 * its element (the annotation the FX layer reads to color an action by element),
 * and a living target driven past the Break threshold by weakness Craft hits
 * flips `broken` true — the state transition the render layer keys its Break beat
 * on. Pure and headless; the browser e2e proves the FX itself on the canvas.
 */
import { describe, expect, it } from "vitest";
import { SpellIds } from "../../src/content";
import {
  ActionKinds,
  BattleSides,
  Elements,
  step,
  type BattleState,
  type Combatant,
  type CombatantRef,
} from "../../src/logic/combat";

const WREN: CombatantRef = { side: BattleSides.party, index: 0 };
const FOE: CombatantRef = { side: BattleSides.enemies, index: 0 };
const SPARK = {
  kind: ActionKinds.craft,
  id: SpellIds.spark,
  actor: WREN,
  target: FOE,
} as const;

/**
 * A caster whose FOC is deliberately low so a Flux Craft pressures a target
 * toward Break without one-shotting it — isolating the Break transition.
 */
const CASTER: Combatant = {
  ref: "wren",
  stats: { hp: 100, ap: 40, pow: 4, foc: 2, def: 10, wrd: 8, spd: 10, lck: 0 },
  hp: 100,
  ap: 40,
  atb: 100,
  statuses: [],
  pressure: 0,
  broken: false,
  spent: false,
};

/**
 * A tanky Flux-weak target (`render-construct` is weak to Flux in the content
 * table) with enough HP to survive the two weakness Crafts that Break it.
 */
const TARGET: Combatant = {
  ref: "render-construct",
  stats: { hp: 300, ap: 0, pow: 6, foc: 0, def: 8, wrd: 6, spd: 1, lck: 0 },
  hp: 300,
  ap: 0,
  atb: 0,
  statuses: [],
  pressure: 0,
  broken: false,
  spent: false,
};

/**
 * A one-on-one battle state seeded for a deterministic pair of Craft turns.
 * @returns The initial battle state.
 */
function battle(): BattleState {
  return {
    party: [CASTER],
    enemies: [TARGET],
    grist: 0,
    seed: 0x1234,
    rngState: 0x1234,
    tick: 0,
    phase: "select",
    log: [],
  };
}

describe("combat — element annotation + Break reachability (#201)", () => {
  it("logs the resolved element on a Craft hit (the FX layer's read)", () => {
    const next = step(battle(), SPARK);
    const event = next.log.at(-1);
    expect(event?.kind).toBe(ActionKinds.craft);
    expect(event?.element).toBe(Elements.flux);
  });

  it("leaves a physical Strike's event element-less (neutral)", () => {
    const next = step(battle(), {
      kind: ActionKinds.strike,
      actor: WREN,
      target: FOE,
    });
    expect(next.log.at(-1)?.element).toBeUndefined();
  });

  it("Breaks a living target after two weakness Crafts cross the threshold", () => {
    const afterOne = step(battle(), SPARK);
    const foeOne = afterOne.enemies[0];
    // One weakness hit accrues pressure but not enough to Break.
    expect(foeOne?.broken).toBe(false);
    expect(foeOne?.hp).toBeGreaterThan(0);

    const afterTwo = step(afterOne, SPARK);
    const foeTwo = afterTwo.enemies[0];
    // The second weakness hit crosses the Break threshold — while still alive,
    // which is exactly the false→true `broken` edge the render layer keys on.
    expect(foeTwo?.broken).toBe(true);
    expect(foeTwo?.hp).toBeGreaterThan(0);
  });
});
