/**
 * The pure **Act II reunion structure** (#140, PRD #43 — FR8 / AC6) — the open,
 * nonlinear, optional/missable reunion-quest board the player reassembles the
 * secondary roster through in Act II's FFVI "World of Ruin" beat
 * (`wiki/narrative/main-quest.md` Ch.7 — "Gathering the lost"). Content is
 * authoritative from the reunion catalog (`content/reunions.ts`) + the companion
 * stat blocks (`content/party.ts`); this module owns the *rules*: when a reunion is
 * reachable, how it completes or is bypassed, how the missable seal falls, how a
 * completed reunion recruits its companion, and the determinism digest.
 *
 * It composes — never re-specs — the shipped kit, mirroring the requiem-hall
 * set-piece (`logic/region/requiem-hall.ts`) + the defection reducer
 * (`logic/party/defection.ts`):
 *
 * - **Ashfall-gated (reuses the world-state flag).** Reunions are reachable only
 *   after the world has turned — {@link openReunions} resolves `reachable` from
 *   {@link isAshfall}. A board opened in Act I `reach` is a soft-gate that neither
 *   completes nor errors (every reducer is a no-op), the same "observable state, not
 *   a throw" idiom the requiem-hall soft-gate uses.
 * - **Nonlinear + optional/missable.** Each reunion resolves independently:
 *   {@link completeReunion} recruits its companion; {@link bypassReunion} records it
 *   `missed`; {@link advancePastReunions} (reaching a later beat) seals every
 *   still-available reunion `missed`. Any order; nothing is required.
 * - **Idempotent + total.** A reducer that changes nothing returns the SAME object
 *   (structural sharing) — completing/bypassing an already-resolved reunion, or any
 *   action on a gated board, can never re-fire or duplicate a join.
 * - **Seeded RNG only.** A real completion consumes one {@link rngStep} draw (the
 *   reunion's encounter variance), so the digest depends on the seed + the action
 *   sequence; the bypass/seal transitions roll nothing. Never `Math.random`.
 *
 * {@link hashReunions} is the stable FNV-1a digest the determinism gate samples —
 * same world-state + seed + action sequence ⇒ identical digest. Pure: ZERO Phaser,
 * no I/O, no `Math.random` / `Date.now`, so the structure is deterministic and
 * unit-testable headless. Persistence (which reunions completed / were permanently
 * missed) rides the existing save: the roster projects into `SaveDataV3.party` via
 * `rosterToSavedParty`, and the per-reunion statuses project into the `SaveDataV3`
 * scene-flag ledger via {@link reunionStatusFlags} — no save-schema change.
 * @module logic/party/reunion
 */
import {
  REUNIONS,
  REUNION_ORDER,
  type ReunionId,
} from "../../content/reunions";
import { type PartyMemberId } from "../../content/party";
import { rngStep } from "../rng";
import { isAshfall, type WorldState } from "../world";

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;
/**
 * The scene-flag key prefix each reunion's persisted status is stored under (module-
 * private — the persisted keys are produced by {@link reunionStatusFlags} and read
 * back by {@link reunionSessionFromFlags}, so no consumer needs the raw prefix).
 */
const REUNION_FLAG_PREFIX = "reunion:";

/**
 * The resolution state of a single reunion quest. `available` — not yet resolved
 * (reachable to complete or bypass); `completed` — the reunion was finished and its
 * companion recruited; `missed` — the reunion was permanently bypassed or sealed by
 * advancing past the reunion window (missable — it cannot be re-opened).
 */
export const ReunionStatuses = {
  /** Not yet resolved — reachable to complete or bypass. */
  available: "available",
  /** Finished — the companion has been recruited. */
  completed: "completed",
  /** Permanently bypassed / sealed by advancing — missable, never re-opened. */
  missed: "missed",
} as const;

/** A reunion status (the literal-union of {@link ReunionStatuses}). */
export type ReunionStatus =
  (typeof ReunionStatuses)[keyof typeof ReunionStatuses];

/** The per-reunion status map, keyed by every {@link ReunionId}. */
export type ReunionStatusMap = Readonly<Record<ReunionId, ReunionStatus>>;

/**
 * A booted reunion-structure session — the scene-agnostic unit the `__VERIFY__`
 * bridge reads and drives. Carries the live world-state, whether the board is
 * reachable (the Ashfall soft-gate), the per-reunion status map, and the seeded-RNG
 * state threaded through completions. Immutable — the reducers return fresh sessions.
 */
export interface ReunionSession {
  /** The world-state the board resolves through (reunions open only in `ashfall`). */
  readonly worldState: WorldState;
  /** Whether the world has turned — the Ashfall soft-gate (false in `reach`). */
  readonly reachable: boolean;
  /** The per-reunion resolution status (completed / missed / available). */
  readonly statuses: ReunionStatusMap;
  /** The live 32-bit seeded-RNG state (threaded through completions, never ambient). */
  readonly rngState: number;
}

/**
 * Seed the board's RNG once at open from a fixed salt + seed, so the reunion stream
 * is distinct from other set-pieces under the same numeric seed. A total function of
 * its inputs — no ambient reads (never `Math.random` / `Date.now`).
 * @param seed - The 32-bit boot seed.
 * @returns The initial 32-bit RNG state.
 */
function seedFor(seed: number): number {
  const salted = Array.from("act2-reunions").reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    seed >>> 0
  );
  return salted >>> 0;
}

/**
 * Every reunion starting `available` — the fresh board's status map.
 * @returns A status map with every reunion set to `available`.
 */
function allAvailable(): ReunionStatusMap {
  return REUNION_ORDER.reduce<Record<ReunionId, ReunionStatus>>(
    (acc, id) => ({ ...acc, [id]: ReunionStatuses.available }),
    {} as Record<ReunionId, ReunionStatus>
  );
}

/**
 * Open the Act II reunion board — resolve its Ashfall soft-gate against the world-
 * state and boot every reunion to `available`. A board opened in Act I `reach` is not
 * reachable (its reducers are all no-ops — the reunions are unreachable until the
 * world turns); an `ashfall` board is reachable and ready to resolve. Never throws.
 * Pure — a total function of its inputs.
 * @param worldState - The live world-state (the Ashfall gate).
 * @param seed - The 32-bit boot seed threaded through completions.
 * @returns The opened reunion session.
 */
export function openReunions(
  worldState: WorldState,
  seed: number
): ReunionSession {
  return {
    worldState,
    reachable: isAshfall(worldState),
    statuses: allAvailable(),
    rngState: seedFor(seed),
  };
}

/**
 * Whether the board is reachable — the world has turned to Ashfall. A thin reader so
 * a consumer can branch on the soft-gate without inspecting the session shape. Pure.
 * @param session - The reunion session to inspect.
 * @returns True when the board is reachable.
 */
export function isReunionsReachable(session: ReunionSession): boolean {
  return session.reachable;
}

/**
 * The status of one reunion in the board. Pure reader.
 * @param session - The reunion session to inspect.
 * @param id - The reunion whose status to read.
 * @returns The reunion's current status.
 */
export function reunionStatus(
  session: ReunionSession,
  id: ReunionId
): ReunionStatus {
  return session.statuses[id];
}

/**
 * Whether the given reunion has been completed (its companion recruited). Pure.
 * @param session - The reunion session to inspect.
 * @param id - The reunion whose status to read.
 * @returns True when the reunion is completed.
 */
export function isReunionCompleted(
  session: ReunionSession,
  id: ReunionId
): boolean {
  return session.statuses[id] === ReunionStatuses.completed;
}

/**
 * Whether the given reunion was permanently missed (bypassed or sealed). Pure.
 * @param session - The reunion session to inspect.
 * @param id - The reunion whose status to read.
 * @returns True when the reunion is missed.
 */
export function isReunionMissed(
  session: ReunionSession,
  id: ReunionId
): boolean {
  return session.statuses[id] === ReunionStatuses.missed;
}

/**
 * Set one reunion's status when it is a legal, reachable transition, threading the
 * given next RNG state; otherwise return the SAME session (structural-sharing no-op).
 * A transition is legal only on a reachable board and only from `available` — an
 * already-resolved reunion (completed/missed) or a gated board never changes, so a
 * reunion can never be re-completed, un-missed, or resolved before the world turns.
 * @param session - The current session (never mutated).
 * @param id - The reunion to transition.
 * @param status - The target status.
 * @param rngState - The RNG state to record (unchanged for a non-rolling transition).
 * @returns The next session, or the same object on a no-op.
 */
function setReunionStatus(
  session: ReunionSession,
  id: ReunionId,
  status: ReunionStatus,
  rngState: number
): ReunionSession {
  if (
    !session.reachable ||
    session.statuses[id] !== ReunionStatuses.available
  ) {
    return session;
  }
  return {
    ...session,
    statuses: { ...session.statuses, [id]: status },
    rngState,
  };
}

/**
 * Complete a reunion — resolve its self-contained story and recruit its companion
 * (AC scenario: "the completed companion has joined the party"). A no-op (the same
 * object) on a gated board or an already-resolved reunion, so it can never re-fire or
 * duplicate a join. A real completion consumes one seeded {@link rngStep} draw (the
 * reunion's encounter variance), so the digest depends on the seed + action sequence.
 * The companion itself joins via {@link reunionRoster} / {@link completedCompanions},
 * which read the completed statuses. Pure — returns fresh state, mutates nothing.
 * @param session - The current session (never mutated).
 * @param id - The reunion to complete.
 * @returns The session with the reunion completed, or the same object on a no-op.
 */
export function completeReunion(
  session: ReunionSession,
  id: ReunionId
): ReunionSession {
  const stepped = rngStep(session.rngState);
  return setReunionStatus(
    session,
    id,
    ReunionStatuses.completed,
    stepped.state
  );
}

/**
 * Bypass a reunion — the player skips it, recording it permanently `missed` (AC
 * scenario: "the bypassed reunion is recorded as missable/missed, and play proceeds
 * without requiring it"). A no-op (the same object) on a gated board or an
 * already-resolved reunion. Bypassing rolls nothing (no encounter), so the RNG state
 * is unchanged. Pure — returns fresh state, mutates nothing.
 * @param session - The current session (never mutated).
 * @param id - The reunion to bypass.
 * @returns The session with the reunion missed, or the same object on a no-op.
 */
export function bypassReunion(
  session: ReunionSession,
  id: ReunionId
): ReunionSession {
  return setReunionStatus(
    session,
    id,
    ReunionStatuses.missed,
    session.rngState
  );
}

/**
 * Advance past the reunion window — reach a later beat, sealing every still-`available`
 * reunion `missed` (the second half of AC scenario: reaching a later beat records the
 * un-done reunions as missable/missed while play proceeds). Completed and already-missed
 * reunions are untouched. A no-op (the same object) on a gated board or when nothing is
 * still available (idempotent — a second advance seals nothing new). Rolls nothing.
 * Pure — returns fresh state, mutates nothing.
 * @param session - The current session (never mutated).
 * @returns The session with every open reunion sealed missed, or the same object on a no-op.
 */
export function advancePastReunions(session: ReunionSession): ReunionSession {
  if (!session.reachable) {
    return session;
  }
  const openIds = REUNION_ORDER.filter(
    id => session.statuses[id] === ReunionStatuses.available
  );
  if (openIds.length === 0) {
    return session;
  }
  const statuses = openIds.reduce<ReunionStatusMap>(
    (acc, id) => ({ ...acc, [id]: ReunionStatuses.missed }),
    session.statuses
  );
  return { ...session, statuses };
}

/**
 * The companions of the completed reunions, in the canonical {@link REUNION_ORDER}
 * (not completion order) — the deterministic set of recruits the board has produced.
 * Reading through the fixed order means the same completed set always yields the same
 * roster, so a join never depends on the order the player completed reunions in. Pure.
 * @param session - The reunion session to read.
 * @returns The recruited companions, in canonical order.
 */
export function completedCompanions(
  session: ReunionSession
): readonly PartyMemberId[] {
  return REUNION_ORDER.filter(
    id => session.statuses[id] === ReunionStatuses.completed
  ).map(id => REUNIONS[id].companion);
}

/**
 * Project the active roster after the reunions: the base roster (the party carried
 * into Act II) with every completed reunion's companion appended in canonical order,
 * de-duplicated (a companion already on the base roster is never doubled). This is
 * how "the completed companion has joined the party" surfaces, and how "the finale
 * scales to the party you bring" is realised — the roster grows only by who you
 * found. Pure — a total map, reads nothing ambient.
 * @param baseRoster - The party roster carried into the reunion window (join order).
 * @param session - The reunion session whose completions to fold in.
 * @returns The active roster including the recruited companions.
 */
export function reunionRoster(
  baseRoster: readonly PartyMemberId[],
  session: ReunionSession
): readonly PartyMemberId[] {
  return completedCompanions(session).reduce<readonly PartyMemberId[]>(
    (roster, companion) =>
      roster.includes(companion) ? roster : [...roster, companion],
    baseRoster
  );
}

/**
 * Project the per-reunion statuses into a scene-flag ledger the existing
 * `SaveDataV3.scene.flags` persists (a `Record` of primitive flags) — the persistence
 * seam for "which reunions are completed, and which were permanently missed" with no
 * save-schema change. Each reunion is stored under a `reunion:<id>` key. Pure.
 * @param session - The reunion session to project.
 * @returns The reunion-status flag ledger.
 */
export function reunionStatusFlags(
  session: ReunionSession
): Readonly<Record<string, ReunionStatus>> {
  return REUNION_ORDER.reduce<Record<string, ReunionStatus>>(
    (acc, id) => ({
      ...acc,
      [`${REUNION_FLAG_PREFIX}${id}`]: session.statuses[id],
    }),
    {}
  );
}

/**
 * Whether a value is a valid {@link ReunionStatus} — the guard the restore path uses
 * so a corrupt/foreign scene flag defaults to `available` rather than a bad status.
 * @param value - The candidate flag value.
 * @returns True when the value is a defined reunion status.
 */
function isReunionStatus(value: unknown): value is ReunionStatus {
  return (
    value === ReunionStatuses.available ||
    value === ReunionStatuses.completed ||
    value === ReunionStatuses.missed
  );
}

/**
 * Rebuild a reunion session from a persisted scene-flag ledger — the restore seam the
 * bridge's reload path uses so a reloaded save surfaces the *restored* completed/missed
 * statuses (and, through {@link reunionRoster}, the recruited companions), not a fresh
 * board. Reads each `reunion:<id>` flag back into the status map (defaulting an absent
 * or malformed flag to `available`), resolves reachability from the restored
 * world-state, and re-seeds the RNG from `seed` (the completions already happened — the
 * live stream is not itself persisted). Pure — reads nothing ambient.
 * @param flags - The persisted scene-flag ledger (may hold non-reunion flags too).
 * @param worldState - The restored world-state (the Ashfall gate).
 * @param seed - The boot seed to re-seed the RNG from.
 * @returns The restored reunion session.
 */
export function reunionSessionFromFlags(
  flags: Readonly<Record<string, unknown>>,
  worldState: WorldState,
  seed: number
): ReunionSession {
  const statuses = REUNION_ORDER.reduce<Record<ReunionId, ReunionStatus>>(
    (acc, id) => {
      const flag = flags[`${REUNION_FLAG_PREFIX}${id}`];
      return {
        ...acc,
        [id]: isReunionStatus(flag) ? flag : ReunionStatuses.available,
      };
    },
    {} as Record<ReunionId, ReunionStatus>
  );
  return {
    worldState,
    reachable: isAshfall(worldState),
    statuses,
    rngState: seedFor(seed),
  };
}

/**
 * A stable FNV-1a digest of a reunion session — the determinism handle the
 * verification samples. Folds the world-state, the reachability flag, every reunion's
 * status (in canonical order), and the live RNG state into a canonical string, then
 * hashes it with the same FNV-1a fold + stable key order the requiem-hall / defection
 * digests use. Same world-state + seed + action sequence ⇒ identical 8-hex digest; a
 * completion (which advances the RNG) changes it. Pure: a total function of its input.
 * @param session - The reunion session to digest.
 * @returns An 8-char hex digest.
 */
export function hashReunions(session: ReunionSession): string {
  const canonical = [
    session.worldState,
    session.reachable ? "open" : "gated",
    ...REUNION_ORDER.map(id => `${id}=${session.statuses[id]}`),
    String(session.rngState >>> 0),
  ].join("|");
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}
