/**
 * Boot scene — the first scene. Does the minimal setup needed before the
 * Preloader runs, then hands off. Keep this tiny: heavy loading belongs in
 * Preloader.
 * @module scenes/Boot
 */
import Phaser from "phaser";
import { SceneKeys } from "../consts";
import { soundService } from "../services/sound-service";
import { verifyBridge } from "../uat/bridge";

/** Minimal first scene; immediately starts the Preloader. */
export class Boot extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Boot);
  }

  /**
   * Bind the shared sound service to the game's sound manager and arm the audio
   * unlock on the first gesture, then start the Preloader.
   * @returns void
   */
  create(): void {
    soundService.init(this.sound);
    soundService.attachUnlock(this);
    verifyBridge.attach(SceneKeys.Boot, null);
    this.scene.start(SceneKeys.Preloader);
  }
}
