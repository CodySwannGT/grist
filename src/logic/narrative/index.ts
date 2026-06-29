/**
 * Public surface of the pure narrative core. The {@link SceneDef} /
 * {@link DialogueNode} / {@link SceneFlag} / {@link NarrativeLedger} model and
 * the two pure reducers — {@link advanceScene} (walk a dialogue graph) and
 * {@link writeLedgerFlag} (fold a named, serializable flag) — plus the
 * fresh-state builders and thin readers. Engine-free and unit-testable, with zero
 * Phaser, zero I/O, and zero RNG. The dialogue presenter (#92) and SaveService
 * (#101) import from here. Re-export only — all logic lives in `./reducers`, all
 * shapes in `./types`.
 * @module logic/narrative
 */
export type {
  DialogueNode,
  NarrativeLedger,
  NarrativeState,
  SceneDef,
  SceneFlag,
  SceneState,
} from "./types";
export {
  advanceScene,
  initialNarrativeState,
  initialSceneState,
  isSceneComplete,
  newNarrativeLedger,
  readLedgerFlag,
  writeLedgerFlag,
} from "./reducers";
