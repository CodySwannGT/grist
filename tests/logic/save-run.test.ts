/**
 * Unit coverage for the pure save → run-state projection (`logic/save-run`) — the
 * empirical proof for #226's **Continue** contract: a persisted save rebuilds into a
 * live run carrying the saved grist wallet, the bench build (equipped shards + stat
 * augments), and the party roster, and does so totally (a corrupt/foreign id is
 * filtered, never trusted or thrown on).
 */
import { describe, expect, it } from "vitest";

import { runStateFromSave } from "../../src/logic/save-run";
import { freshSave } from "../../src/logic/save";
import { BoundIds } from "../../src/content/bounds";
import { PartyMemberIds } from "../../src/content/party";
import { type CurrentSave } from "../../src/logic/save";

describe("runStateFromSave — Continue rebuilds the saved run (#226)", () => {
  it("restores the shared grist wallet at the saved balance", () => {
    const save: CurrentSave = { ...freshSave(), grist: 137 };
    expect(runStateFromSave(save).wallet.grist).toBe(137);
  });

  it("restores the bench build — equipped shards and stat augments", () => {
    const shard = Object.values(BoundIds)[0]!;
    const save: CurrentSave = {
      ...freshSave(),
      build: { statBonuses: { spd: 2 }, equippedShards: [shard] },
    };
    const run = runStateFromSave(save);
    expect(run.equippedShards).toEqual([shard]);
    expect(run.statBonuses).toEqual({ spd: 2 });
  });

  it("restores the party roster in join order", () => {
    const save: CurrentSave = {
      ...freshSave(),
      party: [
        { id: PartyMemberIds.wren, level: 3 },
        { id: PartyMemberIds.tobi, level: 2 },
      ],
    };
    expect(runStateFromSave(save).roster).toEqual([
      PartyMemberIds.wren,
      PartyMemberIds.tobi,
    ]);
  });

  it("filters foreign shard and roster ids rather than trusting them", () => {
    const save: CurrentSave = {
      ...freshSave(),
      party: [{ id: "not-a-member", level: 1 }],
      build: { statBonuses: {}, equippedShards: ["not-a-shard"] },
    };
    const run = runStateFromSave(save);
    expect(run.equippedShards).toEqual([]);
    // An empty recognized roster falls back to the fresh starting party.
    expect(run.roster.length).toBeGreaterThan(0);
  });

  it("falls back to the starting roster when the save carries no party", () => {
    const run = runStateFromSave(freshSave());
    expect(run.roster).toEqual([PartyMemberIds.wren, PartyMemberIds.tobi]);
  });
});
