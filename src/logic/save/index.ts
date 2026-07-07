/**
 * Public surface of the pure persistence core. The versioned {@link SaveDataV1}
 * schema, the guarded serialize/deserialize round-trip, and the forward
 * migration chain — engine-free and unit-testable, with zero Phaser and zero
 * I/O. The IndexedDB-touching `SaveService` (`src/services/save-service.ts`)
 * imports from here and is the only place these payloads become bytes.
 * Re-export only — all logic lives in the per-concern modules.
 * @module logic/save
 */
export {
  SAVE_VERSION,
  type CurrentSave,
  type MoralLedger,
  type RngLineage,
  type SaveDataV1,
  type SaveDataV2,
  type SaveDataV3,
  type SaveVersion,
  type SavedBuild,
  type SavedChoice,
  type SavedInventoryItem,
  type SavedLearning,
  type SavedPartyMember,
  type SavedScene,
  type SavedSceneFlag,
  type ShardMode,
} from "./types";
export { asCurrentSave, deserialize, freshSave, serialize } from "./serialize";
export { migrate } from "./migrate";
export { foldSceneProgress, type SceneProgress } from "./scene-progress";
export { foldRunEconomy, type RunEconomy } from "./run-economy";
export { foldLearning, type PersistedLearning } from "./learning";
