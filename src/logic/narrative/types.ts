/**
 * Pure, Phaser-free narrative primitives: the scene / dialogue-node / flag shapes
 * and the serializable narrative state the reducers advance. These are the typed
 * foundation the dialogue presenter (#92) renders and the persistence layer
 * (`SaveService`) can consume — every field is plain, JSON-serializable data
 * (primitives, records, arrays of primitives), with no Phaser, no I/O, no
 * randomness, and no class instances or functions embedded in state. So the whole
 * tree typechecks under plain `tsc`, round-trips through `JSON.stringify`, and is
 * unit-testable headless.
 *
 * Mirrors the immutability discipline of `logic/combat/types` — `readonly`
 * throughout — so a reducer can only produce new state, never mutate the old.
 * @module logic/narrative/types
 */

/**
 * A single serializable narrative-flag value. The "moral-ledger flag" the
 * acceptance criterion names is one of these: a plain primitive (a boolean
 * Free/Wield resolution, a string variant tag, or a numeric tally) so the flag
 * record stays deep-equal-comparable and consumable by `SaveService` — never an
 * object, function, or class instance that would not survive a save round-trip.
 */
export type SceneFlag = boolean | string | number;

/**
 * The named, serializable flag ledger threaded on {@link NarrativeState}: a plain
 * `Record` keyed by flag name. A `Record` of primitives (not a `Map`, whose
 * non-primitive identity would not serialize) keeps the whole ledger JSON-round-
 * trippable so the moral-ledger flag a scene writes is persistable as-is.
 */
export type NarrativeLedger = Readonly<Record<string, SceneFlag>>;

/**
 * One line of dialogue inside a scene: its stable `id`, the `speaker` and `text`
 * to render, and the `id` of the node it advances to. `next` is absent on the
 * scene's terminal node — {@link advanceScene} then crosses to the scene's
 * `nextScene` (or ends the narrative when that is absent too). Referenced by id,
 * never by object identity, so the graph stays plain serializable data.
 */
export interface DialogueNode {
  /** The stable node id, unique within its scene. */
  readonly id: string;
  /** The character speaking this line (a content id the presenter resolves). */
  readonly speaker: string;
  /** The line of dialogue to render. */
  readonly text: string;
  /** The id of the next node in this scene, or absent at the scene's last node. */
  readonly next?: string;
}

/**
 * A scene definition: an ordered, addressable-by-id graph of {@link DialogueNode}s
 * plus the id of the scene to cross to when this one ends. Pure content data — the
 * reducers read it, scenes render it, and it embeds no behavior.
 */
export interface SceneDef {
  /** The stable scene id. */
  readonly id: string;
  /** The scene's dialogue nodes (addressed by id, not array position). */
  readonly nodes: readonly DialogueNode[];
  /** The id of the scene that follows this one, or absent at the final scene. */
  readonly nextScene?: string;
}

/**
 * The cursor half of {@link NarrativeState}: which scene and dialogue node the
 * player is parked at. Split out so a reducer (or a reader) can address the
 * position independently of the flag ledger, the way combat addresses a combatant
 * by `{ side, index }`.
 */
export interface SceneState {
  /** The id of the scene currently being played. */
  readonly sceneId: string;
  /** The id of the dialogue node currently being shown. */
  readonly nodeId: string;
}

/**
 * The whole pure narrative state the reducers advance: the scene/node cursor plus
 * the serializable {@link NarrativeLedger} of moral-ledger flags. Plain, frozen-
 * safe, JSON-round-trippable data — scenes render it, the reducers fold it, and
 * `SaveService` can persist the flag record verbatim. The same `(state, input)`
 * always yields the same next state; nothing here reads `Math.random` / `Date.now`
 * / `performance.now`.
 */
export interface NarrativeState extends SceneState {
  /** The named, serializable moral-ledger flags written by the run so far. */
  readonly flags: NarrativeLedger;
}
