/**
 * The pure **per-region boot/runtime harness** (#137, PRD #43 Scope-IN 1 / AC8) —
 * the reusable framework that boots a region authored against the {@link RegionDef}
 * template into a deterministic, scene-agnostic *session* the verification bridge
 * drives. Built once here and reused for every region, so each region is verifiable
 * the same way through `window.__VERIFY__` without re-inventing its harness:
 *
 * - {@link bootRegion} validates a region against the both-states schema and boots
 *   it into a {@link RegionRunState} keyed to a region-scoped scene
 *   ({@link regionScene}, e.g. `"region:marrow"`). A region that fails validation
 *   **throws on boot** — the harness rejects a broken scene rather than rendering
 *   one (AC scenario 2; the e2e proves the live canvas catches it).
 * - {@link actRegion} advances the session through the *resolved variant's*
 *   encounter playlist (`advance`) or warps the live world-state (`reckon`) — a
 *   total reducer threading a seeded {@link Rng} stream, so the run is reproducible.
 * - {@link hashRegionRun} is the stable FNV-1a digest of the run — the
 *   scene-agnostic analogue of the battle state-hash. Same region + seed + action
 *   sequence ⇒ identical digest progression (the determinism thesis, AC scenario 1).
 *
 * Logic stays in `src/logic` with ZERO Phaser imports (FR9): the harness is a total
 * function of its explicit inputs, uses only the seeded {@link Rng} (never
 * `Math.random` / `Date.now` / `performance.now`), and reads nothing ambient. The
 * `__VERIFY__` bridge cell (`uat/region-harness-cell`) and the Field-style scene
 * pipeline consume this; neither re-implements the rules. The *asset* side of the
 * pipeline (texture keys generated programmatically per region) rides the existing
 * typed-asset idiom — no binary assets, no licensing risk — and is resolved here as
 * the region's deterministic backdrop key so a scene can preload it by key.
 * @module logic/region/region-runtime
 */
import {
  isCompleteRegion,
  resolveRegionVariant,
  validateRegion,
  type EncounterId,
  type RegionDef,
} from "../../content";
import { rngStep } from "../rng";
import { type WorldState } from "../world";

/** The phases a region session moves through as the harness drives it. */
export const RegionPhases = {
  /** The region has booted and is walking its encounter playlist. */
  exploring: "exploring",
  /** Every encounter in the resolved variant has been cleared. */
  complete: "complete",
} as const;

/** A region-session phase (the literal-union of {@link RegionPhases} values). */
export type RegionPhase = (typeof RegionPhases)[keyof typeof RegionPhases];

/** The actions the harness reducer accepts. */
export const RegionActionKinds = {
  /** Clear the encounter under the cursor and advance to the next. */
  advance: "advance",
  /** Fire the Reckoning world-turn, warping the session to its Ashfall variant. */
  reckon: "reckon",
} as const;

/** A region-harness action kind. */
export type RegionActionKind =
  (typeof RegionActionKinds)[keyof typeof RegionActionKinds];

/** An action pushed into the harness reducer (currently parameter-free). */
export interface RegionAction {
  readonly kind: RegionActionKind;
}

/**
 * A booted region session — the scene-agnostic run state the `__VERIFY__` bridge
 * reads with `scene()` / `state()` and drives with `act()`. Carries the region id,
 * its region-scoped scene key, the live world-state, the asset backdrop key the
 * scene preloads, the cursor into the resolved encounter playlist, the cleared
 * encounters, the phase, and the seeded RNG state — everything the harness needs to
 * reproduce a run and digest it, with no Phaser and no ambient reads.
 */
export interface RegionRunState {
  /**
   * The booted region — the session's source of truth, carried so {@link actRegion}
   * advances against the same authored data without a registry lookup (the harness
   * is per-region, including author-supplied regions outside {@link REGIONS}). It is
   * excluded from {@link hashRegionRun}; the digest folds the *resolved* data instead.
   */
  readonly region: RegionDef;
  readonly regionId: string;
  readonly scene: string;
  readonly worldState: WorldState;
  /** The deterministic backdrop asset key this region boots against. */
  readonly backdrop: string;
  /** The index of the next encounter to clear in the resolved variant's table. */
  readonly cursor: number;
  /** The encounter ids cleared so far, in order. */
  readonly cleared: readonly EncounterId[];
  readonly phase: RegionPhase;
  /** The live 32-bit seeded-RNG state (threaded, never read ambient). */
  readonly rngState: number;
}

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/**
 * The region-scoped scene key the harness boots a region under — `"region:<id>"`.
 * A region is reached by its own id, so the scene key is derived from data (never a
 * hand-maintained registry entry per region), which is what makes the harness
 * per-region rather than pinned to one map. Pure.
 * @param regionId - The region's stable id.
 * @returns The region-scoped scene key.
 */
export function regionScene(regionId: string): string {
  return `region:${regionId}`;
}

/**
 * The deterministic backdrop **texture key** a region boots against. The asset side
 * of the per-region pipeline: the Region scene renders exactly this key, so the run
 * state never claims an asset identity the loader can't resolve.
 *
 * Until per-region art exists (per-region content is authored as each increment is
 * built — living docs, decision 0003), every region resolves to the single shared
 * placeholder texture the Preloader generates programmatically (`"region-backdrop"`,
 * kept in lock-step with `TextureKeys.RegionBackdrop` — a pure string const, so
 * `logic/region` stays free of any Phaser/asset import). When real per-region art
 * lands, the pipeline generates a distinct texture per region and this returns its
 * key — and because the scene renders `state.backdrop`, that flows through with **no
 * scene-code edit** (the "added by authoring data, not code" thesis). Pure.
 * @param _regionId - The region's stable id (unused until per-region art exists).
 * @returns The backdrop texture key the scene preloads + renders.
 */
function regionBackdrop(_regionId: string): string {
  // Mirror of `TextureKeys.RegionBackdrop` (assets.ts). A literal — not an import —
  // so the pure logic layer never depends on the asset/Phaser module graph.
  return "region-backdrop";
}

/**
 * Seed the run's RNG once at boot from the region id + seed, so two regions booted
 * under the same numeric seed still thread distinct streams (the id salts the
 * seed). A total function of its inputs — no ambient reads.
 * @param regionId - The region id, mixed into the seed.
 * @param seed - The 32-bit boot seed.
 * @returns The initial 32-bit RNG state.
 */
function seedFor(regionId: string, seed: number): number {
  const salted = Array.from(regionId).reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    seed >>> 0
  );
  return salted >>> 0;
}

/**
 * Resolve the phase a freshly-booted (or just-advanced) run is in: `complete` once
 * the cursor has walked the whole resolved encounter playlist, else `exploring`. A
 * region whose variant has an empty encounter table boots straight to `complete`.
 * Pure.
 * @param region - The region being run.
 * @param worldState - The live world-state (selects the variant).
 * @param cursor - The next-encounter cursor.
 * @returns The phase for that cursor.
 */
function phaseFor(
  region: RegionDef,
  worldState: WorldState,
  cursor: number
): RegionPhase {
  const playlist = resolveRegionVariant(region, worldState).encounters;
  return cursor >= playlist.length
    ? RegionPhases.complete
    : RegionPhases.exploring;
}

/**
 * Boot a region authored against the template into a playable session under a fixed
 * seed and world-state. Validates the region against the both-states schema first:
 * an incomplete region (missing a variant, a blank name, an empty playlist on a
 * present variant) **throws** — the harness rejects a broken scene rather than
 * booting one (AC scenario 2). On success the session starts at the head of the
 * resolved variant's encounter playlist (or `complete` if the variant has none),
 * keyed to the region-scoped scene + backdrop. Pure: a total function of its inputs.
 * @param region - The region authored against the {@link RegionDef} template.
 * @param seed - The 32-bit boot seed threaded through the run.
 * @param worldState - The world-state to boot in (selects the variant).
 * @returns The freshly-booted region session.
 * @throws Error when the region fails both-states validation.
 */
export function bootRegion(
  region: RegionDef,
  seed: number,
  worldState: WorldState
): RegionRunState {
  if (!isCompleteRegion(region)) {
    const reasons = validateRegion(region).join("; ");
    throw new Error(`cannot boot incomplete region "${region.id}": ${reasons}`);
  }
  return {
    region,
    regionId: region.id,
    scene: regionScene(region.id),
    worldState,
    backdrop: regionBackdrop(region.id),
    cursor: 0,
    cleared: [],
    phase: phaseFor(region, worldState, 0),
    rngState: seedFor(region.id, seed),
  };
}

/**
 * Clear the encounter under the cursor and advance — the harness's forward step. A
 * no-op (returns the same state) once the run is `complete`, so over-running the
 * playlist can never fabricate progress or read past the table. Consumes one RNG
 * draw per cleared encounter (threading the seeded stream, so the run is
 * reproducible), records the cleared encounter id, and recomputes the phase. Pure.
 * @param region - The region being run.
 * @param state - The current session.
 * @returns The advanced session (or the same state when already complete).
 */
function advance(region: RegionDef, state: RegionRunState): RegionRunState {
  const playlist = resolveRegionVariant(region, state.worldState).encounters;
  if (state.cursor >= playlist.length) {
    return state;
  }
  // One RNG advance per cleared encounter threads the seeded mulberry32 stream
  // ({@link rngStep}, the engine-free core) so the run digest depends on the seed —
  // the same seed reproduces the same progression, a different seed diverges it (the
  // determinism thesis). The 32-bit successor state is plain int (serializable,
  // hashable) and never `Math.random` / `Date.now`.
  const stepped = rngStep(state.rngState);
  const nextCursor = state.cursor + 1;
  return {
    ...state,
    cursor: nextCursor,
    cleared: [...state.cleared, playlist[state.cursor]!],
    phase: phaseFor(region, state.worldState, nextCursor),
    rngState: stepped.state,
  };
}

/**
 * Warp the session to its Ashfall variant — the in-memory Reckoning flip. The same
 * booted region reads its `ashfall` encounter table the instant the flag flips,
 * with no re-boot and no progress consumed (cursor + cleared untouched). Idempotent
 * once already in `ashfall`. The flip consumes no RNG. Pure.
 * @param region - The region being run.
 * @param state - The current session.
 * @returns The session resolved against `ashfall`.
 */
function reckonRun(region: RegionDef, state: RegionRunState): RegionRunState {
  if (state.worldState === "ashfall") {
    return state;
  }
  return {
    ...state,
    worldState: "ashfall",
    phase: phaseFor(region, "ashfall", state.cursor),
  };
}

/**
 * The harness reducer — apply one {@link RegionAction} to a booted session. A total
 * function: `advance` clears the next encounter (a no-op past the end), `reckon`
 * warps to the Ashfall variant. The region rides on the session ({@link
 * RegionRunState.region}), so the bridge drives the run with just `(state, action)`.
 * Pure — returns a fresh state, mutates nothing, and threads the seeded RNG so the
 * run stays reproducible.
 * @param state - The current session (carries the region being run).
 * @param action - The action to apply.
 * @returns The next session state.
 */
export function actRegion(
  state: RegionRunState,
  action: RegionAction
): RegionRunState {
  switch (action.kind) {
    case RegionActionKinds.advance:
      return advance(state.region, state);
    case RegionActionKinds.reckon:
      return reckonRun(state.region, state);
    default:
      return state;
  }
}

/**
 * A stable FNV-1a digest of a region session — the scene-agnostic analogue of the
 * battle state-hash. Folds the region id, world-state, scene/backdrop keys, cursor,
 * cleared encounters, phase, and live RNG state into a canonical string, then
 * hashes it. Same region + seed + action sequence ⇒ identical 8-hex digest (the
 * determinism gate, AC scenario 1). Pure: a total function of its input.
 * @param state - The region session to digest.
 * @returns An 8-char hex digest.
 */
export function hashRegionRun(state: RegionRunState): string {
  const canonical = [
    state.regionId,
    state.scene,
    state.worldState,
    state.backdrop,
    String(state.cursor),
    state.cleared.join(","),
    state.phase,
    String(state.rngState >>> 0),
  ].join("|");
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}
