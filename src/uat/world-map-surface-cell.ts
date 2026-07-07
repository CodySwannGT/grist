/**
 * The world-map surface slice of the verification (UAT) bridge (#241) — a bridge-held
 * data cell (like `world-map-cell` / `region-cell`) that projects the pure world-map
 * front-door surface (`logic/world-map`) from the persisted save, so the travel e2e can
 * read every region's LOCKED / AVAILABLE / IN PROGRESS / COMPLETE grade, the Act I
 * Reckoning hook, and the Act II reunion frontier + finale entry scene-agnostically —
 * the SAME surface the World Map scene renders, resolved through the same world-state +
 * region-progress the save holds. Adopted on save/reload (region progress from
 * `scene.flags`, the reunion precedent) so a persisted clear surfaces the restored
 * status. No Phaser, no gameplay state — a thin test seam.
 * @module uat/world-map-surface-cell
 */
import { type CurrentSave } from "../logic/save";
import { type WorldState } from "../logic/world";
import {
  hashWorldMapSurface,
  projectWorldMapSurface,
  regionProgressFromFlags,
  type RegionProgress,
  type WorldMapSurface,
} from "../logic/world-map";

/** A read-only snapshot of the world-map surface + its determinism digest. */
export interface VerifyWorldMapSurfaceState {
  /** The projected world-map surface (regions graded + counted, Act nodes). */
  readonly surface: WorldMapSurface;
  /** The stable determinism digest of the surface — identical for identical inputs. */
  readonly hash: string;
}

/**
 * The bridge-held world-map surface cell: holds the region-progress ledger adopted from
 * the save and projects the surface through the live world-state flag. Stateless given
 * its adopted progress + the flag — a stray read on any scene returns the same
 * deterministic surface.
 */
export class WorldMapSurfaceCell {
  #progress: RegionProgress = {};

  /**
   * Adopt the region-progress ledger from a save's `scene.flags` (the reunion
   * precedent), so a persisted clear/in-progress surfaces after a save or reload.
   * @param save - The save whose region progress to adopt.
   * @returns void
   */
  adopt(save: CurrentSave): void {
    this.#progress = regionProgressFromFlags(save.scene?.flags ?? {});
  }

  /** Reset to an untouched ledger (the `clearSave` path). @returns void */
  reset(): void {
    this.#progress = {};
  }

  /**
   * Project the surface through a world-state flag — the SAME surface the scene renders
   * (current-location is a live-scene concern, so it reads null here).
   * @param worldState - The live world-state flag.
   * @returns The surface snapshot + digest.
   */
  snapshot(worldState: WorldState): VerifyWorldMapSurfaceState {
    const surface = projectWorldMapSurface({
      worldState,
      progress: this.#progress,
      currentRegion: null,
    });
    return { surface, hash: hashWorldMapSurface(surface) };
  }
}
