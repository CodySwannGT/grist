/**
 * The battle HUD's status sub-panel (PD-3.8): the three combat-feedback widgets
 * the polished HUD adds over the Phase-2 surface — the target's **Pressure → Break
 * meter**, the enemy **telegraph** warning, and the rolling **battle log**. It is a
 * thin renderer like {@link import("./battle-hud").BattleHud}: it builds its pooled
 * objects once and each frame mirrors the live {@link BattleState} (and the
 * controller's pure projections) onto them with no per-frame allocation beyond the
 * controller's bounded log array. It owns no combat rules — the Pressure ratio, the
 * telegraphed intent, and the log lines all come from the pure `src/logic`
 * projections the controller exposes. Freed via {@link destroy} when the owning HUD
 * tears down.
 * @module ui/battle-status-panel
 */
import Phaser from "phaser";
import { HUD_DEPTH } from "../consts";
import {
  enemyTelegraph,
  pressureMeter,
  type BattleState,
  type Combatant,
  type EnemyTelegraph,
  type PressureMeter,
} from "../logic/combat";
import { HudColors, HudLayout } from "./layout";
import { GuardedText, makeText, nameForRef } from "./hud-text";
import { battleLogLines, BattleLogTuning } from "../logic/battle-log";

/** Renders the Pressure meter, enemy telegraph, and battle log; holds no rules. */
export class BattleStatusPanel {
  readonly #scene: Phaser.Scene;
  readonly #objects: Phaser.GameObjects.GameObject[] = [];
  readonly #pressureFill: Phaser.GameObjects.Rectangle;
  readonly #telegraph: GuardedText;
  readonly #logLines: readonly GuardedText[];

  /**
   * Build the status widgets once: the Pressure meter (track + fill), the
   * telegraph label, and the pooled battle-log line labels.
   * @param scene - The owning battle scene.
   */
  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    this.#buildBar(HudColors.pressureBg, true);
    this.#pressureFill = this.#buildBar(HudColors.pressureFill, false);
    this.#telegraph = this.#label(
      HudLayout.telegraphCenterX,
      HudLayout.telegraphY,
      0.5
    );
    this.#logLines = Array.from({ length: BattleLogTuning.maxLines }, (_u, i) =>
      this.#label(
        HudLayout.logLeftX,
        HudLayout.logTopY + i * HudLayout.logLineH
      )
    );
  }

  /**
   * Register an object: lift it above the combatant views and track it for
   * teardown.
   * @param object - The freshly added game object.
   * @returns The same object, for chaining.
   */
  #track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(
      HUD_DEPTH
    );
    this.#objects.push(object);
    return object;
  }

  /**
   * Create a tracked label at a logical position.
   * @param x - Logical x.
   * @param y - Logical y.
   * @param originX - Horizontal origin (default left).
   * @returns The guarded label.
   */
  #label(x: number, y: number, originX = 0): GuardedText {
    const guarded = makeText(this.#scene, x, y, originX, 0);
    this.#track(guarded.object);
    return guarded;
  }

  /**
   * Build a Pressure-meter rectangle (track or fill) at the shared meter geometry.
   * @param color - The bar fill color.
   * @param visible - Whether the bar starts visible.
   * @returns The pooled, left-origin rectangle.
   */
  #buildBar(color: number, visible: boolean): Phaser.GameObjects.Rectangle {
    return this.#track(
      this.#scene.add
        .rectangle(
          HudLayout.pressureBarLeftX,
          HudLayout.pressureBarY,
          HudLayout.pressureBarW,
          HudLayout.pressureBarH,
          color
        )
        .setOrigin(0, 0.5)
        .setVisible(visible)
    );
  }

  /**
   * Repaint the status panel from the live state and the pure `src/logic`
   * projections. Allocation-free except the bounded battle-log array.
   * @param state - The live battle state.
   * @param target - The resolved (living) target enemy index.
   * @returns void
   */
  render(state: BattleState, target: number): void {
    this.#renderPressure(state.enemies[target]);
    this.#renderTelegraph(state);
    this.#renderLog(state);
  }

  /**
   * Fill the target Pressure meter from the pure {@link pressureMeter} projection
   * (hidden when there is no living target). Allocation-free — only scale, tint,
   * and visibility change; the Break threshold lives in the logic layer, never
   * re-derived here.
   * @param enemy - The live target combatant, or undefined when none.
   * @returns void
   */
  #renderPressure(enemy: Combatant | undefined): void {
    if (!enemy || enemy.hp <= 0) {
      this.#pressureFill.setVisible(false);
      return;
    }
    const meter: PressureMeter = pressureMeter(enemy);
    this.#pressureFill.scaleX = meter.broken ? 1 : meter.fill;
    this.#pressureFill.fillColor = meter.broken
      ? HudColors.breakFill
      : HudColors.pressureFill;
    this.#pressureFill.setVisible(true);
  }

  /**
   * Render the enemy-intent telegraph (PD-3.8 "telegraphs"): a warning naming the
   * enemy about to act, from the pure {@link enemyTelegraph} projection. Cleared
   * when no enemy is charged enough to warn (no living enemy → hidden).
   * @param state - The battle state (source of the warned enemy's display name).
   * @returns void
   */
  #renderTelegraph(state: BattleState): void {
    const telegraph: EnemyTelegraph | null = enemyTelegraph(state);
    if (telegraph === null) {
      this.#telegraph.set("", HudColors.telegraph);
      return;
    }
    const enemy = state.enemies[telegraph.index];
    const name = enemy ? nameForRef(enemy.ref) : "Enemy";
    this.#telegraph.set(`! ${name} winds up`, HudColors.telegraph);
  }

  /**
   * Render the recent battle-log lines (oldest at top), clearing any unused rows
   * so a shrinking log never leaves a stale line on screen. The one bounded array
   * comes from the pure {@link battleLogLines} projection.
   * @param state - The battle state.
   * @returns void
   */
  #renderLog(state: BattleState): void {
    const lines = battleLogLines(state);
    this.#logLines.forEach((row, index) => {
      row.set(lines[index] ?? "", HudColors.log);
    });
  }

  /**
   * Destroy every status object (removing any listeners with it).
   * @returns void
   */
  destroy(): void {
    this.#objects.forEach(object => object.destroy());
    this.#objects.length = 0;
  }
}
