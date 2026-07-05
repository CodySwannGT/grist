/**
 * The verification (UAT) bridge's Ashfall transformed-map cell (#139) — the
 * scene-agnostic `__VERIFY__` seam that surfaces the pure `logic/region/world-map`
 * resolver so the "one map, two states" acceptance scenario (PRD #43 AC6) is proven on
 * the live built game without a bespoke scene hook. It reads the SAME map the render
 * consumes — every region resolved through the one world-state flag, the map-wide
 * desaturation grade, and the mourned Act-I-loved place — not a re-derived copy.
 *
 * A stateless reader (like `render-cell`): `snapshot(state)` is a total function of the
 * flag the bridge holds, so the same world-state always yields the same transformed-map
 * snapshot. Adds two pre-computed observations the e2e asserts without re-deriving the
 * maths: `allAshen` (every region reads its `ashen` variant — the map turned everywhere)
 * and `greyed` (every structural palette channel has collapsed to a pure grey — the
 * desaturation at full strength). Zero Phaser, no I/O, no RNG.
 * @module uat/world-map-cell
 */
import {
  hashWorldMap,
  resolveWorldMap,
  type MournedPlace,
  type WorldMap,
  type WorldMapPalette,
  type WorldMapRegion,
} from "../logic/region";
import { type WorldState } from "../logic/world";

/**
 * A read-only snapshot of the Ashfall transformed map (#139 AC6) — the same map the
 * render consumes, resolved through the live world-state flag. `allAshen` proves the
 * whole map turned (not one region); `greyed` proves the palette drained to grey at
 * full strength; `lovedPlace.mourned` proves an Act-I-loved place is observably mourned.
 */
export interface VerifyWorldMapState {
  /** The world-state the whole map resolved through (`ashfall` once turned). */
  readonly worldState: WorldState;
  /** The map-wide desaturation strength (0 in reach, 1 at full strength in ashfall). */
  readonly desaturation: number;
  /** The number of registered regions the map resolved through the one flag. */
  readonly regionCount: number;
  /** Every region resolved through the one flag — the same ids, transformed. */
  readonly regions: readonly WorldMapRegion[];
  /** Whether every region reads its `ashen` variant — the map turned everywhere. */
  readonly allAshen: boolean;
  /** The map-wide structural palette graded by the flag. */
  readonly palette: WorldMapPalette;
  /**
   * Whether every structural palette channel has collapsed to a pure grey (r == g == b)
   * — the desaturation at full strength. The grist-gold highlight is excluded (it never
   * drains), so this is the numeric read of "the map drained, the grist signal survived".
   */
  readonly greyed: boolean;
  /** The Act-I-loved place, observably mourned once the world turns. */
  readonly lovedPlace: MournedPlace;
  /** The stable determinism digest of the resolved map — identical for an identical flag. */
  readonly hash: string;
}

/** The 8-bit channel mask for reading a packed `0xRRGGBB` colour. */
const CHANNEL_MASK = 0xff;

/**
 * Whether a packed `0xRRGGBB` colour is a pure grey — its three 8-bit channels are all
 * equal (zero chroma). The read of "fully desaturated" the e2e asserts without depending
 * on the exact blend maths.
 * @param hex - The packed colour to test.
 * @returns True when the colour has collapsed to grey.
 */
function isGrey(hex: number): boolean {
  const r = (hex >> 16) & CHANNEL_MASK;
  const g = (hex >> 8) & CHANNEL_MASK;
  const b = hex & CHANNEL_MASK;
  return r === g && g === b;
}

/**
 * The bridge-held transformed-map cell (#139): a stateless reader over the pure
 * `logic/region/world-map` resolver. The snapshot is a total function of the flag the
 * bridge holds — no held state, no Phaser — so a stray read on any scene returns the
 * same deterministic transformed map.
 */
export class WorldMapCell {
  /**
   * The Ashfall transformed-map snapshot resolved through the live world-state flag
   * (#139 AC6) — the SAME map the render consumes, plus the pre-computed `allAshen`
   * (map turned everywhere) and `greyed` (palette drained at full strength) reads so
   * the e2e asserts the transformation without re-deriving it.
   * @param state - The live world-state (defaulting to Act I `reach` until a save/flip seeds one).
   * @returns The transformed-map snapshot for `state`.
   */
  snapshot(state: WorldState): VerifyWorldMapState {
    const map: WorldMap = resolveWorldMap(state);
    return {
      worldState: map.worldState,
      desaturation: map.desaturation,
      regionCount: map.regions.length,
      regions: map.regions,
      allAshen: map.regions.every(region => region.tone === "ashen"),
      palette: map.palette,
      greyed: [
        map.palette.land,
        map.palette.water,
        map.palette.path,
        map.palette.ruin,
      ].every(isGrey),
      lovedPlace: map.lovedPlace,
      hash: hashWorldMap(map),
    };
  }
}
