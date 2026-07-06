/**
 * The verification bridge's **Reckoning world-turn cell** (#125) — the in-memory
 * holder the `__VERIFY__` bridge owns so the Reckoning e2e can drive Sallow's Second
 * Sundering scene-agnostically and read the whole transform (world-flip, ash-swath,
 * party-scatter, Sable-lost, color/music drain) as one snapshot, the same way
 * {@link import("./keystone-cell").KeystoneCell} drives the Ch.5 keystone that triggers
 * it and {@link import("./reunion-cell").ReunionCell} drives the Act II board built on
 * its scatter. The cell only *composes* the shipped kit and *holds* the resulting
 * {@link ReckoningSession}; every rule (the keystone-trigger gate, the world-flip, the
 * scatter, the Sable-lost flag, the reunion seed, the digest) lives in
 * `logic/narrative/reckoning` — the bridge re-implements nothing.
 *
 * **The keystone trigger is wired through the set-piece here**: by default the cell
 * derives its `triggered` gate by opening upper Vanta's Ch.5 Mourne keystone (the
 * refinery-spire reached), playing it to completion, and reading
 * {@link keystoneTriggersReckoning} — so the Reckoning fires only because the keystone
 * fired, in production code, not merely in the test. An explicit `triggered: false`
 * opens the soft-gated set-piece so firing before the keystone can never turn the
 * world. Persistence rides the *existing* save (PR #214 precedent, no save-schema
 * bump): {@link ReckoningCell.toSave} projects the scattered roster into
 * `SaveDataV3.party` and the Sable-lost + seeded reunion statuses into
 * `SaveDataV3.scene.flags`. Zero Phaser, no I/O, no RNG of its own.
 * @module uat/reckoning-cell
 */
import {
  PARTY,
  PartyMemberIds,
  REGIONS,
  RegionIds,
  type PartyMemberId,
  type RegionId,
} from "../content";
import {
  KEYSTONE_LOCATION,
  keystoneTriggersReckoning,
  openKeystone,
  playKeystoneToCompletion,
} from "../logic/region";
import { rosterToSavedParty } from "../logic/party/defection";
import {
  hashReckoning,
  isReckoningComplete,
  isReckoningTriggered,
  openReckoning,
  playReckoning,
  playReckoningToCompletion,
  reckoningAshedSwath,
  reckoningDrained,
  reckoningRoster,
  reckoningSableLost,
  reckoningScattered,
  reckoningStatusFlags,
  reckoningWorldState,
  reckoningWorldTurned,
  rosterBeforeFromFlags,
  SABLE_LOST_FLAG,
  type ReckoningSession,
} from "../logic/narrative/reckoning";
import { newRunState } from "../logic/run-state";
import { freshSave, type CurrentSave } from "../logic/save";
import { INITIAL_WORLD_STATE, type WorldState } from "../logic/world";

/** A fixed default seed so the cell's Reckoning path is reproducible across opens. */
const DEFAULT_RECKONING_SEED = 0x2ec0;

/**
 * The pre-Reckoning Act I party carried into the Second Sundering: the Phase-1
 * starting party (Wren + Tobi) plus Halcyon (recruited by her Ch.4 defection), the
 * fully-assembled party the scatter reduces. Composed from `run-state` so the starting
 * roster has one source, then extended with the Ch.4 recruit.
 */
const ACT_ONE_ROSTER: readonly PartyMemberId[] = [
  ...newRunState().roster,
  PartyMemberIds.halcyon,
];

/**
 * The options an e2e passes to open the Reckoning set-piece: whether the Ch.5 keystone
 * has triggered it (defaults to deriving the trigger from the keystone itself), the
 * pre-turn world-state, the pre-Reckoning roster, and the boot seed. All optional — the
 * defaults open a keystone-triggered set-piece in Act I `reach` over the full Act I
 * party under the fixed seed.
 */
export interface OpenReckoningOptions {
  /** Force the keystone-trigger gate; omit to derive it from the Ch.5 keystone. */
  readonly triggered?: boolean;
  /** The world-state before the turn (defaults to Act I `reach`). */
  readonly worldState?: WorldState;
  /** The pre-Reckoning party roster (defaults to the full Act I party). */
  readonly roster?: readonly PartyMemberId[];
  /** The boot seed threaded through the beat (defaults to the cell's fixed seed). */
  readonly seed?: number;
}

/**
 * A read-only, scene-agnostic snapshot of the Reckoning set-piece — the shape the e2e
 * asserts on. Carries the keystone-trigger gate, the world-flip (`reach → ashfall`),
 * the ashed swath, the scatter (surviving + scattered rosters), the Sable-lost flag,
 * the color/music drain, the beat/phase/completion, and the determinism digest — one
 * snapshot covering all five AC clauses.
 */
export interface VerifyReckoningState {
  /** Whether the Ch.5 keystone has triggered the Reckoning (the soft-gate). */
  readonly triggered: boolean;
  /** The world-state before the turn (Act I `reach`). */
  readonly worldStateBefore: string;
  /** The live world-state (`ashfall` once the world has turned) — AC clause 1. */
  readonly worldState: string;
  /** Whether the open world has tipped into Ashfall. */
  readonly worldTurned: boolean;
  /** The swath rendered to ash — lower Vanta + a whole region — AC clause 2. */
  readonly ashedRegions: readonly string[];
  /** The pre-Reckoning roster (the scatter's "before"). */
  readonly rosterBefore: readonly string[];
  /** The active roster after the scatter (the survivors) — AC clause 3. */
  readonly roster: readonly string[];
  /** The companions scattered by the turn (reassembled in Act II) — AC clause 3. */
  readonly scattered: readonly string[];
  /** Whether Sable is lost — AC clause 4. */
  readonly sableLost: boolean;
  /** Whether the overworld's color/music have drained — AC clause 5. */
  readonly drained: boolean;
  /** The current beat index. */
  readonly beat: number;
  /** The current set-piece phase. */
  readonly phase: string;
  /** Whether the beat has run to completion. */
  readonly complete: boolean;
  /** A stable digest of the session for the determinism gate. */
  readonly hash: string;
}

/**
 * Resolve a saved party-member id (the raw `string` a persisted {@link CurrentSave}
 * carries) back to a typed {@link PartyMemberId}, dropping unknown ids defensively.
 * @param id - The saved member id to resolve.
 * @returns The typed party-member id, or null when unknown.
 */
function resolvePartyMemberId(id: string): PartyMemberId | null {
  return (Object.values(PartyMemberIds) as readonly string[]).includes(id)
    ? (id as PartyMemberId)
    : null;
}

/**
 * Whether a saved flag ledger records Sable as lost — the guard the reload path reads
 * so a restored save's `sable-lost` flag rehydrates the Reckoning state.
 * @param flags - The persisted scene-flag ledger.
 * @returns True when the ledger records Sable lost.
 */
function savedSableLost(flags: Readonly<Record<string, unknown>>): boolean {
  return flags[SABLE_LOST_FLAG] === true;
}

/**
 * The bridge-held Reckoning cell: open the Second Sundering set-piece (keystone-gated),
 * step its beat, then read the whole transform as one scene-agnostic
 * {@link VerifyReckoningState}. Holds the live {@link ReckoningSession}. Seeded to an
 * un-triggered gate until opened, so a stray read on a fresh boot cannot fabricate a
 * turned world.
 */
export class ReckoningCell {
  #session: ReckoningSession = openReckoning(
    false,
    INITIAL_WORLD_STATE,
    ACT_ONE_ROSTER,
    DEFAULT_RECKONING_SEED
  );

  /**
   * Whether upper Vanta's Ch.5 Mourne keystone triggers the Reckoning when played to
   * completion (the refinery-spire reached) — the wiring that fires the set-piece only
   * because the keystone fired. Composes the shipped keystone kit; re-implements nothing.
   * @param seed - The boot seed threaded through the keystone beat.
   * @returns True when the completed keystone triggers the Reckoning.
   */
  #triggerFromKeystone(seed: number): boolean {
    const region: RegionId = RegionIds.upperVanta;
    const reached = ["concord-hall", "grand-market", KEYSTONE_LOCATION];
    const played = playKeystoneToCompletion(
      openKeystone(REGIONS[region], reached, INITIAL_WORLD_STATE, seed)
    );
    return keystoneTriggersReckoning(played);
  }

  /**
   * Open the Reckoning set-piece — the "an agent reached and triggered the Reckoning"
   * setup. Derives the keystone-trigger gate from the Ch.5 keystone by default (pass
   * `triggered: false` to open the soft-gated set-piece so firing too early never turns
   * the world); reduces the full Act I party by default; boots in Act I `reach`.
   * @param options - The open options (trigger, world-state, roster, seed).
   * @returns void
   */
  open(options?: OpenReckoningOptions): void {
    const seed = options?.seed ?? DEFAULT_RECKONING_SEED;
    const triggered = options?.triggered ?? this.#triggerFromKeystone(seed);
    this.#session = openReckoning(
      triggered,
      options?.worldState ?? INITIAL_WORLD_STATE,
      options?.roster ?? ACT_ONE_ROSTER,
      seed
    );
  }

  /**
   * Advance the set-piece one authored beat (a no-op when gated or already complete),
   * delegating to {@link playReckoning}. A no-op before a set-piece is opened is
   * impossible — the cell always holds a session. Pure: replaces the held session.
   * @returns void
   */
  play(): void {
    this.#session = playReckoning(this.#session);
  }

  /**
   * Drive the set-piece all the way to its terminal phase (a no-op when gated),
   * delegating to {@link playReckoningToCompletion} — the "an agent played the world-turn
   * to completion (the world tips into Ashfall, the party scatters, Sable is lost)"
   * verification action.
   * @returns void
   */
  playToCompletion(): void {
    this.#session = playReckoningToCompletion(this.#session);
  }

  /**
   * Project the turned world-state + scattered roster + Sable-lost + seeded reunion
   * statuses into a {@link CurrentSave} the bridge persists through the real
   * `__VERIFY__.save` IndexedDB path (the reload e2e then restores it and asserts the
   * transform survives). The roster projects via the pure `rosterToSavedParty`; the
   * flags ride the existing `SaveDataV3.scene.flags` via `reckoningStatusFlags` — no
   * save-schema change (PR #214 precedent).
   * @returns A current-version save carrying the post-Reckoning world.
   */
  toSave(): CurrentSave {
    return {
      ...freshSave(),
      party: rosterToSavedParty(reckoningRoster(this.#session)),
      worldState: reckoningWorldState(this.#session),
      scene: {
        sceneId: "reckoning-second-sundering",
        nodeId: "the-world-turns",
        flags: reckoningStatusFlags(this.#session),
      },
    };
  }

  /**
   * Rehydrate the held state from a persisted {@link CurrentSave} — the seam the
   * bridge's reload path uses so `snapshot()` reflects the *restored* turned world after
   * a genuine reload, not a fresh set-piece. A save carrying Ashfall (or a `sable-lost`
   * flag) rebuilds a completed set-piece over the restored (survivor) roster; otherwise
   * a fresh un-triggered set-piece. Pure: rebuilds the held state, no I/O.
   * @param save - The persisted save whose world-state + party + flags rehydrate the cell.
   * @returns void
   */
  adopt(save: CurrentSave): void {
    const flags = save.scene?.flags ?? {};
    const survivors = save.party
      .map(member => resolvePartyMemberId(member.id))
      .filter((id): id is PartyMemberId => id !== null);
    // Prefer the persisted pre-Reckoning roster so a reload can still surface WHO was
    // scattered (the saved party carries only the survivor); fall back to the survivor
    // roster when the flag is absent (a pre-turn or legacy save).
    const persistedBefore = rosterBeforeFromFlags(flags);
    const rosterBefore =
      persistedBefore.length > 0 ? persistedBefore : survivors;
    const fired = save.worldState === "ashfall" || savedSableLost(flags);
    const opened = openReckoning(
      fired,
      INITIAL_WORLD_STATE,
      rosterBefore,
      DEFAULT_RECKONING_SEED
    );
    this.#session = fired ? playReckoningToCompletion(opened) : opened;
  }

  /**
   * Restore the cell to its fresh initial state — an un-triggered set-piece over the
   * full Act I party. The seam the bridge's `clearSave` path uses so a reset leaves the
   * Reckoning read showing an un-turned world. Pure: drops the held state.
   * @returns void
   */
  reset(): void {
    this.#session = openReckoning(
      false,
      INITIAL_WORLD_STATE,
      ACT_ONE_ROSTER,
      DEFAULT_RECKONING_SEED
    );
  }

  /**
   * A snapshot of the Reckoning set-piece — all five AC clauses (world-flip, ash-swath,
   * scatter, Sable-lost, drain) plus the beat/phase/completion and the determinism
   * digest. Reads through the pure `logic/narrative/reckoning` derivations so the e2e
   * asserts the transform, not the cell's bookkeeping.
   * @returns The Reckoning snapshot.
   */
  snapshot(): VerifyReckoningState {
    const session = this.#session;
    return {
      triggered: isReckoningTriggered(session),
      worldStateBefore: session.worldStateBefore,
      worldState: reckoningWorldState(session),
      worldTurned: reckoningWorldTurned(session),
      ashedRegions: reckoningAshedSwath(session),
      rosterBefore: session.rosterBefore.map(id => PARTY[id].id),
      roster: reckoningRoster(session).map(id => PARTY[id].id),
      scattered: reckoningScattered(session).map(id => PARTY[id].id),
      sableLost: reckoningSableLost(session),
      drained: reckoningDrained(session),
      beat: session.beat,
      phase: session.phase,
      complete: isReckoningComplete(session),
      hash: hashReckoning(session),
    };
  }
}
