/**
 * The verification bridge's Bound-site cell (#135) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the Bound-site e2e can anchor a region's single Bound
 * site and make the free-vs-wield choice scene-agnostically, the same way
 * {@link import("./region-cell").RegionCell} loads a template-authored region. The
 * cell only *holds* the opened/settled {@link BoundSiteSession} and reads it; all
 * siting + resolution *semantics* live in `logic/region` (the Bound-site template)
 * which composes the Phase-2 free-vs-wield kit — the bridge never re-implements the
 * rules.
 *
 * Mirrors `uat/region-cell.ts` / `uat/world-state-cell.ts`: extracted so the bridge
 * stays under its line budget and the Bound-site seam is independently readable. The
 * *persistence-across-reload* half of the AC rides the existing save path — the e2e
 * persists a save built from the settled choice and reloads — so this cell owns only
 * the in-memory choice surface, not storage. Zero Phaser, no I/O, no RNG.
 * @module uat/bound-site-cell
 */
import { REGIONS, RegionIds, type RegionId } from "../content";
import { newMoralLedger } from "../logic/free-vs-wield";
import {
  type BoundSiteSession,
  chooseAtBoundSite,
  hashBoundSite,
  isBoundSiteSettled,
  openBoundSite,
} from "../logic/region";
import type { ShardMode } from "../logic/save/types";

/**
 * Resolve a requested region id to a registered {@link RegionId}, defaulting to the
 * canonical `marrow` example when none (or an unknown one) is requested. Lets a
 * caller open a specific region's Bound site — the Roots / the Deep site that sites
 * Velith (#144) — without the cell hard-coding a single region, while a stray /
 * unknown id can never fabricate a phantom region (it falls back to the default).
 * @param regionId - The requested region id, when a specific site is wanted.
 * @returns A registered region id (`marrow` by default).
 */
function resolveRegionId(regionId?: string): RegionId {
  return regionId !== undefined && regionId in REGIONS
    ? (regionId as RegionId)
    : RegionIds.marrow;
}

/**
 * A read-only, scene-agnostic snapshot of a region's opened Bound site — the shape
 * the Bound-site e2e asserts on. Carries the region + sited shard, the offered
 * Free/Wield corruption rates (proving the site reads the content table), whether a
 * choice has been committed, the committed variant (or null while pending), the
 * corruption accrued, the moral ledger after the choice, and a stable digest for the
 * determinism gate.
 */
export interface VerifyBoundSiteState {
  readonly regionId: string;
  readonly shard: string;
  readonly freeCorruptionRate: number;
  readonly wieldCorruptionRate: number;
  readonly settled: boolean;
  readonly variant: ShardMode | null;
  readonly corruptionAccrued: number;
  readonly karma: number;
  readonly freeChoices: number;
  readonly wieldChoices: number;
  /** A stable digest of the session for the determinism gate. */
  readonly hash: string;
}

/**
 * The bridge-held Bound-site cell: open the canonical region's single Bound site,
 * commit a free-vs-wield choice, then read the resulting session as one
 * scene-agnostic {@link VerifyBoundSiteState} snapshot. `null` until a site is
 * opened, so a stray read on a fresh boot cannot fabricate a site.
 */
export class BoundSiteCell {
  #session: BoundSiteSession | null = null;

  /**
   * Open a region's single Bound site into an unsettled free-vs-wield choice — the
   * "an agent reached a region's Bound site through the template" verification
   * action. Defaults to the canonical `marrow` example (so the #135 e2e is
   * unchanged); pass `regionId: "roots"` to anchor Velith the Deep-bound's site
   * (#144). An unknown id falls back to `marrow` rather than fabricating a phantom
   * region. Siting is pure (no engine edit, no Phaser): the region is the data
   * shipped in {@link REGIONS}, and the template reads its `boundSite` + variants
   * from the content table. Pure.
   * @param regionId - The region whose single Bound site to open (defaults to `marrow`).
   * @returns void
   */
  open(regionId?: string): void {
    this.#session = openBoundSite(
      REGIONS[resolveRegionId(regionId)],
      newMoralLedger()
    );
  }

  /**
   * Commit the player's choice at the opened Bound site (`free` or `wield`),
   * delegating the fold to the {@link chooseAtBoundSite} template. Idempotent once
   * settled (the template no-ops a second choice); a no-op before a site is opened.
   * Pure: replaces the held session with the settled one.
   * @param mode - The carry the player committed to.
   * @returns void
   */
  choose(mode: ShardMode): void {
    if (this.#session !== null) {
      this.#session = chooseAtBoundSite(this.#session, mode);
    }
  }

  /**
   * A snapshot of the opened/settled Bound site, or null before a site has been
   * opened. Lets the Bound-site e2e assert the site is the region's Bound, that
   * free/wield diverge (variant + karma + corruption), and that the digest is stable.
   * @returns The Bound-site snapshot, or null.
   */
  snapshot(): VerifyBoundSiteState | null {
    const session = this.#session;
    if (session === null) {
      return null;
    }
    return {
      regionId: session.regionId,
      shard: session.shard,
      freeCorruptionRate: session.variants.free.corruptionRate,
      wieldCorruptionRate: session.variants.wield.corruptionRate,
      settled: isBoundSiteSettled(session),
      variant: session.choice.variant ?? null,
      corruptionAccrued: session.corruptionAccrued,
      karma: session.ledger.karma,
      freeChoices: session.ledger.freeChoices,
      wieldChoices: session.ledger.wieldChoices,
      hash: hashBoundSite(session),
    };
  }
}
