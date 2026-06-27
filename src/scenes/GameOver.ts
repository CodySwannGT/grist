/**
 * GameOver scene — shows the final score and best score, then restarts on
 * space/tap. Reads the run's score from the global registry and persists the
 * best via SaveService.
 * @module scenes/GameOver
 */
import Phaser from "phaser";
import { RegistryKeys, SceneKeys, Tunables } from "../consts";
import { SaveService } from "../services/save";
import { verifyBridge } from "../uat/bridge";

const TITLE_STYLE = {
  fontFamily: "monospace",
  fontSize: "48px",
  color: "#ef476f",
} as const;
const TEXT_STYLE = {
  fontFamily: "monospace",
  fontSize: "24px",
  color: "#e6e6e6",
} as const;
const HINT_STYLE = {
  fontFamily: "monospace",
  fontSize: "20px",
  color: "#9aa0a6",
} as const;

/** End screen; records the high score and restarts on input. */
export class GameOver extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.GameOver);
  }

  /**
   * Show results and wait for the restart input.
   * @returns void
   */
  create(): void {
    const score = Number(this.registry.get(RegistryKeys.LastScore) ?? 0);
    const save = new SaveService();
    const isBest = save.recordScore(score);
    const centerX = Tunables.width / 2;

    this.add
      .text(centerX, Tunables.height / 2 - 80, "GAME OVER", TITLE_STYLE)
      .setOrigin(0.5);
    this.add
      .text(centerX, Tunables.height / 2 - 10, `Score: ${score}`, TEXT_STYLE)
      .setOrigin(0.5);
    this.add
      .text(
        centerX,
        Tunables.height / 2 + 30,
        isBest ? `New best!` : `Best: ${save.highScore}`,
        TEXT_STYLE
      )
      .setOrigin(0.5);
    this.add
      .text(
        centerX,
        Tunables.height / 2 + 90,
        "Press SPACE or tap to retry",
        HINT_STYLE
      )
      .setOrigin(0.5);

    verifyBridge.attach(SceneKeys.GameOver, null);
    this.input.keyboard?.once("keydown-SPACE", () => this.#retry());
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.#retry());
  }

  /**
   * Restart the Game scene.
   * @returns void
   */
  #retry(): void {
    this.scene.start(SceneKeys.Game);
  }
}
