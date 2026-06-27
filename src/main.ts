/**
 * App bootstrap. Installs the verification (UAT) bridge when enabled, then
 * starts Phaser. Kept tiny on purpose — all behavior lives in scenes and the
 * pure logic core.
 * @module main
 */
import Phaser from "phaser";
import { gameConfig } from "./game/config";
import { installVerifyBridge } from "./uat/bridge";

installVerifyBridge();

/** The running Phaser game instance. */
export const game = new Phaser.Game(gameConfig);
