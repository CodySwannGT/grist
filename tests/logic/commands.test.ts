import { describe, expect, it } from "vitest";

import {
  buildAction,
  COMMAND_ORDER,
  Commands,
  commandAffordable,
  commandCost,
  commandCostLabel,
  commandLabel,
  commandOrderFor,
} from "../../src/ui/commands";
import {
  ActionKinds,
  BattleSides,
  type CombatantRef,
} from "../../src/logic/combat";

const ACTOR: CombatantRef = { side: BattleSides.party, index: 0 };
const TARGET: CombatantRef = { side: BattleSides.enemies, index: 1 };

describe("battle command catalog", () => {
  it("lists the full catalog in canonical menu order (incl. Augment, #110)", () => {
    expect(COMMAND_ORDER).toEqual([
      Commands.strike,
      Commands.craft,
      Commands.bind,
      Commands.augment,
      Commands.item,
      Commands.defend,
    ]);
  });

  it("labels each command (incl. the gadgeteer Augment slot)", () => {
    expect(commandLabel(Commands.strike)).toBe("Strike");
    expect(commandLabel(Commands.augment)).toBe("Augment");
    expect(commandLabel(Commands.defend)).toBe("Defend");
  });

  it("prices Augment free (a tool/buff, no spell cost)", () => {
    expect(commandCost(Commands.augment)).toEqual({ ap: 0, grist: 0 });
  });

  it("prices Strike/Item/Defend free, Craft in AP, Bind in grist", () => {
    expect(commandCost(Commands.strike)).toEqual({ ap: 0, grist: 0 });
    expect(commandCost(Commands.item)).toEqual({ ap: 0, grist: 0 });
    expect(commandCost(Commands.defend)).toEqual({ ap: 0, grist: 0 });
    expect(commandCost(Commands.craft).ap).toBeGreaterThan(0);
    expect(commandCost(Commands.bind).grist).toBeGreaterThan(0);
  });

  it("renders the cost suffix the HUD shows before committing", () => {
    expect(commandCostLabel(Commands.strike)).toBe("");
    expect(commandCostLabel(Commands.craft)).toBe(
      ` ${commandCost(Commands.craft).ap}AP`
    );
    expect(commandCostLabel(Commands.bind)).toBe(
      ` ${commandCost(Commands.bind).grist}G`
    );
  });

  it("gates affordability the same way the reducer does", () => {
    // Bind needs grist; an empty pool cannot pay it, a stocked one can.
    expect(commandAffordable(Commands.bind, 99, 0)).toBe(false);
    expect(commandAffordable(Commands.bind, 0, 99)).toBe(true);
    // Craft needs AP from the actor.
    expect(commandAffordable(Commands.craft, 0, 0)).toBe(false);
    expect(commandAffordable(Commands.craft, 99, 0)).toBe(true);
    // Strike is always free.
    expect(commandAffordable(Commands.strike, 0, 0)).toBe(true);
  });

  it("builds reducer actions: Strike physical, Craft/Bind carry a spell id", () => {
    expect(buildAction(Commands.strike, ACTOR, TARGET)).toEqual({
      kind: ActionKinds.strike,
      actor: ACTOR,
      target: TARGET,
    });
    const craft = buildAction(Commands.craft, ACTOR, TARGET);
    expect(craft.kind).toBe(ActionKinds.craft);
    expect(craft.id).toBeDefined();
    const bind = buildAction(Commands.bind, ACTOR, TARGET);
    expect(bind.kind).toBe(ActionKinds.bind);
    expect(bind.id).toBeDefined();
  });

  it("builds a free Augment action (no spell id) — the reducer spends the turn", () => {
    const augment = buildAction(Commands.augment, ACTOR, TARGET);
    expect(augment.kind).toBe(ActionKinds.augment);
    expect(augment.id).toBeUndefined();
  });
});

describe("per-member command order (commandOrderFor, #110)", () => {
  it("returns the full catalog when no kit is given (no member ready)", () => {
    expect(commandOrderFor(undefined)).toEqual(COMMAND_ORDER);
    expect(commandOrderFor([])).toEqual(COMMAND_ORDER);
  });

  it("returns the member's own kit order (Tobi's gadgeteer menu)", () => {
    const tobiKit = [
      Commands.strike,
      Commands.augment,
      Commands.item,
      Commands.defend,
    ] as const;
    expect(commandOrderFor(tobiKit)).toEqual(tobiKit);
  });

  it("filters out any id not in the catalog (defensive)", () => {
    const dirty = [Commands.strike, "ghost" as never, Commands.defend];
    expect(commandOrderFor(dirty)).toEqual([Commands.strike, Commands.defend]);
  });
});
