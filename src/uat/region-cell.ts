/**
 * The verification bridge's region cell (#133) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the region-template e2e can load a region authored
 * against the {@link RegionDef} template and observe it through the live world-state
 * flag, scene-agnostically. The cell only *holds* the loaded region and reads it
 * *through* a world-state; all region shape + both-states validation + resolve
 * *semantics* live in `content/regions` (which delegates to `logic/world`), so the
 * bridge never re-implements the rules.
 *
 * Mirrors `uat/world-state-cell.ts`: extracted from `uat/bridge.ts` so the bridge
 * stays under its line budget and the region seam is independently readable. Zero
 * Phaser, no I/O, no RNG.
 * @module uat/region-cell
 */
import {
  REGIONS,
  RegionIds,
  isCompleteRegion,
  resolveRegionVariant,
  validateRegion,
  type RegionDef,
} from "../content";
import { type WorldState } from "../logic/world";

/**
 * A read-only snapshot of a loaded region resolved through a world-state — the
 * shape the region e2e asserts on. Carries the region id, the live world-state,
 * the resolved variant's name + tone, whether the region passed both-states
 * validation, and which variants are present (so the e2e can prove a complete
 * region exposes BOTH Reach and Ashfall).
 */
export interface VerifyRegionState {
  readonly id: string;
  readonly worldState: WorldState;
  readonly variantName: string;
  readonly tone: string;
  readonly complete: boolean;
  readonly errors: readonly string[];
  readonly hasReach: boolean;
  readonly hasAshfall: boolean;
  /** A stable digest of the resolved variant for the determinism gate. */
  readonly hash: string;
}

/**
 * Stable FNV-1a digest of a loaded region resolved through a world-state — the
 * region analogue of the battle state-hash. Same seed/world-state + same region
 * ⇒ identical digest, so the e2e can assert reproducibility without a battle
 * scene. Pure: a total function of its inputs.
 * @param region - The loaded region.
 * @param state - The world-state to resolve through.
 * @returns An 8-char hex digest.
 */
function hashRegion(region: RegionDef, state: WorldState): string {
  const variant = resolveRegionVariant(region, state);
  const canonical = [
    region.id,
    state,
    variant.name,
    variant.tone,
    variant.encounters.join(","),
    variant.keyLocations.map(l => l.id).join(","),
    region.boundSite,
  ].join("|");
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 0x01000193),
    0x811c9dc5
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}

/**
 * The bridge-held region cell: load a region authored against the template, then
 * read it (a snapshot resolved through a world-state). `null` until a region is
 * loaded, so a stray read on a fresh boot cannot fabricate a region.
 */
export class RegionCell {
  #region: RegionDef | null = null;

  /**
   * Load the canonical example region (`marrow`) — the "an agent loaded a
   * template-authored region through the content barrel" verification action. The
   * region is the data shipped in {@link REGIONS}; loading is pure (no engine
   * edit, no Phaser), proving a region is added by authoring data. Pure.
   * @returns void
   */
  load(): void {
    this.#region = REGIONS[RegionIds.marrow];
  }

  /**
   * Load an arbitrary authored region into the cell — the seam the e2e uses to
   * feed a region (e.g. one missing a variant) and observe validation. Pure:
   * stores the value.
   * @param region - The region to hold.
   * @returns void
   */
  adopt(region: RegionDef): void {
    this.#region = region;
  }

  /**
   * A snapshot of the loaded region resolved through `state`, or null before a
   * region has been loaded. Lets the region e2e assert the region loads, exposes
   * both world-state variants, and passes both-states validation.
   * @param state - The world-state to resolve the variant through.
   * @returns The region snapshot, or null.
   */
  snapshot(state: WorldState): VerifyRegionState | null {
    const region = this.#region;
    if (region === null) {
      return null;
    }
    const variant = resolveRegionVariant(region, state);
    const states = region.states as Partial<RegionDef["states"]>;
    return {
      id: region.id,
      worldState: state,
      variantName: variant.name,
      tone: variant.tone,
      complete: isCompleteRegion(region),
      errors: validateRegion(region),
      hasReach: states.reach !== undefined,
      hasAshfall: states.ashfall !== undefined,
      hash: hashRegion(region, state),
    };
  }
}
