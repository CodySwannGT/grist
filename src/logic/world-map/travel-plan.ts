/**
 * The pure **region-travel plan** (#241, Scope-IN 3) — the small composition that
 * decides what selecting a region on the world map *costs*, reusing the shipped
 * travel economy (`logic/travel` — the fast-travel grist service, #136) rather than
 * re-speccing it. The wiki's traversal rule (`wiki/design/open-world.md`) is
 * "fast-travel between *discovered* safehouses (a grist-cost service), so depth never
 * becomes tedium": the first journey to a region is the discovery leg (free — the
 * player is establishing the route by playing there), and re-travelling to a region
 * already discovered is the charged fast-travel hop.
 *
 * The **unlock progression** (`./unlock`) is the front door's only hard gate: a locked
 * region is never travelled to. This plan layers the soft grist economy on top and
 * never dead-ends the player — a hop the wallet cannot cover is reported `affordable:
 * false` so the scene can present it, and the player can always play a nearer region
 * to earn the grist (or the discovery legs, which are free, keep the critical path
 * open). "Discovered" is derived from the region-progress ledger (a region with any
 * cleared progress, or the current location) — no separate persisted set.
 *
 * Pure: zero Phaser, no I/O, no RNG. A total function of its inputs. The actual
 * wallet draw-down happens at the call site through `logic/grist` `spendGrist`; this
 * module only decides the cost and affordability.
 * @module logic/world-map/travel-plan
 */
import { type RegionId } from "../../content";
import { canSpendGrist, newWallet } from "../grist";
import { TravelTuning } from "../travel";
import { type RegionProgress } from "./progress";

/**
 * What travelling to a region resolves to. `stay` — it is the current location (no
 * trip); `discover` — a first journey (free, the discovery leg); `fast-travel` — a
 * charged hop to an already-discovered region.
 */
export const TravelPlanKinds = {
  stay: "stay",
  discover: "discover",
  fastTravel: "fast-travel",
} as const;

/** A travel-plan kind (the literal-union of {@link TravelPlanKinds}). */
type TravelPlanKind = (typeof TravelPlanKinds)[keyof typeof TravelPlanKinds];

/** The resolved plan for travelling to a region: its kind, grist cost, and affordability. */
interface TravelPlan {
  /** The target region. */
  readonly target: RegionId;
  /** Whether this is the current location, a discovery leg, or a charged hop. */
  readonly kind: TravelPlanKind;
  /** The grist cost (0 for `stay` / `discover`; the fast-travel cost otherwise). */
  readonly cost: number;
  /** Whether the wallet can cover the cost (always true when the cost is 0). */
  readonly affordable: boolean;
}

/**
 * Whether a region has been discovered — the current location, or a region with any
 * recorded progress. The first arrival at a region is its discovery; thereafter a
 * return is a charged fast-travel hop. Pure.
 * @param target - The region to test.
 * @param current - The player's current region, or null.
 * @param progress - The run's region-progress ledger.
 * @returns True when the region has been discovered.
 */
export function isRegionDiscovered(
  target: RegionId,
  current: RegionId | null,
  progress: RegionProgress
): boolean {
  if (target === current) {
    return true;
  }
  const entry = progress[target];
  return entry !== undefined && (entry.cleared > 0 || entry.completed);
}

/**
 * Plan travel to a region from the current location: staying put costs nothing, a
 * first journey (discovery) is free, and a return to an already-discovered region is
 * the fast-travel grist hop ({@link TravelTuning.fastTravelCost}), affordable only when
 * the wallet covers it. Never a hard gate — the unlock progression decides
 * reachability; this only prices the trip. Pure — composes `logic/grist`
 * {@link canSpendGrist}; the seed never enters.
 * @param target - The region to travel to (assumed already unlocked by the caller).
 * @param current - The player's current region, or null.
 * @param progress - The run's region-progress ledger.
 * @param grist - The player's current grist balance.
 * @returns The resolved travel plan.
 */
export function planRegionTravel(
  target: RegionId,
  current: RegionId | null,
  progress: RegionProgress,
  grist: number
): TravelPlan {
  if (target === current) {
    return { target, kind: TravelPlanKinds.stay, cost: 0, affordable: true };
  }
  if (!isRegionDiscovered(target, current, progress)) {
    return {
      target,
      kind: TravelPlanKinds.discover,
      cost: 0,
      affordable: true,
    };
  }
  const cost = TravelTuning.fastTravelCost;
  return {
    target,
    kind: TravelPlanKinds.fastTravel,
    cost,
    affordable: canSpendGrist(newWallet(grist), cost),
  };
}
