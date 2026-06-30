/**
 * Preloader scene — builds the placeholder combatant texture used by the Battle
 * scene. This slice generates its art programmatically (zero binary assets); a
 * real project loads packed atlases here via the asset pipeline. Then it starts
 * the battle.
 * @module scenes/Preloader
 */
import Phaser from "phaser";
import { TextureKeys } from "../assets";
import { BattleLayout, SceneKeys } from "../consts";
import { verifyBridge } from "../uat/bridge";

const HEAD_RADIUS = 6;
const HEAD_CENTER_Y = 8;
const BODY_TOP = 11;
const BODY_INSET = 4;
const BODY_CORNER = 5;
const UNIT_COLOR = 0xffffff;

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
}

/**
 * Resolve which gameplay scene to start from the URL: the Field scene when the
 * page carries `?scene=field`, the Bench (growth) scene when it carries
 * `?scene=bench`, the Dialogue presenter scene when it carries `?scene=dialogue`
 * or `?scene=opening` (the Ch.1 opening — the Dialogue scene selects the Ch.1
 * script over the demo for `opening`; #105), case-insensitive, with the
 * `?start=<Scene>` alias, else the default Battle.
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
  if (requested === "dialogue" || requested === "opening") {
    return SceneKeys.Dialogue;
  }
  return SceneKeys.Battle;
}
