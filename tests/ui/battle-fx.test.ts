/**
 * Battle-FX selection contract — proves the pure element→FX mapping the render
 * layer keys on: every combat element resolves to its own strip + color-language
 * tint, the neutral flavors (Strike / element-less Craft / Defend) resolve to the
 * base strips, the Break burst is the dedicated one, and the Break-edge detector
 * fires exactly once on the false→true transition of a living combatant. Pure and
 * headless — this is the AC1 (element-read FX) + AC2 (Break fires once) guarantee
 * that the browser e2e then exercises on the live canvas.
 */
import { describe, expect, it } from "vitest";
import { FxAnims } from "../../src/anims";
import { FxColors } from "../../src/consts";
import { BREAK_FX, fxForEvent, justBroke } from "../../src/ui/battle-fx";
import {
  ActionKinds,
  Elements,
  type BattleEvent,
  type Combatant,
  type ElementId,
} from "../../src/logic/combat";

/**
 * A minimal combatant carrying only the fields the Break detector reads.
 * @param hp - Current HP (alive when > 0).
 * @param broken - Whether the combatant is Broken.
 * @returns A combatant stub.
 */
function combatant(hp: number, broken: boolean): Combatant {
  return {
    ref: "x",
    stats: { hp: 40, ap: 0, pow: 0, foc: 0, def: 0, wrd: 0, spd: 0, lck: 0 },
    hp,
    ap: 0,
    atb: 0,
    statuses: [],
    pressure: broken ? 50 : 0,
    broken,
    spent: false,
  };
}

/**
 * A resolved Craft event carrying an element.
 * @param element - The attacking element.
 * @returns The battle event.
 */
function craft(element: ElementId): BattleEvent {
  return { tick: 1, kind: ActionKinds.craft, element };
}

describe("battle-fx — element-read FX selection (AC1)", () => {
  const ELEMENTS = Object.values(Elements) as readonly ElementId[];

  it("maps every element's Craft to its own strip and color-language tint", () => {
    for (const element of ELEMENTS) {
      const fx = fxForEvent(craft(element));
      expect(fx.element).toBe(element);
      expect(fx.anim).toBe(FxAnims[element]);
      expect(fx.tint).toBe(FxColors[element]);
    }
  });

  it("gives each element a DISTINCT strip (no two elements share FX)", () => {
    const anims = new Set(ELEMENTS.map(e => fxForEvent(craft(e)).anim));
    expect(anims.size).toBe(ELEMENTS.length);
  });

  it("shows the neutral slash for a physical Strike (no element)", () => {
    const fx = fxForEvent({ tick: 1, kind: ActionKinds.strike });
    expect(fx.anim).toBe(FxAnims.slash);
    expect(fx.element).toBeNull();
    expect(fx.tint).toBe(FxColors.neutral);
  });

  it("puffs smoke for a Defend", () => {
    const fx = fxForEvent({ tick: 1, kind: ActionKinds.defend });
    expect(fx.anim).toBe(FxAnims.smoke);
    expect(fx.element).toBeNull();
  });

  it("falls back to the neutral spark for an element-less Craft", () => {
    const fx = fxForEvent({ tick: 1, kind: ActionKinds.craft });
    expect(fx.anim).toBe(FxAnims.spark);
    expect(fx.element).toBeNull();
  });

  it("uses the dedicated Break burst with the grist-gold tint", () => {
    expect(BREAK_FX.anim).toBe(FxAnims.break);
    expect(BREAK_FX.element).toBeNull();
    expect(BREAK_FX.tint).toBe(FxColors.break);
  });
});

describe("battle-fx — Break-edge detection (AC2: fires once per Break)", () => {
  it("fires on the false→true edge of a living combatant", () => {
    expect(justBroke(false, combatant(20, true))).toBe(true);
  });

  it("does NOT fire again while already Broken (once per Break)", () => {
    expect(justBroke(true, combatant(20, true))).toBe(false);
  });

  it("does NOT fire for an un-Broken combatant", () => {
    expect(justBroke(false, combatant(20, false))).toBe(false);
  });

  it("does NOT fire for a downed (0 HP) combatant even if flagged Broken", () => {
    expect(justBroke(false, combatant(0, true))).toBe(false);
  });
});
