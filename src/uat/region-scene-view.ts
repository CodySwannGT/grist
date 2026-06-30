/**
 * The region-scene slice of the verification (UAT) bridge (#137). Extracted from
 * `uat/bridge.ts` — the same split the field / bench / world-state / region-data
 * (`region-cell`) cells use — so the bridge stays under its line budget and the
 * region-scene read surface lives next to the scene it serves.
 *
 * This is the **rendered region SCENE** seam, distinct from the #133 region *data*
 * cell (`uat/region-cell.ts`): it holds the contract the booted Region Phaser scene
 * registers, the read-only snapshot the region-scene e2e asserts on, and the pure
 * mapper between them. The scene boots a region through the pure
 * {@link import("../logic/region").bootRegion} harness and drives it with
 * {@link import("../logic/region").actRegion}; this view exposes that booted
 * session (scene key, run phase, cleared encounters, determinism hash) plus a
 * bridge-readable boot-error flag so a region that throws on boot is observed as a
 * harness failure rather than an unhandled exception (AC scenario 2). No Phaser, no
 * gameplay state — a thin test seam.
 * @module uat/region-scene-view
 */
import { type RegionAction, type RegionRunState } from "../logic/region";
import { type VerifyResolution } from "./bridge";

/**
 * A read-only snapshot of the booted region scene for assertions. Carries the
 * scene key, region id + live world-state, the resolved-variant cursor/cleared
 * progression and phase, the determinism hash of the booted session, and the
 * boot-error marker. `booted` is false (and `error` non-null) when the region threw
 * on boot — the harness-failure state the e2e asserts (a bad region fails the
 * harness rather than crashing the page).
 */
export interface VerifyRegionSceneState {
  readonly scene: string;
  readonly regionId: string;
  readonly worldState: string;
  /** The deterministic backdrop asset key the scene booted against. */
  readonly backdrop: string;
  readonly cursor: number;
  readonly cleared: readonly string[];
  readonly phase: string;
  /** True when the region booted cleanly; false when boot threw (harness failure). */
  readonly booted: boolean;
  /** The caught boot-throw message, or null when the region booted cleanly. */
  readonly error: string | null;
  /** A stable digest of the booted session for the determinism gate. */
  readonly hash: string;
}

/**
 * The live link the Region scene registers with the bridge. Lets the region-scene
 * e2e read the resolved integer scale (scene-agnostic — the same shape battle/field
 * use), drive the booted session forward through {@link RegionAction}s (`advance` /
 * `reckon`), capture the determinism hash, and read whether the region booted
 * cleanly or was caught failing the harness. Kept separate from
 * {@link import("./bridge").BattleView} and {@link import("./field-view").FieldView}
 * so none constrains the others; the controller stores whichever is attached and the
 * bridge dispatches by which one is present (the `isRegionView` discriminator).
 */
export interface RegionView {
  readonly resolution: () => VerifyResolution;
  /** The booted session, or null when boot threw (read the error flag instead). */
  readonly regionState: () => RegionRunState | null;
  /** The caught boot-throw message, or null when the region booted cleanly. */
  readonly regionError: () => string | null;
  /** The stable digest of the booted session, or null when boot threw. */
  readonly regionHash: () => string | null;
  /** Drive one harness action into the booted session (advance / reckon). */
  readonly actRegion: (action: RegionAction) => void;
}

/**
 * The empty/failed snapshot for a region that threw on boot — the observable
 * harness-failure state (`booted: false`, the caught message, a stable empty hash).
 * @param scene - The active scene key.
 * @param error - The caught boot-throw message.
 * @returns The harness-failure snapshot.
 */
function failedSnapshot(scene: string, error: string): VerifyRegionSceneState {
  return {
    scene,
    regionId: "",
    worldState: "",
    backdrop: "",
    cursor: 0,
    cleared: [],
    phase: "boot-failed",
    booted: false,
    error,
    hash: "00000000",
  };
}

/**
 * Map an attached {@link RegionView} to its read-only snapshot for the bridge. When
 * the region booted cleanly it folds the live session + its determinism hash; when
 * boot threw it returns the {@link failedSnapshot} so the e2e reads a harness
 * failure (not null, not a crash). The `hashRegionRun` digest rides on the view so
 * the mapper stays Phaser-free and never re-implements the hash.
 * @param scene - The active scene key.
 * @param view - The attached region view.
 * @returns The read-only region-scene snapshot.
 */
function toVerifyRegionSceneState(
  scene: string,
  view: RegionView
): VerifyRegionSceneState {
  const state = view.regionState();
  if (state === null) {
    return failedSnapshot(scene, view.regionError() ?? "region boot failed");
  }
  return {
    scene,
    regionId: state.regionId,
    worldState: state.worldState,
    backdrop: state.backdrop,
    cursor: state.cursor,
    cleared: [...state.cleared],
    phase: state.phase,
    booted: true,
    error: null,
    hash: view.regionHash() ?? "00000000",
  };
}

/**
 * The composed region-scene seam (#137) the bridge controller holds, exactly like
 * {@link import("./bench-view").BenchCell} / {@link import("./dialogue-view")
 * .DialogueCell}: it owns the attached {@link RegionView}, claims it by its
 * structural discriminator, and dispatches the bridge's `regionRun()` / `hash()` /
 * `act()` to it. Kept off the controller (in its own cell) so `uat/bridge.ts` stays
 * under its line budget — a pure test seam, not gameplay state.
 */
export class RegionSceneCell {
  #view: RegionView | null = null;

  /**
   * Whether a gameplay view is a {@link RegionView}. The gameplay views are
   * structurally disjoint — only the region-scene view exposes `regionState()` — so
   * a single discriminating property distinguishes it without a tag field (the
   * Field-dispatch idiom).
   * @param view - The attached gameplay view (any shape exposing string-keyed members).
   * @returns True when the view is a region-scene view.
   */
  static claims(view: object): view is RegionView {
    return "regionState" in view;
  }

  /**
   * Attach (or clear) the region view for the active scene. The controller clears
   * it on every `attach` so a stale link can never be read across a transition.
   * @param view - The region view, or null to clear.
   * @returns void
   */
  attach(view: RegionView | null): void {
    this.#view = view;
  }

  /**
   * The attached region view (for the controller's scene-agnostic resolution read).
   * @returns The attached region view, or null outside the Region scene.
   */
  view(): RegionView | null {
    return this.#view;
  }

  /**
   * The booted Region-scene snapshot (or its caught boot-failure), or null outside
   * the Region scene — the bridge's `regionRun()`.
   * @param scene - The active scene key (folded into the snapshot).
   * @returns The region-scene snapshot, or null.
   */
  snapshot(scene: string): VerifyRegionSceneState | null {
    return this.#view ? toVerifyRegionSceneState(scene, this.#view) : null;
  }

  /**
   * The booted-session determinism hash, or null outside the Region scene — the
   * Region-scene arm of the bridge's `hash()`.
   * @returns The 8-char hex digest, or null.
   */
  hash(): string | null {
    return this.#view?.regionHash() ?? null;
  }

  /**
   * Drive one harness action into the booted session — the Region-scene arm of the
   * bridge's `act()`. A no-op outside the Region scene.
   * @param action - The harness action (advance / reckon).
   * @returns void
   */
  act(action: RegionAction): void {
    this.#view?.actRegion(action);
  }
}
