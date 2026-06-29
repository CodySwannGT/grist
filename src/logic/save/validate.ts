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
import {
  SAVE_VERSION,
  type CurrentSave,
  type MoralLedger,
  type RngLineage,
  type SavedChoice,
  type SavedInventoryItem,
  type SavedLearning,
  type SavedPartyMember,
  type ShardMode,
} from "./types";

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
  if (
    party === null ||
    inventory === null ||
    learned === null ||
    learning === null ||
    choice === null ||
    moralLedger === null ||
    rng === null ||
    !isFiniteNumber(grist)
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
  };
}
