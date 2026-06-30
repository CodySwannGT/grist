/**
 * Pure Ch.1 OPENING-FLOW logic (sub-task #105, PD-3.2) — the deterministic,
 * Phaser-free helpers the thin Opening scene adapter consumes to drive the
 * cold-start opening to the Sable reveal and hand off to the tutorial ambush.
 *
 * The Opening scene mounts the #92 dialogue presenter over the authored
 * {@link CH1_SCRIPT} (in `content/scenes/ch1`) and renders Wren in the Marrow.
 * This module owns the two flow decisions that must stay pure so they unit-test
 * headless and never fork the sim:
 *
 * 1. {@link isAtRevealNode} — whether the presenter cursor currently addresses the
 *    Ch.1 reveal node (`cargo-opens`). The adapter checks this each step and, when
 *    true, folds the {@link OpeningFlowState.revealed} flag (and writes the
 *    serializable `sable-revealed` ledger flag) — reducers never auto-write flags,
 *    so the "hook has landed" signal is data the adapter folds at the reveal beat.
 * 2. {@link buildOpeningAmbushLaunch} — the deterministic {@link BattleLaunchData}
 *    the adapter starts the Battle scene with when the narrative ends: the
 *    {@link CH1_AMBUSH_ENCOUNTER tutorial ambush} encounter id plus a battle seed
 *    derived from the opening seed via the seeded {@link rngStep} (NEVER
 *    `Math.random` / `Date.now`), so the same cold-start seed always launches the
 *    same winnable fight and the existing autoWin driver clears it.
 *
 * Engine-free and total: zero Phaser, no I/O, no ambient reads — the same inputs
 * always yield the same outputs, and {@link OpeningFlowState} round-trips through
 * `JSON.stringify` for any save layer.
 * @module logic/narrative/opening
 */
import type { BattleLaunchData } from "../../consts";
import {
  CH1_AMBUSH_ENCOUNTER,
  CH1_REVEAL_NODE_ID,
} from "../../content/scenes/ch1";
import { rngStep } from "../rng";
import type { DialoguePresenterState } from "./presenter";
import type { SceneDef } from "./types";

/** The narrative-table type the opening flow reads: scene defs keyed by scene id. */
type SceneTable = Readonly<Record<string, SceneDef>>;

/**
 * The serializable opening-flow flag the adapter folds at the reveal beat — "the
 * cargo has opened and Sable is revealed". A plain boolean so the flow state stays
 * JSON-round-trippable (the same discipline as the narrative ledger). The Opening
 * scene exposes it to the verification bridge so the e2e can assert the reveal
 * empirically on the live canvas.
 */
export interface OpeningFlowState {
  /** True once the presenter cursor has reached the Ch.1 reveal node. */
  readonly revealed: boolean;
}

/**
 * A fresh opening-flow state: Sable not yet revealed. Pure — the new-cold-start
 * baseline, same shape every call.
 * @returns The initial opening-flow state.
 */
export function newOpeningFlow(): OpeningFlowState {
  return { revealed: false };
}

/**
 * Whether the presenter cursor currently addresses the Ch.1 reveal node
 * (`cargo-opens`) — the "cargo opens to reveal Sable" beat. The adapter checks this
 * each advance and folds the reveal flag the moment it is true, so the flag is data
 * written by the adapter at the reveal beat, never auto-written by a reducer. Pure:
 * reads only the cursor's node id against the constant.
 * @param presenter - The current dialogue-presenter state.
 * @param _table - The scene table (accepted for call-site symmetry; unused).
 * @returns True when the cursor sits at the reveal node.
 */
export function isAtRevealNode(
  presenter: DialoguePresenterState,
  _table: SceneTable
): boolean {
  return presenter.narrative.nodeId === CH1_REVEAL_NODE_ID;
}

/**
 * Fold the reveal flag into the opening flow — "the hook has landed". Idempotent
 * (a second fold returns an equal state) and pure: returns fresh state, mutating
 * nothing. The adapter calls this when {@link isAtRevealNode} is true.
 * @param flow - The current opening-flow state (never mutated).
 * @returns The flow with {@link OpeningFlowState.revealed} set.
 */
export function foldRevealFlag(flow: OpeningFlowState): OpeningFlowState {
  return flow.revealed ? flow : { ...flow, revealed: true };
}

/**
 * Build the deterministic {@link BattleLaunchData} the Opening scene hands the
 * Battle scene when the narrative ends: the {@link CH1_AMBUSH_ENCOUNTER tutorial
 * ambush} encounter id plus a battle seed derived from the opening seed via the
 * seeded {@link rngStep}. Deriving (not reusing) the seed threads a distinct,
 * reproducible battle stream per cold-start while keeping the launch a pure
 * function of the opening seed — the same seed always launches the same winnable
 * fight, so the deterministic autoWin driver clears it with no flaky RNG. Pure:
 * no `Math.random`, no `Date.now`.
 * @param openingSeed - The 32-bit cold-start opening seed.
 * @returns The launch payload naming the tutorial ambush + its derived battle seed.
 */
export function buildOpeningAmbushLaunch(
  openingSeed: number
): BattleLaunchData {
  // Advance the seeded stream once so the battle seed is a deterministic function
  // of the opening seed yet distinct from it — never the wall clock.
  const battleSeed = rngStep(openingSeed >>> 0).state;
  return {
    encounterId: CH1_AMBUSH_ENCOUNTER,
    seed: battleSeed,
  };
}
