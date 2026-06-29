/**
 * The growth/bench slice of the verification (UAT) bridge (#86). Extracted from
 * `uat/bridge.ts` so the bridge stays under its line budget and the bench
 * read/drive surface lives next to the scene it serves — the same split the
 * world-state cell uses. Holds the bench view contract the Bench scene registers,
 * the read-only snapshot the e2e asserts on, and the pure mapper between them. No
 * Phaser, no gameplay state — a thin test seam.
 * @module uat/bench-view
 */
import { type VerifyResolution } from "./bridge";

/** A read-only snapshot of the growth/bench screen for assertions (#86). */
export interface VerifyBenchState {
  readonly scene: string;
  /** The shared grist pool the bench draws down. */
  readonly grist: number;
  /** Whether the Ashling (Marrow) shard is equipped on the run. */
  readonly shardEquipped: boolean;
  /** Whether Cinder is currently in progress (begun, not yet learned). */
  readonly cinderLearning: boolean;
  /** Cinder's unlock progress in [0, 1] (0 before equip). */
  readonly cinderProgress: number;
  /** The SPD bonus the bench has bought into the build (0 before any purchase). */
  readonly spdBonus: number;
}

/**
 * The live link the Bench scene registers with the bridge (#86). Lets the bench
 * e2e read the resolved integer scale (scene-agnostic — the same shape Battle /
 * Field use), the shared grist / shard / learning / build snapshot, and drive the
 * two growth actions: equip the Ashling shard (begins Cinder learning) and buy a
 * grist sink (Runner's Reflex → +2 SPD, or Accelerate: Cinder → faster unlock).
 * Kept separate from the Battle / Field views so no path constrains the others;
 * the controller stores whichever is attached and dispatches by which is present.
 */
export interface BenchView {
  readonly resolution: () => VerifyResolution;
  readonly grist: () => number;
  readonly shardEquipped: () => boolean;
  readonly cinderLearning: () => boolean;
  readonly cinderProgress: () => number;
  readonly spdBonus: () => number;
  /** Equip the Ashling (Marrow) shard now — begins Cinder learning. */
  readonly equipShard: () => void;
  /** Buy Runner's Reflex (+2 SPD); a no-op if unaffordable. */
  readonly buyRunnersReflex: () => void;
  /** Buy Accelerate: Cinder (faster unlock); a no-op if unaffordable or not learning. */
  readonly accelerateCinder: () => void;
}

/**
 * Map an attached {@link BenchView} to its read-only snapshot for the bridge.
 * Internal to {@link BenchCell} — the controller reads snapshots through the cell.
 * @param scene - The active scene key.
 * @param view - The attached bench view.
 * @returns The read-only bench snapshot.
 */
function toVerifyBenchState(scene: string, view: BenchView): VerifyBenchState {
  return {
    scene,
    grist: view.grist(),
    shardEquipped: view.shardEquipped(),
    cinderLearning: view.cinderLearning(),
    cinderProgress: view.cinderProgress(),
    spdBonus: view.spdBonus(),
  };
}

/**
 * The bench slice of the verification controller — holds the attached
 * {@link BenchView}, produces its snapshot, and exposes the view for the bridge to
 * drive growth actions through. Composed by the main `VerifyController` so the
 * bench plumbing lives next to its types (and the bridge stays under its line
 * budget), mirroring the world-state cell split. Only the bench view exposes
 * `shardEquipped()`, so {@link claims} discriminates it from the battle/field views
 * without a tag field.
 */
export class BenchCell {
  #view: BenchView | null = null;

  /**
   * Whether a freshly-attached gameplay view is a {@link BenchView} (vs the
   * battle/field shapes). The single discriminating property is `shardEquipped`.
   * @param view - The attached gameplay view (any of the three shapes).
   * @returns True when the view is a bench view.
   */
  static claims<T extends object>(view: T): view is T & BenchView {
    return "shardEquipped" in view;
  }

  /**
   * Adopt the attached bench view (or clear it with null on a scene change).
   * @param view - The bench view, or null to clear.
   * @returns void
   */
  attach(view: BenchView | null): void {
    this.#view = view;
  }

  /**
   * The bench snapshot for the active scene, or null outside the Bench scene.
   * @param scene - The active scene key.
   * @returns The bench snapshot, or null.
   */
  snapshot(scene: string): VerifyBenchState | null {
    return this.#view ? toVerifyBenchState(scene, this.#view) : null;
  }

  /**
   * The attached bench view, or null — the bridge drives equip/buy/accelerate
   * straight through it (each a no-op when null).
   * @returns The bench view, or null.
   */
  view(): BenchView | null {
    return this.#view;
  }
}
