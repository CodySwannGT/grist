/**
 * Preloader scene — builds the placeholder combatant texture used by the Battle
 * scene. This slice generates its art programmatically (zero binary assets); a
 * real project loads packed atlases here via the asset pipeline. Then it starts
 * the battle.
 * @module scenes/Preloader
 */
import Phaser from "phaser";
import { TextureKeys } from "../assets";
import { BattleLayout, SceneKeys } from "../consts";
import { verifyBridge } from "../uat/bridge";

const HEAD_RADIUS = 6;
const HEAD_CENTER_Y = 8;
const BODY_TOP = 11;
const BODY_INSET = 4;
const BODY_CORNER = 5;
const UNIT_COLOR = 0xffffff;

/** Generates the placeholder unit texture, then transitions to the battle. */
export class Preloader extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Preloader);
  }

  /**
   * Build the unit texture and start the battle.
   * @returns void
   */
  create(): void {
    this.#makeUnitTexture();
    verifyBridge.attach(SceneKeys.Preloader, null);
    this.scene.start(SceneKeys.Battle);
  }

  /**
   * Generate the white, tintable combatant placeholder (a head + body). White so
   * the Battle scene can tint it per side.
   * @returns void
   */
  #makeUnitTexture(): void {
    const width = BattleLayout.unitWidth;
    const height = BattleLayout.unitHeight;
    const graphics = this.add.graphics();
    graphics.fillStyle(UNIT_COLOR, 1);
    graphics.fillRoundedRect(
      BODY_INSET,
      BODY_TOP,
      width - BODY_INSET * 2,
      height - BODY_TOP,
      BODY_CORNER
    );
    graphics.fillCircle(width / 2, HEAD_CENTER_Y, HEAD_RADIUS);
    graphics.generateTexture(TextureKeys.Unit, width, height);
    graphics.destroy();
  }
}
