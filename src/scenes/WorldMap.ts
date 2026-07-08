/**
 * World Map scene (#241) — the player-facing **travel front door** that makes the
 * authored regions, the Reckoning, and Act II reachable in normal play. A full-screen
 * list surface following the Menu/Bench chrome pattern (a real `scene.start`, not an
 * overlay): it projects the pure world-map surface (`logic/world-map`) from the
 * persisted region-progress + world-state, renders the graded region roster + the Act
 * nodes, and travels the player into a region — which the Region scene then plays
 * through real battles. It owns no rules: the projection, unlock gating, and travel
 * pricing are pure `logic/world-map`; this scene is a thin adapter that renders them,
 * dispatches a semantic intent (`logic/world-map-nav`) to an action, and persists.
 *
 * Every surface here has a keyboard AND pointer path to every action and an obvious
 * exit (#239): arrows/WASD move, Enter/Space travels, Esc/Q backs to the caller;
 * tapping a row selects it and tapping the hint backs. A first-open hint fires once per
 * save (uat-gated, the #228 pattern). The scene registers a {@link WorldMapSurfaceView}
 * so the e2e reads exactly what the player sees.
 * @module scenes/WorldMap
 */
import Phaser from "phaser";
import { SceneKeys } from "../consts";
import {
  type FinaleLaunchData,
  type ReckoningLaunchData,
  type RegionLaunchData,
  type ReunionLaunchData,
  type WorldMapLaunchData,
} from "../world-map-consts";
import { type RegionId } from "../content";
import { spendGrist } from "../logic/grist";
import {
  planRegionTravel,
  projectWorldMapSurface,
  regionProgressFromFlags,
  RegionStatuses,
  TravelPlanKinds,
  type RegionProgress,
  type WorldMapSurface,
} from "../logic/world-map";
import {
  buildWorldMapEntries,
  worldMapEntryDetail,
  worldMapEntryLabel,
  type WorldMapEntry,
} from "../logic/world-map-entries";
import {
  keyToWorldMapIntent,
  moveWorldMapCursor,
  type WorldMapIntent,
} from "../logic/world-map-nav";
import { worldMapEntryAction } from "../logic/world-map-select";
import {
  hasSeenWorldMapOnboarding,
  markWorldMapOnboardingSeen,
  WORLD_MAP_ONBOARDING_HINT,
} from "../logic/world-map-onboarding";
import { PanelTint } from "../ui/chrome";
import { WorldMapPanel, type WorldMapRowView } from "../ui/world-map-panel";
import { isVerificationEnabled, verifyBridge } from "../uat/bridge";
import { saveService } from "../services/save-service";
import { saveAutosave } from "../services/save-autosave";
import {
  getCurrentRegion,
  getRunState,
  persistRunEconomy,
  setCurrentRegion,
  setRunState,
} from "../services/run-store";

/** Row tints by region status (the {@link PanelTint} state cues). */
const STATUS_TINT: Readonly<Record<string, number>> = {
  [RegionStatuses.locked]: PanelTint.disabled,
  [RegionStatuses.available]: PanelTint.frame,
  [RegionStatuses.inProgress]: PanelTint.active,
  [RegionStatuses.complete]: PanelTint.equipped,
};

/**
 * Whether the first-open hint may show: a real player always sees it; under `?uat=1`
 * it is opt-in via `?hints=1` (the #228 gate, so bridge-driven specs stay quiet).
 * @returns True when the hint may show.
 */
function onboardingAllowed(): boolean {
  if (!isVerificationEnabled()) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).has("hints");
}

/** The player-facing travel front door: a navigable, status-graded region roster. */
export class WorldMap extends Phaser.Scene {
  #panel!: WorldMapPanel;
  #returnTo: string | null = null;
  #surface: WorldMapSurface | null = null;
  #progress: RegionProgress = {};
  #entries: readonly WorldMapEntry[] = [];
  #cursor = 0;
  #grist = 0;
  #onboarding = false;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.WorldMap);
  }

  /**
   * Read the caller-return payload, build the panel + input, attach the bridge, then
   * load the save and project the surface (async — the bridge read is null until then).
   * @param data - The launch payload (the scene to return to), or undefined standalone.
   * @returns void
   */
  create(data?: WorldMapLaunchData): void {
    this.#returnTo = data?.returnTo ?? null;
    this.#cursor = 0;
    this.#panel = new WorldMapPanel(this, {
      onSelectRow: index => this.#selectRow(index),
      onBack: () => this.#back(),
    });
    this.input.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKey
    );
    // Report the active scene to the bridge; the travel surface itself is read
    // statelessly from the persisted save via `__VERIFY__.worldMapSurface()` (the
    // data-cell seam), so no scene view is registered here.
    verifyBridge.attach(SceneKeys.WorldMap, null);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
    void this.#loadAndRender();
  }

  /**
   * Load the persisted world-state + region progress, seed the grist readout from the
   * live run, project the surface, and render. Mounts the first-open hint once per save.
   * @returns A promise that resolves once the surface is projected and rendered.
   */
  async #loadAndRender(): Promise<void> {
    const save = await saveService.load();
    this.#progress = regionProgressFromFlags(save.scene?.flags ?? {});
    this.#grist = getRunState(this.registry).wallet.grist;
    if (onboardingAllowed() && !hasSeenWorldMapOnboarding(save)) {
      this.#onboarding = true;
      // Route the seen-flag write through the shared save queue (#245) so it can never
      // land between an economy write's load and save and clobber the credited grist.
      await saveAutosave.mutate(markWorldMapOnboardingSeen);
    }
    this.#project(save.worldState);
  }

  /**
   * Re-project the surface for a world-state and re-render. Rebuilds the entry list and
   * clamps the cursor.
   * @param worldState - The world-state to project through.
   * @returns void
   */
  #project(worldState: WorldMapSurface["worldState"]): void {
    this.#surface = projectWorldMapSurface({
      worldState,
      progress: this.#progress,
      currentRegion: getCurrentRegion(this.registry),
    });
    this.#entries = buildWorldMapEntries(this.#surface);
    this.#cursor = Math.min(
      this.#cursor,
      Math.max(0, this.#entries.length - 1)
    );
    this.#render();
  }

  /**
   * Compute the row view for one entry (its label + status tint + label color).
   * @param entry - The entry to present.
   * @returns The row view.
   */
  #rowView(entry: WorldMapEntry): WorldMapRowView {
    const label = worldMapEntryLabel(entry);
    if (entry.kind === "region") {
      return {
        label,
        tint: STATUS_TINT[entry.node.status] ?? PanelTint.frame,
        labelColor:
          entry.node.status === RegionStatuses.locked ? "#5a606c" : "#e8e8ea",
      };
    }
    const sealed =
      (entry.kind === "reckoning" && !entry.hook.available) ||
      (entry.kind === "finale" && !entry.finale.available);
    return {
      label,
      tint: sealed ? PanelTint.disabled : PanelTint.active,
      labelColor: sealed ? "#5a606c" : "#e8e8ea",
    };
  }

  /**
   * Render the roster + readouts + detail. The first-open hint (once per save) replaces
   * the detail line until the player's first input.
   * @returns void
   */
  #render(): void {
    if (this.#surface === null) {
      return;
    }
    const rows = this.#entries.map(entry => this.#rowView(entry));
    const focused = this.#entries[this.#cursor];
    const detail = this.#onboarding
      ? WORLD_MAP_ONBOARDING_HINT
      : focused
        ? worldMapEntryDetail(focused)
        : "";
    this.#panel.render(
      rows,
      this.#cursor,
      this.#grist,
      this.#surface.worldState,
      detail
    );
  }

  /**
   * The stable keyboard handler (bound once so it can be removed on shutdown): maps a
   * raw key to a semantic intent and applies it.
   * @param event - The raw keyboard event.
   * @returns void
   */
  readonly #onKey = (event: KeyboardEvent): void => {
    const intent = keyToWorldMapIntent(event.code);
    if (intent !== null) {
      this.#handleIntent(intent);
    }
  };

  /**
   * Apply a semantic intent: move the cursor, select the focused entry, or back out.
   * The first input dismisses the first-open hint.
   * @param intent - The semantic intent.
   * @returns void
   */
  #handleIntent(intent: WorldMapIntent): void {
    if (this.#onboarding) {
      this.#onboarding = false;
    }
    if (intent === "back") {
      this.#back();
      return;
    }
    if (intent === "select") {
      this.#selectRow(this.#cursor);
      return;
    }
    const delta = intent === "up" ? -1 : 1;
    this.#cursor = moveWorldMapCursor(
      this.#cursor,
      delta,
      this.#entries.length
    );
    this.#render();
  }

  /**
   * Focus + select the entry at an index (the pointer path and the keyboard `select`
   * both route here): travel to a region, enter a reunion's own recruit surface (#273),
   * trigger the Reckoning, or enter/surface the finale — dispatched off the pure
   * {@link worldMapEntryAction} projection so the "what does this row do" mapping is
   * unit-tested headless and a reunion can never fall through to a region travel.
   * @param index - The entry index to select.
   * @returns void
   */
  #selectRow(index: number): void {
    this.#onboarding = false;
    this.#cursor = index;
    const entry = this.#entries[index];
    if (entry === undefined) {
      return;
    }
    const action = worldMapEntryAction(entry);
    switch (action.kind) {
      case "region":
        this.#travelToRegion(action.regionId as RegionId, action.status);
        return;
      case "reunion":
        this.#enterReunion(action.reunionId);
        return;
      case "reckoning":
        this.#triggerReckoning(action.available);
        return;
      case "finale":
        this.#enterFinale(action.available);
        return;
    }
  }

  /**
   * Enter a reunion ("story") node's OWN self-contained recruit surface (#273): start the
   * {@link SceneKeys.Reunion} scene for the selected reunion, which plays its authored beat
   * and records the recruit — instead of the previous travel to the reunion's already-cleared
   * anchor region, which dumped the player on that region's stale `region-cleared` summary
   * and never wrote the `reunion:<id>` completion flag the finale's standing reads. The World
   * Map is carried as the return target so the reunion lands the run back here on completion.
   * @param reunionId - The reunion to enter.
   * @returns void
   */
  #enterReunion(reunionId: string): void {
    const launch: ReunionLaunchData = {
      reunionId,
      returnTo: SceneKeys.WorldMap,
    };
    this.scene.start(SceneKeys.Reunion, launch);
  }

  /**
   * Enter the finale at Aurel's heart (#244): when it is available (the world has turned
   * to ashfall) start the {@link SceneKeys.Finale} scene, which resolves the run's
   * reachable ending-choice and plays the confrontation through to the Title. When it is
   * still sealed the node explains itself with a stated prerequisite rather than the
   * previous silent no-op — the affordance matches its true state either way.
   * @param available - Whether the finale is reachable (the world has turned).
   * @returns void
   */
  #enterFinale(available: boolean): void {
    if (this.#surface === null) {
      return;
    }
    if (!available) {
      this.#panel.render(
        this.#entries.map(entry => this.#rowView(entry)),
        this.#cursor,
        this.#grist,
        this.#surface.worldState,
        "Aurel's heart is sealed — turn the world through the Reckoning first."
      );
      return;
    }
    const launch: FinaleLaunchData = { returnTo: SceneKeys.WorldMap };
    this.scene.start(SceneKeys.Finale, launch);
  }

  /**
   * Travel into a region: a locked region is refused (its cue is shown); otherwise the
   * grist fast-travel cost is charged when a re-visit is affordable (a first journey is
   * free), the current location is recorded, and the Region scene is started in player
   * mode at the saved cursor. An unaffordable re-visit is refused with a readable note
   * (never the critical path — first journeys are always free).
   * @param regionId - The region to travel to.
   * @param status - The region's status (locked refuses travel).
   * @returns void
   */
  #travelToRegion(regionId: RegionId, status: string): void {
    if (this.#surface === null || status === RegionStatuses.locked) {
      this.#render();
      return;
    }
    const plan = planRegionTravel(
      regionId,
      getCurrentRegion(this.registry),
      this.#progress,
      this.#grist
    );
    if (plan.kind === TravelPlanKinds.fastTravel && !plan.affordable) {
      this.#panel.render(
        this.#entries.map(entry => this.#rowView(entry)),
        this.#cursor,
        this.#grist,
        this.#surface.worldState,
        `Need ${plan.cost} grist to fast-travel there (have ${this.#grist}).`
      );
      return;
    }
    if (plan.cost > 0) {
      const run = getRunState(this.registry);
      const spent = spendGrist(run.wallet, plan.cost);
      setRunState(this.registry, { ...run, wallet: spent.wallet });
      void persistRunEconomy({ ...run, wallet: spent.wallet });
    }
    setCurrentRegion(this.registry, regionId);
    const launch: RegionLaunchData = {
      regionId,
      worldState: this.#surface.worldState,
      cleared: this.#progress[regionId]?.cleared ?? 0,
      returnTo: SceneKeys.WorldMap,
    };
    this.scene.start(SceneKeys.Region, launch);
  }

  /**
   * Trigger the Reckoning from the surfaced hook: play the authored world-turn set-piece
   * (#251, playing #125) instead of silently re-skinning the map. Starts the {@link
   * SceneKeys.Reckoning} scene, which mounts the reckoning dialogue script, commits the
   * world-state flip **once** at its authored world-turns beat, and lands the run back on
   * this map — now transformed to Ashfall — so the re-skin reads as the consequence of what
   * the player just watched (and the hook, projected to null once turned, can never replay).
   * The World Map's own back target is carried forward so the restored Ashfall map keeps it.
   * A no-op with a note when the hook is not yet reachable.
   * @param available - Whether the hook is reachable (upper Vanta finished).
   * @returns void
   */
  #triggerReckoning(available: boolean): void {
    if (!available) {
      this.#render();
      return;
    }
    const launch: ReckoningLaunchData =
      this.#returnTo === null ? {} : { returnTo: this.#returnTo };
    this.scene.start(SceneKeys.Reckoning, launch);
  }

  /**
   * Back out to the caller scene (#233): resume the caller when opened over one,
   * otherwise stay (the standalone `?scene=worldmap` seam).
   * @returns void
   */
  #back(): void {
    if (this.#returnTo !== null) {
      this.scene.start(this.#returnTo);
    }
  }

  /**
   * Free the keyboard + panel tap listeners and detach the bridge (the
   * `require-shutdown-cleanup` contract).
   * @returns void
   */
  #shutdown(): void {
    this.input.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKey
    );
    this.#panel.destroy();
    verifyBridge.attach("", null);
  }
}
