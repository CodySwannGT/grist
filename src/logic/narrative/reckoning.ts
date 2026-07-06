/**
 * The pure **Reckoning world-turn set-piece** (#125, PRD #43 — FR7 / AC5 / Scope-IN
 * 6) — Sallow's **Second Sundering**, the midpoint hinge that turns Act I into Act
 * II. Content is authoritative from `wiki/narrative/main-quest.md` ("The Reckoning —
 * the world-turn": "Sallow's Second Sundering: he overloads Aurel's corpse-reactor
 * and renders a swath of the Reach at once. Lower Vanta and a whole region are
 * liquidated; the party is scattered and broken; Sable is taken/lost. The open world
 * tips into Ashfall. Hard cut; the music and color drain") and
 * `wiki/narrative/themes-and-tone.md` (the dimming-of-color motif + the Choir-song
 * leitmotif). This is the ONE beat that fires the world-turn; getting the transform
 * right is what makes the second half of the game playable.
 *
 * It **composes** the shipped machinery — it re-implements NONE of it — mirroring the
 * Ch.5 keystone (`logic/region/keystone`) it is triggered by, and the reunion
 * structure (`logic/party/reunion`) that is built on the scatter it authors:
 *
 * - **World-flip (reuses `logic/world`).** The turn flips the world-state via the
 *   shipped {@link reckon} (`reach → ashfall`, total + idempotent, consumes no RNG),
 *   never re-deriving the flag rules. Once turned, the whole authored map reads as
 *   Ashfall through the shipped `logic/region/world-map` resolver.
 * - **Keystone-gated.** The set-piece is reachable only once the Ch.5 Mourne keystone
 *   has triggered the Reckoning ({@link openReckoning}'s `triggered` gate, fed by
 *   `keystoneTriggersReckoning`). A set-piece opened un-triggered is a soft-gate that
 *   neither plays nor errors — the same "observable state, not a throw" idiom the
 *   keystone / requiem-hall soft-gates use.
 * - **The scatter transform (the genuinely NEW beat).** The party is reduced to the
 *   POV survivor ({@link RECKONING_SURVIVORS}: Wren, "or whoever the player held" —
 *   Ch.6); everyone else is scattered, and **Sable is lost** (a flag, not a roster
 *   removal — Sable is narrative cargo, never a {@link PartyMemberId}). This seeds the
 *   Act II reunion board (`logic/party/reunion` `openReunions`), whose docstring
 *   already assumes "scattered by the Reckoning" as its precondition — this module
 *   produces exactly the state it consumes.
 * - **Idempotent + total.** Every reducer that changes nothing returns the SAME
 *   logical state; the turn fires ONCE (idempotent at `complete`), so the world can
 *   never re-turn, the party can never re-scatter, and Sable can never be un-lost.
 * - **Seeded RNG only.** Each real beat consumes one {@link rngStep} draw (salted per
 *   module so the stream is distinct under a shared seed), so the digest depends on
 *   the seed + the action sequence. Never `Math.random` / `Date.now`.
 *
 * {@link hashReckoning} is the stable FNV-1a digest the determinism gate samples —
 * same trigger + roster + seed + action sequence ⇒ identical digest. Persistence
 * rides the *existing* save (PR #214 precedent, **no save-schema bump**): the
 * scattered roster projects into `SaveDataV3.party`, and the Sable-lost + seeded
 * reunion statuses project into the `SaveDataV3` scene-flag ledger via
 * {@link reckoningStatusFlags}. Pure: ZERO Phaser, no I/O, no ambient reads — every
 * output is a total function of its explicit inputs, so the world-turn is
 * deterministic and unit-testable headless.
 * @module logic/narrative/reckoning
 */
import { PartyMemberIds, type PartyMemberId } from "../../content/party";
import { RegionIds, type RegionId } from "../../content/regions";
import { openReunions, reunionStatusFlags } from "../party/reunion";
import { rngStep } from "../rng";
import { reckon, type WorldState } from "../world";

/** FNV-1a 32-bit offset basis (matches `logic/combat/hash`). */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/** The scene-flag key the Sable-lost beat persists under (rides `scene.flags`). */
export const SABLE_LOST_FLAG = "sable-lost";

/** The stable id of the Reckoning set-piece scene the content script authors. */
export const RECKONING_SCENE_ID = "reckoning-second-sundering";

/**
 * The node id at which the world turns (`reach → ashfall`) — the persisted scene
 * cursor a Reckoning save parks at, and the content script's world-turn beat.
 */
export const RECKONING_TURN_NODE_ID = "the-world-turns";

/**
 * The POV survivor(s) the scatter reduces the party to — Wren, the protagonist "or
 * whoever the player held" (`wiki/narrative/main-quest.md` Ch.6: "Alone in the
 * transformed world"). Everyone else in the pre-Reckoning roster is scattered, to be
 * reassembled through the Act II reunion quests. Authored once so the survivor set
 * has a single source.
 */
export const RECKONING_SURVIVORS: readonly PartyMemberId[] = [
  PartyMemberIds.wren,
];

/**
 * The swath of the Reach the Second Sundering renders to ash: **lower Vanta** and a
 * **whole region** (`wiki/narrative/main-quest.md`, `wiki/design/open-world.md` —
 * "lower Vanta and a region are liquidated"). The region is upper Vanta itself — the
 * Reckoning fires at House Mourne's refinery-spire atop Aurel's corpse, so the Crown
 * & Tiers are rendered (its Ashfall variant reads as "the Grey Crown & the Shuttered
 * Tiers", the ash-fallen aftermath of exactly this beat). Authored as world-state
 * data, distinct from the map-wide Ashfall grade (`logic/region/world-map`).
 */
const ASHED_LOWER_VANTA = "lower-vanta";
/** The whole region rendered to ash — upper Vanta, where the reactor is overloaded. */
const ASHED_REGION: RegionId = RegionIds.upperVanta;
/** The full authored ash-swath: lower Vanta + the rendered region, in narrative order. */
export const RECKONING_ASH_SWATH: readonly string[] = [
  ASHED_LOWER_VANTA,
  ASHED_REGION,
];

/**
 * The phases the Reckoning set-piece moves through. `gated` is the soft-gate (the
 * Ch.5 keystone has not triggered — the turn never plays); the rest are the authored
 * world-turn once triggered: `sealed` (the keystone struck, the turn not yet begun),
 * `sallow-overloads` (Sallow overloads Aurel's corpse-reactor), `world-turns` (the
 * open world tips into Ashfall — lower Vanta + a region rendered, the color/music
 * drain), `scattered` (the party is scattered and broken; Sable is taken/lost), and
 * `complete` (the hard cut has landed; the world poised as Act II Ashfall).
 */
export const ReckoningPhases = {
  /** The Ch.5 keystone has not triggered — the set-piece is soft-gated. */
  gated: "gated",
  /** The keystone struck but the world-turn has not begun (beat 0). */
  sealed: "sealed",
  /** Sallow overloads Aurel's corpse-reactor. */
  sallowOverloads: "sallow-overloads",
  /** The open world tips into Ashfall — a swath rendered, the color/music drain. */
  worldTurns: "world-turns",
  /** The party is scattered and broken; Sable is taken/lost. */
  scattered: "scattered",
  /** The hard cut has landed; the world poised as Act II Ashfall. */
  complete: "complete",
} as const;

/** A Reckoning set-piece phase (the literal-union of {@link ReckoningPhases}). */
export type ReckoningPhase =
  (typeof ReckoningPhases)[keyof typeof ReckoningPhases];

/**
 * The authored beat order once triggered — the sequence {@link playReckoning} walks.
 * `gated` is excluded: it is the unreachable soft-gate, not a beat the reducer
 * advances into or out of.
 */
const BEAT_ORDER: readonly ReckoningPhase[] = [
  ReckoningPhases.sealed,
  ReckoningPhases.sallowOverloads,
  ReckoningPhases.worldTurns,
  ReckoningPhases.scattered,
  ReckoningPhases.complete,
];

/**
 * The beat index at which the world turns to Ashfall — at or past it the open world
 * has tipped (`reach → ashfall`), the ash-swath is rendered, and the color/music
 * drain. Derived from {@link BEAT_ORDER} so the two never drift.
 */
const TURN_BEAT = BEAT_ORDER.indexOf(ReckoningPhases.worldTurns);
/**
 * The beat index at which the party scatters and Sable is lost — at or past it the
 * roster is reduced to {@link RECKONING_SURVIVORS} and the Sable-lost flag falls.
 * Strictly after {@link TURN_BEAT}: the world tips, *then* the hard cut scatters.
 */
const SCATTER_BEAT = BEAT_ORDER.indexOf(ReckoningPhases.scattered);

/**
 * A booted Reckoning set-piece — the unit the `__VERIFY__` bridge reads and drives.
 * Carries the keystone-trigger soft-gate, the pre-turn world-state + roster (the
 * "before" the AC compares against), the current beat + phase, the boot seed (for the
 * reunion-board seeding projection), and the live seeded-RNG state. Immutable — the
 * reducer returns fresh sessions; every observable (the turned world-state, the ashed
 * swath, the scattered roster, the Sable-lost flag) is derived from the beat.
 */
export interface ReckoningSession {
  /** Whether the Ch.5 keystone has triggered the Reckoning (the soft-gate). */
  readonly triggered: boolean;
  /** The world-state before the turn (Act I `reach`; the "before" the AC asserts). */
  readonly worldStateBefore: WorldState;
  /** The pre-Reckoning party roster (the "before" the scatter reduces). */
  readonly rosterBefore: readonly PartyMemberId[];
  /** The current beat index into {@link BEAT_ORDER} (0 = sealed / gated). */
  readonly beat: number;
  /** The current set-piece phase. */
  readonly phase: ReckoningPhase;
  /** The boot seed — threaded into the seeded reunion board the scatter seeds. */
  readonly seed: number;
  /** The live 32-bit seeded-RNG state (threaded, never read ambient). */
  readonly rngState: number;
}

/**
 * Seed the set-piece's RNG once at open from a fixed salt + seed, so the Reckoning
 * stream is distinct from the keystone's / reunion's under the same numeric seed. A
 * total function of its inputs — no ambient reads. Mirrors the `seedFor` idiom the
 * sibling set-pieces use.
 * @param seed - The 32-bit boot seed.
 * @returns The initial 32-bit RNG state.
 */
function seedFor(seed: number): number {
  const salted = Array.from("reckoning-second-sundering").reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    seed >>> 0
  );
  return salted >>> 0;
}

/**
 * Open the Reckoning world-turn set-piece — resolve its keystone-trigger soft-gate
 * and boot it to its starting phase. When the Ch.5 keystone has not triggered the
 * session is {@link ReckoningPhases.gated} (it neither plays nor errors); when
 * triggered it boots to {@link ReckoningPhases.sealed} at beat 0, ready to play.
 * Records the pre-turn world-state + roster as the "before" the transform is measured
 * against, and seeds the beat's RNG so the run is reproducible. Never throws — a gated
 * set-piece is an observable state. Pure: a total function of its inputs.
 * @param triggered - Whether the Ch.5 keystone has triggered the Reckoning (the gate).
 * @param worldStateBefore - The world-state before the turn (Act I `reach`).
 * @param rosterBefore - The pre-Reckoning party roster (the scatter's "before").
 * @param seed - The 32-bit boot seed threaded through the beat.
 * @returns The opened set-piece session (gated or sealed).
 */
export function openReckoning(
  triggered: boolean,
  worldStateBefore: WorldState,
  rosterBefore: readonly PartyMemberId[],
  seed: number
): ReckoningSession {
  return {
    triggered,
    worldStateBefore,
    rosterBefore,
    beat: 0,
    phase: triggered ? ReckoningPhases.sealed : ReckoningPhases.gated,
    seed,
    rngState: seedFor(seed),
  };
}

/**
 * Advance the set-piece one authored beat — the forward step. A no-op on a gated
 * (un-triggered) session, so the soft-gate can never be played past; a no-op once
 * `complete`, so the turn can never re-fire or over-run. Each real step consumes one
 * RNG draw (threading the seeded {@link rngStep} stream) and walks {@link BEAT_ORDER}:
 * `sealed → sallow-overloads → world-turns → scattered → complete`. Pure — returns a
 * fresh session (or the same logical state on a no-op).
 * @param session - The current set-piece session.
 * @returns The advanced session (or the same state when gated / already complete).
 */
export function playReckoning(session: ReckoningSession): ReckoningSession {
  if (!session.triggered) {
    return session;
  }
  if (session.phase === ReckoningPhases.complete) {
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
 * {@link playReckoning} until the beat is `complete` (or returns the gated session
 * unchanged). A bounded fold (the authored beat is finite); the loop guard is
 * {@link BEAT_ORDER}'s length so it can never spin. Pure.
 * @param session - The opened set-piece session.
 * @returns The session at its terminal phase (`complete`, or `gated` if un-triggered).
 */
export function playReckoningToCompletion(
  session: ReckoningSession
): ReckoningSession {
  return BEAT_ORDER.reduce(
    current =>
      isReckoningComplete(current) ? current : playReckoning(current),
    session
  );
}

/**
 * Whether the set-piece is triggered — the Ch.5 keystone has fired the Reckoning. A
 * thin reader over the soft-gate. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True when the Reckoning has been triggered.
 */
export function isReckoningTriggered(session: ReckoningSession): boolean {
  return session.triggered;
}

/**
 * Whether the set-piece's beat has run to completion (the hard cut has landed). A
 * gated (un-triggered) session is never complete. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True when the beat reached {@link ReckoningPhases.complete}.
 */
export function isReckoningComplete(session: ReckoningSession): boolean {
  return session.phase === ReckoningPhases.complete;
}

/**
 * Whether the world has turned — the beat is at or past {@link TURN_BEAT}, so the
 * open world has tipped into Ashfall (a swath rendered, the color/music drain). A
 * gated session never turns. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True once the open world has tipped into Ashfall.
 */
export function reckoningWorldTurned(session: ReckoningSession): boolean {
  return session.triggered && session.beat >= TURN_BEAT;
}

/**
 * Whether the party has scattered — the beat is at or past {@link SCATTER_BEAT}, so
 * the roster is reduced to {@link RECKONING_SURVIVORS} and Sable is lost. A gated
 * session never scatters. Pure.
 * @param session - The set-piece session to inspect.
 * @returns True once the party has been scattered.
 */
export function reckoningScatterHappened(session: ReckoningSession): boolean {
  return session.triggered && session.beat >= SCATTER_BEAT;
}

/**
 * The live world-state resolved through the set-piece: the pre-turn `worldStateBefore`
 * before the world turns, and the shipped {@link reckon} flip (`ashfall`) once it has.
 * Composes `logic/world` — never re-derives the flag rules. Pure.
 * @param session - The set-piece session to read.
 * @returns The world-state now (`reach` before the turn, `ashfall` after).
 */
export function reckoningWorldState(session: ReckoningSession): WorldState {
  return reckoningWorldTurned(session)
    ? reckon(session.worldStateBefore)
    : session.worldStateBefore;
}

/**
 * The swath of the Reach rendered to ash by the turn — {@link RECKONING_ASH_SWATH}
 * (lower Vanta + the rendered region) once the world has turned, empty before. Pure.
 * @param session - The set-piece session to read.
 * @returns The ashed swath, or an empty list before the turn.
 */
export function reckoningAshedSwath(
  session: ReckoningSession
): readonly string[] {
  return reckoningWorldTurned(session) ? RECKONING_ASH_SWATH : [];
}

/**
 * The active party roster after the set-piece: the pre-Reckoning roster before the
 * scatter, reduced to only the {@link RECKONING_SURVIVORS} once the party has
 * scattered. Reads through the fixed survivor set so the reduction is deterministic.
 * Pure.
 * @param session - The set-piece session to read.
 * @returns The roster now (full before the scatter, the survivors after).
 */
export function reckoningRoster(
  session: ReckoningSession
): readonly PartyMemberId[] {
  if (!reckoningScatterHappened(session)) {
    return session.rosterBefore;
  }
  return session.rosterBefore.filter(id => RECKONING_SURVIVORS.includes(id));
}

/**
 * The companions scattered by the turn — every pre-Reckoning member NOT among the
 * {@link RECKONING_SURVIVORS}, once the party has scattered (empty before). These are
 * the members the Act II reunion quests reassemble. Pure.
 * @param session - The set-piece session to read.
 * @returns The scattered members, or an empty list before the scatter.
 */
export function reckoningScattered(
  session: ReckoningSession
): readonly PartyMemberId[] {
  if (!reckoningScatterHappened(session)) {
    return [];
  }
  return session.rosterBefore.filter(id => !RECKONING_SURVIVORS.includes(id));
}

/**
 * Whether Sable is lost — taken in the scatter (`wiki/narrative/main-quest.md`:
 * "Sable is taken/lost"). True once the party has scattered. Sable is narrative cargo,
 * never a {@link PartyMemberId}, so this is a flag, not a roster removal. Pure.
 * @param session - The set-piece session to read.
 * @returns True once Sable has been lost.
 */
export function reckoningSableLost(session: ReckoningSession): boolean {
  return reckoningScatterHappened(session);
}

/**
 * Whether the overworld's color/music have drained — the "hard cut; the music and
 * color drain" that coincides with the world turning to Ashfall
 * (`wiki/narrative/themes-and-tone.md`, the dimming-of-color motif). True once the
 * world has turned. Pure.
 * @param session - The set-piece session to read.
 * @returns True once the overworld is visibly transformed (color/music drained).
 */
export function reckoningDrained(session: ReckoningSession): boolean {
  return reckoningWorldTurned(session);
}

/**
 * Project the set-piece's persisted flags into a scene-flag ledger the existing
 * `SaveDataV3.scene.flags` carries — the Sable-lost flag plus the **seeded Act II
 * reunion board** (every reunion `available`, via the shipped `reunionStatusFlags`
 * over `openReunions` in the turned world-state), so a reload restores both "Sable is
 * lost" and a reunion board ready to reassemble the scattered party — no save-schema
 * change (PR #214 precedent). Before the scatter, only the (false) Sable flag is
 * projected; the reunions seed once the world has turned to Ashfall. Pure.
 * @param session - The set-piece session to project.
 * @returns The Reckoning scene-flag ledger.
 */
export function reckoningStatusFlags(
  session: ReckoningSession
): Readonly<Record<string, boolean | string>> {
  const sable = { [SABLE_LOST_FLAG]: reckoningSableLost(session) };
  if (!reckoningWorldTurned(session)) {
    return sable;
  }
  const board = openReunions(reckoningWorldState(session), session.seed);
  return { ...sable, ...reunionStatusFlags(board) };
}

/**
 * A stable FNV-1a digest of a Reckoning session — the determinism handle the gate
 * samples. Folds the trigger gate, the before/after world-state, the ashed swath, the
 * surviving + scattered rosters, the Sable-lost + drained flags, the beat + phase, and
 * the live RNG state into a canonical string, then hashes it with the same FNV-1a fold
 * + stable order the sibling set-pieces use. Same trigger + roster + seed + action
 * sequence ⇒ identical 8-hex digest; each real beat (which advances the RNG and the
 * derived state) changes it. Pure: a total function of its input.
 * @param session - The set-piece session to digest.
 * @returns An 8-char hex digest.
 */
export function hashReckoning(session: ReckoningSession): string {
  const canonical = [
    session.triggered ? "triggered" : "gated",
    session.worldStateBefore,
    reckoningWorldState(session),
    reckoningAshedSwath(session).join(","),
    reckoningRoster(session).join(","),
    reckoningScattered(session).join(","),
    reckoningSableLost(session) ? "sable-lost" : "sable-held",
    reckoningDrained(session) ? "drained" : "lit",
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
