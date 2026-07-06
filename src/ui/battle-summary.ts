/**
 * The terminal victory/defeat summary overlay (#225) — the thin Phaser painter for
 * the pure {@link BattleSummaryModel}. A *standalone* resolved battle presents this
 * over the frozen fight: a readability scrim, a shipped 9-slice terminal {@link
 * addPanel} frame, the outcome banner (grist-gold on a win, break-red on a loss),
 * a grim-warm flavor line, the cheap outcome stats, and a softly pulsing
 * press-Enter affordance. The panel is a pointer tap target so touch advances too;
 * the keyboard advance is owned by the resolution controller (an InputService
 * `confirm`). It holds NO logic — the model decides the copy — and frees its blink
 * tween + objects on {@link destroy}, called from the controller's teardown.
 * @module ui/battle-summary
 */
import Phaser from "phaser";
import { GameView } from "../consts";
import { addPanel, enablePanelTap } from "./chrome";
import { HudColors } from "./layout";
import { type BattleSummaryModel } from "../logic/battle-summary";

/** Depth above every battler, HUD, and FX object so the summary reads on top. */
const OVERLAY_DEPTH = 1000;
/** Full-screen dimming scrim so the resolved fight recedes behind the summary. */
const SCRIM_COLOR = 0x05070c;
const SCRIM_ALPHA = 0.8;

/** Centered panel geometry in logical (384×216) pixels. */
const PANEL = { width: 240, height: 132 } as const;
/**
 * Vertical layout of the panel's stacked text, in logical pixels from the panel's
 * top — every row sits inside the {@link PANEL} (height 132) with margin.
 */
const ROW = {
  title: 40,
  flavor: 66,
  firstStat: 90,
  statGap: 14,
  prompt: 116,
} as const;

/** Text styles for the summary rows (monospace chrome, matching the UI family). */
const STYLES = {
  title: { fontFamily: "monospace", fontSize: "26px" },
  flavor: { fontFamily: "monospace", fontSize: "10px", color: HudColors.text },
  stat: { fontFamily: "monospace", fontSize: "11px", color: HudColors.grist },
  prompt: { fontFamily: "monospace", fontSize: "9px", color: HudColors.dim },
} as const;

/** Banner color: grist-gold on a win, break-red on a loss. */
const WIN_TITLE_COLOR = HudColors.grist;
const LOSE_TITLE_COLOR = HudColors.breakTag;
/** The press-Enter blink cadence (a gentle alpha yoyo, not a per-frame alloc). */
const BLINK = { alpha: 0.35, durationMs: 650 } as const;

/**
 * Renders the terminal summary overlay for a resolved standalone battle and owns
 * its lifetime. Every object is parked at {@link OVERLAY_DEPTH}; {@link destroy}
 * stops the blink tween and frees them.
 */
export class BattleSummaryView {
  readonly #objects: readonly Phaser.GameObjects.GameObject[];
  readonly #blink: Phaser.Tweens.Tween;

  /**
   * Paint the overlay for `model` and wire the panel as a tap target that calls
   * `onAdvance` (the touch advance; keyboard is the controller's job).
   * @param scene - The owning battle scene.
   * @param model - The pure summary model to render.
   * @param onAdvance - Invoked when the player taps the panel to advance.
   */
  constructor(
    scene: Phaser.Scene,
    model: BattleSummaryModel,
    onAdvance: () => void
  ) {
    const cx = GameView.width / 2;
    const px = cx - PANEL.width / 2;
    const py = GameView.height / 2 - PANEL.height / 2;

    const scrim = scene.add
      .rectangle(
        0,
        0,
        GameView.width,
        GameView.height,
        SCRIM_COLOR,
        SCRIM_ALPHA
      )
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH);
    const panel = addPanel(scene, px, py, PANEL.width, PANEL.height)
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH);
    enablePanelTap(panel, PANEL.width, PANEL.height, onAdvance);

    const title = scene.add
      .text(cx, py + ROW.title, model.title, {
        ...STYLES.title,
        color: model.won ? WIN_TITLE_COLOR : LOSE_TITLE_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH);
    const flavor = scene.add
      .text(cx, py + ROW.flavor, model.flavor, STYLES.flavor)
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH);
    const stats = model.stats.map((line, index) =>
      scene.add
        .text(cx, py + ROW.firstStat + index * ROW.statGap, line, STYLES.stat)
        .setOrigin(0.5)
        .setDepth(OVERLAY_DEPTH)
    );
    const prompt = scene.add
      .text(cx, py + ROW.prompt, model.prompt, STYLES.prompt)
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH);

    this.#objects = [scrim, panel, title, flavor, ...stats, prompt];
    this.#blink = scene.tweens.add({
      targets: prompt,
      alpha: BLINK.alpha,
      duration: BLINK.durationMs,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Stop the blink tween and destroy every overlay object. The overlay's own
   * teardown, called from the resolution controller's dispose.
   * @returns void
   */
  destroy(): void {
    this.#blink.remove();
    this.#objects.forEach(object => object.destroy());
  }
}
