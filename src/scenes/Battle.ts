/**
 * Battle scene — the thin side-view (FFVI-style) adapter between the pure combat
 * sim (`src/logic/combat`) and Phaser. It owns NO combat rules (decision 0006,
 * T3): every frame it asks the {@link BattleRunner} to advance the ATB and then
 * mirrors the resulting {@link BattleState} onto pooled placeholder sprites — party
 * on the right, enemies on the left, each with HP + ATB bars drawn from programmatic
 * art only. Player/verification actions are *emitted* on the EventsCenter bus
 * (`ActionRequested`); the runner is the sole code that threads them through the
 * sim. Nothing is allocated in `update()` and the runner's bus listener is freed on
 * shutdown.
 * @module scenes/Battle
 */
import Phaser from "phaser";
import { TextureKeys } from "../assets";
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
  AtbTuning,
  BattleSides,
  hashState,
  isResolved,
  type BattleSide,
  type Combatant,
} from "../logic/combat";
import { extractBattleResult } from "../logic/battle-result";
import { eventsCenter } from "../services/events";
import { InputService } from "../services/input";
import { setLastBattleResult } from "../services/run-store";
import { BattleController } from "../ui/battle-controller";
import { BattleHud } from "../ui/battle-hud";
import { unitCenter } from "../ui/layout";
import { verifyBridge, type BattleView } from "../uat/bridge";

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

/** The pooled render objects mirroring one combatant. */
interface UnitView {
  readonly unit: Phaser.GameObjects.Image;
  readonly hpFill: Phaser.GameObjects.Rectangle;
  readonly atbFill: Phaser.GameObjects.Rectangle;
  readonly baseTint: number;
}

/** Renders a {@link BattleState} and emits {@link BattleAction}s; holds no rules. */
export class Battle extends Phaser.Scene {
  #runner!: BattleRunner;
  #input!: InputService;
  #controller!: BattleController;
  #hud!: BattleHud;
  #partyViews: readonly UnitView[] = [];
  #enemyViews: readonly UnitView[] = [];
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
    const launchedEncounter =
      data?.encounterId !== undefined
        ? (ENCOUNTERS[data.encounterId as EncounterId] ?? null)
        : null;
    this.#fromField = launchedEncounter !== null;
    this.#encounter = launchedEncounter ?? DEFAULT_ENCOUNTER;
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
    this.add.text(GameView.width / 2, 6, TITLE, TITLE_STYLE).setOrigin(0.5, 0);
    this.#partyViews = this.#buildSide(
      BattleSides.party,
      state.party.length,
      BattleColors.partyTint
    );
    this.#enemyViews = this.#buildSide(
      BattleSides.enemies,
      state.enemies.length,
      BattleColors.enemyTint
    );
    this.#wireEnemyTargets();
    this.#hud = new BattleHud(this, this.#input, PARTY_LINEUP);

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
   * Per-frame: advance the ATB and mirror state onto the pooled sprites and HUD.
   * No allocations, tweens, or timers are created here.
   * @param _time - Absolute time (unused; the sim is delta-driven).
   * @param delta - Milliseconds since the last frame.
   * @returns void
   */
  override update(_time: number, delta: number): void {
    this.#runner.advance(delta);
    this.#render();
    this.#hud.render(this.#runner.state(), this.#controller);
    this.#maybeReturnToField();
  }

  /**
   * Once a field-launched battle resolves, hand control back to the Field exactly
   * once: extract the win/lose + grist + shard + choice from the terminal state and
   * stash the **raw** {@link import("../logic/battle-result").BattleResult} on the
   * registry, then start the Field. The Field's resume path is the *single owner*
   * of folding that result into the run-state (`resumeFieldSession` →
   * {@link applyBattleResult}); this scene deliberately does NOT fold it too, so a
   * win's grist/shard is credited exactly once across the Battle→Field transition.
   * A no-op for a standalone boot (the existing battle tests stay on the resolved
   * battle) and after the first resolution (the `#resolutionHandled` latch).
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
    this.scene.start(SceneKeys.Field, resume);
  }

  /**
   * Paint the two-tone side-view backdrop and ground line.
   * @returns void
   */
  #drawBackdrop(): void {
    const { width, height } = GameView;
    const { groundY } = BattleLayout;
    this.add
      .rectangle(0, 0, width, groundY, BattleColors.backdropSky)
      .setOrigin(0, 0);
    this.add
      .rectangle(
        0,
        groundY,
        width,
        height - groundY,
        BattleColors.backdropGround
      )
      .setOrigin(0, 0);
    this.add
      .rectangle(0, groundY, width, 1, BattleColors.groundLine)
      .setOrigin(0, 0);
  }

  /**
   * Build the pooled views for one side, aligned by index to its combatant array.
   * @param side - Which side this column renders.
   * @param count - The number of combatants on the side.
   * @param tint - The placeholder tint for the side.
   * @returns The side's pooled views.
   */
  #buildSide(
    side: BattleSide,
    count: number,
    tint: number
  ): readonly UnitView[] {
    return Array.from({ length: count }, (_unused, index) =>
      this.#buildUnit(side, index, tint)
    );
  }

  /**
   * Create the pooled objects for one combatant: a tinted placeholder body and a
   * floating HP + ATB bar pair (programmatic art only — no name tag; the labelled
   * HUD lands in the follow-up HUD sub-task).
   * @param side - The combatant's side.
   * @param index - The combatant's index within its side.
   * @param tint - The side's placeholder tint.
   * @returns The pooled view for the combatant.
   */
  #buildUnit(side: BattleSide, index: number, tint: number): UnitView {
    const { x, y } = unitCenter(side, index);
    const unit = this.add
      .image(x, y, TextureKeys.Unit)
      .setTint(tint)
      .setFlipX(side === BattleSides.party);
    const hpBarY =
      y -
      BattleLayout.unitHeight / 2 -
      BattleLayout.barGap -
      BattleLayout.hpBarHeight / 2;
    const atbBarY =
      hpBarY -
      BattleLayout.hpBarHeight / 2 -
      BattleLayout.barGap -
      BattleLayout.atbBarHeight / 2;
    const left = x - BattleLayout.barWidth / 2;
    this.add.rectangle(
      x,
      hpBarY,
      BattleLayout.barWidth,
      BattleLayout.hpBarHeight,
      BattleColors.hpBarBg
    );
    const hpFill = this.add
      .rectangle(
        left,
        hpBarY,
        BattleLayout.barWidth,
        BattleLayout.hpBarHeight,
        BattleColors.hpBarFill
      )
      .setOrigin(0, 0.5);
    this.add.rectangle(
      x,
      atbBarY,
      BattleLayout.barWidth,
      BattleLayout.atbBarHeight,
      BattleColors.atbBarBg
    );
    const atbFill = this.add
      .rectangle(
        left,
        atbBarY,
        BattleLayout.barWidth,
        BattleLayout.atbBarHeight,
        BattleColors.atbBarFill
      )
      .setOrigin(0, 0.5);
    return { unit, hpFill, atbFill, baseTint: tint };
  }

  /**
   * Mirror the live sim state onto every pooled view.
   * @returns void
   */
  #render(): void {
    const state = this.#runner.state();
    this.#renderSide(this.#partyViews, state.party);
    this.#renderSide(this.#enemyViews, state.enemies);
  }

  /**
   * Mirror one side's combatants onto its pooled views (index-aligned).
   * @param views - The side's pooled views.
   * @param combatants - The side's live combatants.
   * @returns void
   */
  #renderSide(
    views: readonly UnitView[],
    combatants: readonly Combatant[]
  ): void {
    for (const [index, combatant] of combatants.entries()) {
      const view = views[index];
      if (view) {
        this.#renderUnit(view, combatant);
      }
    }
  }

  /**
   * Mirror one combatant onto its view: HP/ATB bar fill and a downed dim/tint.
   * Allocation-free — only transform/tint scalars change.
   * @param view - The combatant's pooled view.
   * @param combatant - The live combatant.
   * @returns void
   */
  #renderUnit(view: UnitView, combatant: Combatant): void {
    const alive = combatant.hp > 0;
    view.hpFill.scaleX = Phaser.Math.Clamp(
      combatant.hp / combatant.stats.hp,
      0,
      1
    );
    view.atbFill.scaleX = Phaser.Math.Clamp(
      combatant.atb / AtbTuning.ready,
      0,
      1
    );
    view.unit.setTint(alive ? view.baseTint : BattleColors.downedTint);
    view.unit.setAlpha(alive ? 1 : 0.4);
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
      restart: (seed: number) => {
        this.#runner.restart(seed);
        this.#controller.reset();
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
    this.#hud.destroy();
    this.#controller.dispose();
    this.#input.dispose();
    this.#runner.dispose();
  }
}
