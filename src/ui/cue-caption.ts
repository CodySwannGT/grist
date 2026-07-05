/**
 * CueCaptionView — the redundant, non-color/non-audio on-screen cue for the
 * temp-audio moments (#115, FR11 / the redundancy half of AC12). A scene mounts
 * one in `create()`; it subscribes to {@link AudioEvents.Cue} and, whenever the
 * {@link import("../services/sound-service").SoundService} fires a cue, flashes
 * that cue's text + icon caption ({@link CUE_CAPTIONS}) at the top of the screen.
 * Because it is driven by the SAME cue the sound plays, a hearing- or
 * color-impaired player always receives the beat and it can never drift from the
 * audio. Every subscription is freed in {@link CueCaptionView.destroy}
 * (`require-shutdown-cleanup`).
 * @module ui/cue-caption
 */
import Phaser from "phaser";
import { AudioEvents, GameView } from "../consts";
import { CUE_CAPTIONS, type AudioCueId } from "../logic/audio";
import { eventsCenter } from "../services/events";

/** Top-of-screen Y (logical px) the caption banners at. */
const CAPTION_Y = 30;
/** Depth above every scene's chrome (dialogue chrome is 200). */
const CAPTION_DEPTH = 300;
/** How long a fired caption stays visible (ms). */
const CAPTION_HOLD_MS = 1400;
/** Caption text style — light on a dark stroke so it reads over any scene. */
const CAPTION_STYLE = {
  fontFamily: "monospace",
  fontSize: "9px",
  color: "#ffe9b0",
  stroke: "#0b0e16",
  strokeThickness: 3,
} as const;

/** Shows the redundant text/icon caption whenever an audio cue fires. */
export class CueCaptionView {
  readonly #text: Phaser.GameObjects.Text;
  #hideTimer: Phaser.Time.TimerEvent | null = null;

  /**
   * Mount the caption over a scene and start listening for cues.
   * @param scene - The scene to overlay.
   */
  constructor(private readonly scene: Phaser.Scene) {
    this.#text = scene.add
      .text(GameView.width / 2, CAPTION_Y, "", CAPTION_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(CAPTION_DEPTH)
      .setAlpha(0);
    eventsCenter.on(AudioEvents.Cue, this.#onCue);
  }

  /**
   * Flash one cue's caption: set its icon + text, reveal it, and (re)arm the
   * auto-hide. A stable arrow field so it can be unsubscribed on destroy.
   * @param cue - The cue that just fired.
   * @returns void
   */
  readonly #onCue = (cue: AudioCueId): void => {
    const caption = CUE_CAPTIONS[cue];
    this.#text.setText(`${caption.icon} ${caption.text}`).setAlpha(1);
    this.#hideTimer?.remove();
    this.#hideTimer = this.scene.time.delayedCall(CAPTION_HOLD_MS, () =>
      this.#text.setAlpha(0)
    );
  };

  /**
   * Free the bus subscription and timer, and destroy the text (the scene-shutdown
   * counterpart of the constructor).
   * @returns void
   */
  destroy(): void {
    eventsCenter.off(AudioEvents.Cue, this.#onCue);
    this.#hideTimer?.remove();
    this.#hideTimer = null;
    this.#text.destroy();
  }
}
