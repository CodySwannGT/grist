/**
 * The verification bridge's **Act II reunion cell** (#140) — the in-memory holder the
 * `__VERIFY__` bridge owns so the reunion-structure e2e can drive the open, nonlinear,
 * optional/missable reunion quests and read the active party roster scene-agnostically,
 * the same way {@link import("./defection-cell").DefectionCell} drives Halcyon's Ch.4
 * defection. The cell only *composes* the shipped kit (the reunion catalog
 * `content/reunions` + the pure reunion structure `logic/party/reunion`) and *holds*
 * the resulting {@link ReunionSession} + base roster; every rule (Ashfall-gating,
 * complete/bypass, the missable seal, the roster-join, the digest) lives in `logic`.
 *
 * The reunion path is the exact player journey the issue describes: with the world
 * turned to Ashfall, complete one reunion (its companion joins), bypass another
 * (recorded missed), and advance past the window (the rest sealed missed) — play
 * proceeds regardless of who was found. Persistence rides the *existing* save:
 * {@link ReunionCell.toSave} projects the recruited roster into `SaveDataV3.party` (via
 * the pure `rosterToSavedParty`) and the per-reunion statuses into the `SaveDataV3`
 * scene-flag ledger (via `reunionStatusFlags`), so the reload e2e asserts both the
 * roster and the missed/completed statuses survive IndexedDB — no save-schema change.
 * Zero Phaser, no I/O, no RNG of its own.
 * @module uat/reunion-cell
 */
import {
  PARTY,
  PartyMemberIds,
  type PartyMemberId,
  type ReunionId,
} from "../content";
import { rosterToSavedParty } from "../logic/party/defection";
import {
  advancePastReunions,
  bypassReunion,
  completeReunion,
  hashReunions,
  isReunionsReachable,
  openReunions,
  reunionRoster,
  reunionSessionFromFlags,
  reunionStatusFlags,
  type ReunionSession,
  type ReunionStatusMap,
} from "../logic/party/reunion";
import { newRunState } from "../logic/run-state";
import { freshSave, type CurrentSave } from "../logic/save";
import { type WorldState } from "../logic/world";
import { type Stats } from "../logic/combat/types";

/** A fixed default seed so the cell's reunion path is reproducible across opens. */
const DEFAULT_REUNION_SEED = 0x5e17;
/** The scene id the reunion-status flags persist under (a virtual Act II board). */
const REUNION_SCENE_ID = "act2-reunions";
/** The dialogue-node id the reunion-status scene parks at (a board cursor). */
const REUNION_NODE_ID = "gathering-the-lost";

/**
 * The options an e2e passes to open the reunion board: the world-state (the Ashfall
 * gate) and the boot seed. Both optional — the defaults open a reachable board in Act
 * II `ashfall` under the fixed seed.
 */
export interface OpenReunionOptions {
  /** The world-state the board resolves through (defaults to `ashfall` — reachable). */
  readonly worldState?: WorldState;
  /** The boot seed threaded through completions (defaults to the cell's seed). */
  readonly seed?: number;
}

/**
 * A read-only, scene-agnostic snapshot of one roster member — the shape the reunion
 * e2e asserts on. Carries the member id, level, the authored 8-axis stat block, and
 * the hand-authored signature kit, so the e2e can assert a companion joined *with its
 * stats and kit*, not merely its id.
 */
export interface VerifyReunionMember {
  readonly id: string;
  readonly level: number;
  readonly baseStats: Stats;
  readonly signatureKit: readonly string[];
}

/**
 * A read-only, scene-agnostic snapshot of the reunion state — the active roster (each
 * member with its authored stat block + kit), the per-reunion status map (completed /
 * missed / available), whether the board is reachable (the Ashfall gate), and the
 * determinism digest. Bundled like the bridge's other cell snapshots.
 */
export interface VerifyReunionState {
  /** The active party roster, in join order, each with stats + signature kit. */
  readonly roster: readonly VerifyReunionMember[];
  /** The per-reunion resolution status (completed / missed / available). */
  readonly statuses: ReunionStatusMap;
  /** Whether the reunion board is reachable — the world has turned to Ashfall. */
  readonly reachable: boolean;
  /** The stable determinism digest of the board (identical for identical actions). */
  readonly hash: string;
}

/**
 * Resolve a saved party-member id (the raw `string` a persisted {@link CurrentSave}
 * carries) back to a typed {@link PartyMemberId}, or null when unknown. A known-id
 * guard so rehydration drops a corrupt/forward-dated id defensively rather than
 * trusting an arbitrary string into the typed roster.
 * @param id - The saved member id to resolve.
 * @returns The typed party-member id, or null when unknown.
 */
function resolvePartyMemberId(id: string): PartyMemberId | null {
  return (Object.values(PartyMemberIds) as readonly string[]).includes(id)
    ? (id as PartyMemberId)
    : null;
}

/**
 * The bridge-held reunion cell: open the Act II reunion board (reachable in Ashfall,
 * gated in Reach), complete / bypass reunions and advance past the window, then read
 * the active party roster + per-reunion statuses as one scene-agnostic
 * {@link VerifyReunionState}. Holds the base roster (the party carried into Act II) and
 * the live {@link ReunionSession} the reunions resolve through.
 */
export class ReunionCell {
  #baseRoster: readonly PartyMemberId[] = newRunState().roster;
  #session: ReunionSession = openReunions("ashfall", DEFAULT_REUNION_SEED);

  /**
   * Open the reunion board for the current base roster — the "an agent reached the
   * Act II reunions" setup. Opens reachable in Act II `ashfall` by default; pass
   * `{ worldState: "reach" }` to open the Ashfall-gated (unreachable) board so firing
   * too early never recruits anyone, or `seed` to vary the fork. Resets the base
   * roster to the fresh starting party so a re-open starts clean.
   * @param options - The open options (world-state, seed).
   * @returns void
   */
  open(options?: OpenReunionOptions): void {
    this.#baseRoster = newRunState().roster;
    this.#session = openReunions(
      options?.worldState ?? "ashfall",
      options?.seed ?? DEFAULT_REUNION_SEED
    );
  }

  /**
   * Complete a reunion — resolve its story and recruit its companion (a no-op on a
   * gated board or an already-resolved reunion).
   * @param id - The reunion to complete.
   * @returns void
   */
  complete(id: ReunionId): void {
    this.#session = completeReunion(this.#session, id);
  }

  /**
   * Bypass a reunion — record it permanently missed (a no-op on a gated board or an
   * already-resolved reunion).
   * @param id - The reunion to bypass.
   * @returns void
   */
  bypass(id: ReunionId): void {
    this.#session = bypassReunion(this.#session, id);
  }

  /**
   * Advance past the reunion window — reach a later beat, sealing every still-open
   * reunion missed (a no-op on a gated board or when nothing is still open).
   * @returns void
   */
  advance(): void {
    this.#session = advancePastReunions(this.#session);
  }

  /**
   * Project the recruited roster + per-reunion statuses into a {@link CurrentSave} the
   * bridge persists through the real `__VERIFY__.save` IndexedDB path (the reload e2e
   * then restores it and asserts the roster + statuses survive). The roster projects
   * via the pure `rosterToSavedParty`; the statuses ride the existing `SaveDataV3`
   * scene-flag ledger via `reunionStatusFlags` — no save-schema change.
   * @returns A current-version save carrying the recruited party + reunion statuses.
   */
  toSave(): CurrentSave {
    const roster = reunionRoster(this.#baseRoster, this.#session);
    return {
      ...freshSave(),
      party: rosterToSavedParty(roster),
      worldState: this.#session.worldState,
      scene: {
        sceneId: REUNION_SCENE_ID,
        nodeId: REUNION_NODE_ID,
        flags: reunionStatusFlags(this.#session),
      },
    };
  }

  /**
   * Rehydrate the held state from a persisted {@link CurrentSave} — the seam the
   * bridge's reload path uses so `snapshot()` reflects the *restored* roster + reunion
   * statuses after a genuine reload, not a fresh board. Rebuilds the base roster from
   * `save.party` (dropping unknown ids defensively) and the reunion session from the
   * persisted scene-flag ledger + world-state, so a completed reunion's companion is
   * still joined and a missed reunion is still missed. Pure: rebuilds the held state,
   * no I/O.
   * @param save - The persisted save whose party + scene flags rehydrate the cell.
   * @returns void
   */
  adopt(save: CurrentSave): void {
    this.#baseRoster = save.party
      .map(member => resolvePartyMemberId(member.id))
      .filter((id): id is PartyMemberId => id !== null);
    this.#session = reunionSessionFromFlags(
      save.scene?.flags ?? {},
      save.worldState,
      DEFAULT_REUNION_SEED
    );
  }

  /**
   * Restore the cell to its fresh initial state — a starting base roster and a freshly
   * opened Ashfall board (nothing completed or missed). The seam the bridge's
   * `clearSave` path uses so a reset leaves the reunion read showing the starting party
   * with an untouched board. Pure: drops the held state.
   * @returns void
   */
  reset(): void {
    this.#baseRoster = newRunState().roster;
    this.#session = openReunions("ashfall", DEFAULT_REUNION_SEED);
  }

  /**
   * A snapshot of the active party roster (base roster + recruited companions, each
   * with its authored stat block + signature kit), the per-reunion status map, the
   * reachability gate, and the determinism digest. Reads the live roster through
   * `reunionRoster` and resolves each id to its {@link PARTY} entry, so the e2e asserts
   * a companion joined with its stats and kit.
   * @returns The reunion snapshot.
   */
  snapshot(): VerifyReunionState {
    const roster = reunionRoster(this.#baseRoster, this.#session).map(id => {
      const member = PARTY[id];
      return {
        id: member.id,
        level: member.level,
        baseStats: member.baseStats,
        signatureKit: member.signatureKit,
      };
    });
    return {
      roster,
      statuses: this.#session.statuses,
      reachable: isReunionsReachable(this.#session),
      hash: hashReunions(this.#session),
    };
  }
}
