/**
 * Unit coverage for the pure run-economy **write-through** projection
 * (`src/logic/save/run-economy`): the Phaser-free twin of the `SaveService` write the
 * Field/Bench scenes perform when the run's earned economy commits (#235). Proves
 * `foldRunEconomy` sets `grist` + `build` from a live run, preserves every OTHER
 * persisted field (scene progress, party, world-state, choice, moral ledger, and the
 * determinism-critical rng lineage) verbatim, copies the run's arrays/objects so the
 * save never aliases live state, and mutates neither input. Exercised without a DOM or
 * IndexedDB under vitest, mirroring the `scene-progress` / `save-data` suites.
 */
import { describe, expect, it } from "vitest";

import {
  foldRunEconomy,
  freshSave,
  type CurrentSave,
  type RunEconomy,
} from "../../src/logic/save";

/** A representative equipped-shard id (structural — the fold trusts any string id). */
const EQUIPPED_SHARD = "ashling-bound";

/** A grown run economy: a spent-then-earned wallet, a stat augment, an equipped shard. */
const GROWN_ECONOMY: RunEconomy = {
  grist: 42,
  statBonuses: { spd: 2 },
  equippedShards: [EQUIPPED_SHARD],
};

/**
 * A save carrying non-economy progress a player would not want an economy write to
 * clobber: a mid-story scene cursor + flags, a party roster, a turned world, a resolved
 * choice, a moral ledger, and a non-trivial rng lineage.
 * @returns A current-version save with rich non-economy state.
 */
function saveWithProgress(): CurrentSave {
  return {
    ...freshSave(),
    party: [{ id: "wren", level: 4 }],
    choice: { resolved: true, shard: "marrow-bound", variant: "wield" },
    moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
    rng: { seed: 12345, state: 987654321 },
    worldState: "ashfall",
    scene: { sceneId: "ch1", nodeId: "node-3", flags: { "sable-lost": true } },
  };
}

describe("foldRunEconomy — run-economy write-through (#235)", () => {
  it("sets the grist wallet balance from the live run", () => {
    const next = foldRunEconomy(freshSave(), GROWN_ECONOMY);
    expect(next.grist).toBe(42);
  });

  it("sets the build — stat augments and equipped shards — from the live run", () => {
    const next = foldRunEconomy(freshSave(), GROWN_ECONOMY);
    expect(next.build).toEqual({
      statBonuses: { spd: 2 },
      equippedShards: [EQUIPPED_SHARD],
    });
  });

  it("preserves every other persisted field verbatim — no beat/choice/rng is dropped", () => {
    const prior = saveWithProgress();

    const next = foldRunEconomy(prior, GROWN_ECONOMY);

    // The economy changed; nothing else did.
    expect(next.party).toEqual(prior.party);
    expect(next.choice).toEqual(prior.choice);
    expect(next.moralLedger).toEqual(prior.moralLedger);
    expect(next.worldState).toBe(prior.worldState);
    expect(next.scene).toEqual(prior.scene);
    // The rng lineage in particular survives untouched — persistence never
    // regenerates it, so determinism is unaffected by the economy write.
    expect(next.rng).toEqual({ seed: 12345, state: 987654321 });
  });

  it("copies the run's arrays/objects so the save never aliases live run state", () => {
    const next = foldRunEconomy(freshSave(), GROWN_ECONOMY);
    expect(next.build.statBonuses).not.toBe(GROWN_ECONOMY.statBonuses);
    expect(next.build.equippedShards).not.toBe(GROWN_ECONOMY.equippedShards);
    expect(next.build.equippedShards).toEqual([EQUIPPED_SHARD]);
  });

  it("mutates neither the input save nor the input economy", () => {
    const prior = saveWithProgress();
    const priorBuildSnapshot = { ...prior.build };

    const next = foldRunEconomy(prior, GROWN_ECONOMY);

    expect(next).not.toBe(prior);
    expect(prior.build).toEqual(priorBuildSnapshot);
    expect(prior.grist).toBe(0);
  });

  it("round-trips through JSON.stringify (serializable, no embedded behavior)", () => {
    const next = foldRunEconomy(saveWithProgress(), GROWN_ECONOMY);
    const roundTripped = JSON.parse(JSON.stringify(next)) as CurrentSave;
    expect(roundTripped).toEqual(next);
  });
});
