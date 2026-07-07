/**
 * Unit coverage for the pure party-roster projection (`logic/party-roster`) — the
 * Phaser-free model the pause menu's Party panel (#249) renders. Asserts the roster is
 * projected from the persisted save (names, level, HP/AP, equipped shard, signature),
 * falls back to the Phase-1 starting party when the save carries no known roster (a
 * fresh run persists `party: []`), drops foreign ids, surfaces a reunited member, and
 * projects the roster-wide bench build (learning / bench shards / stat augments).
 */
import { describe, expect, it } from "vitest";

import { projectPartyRoster } from "../../src/logic/party-roster";
import { freshSave, type CurrentSave } from "../../src/logic/save";
import { PARTY } from "../../src/content/party";

/**
 * A fresh save with a known roster overlaid, for the projection under test.
 * @param overrides - The save fields to overlay on a fresh save.
 * @returns The fresh save with the overrides applied.
 */
function saveWith(overrides: Partial<CurrentSave>): CurrentSave {
  return { ...freshSave(), ...overrides };
}

describe("projectPartyRoster", () => {
  it("falls back to the starting party (Wren + Tobi) when the save carries no roster", () => {
    const view = projectPartyRoster(freshSave());
    expect(view.count).toBe(2);
    expect(view.members.map(member => member.id)).toEqual(["wren", "tobi"]);
    // Each fallback member carries its authoritative name + HP/AP (the AC minimum).
    const wren = view.members[0];
    expect(wren?.name).toBe("Wren");
    expect(wren?.hp).toBe(PARTY.wren.baseStats.hp);
    expect(wren?.ap).toBe(PARTY.wren.baseStats.ap);
  });

  it("projects the persisted roster in join order with its saved level and shard", () => {
    const view = projectPartyRoster(
      saveWith({
        party: [
          { id: "wren", level: 5, shard: "emberwisp", shardMode: "wield" },
          { id: "tobi", level: 3 },
          { id: "halcyon", level: 4 },
        ],
      })
    );
    expect(view.members.map(member => member.id)).toEqual([
      "wren",
      "tobi",
      "halcyon",
    ]);
    expect(view.members[0]?.level).toBe(5);
    // A saved shard resolves to its display name; a shard-less member is null.
    expect(view.members[0]?.shard).toBe("Emberwisp");
    expect(view.members[1]?.shard).toBeNull();
  });

  it("drops a foreign/corrupt roster id rather than trusting it", () => {
    const view = projectPartyRoster(
      saveWith({
        party: [
          { id: "wren", level: 3 },
          { id: "not-a-member", level: 9 },
        ],
      })
    );
    expect(view.members.map(member => member.id)).toEqual(["wren"]);
  });

  it("surfaces a reunited secondary-roster member with its name and stats", () => {
    const view = projectPartyRoster(
      saveWith({
        party: [
          { id: "wren", level: 3 },
          { id: "tobi", level: 3 },
          { id: "quietus", level: 3 },
        ],
      })
    );
    const quietus = view.members.find(member => member.id === "quietus");
    expect(quietus?.name).toBe("Quietus");
    expect(quietus?.hp).toBe(PARTY.quietus.baseStats.hp);
    expect(quietus?.ap).toBe(PARTY.quietus.baseStats.ap);
  });

  it("projects the roster-wide bench build (learning, bench shards, augments)", () => {
    const view = projectPartyRoster(
      saveWith({
        learned: ["spark"],
        learning: [{ spell: "cinder", progress: 0.4 }],
        build: {
          statBonuses: { spd: 2 },
          equippedShards: ["marrow-bound"],
        },
      })
    );
    expect(view.build.learned).toEqual(["Spark"]);
    expect(view.build.learning).toEqual([{ name: "Cinder", pct: 40 }]);
    expect(view.build.benchShards).toEqual(["The Marrow Bound"]);
    expect(view.build.statBonuses).toEqual({ spd: 2 });
  });

  it("leaves the bench build empty for a fresh run", () => {
    const view = projectPartyRoster(freshSave());
    expect(view.build.learned).toEqual([]);
    expect(view.build.learning).toEqual([]);
    expect(view.build.benchShards).toEqual([]);
    expect(view.build.statBonuses).toEqual({});
  });
});
