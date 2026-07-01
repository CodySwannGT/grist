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
 *
 * **World-state (v2).** v2 adds the persisted Act I *reach* / Act II *ashfall*
 * {@link WorldState} flag (#134), imported from `logic/world`. The edge is one-way
 * (`save → world`): the save layer reads the flag's *type*; `logic/world` never
 * imports from `logic/save`, so the import graph stays acyclic.
 *
 * **Build + scene progress (v3).** v3 adds the two axes #116 names that the
 * earlier shapes left to the live registry: the persisted **character build**
 * ({@link SavedBuild} — the bench-bought stat augments and the equipped shards,
 * the "spend grist → change the build" growth the AC requires to survive into a
 * later battle) and the persisted **scene progress** ({@link SavedScene} — the
 * narrative scene/node cursor plus the serializable flag ledger). The build's
 * stat axes mirror `combat/types`' {@link import("../combat/types").Stats} by
 * *type* only (the save records a partial delta, never importing combat values);
 * the scene cursor mirrors `narrative/types`' `SceneState` + `NarrativeLedger`
 * shape so a `logic/narrative` state projects into it verbatim. Both edges stay
 * one-way (`save → {combat,narrative}` type-only), so the import graph stays
 * acyclic. A v2 save migrates forward by forward-filling an empty build and a
 * null (not-yet-entered) scene.
 * @module logic/save/types
 */
import type { Stats } from "../combat/types";
import type { WorldState } from "../world";

/** The current persisted-save schema version. Bump on any shape change. */
export const SAVE_VERSION = 3 as const;

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
 *
 * **Retained as the migration source shape.** v1 is no longer the current version
 * ({@link SaveDataV2} is), so its `version` is pinned to the literal `1` rather
 * than {@link SAVE_VERSION}: the migration chain (`./migrate`) lifts a stored v1
 * payload forward to v2, and this interface is the input shape that lift carries.
 */
export interface SaveDataV1 {
  /** The schema version discriminant (the literal `1`). */
  readonly version: 1;
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
 * Version 2 of the persisted save: {@link SaveDataV1} plus the persisted Act I
 * *reach* / Act II *ashfall* {@link WorldState} flag (#134), the deterministic
 * flag every region/encounter/economy value resolves through.
 *
 * **Retained as a migration source shape.** v2 is no longer the current version
 * ({@link SaveDataV3} is), so its `version` is pinned to the literal `2` rather
 * than {@link SAVE_VERSION}: the migration chain (`./migrate`) lifts a stored v2
 * payload forward to v3, and this interface is the input shape that lift carries.
 */
export interface SaveDataV2 extends Omit<SaveDataV1, "version"> {
  /** The schema version discriminant (the literal `2`). */
  readonly version: 2;
  /** The persisted Act I/II world-state flag (the Reckoning flips it to `ashfall`). */
  readonly worldState: WorldState;
}

/**
 * The persisted **character build** (#116): the cross-battle growth the bench
 * grows and the AC requires to survive into a later battle. Two axes the live
 * registry held but no prior save shape persisted:
 *
 * - `statBonuses` — the permanent stat augments bought at the bench ("spend grist
 *   → change the build"; Runner's Reflex → +2 SPD). A partial {@link Stats}
 *   delta: only the bonused axes are present, mirroring `RunState.statBonuses`.
 * - `equippedShards` — the shards the bench has equipped, by id, in equip order.
 *   Recorded by string id (a {@link import("../../content/bounds").BoundId} is a
 *   string union) so the save embeds no live object, mirroring how the roster and
 *   `learning` lists persist ids, not instances.
 *
 * Plain serializable data — no behavior, deep-equal-comparable — so it round-trips
 * through `JSON.stringify` and restores exactly (the "growth persists" AC).
 */
export interface SavedBuild {
  /** The permanent stat augments bought at the bench (a partial {@link Stats} delta). */
  readonly statBonuses: Partial<Stats>;
  /** The shards equipped at the bench, by id, in equip order. */
  readonly equippedShards: readonly string[];
}

/**
 * A single serializable scene flag — the moral-ledger flag the AC names and any
 * other narrative flag a scene writes. A plain primitive (a boolean resolution, a
 * string variant tag, or a numeric tally), never an object/function/class, so the
 * flag ledger stays deep-equal-comparable and survives a save round-trip. Mirrors
 * `narrative/types`' `SceneFlag` by structure (type-only) so a narrative state
 * projects in verbatim without this layer importing `logic/narrative`.
 */
export type SavedSceneFlag = boolean | string | number;

/**
 * The persisted **scene progress** (#116): the narrative scene/node cursor plus
 * the serializable flag ledger, so reopening the game restores *where in the
 * story* the player was — not just their party and economy. Mirrors
 * `narrative/types`' `SceneState` (the `sceneId` / `nodeId` cursor) and
 * `NarrativeLedger` (the flag `Record`) by structure, so a live `NarrativeState`
 * projects into it verbatim. A `Record` of primitives (not a `Map`, whose
 * identity would not serialize) keeps the whole ledger JSON-round-trippable.
 */
export interface SavedScene {
  /** The id of the scene the player is parked at. */
  readonly sceneId: string;
  /** The id of the dialogue node currently being shown. */
  readonly nodeId: string;
  /** The named, serializable scene flags written by the run so far. */
  readonly flags: Readonly<Record<string, SavedSceneFlag>>;
}

/**
 * Version 3 of the persisted save: {@link SaveDataV2} plus the persisted
 * {@link SavedBuild character build} and {@link SavedScene scene progress} (#116).
 * `scene` is `null` until the player has entered a narrative scene (a fresh run
 * has not started the story), distinguishing "no scene yet" from an authored
 * scene cursor. A v2 save migrates forward by forward-filling an empty build
 * (no augments, no equipped shards) and a `null` scene.
 */
export interface SaveDataV3 extends Omit<SaveDataV2, "version"> {
  /** The schema version discriminant (always {@link SAVE_VERSION}). */
  readonly version: SaveVersion;
  /** The persisted character build: bench stat augments + equipped shards. */
  readonly build: SavedBuild;
  /** The persisted scene/dialogue progress, or `null` before any scene is entered. */
  readonly scene: SavedScene | null;
}

/**
 * The newest save shape the runtime understands. Aliased so call sites and the
 * `SaveService` depend on "the current save" rather than a version-pinned name;
 * when a `SaveDataV4` is introduced, this alias and {@link SAVE_VERSION} move
 * together.
 */
export type CurrentSave = SaveDataV3;
