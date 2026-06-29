/**
 * The per-increment Definition-of-Done (DoD) gate (issue #127). Verification IS
 * UAT, not unit-tests-alone: an increment is "done" only once ALL FOUR lanes are
 * satisfied — (1) the `tests/logic` unit lane (incl. the determinism state-hash
 * twin), (2) `typecheck`, (3) a committed `tests/e2e` UAT play-through driven
 * through `window.__VERIFY__`, and (4) the determinism contract (same seed +
 * same action sequence ⇒ identical hash; a different seed diverges). "It
 * compiles and the unit tests pass" with NO committed play-through is explicitly
 * REJECTED — that is the gate's whole point.
 *
 * This suite proves the pure {@link evaluateDodGate} decision headlessly (zero
 * Phaser, zero filesystem, zero wall-clock), which is what makes AC2 — "the DoD
 * gate blocks an increment with no committed play evidence" — verifiable in the
 * `tests/logic` lane. The filesystem gathering lives in the script's `main()`
 * and is exercised by `bun run verify:dod`; the decision is exercised here.
 *
 * [EVIDENCE: dod-gate-blocks-on-missing-evidence]
 * @module tests/logic/dod-gate
 */
import { describe, expect, it } from "vitest";

import {
  DOD_LANES,
  evaluateDodGate,
  type DodIncrement,
  type DodObservations,
} from "../../scripts/check-dod-gate.mjs";

/** The canonical #127 increment descriptor the gate is applied to. */
const INCREMENT_127: DodIncrement = {
  name: "127-determinism-dod",
  requiredLogicSpecs: ["tests/logic/combat-determinism.test.ts"],
  requiredE2eSpecs: ["tests/e2e/play-to-victory.spec.ts"],
};

/** A fully-satisfied set of lane observations — every lane green, evidence committed. */
const SATISFIED: DodObservations = {
  logicPassed: true,
  typecheckPassed: true,
  e2ePassed: true,
  determinismHeld: true,
  presentLogicSpecs: ["tests/logic/combat-determinism.test.ts"],
  presentE2eSpecs: ["tests/e2e/play-to-victory.spec.ts"],
};

describe("per-increment DoD gate (evaluateDodGate)", () => {
  it("PASSES an increment whose four lanes are all satisfied with committed evidence", () => {
    const result = evaluateDodGate({
      increment: INCREMENT_127,
      observations: SATISFIED,
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    // Every named lane is reported green.
    for (const lane of DOD_LANES) {
      expect(result.lanes[lane]).toBe(true);
    }
  });

  it("BLOCKS an increment that passes unit + typecheck but has NO committed play-through (AC2)", () => {
    // The defining failure mode: it compiles, the logic unit lane is green, but
    // there is no committed e2e UAT play-through and the e2e lane never ran.
    const compilesButUnplayed: DodObservations = {
      ...SATISFIED,
      e2ePassed: false,
      presentE2eSpecs: [],
    };
    const result = evaluateDodGate({
      increment: INCREMENT_127,
      observations: compilesButUnplayed,
    });
    expect(result.ok).toBe(false);
    // The gate names the missing committed play-through explicitly.
    expect(result.missing).toContain("committed-e2e-play-through");
    // Unit + typecheck being green is NOT enough on its own.
    expect(result.lanes.logic).toBe(true);
    expect(result.lanes.typecheck).toBe(true);
    expect(result.lanes.e2e).toBe(false);
    expect(result.reason).toMatch(/not "done"|play|evidence/i);
  });

  it("BLOCKS when a required logic spec is missing", () => {
    const result = evaluateDodGate({
      increment: INCREMENT_127,
      observations: { ...SATISFIED, presentLogicSpecs: [] },
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("required-logic-spec");
  });

  it("BLOCKS when the determinism contract did not hold even with everything else green", () => {
    const result = evaluateDodGate({
      increment: INCREMENT_127,
      observations: { ...SATISFIED, determinismHeld: false },
    });
    expect(result.ok).toBe(false);
    expect(result.lanes.determinism).toBe(false);
    expect(result.missing).toContain("determinism");
  });

  it("is a pure function — identical input yields identical output, no side effects", () => {
    const a = evaluateDodGate({
      increment: INCREMENT_127,
      observations: SATISFIED,
    });
    const b = evaluateDodGate({
      increment: INCREMENT_127,
      observations: SATISFIED,
    });
    expect(a).toEqual(b);
  });
});
