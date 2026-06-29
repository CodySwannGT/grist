/**
 * Codified verification (UAT) playthrough for the free-vs-wield resolution
 * (issue #85, PRD #41 FR5 / AC5). This is the deterministic, headless analogue of
 * the issue's Validation Journey: it drives the pure resolution from one frozen,
 * seeded pre-choice run-state down BOTH paths and asserts the observable
 * divergence the journey calls for — free grants the corruption-free variant and
 * raises karma; wield grants the corrupting variant and lowers karma; and the two
 * resulting persistent states (shard variant + moralLedger/karma + corruption)
 * differ measurably from identical input.
 *
 * The browser-driven proof over `window.__VERIFY__` at `?uat=1` lands in the
 * slice verification issue (#78) once the prompt UI (#72) and persistence wiring
 * are consumed end-to-end; this codifies the same divergence assertions at the
 * deterministic logic layer the bridge will read — exactly the completion
 * evidence the issue's Validation Journey requires (the unit/verification suite
 * resolving both paths from identical seeded state with a measurable difference).
 * @module tests/verification/free-vs-wield.verify
 */
import { describe, expect, it } from "vitest";

import { BOUNDS, BoundIds } from "../../src/content/bounds";
import { newMoralLedger, resolveChoice } from "../../src/logic/free-vs-wield";
import { newRunState, type RunState } from "../../src/logic/run-state";

/**
 * The frozen, seeded pre-choice state the journey starts from: the Ashling has
 * been defeated and dropped the Marrow Bound, whose free-vs-wield choice is
 * pending. Both paths resolve from a fresh copy of THIS identical state, so any
 * divergence is attributable to the choice alone.
 */
const PRE_CHOICE: RunState = {
  ...newRunState(),
  shards: [BoundIds.marrowBound],
  pendingChoiceShard: BoundIds.marrowBound,
};

describe("verification: free-vs-wield divergence (PRD #41 AC5)", () => {
  it("resolves the free path to the corruption-free variant with karma raised", () => {
    const free = resolveChoice(PRE_CHOICE, newMoralLedger(), "free");
    expect(free.choice).toEqual({
      resolved: true,
      shard: BoundIds.marrowBound,
      variant: "free",
    });
    expect(free.corruptionAccrued).toBe(0);
    expect(free.ledger).toEqual({ karma: 1, freeChoices: 1, wieldChoices: 0 });
    expect(free.run.pendingChoiceShard).toBeNull();
  });

  it("resolves the wield path to the corrupting variant with karma lowered", () => {
    const wield = resolveChoice(PRE_CHOICE, newMoralLedger(), "wield");
    expect(wield.choice).toEqual({
      resolved: true,
      shard: BoundIds.marrowBound,
      variant: "wield",
    });
    expect(wield.corruptionAccrued).toBe(
      BOUNDS[BoundIds.marrowBound].variants.wield.corruptionRate
    );
    expect(wield.corruptionAccrued).toBeGreaterThan(0);
    expect(wield.ledger).toEqual({
      karma: -1,
      freeChoices: 0,
      wieldChoices: 1,
    });
    expect(wield.run.pendingChoiceShard).toBeNull();
  });

  it("the two paths differ measurably from identical seeded pre-choice state", () => {
    // Same frozen input, both paths — the journey's core assertion.
    const free = resolveChoice(PRE_CHOICE, newMoralLedger(), "free");
    const wield = resolveChoice(PRE_CHOICE, newMoralLedger(), "wield");

    expect(free).not.toEqual(wield);
    expect(free.choice.variant).not.toBe(wield.choice.variant);
    expect(free.ledger.karma).not.toBe(wield.ledger.karma);
    expect(free.corruptionAccrued).not.toBe(wield.corruptionAccrued);
    // Corruption accrues ONLY on wield.
    expect(free.corruptionAccrued).toBe(0);
    expect(wield.corruptionAccrued).toBeGreaterThan(0);
  });

  it("is deterministic — re-running a path yields a deep-equal result", () => {
    expect(resolveChoice(PRE_CHOICE, newMoralLedger(), "wield")).toEqual(
      resolveChoice(PRE_CHOICE, newMoralLedger(), "wield")
    );
    expect(resolveChoice(PRE_CHOICE, newMoralLedger(), "free")).toEqual(
      resolveChoice(PRE_CHOICE, newMoralLedger(), "free")
    );
  });
});
