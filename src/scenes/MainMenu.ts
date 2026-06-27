/**
 * MainMenu scene — the title screen. Starts the game on space or tap. Uses
 * one-shot listeners (`once`), which auto-clean, so no shutdown handler needed.
 * @module scenes/MainMenu
 */
import Phaser from "phaser";
import { SceneKeys, Tunables } from "../consts";
import { verifyBridge } from "../uat/bridge";

const TITLE_STYLE = {
  fontFamily: "monospace",
  fontSize: "56px",
  color: "#ffd166",
} as const;
const HINT_STYLE = {
  fontFamily: "monospace",
  fontSize: "22px",
  color: "#e6e6e6",
} as const;

/** Title screen; starts the Game scene on space/tap. */
export class MainMenu extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.MainMenu);
  }

  /**
   * Draw the title and wait for the start input.
   * @returns void
   */
  create(): void {
    const centerX = Tunables.width / 2;
    this.add
      .text(centerX, Tunables.height / 2 - 60, "COLLECTOR", TITLE_STYLE)
      .setOrigin(0.5);
    this.add
      .text(
        centerX,
        Tunables.height / 2 + 30,
        "Press SPACE or tap to play",
        HINT_STYLE
      )
      .setOrigin(0.5);

    verifyBridge.attach(SceneKeys.MainMenu, null);
    this.input.keyboard?.once("keydown-SPACE", () => this.#start());
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.#start());
  }

  /**
   * Start the Game scene.
   * @returns void
   */
  #start(): void {
    this.scene.start(SceneKeys.Game);
  }
}
