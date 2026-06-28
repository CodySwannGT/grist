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
} from "../consts";
import {
  ENCOUNTERS,
  EncounterIds,
  PARTY,
  type EncounterDef,
  type PartyMemberDef,
} from "../content";
import { BattleRunner } from "../game/battle-runner";
import {
  AtbTuning,
  BattleSides,
  type BattleSide,
  type Combatant,
} from "../logic/combat";
import { eventsCenter } from "../services/events";
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
/** The encounter this slice scene renders (two enemies — teaches Rendering/Break). */
const ENCOUNTER: EncounterDef = ENCOUNTERS[EncounterIds.theDrip];

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
  #partyViews: readonly UnitView[] = [];
  #enemyViews: readonly UnitView[] = [];

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Battle);
  }

  /**
   * Build the runner, backdrop, and pooled combatant views, then expose the scene
   * to the verification bridge.
   * @returns void
   */
  create(): void {
    const seed = verifyBridge.takeSeed() ?? DEFAULT_SEED;
    this.#runner = new BattleRunner(PARTY_LINEUP, ENCOUNTER, seed);

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

    verifyBridge.attach(SceneKeys.Battle, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
    this.#render();
  }

  /**
   * Per-frame: advance the ATB and mirror state onto the pooled sprites. No
   * allocations, tweens, or timers are created here.
   * @param _time - Absolute time (unused; the sim is delta-driven).
   * @param delta - Milliseconds since the last frame.
   * @returns void
   */
  override update(_time: number, delta: number): void {
    this.#runner.advance(delta);
    this.#render();
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
    const { x, y } = this.#unitCenter(side, index);
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
   * The on-screen center of a combatant: its side's anchor column, stepped up and
   * staggered toward screen-center for the back rows (a depth cue).
   * @param side - The combatant's side.
   * @param index - The combatant's index within its side.
   * @returns The unit's logical center.
   */
  #unitCenter(side: BattleSide, index: number): { x: number; y: number } {
    const toEnemies = side === BattleSides.enemies;
    const anchorX = toEnemies
      ? BattleLayout.enemyAnchorX
      : BattleLayout.partyAnchorX;
    const dir = toEnemies ? 1 : -1;
    return {
      x: anchorX + dir * index * BattleLayout.rowStaggerX,
      y:
        BattleLayout.groundY -
        BattleLayout.unitHeight / 2 -
        index * BattleLayout.rowGap,
    };
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
   * The live link handed to the verification bridge: read state, the *applied*
   * integer scale (native resolution + the post-scale display factor, so it stays
   * correct across resizes), restart under a seed, and emit an action onto the bus
   * (the scene is the action sender).
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
      restart: (seed: number) => this.#runner.restart(seed),
      act: action => eventsCenter.emit(BattleEvents.ActionRequested, action),
    };
  }

  /**
   * Free the runner's bus subscription on scene shutdown.
   * @returns void
   */
  #shutdown(): void {
    this.#runner.dispose();
  }
}
