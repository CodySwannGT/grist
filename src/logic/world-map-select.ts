/**
 * The pure **World Map selection resolver** (#273) — maps a selected {@link WorldMapEntry}
 * to the semantic action the World Map scene dispatches, so the "what does selecting this
 * row do" projection is a total, headless-testable function instead of a branch buried in
 * the Phaser scene.
 *
 * This is the seam the #273 regression roots at: an Act II **reunion** ("story") node used
 * to resolve to a *region travel* against the reunion's already-cleared anchor region,
 * which dropped the player on that region's stale `region-cleared` summary instead of the
 * reunion's own content (and never wrote the `reunion:<id>` completion flag the finale's
 * standing reads, so the finale could never scale). A reunion now resolves to its OWN
 * {@link ReunionSelectAction}, which the scene enters as the dedicated Reunion surface.
 *
 * Pure: zero Phaser, no I/O, no RNG — a total map of an entry to an action.
 * @module logic/world-map-select
 */
import { type WorldMapEntry } from "./world-map-entries";

/** Travel into a region's play screen (its live variant at the saved cursor). */
interface RegionSelectAction {
  readonly kind: "region";
  /** The region to travel to (a {@link import("../content").RegionId}). */
  readonly regionId: string;
  /** The region's grade (a locked region refuses travel). */
  readonly status: string;
}

/** Enter a reunion's own self-contained recruit surface (#273). */
interface ReunionSelectAction {
  readonly kind: "reunion";
  /** The reunion to enter (a {@link import("../content").ReunionId}). */
  readonly reunionId: string;
  /** The reunion's anchor region (carried for flavor/telemetry, not travelled to). */
  readonly regionId: string;
}

/** Trigger the Reckoning world-turn set-piece (Act I hook). */
interface ReckoningSelectAction {
  readonly kind: "reckoning";
  /** Whether the hook is reachable yet (upper Vanta finished). */
  readonly available: boolean;
}

/** Enter the finale at Aurel's heart (Act II). */
interface FinaleSelectAction {
  readonly kind: "finale";
  /** Whether the finale is reachable (the world has turned to ashfall). */
  readonly available: boolean;
}

/** The action a selected World Map entry resolves to. */
type WorldMapSelectAction =
  | RegionSelectAction
  | ReunionSelectAction
  | ReckoningSelectAction
  | FinaleSelectAction;

/**
 * Resolve a selected World Map entry to the action the scene dispatches. A reunion node
 * resolves to its OWN reunion surface (never a region travel), the finale to a finale
 * action, the Reckoning to its hook, and a region row to a region travel. Pure and total.
 * @param entry - The selected entry.
 * @returns The semantic selection action.
 */
export function worldMapEntryAction(
  entry: WorldMapEntry
): WorldMapSelectAction {
  switch (entry.kind) {
    case "region":
      return {
        kind: "region",
        regionId: entry.node.id,
        status: entry.node.status,
      };
    case "reunion":
      return {
        kind: "reunion",
        reunionId: entry.node.id,
        regionId: entry.node.regionId,
      };
    case "reckoning":
      return { kind: "reckoning", available: entry.hook.available };
    case "finale":
      return { kind: "finale", available: entry.finale.available };
  }
}
