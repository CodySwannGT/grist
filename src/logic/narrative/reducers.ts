/**
 * The pure narrative reducers and their fresh-state builders / readers. Two
 * reducers advance the model: {@link advanceScene} walks the dialogue graph one
 * node at a time and crosses to the next scene at a scene's end, and
 * {@link writeLedgerFlag} folds a single named, serializable moral-ledger flag
 * into the state. Both are `(state, input) => newState`: they mutate nothing,
 * read nothing ambient (no Phaser, no `Math.random` / `Date.now` /
 * `performance.now`), and return a fresh {@link NarrativeState} — so the same
 * `(state, input)` always yields the same next state and the result round-trips
 * through `JSON.stringify` for `SaveService`.
 *
 * Scene advancement is fully deterministic and needs no RNG: a node points at its
 * successor (or, at a scene's end, the scene points at the next scene), so there
 * is no random branch to seed. (Were a future branch to need variance, the
 * seeded `rngStep` / `RngLineage` pattern from `logic/rng` + `logic/save` would be
 * threaded through state — never `Math.random`.)
 * @module logic/narrative/reducers
 */
import type {
  DialogueNode,
  NarrativeLedger,
  NarrativeState,
  SceneDef,
  SceneFlag,
  SceneState,
} from "./types";

/** The narrative-table type the reducers read: scene defs keyed by scene id. */
type SceneTable = Readonly<Record<string, SceneDef>>;

/**
 * A fresh, empty flag ledger — the new-narrative baseline. Pure: same empty
 * record shape every call, with no flags written yet.
 * @returns An empty {@link NarrativeLedger}.
 */
export function newNarrativeLedger(): NarrativeLedger {
  return {};
}

/**
 * Build the opening {@link SceneState} for a scene: its first dialogue node.
 * Returns `null` when the scene has no nodes, so a malformed/empty scene can never
 * produce a cursor pointing at a node that does not exist.
 * @param scene - The scene definition to open.
 * @returns The cursor at the scene's first node, or `null` for an empty scene.
 */
export function initialSceneState(scene: SceneDef): SceneState | null {
  const first = scene.nodes[0];
  return first ? { sceneId: scene.id, nodeId: first.id } : null;
}

/**
 * Build the opening {@link NarrativeState} for a scene: its first node plus an
 * empty flag ledger — the new-game narrative baseline.
 * @param scene - The scene definition to start at.
 * @returns The initial narrative state, or `null` when the scene has no nodes.
 */
export function initialNarrativeState(scene: SceneDef): NarrativeState | null {
  const cursor = initialSceneState(scene);
  return cursor ? { ...cursor, flags: newNarrativeLedger() } : null;
}

/**
 * Read a named flag off the ledger.
 * @param state - The narrative state to read.
 * @param name - The flag name.
 * @returns The flag's value, or `undefined` when it has never been written.
 */
export function readLedgerFlag(
  state: NarrativeState,
  name: string
): SceneFlag | undefined {
  return state.flags[name];
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
 * Whether the cursor sits at a narrative dead-end: a node with no successor in a
 * scene with no following scene. {@link advanceScene} treats this as terminal and
 * returns the state unchanged.
 * @param state - The narrative state.
 * @param table - The scene table.
 * @returns True when there is no next node and no next scene to cross to.
 */
export function isSceneComplete(
  state: NarrativeState,
  table: SceneTable
): boolean {
  const scene = table[state.sceneId];
  if (!scene) return true;
  const node = findNode(scene, state.nodeId);
  return (
    node !== undefined &&
    node.next === undefined &&
    scene.nextScene === undefined
  );
}

/**
 * The pure scene reducer: advance the dialogue cursor one step and return the next
 * {@link NarrativeState}, mutating nothing and reading nothing ambient. Within a
 * scene, the current node's `next` names the successor node. At a scene's terminal
 * node (no `next`), the scene's `nextScene` names the scene to cross to — entered
 * at its first node. The flag ledger is carried forward verbatim. The result is a
 * fresh object (structural copy), so a frozen input is never mutated.
 *
 * Total and deterministic: an unknown scene/node, a `next` that resolves to no
 * node, a `nextScene` that resolves to an empty scene, or a true narrative end
 * (no `next`, no `nextScene`) all return the input state unchanged (same
 * reference) — so the same `(state, table)` always yields the same next state and
 * there is no random branch to seed.
 * @param state - The current narrative state (never mutated).
 * @param table - The scene-definition table, keyed by scene id.
 * @returns The next narrative state, or the input unchanged when it cannot advance.
 */
export function advanceScene(
  state: NarrativeState,
  table: SceneTable
): NarrativeState {
  const scene = table[state.sceneId];
  if (!scene) return state;
  const node = findNode(scene, state.nodeId);
  if (!node) return state;

  if (node.next !== undefined) {
    const target = findNode(scene, node.next);
    return target ? { ...state, nodeId: target.id } : state;
  }

  if (scene.nextScene !== undefined) {
    const next = table[scene.nextScene];
    const opening = next ? initialSceneState(next) : null;
    return opening ? { ...opening, flags: state.flags } : state;
  }

  return state;
}

/**
 * The pure ledger reducer: fold one named, serializable moral-ledger flag into the
 * state and return the next {@link NarrativeState}, mutating nothing. The scene
 * cursor is untouched; only the flag record is rebuilt (a fresh `Record`, so a
 * frozen input ledger is never mutated). A write overwrites any prior value for
 * the same name. The value is a {@link SceneFlag} primitive, so the resulting
 * ledger stays JSON-round-trippable and consumable by `SaveService`.
 * @param state - The current narrative state (never mutated).
 * @param name - The flag name to write.
 * @param value - The serializable flag value (boolean / string / number).
 * @returns The next narrative state with the flag written.
 */
export function writeLedgerFlag(
  state: NarrativeState,
  name: string,
  value: SceneFlag
): NarrativeState {
  return { ...state, flags: { ...state.flags, [name]: value } };
}
