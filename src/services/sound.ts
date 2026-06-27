/**
 * SoundService — minimal SFX via the Web Audio API, with the mandatory
 * first-gesture unlock (browsers suspend audio until a user interacts). Uses
 * synthesized beeps so the starter ships zero audio binaries; swap in
 * `this.sound` + an audiosprite once real audio is added (see phaser-services).
 * @module services/sound
 */
import Phaser from "phaser";

const CATCH_HZ = 660;
const MISS_HZ = 180;
const GAIN = 0.05;
const SILENCE = 0.0001;

/** Plays short synthesized cues; resumes the audio context on first input. */
export class SoundService {
  #ctx: AudioContext | null = null;

  /**
   * Create the sound service and arm the first-gesture audio unlock.
   * @param scene - The scene to attach the one-time unlock gesture to.
   */
  constructor(scene: Phaser.Scene) {
    // `once` auto-cleans, so no shutdown handler is required for these.
    scene.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.#unlock());
    scene.input.keyboard?.once("keydown", () => this.#unlock());
  }

  /**
   * Cue for catching an item.
   * @returns void
   */
  playCatch(): void {
    this.#beep(CATCH_HZ, 0.07);
  }

  /**
   * Cue for missing an item.
   * @returns void
   */
  playMiss(): void {
    this.#beep(MISS_HZ, 0.12);
  }

  /**
   * Create/resume the audio context on the first user gesture.
   * @returns void
   */
  #unlock(): void {
    if (this.#ctx) {
      return;
    }
    try {
      this.#ctx = new AudioContext();
    } catch {
      // Web Audio unavailable — run silently rather than crash.
      this.#ctx = null;
    }
  }

  /**
   * Play a short beep at a frequency.
   * @param frequency - Tone frequency in Hz.
   * @param duration - Tone length in seconds.
   * @returns void
   */
  #beep(frequency: number, duration: number): void {
    const ctx = this.#ctx;
    if (!ctx) {
      return;
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(GAIN, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(SILENCE, ctx.currentTime + duration);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }
}
