/**
 * Structural validation for an untrusted candidate save payload. {@link asCurrentSave}
 * is the gate that turns a parsed-but-untyped value into a typed
 * {@link CurrentSave} — or `null` when any field is malformed — so a corrupt or
 * foreign save never enters the run as a half-valid object. Pure and total: no
 * Phaser, no I/O, no `Math.random` / `Date.now`, and never a throw.
 *
 * This lives in its own module (rather than alongside `serialize`) so both the
 * serialize/deserialize boundary and the migration chain can validate without
 * importing each other — keeping the save package's import graph acyclic
 * (`types ← validate ← {serialize, migrate}`).
 * @module logic/save/validate
 */
import { type WorldState } from "../world";
import {
  SAVE_VERSION,
  type CurrentSave,
  type MoralLedger,
  type RngLineage,
  type SavedBuild,
  type SavedChoice,
  type SavedInventoryItem,
  type SavedLearning,
  type SavedPartyMember,
  type SavedScene,
  type SavedSceneFlag,
  type ShardMode,
} from "./types";

/**
 * The stat axes a {@link SavedBuild.statBonuses} delta may carry — the keys of
 * `combat/types`' `Stats`, listed here as plain strings so the validator stays
 * type-only-coupled to combat (it never imports a `Stats` value). Any other key
 * in a stored `statBonuses` record is corruption, not a bonus, and rejects the
 * save.
 */
const STAT_AXES: readonly string[] = [
  "hp",
  "ap",
  "pow",
  "foc",
  "def",
  "wrd",
  "spd",
  "lck",
];

/** A plain JSON object (the shape `JSON.parse` yields for `{...}`). */
type JsonObject = Record<string, unknown>;

/**
 * Whether a parsed value is a non-null, non-array plain object — the precondition
 * for treating it as a candidate payload.
 * @param value - The value to test.
 * @returns True when `value` is a plain object.
 */
function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether a value is a finite number (rejects `NaN` / `Infinity`, which would
 * survive `JSON.parse` as `null` but must never enter the run).
 * @param value - The value to test.
 * @returns True when `value` is a finite number.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Whether a value is a whole, non-negative number — a count (inventory `qty`).
 * Enforces the schema's stated bound ("whole, non-negative") so a tampered or
 * corrupt save with a negative or fractional count is rejected rather than
 * trusted by a downstream consumer.
 * @param value - The candidate value.
 * @returns True when `value` is an integer `>= 0`.
 */
function isWholeNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Whether a value is a positive integer — a level (a party member's `level` is
 * `1`-based). Rejects zero, negative, or fractional levels.
 * @param value - The candidate value.
 * @returns True when `value` is an integer `>= 1`.
 */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * Whether a value is a unit-interval fraction in `[0, 1)` — learning progress.
 * Enforces the schema's stated range so a progress past 100% (or negative) can
 * never load.
 * @param value - The candidate value.
 * @returns True when `value` is a number in the half-open range `[0, 1)`.
 */
function isUnitFraction(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value < 1;
}

/**
 * Whether a value is a valid {@link ShardMode}.
 * @param value - The candidate value.
 * @returns True when `value` is `"free"` or `"wield"`.
 */
function isShardMode(value: unknown): value is ShardMode {
  return value === "free" || value === "wield";
}

/**
 * Whether a value is a valid {@link WorldState}. Guards the v2 `worldState` field
 * so a save with an absent or out-of-domain flag (a tampered or pre-v2 raw blob
 * that skipped the migration chain) is rejected rather than loaded with an invalid
 * Act flag.
 * @param value - The candidate value.
 * @returns True when `value` is `"reach"` or `"ashfall"`.
 */
function isWorldState(value: unknown): value is WorldState {
  return value === "reach" || value === "ashfall";
}

/**
 * Validate one persisted party member.
 * @param value - The candidate value.
 * @returns The typed member, or `null` when invalid.
 */
function asPartyMember(value: unknown): SavedPartyMember | null {
  if (!isObject(value)) return null;
  const id = value["id"];
  const level = value["level"];
  const shard = value["shard"];
  const shardMode = value["shardMode"];
  if (typeof id !== "string" || !isPositiveInteger(level)) return null;
  if (shard !== undefined && typeof shard !== "string") return null;
  if (shardMode !== undefined && !isShardMode(shardMode)) return null;
  // An equipped shard and its carry mode are a unit: a shard without a mode (or a
  // mode without a shard) is an impossible equipment state, so reject the whole
  // member rather than load a half-equipped party slot.
  if ((shard === undefined) !== (shardMode === undefined)) return null;
  return {
    id,
    level,
    ...(typeof shard === "string" ? { shard } : {}),
    ...(isShardMode(shardMode) ? { shardMode } : {}),
  };
}

/**
 * Validate one inventory line.
 * @param value - The candidate value.
 * @returns The typed item, or `null` when invalid.
 */
function asInventoryItem(value: unknown): SavedInventoryItem | null {
  if (!isObject(value)) return null;
  const id = value["id"];
  const qty = value["qty"];
  if (typeof id !== "string" || !isWholeNonNegative(qty)) return null;
  return { id, qty };
}

/**
 * Validate one in-progress learning entry.
 * @param value - The candidate value.
 * @returns The typed entry, or `null` when invalid.
 */
function asLearning(value: unknown): SavedLearning | null {
  if (!isObject(value)) return null;
  const spell = value["spell"];
  const progress = value["progress"];
  if (typeof spell !== "string" || !isUnitFraction(progress)) return null;
  return { spell, progress };
}

/**
 * Map-validate an array: returns the typed array, or `null` if any element is
 * invalid (a partially-valid collection is treated as corruption, not silently
 * trimmed).
 * @param value - The candidate array.
 * @param item - The per-element validator.
 * @returns The typed array, or `null` when `value` is not an all-valid array.
 */
function asArray<T>(
  value: unknown,
  item: (element: unknown) => T | null
): readonly T[] | null {
  if (!Array.isArray(value)) return null;
  return value.reduce<readonly T[] | null>((acc, element) => {
    if (acc === null) return null;
    const parsed = item(element);
    return parsed === null ? null : [...acc, parsed];
  }, []);
}

/**
 * Validate a string array (the `learned` list).
 * @param value - The candidate value.
 * @returns The typed array, or `null` when invalid.
 */
function asStringArray(value: unknown): readonly string[] | null {
  return asArray(value, e => (typeof e === "string" ? e : null));
}

/**
 * Validate the persisted choice.
 * @param value - The candidate value.
 * @returns The typed choice, or `null` when invalid.
 */
function asChoice(value: unknown): SavedChoice | null {
  if (!isObject(value)) return null;
  const resolved = value["resolved"];
  const shard = value["shard"];
  const variant = value["variant"];
  if (typeof resolved !== "boolean") return null;
  if (shard !== undefined && typeof shard !== "string") return null;
  if (variant !== undefined && !isShardMode(variant)) return null;
  // The shard variant is present iff the choice is resolved: a resolved choice
  // with no shard/variant — or an unresolved one carrying them — violates the
  // schema contract (PRD #41 AC5) and is rejected rather than loaded.
  const hasResolution = shard !== undefined && variant !== undefined;
  if (resolved !== hasResolution) return null;
  return {
    resolved,
    ...(typeof shard === "string" ? { shard } : {}),
    ...(isShardMode(variant) ? { variant } : {}),
  };
}

/**
 * Validate the moral ledger.
 * @param value - The candidate value.
 * @returns The typed ledger, or `null` when invalid.
 */
function asMoralLedger(value: unknown): MoralLedger | null {
  if (!isObject(value)) return null;
  const karma = value["karma"];
  const freeChoices = value["freeChoices"];
  const wieldChoices = value["wieldChoices"];
  // karma is a signed net flag; the choice counters are counts (whole, non-
  // negative), so a negative or fractional counter is corruption, not state.
  if (
    !isFiniteNumber(karma) ||
    !isWholeNonNegative(freeChoices) ||
    !isWholeNonNegative(wieldChoices)
  ) {
    return null;
  }
  return { karma, freeChoices, wieldChoices };
}

/**
 * Validate the rng lineage.
 * @param value - The candidate value.
 * @returns The typed lineage, or `null` when invalid.
 */
function asRngLineage(value: unknown): RngLineage | null {
  if (!isObject(value)) return null;
  const seed = value["seed"];
  const state = value["state"];
  if (!isFiniteNumber(seed) || !isFiniteNumber(state)) return null;
  return { seed, state };
}

/**
 * Validate the persisted stat-bonus delta: a partial `Stats` record whose only
 * keys are known stat axes ({@link STAT_AXES}) and whose every value is a finite
 * number. An unknown key (corruption / a tampered axis) or a non-finite bonus
 * rejects the whole save rather than loading a build with a phantom or `NaN` stat.
 * Built by reduction (not mutation) so the result is a fresh frozen-safe record.
 * @param value - The candidate `statBonuses` value.
 * @returns The typed partial-stats delta, or `null` when invalid.
 */
function asStatBonuses(value: unknown): SavedBuild["statBonuses"] | null {
  if (!isObject(value)) return null;
  return Object.keys(value).reduce<SavedBuild["statBonuses"] | null>(
    (acc, key) => {
      if (acc === null) return null;
      if (!STAT_AXES.includes(key)) return null;
      const bonus = value[key];
      if (!isFiniteNumber(bonus)) return null;
      return { ...acc, [key]: bonus };
    },
    {}
  );
}

/**
 * Validate the persisted character build (#116): a `statBonuses` partial-stats
 * delta plus an `equippedShards` string-id list. A malformed sub-axis rejects the
 * whole save (no silent trim), mirroring the rest of the validator.
 * @param value - The candidate `build` value.
 * @returns The typed build, or `null` when invalid.
 */
function asBuild(value: unknown): SavedBuild | null {
  if (!isObject(value)) return null;
  const statBonuses = asStatBonuses(value["statBonuses"]);
  const equippedShards = asStringArray(value["equippedShards"]);
  if (statBonuses === null || equippedShards === null) return null;
  return { statBonuses, equippedShards };
}

/**
 * Whether a value is a valid {@link SavedSceneFlag}: a plain primitive (boolean,
 * string, or finite number). A `NaN`/`Infinity` numeric flag, or an object /
 * array / null, is rejected so the flag ledger only ever holds serializable
 * primitives.
 * @param value - The candidate flag value.
 * @returns True when `value` is a boolean, string, or finite number.
 */
function isSceneFlag(value: unknown): value is SavedSceneFlag {
  return (
    typeof value === "boolean" ||
    typeof value === "string" ||
    isFiniteNumber(value)
  );
}

/**
 * Validate the persisted scene-flag ledger: a `Record` whose every value is a
 * {@link SavedSceneFlag} primitive. A non-primitive flag value rejects the whole
 * save. Built by reduction so the result is a fresh record, never the untrusted
 * input object.
 * @param value - The candidate `flags` value.
 * @returns The typed flag ledger, or `null` when invalid.
 */
function asSceneFlags(value: unknown): SavedScene["flags"] | null {
  if (!isObject(value)) return null;
  return Object.keys(value).reduce<SavedScene["flags"] | null>((acc, key) => {
    if (acc === null) return null;
    const flag = value[key];
    if (!isSceneFlag(flag)) return null;
    return { ...acc, [key]: flag };
  }, {});
}

/**
 * Validate a *present* scene cursor: a `{ sceneId, nodeId, flags }` object with
 * string ids and a valid flag ledger, or `null` when the value is malformed. The
 * not-yet-entered state (a literal `null` scene) is handled by the caller
 * ({@link asCurrentSave}) before this runs, so a `null` return here always means
 * "malformed", never "no scene".
 * @param value - The candidate (known non-null) `scene` value.
 * @returns The typed scene, or `null` when the object is malformed.
 */
function asScene(value: unknown): SavedScene | null {
  if (!isObject(value)) return null;
  const sceneId = value["sceneId"];
  const nodeId = value["nodeId"];
  const flags = asSceneFlags(value["flags"]);
  if (typeof sceneId !== "string" || typeof nodeId !== "string") return null;
  if (flags === null) return null;
  return { sceneId, nodeId, flags };
}

/**
 * Structurally validate a candidate object as a current-version
 * {@link CurrentSave}. This is the gate the current version's read path runs;
 * older versions reach it only after the migration chain has lifted them
 * forward. A single malformed field rejects the whole payload (`null`) so the
 * caller falls back to a fresh save rather than loading partial state.
 * @param value - The candidate object (already known to be version-current).
 * @returns The typed save, or `null` when any field is invalid.
 */
export function asCurrentSave(value: unknown): CurrentSave | null {
  if (!isObject(value) || value["version"] !== SAVE_VERSION) return null;
  const party = asArray(value["party"], asPartyMember);
  const inventory = asArray(value["inventory"], asInventoryItem);
  const learned = asStringArray(value["learned"]);
  const learning = asArray(value["learning"], asLearning);
  const choice = asChoice(value["choice"]);
  const moralLedger = asMoralLedger(value["moralLedger"]);
  const rng = asRngLineage(value["rng"]);
  const grist = value["grist"];
  const worldState = value["worldState"];
  const build = asBuild(value["build"]);
  // `scene` legitimately may be null (no scene entered yet). Distinguish that
  // valid `null` from a malformed scene object: a present non-null value must
  // validate, but a literal `null` passes through as the not-yet-entered state.
  const rawScene = value["scene"];
  const scene = rawScene === null ? null : asScene(rawScene);
  const sceneInvalid = rawScene !== null && scene === null;
  if (
    party === null ||
    inventory === null ||
    learned === null ||
    learning === null ||
    choice === null ||
    moralLedger === null ||
    rng === null ||
    !isFiniteNumber(grist) ||
    !isWorldState(worldState) ||
    build === null ||
    sceneInvalid
  ) {
    return null;
  }
  return {
    version: SAVE_VERSION,
    party,
    grist,
    inventory,
    learned,
    learning,
    choice,
    moralLedger,
    rng,
    worldState,
    build,
    scene,
  };
}
