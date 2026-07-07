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
  type FieldResumeData,
} from "../consts";
import {
  type RegionLaunchData,
  type WorldMapLaunchData,
} from "../world-map-consts";
import {
  REGIONS,
  regionDisplayName,
  resolveRegionVariant,
  type RegionDef,
  type RegionId,
} from "../content";
import {
  actRegion,
  bootRegion,
  hashRegionRun,
  RegionPhases,
  type RegionAction,
  type RegionRunState,
} from "../logic/region";
import { keyToWorldMapIntent } from "../logic/world-map-nav";
import { RegionPlayHud } from "../ui/region-play-hud";
import { verifyBridge } from "../uat/bridge";
import { type RegionView } from "../uat/region-scene-view";
import {
  getRunState,
  persistRegionProgress,
  type RegionSession,
} from "../services/run-store";
import {
  bootRegionPlay,
  engageRegionEncounter,
  resumeRegionPlay,
} from "./region-launch";
import { buildRegionBackdrop } from "./region-backdrop";
import { requestedRegion, requestedWorldState } from "./region-harness";

/** Fallback seed when none is supplied via the verification bridge / `?seed=`. */
const DEFAULT_SEED = 0x9e3779b1;

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
  /** The World Map launch payload when entered in player mode (#241), else null. */
  #launch: RegionLaunchData | null = null;
  /** True when re-entered after a region encounter's battle resolved (#241). */
  #resumed = false;
  /** The World Map scene the player-mode region returns to on exit. */
  #returnTo: string = SceneKeys.WorldMap;
  /** The player-mode controls HUD (Engage / Back), or null in harness mode. */
  #playHud: RegionPlayHud | null = null;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Region);
  }

  /**
   * Read the entry mode (#241): a {@link RegionLaunchData} means the player travelled
   * in from the World Map (player mode); a `{ resumed: true }` payload means the scene
   * is re-entered after a region encounter's battle resolved; no payload is the shipped
   * harness mode (`?scene=region`). Reset per-entry so a Phaser-reused instance never
   * carries stale mode state.
   * @param data - The launch / resume payload, or undefined on a harness boot.
   * @returns void
   */
  init(data?: RegionLaunchData | FieldResumeData): void {
    this.#launch = data !== undefined && "regionId" in data ? data : null;
    this.#resumed = data !== undefined && "resumed" in data && data.resumed;
    this.#markers = [];
    this.#playHud = null;
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
    if (this.#launch !== null || this.#resumed) {
      this.#createPlay();
      return;
    }
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
   * Create the player-facing region (#241): resolve the region session (booted fresh
   * from the World Map launch, or restored + advanced after a battle resolved), render
   * the side-view + the Engage/Back controls, and wire the keyboard. Unlike harness
   * mode, encounters are played through REAL battles — Engage launches the Battle scene
   * and a win advances the playlist cursor (`resumeRegionPlay`). Bounces back to the map
   * defensively if there is no session to render.
   * @returns void
   */
  #createPlay(): void {
    this.cameras.main.setBackgroundColor(RegionColors.sky);
    const session = this.#resolvePlaySession();
    if (session === null) {
      this.scene.start(this.#returnTo, {
        returnTo: SceneKeys.Field,
      } as WorldMapLaunchData);
      return;
    }
    this.#state = session.run;
    this.#returnTo = session.returnTo;
    this.#region = REGIONS[session.run.regionId as RegionId];
    this.#bootError = null;
    this.#buildBackdrop(this.#state);
    this.#buildSideView(this.#state);
    this.#playHud = new RegionPlayHud(this, {
      onEngage: () => this.#engage(),
      onBack: () => this.#backToMap(),
    });
    this.#renderPlay();
    this.input.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onPlayKey
    );
    verifyBridge.attach(SceneKeys.Region, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdownPlay());
  }

  /**
   * Resolve the player-mode region session: after a battle it restores the stashed run
   * and advances the cursor ({@link resumeRegionPlay}); on a fresh travel-in it boots
   * the region at the saved cursor ({@link bootRegionPlay}). Null when neither applies.
   * @returns The region session, or null.
   */
  #resolvePlaySession(): RegionSession | null {
    if (this.#resumed) {
      const resumed = resumeRegionPlay(
        this.registry,
        getRunState(this.registry)
      );
      return resumed?.session ?? null;
    }
    if (this.#launch !== null) {
      const seed = verifyBridge.takeSeed() ?? DEFAULT_SEED;
      return bootRegionPlay(this.#launch, seed);
    }
    return null;
  }

  /**
   * Render the player-mode side-view + controls from the live run: the marker strip +
   * caption (shared with harness mode) and the Engage/Back HUD sized to the cursor.
   * @returns void
   */
  #renderPlay(): void {
    if (this.#state === null || this.#playHud === null) {
      return;
    }
    this.#render(this.#state);
    const total = resolveRegionVariant(this.#region, this.#state.worldState)
      .encounters.length;
    this.#playHud.render(
      this.#state.cursor,
      total,
      this.#state.phase === RegionPhases.complete
    );
  }

  /**
   * Engage the encounter under the cursor — launch its real battle. A no-op when the
   * region is already complete (nothing left to fight; the player leaves via Back).
   * @returns void
   */
  #engage(): void {
    if (this.#state === null) {
      return;
    }
    engageRegionEncounter(this, this.registry, {
      run: this.#state,
      returnTo: this.#returnTo,
    });
  }

  /**
   * Leave the region back to the World Map (#239 exit): persist the live cursor best-
   * effort, then start the map (which returns to the Field on its own Back).
   * @returns void
   */
  #backToMap(): void {
    if (this.#state !== null) {
      const total = resolveRegionVariant(this.#region, this.#state.worldState)
        .encounters.length;
      void persistRegionProgress({
        regionId: this.#state.regionId as RegionId,
        cleared: this.#state.cursor,
        total,
      });
    }
    this.scene.start(this.#returnTo, {
      returnTo: SceneKeys.Field,
    } as WorldMapLaunchData);
  }

  /**
   * The stable player-mode key handler: Enter/Space engages the next encounter, Esc/Q
   * backs to the World Map.
   * @param event - The raw keyboard event.
   * @returns void
   */
  readonly #onPlayKey = (event: KeyboardEvent): void => {
    const intent = keyToWorldMapIntent(event.code);
    if (intent === "select") {
      this.#engage();
    } else if (intent === "back") {
      this.#backToMap();
    }
  };

  /**
   * Free the player-mode keyboard + HUD listeners and detach the bridge (the
   * `require-shutdown-cleanup` contract).
   * @returns void
   */
  #shutdownPlay(): void {
    this.input.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onPlayKey
    );
    this.#playHud?.destroy();
    verifyBridge.attach("", null);
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
    buildRegionBackdrop(this, state?.backdrop ?? ImageKeys.marrowBgFar);
  }

  /**
   * Build the side-view chrome for a cleanly-booted region: the region-name banner,
   * the phase/progress caption, and one ground marker per encounter in the resolved
   * variant's playlist (filled in as the harness clears them on render).
   * @param state - The booted session to render.
   * @returns void
   */
  #buildSideView(state: RegionRunState): void {
    const title = this.add
      .text(
        GameView.width / 2,
        RegionLayout.titleY,
        regionDisplayName(this.#region, state.worldState),
        {
          ...RegionTextStyles.title,
        }
      )
      .setOrigin(0.5, 0);
    this.#fitTitle(title);
    this.#caption = this.add
      .text(GameView.width / 2, RegionLayout.captionY, "", {
        ...RegionTextStyles.caption,
      })
      .setOrigin(0.5, 0);
    this.#render(state);
  }

  /**
   * Shrink the region-name banner (#247) by whole-pixel font steps until it fits
   * within {@link RegionLayout.titleMaxWidth} — so the longest authored display name
   * clears the play-mode "‹ Map" back button instead of running under it, while a
   * short name keeps the full 12px chrome. Integer steps (never a fractional scale)
   * keep the pixel type crisp; it stops at {@link RegionLayout.titleMinFontPx}, at
   * which even the longest authored name still fits the cap (proven by the
   * region-display-name unit twin's banner-fit case).
   * @param title - The centered region-name text object to fit.
   * @returns void
   */
  #fitTitle(title: Phaser.GameObjects.Text): void {
    if (title.width <= RegionLayout.titleMaxWidth) {
      return;
    }
    // A string's render width scales linearly with its font size, so the largest
    // whole-pixel size that fits the cap is a single arithmetic step from the base
    // measurement (floored so it never overshoots), clamped to the readable floor.
    const baseFont = Number.parseInt(RegionTextStyles.title.fontSize, 10);
    const scaled = Math.floor(
      (baseFont * RegionLayout.titleMaxWidth) / title.width
    );
    title.setFontSize(Math.max(RegionLayout.titleMinFontPx, scaled));
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
