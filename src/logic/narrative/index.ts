/**
 * Public surface of the pure narrative core. The {@link SceneDef} /
 * {@link DialogueNode} / {@link DialogueChoice} / {@link SceneFlag} /
 * {@link NarrativeLedger} model, the two scene reducers — {@link advanceScene}
 * (walk a dialogue graph) and {@link writeLedgerFlag} (fold a named, serializable
 * flag) — and the pure dialogue **presenter** state machine ({@link presentDialogue}
 * / {@link dialogueView}: advance, branch, skip + the rendered view-model), plus
 * the fresh-state builders and thin readers. Engine-free and unit-testable, with
 * zero Phaser, zero I/O, and zero RNG. The thin presenter adapter (`src/ui/dialogue`,
 * #104) and SaveService (#101) import from here. Re-export only — all presenter
 * logic lives in `./presenter`, all scene logic in `./reducers`, all shapes in
 * `./types`.
 * @module logic/narrative
 */
export type {
  DialogueChoice,
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
export type {
  AdvanceInput,
  BranchInput,
  DialogueChoiceView,
  DialoguePresenterInput,
  DialoguePresenterState,
  DialogueView,
  SkipInput,
} from "./presenter";
export {
  advanceDialogue,
  dialogueView,
  initialDialoguePresenter,
  isDialogueDone,
  presentDialogue,
} from "./presenter";
export type { OpeningFlowState } from "./opening";
export {
  buildOpeningAmbushLaunch,
  foldRevealFlag,
  isAtRevealNode,
  newOpeningFlow,
} from "./opening";
