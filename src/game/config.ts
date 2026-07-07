/**
 * The Phaser game configuration. WebGL-first (Phaser.AUTO), pixel-art at a fixed
 * 384×216 native resolution that the ScaleManager scales to the viewport by the
 * largest whole-number factor (`NONE` mode + `MAX_ZOOM`) so the picture is always
 * crisp and integer-scaled (decision 0006, V2). Scene order: Boot → Preloader →
 * Title (the default cold-boot front door, #226). No physics engine — the battle is
 * turn-based and sim-authoritative.
 * @module game/config
 */
import Phaser from "phaser";
import { GameView } from "../consts";
import { Boot } from "../scenes/Boot";
import { Preloader } from "../scenes/Preloader";
import { Title } from "../scenes/Title";
import { Battle } from "../scenes/Battle";
import { Field } from "../scenes/Field";
import { Bench } from "../scenes/Bench";
import { Dialogue } from "../scenes/Dialogue";
import { Region } from "../scenes/Region";
import { Menu } from "../scenes/Menu";
import { WorldMap } from "../scenes/WorldMap";

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
  // Title is the DEFAULT cold-boot front door (#226): a plain URL lands here, and its
  // New Game / Continue entries flow into the opening / the saved Field run. Battle,
  // Field, Bench, Dialogue, and Region are registered alongside it but only *started*
  // by the Preloader on demand via the `?scene=`/`?start=` verification seams
  // (`?scene=battle` / `?scene=field` / `?scene=bench` / `?scene=dialogue` /
  // `?scene=region`), so every existing battle/scene test is unchanged. Field↔Battle
  // wiring is a follow-up (#72); the
  // Bench is reached from the growth flow (#86); the Dialogue scene is the
  // dialogue-presenter verification entry (#104); the Region scene is the per-region
  // boot + asset-pipeline verification entry (#137); the Menu is the pause/main menu
  // reached via `?scene=menu` (#113), whose Builds entry reuses the Bench growth screen.
  // The WorldMap is the travel front door (#241), reached from the pause Menu's Map
  // entry (and the `?scene=worldmap` seam); it travels the player into a region.
  scene: [
    Boot,
    Preloader,
    Title,
    Battle,
    Field,
    Bench,
    Dialogue,
    Region,
    Menu,
    WorldMap,
  ],
};
