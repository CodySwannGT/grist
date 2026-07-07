/**
 * The persisted-save → **ending-standing** seam (#244) — the single pure mapper that
 * turns a run's {@link CurrentSave} into the {@link EndingStanding} the #142 ending-gate
 * resolver reads, so the finale wired into the World Map (`scenes/Finale`) resolves its
 * reachable ending-choice from the *same* accumulated ledger the run persisted, not a
 * re-derivation. It composes — never re-specs — {@link standingFromLedger}: the karma +
 * Free/Wield tally come from the persisted {@link MoralLedger}, the world-state from the
 * save, and the reunion count from the persisted scene flags.
 *
 * Reunion completion is recorded as a persisted scene flag under the
 * {@link REUNION_COMPLETE_FLAG_PREFIX} namespace (`reunion:<id>` truthy) — the
 * forward-compatible seam a reunion node writes when its companion is recruited. Until a
 * reunion is completed no such flag exists, so a fresh Ashfall run reaches only the
 * always-available `sunder` default (the finale is never a dead end), and each recruited
 * companion lifts the reachable-ending set exactly as the gates prescribe.
 *
 * Pure — data-in / data-out, no Phaser, no I/O, no RNG — so the same save always yields
 * the same standing and the mapping is unit-testable headless.
 * @module logic/narrative/finale-standing
 */
import { type CurrentSave, type SavedSceneFlag } from "../save";
import { standingFromLedger, type EndingStanding } from "./endings";

/**
 * The scene-flag namespace a completed reunion writes to the persisted save
 * (`reunion:<reunionId>` with a truthy value). {@link reunionsCompletedFromFlags} counts
 * the truthy flags under this prefix, so the finale's standing tracks who the run
 * reassembled without the endings core depending on the reunion catalog.
 */
export const REUNION_COMPLETE_FLAG_PREFIX = "reunion:";

/**
 * Count the reunions a run has completed from its persisted scene flags: the number of
 * truthy flags under the {@link REUNION_COMPLETE_FLAG_PREFIX} namespace. Pure — reads
 * only the flag record. A `0` value / empty string counts as not-completed (so a cleared
 * flag never inflates the count).
 * @param flags - The persisted scene-flag record (`save.scene.flags`).
 * @returns The number of completed reunions.
 */
export function reunionsCompletedFromFlags(
  flags: Readonly<Record<string, SavedSceneFlag>>
): number {
  return Object.entries(flags).filter(
    ([key, value]) =>
      key.startsWith(REUNION_COMPLETE_FLAG_PREFIX) && Boolean(value)
  ).length;
}

/**
 * Map a persisted save into the accumulated {@link EndingStanding} the ending gates read
 * — the world-state, the {@link MoralLedger} karma + Free/Wield tally, and the count of
 * completed reunions from the scene flags. The one seam the finale scene calls to resolve
 * its reachable ending-choice from real run state. Pure.
 * @param save - The persisted run save.
 * @returns The distilled standing the ending gates read.
 */
export function standingFromSave(save: CurrentSave): EndingStanding {
  return standingFromLedger(
    save.worldState,
    save.moralLedger,
    reunionsCompletedFromFlags(save.scene?.flags ?? {})
  );
}
