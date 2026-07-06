/**
 * Unit suite for the pure victory/defeat summary model (`src/logic/battle-summary`):
 * the total function that turns a consumed {@link BattleResult} into the terminal
 * beat a standalone resolved battle presents (#225) — the outcome title, a
 * grim-warm flavor line, the cheap surfaced facts (grist earned, a recovered
 * shard), and the press-Enter affordance. Pure data-in/data-out, asserted headless
 * with no Phaser.
 */
import { describe, expect, it } from "vitest";
import { BoundIds } from "../../src/content/bounds";
import {
  BattleOutcomes,
  type BattleResult,
} from "../../src/logic/battle-result";
import { battleSummary } from "../../src/logic/battle-summary";

/** A winning result (no shard) — the default cold-boot encounter's outcome. */
const WIN: BattleResult = {
  outcome: BattleOutcomes.win,
  gristGained: 16,
  shard: null,
  choiceTriggered: false,
};

/** A winning boss result that dropped the Marrow shard. */
const WIN_WITH_SHARD: BattleResult = {
  outcome: BattleOutcomes.win,
  gristGained: 20,
  shard: BoundIds.marrowBound,
  choiceTriggered: true,
};

/** A losing result — the party wiped, nothing gained. */
const LOSS: BattleResult = {
  outcome: BattleOutcomes.lose,
  gristGained: 0,
  shard: null,
  choiceTriggered: false,
};

describe("battleSummary", () => {
  it("titles a win VICTORY with a grim-warm flavor and a press-Enter prompt", () => {
    const model = battleSummary(WIN);
    expect(model.outcome).toBe(BattleOutcomes.win);
    expect(model.won).toBe(true);
    expect(model.title).toBe("VICTORY");
    expect(model.flavor.length).toBeGreaterThan(0);
    expect(model.prompt.toLowerCase()).toContain("enter");
  });

  it("surfaces the grist earned on a win", () => {
    const model = battleSummary(WIN);
    expect(model.stats.some(line => line.includes("16"))).toBe(true);
    expect(model.stats.some(line => /grist/i.test(line))).toBe(true);
  });

  it("adds a recovered-shard line when the win dropped a Bound shard", () => {
    const model = battleSummary(WIN_WITH_SHARD);
    expect(model.stats.some(line => line.includes("20"))).toBe(true);
    expect(model.stats.some(line => /shard/i.test(line))).toBe(true);
  });

  it("does NOT claim a shard when the win dropped none", () => {
    const model = battleSummary(WIN);
    expect(model.stats.some(line => /shard/i.test(line))).toBe(false);
  });

  it("titles a loss DEFEAT with the grim defeat flavor and no stats", () => {
    const model = battleSummary(LOSS);
    expect(model.outcome).toBe(BattleOutcomes.lose);
    expect(model.won).toBe(false);
    expect(model.title).toBe("DEFEAT");
    expect(model.flavor).toContain("Marrow");
    // A loss yields nothing, so there is nothing to surface.
    expect(model.stats).toEqual([]);
  });

  it("always offers a deliberate-advance affordance on both outcomes", () => {
    for (const result of [WIN, LOSS]) {
      expect(battleSummary(result).prompt.length).toBeGreaterThan(0);
    }
  });
});
