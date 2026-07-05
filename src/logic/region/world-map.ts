/**
 * The pure **Ashfall transformed-map resolver** (#139, PRD #43 AC6 / Scope-IN 7) —
 * GRIST's defining structural move made concrete: *one map, two states*
 * (`wiki/design/open-world.md`). Every region the player learned to love in Act I is
 * the SAME authored map, re-resolved at scale through the single Act I *reach* / Act
 * II *ashfall* world-state flag (#134), so the world renders *mourned* rather than
 * being a second map. This module is the aggregate read seam the per-region variants
 * (#129–#132, #143) already ship but nothing yet composes: it folds the whole
 * {@link REGIONS} catalog through one flag, grades the map-wide palette by the
 * dimming-of-color motif (`wiki/narrative/themes-and-tone.md`), and surfaces the one
 * place the player loved in Act I as *observably mourned* once the world has turned.
 *
 * Three reads make up the transformed map (all a total function of the flag):
 *
 * - {@link resolveWorldMap} resolves EVERY region's live variant through the one
 *   world-state — the same map ids, transformed names + tones — so a single flip
 *   surfaces the Ashfall read everywhere without per-call-site branching.
 * - {@link resolveWorldMapPalette} grades the map's structural tones by
 *   {@link worldMapDesaturation}: full verdant color in `reach`, drained to grey at
 *   FULL strength in `ashfall` (the `ASHFALL_DESATURATION` = 1 pass), lit only by the
 *   one warm {@link GRIST_GOLD} grist signal, which never drains.
 * - {@link resolveMournedPlace} reads the Act-I-loved place — the Sylvemarch's Sidhe
 *   Enclave, "the brightest, most alive place in Act I" and by design the most painful
 *   transformation (#129) — and marks it `mourned` the instant the world turns to
 *   Ashfall, its live name shifting from what it was called when loved to its mourned
 *   form.
 *
 * Zero Phaser, no I/O, no RNG, no `Math.random` / `Date.now` (the flip is decided by
 * the world-turn, never chance, so the whole resolution consumes no seed) — every
 * output is a total function of its explicit inputs, so the transformed map is
 * deterministic and reproducible under the `__VERIFY__` suite. {@link hashWorldMap}
 * is the stable FNV-1a digest of the resolved map — the scene-agnostic analogue of the
 * combat / travel state-hash — so the same flag yields an identical digest across runs.
 * This module composes the shipped `content` catalog, `logic/render` grade, and
 * `logic/world` flag; it re-specs none of them.
 * @module logic/region/world-map
 */
import {
  REGIONS,
  RegionIds,
  resolveRegionVariant,
  type RegionId,
  type RegionTone,
} from "../../content";
import { GRIST_GOLD, desaturate } from "../render";
import { isAshfall, type WorldState } from "../world";

/** The map-wide desaturation in Act I `reach`: none — the world reads at full color. */
const REACH_DESATURATION = 0;

/**
 * The map-wide desaturation in Act II `ashfall`: FULL strength (1) — the
 * dimming-of-color motif at its terminal, so every structural tone drains to grey and
 * only the warm grist-gold signal survives. This is the numeric meaning of "desaturated
 * palette at full strength" (AC6).
 */
const ASHFALL_DESATURATION = 1;

/**
 * The verdant source tones of the living map — the full-color anchors the palette grade
 * drains through. In `reach` they read as authored (green land, blue water, earth path,
 * weave-touched ruin); in `ashfall` the same anchors collapse to grey under the
 * full-strength desaturation. Kept as source data so "the same map, drained" is a
 * transform of one set of tones, never two hand-picked palettes.
 */
const MAP_SOURCE_TONES = {
  /** Living green — the forests, marches, and reaches. */
  land: 0x3f7d3a,
  /** River / coast blue. */
  water: 0x2f6f9f,
  /** Earth-road / trade-path ochre. */
  path: 0x8a6f3b,
  /** Weave-touched ruin violet — the old power under the map. */
  ruin: 0x7a4fa0,
} as const;

/**
 * The region whose loved place the transformed map mourns: the Sylvemarch (#129) — the
 * brightest, most alive place in Act I, authored as the most painful transformation.
 */
const LOVED_PLACE_REGION: RegionId = RegionIds.sylvemarch;

/** The Act-I-loved location the map mourns once the world turns: the Sidhe Enclave. */
const LOVED_PLACE_LOCATION = "sidhe-enclave";

/** One region resolved through the single world-state flag — the same map entry, transformed. */
export interface WorldMapRegion {
  /** The region's stable id — invariant across the flag (the SAME map). */
  readonly id: RegionId;
  /** The region's live variant name (its Ashfall name once the world has turned). */
  readonly name: string;
  /** The region's live tone: `verdant` in reach, `ashen` in ashfall. */
  readonly tone: RegionTone;
}

/**
 * The map-wide structural palette graded by the world-state: the verdant source tones
 * run through {@link worldMapDesaturation}, plus the one warm {@link GRIST_GOLD}
 * highlight that never drains. In `ashfall` every structural channel collapses to a
 * pure grey (r == g == b); the highlight stays vivid.
 */
export interface WorldMapPalette {
  /** The land tone, graded by the flag. */
  readonly land: number;
  /** The water tone, graded by the flag. */
  readonly water: number;
  /** The path tone, graded by the flag. */
  readonly path: number;
  /** The ruin tone, graded by the flag. */
  readonly ruin: number;
  /** The grist-gold signal — the one warm accent, left un-drained on purpose. */
  readonly highlight: number;
}

/**
 * The Act-I-loved place and whether the turned world now mourns it. `lovedName` is what
 * it was called when the player loved it in Act I `reach`; `name` is its live name (the
 * mourned form once the world has turned); `mourned` is true exactly in `ashfall`.
 */
export interface MournedPlace {
  /** The region the loved place sits in. */
  readonly regionId: RegionId;
  /** The loved place's stable location id — invariant across the flag. */
  readonly locationId: string;
  /** The place's name while loved in Act I `reach`. */
  readonly lovedName: string;
  /** The place's live name (its mourned form in `ashfall`). */
  readonly name: string;
  /** Whether the world has turned and the place is now mourned (true in `ashfall`). */
  readonly mourned: boolean;
}

/**
 * The whole authored map resolved through one world-state flag: the transformed
 * regions, the map-wide desaturation + palette grade, and the mourned loved place —
 * the data the "one map, two states" render consumes.
 */
export interface WorldMap {
  /** The world-state the whole map was resolved through — `ashfall` everywhere once turned. */
  readonly worldState: WorldState;
  /** The map-wide desaturation strength (0 in reach, 1 at full strength in ashfall). */
  readonly desaturation: number;
  /** Every registered region resolved through the one flag, in catalog order. */
  readonly regions: readonly WorldMapRegion[];
  /** The map-wide structural palette graded by the flag. */
  readonly palette: WorldMapPalette;
  /** The Act-I-loved place, observably mourned once the world turns. */
  readonly lovedPlace: MournedPlace;
}

/**
 * The map-wide desaturation strength for a world-state: {@link REACH_DESATURATION} (0)
 * in Act I `reach`, {@link ASHFALL_DESATURATION} (1, full strength) once the Reckoning
 * has turned the world to `ashfall`. Pure — the seed never enters.
 * @param state - The current world-state.
 * @returns The desaturation amount to grade the map-wide palette by.
 */
function worldMapDesaturation(state: WorldState): number {
  return isAshfall(state) ? ASHFALL_DESATURATION : REACH_DESATURATION;
}

/**
 * Grade the map-wide structural palette through the world-state flag: each verdant
 * source tone is desaturated by {@link worldMapDesaturation} (untouched in reach,
 * drained to grey at full strength in ashfall), while the grist-gold highlight is left
 * vivid so the one warm signal survives the turn. Pure — composes `logic/render`.
 * @param state - The current world-state.
 * @returns The graded structural palette for `state`.
 */
function resolveWorldMapPalette(state: WorldState): WorldMapPalette {
  const amount = worldMapDesaturation(state);
  return {
    land: desaturate(MAP_SOURCE_TONES.land, amount),
    water: desaturate(MAP_SOURCE_TONES.water, amount),
    path: desaturate(MAP_SOURCE_TONES.path, amount),
    ruin: desaturate(MAP_SOURCE_TONES.ruin, amount),
    highlight: GRIST_GOLD,
  };
}

/**
 * The registered region ids in catalog order — the map's regions, keyed for resolution.
 * @returns The registered region ids, in catalog order.
 */
function regionIds(): readonly RegionId[] {
  return Object.values(RegionIds);
}

/**
 * Resolve one region's live variant through the flag into its transformed map entry —
 * the same id, the variant's live name + tone. Pure.
 * @param id - The region to resolve.
 * @param state - The current world-state.
 * @returns The region's transformed map entry for `state`.
 */
function resolveRegionEntry(id: RegionId, state: WorldState): WorldMapRegion {
  const variant = resolveRegionVariant(REGIONS[id], state);
  return { id, name: variant.name, tone: variant.tone };
}

/**
 * The live name of a region's key location under a world-state — the variant's
 * authored name for the location, or the id itself when the variant does not surface
 * it (a defensive fallback; the loved place is present in both authored variants). Pure.
 * @param id - The region holding the location.
 * @param state - The world-state to read the location's name through.
 * @param locationId - The stable location id to name.
 * @returns The location's live name in `state`.
 */
function locationName(
  id: RegionId,
  state: WorldState,
  locationId: string
): string {
  const variant = resolveRegionVariant(REGIONS[id], state);
  const location = variant.keyLocations.find(entry => entry.id === locationId);
  return location?.name ?? locationId;
}

/**
 * Resolve the Act-I-loved place through the flag: its name while loved (its `reach`
 * name), its live name (the mourned form in `ashfall`), and whether the world has
 * turned. The same authored location reads *mourned* the instant the flag flips —
 * observably, its live name diverges from the loved name and `mourned` turns true. Pure.
 * @param state - The current world-state.
 * @returns The loved place, mourned once the world has turned to ashfall.
 */
function resolveMournedPlace(state: WorldState): MournedPlace {
  return {
    regionId: LOVED_PLACE_REGION,
    locationId: LOVED_PLACE_LOCATION,
    lovedName: locationName(LOVED_PLACE_REGION, "reach", LOVED_PLACE_LOCATION),
    name: locationName(LOVED_PLACE_REGION, state, LOVED_PLACE_LOCATION),
    mourned: isAshfall(state),
  };
}

/**
 * Resolve the whole authored map through one world-state flag — the Ashfall
 * transformed map (AC6). Every region resolves to its live variant (the same map ids,
 * transformed), the palette grades to the map-wide desaturation, and the loved place is
 * mourned once the world has turned. Pure — a total function of the flag, so the same
 * state always yields the same transformed map.
 * @param state - The current world-state (`reach` before the Reckoning, `ashfall` after).
 * @returns The transformed map resolved through `state`.
 */
export function resolveWorldMap(state: WorldState): WorldMap {
  return {
    worldState: state,
    desaturation: worldMapDesaturation(state),
    regions: regionIds().map(id => resolveRegionEntry(id, state)),
    palette: resolveWorldMapPalette(state),
    lovedPlace: resolveMournedPlace(state),
  };
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Canonical, unambiguous serialization of the resolved map — the determinism contract's
 * surface: the flag, the desaturation, every region (id + name + tone in order), the
 * palette channels, and the mourned loved place. Uses `JSON.stringify` so no two
 * distinct maps can collide (array boundaries and the `mourned` boolean stay intact).
 * @param map - The resolved world-map to serialize.
 * @returns A stable, unambiguous string encoding.
 */
function serializeWorldMap(map: WorldMap): string {
  return JSON.stringify([
    map.worldState,
    map.desaturation,
    map.regions.map(region => [region.id, region.name, region.tone]),
    [
      map.palette.land,
      map.palette.water,
      map.palette.path,
      map.palette.ruin,
      map.palette.highlight,
    ],
    [
      map.lovedPlace.regionId,
      map.lovedPlace.locationId,
      map.lovedPlace.lovedName,
      map.lovedPlace.name,
      map.lovedPlace.mourned,
    ],
  ]);
}

/**
 * Stable FNV-1a digest of the resolved map, as zero-padded hex — the scene-agnostic
 * analogue of the combat / travel state-hash. Equal maps hash equal, and any change to
 * a tracked field (flag, desaturation, a region name/tone, a palette channel, the
 * mourned marker) changes the digest, so two runs of the same flag produce an identical
 * digest. Pure.
 * @param map - The resolved world-map to hash.
 * @returns An 8-character hex digest.
 */
export function hashWorldMap(map: WorldMap): string {
  const hash = [...serializeWorldMap(map)].reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (hash >>> 0).toString(16).padStart(8, "0");
}
