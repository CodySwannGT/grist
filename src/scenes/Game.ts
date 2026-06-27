/**
 * Game scene — the thin adapter between the pure simulation (src/logic) and
 * Phaser. It owns no game rules: every frame it reads an input intent, advances
 * the sim, and renders the result. No objects/tweens/timers are created in
 * update() (all sprites are pooled up-front in create), and listeners are cleaned
 * up on shutdown.
 * @module scenes/Game
 */
import Phaser from "phaser";
import { GameEvents, RegistryKeys, SceneKeys, Tunables } from "../consts";
import { TextureKeys } from "../assets";
import { GameSim, type AdvanceResult } from "../logic/game";
import { InputService } from "../services/input";
import { SoundService } from "../services/sound";
import { eventsCenter } from "../services/events";
import { verifyBridge } from "../uat/bridge";

const DEFAULT_SEED = 0x9e3779b1;
const HUD_STYLE = {
  fontFamily: "monospace",
  fontSize: "20px",
  color: "#e6e6e6",
} as const;

/** Renders and drives the collector simulation. */
export class Game extends Phaser.Scene {
  #sim!: GameSim;
  #input!: InputService;
  #sound!: SoundService;
  #player!: Phaser.GameObjects.Image;
  #itemImages!: readonly Phaser.GameObjects.Image[];
  #hud!: Phaser.GameObjects.Text;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Game);
  }

  /**
   * Build the sim, services, pooled sprites, and HUD.
   * @returns void
   */
  create(): void {
    const seed = verifyBridge.takeSeed() ?? DEFAULT_SEED;
    this.#sim = new GameSim(seed);
    this.#input = new InputService(this);
    this.#sound = new SoundService(this);

    this.#player = this.add.image(
      this.#sim.playerX,
      Tunables.playerY,
      TextureKeys.Player
    );
    this.#itemImages = this.#sim.items.map(() => {
      const image = this.add.image(0, 0, TextureKeys.Item);
      image.setVisible(false);
      return image;
    });
    this.#hud = this.add.text(16, 16, "", HUD_STYLE);
    this.#syncHud();

    verifyBridge.attach(SceneKeys.Game, this.#sim);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());
  }

  /**
   * Per-frame: read intent, advance the sim, render, and react.
   * @param _time - Absolute time (unused; the sim is delta-driven).
   * @param delta - Milliseconds since the last frame.
   * @returns void
   */
  override update(_time: number, delta: number): void {
    const seconds = delta / 1000;
    const override = verifyBridge.intentOverride();
    const intent = override ?? this.#input.moveIntent(this.#sim.playerX);
    const result = this.#sim.advance(seconds, intent);
    this.#render();
    this.#react(result);
  }

  /**
   * Mirror the sim state onto the pooled sprites. No allocation per frame.
   * @returns void
   */
  #render(): void {
    this.#player.x = this.#sim.playerX;
    const images = this.#itemImages;
    for (const [index, item] of this.#sim.items.entries()) {
      const image = images[index];
      if (!image) {
        continue;
      }
      if (item.active) {
        image.setVisible(true);
        image.setPosition(item.x, item.y);
      } else if (image.visible) {
        image.setVisible(false);
      }
    }
  }

  /**
   * Emit events, play cues, update the HUD, and end the run.
   * @param result - The outcome of this frame's advance.
   * @returns void
   */
  #react(result: AdvanceResult): void {
    if (result.scoreChanged) {
      eventsCenter.emit(GameEvents.ScoreChanged, this.#sim.score);
      this.#sound.playCatch();
      this.#syncHud();
    }
    if (result.missed > 0 && !result.gameOver) {
      eventsCenter.emit(GameEvents.LifeLost, this.#sim.lives);
      this.#sound.playMiss();
      this.#syncHud();
    }
    if (result.gameOver) {
      eventsCenter.emit(GameEvents.GameOver, this.#sim.score);
      this.registry.set(RegistryKeys.LastScore, this.#sim.score);
      this.scene.start(SceneKeys.GameOver);
    }
  }

  /**
   * Update the HUD text from the sim.
   * @returns void
   */
  #syncHud(): void {
    this.#hud.setText(`Score: ${this.#sim.score}   Lives: ${this.#sim.lives}`);
  }

  /**
   * Free owned listeners/keys on scene shutdown.
   * @returns void
   */
  #shutdown(): void {
    this.#input.destroy();
  }
}
