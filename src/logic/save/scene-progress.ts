/**
 * The pure **scene-progress write-through** projection (#223): fold a dialogue
 * scene's live narrative cursor + flag ledger into a {@link CurrentSave}'s
 * {@link SaveDataV3.scene}, so the moral-ledger flags a beat records *in play* persist
 * into the same `SaveDataV3.scene.flags` ledger the Reckoning (#125) and reunion
 * (#140) beats already write — no save-version bump. Engine-free: no Phaser, no I/O,
 * no RNG. The same `(save, progress)` always yields the same next save and the result
 * round-trips through `JSON.stringify`, so it is unit-testable headless — the
 * Phaser-free twin of the `SaveService` write the Dialogue scene performs when its
 * cursor folds a flag.
 *
 * **Merge, never replace.** A beat's write folds its flags OVER whatever the save
 * already carries (an earlier beat's `sable-revealed`, the Reckoning's `sable-lost`,
 * a reunion's status), so a later record never drops an earlier one — mirroring how
 * `reckoningStatusFlags` spreads its flags onto the prior ledger. The scene cursor
 * advances to the beat currently being recorded.
 *
 * **Structural, not nominal.** {@link SceneProgress} mirrors `narrative/types`'
 * `NarrativeState` (`sceneId` / `nodeId` / `flags`) by shape, so a live
 * `NarrativeState` projects in verbatim without this pure-save layer taking an import
 * edge on `logic/narrative` — the same one-way "narrative projects into save"
 * discipline `SavedScene`'s own doc-comment describes.
 * @module logic/save/scene-progress
 */
import type { CurrentSave, SavedSceneFlag } from "./types";

/**
 * The live narrative progress a dialogue scene projects into the save: its scene/node
 * cursor plus the flag ledger folded so far. Structurally a `narrative/types`
 * `NarrativeState`, so a live one passes in without an import edge — every field is a
 * plain, JSON-round-trippable primitive (or a record of them).
 */
export interface SceneProgress {
  /** The id of the scene the player is parked at. */
  readonly sceneId: string;
  /** The id of the dialogue node currently being shown. */
  readonly nodeId: string;
  /** The named, serializable scene flags folded so far. */
  readonly flags: Readonly<Record<string, SavedSceneFlag>>;
}

/**
 * Fold a dialogue scene's {@link SceneProgress} into a save, returning the next
 * {@link CurrentSave} with its {@link SaveDataV3.scene} set to the current cursor and
 * its flags MERGED over any the save already holds. Mutates nothing (a fresh `scene`
 * with a fresh `flags` record); a save whose `scene` is `null` (a run that had not yet
 * entered the story) gains one. The merge order (`{ ...prior, ...progress.flags }`)
 * means a re-record overwrites only its own prior value while every unrelated flag —
 * from any other beat — survives verbatim.
 * @param save - The save to fold into (never mutated).
 * @param progress - The live narrative cursor + folded flags.
 * @returns The next save carrying the merged scene progress.
 */
export function foldSceneProgress(
  save: CurrentSave,
  progress: SceneProgress
): CurrentSave {
  const prior = save.scene?.flags ?? {};
  return {
    ...save,
    scene: {
      sceneId: progress.sceneId,
      nodeId: progress.nodeId,
      flags: { ...prior, ...progress.flags },
    },
  };
}
