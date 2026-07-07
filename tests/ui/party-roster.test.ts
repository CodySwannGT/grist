/**
 * Unit coverage for the pure party-panel formatter (`ui/party-roster`) — the
 * Phaser-free twin the Party panel body (#249) renders. Asserts each member's compact
 * line always carries the acceptance-criteria minimum (name + HP/AP) plus level and
 * shard, and the roster-wide bench-build lines appear only when that build slice has
 * content (a fresh run adds no empty "Build:" scaffolding).
 */
import { describe, expect, it } from "vitest";

import { partyBuildLines, partyMemberLine } from "../../src/ui/party-roster";
import type {
  PartyBuildView,
  PartyMemberView,
} from "../../src/logic/party-roster";

const WREN: PartyMemberView = {
  id: "wren",
  name: "Wren",
  level: 3,
  hp: 120,
  ap: 20,
  stats: {
    hp: 120,
    ap: 20,
    pow: 18,
    foc: 10,
    def: 10,
    wrd: 8,
    spd: 14,
    lck: 8,
  },
  shard: "Emberwisp",
  signature: ["Flurry"],
};

const TOBI: PartyMemberView = {
  ...WREN,
  id: "tobi",
  name: "Tobi",
  hp: 140,
  ap: 24,
  shard: null,
  signature: ["Stun-Dart"],
};

describe("partyMemberLine", () => {
  it("always carries the member's name, level, and HP/AP", () => {
    const line = partyMemberLine(WREN);
    expect(line).toContain("Wren");
    expect(line).toContain("L3");
    expect(line).toContain("HP120");
    expect(line).toContain("AP20");
  });

  it("shows the equipped shard when one is carried, and omits it when not", () => {
    expect(partyMemberLine(WREN)).toContain("Emberwisp");
    expect(partyMemberLine(TOBI)).not.toContain("Emberwisp");
  });
});

describe("partyBuildLines", () => {
  it("emits a line per non-empty build slice (spells, shards, augments)", () => {
    const build: PartyBuildView = {
      learned: ["Spark"],
      learning: [{ name: "Cinder", pct: 40 }],
      benchShards: ["The Marrow Bound"],
      statBonuses: { spd: 2 },
    };
    const lines = partyBuildLines(build);
    expect(lines.some(line => line.includes("Cinder 40%"))).toBe(true);
    expect(lines.some(line => line.includes("Spark ✓"))).toBe(true);
    expect(lines.some(line => line.includes("The Marrow Bound"))).toBe(true);
    expect(lines.some(line => line.includes("+2 SPD"))).toBe(true);
  });

  it("formats a negative augment without a double sign", () => {
    const build: PartyBuildView = {
      learned: [],
      learning: [],
      benchShards: [],
      statBonuses: { spd: -2 },
    };
    const lines = partyBuildLines(build);
    expect(lines.some(line => line.includes("-2 SPD"))).toBe(true);
    expect(lines.some(line => line.includes("+-2"))).toBe(false);
  });

  it("emits nothing for an empty build (no scaffolding on a fresh run)", () => {
    const empty: PartyBuildView = {
      learned: [],
      learning: [],
      benchShards: [],
      statBonuses: {},
    };
    expect(partyBuildLines(empty)).toEqual([]);
  });
});
