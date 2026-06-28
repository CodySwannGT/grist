/**
 * App bootstrap. Installs the verification (UAT) bridge when enabled, starts
 * Phaser, and keeps the canvas integer-scaled to the viewport on resize. Kept tiny
 * on purpose — all behavior lives in scenes and the pure logic core.
 * @module main
 */
import Phaser from "phaser";
import { gameConfig } from "./game/config";
import { installVerifyBridge } from "./uat/bridge";

installVerifyBridge();

/** The running Phaser game instance. */
export const game = new Phaser.Game(gameConfig);

// `NONE` scale mode does not react to viewport changes on its own; recompute the
// largest whole-number zoom so the picture stays integer-scaled and letterboxed.
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    game.scale.refresh();
    game.scale.setMaxZoom();
  });
}
