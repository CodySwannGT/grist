/**
 * The Phaser game configuration. WebGL-first (Phaser.AUTO), Arcade physics as
 * the default engine, and the Boot → Preloader → MainMenu → Game → GameOver
 * scene order. Physics debug is gated on the dev build (never committed on).
 * @module game/config
 */
import Phaser from "phaser";
import { Tunables } from "../consts";
import { Boot } from "../scenes/Boot";
import { Preloader } from "../scenes/Preloader";
import { MainMenu } from "../scenes/MainMenu";
import { Game } from "../scenes/Game";
import { GameOver } from "../scenes/GameOver";

/** The configuration passed to `new Phaser.Game()`. */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: Tunables.width,
  height: Tunables.height,
  backgroundColor: "#1d2330",
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: import.meta.env.DEV },
  },
  scene: [Boot, Preloader, MainMenu, Game, GameOver],
};
