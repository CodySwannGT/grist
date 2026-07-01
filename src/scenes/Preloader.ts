/**
 * Preloader scene — builds the placeholder combatant texture used by the Battle
 * scene. This slice generates its art programmatically (zero binary assets); a
 * real project loads packed atlases here via the asset pipeline. Then it starts
 * the battle.
 * @module scenes/Preloader
 */
import Phaser from "phaser";
import { TextureKeys } from "../assets";
import {
  BattleLayout,
  GameView,
  RegionColors,
  RegionLayout,
  SceneKeys,
} from "../consts";
import { verifyBridge } from "../uat/bridge";

const HEAD_RADIUS = 6;
const HEAD_CENTER_Y = 8;
const BODY_TOP = 11;
const BODY_INSET = 4;
const BODY_CORNER = 5;
const UNIT_COLOR = 0xffffff;
/** Thickness (logical px) of the region backdrop's horizon divider line. */
const HORIZON_THICKNESS = 2;

/** Generates the placeholder unit texture, then transitions to the battle. */
export class Preloader extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Preloader);
  }

  /**
   * Build the unit texture and start the next scene. Defaults to Battle (the
   * shipped boot target) so every existing battle test is unchanged; starts the
   * Field scene instead only when the page is loaded with `?scene=field` (or the
   * `?start=Field` alias). Field↔Battle wiring is a follow-up (#72) — this
   * query-gated start is purely a verification entry point for the field slice.
   * @returns void
   */
  create(): void {
    this.#makeUnitTexture();
    this.#makeRegionBackdropTexture();
    verifyBridge.attach(SceneKeys.Preloader, null);
    this.scene.start(startScene());
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

  /**
   * Generate the region side-view backdrop placeholder (#137): a full-screen
   * 384×216 texture banding a sky over a ground, split by a horizon line. Built
   * programmatically here (the per-region asset-pipeline precedent — zero binary
   * assets, zero licensing risk) so the Region scene renders its side-view by
   * preloading {@link TextureKeys.RegionBackdrop} alone; when real per-region art
   * lands, the pipeline generates this key from `assets/src` instead.
   * @returns void
   */
  #makeRegionBackdropTexture(): void {
    const { width, height } = GameView;
    const graphics = this.add.graphics();
    graphics.fillStyle(RegionColors.sky, 1);
    graphics.fillRect(0, 0, width, RegionLayout.horizonY);
    graphics.fillStyle(RegionColors.ground, 1);
    graphics.fillRect(
      0,
      RegionLayout.horizonY,
      width,
      height - RegionLayout.horizonY
    );
    graphics.fillStyle(RegionColors.horizon, 1);
    graphics.fillRect(0, RegionLayout.horizonY, width, HORIZON_THICKNESS);
    graphics.generateTexture(TextureKeys.RegionBackdrop, width, height);
    graphics.destroy();
  }
}

/**
 * Resolve which gameplay scene to start from the URL: the Field scene when the
 * page carries `?scene=field`, the Bench (growth) scene when it carries
 * `?scene=bench`, the Dialogue presenter scene when it carries `?scene=dialogue`,
 * `?scene=opening` (the Ch.1 opening — the Dialogue scene selects the Ch.1 script
 * over the demo for `opening`; #105), or `?scene=mill` (Wren's "What the mill took"
 * side-story beat; #111), case-insensitive, with the `?start=<Scene>` alias, else
 * the default Battle.
 * Reading the query here (not in `gameConfig`) keeps the scene registry static and
 * the default boot — every existing battle test — unchanged. The bench and dialogue
 * starts are verification entry points (growth slice #86; dialogue presenter #104),
 * the field counterpart of the existing `?scene=field` start. Guarded for
 * non-browser (test) contexts where `window` is absent.
 * @returns The scene key to start.
 */
function startScene(): string {
  if (typeof window === "undefined") {
    return SceneKeys.Battle;
  }
  const params = new URLSearchParams(window.location.search);
  const requested = (
    params.get("scene") ??
    params.get("start") ??
    ""
  ).toLowerCase();
  if (requested === "field") {
    return SceneKeys.Field;
  }
  if (requested === "bench") {
    return SceneKeys.Bench;
  }
  if (
    requested === "dialogue" ||
    requested === "opening" ||
    requested === "mill"
  ) {
    // `mill` boots the Dialogue scene over Wren's "What the mill took" side-story
    // beat (#111); the Dialogue scene selects the mill script for that selector, the
    // same way `opening` selects the Ch.1 script.
    return SceneKeys.Dialogue;
  }
  if (requested === "region") {
    return SceneKeys.Region;
  }
  if (requested === "pausemenu" || requested === "menu") {
    // The pause/main menu (#113) — a verification entry point (its Builds entry
    // opens the existing Bench growth screen, reused not re-spec'd), the bench
    // counterpart of the `?scene=bench` start.
    return SceneKeys.PauseMenu;
  }
  return SceneKeys.Battle;
}
