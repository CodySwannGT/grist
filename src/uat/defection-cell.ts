/**
 * The verification bridge's defection cell (#146) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the Halcyon-defection e2e can drive the Ch.4 defection
 * trigger and read the active party roster scene-agnostically, the same way
 * {@link import("./requiem-hall-cell").RequiemHallCell} drives the Ch.4 set-piece and
 * {@link import("./bound-site-cell").BoundSiteCell} drives the region's free-vs-wield
 * choice. The cell only *composes* the shipped kit and *holds* the resulting
 * {@link RunState} + {@link RequiemHallSession}; all rules live in `logic` (the
 * requiem-hall set-piece #145 + the pure defection reducer `logic/party/defection`) —
 * the bridge never re-implements them.
 *
 * The defection trigger is the *exact player path* the issue describes: reach the
 * Roots requiem-hall with Velith attuned (#144), play it until the requiem "reveals
 * the truth" (the `truth`/`complete` beat), then fire the defection. `withVelith:
 * false` opens the hall against a fresh (un-attuned) run so the e2e can exercise the
 * soft-gate (firing too early never recruits her).
 *
 * Persistence rides the *existing* save path: {@link DefectionCell.toSave} projects
 * the post-defection roster into a {@link CurrentSave} (via the pure
 * `rosterToSavedParty`) the bridge persists through `__VERIFY__.save` / restores
 * through `loadSave`, so the reload e2e asserts Halcyon survives IndexedDB. Extracted
 * so the bridge stays under its line budget. Zero Phaser, no I/O, no RNG of its own.
 * @module uat/defection-cell
 */
import { PARTY, REGIONS, RegionIds, type RegionId } from "../content";
import { newMoralLedger } from "../logic/free-vs-wield";
import {
  applyHalcyonDefection,
  isHalcyonInParty,
  rosterToSavedParty,
} from "../logic/party/defection";
import {
  chooseAtBoundSite,
  openBoundSite,
  openRequiemHall,
  playRequiemHallToCompletion,
  type RequiemHallSession,
} from "../logic/region";
import { newRunState, type RunState } from "../logic/run-state";
import { freshSave, type CurrentSave } from "../logic/save";
import type { ShardMode } from "../logic/save/types";
import type { Stats } from "../logic/combat/types";

/** A fixed default seed so the cell's defection path is reproducible across opens. */
const DEFAULT_DEFECTION_SEED = 0x4e91;
/** The region whose requiem-hall hosts Halcyon's defection (the Roots / the Deep). */
const DEFECTION_REGION: RegionId = RegionIds.roots;

/**
 * The options an e2e passes to open the defection's requiem-hall: whether to attune
 * the region's Bound first (meet the Ch.4 prerequisite — Velith attuned), in which
 * carry mode, and the boot seed. All optional — the defaults open a Ch.4-ready hall
 * (Velith freed) under the fixed seed.
 */
export interface OpenDefectionOptions {
  /** Whether to attune Velith first (meet the Ch.4 prerequisite). Default true. */
  readonly withVelith?: boolean;
  /** The carry mode to attune in when `withVelith` (defaults to `free`). */
  readonly mode?: ShardMode;
  /** The boot seed threaded through the requiem beat (defaults to the cell's seed). */
  readonly seed?: number;
}

/**
 * A read-only, scene-agnostic snapshot of one roster member — the shape the
 * defection e2e asserts on. Carries the member id, level, the authored 8-axis stat
 * block, and the hand-authored signature kit, so the e2e can assert Halcyon joined
 * *with her stats and kit*, not merely her id.
 */
export interface VerifyRosterMember {
  readonly id: string;
  readonly level: number;
  readonly baseStats: Stats;
  readonly signatureKit: readonly string[];
}

/**
 * A read-only, scene-agnostic snapshot of the defection state — the active party
 * roster (each member with its authored stat block + kit) and whether Halcyon has
 * joined. Bundled like the bridge's other cell snapshots.
 */
export interface VerifyDefectionState {
  /** The active party roster, in join order, each with stats + signature kit. */
  readonly roster: readonly VerifyRosterMember[];
  /** Whether Halcyon has joined the active party. */
  readonly halcyonJoined: boolean;
}

/**
 * Build a run that has met the Ch.4 prerequisites: Velith attuned through the Roots
 * Bound site (#144), in the given mode — the exact player path that makes the
 * requiem-hall reachable. A fresh (un-attuned) run when `withVelith` is false, to
 * exercise the soft-gate.
 * @param withVelith - Whether to attune Velith (meet the prerequisite).
 * @param mode - The carry mode to attune in.
 * @returns A run (Ch.4-ready or fresh).
 */
function defectionRun(withVelith: boolean, mode: ShardMode): RunState {
  if (!withVelith) {
    return newRunState();
  }
  return chooseAtBoundSite(
    openBoundSite(REGIONS[DEFECTION_REGION], newMoralLedger()),
    mode
  ).run;
}

/**
 * The bridge-held defection cell: open the Roots requiem-hall (Ch.4-ready or gated),
 * play it to the truth beat, fire Halcyon's defection, then read the active party
 * roster as one scene-agnostic {@link VerifyDefectionState} snapshot. Holds the live
 * {@link RunState} (seeded with the starting party) and the requiem session the
 * trigger gates on.
 */
export class DefectionCell {
  #run: RunState = newRunState();
  #requiem: RequiemHallSession | null = null;

  /**
   * Open the defection's requiem-hall for the current run — the "an agent reached
   * Halcyon's defection trigger" setup. Builds a Ch.4-ready run (Velith attuned) by
   * default; pass `withVelith: false` to open the soft-gated (unreachable) hall, or
   * `mode`/`seed` to vary the fork. Re-seeds the held run from the chosen prerequisite
   * so a re-open starts clean. Pure data through the content barrel + the logic kit.
   * @param options - The open options (prerequisite, mode, seed).
   * @returns void
   */
  openRequiem(options?: OpenDefectionOptions): void {
    const withVelith = options?.withVelith ?? true;
    this.#run = defectionRun(withVelith, options?.mode ?? "free");
    this.#requiem = openRequiemHall(
      REGIONS[DEFECTION_REGION],
      this.#run,
      "reach",
      options?.seed ?? DEFAULT_DEFECTION_SEED
    );
  }

  /**
   * Drive the opened requiem-hall to its `truth`/`complete` beat — the point the
   * requiem "reveals the truth" and Halcyon's defection becomes fireable. A no-op
   * before a requiem is opened (and a no-op on a gated hall, which never completes).
   * @returns void
   */
  playRequiemToTruth(): void {
    if (this.#requiem !== null) {
      this.#requiem = playRequiemHallToCompletion(this.#requiem);
    }
  }

  /**
   * Fire Halcyon's defection — fold {@link applyHalcyonDefection} over the held run,
   * gated on the held requiem session. A no-op (the same run) before the requiem
   * reveals the truth, or once she has already joined (idempotent). A no-op before a
   * requiem is opened. Pure: replaces the held run with the recruited one.
   * @returns void
   */
  fireDefection(): void {
    if (this.#requiem !== null) {
      this.#run = applyHalcyonDefection(this.#run, this.#requiem);
    }
  }

  /**
   * Project the post-defection roster into a {@link CurrentSave} the bridge persists
   * through the real `__VERIFY__.save` IndexedDB path (the reload e2e then restores it
   * and asserts Halcyon survives). Built on a {@link freshSave} baseline with the
   * roster projected via the pure `rosterToSavedParty`.
   * @returns A current-version save whose party is the live roster.
   */
  toSave(): CurrentSave {
    return { ...freshSave(), party: rosterToSavedParty(this.#run.roster) };
  }

  /**
   * A snapshot of the active party roster (each member with its authored stat block +
   * signature kit) and whether Halcyon has joined. Reads the live roster off the held
   * run and resolves each id to its {@link PARTY} entry, so the e2e asserts she joined
   * with her stats and kit.
   * @returns The defection snapshot.
   */
  snapshot(): VerifyDefectionState {
    const roster = this.#run.roster.map(id => {
      const member = PARTY[id];
      return {
        id: member.id,
        level: member.level,
        baseStats: member.baseStats,
        signatureKit: member.signatureKit,
      };
    });
    return { roster, halcyonJoined: isHalcyonInParty(this.#run) };
  }
}
