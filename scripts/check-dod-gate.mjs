#!/usr/bin/env node
/**
 * check-dod-gate — the per-increment Definition-of-Done (DoD) gate (issue #127).
 *
 * Per PRD #43 (Phase 4), an increment is "done" only once it has actually been
 * PLAYED and proven — nothing ships on the strength of "it compiles." This is
 * the single, reusable, enforceable gate that codifies that promise. For a given
 * increment it asserts ALL FOUR lanes are satisfied:
 *   1. `tests/logic` unit lane (incl. the determinism state-hash twin) is green,
 *   2. `typecheck` is green,
 *   3. a COMMITTED `tests/e2e` UAT play-through (driven through `window.__VERIFY__`,
 *      sampling `.hash()`) is present, non-empty, and green, and
 *   4. the determinism contract held (same seed + same action sequence ⇒ identical
 *      `hashState` progression; a different seed diverges).
 *
 * An increment that compiles and passes unit tests + typecheck but ships NO
 * committed play-through is FAILED — unit tests, lint, and typecheck alone are
 * not acceptable (PRD #43 AC2/AC8-AC10; FR10).
 *
 * The decision is a PURE function ({@link evaluateDodGate}) that does zero I/O so
 * it is unit-testable headlessly in `tests/logic` (zero Phaser, zero filesystem,
 * zero wall-clock). The CLI `main()` gathers the lane facts from the repo
 * (committed-spec presence/non-emptiness + each lane's exit) and exits non-zero
 * when the gate FAILs. Determinism is the literal subject of the gate, so the
 * gate itself uses no `Math.random` / `Date.now` / `performance.now`.
 *
 * Reuse, do NOT re-implement: the determinism digest is `src/logic/combat/hash.ts`
 * (`hashState`, FNV-1a); the seeded stream is `src/logic/rng.ts`; the e2e seam is
 * `src/uat/bridge.ts` (`window.__VERIFY__`). This script only AGGREGATES those
 * existing lanes into one gate.
 *
 * Inputs (CLI, all via env, CI-friendly):
 *   DOD_LOGIC_PASSED       "1" when the tests/logic unit lane passed.
 *   DOD_TYPECHECK_PASSED   "1" when `tsc --noEmit` passed.
 *   DOD_E2E_PASSED         "1" when the tests/e2e Playwright lane passed.
 *   DOD_DETERMINISM_HELD   "1" when the determinism contract held (defaults to
 *                          DOD_LOGIC_PASSED, since the headless twin lives in the
 *                          logic lane and asserts it).
 *
 * Exit 0 = the increment is done. Exit 1 = the gate blocks it.
 * @module scripts/check-dod-gate
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * The ordered set of lanes the DoD gate scores. Stable identifiers so callers
 * (and the unit suite) can index `result.lanes` without restating the list.
 * @type {readonly ["logic", "typecheck", "e2e", "determinism"]}
 */
export const DOD_LANES = ["logic", "typecheck", "e2e", "determinism"];

/**
 * A committed e2e/verification play-through path lives in a top-level `e2e/`
 * dir, a nested `tests/e2e/` tree, or a `tests/verification/` tree — the same
 * convention `check-verification-coverage.mjs` enforces.
 */
const PLAY_THROUGH_PATH = /^e2e\/|(^|\/)tests\/(e2e|verification)\//;

/**
 * Pure DoD decision: PASS only when EVERY lane of the increment is satisfied —
 * logic + typecheck + e2e all green, the determinism contract held, AND every
 * required committed spec (logic twin + e2e play-through) is present. "Compiles
 * + unit-passes" with NO committed play-through is rejected. No I/O, no clock.
 * @param {object} input - Evaluation input.
 * @param {import("./check-dod-gate").DodIncrement} input.increment - The increment descriptor.
 * @param {import("./check-dod-gate").DodObservations} input.observations - The gathered lane facts.
 * @returns {import("./check-dod-gate").DodVerdict} The structured verdict.
 */
export function evaluateDodGate({ increment, observations }) {
  const requiredLogic = increment.requiredLogicSpecs ?? [];
  const requiredE2e = increment.requiredE2eSpecs ?? [];
  const presentLogic = observations.presentLogicSpecs ?? [];
  const presentE2e = observations.presentE2eSpecs ?? [];

  // Every required spec must be among the present (committed, non-empty) specs.
  const logicSpecsPresent = requiredLogic.every(spec =>
    presentLogic.includes(spec)
  );
  const e2eSpecsPresent =
    requiredE2e.length > 0 &&
    requiredE2e.every(spec => presentE2e.includes(spec));

  const lanes = Object.freeze({
    logic: Boolean(observations.logicPassed) && logicSpecsPresent,
    typecheck: Boolean(observations.typecheckPassed),
    // A green e2e RUN is not enough — the play-through must also be COMMITTED.
    e2e: Boolean(observations.e2ePassed) && e2eSpecsPresent,
    determinism: Boolean(observations.determinismHeld),
  });

  const missing = [];
  if (!observations.logicPassed) {
    missing.push("logic");
  }
  if (!logicSpecsPresent) {
    missing.push("required-logic-spec");
  }
  if (!observations.typecheckPassed) {
    missing.push("typecheck");
  }
  if (!e2eSpecsPresent) {
    missing.push("committed-e2e-play-through");
  }
  if (!observations.e2ePassed) {
    missing.push("e2e");
  }
  if (!observations.determinismHeld) {
    missing.push("determinism");
  }
  // Dedupe while preserving order (e2e-run + e2e-evidence both map to e2e lane).
  const missingUnique = Object.freeze([...new Set(missing)]);

  const ok = missingUnique.length === 0;
  const reason = ok
    ? `Increment "${increment.name}" is done: all four lanes (logic, typecheck, e2e play-through, determinism) are satisfied with committed evidence.`
    : `Increment "${increment.name}" is NOT "done": unmet lanes/evidence — ${missingUnique.join(
        ", "
      )}. Unit tests + lint + typecheck alone are not acceptable; a committed e2e play-through and held determinism are required.`;

  return { ok, lanes, missing: missingUnique, reason };
}

/**
 * Read an env flag as a boolean ("1"/"true" ⇒ true). Deterministic.
 * @param {string} name - The env var name.
 * @param {boolean} [fallback] - Value when the var is unset.
 * @returns {boolean} The parsed flag.
 */
function envFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * Decide whether a committed spec counts as a real, bridge-driving play-through:
 * it must exist, be non-empty, and (for e2e specs) actually drive the
 * verification bridge (`__VERIFY__`) and sample the state `hash`. A present but
 * inert file does NOT satisfy the gate.
 * @param {string} spec - Repo-relative spec path.
 * @param {boolean} requireBridge - Whether the spec must drive `__VERIFY__.hash()`.
 * @returns {boolean} True when the committed spec is present and meaningful.
 */
function isCommittedSpecPresent(spec, requireBridge) {
  if (!existsSync(spec)) {
    return false;
  }
  const content = readFileSync(spec, "utf8");
  if (content.trim().length === 0) {
    return false;
  }
  if (!requireBridge) {
    return true;
  }
  return content.includes("__VERIFY__") && content.includes(".hash(");
}

/**
 * Gather the lane observations for an increment from the filesystem + env.
 * Filesystem-derived and deterministic — no wall-clock, no network.
 * @param {import("./check-dod-gate").DodIncrement} increment - The increment descriptor.
 * @returns {import("./check-dod-gate").DodObservations} The gathered observations.
 */
function gatherObservations(increment) {
  const logicPassed = envFlag("DOD_LOGIC_PASSED");
  const presentLogicSpecs = (increment.requiredLogicSpecs ?? []).filter(spec =>
    isCommittedSpecPresent(spec, false)
  );
  const presentE2eSpecs = (increment.requiredE2eSpecs ?? []).filter(
    spec => PLAY_THROUGH_PATH.test(spec) && isCommittedSpecPresent(spec, true)
  );
  return {
    logicPassed,
    typecheckPassed: envFlag("DOD_TYPECHECK_PASSED"),
    e2ePassed: envFlag("DOD_E2E_PASSED"),
    // The determinism twin lives in the logic lane and asserts the contract, so
    // it defaults to the logic-lane result unless explicitly overridden.
    determinismHeld: envFlag("DOD_DETERMINISM_HELD", logicPassed),
    presentLogicSpecs,
    presentE2eSpecs,
  };
}

/**
 * The #127 increment: the determinism state-hash gate + per-increment DoD harness.
 * @type {import("./check-dod-gate").DodIncrement}
 */
const INCREMENT_127 = Object.freeze({
  name: "127-determinism-dod",
  requiredLogicSpecs: Object.freeze([
    "tests/logic/combat-determinism.test.ts",
    "tests/logic/dod-gate.test.ts",
  ]),
  requiredE2eSpecs: Object.freeze(["tests/e2e/play-to-victory.spec.ts"]),
});

/**
 * CLI entry: gather the increment's lane facts from the repo + env, evaluate the
 * pure gate, and exit non-zero when it blocks. Deterministic — no wall-clock.
 * @returns {void}
 */
function main() {
  const increment = INCREMENT_127;
  const observations = gatherObservations(increment);
  const result = evaluateDodGate({ increment, observations });
  console.log(
    `[dod-gate] increment=${increment.name} lanes=${JSON.stringify(
      result.lanes
    )}`
  );
  console.log(`[dod-gate] ${result.reason}`);
  if (!result.ok) {
    console.error(`[dod-gate] FAIL: missing=[${result.missing.join(",")}]`);
    process.exit(1);
  }
  console.log("[dod-gate] OK");
}

// Run only when invoked directly — importing for tests must have no side effects.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
