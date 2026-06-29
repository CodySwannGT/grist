/**
 * The Phaser game configuration. WebGL-first (Phaser.AUTO), pixel-art at a fixed
 * 384×216 native resolution that the ScaleManager scales to the viewport by the
 * largest whole-number factor (`NONE` mode + `MAX_ZOOM`) so the picture is always
 * crisp and integer-scaled (decision 0006, V2). Scene order: Boot → Preloader →
 * Battle. No physics engine — the battle is turn-based and sim-authoritative.
 * @module game/config
 */
import Phaser from "phaser";
import { GameView } from "../consts";
import { Boot } from "../scenes/Boot";
import { Preloader } from "../scenes/Preloader";
import { Battle } from "../scenes/Battle";
import { Field } from "../scenes/Field";

/** The configuration passed to `new Phaser.Game()`. */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: GameView.width,
  height: GameView.height,
  backgroundColor: "#141821",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    zoom: Phaser.Scale.MAX_ZOOM,
  },
  // Field is registered alongside Battle but only *started* by the Preloader on
  // demand (`?scene=field`); the default boot lands on Battle, so every existing
  // battle test is unchanged. Field↔Battle wiring is a follow-up (#72).
  scene: [Boot, Preloader, Battle, Field],
};
