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
import { SpellIds } from "../../src/content/spells";
import { isLearning, learningProgress } from "../../src/logic/spell-learning";
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

  // #264: the learning progression must be restored, not reset — otherwise the Bench
  // reads an equipped shard as "learning Cinder" while its status line says "not begun".
  describe("restores the spell-learning progression (#264)", () => {
    it("rehydrates an in-progress spell at its saved fraction", () => {
      const save: CurrentSave = {
        ...freshSave(),
        learning: [{ spell: SpellIds.cinder, progress: 0.5 }],
      };
      const run = runStateFromSave(save);
      expect(isLearning(run.learning, SpellIds.cinder)).toBe(true);
      expect(learningProgress(run.learning, SpellIds.cinder)).toBe(0.5);
    });

    it("rehydrates a just-equipped (0%) spell as in-progress, not not-begun", () => {
      const save: CurrentSave = {
        ...freshSave(),
        learning: [{ spell: SpellIds.cinder, progress: 0 }],
      };
      expect(isLearning(runStateFromSave(save).learning, SpellIds.cinder)).toBe(
        true
      );
    });

    it("restores a completed spell as permanently learned", () => {
      const save: CurrentSave = {
        ...freshSave(),
        learned: [SpellIds.cinder],
      };
      expect(
        learningProgress(runStateFromSave(save).learning, SpellIds.cinder)
      ).toBe(1);
    });

    it("filters a foreign spell id rather than trusting it", () => {
      const save: CurrentSave = {
        ...freshSave(),
        learned: ["not-a-spell"],
        learning: [{ spell: "also-bogus", progress: 0.3 }],
      };
      const run = runStateFromSave(save);
      expect(run.learning.learned).toEqual([]);
      expect(run.learning.learning).toEqual([]);
    });
  });
});
