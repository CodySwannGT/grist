/**
 * Preloader scene — builds the placeholder textures used by the game. This
 * starter generates art programmatically (zero binary assets); a real project
 * loads packed atlases here via the asset pipeline. Then it starts the menu.
 * @module scenes/Preloader
 */
import Phaser from "phaser";
import { SceneKeys, Tunables } from "../consts";
import { TextureKeys } from "../assets";
import { verifyBridge } from "../uat/bridge";

const ITEM_COLOR = 0xffd166;
const PLAYER_COLOR = 0x06d6a0;
const PLAYER_HEIGHT = 20;
const PLAYER_CORNER = 6;

/** Generates placeholder textures, then transitions to the main menu. */
export class Preloader extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Preloader);
  }

  /**
   * Build textures and start the main menu.
   * @returns void
   */
  create(): void {
    this.#makeItemTexture();
    this.#makePlayerTexture();
    verifyBridge.attach(SceneKeys.Preloader, null);
    this.scene.start(SceneKeys.MainMenu);
  }

  /**
   * Generate the falling-item texture (a filled circle).
   * @returns void
   */
  #makeItemTexture(): void {
    const size = Tunables.itemRadius * 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(ITEM_COLOR, 1);
    graphics.fillCircle(
      Tunables.itemRadius,
      Tunables.itemRadius,
      Tunables.itemRadius
    );
    graphics.generateTexture(TextureKeys.Item, size, size);
    graphics.destroy();
  }

  /**
   * Generate the player texture (a rounded bar).
   * @returns void
   */
  #makePlayerTexture(): void {
    const width = Tunables.playerHalfWidth * 2;
    const graphics = this.add.graphics();
    graphics.fillStyle(PLAYER_COLOR, 1);
    graphics.fillRoundedRect(0, 0, width, PLAYER_HEIGHT, PLAYER_CORNER);
    graphics.generateTexture(TextureKeys.Player, width, PLAYER_HEIGHT);
    graphics.destroy();
  }
}
