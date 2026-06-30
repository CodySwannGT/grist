/**
 * The verification bridge's requiem-hall cell (#145) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the Sidhe requiem-hall e2e can drive the Chapter 4
 * set-piece scene-agnostically, the same way {@link import("./bound-site-cell")
 * .BoundSiteCell} drives the region's free-vs-wield choice. The cell only *holds* the
 * opened/played {@link RequiemHallSession} and reads it; all reachability-gate +
 * play-state *semantics* live in `logic/region` (the requiem-hall set-piece), which
 * reads the Ch.4 prerequisite off the {@link RunState} the Bound-site kit (#135/#144)
 * already produces — the bridge never re-implements the rules.
 *
 * Mirrors `uat/bound-site-cell.ts` / `uat/region-cell.ts`: extracted so the bridge
 * stays under its line budget and the requiem-hall seam is independently readable. The
 * Ch.4 prerequisite (the Roots Bound, Velith, attuned) is met by *opening the region's
 * Bound site and committing a choice* — exactly the player path #144 ships — so the
 * cell composes the same `openBoundSite` / `chooseAtBoundSite` kit to produce a
 * Ch.4-ready run, and `withVelith: false` opens the hall against a fresh (un-attuned)
 * run to exercise the soft-gate. Zero Phaser, no I/O, no RNG of its own.
 * @module uat/requiem-hall-cell
 */
import { REGIONS, RegionIds, type RegionId } from "../content";
import { newMoralLedger } from "../logic/free-vs-wield";
import {
  chooseAtBoundSite,
  hashRequiemHall,
  isRequiemHallComplete,
  isRequiemHallReachable,
  openBoundSite,
  openRequiemHall,
  playRequiemHall,
  playRequiemHallToCompletion,
  type RequiemHallSession,
} from "../logic/region";
import { newRunState, type RunState } from "../logic/run-state";
import type { ShardMode } from "../logic/save/types";
import { type WorldState } from "../logic/world";

/** A fixed default seed so the cell's set-piece is reproducible across opens. */
const DEFAULT_REQUIEM_SEED = 0x4e91;

/**
 * Resolve a requested region id to a registered {@link RegionId}, defaulting to the
 * Roots / the Deep — the region that hosts the Sidhe requiem-hall. An unknown id falls
 * back to `roots` rather than fabricating a phantom region.
 * @param regionId - The requested region id, when a specific region is wanted.
 * @returns A registered region id (`roots` by default).
 */
function resolveRegionId(regionId?: string): RegionId {
  return regionId !== undefined && regionId in REGIONS
    ? (regionId as RegionId)
    : RegionIds.roots;
}

/**
 * Build a run that has met the Ch.4 prerequisites: the region's Bound (Velith)
 * attuned through its site (#144), in the given mode. This is the "Bound shard
 * learning in practice" the chapter teaches — the exact player path that opens the
 * requiem-hall.
 * @param regionId - The region whose Bound site to attune.
 * @param mode - The carry the player commits to (`free` / `wield`); free by default.
 * @returns The run with the region's Bound attuned.
 */
function ch4ReadyRun(regionId: RegionId, mode: ShardMode): RunState {
  const settled = chooseAtBoundSite(
    openBoundSite(REGIONS[regionId], newMoralLedger()),
    mode
  );
  return settled.run;
}

/**
 * The options an e2e passes to open a requiem-hall session: whether the Ch.4
 * prerequisites are met (Velith attuned), in which carry mode, the world-state to
 * resolve through, and the boot seed. All optional — the defaults open a Ch.4-ready
 * hall (Velith freed) in Act I *reach* under the fixed seed.
 */
export interface OpenRequiemHallOptions {
  /** Whether to attune the region's Bound first (meet the Ch.4 prerequisite). */
  readonly withVelith?: boolean;
  /** The carry mode to attune in when `withVelith` (defaults to `free`). */
  readonly mode?: ShardMode;
  /** The world-state to resolve the set-piece through (defaults to `reach`). */
  readonly worldState?: WorldState;
  /** The boot seed threaded through the beat (defaults to the cell's fixed seed). */
  readonly seed?: number;
}

/**
 * A read-only, scene-agnostic snapshot of the requiem-hall set-piece — the shape the
 * Ch.4 e2e asserts on. Carries the region + resolved location name, the world-state,
 * the soft-gate (`reachable`), the beat index + phase, completion, and a stable digest
 * for the determinism gate.
 */
export interface VerifyRequiemHallState {
  readonly regionId: string;
  readonly locationName: string;
  readonly worldState: string;
  /** Whether the Ch.4 prerequisites are met (the soft-gate). */
  readonly reachable: boolean;
  readonly beat: number;
  readonly phase: string;
  /** Whether the Ch.4 beat has run to completion. */
  readonly complete: boolean;
  /** A stable digest of the session for the determinism gate. */
  readonly hash: string;
}

/**
 * The bridge-held requiem-hall cell: open the Sidhe requiem-hall set-piece (gated or
 * Ch.4-ready), step its beat, then read the session as one scene-agnostic
 * {@link VerifyRequiemHallState} snapshot. `null` until opened, so a stray read on a
 * fresh boot cannot fabricate a set-piece.
 */
export class RequiemHallCell {
  #session: RequiemHallSession | null = null;

  /**
   * Open the requiem-hall set-piece for a region — the "an agent reached the Sidhe
   * requiem-hall" verification action. Defaults to the Roots / the Deep with the Ch.4
   * prerequisites met (Velith freed) in Act I *reach*; pass `withVelith: false` to
   * open the soft-gated (unreachable) hall, `mode`/`worldState`/`seed` to vary the
   * fork. Pure data through the content barrel + the logic kit — no engine wiring.
   * @param regionId - The region whose requiem-hall to open (defaults to `roots`).
   * @param options - The open options (prerequisites, mode, world-state, seed).
   * @returns void
   */
  open(regionId?: string, options?: OpenRequiemHallOptions): void {
    const region = resolveRegionId(regionId);
    const withVelith = options?.withVelith ?? true;
    const run = withVelith
      ? ch4ReadyRun(region, options?.mode ?? "free")
      : newRunState();
    this.#session = openRequiemHall(
      REGIONS[region],
      run,
      options?.worldState ?? "reach",
      options?.seed ?? DEFAULT_REQUIEM_SEED
    );
  }

  /**
   * Advance the set-piece one authored beat (a no-op when gated or already complete),
   * delegating to {@link playRequiemHall}. A no-op before a hall is opened. Pure:
   * replaces the held session with the advanced one.
   * @returns void
   */
  play(): void {
    if (this.#session !== null) {
      this.#session = playRequiemHall(this.#session);
    }
  }

  /**
   * Drive the set-piece all the way to its terminal phase (a no-op when gated),
   * delegating to {@link playRequiemHallToCompletion} — the "an agent played the
   * Ch.4 beat to completion" verification action. A no-op before a hall is opened.
   * @returns void
   */
  playToCompletion(): void {
    if (this.#session !== null) {
      this.#session = playRequiemHallToCompletion(this.#session);
    }
  }

  /**
   * A snapshot of the opened/played requiem-hall, or null before a hall has been
   * opened. Lets the Ch.4 e2e assert the soft-gate, the beat progression, completion,
   * and the determinism digest.
   * @returns The requiem-hall snapshot, or null.
   */
  snapshot(): VerifyRequiemHallState | null {
    const session = this.#session;
    if (session === null) {
      return null;
    }
    return {
      regionId: session.regionId,
      locationName: session.locationName,
      worldState: session.worldState,
      reachable: isRequiemHallReachable(session),
      beat: session.beat,
      phase: session.phase,
      complete: isRequiemHallComplete(session),
      hash: hashRequiemHall(session),
    };
  }
}
