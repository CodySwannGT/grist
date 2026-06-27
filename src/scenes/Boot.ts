/**
 * Boot scene — the first scene. Does the minimal setup needed before the
 * Preloader runs, then hands off. Keep this tiny: heavy loading belongs in
 * Preloader.
 * @module scenes/Boot
 */
import Phaser from "phaser";
import { SceneKeys } from "../consts";
import { verifyBridge } from "../uat/bridge";

/** Minimal first scene; immediately starts the Preloader. */
export class Boot extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Boot);
  }

  /**
   * Start the Preloader.
   * @returns void
   */
  create(): void {
    verifyBridge.attach(SceneKeys.Boot, null);
    this.scene.start(SceneKeys.Preloader);
  }
}
