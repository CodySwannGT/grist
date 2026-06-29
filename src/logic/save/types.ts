/**
 * The versioned persisted-save schema for the slice. `SaveDataV1` is the single
 * serializable snapshot of cross-slice run state — party, the shared grist
 * wallet, inventory, learned/learning spell progression, the resolved shard
 * choice, the {@link MoralLedger}, and the rng lineage — that the persistence
 * layer writes and restores so a save survives a page reload (PRD #41 FR9 / AC7,
 * and the persistence half of AC5).
 *
 * This module is pure data and pure types: zero Phaser, zero I/O, no
 * `Math.random` / `Date.now`. The IndexedDB-touching `SaveService`
 * (`src/services/save-service.ts`) is the only thing that turns these payloads
 * into bytes; everything here stays engine-free and unit-testable. The producers
 * of the state being persisted (economy #73, learning #74, choice #75) populate
 * these fields — this sub-task only defines and persists their shape.
 *
 * **Versioning.** Every payload carries a numeric `version` discriminant.
 * {@link SAVE_VERSION} is the current schema version; bump it and add the
 * `n → n+1` step to the migration chain (`src/logic/save/migrate.ts`) whenever
 * the shape changes, so an older player's save is migrated forward rather than
 * silently dropped or crash-loaded.
 * @module logic/save/types
 */

/** The current persisted-save schema version. Bump on any shape change. */
export const SAVE_VERSION = 1 as const;

/** The current schema version's literal type (the `version` discriminant). */
export type SaveVersion = typeof SAVE_VERSION;

/**
 * The two ways a shard can be carried, persisted by id rather than by object
 * reference so the payload stays plain, serializable data. Mirrors the
 * Free/Wield split in `content/bounds` (#79) without importing it — the save
 * layer records the *choice*, the content table owns the *rules*.
 */
export type ShardMode = "free" | "wield";

/**
 * A persisted party member: stable id, level, and (optionally) the equipped
 * shard with the mode it is carried in. Referenced by id so the save never
 * embeds live combat objects.
 */
export interface SavedPartyMember {
  /** The party-member id (resolves to a `content/party` entry). */
  readonly id: string;
  /** The member's level at save time. */
  readonly level: number;
  /** The equipped shard id, when one is equipped. */
  readonly shard?: string;
  /** The mode the equipped shard is carried in, when one is equipped. */
  readonly shardMode?: ShardMode;
}

/** A persisted inventory line: an item id and a whole, non-negative quantity. */
export interface SavedInventoryItem {
  /** The item id. */
  readonly id: string;
  /** The held quantity (whole, non-negative). */
  readonly qty: number;
}

/** A persisted in-progress spell unlock: the spell id and its [0,1] progress. */
export interface SavedLearning {
  /** The spell id being learned. */
  readonly spell: string;
  /** Unlock progress in the half-open range [0, 1). */
  readonly progress: number;
}

/**
 * The persisted free-vs-wield resolution (PRD #41 AC5). Before the choice is
 * resolved, `resolved` is `false` and the shard/variant are absent; once
 * resolved it records which shard variant the player committed to.
 */
export interface SavedChoice {
  /** Whether the free-or-wield choice has been resolved. */
  readonly resolved: boolean;
  /** The chosen shard id (present once resolved). */
  readonly shard?: string;
  /** The chosen carry mode (present once resolved). */
  readonly variant?: ShardMode;
}

/**
 * The running moral tally the slice's thesis turns on (PRD #41 AC5): the net
 * `karma` flag plus the count of free vs. wield resolutions. Persisted so the
 * choice's consequences survive a reload.
 */
export interface MoralLedger {
  /** Net karma: positive leans free/safe, negative leans wield/corrupt. */
  readonly karma: number;
  /** How many resolutions chose the Free attunement. */
  readonly freeChoices: number;
  /** How many resolutions chose the Wield (corruption) carry. */
  readonly wieldChoices: number;
}

/**
 * The rng lineage: the immutable origin `seed` and the live mulberry32 `state`
 * threaded through the sim (mirrors `BattleState.seed` / `BattleState.rngState`
 * in `logic/combat/types`). Persisted verbatim and restored exactly so the run
 * stays deterministic across a reload — the state is **never** regenerated.
 */
export interface RngLineage {
  /** The immutable origin seed. */
  readonly seed: number;
  /** The live 32-bit mulberry32 generator state. */
  readonly state: number;
}

/**
 * Version 1 of the persisted save. A complete, deep-equal-comparable snapshot of
 * the run; serialize/deserialize must restore it exactly (AC7).
 */
export interface SaveDataV1 {
  /** The schema version discriminant (always {@link SAVE_VERSION}). */
  readonly version: SaveVersion;
  /** The persisted party roster. */
  readonly party: readonly SavedPartyMember[];
  /** The shared grist wallet balance. */
  readonly grist: number;
  /** The persisted inventory. */
  readonly inventory: readonly SavedInventoryItem[];
  /** Fully-unlocked spell ids. */
  readonly learned: readonly string[];
  /** In-progress spell unlocks. */
  readonly learning: readonly SavedLearning[];
  /** The free-vs-wield resolution. */
  readonly choice: SavedChoice;
  /** The running moral tally. */
  readonly moralLedger: MoralLedger;
  /** The rng lineage (seed + live state). */
  readonly rng: RngLineage;
}

/**
 * The newest save shape the runtime understands. Aliased so call sites and the
 * `SaveService` depend on "the current save" rather than a version-pinned name;
 * when a `SaveDataV2` is introduced, this alias and {@link SAVE_VERSION} move
 * together.
 */
export type CurrentSave = SaveDataV1;
