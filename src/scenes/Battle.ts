/**
 * Battle scene — the thin side-view (FFVI-style) adapter between the pure combat
 * sim (`src/logic/combat`) and Phaser. It owns NO combat rules (decision 0006,
 * T3): every frame it asks the {@link BattleRunner} to advance the ATB and then
 * mirrors the resulting {@link BattleState} onto the pooled battler views built
 * by `ui/battler-stage` — party on the right facing left, enemies on the left
 * facing right, each with HP + ATB bars. Discrete sim events (the append-only
 * battle log) drive the game-feel layer (lunge, attack pose, hit-flash, FX,
 * damage popup, camera shake) — one-shot, event-driven, never per-frame.
 * Player/verification actions are *emitted* on the EventsCenter bus
 * (`ActionRequested`); the runner is the sole code that threads them through
 * the sim. The runner's bus listener is freed on shutdown.
 * @module scenes/Battle
 */
import Phaser from "phaser";
import { ImageKeys } from "../assets";
import {
  BattleColors,
  BattleEvents,
  BattleLayout,
  GameView,
  SceneKeys,
  type BattleLaunchData,
  type FieldResumeData,
} from "../consts";
import {
  ENCOUNTERS,
  EncounterIds,
  PARTY,
  type EncounterDef,
  type EncounterId,
  type PartyMemberDef,
} from "../content";
import { BattleRunner } from "../game/battle-runner";
import {
  ActionKinds,
  BattleSides,
  hashState,
  isResolved,
  type BattleSide,
  type Combatant,
} from "../logic/combat";
import { extractBattleResult } from "../logic/battle-result";
import { AudioCues, spentGrist } from "../logic/audio";
import { eventsCenter } from "../services/events";
import { soundService } from "../services/sound-service";
import { InputService } from "../services/input";
import { CueCaptionView } from "../ui/cue-caption";
import { fadeSceneIn, transitionToScene } from "./scene-transition";
import { StandaloneResolution } from "./standalone-resolution";
import { setLastBattleResult } from "../services/run-store";
import { BattleController } from "../ui/battle-controller";
import { BattleHud } from "../ui/battle-hud";
import {
  buildUnitView,
  playEventJuice,
  syncUnitView,
  type StageViews,
  type UnitView,
} from "../ui/battler-stage";
import { type FxSelection } from "../ui/battle-fx";
import { battlerArtRef } from "../ui/battler-view";
import {
  isVerificationEnabled,
  verifyBridge,
  type BattleView,
} from "../uat/bridge";

/** Fallback seed when none is supplied via the verification bridge / `?seed=`. */
const DEFAULT_SEED = 0x9e3779b1;
/** The slice's battle title (static chrome). */
const TITLE = "MARROW DESCENT";
const TITLE_STYLE = {
  fontFamily: "monospace",
  fontSize: "10px",
  color: BattleColors.title,
} as const;

/** The fielded party, in turn-order-stable lineup order (Wren front). */
const PARTY_LINEUP: readonly PartyMemberDef[] = [PARTY.wren, PARTY.tobi];
/**
 * The default encounter for a *standalone* battle boot (the shipped `?uat=1`
 * default and every existing battle test) — two enemies that teach
 * Rendering/Break. When the Field launches this scene it overrides the encounter
 * via {@link BattleLaunchData} in `init()`; this constant only governs the direct
 * boot so those tests stay unchanged.
 */
const DEFAULT_ENCOUNTER: EncounterDef = ENCOUNTERS[EncounterIds.theDrip];

/** Backdrop readability scrim (color + alpha) between the parallax and units. */
const SCRIM_COLOR = 0x0b0e16;
const SCRIM_ALPHA = 0.45;

/**
 * The encounter named by the `?encounter=<id>` query, or null when absent/unknown
 * or the verification surface is disabled. A verification-only standalone-boot seam
 * (the battle counterpart of the bench's `?grist=`): it lets a UAT boot a specific
 * encounter — e.g. a tanky one to demonstrate a survivable Rendering/Break (#115) —
 * without a field launch. Gated behind {@link isVerificationEnabled} so a production
 * user (no `?uat=1`) can never reach it, and guarded for non-browser (test) contexts.
 * @returns The selected encounter, or null when the seam does not apply.
 */
function urlEncounter(): EncounterDef | null {
  if (!isVerificationEnabled() || typeof window === "undefined") {
    return null;
  }
  const raw = new URLSearchParams(window.location.search).get("encounter");
  if (raw === null) {
    return null;
  }
  return ENCOUNTERS[raw as EncounterId] ?? null;
}

/** Renders a {@link BattleState} and emits {@link BattleAction}s; holds no rules. */
export class Battle extends Phaser.Scene {
  #runner!: BattleRunner;
  #input!: InputService;
  #controller!: BattleController;
  #hud!: BattleHud;
  #partyViews: readonly UnitView[] = [];
  #enemyViews: readonly UnitView[] = [];
  /** The redundant on-screen caption for audio cues (#115, FR11 / AC12). */
  #cueCaption!: CueCaptionView;
  /**
   * The grist pool as of the last frame — the prior value the grist-spend stinger
   * edge-detects a strict decrease against (a Bind or any spend, #115). Reset on
   * every reseed so a fresh battle never mis-fires against a stale pool.
   */
  #lastGrist = 0;
  /** How many battle-log events have already fired their juice. */
  #logCursor = 0;
  /**
   * The last FX the stage played — an element-read action strip or the Break
   * burst — exposed to the verification bridge (`__VERIFY__.fx()`) so an e2e can
   * prove an action read by its element and the Break beat fired. Null until the
   * first FX plays (and reset on every reseed).
   */
  #lastFx: FxSelection | null = null;
  /** The encounter this run resolved (default for a standalone boot, or launched). */
  #encounter: EncounterDef = DEFAULT_ENCOUNTER;
  /**
   * Whether this scene was launched by the Field (vs a standalone boot). Only a
   * field-launched battle consumes its result and returns to the Field — the
   * standalone boot stays on the resolved battle so the existing battle tests are
   * unchanged.
   */
  #fromField = false;
  /** The battle seed a field launch threaded in, or null for a standalone boot. */
  #launchSeed: number | null = null;
  /** Set once the terminal outcome has been consumed, so it fires exactly once. */
  #resolutionHandled = false;
  /**
   * Presents the terminal Victory/Defeat summary and routes to the Title on a
   * *standalone* battle's resolution (#225) — the standalone counterpart of
   * {@link #maybeReturnToField}. Only driven when this is not a field launch.
   */
  #resolution!: StandaloneResolution;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Battle);
  }

  /**
   * Read the optional {@link BattleLaunchData} the Field passes when it launches
   * an encounter: the encounter id to run and the deterministic battle seed. Absent
   * on a standalone boot, where the scene falls back to the default encounter and
   * the bridge/URL seed — keeping every existing battle test unchanged. Resets the
   * per-scene resolution latch so a re-launched scene consumes its result afresh.
   * @param data - The launch payload, or undefined on a standalone boot.
   * @returns void
   */
  init(data?: Partial<BattleLaunchData>): void {
    this.#resolutionHandled = false;
    this.#logCursor = 0;
    const launchedEncounter =
      data?.encounterId !== undefined
        ? (ENCOUNTERS[data.encounterId as EncounterId] ?? null)
        : null;
    this.#fromField = launchedEncounter !== null;
    // A standalone boot honors an optional `?encounter=<id>` verification seam
    // (gated like `?seed=` / the bench `?grist=`), so a UAT can boot a tanky
    // encounter to demonstrate a survivable Rendering/Break (#115); otherwise the
    // shipped default — every existing battle test — is unchanged.
    this.#encounter = launchedEncounter ?? urlEncounter() ?? DEFAULT_ENCOUNTER;
    this.#launchSeed = this.#fromField ? (data?.seed ?? DEFAULT_SEED) : null;
  }

  /**
   * Build the runner, semantic input, HUD controller, backdrop, pooled combatant
   * views, and the HUD, wire enemy taps to target selection, then expose the scene
   * to the verification bridge.
   * @returns void
   */
  create(): void {
    // A field-launched battle runs under the launch seed (the field threaded it);
    // a standalone boot honors the bridge/URL seed exactly as before.
    const seed = this.#launchSeed ?? verifyBridge.takeSeed() ?? DEFAULT_SEED;
    this.#runner = new BattleRunner(PARTY_LINEUP, this.#encounter, seed);
    this.#input = new InputService(this);
    this.#controller = new BattleController(this.#runner);

    const state = this.#runner.state();
    this.#drawBackdrop();
    // A field-launched battle enters behind a readable fade cut (#114 AC2): reveal
    // it from black, the incoming half of the Field→Battle transition. A standalone
    // boot (the default battle e2e) shows instantly — its framing is unchanged.
    if (this.#fromField) {
      fadeSceneIn(this);
    }
    this.add.text(GameView.width / 2, 6, TITLE, TITLE_STYLE).setOrigin(0.5, 0);
    this.#partyViews = this.#buildSide(BattleSides.party, state.party);
    this.#enemyViews = this.#buildSide(BattleSides.enemies, state.enemies);
    this.#wireEnemyTargets();
    this.#hud = new BattleHud(this, this.#input, PARTY_LINEUP);
    this.#cueCaption = new CueCaptionView(this);
    this.#lastGrist = state.grist;
    soundService.attachUnlock(this);
    // The standalone terminal-resolution controller: on a non-field boot it presents
    // the Victory/Defeat summary and routes to the Title on a deliberate advance
    // (#225). A field-launched battle returns to the Field instead and never drives it.
    this.#resolution = new StandaloneResolution(
      this,
      () => this.#runner.state(),
      this.#encounter
    );

    verifyBridge.attach(SceneKeys.Battle, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
    this.#render();
    this.#hud.render(state, this.#controller);
  }

  /**
   * Make each enemy view tappable so a touch/pointer selects it as the target
   * (routed through the semantic InputService — no raw pointer handling leaks out).
   * @returns void
   */
  #wireEnemyTargets(): void {
    this.#enemyViews.forEach((view, index) => {
      view.unit
        .setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.POINTER_DOWN, () =>
          this.#input.tapTarget(index)
        );
    });
  }

  /**
   * Per-frame: advance the ATB, mirror state onto the pooled views and HUD,
   * then fire one-shot juice for any newly logged sim events. Nothing here
   * allocates on the steady-state frame — allocations happen only when a new
   * discrete event (an attack, a hit) enters the log.
   * @param _time - Absolute time (unused; the sim is delta-driven).
   * @param delta - Milliseconds since the last frame.
   * @returns void
   */
  override update(_time: number, delta: number): void {
    this.#runner.advance(delta);
    this.#render();
    this.#consumeLogEvents();
    this.#hud.render(this.#runner.state(), this.#controller);
    this.#fireGristSpendCue();
    this.#maybeReturnToField();
    if (!this.#fromField) {
      this.#resolution.update();
    }
  }

  /**
   * Fire the grist-spend stinger on the frame the battle-local grist pool strictly
   * decreases (a Bind or any spend, #115). Edge-tracked off {@link #lastGrist} so a
   * loot credit — grist rising — never triggers it. Presentation only; the sim is
   * final before this reads it.
   * @returns void
   */
  #fireGristSpendCue(): void {
    const grist = this.#runner.state().grist;
    if (spentGrist(this.#lastGrist, grist)) {
      soundService.playCue(AudioCues.gristSpend);
    }
    this.#lastGrist = grist;
  }

  /**
   * Once a field-launched battle resolves, hand control back to the Field exactly
   * once: extract the win/lose + grist + shard + choice from the terminal state and
   * stash the **raw** {@link import("../logic/battle-result").BattleResult} on the
   * registry, then return to the Field behind a readable fade cut (#114 AC2) rather
   * than snapping — the camera fades out + holds, then the Field starts and fades
   * itself in. The Field's resume path is the *single owner* of folding that result
   * into the run-state (`resumeFieldSession` → {@link applyBattleResult}); this scene
   * deliberately does NOT fold it too, so a win's grist/shard is credited exactly once
   * across the Battle→Field transition. A no-op for a standalone boot (the existing
   * battle tests stay on the resolved battle) and after the first resolution (the
   * `#resolutionHandled` latch).
   * @returns void
   */
  #maybeReturnToField(): void {
    if (!this.#fromField || this.#resolutionHandled) {
      return;
    }
    const state = this.#runner.state();
    if (!isResolved(state)) {
      return;
    }
    this.#resolutionHandled = true;
    const result = extractBattleResult(state, this.#encounter);
    if (result === null) {
      return;
    }
    // Record the raw result only — the Field folds it into the run exactly once.
    setLastBattleResult(this.registry, result);
    const resume: FieldResumeData = { resumed: true };
    transitionToScene(this, SceneKeys.Field, resume);
  }

  /**
   * Paint the side-view backdrop: the Marrow parallax layers (far → near),
   * a dark readability scrim so battlers and bars stay legible over the art,
   * and the ground line the two columns stand on.
   * @returns void
   */
  #drawBackdrop(): void {
    const { width, height } = GameView;
    const { groundY } = BattleLayout;
    for (const layer of [
      ImageKeys.marrowBgFar,
      ImageKeys.marrowBgMid,
      ImageKeys.marrowBgNear,
    ]) {
      // Anchor each layer to the bottom edge; taller-than-stage art crops at the
      // top, wider-than-stage art crops at the right (camera bounds clip it).
      this.add.image(0, height, layer).setOrigin(0, 1);
    }
    this.add
      .rectangle(0, 0, width, height, SCRIM_COLOR, SCRIM_ALPHA)
      .setOrigin(0, 0);
    this.add
      .rectangle(0, groundY, width, 1, BattleColors.groundLine)
      .setOrigin(0, 0);
  }

  /**
   * Build the pooled views for one side, aligned by index to its combatant array.
   * @param side - Which side this column renders.
   * @param combatants - The side's combatants (for their art refs).
   * @returns The side's pooled views.
   */
  #buildSide(
    side: BattleSide,
    combatants: readonly Combatant[]
  ): readonly UnitView[] {
    return combatants.map((combatant, index) =>
      buildUnitView(this, side, index, battlerArtRef(combatant.ref))
    );
  }

  /**
   * Mirror the live sim state onto every pooled view (index-aligned).
   * @returns void
   */
  #render(): void {
    const state = this.#runner.state();
    state.party.forEach((combatant, index) => {
      const view = this.#partyViews[index];
      if (view) {
        this.#recordFx(syncUnitView(this, view, combatant));
      }
    });
    state.enemies.forEach((combatant, index) => {
      const view = this.#enemyViews[index];
      if (view) {
        this.#recordFx(syncUnitView(this, view, combatant));
      }
    });
  }

  /**
   * Record the last FX the stage played (an action strip or the Break burst) for
   * the verification bridge. A null selection (no FX this mirror) leaves the last
   * recorded value untouched — `fx()` reports the most recent FX, not "none".
   * @param selection - The FX selection just played, or null.
   * @returns void
   */
  #recordFx(selection: FxSelection | null): void {
    if (selection) {
      this.#lastFx = selection;
    }
  }

  /**
   * Fire one-shot juice for every sim event logged since the last frame.
   * Purely presentational — the sim state is already final when these fire,
   * and skipping them (reduced motion) changes nothing.
   * @returns void
   */
  #consumeLogEvents(): void {
    const { log } = this.#runner.state();
    const views: StageViews = {
      party: this.#partyViews,
      enemies: this.#enemyViews,
    };
    for (let index = this.#logCursor; index < log.length; index++) {
      const event = log[index];
      if (event && event.kind !== ActionKinds.tick) {
        this.#recordFx(playEventJuice(this, views, event));
      }
    }
    this.#logCursor = log.length;
  }

  /**
   * The live link handed to the verification bridge: read state, the HUD model,
   * the *applied* integer scale (native resolution + the post-scale display
   * factor, so it stays correct across resizes), and the stable state hash;
   * restart under a seed; emit an action onto the bus (the scene is the action
   * sender); and deterministically advance to the next player turn.
   * @returns The battle view.
   */
  #bridgeView(): BattleView {
    return {
      state: () => this.#runner.state(),
      resolution: () => {
        const { gameSize, displaySize } = this.scale;
        return {
          width: gameSize.width,
          height: gameSize.height,
          zoom: displaySize.width / gameSize.width,
        };
      },
      hud: () => this.#controller.model(),
      hash: () => hashState(this.#runner.state()),
      fx: () => this.#lastFx,
      summary: () => this.#resolution.summary(),
      restart: (seed: number) => {
        this.#runner.restart(seed);
        this.#controller.reset();
        this.#logCursor = 0;
        this.#lastFx = null;
        this.#lastGrist = this.#runner.state().grist;
      },
      act: action => eventsCenter.emit(BattleEvents.ActionRequested, action),
      advanceTurn: () => this.#runner.advanceTurn(),
    };
  }

  /**
   * Free every external subscription on scene shutdown: the HUD objects, the
   * controller's input-bus listener, the InputService's keyboard listener, and the
   * runner's action-bus listener (the `require-shutdown-cleanup` contract).
   * @returns void
   */
  #shutdown(): void {
    // Detach the bridge first so __VERIFY__.state()/hud() return null (their
    // documented out-of-battle contract) instead of reading disposed objects.
    verifyBridge.attach("", null);
    this.#resolution.dispose();
    this.#cueCaption.destroy();
    this.#hud.destroy();
    this.#controller.dispose();
    this.#input.dispose();
    this.#runner.dispose();
  }
}
