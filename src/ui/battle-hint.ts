/**
 * BattleHintView — the thin Phaser painter for the first-battle onboarding beats
 * (#228). It mirrors the #115 {@link import("./cue-caption").CueCaptionView}
 * transient-text pattern: a single pooled label (over a readability pill) that
 * flashes one short hint and auto-hides, so a beat seasons the moment without
 * lingering. It holds NO rules — the pure
 * {@link import("../logic/battle-onboarding") hint machine} decides *which* beat
 * and *when*; the Battle scene calls {@link show} with the copy, and this only
 * paints it. Unlike the cue caption it is command-driven (the scene pushes each
 * beat) rather than bus-driven, and it exposes {@link active} so the verification
 * bridge can prove a beat is on screen. Free it with {@link destroy} on shutdown.
 * @module ui/battle-hint
 */
import Phaser from "phaser";
import { GameView } from "../consts";

/** The hint band Y (logical px) — under the title/cue-caption band, over the fray. */
const HINT_Y = 50;
/** Depth above the HUD and the cue caption (300) so the beat reads on top. */
const HINT_DEPTH = 350;
/** How long a surfaced beat stays legible (ms) — long enough to read a short line. */
const HINT_HOLD_MS = 2600;
/** Fade-out duration (ms) as the beat retires. */
const HINT_FADE_MS = 220;

/** The readability pill behind the text: a dark, mostly-opaque strip. */
const PILL_COLOR = 0x0b0e16;
const PILL_ALPHA = 0.82;
/** Horizontal / vertical padding of the pill around the text (logical px). */
const PILL_PAD_X = 6;
const PILL_HEIGHT = 14;

/** Hint text style — grist-gold on a dark stroke so it reads over any battler. */
const HINT_STYLE = {
  fontFamily: "monospace",
  fontSize: "9px",
  color: "#ffe9b0",
  stroke: "#0b0e16",
  strokeThickness: 3,
} as const;

/** Flashes one first-battle onboarding beat at a time and auto-hides it. */
export class BattleHintView {
  readonly #scene: Phaser.Scene;
  readonly #pill: Phaser.GameObjects.Rectangle;
  readonly #text: Phaser.GameObjects.Text;
  #hideTimer: Phaser.Time.TimerEvent | null = null;
  #fade: Phaser.Tweens.Tween | null = null;
  /** The copy currently on screen, or null when hidden (the bridge read). */
  #active: string | null = null;

  /**
   * Mount the hidden hint band over a battle scene.
   * @param scene - The owning battle scene.
   */
  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    this.#pill = scene.add
      .rectangle(
        GameView.width / 2,
        HINT_Y,
        0,
        PILL_HEIGHT,
        PILL_COLOR,
        PILL_ALPHA
      )
      .setOrigin(0.5)
      .setDepth(HINT_DEPTH)
      .setVisible(false);
    this.#text = scene.add
      .text(GameView.width / 2, HINT_Y, "", HINT_STYLE)
      .setOrigin(0.5)
      .setDepth(HINT_DEPTH + 1)
      .setVisible(false);
  }

  /**
   * Flash one hint beat: size the pill to the copy, reveal both, and (re)arm the
   * auto-hide. A new beat replaces any still on screen so beats never overlap.
   * @param text - The hint copy to surface.
   * @returns void
   */
  show(text: string): void {
    this.#fade?.remove();
    this.#fade = null;
    this.#hideTimer?.remove();
    this.#active = text;
    this.#text.setText(text).setAlpha(1).setVisible(true);
    this.#pill
      .setSize(this.#text.width + PILL_PAD_X * 2, PILL_HEIGHT)
      .setAlpha(PILL_ALPHA)
      .setVisible(true);
    this.#hideTimer = this.#scene.time.delayedCall(HINT_HOLD_MS, () =>
      this.#retire()
    );
  }

  /**
   * The hint copy currently on screen, or null when hidden — the model the
   * verification bridge surfaces so an e2e can prove a beat landed.
   * @returns The active hint text, or null.
   */
  active(): string | null {
    return this.#active;
  }

  /**
   * Fade the current beat out and clear the active read once it is gone.
   * @returns void
   */
  #retire(): void {
    this.#active = null;
    this.#fade = this.#scene.tweens.add({
      targets: [this.#text, this.#pill],
      alpha: 0,
      duration: HINT_FADE_MS,
      onComplete: () => {
        this.#text.setVisible(false);
        this.#pill.setVisible(false);
      },
    });
  }

  /**
   * Stop the timer/tween and destroy the band (the scene-shutdown counterpart of
   * the constructor).
   * @returns void
   */
  destroy(): void {
    this.#hideTimer?.remove();
    this.#hideTimer = null;
    this.#fade?.remove();
    this.#fade = null;
    this.#text.destroy();
    this.#pill.destroy();
  }
}
