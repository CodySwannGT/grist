import { describe, expect, it } from "vitest";

import {
  Commands,
  isValidKit,
  kitsDiffer,
  type CommandKit,
} from "../../src/logic/commands";
import { PARTY, PartyMemberIds } from "../../src/content";

/**
 * #110 — Tobi recruitment: a real second party member with a *visibly different*
 * command kit (gadgeteer/support, augment-driven) routed through the existing ATB
 * engine. These tests pin the kit vocabulary and the per-member kits; the
 * party-of-two ATB routing is covered in `tests/logic/party-of-two.test.ts`.
 */
describe("command kit vocabulary (#110)", () => {
  it("includes the augment slot the gadgeteer kit needs", () => {
    expect(Commands.augment).toBe("augment");
  });

  it("rejects an empty kit", () => {
    expect(isValidKit([])).toBe(false);
  });

  it("rejects a kit with a duplicate command", () => {
    expect(isValidKit([Commands.strike, Commands.strike])).toBe(false);
  });

  it("rejects a kit with an undefined command id", () => {
    expect(isValidKit(["teleport" as unknown as never])).toBe(false);
  });

  it("accepts a non-empty, all-defined, duplicate-free kit", () => {
    expect(isValidKit([Commands.strike, Commands.defend])).toBe(true);
  });

  it("kitsDiffer is true when the command sets differ", () => {
    expect(
      kitsDiffer([Commands.strike, Commands.craft], [Commands.strike])
    ).toBe(true);
  });

  it("kitsDiffer is false when the kits are the same set (any order)", () => {
    expect(
      kitsDiffer(
        [Commands.strike, Commands.defend],
        [Commands.defend, Commands.strike]
      )
    ).toBe(false);
  });
});

describe("party kits: Wren tempo vs Tobi gadgeteer/support (#110 AC)", () => {
  it("every authored member has a well-formed command kit (totality)", () => {
    for (const member of Object.values(PARTY)) {
      expect(isValidKit(member.kit)).toBe(true);
    }
  });

  it("Wren's tempo kit is caster-leaning: Strike + Craft + Bind", () => {
    const wren = PARTY[PartyMemberIds.wren];
    expect(wren.kit).toContain(Commands.strike);
    expect(wren.kit).toContain(Commands.craft);
    expect(wren.kit).toContain(Commands.bind);
  });

  it("Tobi's gadgeteer/support kit is augment-driven, not caster", () => {
    const tobi = PARTY[PartyMemberIds.tobi];
    // The distinguishing tool slot: Tobi surfaces Augment (his gadgets/buffs).
    expect(tobi.kit).toContain(Commands.augment);
    // And he is NOT a Craft caster — that is Wren's identity, not his.
    expect(tobi.kit).not.toContain(Commands.craft);
  });

  it("Wren and Tobi present visibly different command kits (the AC)", () => {
    const wren: CommandKit = PARTY[PartyMemberIds.wren].kit;
    const tobi: CommandKit = PARTY[PartyMemberIds.tobi].kit;
    expect(kitsDiffer(wren, tobi)).toBe(true);
  });

  it("both share the always-available baseline (Strike + Defend)", () => {
    for (const id of [PartyMemberIds.wren, PartyMemberIds.tobi] as const) {
      expect(PARTY[id].kit).toContain(Commands.strike);
      expect(PARTY[id].kit).toContain(Commands.defend);
    }
  });
});
