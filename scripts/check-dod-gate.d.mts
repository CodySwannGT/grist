/**
 * Type declarations for the per-increment Definition-of-Done gate (issue #127).
 * The runtime lives in `check-dod-gate.mjs`; these types let the `tests/logic`
 * unit suite (and `tsc --noEmit`) consume the pure {@link evaluateDodGate}
 * decision with full typing while the script itself stays a plain ESM `.mjs`.
 * @module scripts/check-dod-gate
 */

/**
 * One increment's DoD descriptor: the committed specs that MUST exist for the
 * increment to be "done". Globs are repo-relative paths. Deterministic — purely
 * a description of what the gate requires, with no runtime state.
 */
export interface DodIncrement {
  /** Increment identifier, e.g. `"127-determinism-dod"`. */
  readonly name: string;
  /** `tests/logic` specs (incl. the determinism twin) that MUST be committed and non-empty. */
  readonly requiredLogicSpecs: readonly string[];
  /** `tests/e2e` / `tests/verification` play-through specs that MUST be committed and drive `__VERIFY__.hash()`. */
  readonly requiredE2eSpecs: readonly string[];
}

/**
 * The observed satisfaction of each lane, gathered from the repo by the CLI and
 * passed into the pure evaluator. Booleans + present-spec lists only — the
 * evaluator itself performs no I/O.
 */
export interface DodObservations {
  /** The `tests/logic` unit lane (incl. the determinism twin) passed. */
  readonly logicPassed: boolean;
  /** `tsc --noEmit` passed. */
  readonly typecheckPassed: boolean;
  /** The `tests/e2e` Playwright lane passed. */
  readonly e2ePassed: boolean;
  /** The determinism contract held (same seed ⇒ same hash; different seed diverges). */
  readonly determinismHeld: boolean;
  /** Committed, non-empty logic-spec paths actually found. */
  readonly presentLogicSpecs: readonly string[];
  /** Committed, non-empty, bridge-driving e2e play-through paths actually found. */
  readonly presentE2eSpecs: readonly string[];
}

/** The per-lane PASS/FAIL scoring keyed by the {@link DOD_LANES} identifiers. */
export interface DodLanes {
  readonly logic: boolean;
  readonly typecheck: boolean;
  readonly e2e: boolean;
  readonly determinism: boolean;
}

/** The structured verdict the gate returns. */
export interface DodVerdict {
  /** True only when every lane is satisfied with committed evidence. */
  readonly ok: boolean;
  /** Per-lane scoring. */
  readonly lanes: DodLanes;
  /** Unmet lane/evidence identifiers (empty when `ok`). */
  readonly missing: readonly string[];
  /** Human-readable explanation of the verdict. */
  readonly reason: string;
}

/** The ordered set of lanes the DoD gate scores. */
export declare const DOD_LANES: readonly [
  "logic",
  "typecheck",
  "e2e",
  "determinism",
];

/**
 * Pure DoD decision: PASS only when every lane of the increment is satisfied —
 * logic + typecheck + e2e all green, the determinism contract held, AND every
 * required committed spec is present. No I/O, no clock.
 * @param input - Increment descriptor + gathered lane observations.
 * @returns The structured verdict.
 */
export declare function evaluateDodGate(input: {
  readonly increment: DodIncrement;
  readonly observations: DodObservations;
}): DodVerdict;
