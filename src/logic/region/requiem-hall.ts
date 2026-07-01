/**
 * The pure **Sidhe requiem-hall Chapter 4 set-piece** (#145, PRD #43 Scope-IN 4) —
 * the Ch.4 beat inside the Roots / the Deep, authored on top of the shipped region
 * framework (#119/#137) and the Roots region module (#143). Content is authoritative
 * from `wiki/narrative/main-quest.md` (Ch.4 — The requiem: "a fragment of the
 * Choir's Song, and the truth cracks open: the Sundering was *murder for profit*")
 * and `wiki/design/regions.md` (the Sidhe requiem-hall key location). Full voice-over
 * and the complete requiem-rite singing are deferred (`wiki/design/audio-direction.md`,
 * out of scope); this models the set-piece's *reachability gate* and its *play-state*
 * as pure, deterministic, scene-agnostic logic the `__VERIFY__` bridge drives:
 *
 * - {@link openRequiemHall} resolves whether the hall is reachable — its **soft-gate**
 *   (`wiki/design/regions.md`: "traversal and knowledge gate the map, not invisible
 *   walls or timers"). The Ch.4 prerequisite is the **Roots Bound (Velith) attuned**:
 *   the chapter "teaches Bound shard learning in practice", so the requiem-hall opens
 *   only once the player has reached + resolved the region's Bound site (#144) — free
 *   OR wield both count (the knowledge is the gate, not the morality of the carry). A
 *   run that has not attuned Velith opens a {@link RequiemHallPhases.gated} session
 *   that **neither plays nor errors** (AC scenario 2).
 * - {@link playRequiemHall} advances the beat one authored step — `sealed → singing →
 *   truth → complete` (AC scenario 1) — a total reducer threading the seeded
 *   {@link import("../rng").rngStep} stream so the run is reproducible. It is a no-op
 *   on a gated session (cannot advance past the soft-gate) and idempotent once
 *   `complete` (the beat can never re-fire or over-run), mirroring the harness's
 *   `advance`-past-end and the Bound-site's settle-idempotence.
 * - {@link hashRequiemHall} is the stable FNV-1a digest the determinism gate samples:
 *   same region + run + world-state + seed + action sequence ⇒ identical progression.
 *
 * Owns NO new region/world rules: it reads the region through the live world-state
 * (`resolveRegionVariant`, so the hall reads as "The Sidhe Requiem-Hall" in Reach and
 * "(dimmed)" in Ashfall without per-call-site branching), reads the Ch.4 prerequisite
 * off the {@link RunState} the Bound-site kit (#135/#144) already produces, and threads
 * the same seeded RNG the harness uses. Pure: ZERO Phaser (FR9), no I/O, no
 * `Math.random` / `Date.now` / `performance.now` — every output is a total function of
 * its explicit inputs, so the set-piece is deterministic and unit-testable headless.
 * @module logic/region/requiem-hall
 */
import { resolveRegionVariant, type RegionDef } from "../../content/regions";
import { type RunState } from "../run-state";
import { rngStep } from "../rng";
import { type WorldState } from "../world";

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/** The key-location id the Roots region declares for the set-piece (#143). */
const REQUIEM_HALL_LOCATION = "sidhe-requiem-hall";

/**
 * The phases the Sidhe requiem-hall set-piece moves through. `gated` is the
 * soft-gate state (the Ch.4 prerequisites are not met — the hall is not reachable
 * and the beat never plays); the rest are the authored Ch.4 beat once reachable:
 * `sealed` (the hall reached, the rite not yet begun), `singing` (the last of the
 * Withered sing a fragment of the Choir's Song), `truth` (the truth cracks open —
 * the Sundering was murder for profit), and `complete` (the beat ran to its end).
 */
export const RequiemHallPhases = {
  /** The Ch.4 prerequisites are unmet — the hall is soft-gated (not reachable). */
  gated: "gated",
  /** The hall is reached but the rite has not begun (beat 0, reachable). */
  sealed: "sealed",
  /** The last of the Withered sing a fragment of the Choir's Song. */
  singing: "singing",
  /** The truth cracks open mid-music (the original sin laid bare). */
  truth: "truth",
  /** The Ch.4 beat has run to completion. */
  complete: "complete",
} as const;

/** A requiem-hall set-piece phase (the literal-union of {@link RequiemHallPhases}). */
export type RequiemHallPhase =
  (typeof RequiemHallPhases)[keyof typeof RequiemHallPhases];

/**
 * The authored order of the reachable Ch.4 beat — the sequence {@link playRequiemHall}
 * walks once the hall is reachable. `gated` is deliberately absent: it is the
 * soft-gate state, reached only when the prerequisites are unmet, never stepped into
 * or out of by playing.
 */
const BEAT_ORDER: readonly RequiemHallPhase[] = [
  RequiemHallPhases.sealed,
  RequiemHallPhases.singing,
  RequiemHallPhases.truth,
  RequiemHallPhases.complete,
];

/**
 * A booted requiem-hall set-piece session — the scene-agnostic unit the `__VERIFY__`
 * bridge reads and drives. Carries the region id + the resolved variant's
 * requiem-hall location name (read through the live world-state, so it reads
 * differently in Reach vs. Ashfall), the live world-state, whether the hall is
 * reachable (the soft-gate), the current beat index + phase, and the seeded-RNG state
 * threaded through the beat. Immutable — the reducer returns fresh sessions.
 */
export interface RequiemHallSession {
  /** The region hosting the set-piece (the Roots / the Deep). */
  readonly regionId: string;
  /** The requiem-hall location name in the live variant (e.g. "(dimmed)" in Ashfall). */
  readonly locationName: string;
  /** The world-state the set-piece resolves through. */
  readonly worldState: WorldState;
  /** Whether the Ch.4 prerequisites are met (the soft-gate). */
  readonly reachable: boolean;
  /** The current beat index into {@link BEAT_ORDER} (0 = sealed / gated). */
  readonly beat: number;
  /** The current set-piece phase. */
  readonly phase: RequiemHallPhase;
  /** The live 32-bit seeded-RNG state (threaded, never read ambient). */
  readonly rngState: number;
}

/**
 * Seed the set-piece's RNG once at open from the region id + location + seed, so the
 * requiem-hall threads a stream distinct from the region harness's even under the
 * same numeric seed (the location salts it). A total function of its inputs — no
 * ambient reads (never `Math.random` / `Date.now`).
 * @param regionId - The region id, mixed into the seed.
 * @param seed - The 32-bit boot seed.
 * @returns The initial 32-bit RNG state.
 */
function seedFor(regionId: string, seed: number): number {
  const salt = `${regionId}:${REQUIEM_HALL_LOCATION}`;
  const salted = Array.from(salt).reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    seed >>> 0
  );
  return salted >>> 0;
}

/**
 * The requiem-hall location's display name in the region's *live* variant — read
 * through {@link resolveRegionVariant} so the set-piece reads "The Sidhe Requiem-Hall"
 * in Act I *reach* and "The Sidhe Requiem-Hall (dimmed)" in Act II *ashfall* with no
 * per-call-site branching. Falls back to the location id when the variant does not
 * declare it (a defensive default — the Roots region declares it in both states).
 * Pure.
 * @param region - The region to read.
 * @param worldState - The live world-state (selects the variant).
 * @returns The requiem-hall location name in the live variant.
 */
function requiemHallName(region: RegionDef, worldState: WorldState): string {
  const variant = resolveRegionVariant(region, worldState);
  const location = variant.keyLocations.find(
    place => place.id === REQUIEM_HALL_LOCATION
  );
  return location?.name ?? REQUIEM_HALL_LOCATION;
}

/**
 * Whether a run has met the Ch.4 prerequisites for the region's requiem-hall — the
 * soft-gate predicate. The chapter "teaches Bound shard learning in practice"
 * (`wiki/narrative/main-quest.md`), so the prerequisite is the **region's Bound
 * (Velith) attuned**: the run must carry the region's `boundSite` shard (acquired by
 * reaching + resolving the Bound site, #144). Either carry mode (free or wield) opens
 * the hall — the *knowledge* is the gate, not the morality of the carry. Pure.
 * @param region - The region whose Bound gates the chapter.
 * @param run - The run to inspect.
 * @returns True when the region's Bound has been attuned.
 */
function ch4PrerequisitesMet(region: RegionDef, run: RunState): boolean {
  // A region that cages no Bound (`boundSite` undefined — e.g. upper Vanta, #128)
  // has no attunement gate to satisfy; the requiem-hall is a Roots (#145) beat, so
  // for a Bound-less region the prerequisite is vacuously unmet (the hall is not its
  // set-piece). Guarding the optional shard also keeps `includes(undefined)` from
  // silently matching a run that carries no shards.
  return (
    region.boundSite !== undefined && run.shards.includes(region.boundSite)
  );
}

/**
 * Open the Sidhe requiem-hall set-piece — resolve its soft-gate against the run and
 * boot it to its starting phase. When the Ch.4 prerequisites are unmet the session is
 * {@link RequiemHallPhases.gated} (not reachable: it neither plays nor errors — AC
 * scenario 2); when met it boots to {@link RequiemHallPhases.sealed} at beat 0, ready
 * to play (AC scenario 1). Reads the hall's name through the live world-state so it
 * resolves correctly in both variants, and seeds the beat's RNG from the region +
 * seed so the run is reproducible. Never throws — a gated hall is an observable state,
 * not an error. Pure: a total function of its inputs.
 * @param region - The region hosting the set-piece (the Roots / the Deep).
 * @param run - The run carrying (or not) the Ch.4 prerequisite (Velith attuned).
 * @param worldState - The world-state the set-piece resolves through.
 * @param seed - The 32-bit boot seed threaded through the beat.
 * @returns The opened set-piece session (gated or sealed).
 */
export function openRequiemHall(
  region: RegionDef,
  run: RunState,
  worldState: WorldState,
  seed: number
): RequiemHallSession {
  const reachable = ch4PrerequisitesMet(region, run);
  return {
    regionId: region.id,
    locationName: requiemHallName(region, worldState),
    worldState,
    reachable,
    beat: 0,
    phase: reachable ? RequiemHallPhases.sealed : RequiemHallPhases.gated,
    rngState: seedFor(region.id, seed),
  };
}

/**
 * Advance the set-piece one authored beat — the forward step (AC scenario 1). A no-op
 * on a gated (unreachable) session, so the soft-gate can never be played past (AC
 * scenario 2); a no-op once `complete`, so the beat can never re-fire or over-run.
 * Each real step consumes one RNG draw (threading the seeded {@link rngStep} stream so
 * the digest depends on the seed) and walks {@link BEAT_ORDER}: `sealed → singing →
 * truth → complete`. Pure — returns a fresh session (or the same logical state on a
 * no-op), mutates nothing.
 * @param session - The current set-piece session.
 * @returns The advanced session (or the same state when gated / already complete).
 */
export function playRequiemHall(
  session: RequiemHallSession
): RequiemHallSession {
  if (!session.reachable) {
    return session;
  }
  const nextBeat = session.beat + 1;
  if (nextBeat >= BEAT_ORDER.length) {
    // Idempotent at the end: the last index is `complete`; advancing past it is a
    // no-op so the beat cannot re-fire or read past the authored sequence.
    if (session.phase === RequiemHallPhases.complete) {
      return session;
    }
  }
  const stepped = rngStep(session.rngState);
  return {
    ...session,
    beat: nextBeat,
    phase: BEAT_ORDER[nextBeat]!,
    rngState: stepped.state,
  };
}

/**
 * Drive the set-piece all the way to its terminal phase — repeatedly applies
 * {@link playRequiemHall} until the beat is `complete` (or returns the gated session
 * unchanged, since a gated hall never completes). A bounded fold (the authored beat is
 * finite); the loop guard is {@link BEAT_ORDER}'s length so it can never spin. Pure.
 * @param session - The opened set-piece session.
 * @returns The session at its terminal phase (`complete`, or `gated` if unreachable).
 */
export function playRequiemHallToCompletion(
  session: RequiemHallSession
): RequiemHallSession {
  return BEAT_ORDER.reduce(
    current =>
      isRequiemHallComplete(current) ? current : playRequiemHall(current),
    session
  );
}

/**
 * Whether the requiem-hall is reachable — the Ch.4 prerequisites are met (the read of
 * the soft-gate resolved at {@link openRequiemHall}). A thin reader so a consumer can
 * branch on "is the hall reachable?" without inspecting the session shape. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True when the hall is reachable.
 */
export function isRequiemHallReachable(session: RequiemHallSession): boolean {
  return session.reachable;
}

/**
 * Whether the set-piece's Ch.4 beat has run to completion. A thin reader over the
 * phase so a consumer can branch on "did the beat finish?" without comparing the
 * literal by hand. A gated (unreachable) session is never complete. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True when the beat reached {@link RequiemHallPhases.complete}.
 */
export function isRequiemHallComplete(session: RequiemHallSession): boolean {
  return session.phase === RequiemHallPhases.complete;
}

/**
 * A stable FNV-1a digest of a requiem-hall session — the determinism handle the
 * verification bridge samples. Folds the region id, the live world-state + resolved
 * location name, the reachability flag, the beat index + phase, and the live RNG state
 * into a canonical string, then hashes it. Same region + run + world-state + seed +
 * action sequence ⇒ identical 8-hex digest; the gated and reachable halls (and the two
 * world-states) diverge. Pure: a total function of its input.
 * @param session - The set-piece session to digest.
 * @returns An 8-char hex digest.
 */
export function hashRequiemHall(session: RequiemHallSession): string {
  const canonical = [
    session.regionId,
    REQUIEM_HALL_LOCATION,
    session.locationName,
    session.worldState,
    session.reachable ? "open" : "gated",
    String(session.beat),
    session.phase,
    String(session.rngState >>> 0),
  ].join("|");
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}
