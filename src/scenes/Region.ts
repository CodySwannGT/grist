/**
 * Region scene (#137) — the thin side-view adapter between the pure per-region boot
 * harness (`src/logic/region`) and Phaser. It owns NO region rules: the harness
 * ({@link bootRegion} / {@link actRegion} / {@link hashRegionRun}) holds boot
 * validation, the encounter-playlist progression, the Reckoning warp, and the
 * determinism digest; this scene RENDERS that booted session as the 384×216
 * side-view (decision 0006) and EMITS harness actions through the verification
 * bridge. It registers a {@link RegionView} with the bridge via
 * `verifyBridge.attach(SceneKeys.Region, view)`, the region counterpart of the Field
 * scene's `#bridgeView()`.
 *
 * Boot-throw handling (AC scenario 2): a region authored against an invalid/
 * incomplete {@link RegionDef} makes {@link bootRegion} throw. That throw is CAUGHT
 * in `create()` and surfaced as an observable harness-failure state — a
 * bridge-readable error flag plus a controlled on-canvas failure marker — never an
 * unhandled exception. So the e2e proves both halves: a good region boots with
 * `errors == []`, and a deliberately-broken region is caught and fails the harness.
 *
 * Determinism: the booted session threads the seeded `Rng` (the harness owns it,
 * never `Math.random` / `Date.now`); the same seed + same actions reproduce an
 * identical {@link hashRegionRun} digest, which the bridge exposes through
 * `__VERIFY__.hash()` for the e2e's reload-replay gate (AC scenario 1).
 * @module scenes/Region
 */
import Phaser from "phaser";
import { ImageKeys } from "../assets";
import {
  GameView,
  RegionColors,
  RegionLayout,
  RegionTextStyles,
  SceneKeys,
} from "../consts";
import { REGIONS, RegionIds, authorRegion, type RegionDef } from "../content";
import { BoundIds } from "../content";
import {
  actRegion,
  bootRegion,
  hashRegionRun,
  type RegionAction,
  type RegionRunState,
} from "../logic/region";
import { type WorldState } from "../logic/world";
import { verifyBridge } from "../uat/bridge";
import { type RegionView } from "../uat/region-scene-view";

/** Fallback seed when none is supplied via the verification bridge / `?seed=`. */
const DEFAULT_SEED = 0x9e3779b1;

/**
 * Parallax layer stacks per backdrop key (far → near). A booted session's
 * `state.backdrop` names its FAR layer (see `regionBackdrop()` in
 * `logic/region`); when that key has an entry here the scene layers the full
 * stack, otherwise it renders the key as a single flat backdrop — so a future
 * per-region art set ships by adding images + one row here, no scene logic.
 */
const REGION_BACKDROP_LAYERS: Readonly<Record<string, readonly string[]>> = {
  [ImageKeys.marrowBgFar]: [
    ImageKeys.marrowBgFar,
    ImageKeys.marrowBgMid,
    ImageKeys.marrowBgNear,
  ],
};

/** Readability scrim over the backdrop (color + alpha) so chrome stays legible. */
const SCRIM_COLOR = 0x0b0e16;
const SCRIM_ALPHA = 0.35;

/**
 * A deliberately-incomplete region (missing its `ashfall` variant) authored for the
 * boot-throw path. Forced past the compiler with a cast — the same shape the
 * Phaser-free unit suite uses — so the e2e can drive
 * `?scene=region&region=broken` and prove a bad region is CAUGHT and fails the
 * harness (AC scenario 2), not rendered.
 * @returns An incomplete region that {@link bootRegion} rejects.
 */
function brokenRegion(): RegionDef {
  return authorRegion({
    id: "broken",
    boundSite: BoundIds.marrowBound,
    states: {
      reach: {
        name: "Broken Reach",
        tone: "verdant",
        keyLocations: [{ id: "void", name: "Void" }],
        encounters: [],
        sideStories: [],
      },
    },
  } as unknown as RegionDef);
}

/** Renders a booted region session as the side-view and emits harness actions. */
export class Region extends Phaser.Scene {
  /** The booted session, or null when boot threw (read {@link Region.#bootError}). */
  #state: RegionRunState | null = null;
  /** The caught boot-throw message, or null when the region booted cleanly. */
  #bootError: string | null = null;
  /** The region being run (held so {@link actRegion} advances the same data). */
  #region!: RegionDef;
  #markers: readonly Phaser.GameObjects.Rectangle[] = [];
  #caption!: Phaser.GameObjects.Text;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Region);
  }

  /**
   * Boot the requested region under the bridge seed and render its side-view. The
   * region authored against the template is resolved from the `?region=` query
   * (default `marrow`); `?region=broken` selects the incomplete region whose boot
   * throws. The {@link bootRegion} call is wrapped in a try/catch so a throwing
   * region becomes an observable harness-failure state (the error flag + a failure
   * marker) rather than an unhandled exception, then the bridge is attached either
   * way so the e2e can read the outcome.
   * @returns void
   */
  create(): void {
    const seed = verifyBridge.takeSeed() ?? DEFAULT_SEED;
    this.#region = requestedRegion();
    this.cameras.main.setBackgroundColor(RegionColors.sky);

    try {
      this.#state = bootRegion(this.#region, seed, requestedWorldState());
      this.#bootError = null;
    } catch (error) {
      // A region that throws on boot (invalid/incomplete RegionDef) is CAUGHT here
      // and surfaced as a harness failure — never an unhandled exception (AC2).
      this.#state = null;
      this.#bootError = error instanceof Error ? error.message : String(error);
    }

    this.#buildBackdrop(this.#state);
    if (this.#state !== null) {
      this.#buildSideView(this.#state);
    } else {
      this.#buildBootFailure();
    }

    verifyBridge.attach(SceneKeys.Region, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
  }

  /**
   * Paint the side-view backdrop: the parallax stack registered for the booted
   * session's OWN `state.backdrop` key (resolved by the harness via
   * `regionBackdrop()`), far layer first, plus a dark scrim so the chrome stays
   * readable over the art — so the scene renders exactly the asset the run state
   * claims, and a future per-region set flows through by data alone. Falls back
   * to the Marrow far layer when boot threw (no session to read).
   * @param state - The booted session, or null when boot threw.
   * @returns void
   */
  #buildBackdrop(state: RegionRunState | null): void {
    const key = state?.backdrop ?? ImageKeys.marrowBgFar;
    const layers = REGION_BACKDROP_LAYERS[key] ?? [key];
    for (const layer of layers) {
      // Bottom-anchored: taller-than-stage art crops at the top edge.
      this.add.image(0, GameView.height, layer).setOrigin(0, 1);
    }
    this.add
      .rectangle(
        0,
        0,
        GameView.width,
        GameView.height,
        SCRIM_COLOR,
        SCRIM_ALPHA
      )
      .setOrigin(0, 0);
  }

  /**
   * Build the side-view chrome for a cleanly-booted region: the region-name banner,
   * the phase/progress caption, and one ground marker per encounter in the resolved
   * variant's playlist (filled in as the harness clears them on render).
   * @param state - The booted session to render.
   * @returns void
   */
  #buildSideView(state: RegionRunState): void {
    this.add
      .text(GameView.width / 2, RegionLayout.titleY, state.regionId, {
        ...RegionTextStyles.title,
      })
      .setOrigin(0.5, 0);
    this.#caption = this.add
      .text(GameView.width / 2, RegionLayout.captionY, "", {
        ...RegionTextStyles.caption,
      })
      .setOrigin(0.5, 0);
    this.#render(state);
  }

  /**
   * Reconcile the ground-marker strip to the CURRENT session's resolved variant —
   * one marker per encounter in `state`'s live playlist. The Reckoning
   * (`actRegion(...reckon)`) can switch `state.worldState` to a variant whose
   * encounter table differs in length, so the strip must be rebuilt from the live
   * state on every render, not derived once at boot — otherwise it shows the wrong
   * total and stale markers. Destroys the old rects and rebuilds (the count is tiny;
   * a fresh strip is simpler and leak-free than a resize). Pure render-state.
   * @param state - The booted session to size the strip against.
   * @returns void
   */
  #syncMarkers(state: RegionRunState): void {
    const count = this.#region.states[state.worldState].encounters.length;
    if (this.#markers.length !== count) {
      this.#markers.forEach(marker => marker.destroy());
      this.#markers = Array.from({ length: count }, (_unused, index) =>
        this.add.rectangle(
          RegionLayout.markerX + index * RegionLayout.markerGap,
          RegionLayout.markerY,
          RegionLayout.markerSize,
          RegionLayout.markerSize,
          RegionColors.markerPending
        )
      );
    }
  }

  /**
   * Build the observable boot-failure marker for a region that threw on boot: a
   * full-width error band plus the caught reason. The harness-failure state the e2e
   * asserts (`booted: false`, a non-null error) — a controlled marker, not a crash.
   * @returns void
   */
  #buildBootFailure(): void {
    this.add
      .rectangle(
        GameView.width / 2,
        GameView.height / 2,
        GameView.width,
        40,
        RegionColors.bootError
      )
      .setAlpha(0.85);
    this.add
      .text(
        GameView.width / 2,
        GameView.height / 2,
        `region boot failed: ${this.#bootError ?? ""}`,
        { ...RegionTextStyles.error, wordWrap: { width: GameView.width - 16 } }
      )
      .setOrigin(0.5);
  }

  /**
   * Render the side-view from the live booted session: fill the cleared encounter
   * markers and update the phase/progress caption. Pure read of `state` — the scene
   * derives nothing it does not read from the harness.
   * @param state - The booted session to render.
   * @returns void
   */
  #render(state: RegionRunState): void {
    // Rebuild the strip to the CURRENT variant first (the Reckoning may have switched
    // to a playlist of a different length), then recolor + caption against it.
    this.#syncMarkers(state);
    this.#markers.forEach((marker, index) =>
      marker.setFillStyle(
        index < state.cursor
          ? RegionColors.markerCleared
          : RegionColors.markerPending
      )
    );
    this.#caption.setText(
      `${state.worldState} · ${state.phase} · ${state.cursor}/${this.#markers.length}`
    );
  }

  /**
   * Apply a harness action to the booted session through the pure {@link actRegion}
   * reducer, then re-render. A no-op before a clean boot (a thrown region has no
   * session to drive). The same path the bridge's `act()` routes a region action
   * to — so the e2e drives exactly the harness reducer.
   * @param action - The harness action (advance / reckon).
   * @returns void
   */
  #act(action: RegionAction): void {
    if (this.#state === null) {
      return;
    }
    this.#state = actRegion(this.#state, action);
    this.#render(this.#state);
  }

  /**
   * The live link handed to the verification bridge (#137): the render scale, the
   * booted session (or null when boot threw), the caught boot-error message, the
   * determinism hash of the booted session, and the harness-action driver. The
   * region counterpart of the Field scene's `#bridgeView()`.
   * @returns The region view.
   */
  #bridgeView(): RegionView {
    return {
      resolution: () => {
        const { gameSize, displaySize } = this.scale;
        return {
          width: gameSize.width,
          height: gameSize.height,
          zoom: displaySize.width / gameSize.width,
        };
      },
      regionState: () => this.#state,
      regionError: () => this.#bootError,
      regionHash: () =>
        this.#state === null ? null : hashRegionRun(this.#state),
      actRegion: (action: RegionAction) => this.#act(action),
    };
  }

  /**
   * Free the bridge link on scene shutdown (the `require-shutdown-cleanup`
   * contract): detach the bridge so `__VERIFY__.scene()` no longer reports Region
   * and the region view can never be read across a scene transition.
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
  }
}

/**
 * Resolve which region to boot from the `?region=` query: the deliberately-broken
 * region when `?region=broken` (the boot-throw path), else the authored region whose
 * id matches the query value, resolved against the {@link REGIONS} registry so EVERY
 * registered region boots through the harness — not just `marrow`. Falls back to the
 * canonical `marrow` when the query is absent or names no registered region (the
 * default), keeping the harness genuinely reusable for later RegionDefs with no
 * code edit. Guarded for non-browser (test) contexts where `window` is absent.
 * @returns The region to boot.
 */
function requestedRegion(): RegionDef {
  if (typeof window === "undefined") {
    return REGIONS[RegionIds.marrow];
  }
  const requested = new URLSearchParams(window.location.search)
    .get("region")
    ?.toLowerCase();
  if (requested === "broken") {
    return brokenRegion();
  }
  const matched = Object.values(REGIONS).find(
    region => region.id.toLowerCase() === requested
  );
  return matched ?? REGIONS[RegionIds.marrow];
}

/**
 * Resolve the world-state to boot in from the `?world=` query: Act II `ashfall`
 * when `?world=ashfall`, else Act I `reach` (the default). Lets the e2e boot a
 * region directly into either variant. Guarded for non-browser (test) contexts.
 * @returns The world-state to boot in.
 */
function requestedWorldState(): WorldState {
  if (typeof window === "undefined") {
    return "reach";
  }
  const requested = new URLSearchParams(window.location.search)
    .get("world")
    ?.toLowerCase();
  return requested === "ashfall" ? "ashfall" : "reach";
}
