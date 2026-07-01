/**
 * Pure serialize / deserialize for the persisted save — the engine-free, I/O-free
 * core the IndexedDB `SaveService` wraps. {@link serialize} writes the canonical
 * JSON string the store holds verbatim; {@link deserialize} parses an untrusted
 * stored string, lifts an older payload forward through the {@link migrate}
 * chain, and (inside migrate) validates the result, so a reload restores the
 * snapshot deep-equal exactly (PRD #41 AC7 / AC5) while a corrupt or foreign
 * payload yields `null` (never a throw or a half-loaded run). The structural
 * validation itself lives in `./validate` so this module and `./migrate` can both
 * use it without importing each other.
 * @module logic/save/serialize
 */
import { INITIAL_WORLD_STATE } from "../world";
import { migrate } from "./migrate";
import { SAVE_VERSION, type CurrentSave } from "./types";

export { asCurrentSave } from "./validate";

/**
 * A fresh, empty save at the current version — the new-game baseline and the
 * value the service falls back to when no save exists. Pure: same shape every
 * call, with no live state to regenerate.
 *
 * The rng lineage is a `{ seed: 0, state: 0 }` **placeholder**: a fresh save has
 * not started a run, so it carries no real seed. The new-game flow (and the
 * producing slices) seed the run from a real source before any roll — a saved
 * run always overwrites this — so the degenerate `0` state is never rolled
 * against. It exists only so the shape is complete and round-trippable.
 *
 * `worldState` starts in {@link INITIAL_WORLD_STATE} (Act I `reach`): a new game
 * begins before the Reckoning, so a fresh save and a fresh run agree on the start
 * state.
 *
 * `build` starts empty (no bench stat augments, no equipped shards) and `scene`
 * is `null` (#116): a new game has neither grown a build nor entered a narrative
 * scene, so both axes start at their "nothing yet" baseline rather than a
 * fabricated cursor.
 * @returns A new {@link CurrentSave} with empty cross-slice state.
 */
export function freshSave(): CurrentSave {
  return {
    version: SAVE_VERSION,
    party: [],
    grist: 0,
    inventory: [],
    learned: [],
    learning: [],
    choice: { resolved: false },
    moralLedger: { karma: 0, freeChoices: 0, wieldChoices: 0 },
    rng: { seed: 0, state: 0 },
    worldState: INITIAL_WORLD_STATE,
    build: { statBonuses: {}, equippedShards: [] },
    scene: null,
  };
}

/**
 * Serialize a save to its canonical JSON string. The `version` is re-stamped
 * from {@link SAVE_VERSION} so a serialized payload always advertises the schema
 * it was written under.
 * @param save - The save to serialize.
 * @returns The JSON string.
 */
export function serialize(save: CurrentSave): string {
  return JSON.stringify({ ...save, version: SAVE_VERSION });
}

/**
 * Parse JSON without throwing.
 * @param text - The candidate JSON string.
 * @returns The parsed value, or `null` on a syntax error.
 */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Deserialize a stored JSON string back into a current-version save. Total and
 * guarded: malformed JSON, a non-object value, a missing/unknown version, or a
 * structurally-invalid payload all yield `null` (the caller falls back to a
 * {@link freshSave}) rather than throwing or loading a half-valid run. An older
 * but recognized version is lifted forward through {@link migrate} first, so a
 * legacy save is restored, never dropped.
 *
 * A payload already at the current version still routes through {@link migrate},
 * whose final step is {@link asCurrentSave} — so the structural validation runs
 * uniformly for both fresh and migrated payloads.
 * @param text - The stored JSON string.
 * @returns The restored current-version save, or `null` when unrecoverable.
 */
export function deserialize(text: string): CurrentSave | null {
  const parsed = parseJson(text);
  if (parsed === null) return null;
  return migrate(parsed);
}
