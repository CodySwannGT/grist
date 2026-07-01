/**
 * The verification bridge's keystone cell (#128) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the upper-Vanta e2e can drive the **Chapter 5 Mourne
 * keystone** set-piece scene-agnostically, the same way {@link
 * import("./requiem-hall-cell").RequiemHallCell} drives the Ch.4 requiem-hall. The
 * cell only *holds* the opened/played {@link KeystoneSession} and reads it; all
 * reachability-gate + play-state *semantics* live in `logic/region` (the keystone
 * set-piece), which reads the Ch.5 prerequisite off the reached-locations set — the
 * bridge never re-implements the rules.
 *
 * Mirrors `uat/requiem-hall-cell.ts`: extracted so the bridge stays under its line
 * budget and the keystone seam is independently readable. Unlike the requiem-hall's
 * Bound-attunement gate, upper Vanta cages NO Bound — its Ch.5 gate is purely
 * *traversal* (reaching House Mourne's refinery-spire), so the cell's `reached` option
 * toggles whether the refinery-spire is in the reached-locations set: `true` opens a
 * Ch.5-ready keystone, `false` opens the soft-gated (un-reached) one. Zero Phaser, no
 * I/O, no RNG of its own.
 * @module uat/keystone-cell
 */
import { REGIONS, RegionIds, type RegionId } from "../content";
import {
  KEYSTONE_LOCATION,
  hashKeystone,
  isKeystoneComplete,
  isKeystoneReachable,
  keystoneTriggersReckoning,
  openKeystone,
  playKeystone,
  playKeystoneToCompletion,
  type KeystoneSession,
} from "../logic/region";
import { type WorldState } from "../logic/world";

/** A fixed default seed so the cell's set-piece is reproducible across opens. */
const DEFAULT_KEYSTONE_SEED = 0x4e91;

/**
 * Resolve a requested region id to a registered {@link RegionId}, defaulting to upper
 * Vanta — the region that hosts the Ch.5 Mourne keystone. An unknown id falls back to
 * `upper-vanta` rather than fabricating a phantom region.
 * @param regionId - The requested region id, when a specific region is wanted.
 * @returns A registered region id (`upper-vanta` by default).
 */
function resolveRegionId(regionId?: string): RegionId {
  return regionId !== undefined && regionId in REGIONS
    ? (regionId as RegionId)
    : RegionIds.upperVanta;
}

/**
 * The options an e2e passes to open a keystone session: whether the Ch.5 prerequisite
 * is met (the refinery-spire reached), the world-state to resolve through, and the
 * boot seed. All optional — the defaults open a Ch.5-ready keystone (spire reached) in
 * Act I *reach* under the fixed seed.
 */
export interface OpenKeystoneOptions {
  /** Whether the refinery-spire has been reached (meet the Ch.5 prerequisite). */
  readonly reached?: boolean;
  /** The world-state to resolve the set-piece through (defaults to `reach`). */
  readonly worldState?: WorldState;
  /** The boot seed threaded through the beat (defaults to the cell's fixed seed). */
  readonly seed?: number;
}

/**
 * A read-only, scene-agnostic snapshot of the keystone set-piece — the shape the Ch.5
 * e2e asserts on. Carries the region + resolved location name, the world-state, the
 * soft-gate (`reachable`), the beat index + phase, whether Sallow has triggered the
 * Reckoning, completion, and a stable digest for the determinism gate.
 */
export interface VerifyKeystoneState {
  readonly regionId: string;
  readonly locationName: string;
  readonly worldState: string;
  /** Whether the Ch.5 prerequisite is met (the refinery-spire reached — the soft-gate). */
  readonly reachable: boolean;
  readonly beat: number;
  readonly phase: string;
  /** Whether Mr. Sallow has triggered the Reckoning (the Act I climax gate). */
  readonly triggersReckoning: boolean;
  /** Whether the Ch.5 beat has run to completion. */
  readonly complete: boolean;
  /** A stable digest of the session for the determinism gate. */
  readonly hash: string;
}

/**
 * The reached-locations set for a keystone open: with the refinery-spire when the
 * prerequisite is met, without it otherwise. A couple of unrelated Crown/Tiers
 * locations are always present so the `reached: false` case is a realistic
 * "explored elsewhere but not the spire" run, not an empty one.
 * @param reached - Whether the refinery-spire has been reached.
 * @returns The reached-location ids.
 */
function reachedLocations(reached: boolean): readonly string[] {
  const base = ["concord-hall", "grand-market"];
  return reached ? [...base, KEYSTONE_LOCATION] : base;
}

/**
 * The bridge-held keystone cell: open the Ch.5 Mourne keystone set-piece (gated or
 * Ch.5-ready), step its beat, then read the session as one scene-agnostic
 * {@link VerifyKeystoneState} snapshot. `null` until opened, so a stray read on a
 * fresh boot cannot fabricate a set-piece.
 */
export class KeystoneCell {
  #session: KeystoneSession | null = null;

  /**
   * Open the keystone set-piece for a region — the "an agent reached the Mourne
   * refinery-spire" verification action. Defaults to upper Vanta with the Ch.5
   * prerequisite met (the spire reached) in Act I *reach*; pass `reached: false` to
   * open the soft-gated (unreachable) keystone, `worldState`/`seed` to vary the fork.
   * Pure data through the content barrel + the logic kit — no engine wiring.
   * @param regionId - The region whose keystone to open (defaults to `upper-vanta`).
   * @param options - The open options (prerequisite, world-state, seed).
   * @returns void
   */
  open(regionId?: string, options?: OpenKeystoneOptions): void {
    const region = resolveRegionId(regionId);
    this.#session = openKeystone(
      REGIONS[region],
      reachedLocations(options?.reached ?? true),
      options?.worldState ?? "reach",
      options?.seed ?? DEFAULT_KEYSTONE_SEED
    );
  }

  /**
   * Advance the set-piece one authored beat (a no-op when gated or already complete),
   * delegating to {@link playKeystone}. A no-op before a keystone is opened. Pure:
   * replaces the held session with the advanced one.
   * @returns void
   */
  play(): void {
    if (this.#session !== null) {
      this.#session = playKeystone(this.#session);
    }
  }

  /**
   * Drive the set-piece all the way to its terminal phase (a no-op when gated),
   * delegating to {@link playKeystoneToCompletion} — the "an agent played the Ch.5
   * climax to completion (Sallow triggers the Reckoning)" verification action. A no-op
   * before a keystone is opened.
   * @returns void
   */
  playToCompletion(): void {
    if (this.#session !== null) {
      this.#session = playKeystoneToCompletion(this.#session);
    }
  }

  /**
   * A snapshot of the opened/played keystone, or null before one has been opened. Lets
   * the Ch.5 e2e assert the soft-gate, the beat progression, the Reckoning trigger,
   * completion, and the determinism digest.
   * @returns The keystone snapshot, or null.
   */
  snapshot(): VerifyKeystoneState | null {
    const session = this.#session;
    if (session === null) {
      return null;
    }
    return {
      regionId: session.regionId,
      locationName: session.locationName,
      worldState: session.worldState,
      reachable: isKeystoneReachable(session),
      beat: session.beat,
      phase: session.phase,
      triggersReckoning: keystoneTriggersReckoning(session),
      complete: isKeystoneComplete(session),
      hash: hashKeystone(session),
    };
  }
}
