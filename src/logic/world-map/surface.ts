/**
 * The pure **world-map surface projection** (#241, Scope-IN 1) — the single data
 * object the player-facing World Map scene renders and the `__VERIFY__` bridge
 * snapshots. It is the connective read that composes the shipped pieces the front
 * door needs, re-speccing none of them:
 *
 * - the Ashfall transformed-map resolver (`logic/region/world-map` →
 *   {@link resolveWorldMap}) for every region's live name + tone through the one
 *   world-state flag (the "one map, two states" read, #139);
 * - the unlock progression (`./unlock`) for each region's LOCKED / AVAILABLE /
 *   IN PROGRESS / COMPLETE grade + its locked cue;
 * - the progress ledger (`./progress`) for the cleared/total playlist counts;
 * - the Act II frontier the world-turn opens: the reunion board (`content/reunions`,
 *   the #140 catalog) anchored to its Ashfall regions, and the finale entry at
 *   Aurel's heart (`logic/narrative/finale` — reachable once the world has turned).
 *
 * In Act I *reach* the surface also carries the **Reckoning hook** — the keystone
 * beat at upper Vanta the map surfaces once that region is finished (#122/#128), the
 * one place the player chooses to turn the world. In Act II *ashfall* the hook is
 * gone (the world has already turned) and the reunion frontier + finale entry appear
 * instead.
 *
 * Pure: zero Phaser, no I/O, no RNG. A total function of the world-state + progress,
 * so the surface (and its {@link hashWorldMapSurface} digest) is deterministic and
 * unit-testable headless.
 * @module logic/world-map/surface
 */
import {
  REGIONS,
  REUNIONS,
  REUNION_ORDER,
  RegionIds,
  type RegionId,
  type RegionTone,
} from "../../content";
import { resolveWorldMap, type WorldMapRegion } from "../region";
import { isAshfall, type WorldState } from "../world";
import {
  regionProgressEntry,
  isRegionCompleted,
  type RegionProgress,
} from "./progress";
import { regionStatus, regionUnlockCue, type RegionStatus } from "./unlock";

/** The region whose Ch.5 keystone triggers the Reckoning (#128 — upper Vanta). */
const RECKONING_REGION: RegionId = RegionIds.upperVanta;

/** One region node on the world map — its live identity, grade, and playlist counts. */
export interface WorldMapRegionNode {
  /** The region's stable id (invariant across the world-turn). */
  readonly id: RegionId;
  /** The region's live variant name (its Ashfall name once the world has turned). */
  readonly name: string;
  /** The region's live tone: `verdant` in reach, `ashen` in ashfall. */
  readonly tone: RegionTone;
  /** The region's grade: locked / available / in-progress / complete. */
  readonly status: RegionStatus;
  /** The "why locked" cue (names the gating region), or "" when reachable. */
  readonly cue: string;
  /** Encounters cleared so far in the live variant's playlist. */
  readonly cleared: number;
  /** The live variant's playlist length. */
  readonly total: number;
  /** Whether this is the player's current location. */
  readonly current: boolean;
}

/** The Reckoning hook the Act I map surfaces once upper Vanta is finished. */
export interface ReckoningHook {
  /** The region the keystone sits in (upper Vanta). */
  readonly regionId: RegionId;
  /** The player-facing label for the world-turn beat. */
  readonly label: string;
  /** Whether the hook is reachable yet (upper Vanta's playlist is finished). */
  readonly available: boolean;
}

/** One Act II reunion node the Ashfall map surfaces on its anchor region. */
export interface ReunionNode {
  /** The reunion id (a `content/reunions` entry). */
  readonly id: string;
  /** The self-contained reunion quest's display name. */
  readonly name: string;
  /** The Ashfall region the reunion is found in. */
  readonly regionId: RegionId;
  /** The environmental hook that surfaces the reunion. */
  readonly hook: string;
}

/** The finale entry at Aurel's heart the Ashfall map surfaces (#142). */
export interface FinaleEntry {
  /** The player-facing label for the finale set-piece. */
  readonly label: string;
  /** Whether the finale is reachable — the world has turned to ashfall. */
  readonly available: boolean;
}

/**
 * The whole world-map surface: every region graded and counted, the Act I Reckoning
 * hook (null in ashfall), and the Act II reunion frontier + finale entry (empty /
 * unavailable in reach). The data the World Map scene renders and the bridge reads.
 */
export interface WorldMapSurface {
  /** The world-state the whole surface resolved through. */
  readonly worldState: WorldState;
  /** The player's current region location, or null when unset. */
  readonly currentRegion: RegionId | null;
  /** Every registered region, graded and counted, in catalog order. */
  readonly regions: readonly WorldMapRegionNode[];
  /** The Reckoning hook (Act I only); null once the world has turned. */
  readonly reckoning: ReckoningHook | null;
  /** The Act II reunion frontier (empty in reach). */
  readonly reunions: readonly ReunionNode[];
  /** The finale entry at Aurel's heart (unavailable in reach). */
  readonly finale: FinaleEntry;
}

/** The inputs the surface projection reads. */
interface WorldMapInput {
  /** The live world-state flag. */
  readonly worldState: WorldState;
  /** The run's region-progress ledger. */
  readonly progress: RegionProgress;
  /** The player's current region, or null when unset. */
  readonly currentRegion: RegionId | null;
}

/**
 * The live variant's playlist length for a region under a world-state — the "total"
 * the map counts progress against. Pure.
 * @param id - The region to size.
 * @param worldState - The world-state whose variant to read.
 * @returns The region's live playlist length.
 */
function regionPlaylistLength(id: RegionId, worldState: WorldState): number {
  return REGIONS[id].states[worldState].encounters.length;
}

/**
 * Project one region into a graded, counted map node. Composes {@link resolveWorldMap}
 * for the live name/tone, {@link regionStatus} for the grade, and the progress ledger
 * for the cleared/total counts. Pure.
 * @param input - The surface inputs.
 * @param entry - The region's resolved name/tone entry from the transformed map.
 * @returns The region's world-map node.
 */
function projectRegionNode(
  input: WorldMapInput,
  entry: WorldMapRegion
): WorldMapRegionNode {
  const { worldState, progress, currentRegion } = input;
  return {
    id: entry.id,
    name: entry.name,
    tone: entry.tone,
    status: regionStatus(entry.id, progress, worldState),
    cue: regionUnlockCue(entry.id, progress, worldState),
    cleared: regionProgressEntry(progress, entry.id).cleared,
    total: regionPlaylistLength(entry.id, worldState),
    current: currentRegion === entry.id,
  };
}

/**
 * The Act I Reckoning hook: reachable once upper Vanta's playlist is finished (the
 * keystone at the Mourne refinery-spire is reached). Null in ashfall (the world has
 * already turned). Pure.
 * @param input - The surface inputs.
 * @returns The Reckoning hook, or null once turned.
 */
function projectReckoning(input: WorldMapInput): ReckoningHook | null {
  if (isAshfall(input.worldState)) {
    return null;
  }
  return {
    regionId: RECKONING_REGION,
    label: "The Reckoning — strike the keystone at the Mourne refinery-spire",
    available: isRegionCompleted(input.progress, RECKONING_REGION),
  };
}

/**
 * The Act II reunion frontier: every reunion in canonical order, anchored to its
 * Ashfall region. Empty in reach (the board opens only once the world turns). Pure.
 * @param worldState - The live world-state flag.
 * @returns The reunion nodes (empty in reach).
 */
function projectReunions(worldState: WorldState): readonly ReunionNode[] {
  if (!isAshfall(worldState)) {
    return [];
  }
  return REUNION_ORDER.map(id => {
    const reunion = REUNIONS[id];
    return {
      id: reunion.id,
      name: reunion.name,
      regionId: reunion.region,
      hook: reunion.hook,
    };
  });
}

/**
 * Project the whole world-map surface from the world-state + progress. Regions are
 * graded and counted in catalog order; the Reckoning hook appears in Act I; the
 * reunion frontier and the finale entry appear in Act II. Pure — a total function of
 * its input, so the surface is deterministic.
 * @param input - The surface inputs.
 * @returns The projected world-map surface.
 */
export function projectWorldMapSurface(input: WorldMapInput): WorldMapSurface {
  const map = resolveWorldMap(input.worldState);
  return {
    worldState: input.worldState,
    currentRegion: input.currentRegion,
    regions: map.regions.map(entry => projectRegionNode(input, entry)),
    reckoning: projectReckoning(input),
    reunions: projectReunions(input.worldState),
    finale: {
      label: "Aurel's Heart — the finale",
      available: isAshfall(input.worldState),
    },
  };
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * A canonical, unambiguous serialization of the surface — the determinism contract's
 * surface. Uses `JSON.stringify` so no two distinct surfaces collide. Pure.
 * @param surface - The surface to serialize.
 * @returns A stable string encoding.
 */
function serializeSurface(surface: WorldMapSurface): string {
  return JSON.stringify([
    surface.worldState,
    surface.currentRegion,
    surface.regions.map(region => [
      region.id,
      region.name,
      region.tone,
      region.status,
      region.cleared,
      region.total,
      region.current,
    ]),
    surface.reckoning === null
      ? null
      : [surface.reckoning.regionId, surface.reckoning.available],
    surface.reunions.map(reunion => [reunion.id, reunion.regionId]),
    [surface.finale.available],
  ]);
}

/**
 * A stable FNV-1a digest of the world-map surface — the scene-agnostic analogue of
 * the combat / travel / region state-hash. Equal surfaces hash equal; any change to a
 * graded field changes the digest. Pure.
 * @param surface - The surface to digest.
 * @returns An 8-character hex digest.
 */
export function hashWorldMapSurface(surface: WorldMapSurface): string {
  const hash = [...serializeSurface(surface)].reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (hash >>> 0).toString(16).padStart(8, "0");
}
