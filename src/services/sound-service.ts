/**
 * SoundService — the single owner of temp-audio playback (#115). Web Audio starts
 * **suspended** until a user gesture, so sound played before the first tap is
 * silently dropped ("works on desktop, silent on the phone"); this service
 * centralises the one-time unlock and every `play`. Scenes never call
 * `this.sound.play(...)` directly — they call {@link SoundService.playCue} /
 * {@link SoundService.startMusic} with a typed {@link AudioCueId}.
 *
 * Firing a cue does three things atomically: it plays the clip (gated by mute),
 * records the cue on an append-only log the verification bridge reads
 * (`__VERIFY__.audio()`), and publishes {@link AudioEvents.Cue} so the redundant
 * on-screen caption shows in lockstep (FR11 / AC12 — no cue by color/audio alone).
 * A single shared instance is exported (the `eventsCenter` pattern) and wired to
 * the game's sound manager once in Boot.
 * @module services/sound-service
 */
import Phaser from "phaser";
import { AudioKeys } from "../assets";
import { AudioEvents } from "../consts";
import { AudioCues, CUE_CAPTIONS, type AudioCueId } from "../logic/audio";
import { eventsCenter } from "./events";

/** Map each cue id to its generated, typed load key (no raw strings leak out). */
const CUE_KEY: Readonly<Record<AudioCueId, string>> = {
  [AudioCues.choir]: AudioKeys.choirLeitmotif,
  [AudioCues.gristSpend]: AudioKeys.gristSpend,
  [AudioCues.break]: AudioKeys.break,
  [AudioCues.rendering]: AudioKeys.rendering,
};

/** How many recent cues the verification log retains (a bounded ring). */
const LOG_CAP = 64;

/** Looping volume for the opening leitmotif (a quiet bed under the dialogue). */
const MUSIC_VOLUME = 0.4;
/** One-shot volume for the resonant stingers. */
const STINGER_VOLUME = 0.7;

/**
 * Centralises audio unlock + playback and the verification cue log. Phaser-owned
 * playback is best-effort (a suspended context, a headless test runner, or a
 * disabled sound manager never throws or logs an error); the cue log + caption
 * event fire regardless so the "an agent played it" proof and the redundant cue
 * do not depend on the audio device.
 */
class SoundService {
  #sound: Phaser.Sound.BaseSoundManager | null = null;
  #music: Phaser.Sound.BaseSound | null = null;
  #unlocked = false;
  #muted = false;
  #log: AudioCueId[] = [];
  #lastCue: AudioCueId | null = null;

  /**
   * Bind the game's sound manager (called once in Boot). Idempotent — a second
   * call re-binds the same manager without disturbing the log.
   * @param sound - The game's shared sound manager (`scene.sound`).
   * @returns void
   */
  init(sound: Phaser.Sound.BaseSoundManager): void {
    this.#sound = sound;
  }

  /**
   * Arm the one-time Web Audio unlock on the first pointer gesture in a scene (and
   * on Phaser's own UNLOCKED signal). Idempotent and safe to call from every
   * scene's `create`; a no-op once unlocked. `.once` listeners auto-remove, so
   * there is nothing to tear down.
   * @param scene - The scene whose first pointer gesture unlocks audio.
   * @returns void
   */
  attachUnlock(scene: Phaser.Scene): void {
    if (this.#unlocked || this.#sound === null) {
      return;
    }
    scene.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.#resume());
    this.#sound.once(Phaser.Sound.Events.UNLOCKED, () => this.#resume());
  }

  /**
   * Mute or unmute all playback. Cues still record + caption while muted (the
   * moment still happened); only the audible clip is suppressed.
   * @param muted - Whether to silence playback.
   * @returns void
   */
  setMuted(muted: boolean): void {
    this.#muted = muted;
  }

  /**
   * Fire a one-shot stinger cue: play it (unless muted), record it on the
   * verification log, and publish {@link AudioEvents.Cue} for the redundant
   * caption. Safe to call from any scene.
   * @param cue - The stinger cue to fire.
   * @returns void
   */
  playCue(cue: AudioCueId): void {
    this.#play(cue, { volume: STINGER_VOLUME });
    this.#mark(cue);
  }

  /**
   * Start the looping opening leitmotif (stopping any prior loop first), then
   * record + caption it once as its opening moment. A no-op re-start if the same
   * loop is already playing is harmless — the guard stops the old instance first.
   * @param cue - The music cue to loop (the Choir leitmotif).
   * @returns void
   */
  startMusic(cue: AudioCueId): void {
    this.stopMusic();
    if (!this.#muted && this.#sound !== null) {
      const music = this.#sound.add(CUE_KEY[cue], {
        loop: true,
        volume: MUSIC_VOLUME,
      });
      music.play();
      this.#music = music;
    }
    this.#mark(cue);
  }

  /**
   * Stop the looping leitmotif and release it (the scene-shutdown counterpart of
   * {@link SoundService.startMusic}). A no-op when nothing is looping.
   * @returns void
   */
  stopMusic(): void {
    if (this.#music !== null) {
      this.#music.stop();
      this.#music.destroy();
      this.#music = null;
    }
  }

  /**
   * The append-only cue log the verification bridge exposes (`__VERIFY__.audio()`)
   * so an e2e can prove each stinger fired at its moment.
   * @returns The recent cue ids, oldest first.
   */
  recentCues(): readonly AudioCueId[] {
    return this.#log;
  }

  /**
   * The most recently fired cue (the one whose redundant caption is showing), or
   * null before any cue this session.
   * @returns The last cue id, or null.
   */
  lastCue(): AudioCueId | null {
    return this.#lastCue;
  }

  /**
   * The redundant text/icon caption for the most recent cue (`"<icon> <text>"`),
   * or null before any cue — read by the verification bridge
   * (`__VERIFY__.audioCaption()`) to prove every audio moment carries a
   * non-color/non-audio cue (FR11 / AC12).
   * @returns The caption string, or null.
   */
  lastCaption(): string | null {
    if (this.#lastCue === null) {
      return null;
    }
    const caption = CUE_CAPTIONS[this.#lastCue];
    return `${caption.icon} ${caption.text}`;
  }

  /**
   * Record a cue on the bounded log and publish it for the redundant caption.
   * @param cue - The cue that just fired.
   * @returns void
   */
  #mark(cue: AudioCueId): void {
    this.#lastCue = cue;
    this.#log.push(cue);
    if (this.#log.length > LOG_CAP) {
      this.#log.shift();
    }
    eventsCenter.emit(AudioEvents.Cue, cue);
  }

  /**
   * Best-effort playback of a one-shot clip; never throws even if the context is
   * suspended or the manager is disabled.
   * @param cue - The cue to play.
   * @param config - The Phaser sound config (volume).
   * @returns void
   */
  #play(cue: AudioCueId, config: Phaser.Types.Sound.SoundConfig): void {
    if (this.#muted || this.#sound === null) {
      return;
    }
    this.#sound.play(CUE_KEY[cue], config);
  }

  /**
   * Resume a suspended Web Audio context (the unlock). Idempotent.
   * @returns void
   */
  #resume(): void {
    const context = (
      this.#sound as unknown as { context?: AudioContext | undefined }
    )?.context;
    if (context !== undefined && context.state === "suspended") {
      void context.resume();
    }
    this.#unlocked = true;
  }
}

/** The single shared sound service (wired to the game's sound manager in Boot). */
export const soundService = new SoundService();
