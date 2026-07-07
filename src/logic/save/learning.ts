/**
 * The pure **learning-progression write-through** projection (#264): fold a live run's
 * spell-learning progress — the spells permanently learned and the spells in progress —
 * into a {@link CurrentSave}, so the progress a player earns *in play* (equipping a
 * shard begins Cinder; a bench Accelerate advances it) persists into the same
 * `SaveDataV3.learned` / `SaveDataV3.learning` fields the save has modeled since v1 and
 * {@link import("../save-run").runStateFromSave Continue} restores. Closes the #264 gap
 * where the equipped shard persisted but its learning reset, so the Bench read
 * "equipped (learning Cinder)" **and** "Cinder: not begun (equip the shard)" at once.
 *
 * **No save-version bump.** `learned` (spell ids) and `learning` (spell + [0, 1)
 * progress) are original v1 fields — nothing wrote them from the live run before, so
 * this projection only fills existing slots and a v3 save round-trips losslessly (the
 * economy/build precedent, #235). Engine-free: no Phaser, no I/O, no RNG — the same
 * `(save, learning)` always yields the same next save and it round-trips through
 * `JSON.stringify`, so it is unit-testable headless — the Phaser-free twin of the
 * `SaveService` write the Bench performs when learning commits.
 *
 * **Replace, not merge — the run is authoritative.** Like `foldRunEconomy` (and unlike
 * `foldSceneProgress`, whose flags accumulate across independent beats), the live
 * {@link RunState} carries the *complete* current learning: a continued run rehydrates
 * its learning from this same save before play resumes, so a later write never drops
 * what an earlier session grew. This projection sets `learned` + `learning` wholesale
 * from the run — every *other* field the save holds (grist, build, scene progress,
 * party, world-state, choice, moral ledger, the rng lineage) is preserved verbatim by
 * the spread, so the learning write never clobbers a narrative beat's flag or the
 * determinism-critical rng state.
 *
 * **Structural, not nominal.** {@link PersistedLearning} mirrors the save's learning
 * axes ({@link SavedLearning}) by shape, so a live run's projected learning
 * (`logic/spell-learning`'s `toPersistedLearning`) folds in without this pure-save layer
 * taking an import edge on `logic/run-state` or `logic/spell-learning` — the same
 * one-way "the run projects into the save" discipline `foldRunEconomy` follows.
 * @module logic/save/learning
 */
import type { CurrentSave, SavedLearning } from "./types";

/**
 * The live run's learning progression a Bench/Field scene projects into the save: the
 * completed spell ids and the in-progress spells as [0, 1) fractions. Every field is a
 * plain, JSON-round-trippable primitive (or an array of them), structurally the save's
 * `learned` + `learning` axes, so a live run's projected learning passes in without an
 * import edge.
 */
export interface PersistedLearning {
  /** Spells permanently learned, by id. */
  readonly learned: readonly string[];
  /** Spells in progress, with their [0, 1) unlock fraction. */
  readonly learning: readonly SavedLearning[];
}

/**
 * Fold a run's {@link PersistedLearning} into a save, returning the next
 * {@link CurrentSave} with its {@link CurrentSave.learned} + {@link CurrentSave.learning}
 * set from the live run and every other field preserved verbatim. Mutates nothing (a
 * fresh save with fresh, copied `learned` / `learning` arrays so the save never aliases
 * the live run's collections). The run is authoritative for the learning progression, so
 * the write is a wholesale replace — the grist, build, scene progress, party,
 * world-state, choice, moral ledger, and rng lineage the save already holds survive
 * untouched.
 * @param save - The save to fold into (never mutated).
 * @param learning - The live run's projected learning progression.
 * @returns The next save carrying the restored-on-Continue learning progression.
 */
export function foldLearning(
  save: CurrentSave,
  learning: PersistedLearning
): CurrentSave {
  return {
    ...save,
    learned: [...learning.learned],
    learning: learning.learning.map(entry => ({
      spell: entry.spell,
      progress: entry.progress,
    })),
  };
}
