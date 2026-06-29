/**
 * The forward migration chain for persisted saves. A stored payload advertises
 * its schema `version`; on load it is walked forward one step at a time
 * (`n → n+1`) until it reaches {@link SAVE_VERSION}, then structurally validated.
 * This is what lets the schema evolve without dropping an older player's save or
 * crash-loading a stale shape (the issue's "versioned with a migration path"
 * acceptance criterion).
 *
 * To add a future version: bump {@link SAVE_VERSION} in `./types`, define the
 * new `SaveDataV{n}` interface, and register the `n-1 → n` step in
 * {@link MIGRATIONS}. The chain runner and the read path need no other changes.
 *
 * Pure and total: a non-object, an un-versioned object, or a version newer than
 * the runtime understands all yield `null` (the caller falls back to a fresh
 * save) — migration never throws. Carried fields survive each step verbatim; in
 * particular the rng lineage is reshaped, never regenerated, so the run stays
 * deterministic across an upgrade (no `Math.random` / `Date.now`).
 * @module logic/save/migrate
 */
import {
  SAVE_VERSION,
  type CurrentSave,
  type MoralLedger,
  type RngLineage,
} from "./types";
import { asCurrentSave } from "./validate";

/** A plain JSON object carrying at least a finite numeric `version`. */
type VersionedPayload = Readonly<Record<string, unknown>> & {
  readonly version: number;
};

/**
 * One forward migration step: lift a payload from version `n` to the shape of
 * version `n+1`. The result is still loosely typed — the next step (or the final
 * structural validation in {@link migrate}) narrows it. A step only forward-fills
 * new axes with safe defaults and re-stamps `version`; it reads nothing ambient.
 */
type MigrationStep = (payload: VersionedPayload) => VersionedPayload;

/** A safe zero-state moral ledger for forward-filling a pre-ledger save. */
const EMPTY_LEDGER: MoralLedger = {
  karma: 0,
  freeChoices: 0,
  wieldChoices: 0,
};

/**
 * Read a finite number off a loose record, falling back when it is absent or not
 * a finite number. Keeps each migration step total — a missing numeric field
 * forward-fills to a safe default rather than producing `NaN`.
 * @param source - The loose stored record.
 * @param key - The property to read.
 * @param fallback - The value when the property is missing or non-finite.
 * @returns The finite number, or the fallback.
 */
function numberOr(
  source: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number
): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Recover the rng lineage from a pre-v1 save. v0 stored the seed and live state
 * as flat `seed` / `rngState` fields (mirroring `BattleState`); v1 nests them
 * under `rng`. The state is carried verbatim — never regenerated — so the run
 * stays deterministic across the upgrade.
 * @param source - The loose v0 record.
 * @returns The v1 rng lineage.
 */
function rngFromV0(source: Readonly<Record<string, unknown>>): RngLineage {
  const seed = numberOr(source, "seed", 0);
  return { seed, state: numberOr(source, "rngState", seed) };
}

/**
 * Lift a hypothetical v0 save to v1. v0 is the pre-persistence-slice flat blob
 * (party + grist + flat rng, no choice / ledger / learning axes); v1 introduces
 * the cross-slice run state. Carried fields survive; the new axes forward-fill to
 * safe empty defaults so a v0 player keeps their progress and gains the new
 * structure resolved-to-nothing.
 * @param payload - The loose v0 record.
 * @returns A v1-shaped payload (validated by the caller before it is handed back).
 */
const migrateV0ToV1: MigrationStep = payload => {
  const party = payload["party"];
  const inventory = payload["inventory"];
  const learned = payload["learned"];
  const learning = payload["learning"];
  return {
    version: 1,
    party: Array.isArray(party) ? party : [],
    grist: numberOr(payload, "grist", 0),
    inventory: Array.isArray(inventory) ? inventory : [],
    learned: Array.isArray(learned) ? learned : [],
    learning: Array.isArray(learning) ? learning : [],
    choice: { resolved: false },
    moralLedger: EMPTY_LEDGER,
    rng: rngFromV0(payload),
  };
};

/**
 * The migration registry, keyed by the *source* version each step upgrades from.
 * `MIGRATIONS[n]` lifts a v`n` payload to v`n+1`. Add the next step here (and
 * bump {@link SAVE_VERSION}) when the shape changes; {@link runChain} picks it up
 * with no other wiring.
 */
const MIGRATIONS: Readonly<Record<number, MigrationStep>> = {
  0: migrateV0ToV1,
};

/**
 * Whether a value is a plain object carrying a finite numeric `version`. The
 * chain entry guard — anything failing this (null, an array, a primitive, an
 * un-versioned blob) cannot be migrated.
 * @param value - The parsed but untrusted value.
 * @returns True when the value is a versioned object record.
 */
function isVersioned(value: unknown): value is VersionedPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { version?: unknown }).version === "number" &&
    Number.isFinite((value as { version: number }).version)
  );
}

/**
 * Walk a versioned payload forward until it reaches {@link SAVE_VERSION}.
 * Recursion (not a `let` loop) keeps each hop explicit and total: a payload
 * already at the current version is the base case (returned untouched), and a
 * missing step for some intermediate version means an un-migratable payload,
 * which yields `null`.
 * @param payload - The versioned payload at some version `≤ SAVE_VERSION`.
 * @returns The payload re-shaped to the current version, or `null` if a step is missing.
 */
function runChain(payload: VersionedPayload): VersionedPayload | null {
  if (payload.version === SAVE_VERSION) {
    return payload;
  }
  const step = MIGRATIONS[payload.version];
  if (step === undefined) {
    return null;
  }
  const next = step(payload);
  // Guard against a buggy future step that fails to advance (or overshoots) the
  // version: a step MUST strictly increase the version and stay within range, or
  // the recursion could loop forever / skip validation. Fail safe instead.
  if (next.version <= payload.version || next.version > SAVE_VERSION) {
    return null;
  }
  return runChain(next);
}

/**
 * Migrate an arbitrary stored value forward to a *validated* current-version
 * save. Returns `null` when the value is not a versioned object, when its version
 * is newer than the runtime understands (no down-migration), when an
 * intermediate migration step is missing, or when the migrated result fails
 * structural validation — so a corrupt or foreign payload always fails safe to a
 * fresh save at the call site rather than loading a half-valid run.
 * @param value - The stored value (already JSON-parsed, still untyped).
 * @returns The validated current-version save, or `null` when unrecoverable.
 */
export function migrate(value: unknown): CurrentSave | null {
  if (!isVersioned(value)) {
    return null;
  }
  // A version newer than this runtime cannot be down-migrated — fail safe.
  if (value.version > SAVE_VERSION) {
    return null;
  }
  const lifted = runChain(value);
  return lifted === null ? null : asCurrentSave(lifted);
}
