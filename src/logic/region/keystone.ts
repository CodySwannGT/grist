/**
 * The pure **Chapter-5 Mourne keystone set-piece** (#128, PRD #43 Scope-IN 5/8) —
 * the Act I *climax* beat authored on top of the shipped region framework (#119/#137)
 * and the upper-Vanta region module (this increment). Content is authoritative from
 * `wiki/narrative/main-quest.md` (Ch.5 — The keystone: "**Mr. Sallow** steps from the
 * background: courteous, total, already moving. The party races to stop his plan —
 * and *fails*"; "**Set-piece:** confrontation at a Mourne refinery atop Aurel's
 * corpse"; "**Gate:** Sallow triggers the Reckoning") and `wiki/design/regions.md`
 * (the Crown's House Mourne refinery-spire; "**Bound:** none caged here — the Crown
 * *consumes*, it doesn't hold"). This is upper Vanta's ONE anchor site — NOT a caged
 * Bound but the Reckoning trigger. Full voice-over / the complete confrontation is
 * deferred (living docs, decision 0003, out of scope); this models the set-piece's
 * *reachability gate* and its *play-state* as pure, deterministic, scene-agnostic
 * logic the `__VERIFY__` bridge drives — the direct analogue of the Ch.4 Sidhe
 * requiem-hall set-piece (`logic/region/requiem-hall`, #145) it is patterned on:
 *
 * - {@link openKeystone} resolves whether the keystone is reachable — its
 *   **soft-gate** (`wiki/design/regions.md`: "traversal and knowledge gate the map,
 *   not invisible walls or timers"). Upper Vanta cages no Bound, so — unlike the
 *   requiem-hall's Bound-attunement gate — the Ch.5 prerequisite is purely
 *   *traversal*: the run must have **reached the Mourne refinery-spire** (the
 *   region's authored keystone key location). A run that has not reached it opens a
 *   {@link KeystonePhases.gated} session that **neither plays nor errors** (AC: the
 *   keystone is reachable when its site is reached).
 * - {@link playKeystone} advances the beat one authored step — `sealed →
 *   sallow-steps → reckoning-triggered → complete` (AC: the keystone resolves and
 *   Sallow triggers the Reckoning) — a total reducer threading the seeded
 *   {@link rngStep} stream so the run is reproducible. It is a no-op on a gated
 *   session (cannot advance past the soft-gate) and idempotent once `complete` (the
 *   Reckoning fires ONCE — mirroring `reckon` and the requiem-hall's end-idempotence
 *   — so the keystone can never re-trigger or over-run).
 * - {@link keystoneTriggersReckoning} reads whether the beat has reached the point
 *   where Sallow triggers the Reckoning — the gate the region harness/world-turn
 *   consumes to flip `reach → ashfall`. The keystone models the *trigger*; the
 *   world-turn flip itself lives in `logic/world` (`reckon`) and the region harness
 *   (`actRegion` `reckon`), which this set-piece never re-implements.
 * - {@link hashKeystone} is the stable FNV-1a digest the determinism gate samples:
 *   same region + run + world-state + seed + action sequence ⇒ identical progression.
 *
 * Owns NO new region/world rules: it reads the region through the live world-state
 * (`resolveRegionVariant`, so the refinery-spire reads as "House Mourne's
 * Refinery-Spire" in Reach and "(the keystone struck)" in Ashfall without
 * per-call-site branching), reads the Ch.5 prerequisite off the reached-locations set
 * the traversal layer produces, and threads the same seeded RNG the harness uses.
 * Pure: ZERO Phaser (FR9), no I/O, no `Math.random` / `Date.now` / `performance.now`
 * — every output is a total function of its explicit inputs, so the set-piece is
 * deterministic and unit-testable headless. The `__VERIFY__` bridge cell
 * (`uat/keystone-cell`) consumes this; it re-implements nothing.
 * @module logic/region/keystone
 */
import { resolveRegionVariant, type RegionDef } from "../../content/regions";
import { rngStep } from "../rng";
import { type WorldState } from "../world";

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/**
 * The key-location id upper Vanta declares for the Ch.5 keystone — House Mourne's
 * refinery-spire atop Aurel's corpse (`content/regions`, #128). The set-piece's
 * reachability gate is "this location has been reached".
 */
export const KEYSTONE_LOCATION = "mourne-refinery-spire";

/**
 * The phases the Ch.5 Mourne keystone set-piece moves through. `gated` is the
 * soft-gate state (the refinery-spire has not been reached — the keystone is not
 * reachable and the beat never plays); the rest are the authored Ch.5 climax once
 * reachable: `sealed` (the spire reached, the confrontation not yet begun),
 * `sallow-steps` (Mr. Sallow steps from the background — courteous, total, already
 * moving), `reckoning-triggered` (the party fails; Sallow triggers the Reckoning —
 * the Act I climax gate), and `complete` (the beat has run to its end, the world
 * poised to turn to Ashfall).
 */
export const KeystonePhases = {
  /** The Ch.5 prerequisite is unmet — the keystone is soft-gated (not reachable). */
  gated: "gated",
  /** The refinery-spire is reached but the confrontation has not begun (beat 0). */
  sealed: "sealed",
  /** Mr. Sallow steps from the background: courteous, total, already moving. */
  sallowSteps: "sallow-steps",
  /** The party fails; Sallow triggers the Reckoning (the Act I climax gate). */
  reckoningTriggered: "reckoning-triggered",
  /** The Ch.5 beat has run to completion (the world poised to turn to Ashfall). */
  complete: "complete",
} as const;

/** A keystone set-piece phase (the literal-union of {@link KeystonePhases} values). */
export type KeystonePhase =
  (typeof KeystonePhases)[keyof typeof KeystonePhases];

/**
 * The authored beat order of the Ch.5 keystone once reachable — the sequence
 * {@link playKeystone} walks. `gated` is deliberately excluded: it is the
 * unreachable soft-gate state, not a beat the reducer advances into or out of.
 */
const BEAT_ORDER: readonly KeystonePhase[] = [
  KeystonePhases.sealed,
  KeystonePhases.sallowSteps,
  KeystonePhases.reckoningTriggered,
  KeystonePhases.complete,
];

/**
 * The beat index at which Sallow triggers the Reckoning — the Act I climax gate. At
 * or beyond this index the keystone reports {@link keystoneTriggersReckoning}, so the
 * region harness/world-turn can flip `reach → ashfall`. Derived from
 * {@link BEAT_ORDER} so the two never drift.
 */
const RECKONING_BEAT = BEAT_ORDER.indexOf(KeystonePhases.reckoningTriggered);

/**
 * A booted Ch.5 keystone set-piece — the unit the `__VERIFY__` bridge reads and
 * drives. Carries the region id, the refinery-spire location name in the live variant
 * (so it reads correctly in both world-states), the world-state the beat resolves
 * through, its reachability soft-gate, the current beat index into {@link BEAT_ORDER},
 * the current phase, and the live seeded-RNG state — everything the set-piece needs to
 * reproduce a run and digest it, with no Phaser and no ambient reads. Immutable — the
 * reducer returns fresh sessions.
 */
export interface KeystoneSession {
  /** The region hosting the set-piece (upper Vanta). */
  readonly regionId: string;
  /** The refinery-spire location name in the live variant (e.g. "(the keystone struck)" in Ashfall). */
  readonly locationName: string;
  /** The world-state the set-piece resolves through. */
  readonly worldState: WorldState;
  /** Whether the Ch.5 prerequisite is met (the refinery-spire reached — the soft-gate). */
  readonly reachable: boolean;
  /** The current beat index into {@link BEAT_ORDER} (0 = sealed / gated). */
  readonly beat: number;
  /** The current set-piece phase. */
  readonly phase: KeystonePhase;
  /** The live 32-bit seeded-RNG state (threaded, never read ambient). */
  readonly rngState: number;
}

/**
 * Seed the set-piece's RNG once at open from the region id + location + seed, so the
 * keystone threads a stream distinct from the region harness's (and the
 * requiem-hall's) even under the same numeric seed (the location salts it). A total
 * function of its inputs — no ambient reads (never `Math.random` / `Date.now`).
 * @param regionId - The region id, mixed into the seed.
 * @param seed - The 32-bit boot seed.
 * @returns The initial 32-bit RNG state.
 */
function seedFor(regionId: string, seed: number): number {
  const salt = `${regionId}:${KEYSTONE_LOCATION}`;
  const salted = Array.from(salt).reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    seed >>> 0
  );
  return salted >>> 0;
}

/**
 * The refinery-spire location's display name in the region's *live* variant — read
 * through {@link resolveRegionVariant} so the set-piece reads "House Mourne's
 * Refinery-Spire" in Act I *reach* and "House Mourne's Refinery-Spire (the keystone
 * struck)" in Act II *ashfall* with no per-call-site branching. Falls back to the
 * location id when the variant does not declare it (a defensive default — upper Vanta
 * declares it in both states). Pure.
 * @param region - The region to read.
 * @param worldState - The live world-state (selects the variant).
 * @returns The refinery-spire location name in the live variant.
 */
function keystoneLocationName(
  region: RegionDef,
  worldState: WorldState
): string {
  const variant = resolveRegionVariant(region, worldState);
  const location = variant.keyLocations.find(
    place => place.id === KEYSTONE_LOCATION
  );
  return location?.name ?? KEYSTONE_LOCATION;
}

/**
 * Open the Ch.5 Mourne keystone set-piece — resolve its soft-gate against the reached
 * locations and boot it to its starting phase. When the refinery-spire has not been
 * reached the session is {@link KeystonePhases.gated} (not reachable: it neither plays
 * nor errors); when reached it boots to {@link KeystonePhases.sealed} at beat 0, ready
 * to play. Reads the spire's name through the live world-state so it resolves
 * correctly in both variants, and seeds the beat's RNG from the region + seed so the
 * run is reproducible. Never throws — a gated keystone is an observable state, not an
 * error. Pure: a total function of its inputs.
 * @param region - The region hosting the set-piece (upper Vanta).
 * @param reachedLocations - The location ids the run has reached (the traversal gate).
 * @param worldState - The world-state the set-piece resolves through.
 * @param seed - The 32-bit boot seed threaded through the beat.
 * @returns The opened set-piece session (gated or sealed).
 */
export function openKeystone(
  region: RegionDef,
  reachedLocations: readonly string[],
  worldState: WorldState,
  seed: number
): KeystoneSession {
  const reachable = reachedLocations.includes(KEYSTONE_LOCATION);
  return {
    regionId: region.id,
    locationName: keystoneLocationName(region, worldState),
    worldState,
    reachable,
    beat: 0,
    phase: reachable ? KeystonePhases.sealed : KeystonePhases.gated,
    rngState: seedFor(region.id, seed),
  };
}

/**
 * Advance the set-piece one authored beat — the forward step. A no-op on a gated
 * (unreachable) session, so the soft-gate can never be played past; a no-op once
 * `complete`, so the Reckoning trigger can never re-fire or over-run. Each real step
 * consumes one RNG draw (threading the seeded {@link rngStep} stream so the digest
 * depends on the seed) and walks {@link BEAT_ORDER}: `sealed → sallow-steps →
 * reckoning-triggered → complete`. Pure — returns a fresh session (or the same logical
 * state on a no-op), mutates nothing.
 * @param session - The current set-piece session.
 * @returns The advanced session (or the same state when gated / already complete).
 */
export function playKeystone(session: KeystoneSession): KeystoneSession {
  if (!session.reachable) {
    return session;
  }
  if (session.phase === KeystonePhases.complete) {
    // Idempotent at the end: the Reckoning fires once; advancing past `complete` is a
    // no-op so the keystone cannot re-trigger or read past the authored sequence.
    return session;
  }
  const nextBeat = session.beat + 1;
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
 * {@link playKeystone} until the beat is `complete` (or returns the gated session
 * unchanged, since a gated keystone never completes). A bounded fold (the authored
 * beat is finite); the loop guard is {@link BEAT_ORDER}'s length so it can never spin.
 * Pure.
 * @param session - The opened set-piece session.
 * @returns The session at its terminal phase (`complete`, or `gated` if unreachable).
 */
export function playKeystoneToCompletion(
  session: KeystoneSession
): KeystoneSession {
  return BEAT_ORDER.reduce(
    current => (isKeystoneComplete(current) ? current : playKeystone(current)),
    session
  );
}

/**
 * Whether the keystone is reachable — the Ch.5 prerequisite is met (the refinery-spire
 * reached, resolved at {@link openKeystone}). A thin reader so a consumer can branch on
 * "is the keystone reachable?" without inspecting the session shape. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True when the keystone is reachable.
 */
export function isKeystoneReachable(session: KeystoneSession): boolean {
  return session.reachable;
}

/**
 * Whether the beat has reached the point where **Sallow triggers the Reckoning** — the
 * Act I climax gate the region harness/world-turn consumes to flip `reach → ashfall`.
 * True once the beat is at (or past) the `reckoning-triggered` phase; a gated
 * (unreachable) session never triggers. This models the *trigger*; the world-turn flip
 * itself lives in `logic/world` (`reckon`), which this set-piece never re-implements.
 * Pure.
 * @param session - The set-piece session to inspect.
 * @returns True when Sallow has triggered the Reckoning.
 */
export function keystoneTriggersReckoning(session: KeystoneSession): boolean {
  return session.reachable && session.beat >= RECKONING_BEAT;
}

/**
 * Whether the set-piece's Ch.5 beat has run to completion. A thin reader over the
 * phase so a consumer can branch on "did the climax finish?" without comparing the
 * literal by hand. A gated (unreachable) session is never complete. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True when the beat reached {@link KeystonePhases.complete}.
 */
export function isKeystoneComplete(session: KeystoneSession): boolean {
  return session.phase === KeystonePhases.complete;
}

/**
 * A stable FNV-1a digest of a keystone session — the determinism handle the
 * verification bridge samples. Folds the region id, the keystone location id + the
 * live world-state + resolved location name, the reachability flag, the beat index +
 * phase, and the live RNG state into a canonical string, then hashes it. Same region +
 * reached-set + world-state + seed + action sequence ⇒ identical 8-hex digest; the
 * gated and reachable keystones (and the two world-states) diverge. Pure: a total
 * function of its input.
 * @param session - The set-piece session to digest.
 * @returns An 8-char hex digest.
 */
export function hashKeystone(session: KeystoneSession): string {
  const canonical = [
    session.regionId,
    KEYSTONE_LOCATION,
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
