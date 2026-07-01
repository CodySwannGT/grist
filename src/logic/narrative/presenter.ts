/**
 * The pure dialogue/cutscene **presenter** state machine (sub-task #104, Story #92
 * PD-3.1): the deterministic, Phaser-free logic that drives a scripted scene
 * through the presenter UI — advance, branch (where a node forks), and skip — and
 * derives the serializable {@link DialogueView} (speaker, full caption, portrait
 * slot, branch choices, done) the thin Phaser adapter (`src/ui/dialogue`) renders
 * and the UAT bridge reads.
 *
 * Branching *logic* lives here, not in the adapter — exactly as Story #92 scopes
 * it: the presenter folds an enumerated {@link DialoguePresenterInput} over the
 * existing PD-3.0 narrative model ({@link advanceScene} for the linear walk, the
 * node's {@link DialogueChoice}s for a fork) and a terminal `done` flag for skip /
 * end-of-narrative. Like the rest of `logic/narrative` it imports zero Phaser,
 * reads nothing ambient (no `Math.random` / `Date.now` / `performance.now`), and
 * is `(state, input, table) => newState`: the same inputs always yield the same
 * next state and every value round-trips through `JSON.stringify`, so the whole
 * machine is unit-testable headless.
 * @module logic/narrative/presenter
 */
import {
  advanceScene,
  initialNarrativeState,
  isSceneComplete,
} from "./reducers";
import type {
  DialogueChoice,
  DialogueNode,
  NarrativeState,
  SceneDef,
} from "./types";

/** The narrative-table type the presenter reads: scene defs keyed by scene id. */
type SceneTable = Readonly<Record<string, SceneDef>>;

/**
 * The whole pure presenter state: the underlying {@link NarrativeState} cursor (the
 * scene/node position + flag ledger) plus a terminal `done` flag set when the
 * player skips or the narrative reaches its end. Plain, JSON-round-trippable data —
 * the adapter renders it, the UAT bridge reads it, and a save layer could persist
 * it verbatim.
 */
export interface DialoguePresenterState {
  /** The underlying narrative cursor + flag ledger. */
  readonly narrative: NarrativeState;
  /** True once the narrative has ended (skipped or walked off its final node). */
  readonly done: boolean;
}

/** Advance one step along the current node's `next` (or cross scenes at its end). */
export interface AdvanceInput {
  readonly kind: "advance";
}

/** Take a named branch choice at a fork node (crosses to the choice's `to` scene). */
export interface BranchInput {
  readonly kind: "branch";
  /** The id of the {@link DialogueChoice} to take. */
  readonly choiceId: string;
}

/** Skip the rest of the narrative — jump straight to the terminal `done` state. */
export interface SkipInput {
  readonly kind: "skip";
}

/**
 * The enumerated presenter input — the only ways the player drives a scene through
 * the presenter. The thin adapter maps device-tagged intents (confirm/advance,
 * a tapped choice, cancel/skip) onto these; the pure reducer routes by `kind`.
 */
export type DialoguePresenterInput = AdvanceInput | BranchInput | SkipInput;

/** A branch choice as the view-model exposes it (id + label; the `to` is internal). */
export interface DialogueChoiceView {
  readonly id: string;
  readonly label: string;
}

/**
 * The serializable view-model the adapter renders and the UAT bridge reads: the
 * current speaker, the full caption text (full subtitles per ui-ux-and-controls —
 * no partial typewriter state in logic), the portrait slot, the branch choices
 * (empty on a linear node), whether the node is a fork, and whether the narrative
 * has ended. Plain data only — no Phaser, no functions.
 */
export interface DialogueView {
  /** The speaking character's content id. */
  readonly speaker: string;
  /** The full caption line to render (empty once {@link done}). */
  readonly caption: string;
  /** The portrait-slot content id (the node's `portrait`, else its `speaker`). */
  readonly portraitSlot: string;
  /** The branch choices to offer, or an empty list on a linear / ended node. */
  readonly choices: readonly DialogueChoiceView[];
  /** True when the current node is a fork (offers {@link choices}). */
  readonly branching: boolean;
  /** True when the narrative has ended (skipped or off its final node). */
  readonly done: boolean;
  /**
   * The node's deliberate **quiet beat** in milliseconds, or absent when the line
   * carries none. The adapter honors it as a one-shot hold before the line can be
   * advanced (the Sable reveal, PD-3.9 / #114); a linear line omits it and advances
   * immediately.
   */
  readonly beatMs?: number;
}

/**
 * Locate a dialogue node within a scene by id.
 * @param scene - The scene to search.
 * @param nodeId - The node id to find.
 * @returns The node, or `undefined` when no node carries that id.
 */
function findNode(scene: SceneDef, nodeId: string): DialogueNode | undefined {
  return scene.nodes.find(node => node.id === nodeId);
}

/**
 * The dialogue node the presenter cursor currently addresses, or `undefined` when
 * the cursor resolves to no scene/node (a malformed cursor — kept total).
 * @param state - The presenter state.
 * @param table - The scene table.
 * @returns The current node, or `undefined`.
 */
function currentNode(
  state: DialoguePresenterState,
  table: SceneTable
): DialogueNode | undefined {
  const scene = table[state.narrative.sceneId];
  return scene ? findNode(scene, state.narrative.nodeId) : undefined;
}

/**
 * The branch choices offered at the current node, or an empty list when the node
 * is linear / unknown.
 * @param node - The current node (or undefined).
 * @returns The node's choices, or `[]`.
 */
function nodeChoices(
  node: DialogueNode | undefined
): readonly DialogueChoice[] {
  return node?.choices ?? [];
}

/**
 * Build the opening {@link DialoguePresenterState} for a scene: its first node, an
 * empty flag ledger, and `done = false`. Returns `null` when the scene has no nodes
 * (so a cursor can never point at a node that does not exist).
 * @param scene - The scene definition to open.
 * @returns The initial presenter state, or `null` for an empty scene.
 */
export function initialDialoguePresenter(
  scene: SceneDef
): DialoguePresenterState | null {
  const narrative = initialNarrativeState(scene);
  return narrative ? { narrative, done: false } : null;
}

/**
 * Whether the presenter is at the end of the narrative: explicitly `done`, or the
 * cursor sits at a terminal node with no successor scene (and the node is not a
 * fork awaiting a choice).
 * @param state - The presenter state.
 * @param table - The scene table.
 * @returns True when the narrative has ended.
 */
export function isDialogueDone(
  state: DialoguePresenterState,
  table: SceneTable
): boolean {
  if (state.done) {
    return true;
  }
  const node = currentNode(state, table);
  if (node && nodeChoices(node).length > 0) {
    return false;
  }
  return isSceneComplete(state.narrative, table);
}

/**
 * The pure advance reducer: walk the current node's `next` (or cross to the scene's
 * `nextScene` at its end) via {@link advanceScene}, and flip `done` when that walk
 * reaches the end of the narrative. A no-op (input returned unchanged) when the
 * presenter is already done or the cursor sits at a fork — a fork must be resolved
 * by {@link presentDialogue}'s branch arm, never by a blind advance.
 * @param state - The current presenter state (never mutated).
 * @param table - The scene table.
 * @returns The next presenter state.
 */
export function advanceDialogue(
  state: DialoguePresenterState,
  table: SceneTable
): DialoguePresenterState {
  if (state.done) {
    return state;
  }
  const node = currentNode(state, table);
  if (node && nodeChoices(node).length > 0) {
    return state;
  }
  if (isSceneComplete(state.narrative, table)) {
    return { ...state, done: true };
  }
  const narrative = advanceScene(state.narrative, table);
  return { narrative, done: terminalAt(narrative, table) };
}

/**
 * Whether a narrative cursor sits at a true end-of-narrative: a terminal node that
 * is NOT a fork. A fork node (no `next`, no `nextScene`, but with `choices`) looks
 * "scene-complete" to {@link isSceneComplete} yet is not done — it awaits a branch
 * choice. This choice-aware check is what {@link advanceDialogue} flips `done` on,
 * so advancing *into* a fork does not prematurely end the narrative.
 * @param narrative - The narrative cursor to test.
 * @param table - The scene table.
 * @returns True when the cursor is at a non-fork terminal node.
 */
function terminalAt(narrative: NarrativeState, table: SceneTable): boolean {
  const scene = table[narrative.sceneId];
  const node = scene ? findNode(scene, narrative.nodeId) : undefined;
  if (node && nodeChoices(node).length > 0) {
    return false;
  }
  return isSceneComplete(narrative, table);
}

/**
 * The pure branch reducer: take the named choice at the current fork node and cross
 * to its target scene's opening node, carrying the flag ledger forward. A no-op
 * (input returned unchanged, same reference) when the presenter is done, the node
 * is not a fork, the choice id is unknown, or the target scene is missing/empty —
 * so an out-of-range or stray branch can never corrupt the cursor.
 * @param state - The current presenter state (never mutated).
 * @param choiceId - The id of the choice to take.
 * @param table - The scene table.
 * @returns The next presenter state.
 */
function branchDialogue(
  state: DialoguePresenterState,
  choiceId: string,
  table: SceneTable
): DialoguePresenterState {
  if (state.done) {
    return state;
  }
  const node = currentNode(state, table);
  const choice = nodeChoices(node).find(option => option.id === choiceId);
  if (!choice) {
    return state;
  }
  const target = table[choice.to];
  const opening = target ? initialNarrativeState(target) : null;
  if (!opening) {
    return state;
  }
  const narrative: NarrativeState = {
    ...opening,
    flags: state.narrative.flags,
  };
  return { narrative, done: terminalAt(narrative, table) };
}

/**
 * The presenter reducer: route one {@link DialoguePresenterInput} by kind and
 * return the next {@link DialoguePresenterState}, mutating nothing. `advance` walks
 * the chain; `branch` takes a fork choice; `skip` jumps straight to the terminal
 * `done` state. Total and deterministic — every malformed/no-op case returns a
 * well-formed state (the input unchanged where nothing can happen).
 * @param state - The current presenter state (never mutated).
 * @param input - The presenter input to apply.
 * @param table - The scene table.
 * @returns The next presenter state.
 */
export function presentDialogue(
  state: DialoguePresenterState,
  input: DialoguePresenterInput,
  table: SceneTable
): DialoguePresenterState {
  switch (input.kind) {
    case "advance":
      return advanceDialogue(state, table);
    case "branch":
      return branchDialogue(state, input.choiceId, table);
    case "skip":
      // Skip dismisses the dialogue entirely: clear the node cursor so the view
      // renders blank (vs. reaching a final node naturally, which keeps the last
      // line on screen). The scene/flag ledger is preserved for any save layer.
      return state.done
        ? state
        : { narrative: { ...state.narrative, nodeId: "" }, done: true };
  }
}

/** A blank, done view-model — what a skipped/ended presenter renders. */
const DONE_VIEW: DialogueView = {
  speaker: "",
  caption: "",
  portraitSlot: "",
  choices: [],
  branching: false,
  done: true,
};

/**
 * Derive the serializable {@link DialogueView} for the current presenter state. A
 * presenter that has been **skipped** (its cursor cleared) or otherwise addresses
 * no node renders the blank {@link DONE_VIEW}. Otherwise the current node's speaker,
 * full caption, and portrait slot are shown — including at a **naturally reached**
 * final node, where the last line stays on screen and `done` is true (advancing is
 * then a no-op). A fork node renders its choice labels, sets `branching`, and is
 * never `done`; a linear node renders an empty choice list. The portrait slot
 * resolves to the node's explicit `portrait`, falling back to its `speaker`.
 * @param state - The presenter state.
 * @param table - The scene table.
 * @returns The view-model (always non-null; blank-and-done when there is no node).
 */
export function dialogueView(
  state: DialoguePresenterState,
  table: SceneTable
): DialogueView {
  const node = currentNode(state, table);
  if (!node) {
    return DONE_VIEW;
  }
  const choices = nodeChoices(node);
  return {
    speaker: node.speaker,
    caption: node.text,
    portraitSlot: node.portrait ?? node.speaker,
    choices: choices.map(choice => ({ id: choice.id, label: choice.label })),
    branching: choices.length > 0,
    done: isDialogueDone(state, table),
    // Only surface the beat when the node declares one — under
    // exactOptionalPropertyTypes an absent beat is a missing key, not `undefined`,
    // so an ordinary line's view has no `beatMs`.
    ...(node.beatMs === undefined ? {} : { beatMs: node.beatMs }),
  };
}
