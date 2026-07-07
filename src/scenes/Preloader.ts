/**
 * Preloader scene — loads the packed runtime assets (`public/assets`, produced
 * by `bun run assets` from the raw art in `assets/src`), registers the global
 * animations, then starts the boot-target scene. All keys come from the
 * generated typed module (`src/assets`), so a missing or renamed asset is a
 * compile error backed by the asset-coverage contract test.
 * @module scenes/Preloader
 */
import Phaser from "phaser";
import { registerGameAnims } from "../anims";
import { AtlasKeys, AudioManifest, ImageKeys } from "../assets";
import { SceneKeys } from "../consts";
import { verifyBridge } from "../uat/bridge";

/** Where the packed atlases live under the static root. */
const ATLAS_PATH = "assets/atlases";
/** Where the standalone images live under the static root. */
const IMAGE_PATH = "assets/images";

/** Loads the packed assets and starts the requested scene. */
export class Preloader extends Phaser.Scene {
  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Preloader);
  }

  /**
   * Queue every packed atlas and standalone image. The atlas list mirrors the
   * `assets/src/sprites/*` folders; the image list mirrors `assets/src/images`.
   * @returns void
   */
  preload(): void {
    for (const atlas of Object.values(AtlasKeys)) {
      const base = atlas.replace(/^atlas-/u, "");
      this.load.atlas(
        atlas,
        `${ATLAS_PATH}/${base}.png`,
        `${ATLAS_PATH}/${base}.json`
      );
    }
    for (const image of Object.values(ImageKeys)) {
      const base = image.replace(/^img-/u, "");
      this.load.image(image, `${IMAGE_PATH}/${base}.png`);
    }
    // Temp audio (#115): each clip loads by its typed key + real-extension url from
    // the generated manifest, so a missing/renamed clip is a compile error.
    for (const clip of AudioManifest) {
      this.load.audio(clip.key, clip.url);
    }
  }

  /**
   * Register the global animations and start the next scene. Defaults to the Title
   * front door (#226) — a plain URL lands on the main menu — while the `?scene=`/
   * `?start=` seams still route directly to any gameplay scene (they are the DEV/UAT
   * verification entry points, not the player path). Notably `?scene=battle` keeps
   * booting the standalone battle so every existing battle test is unchanged.
   * @returns void
   */
  create(): void {
    registerGameAnims(this);
    verifyBridge.attach(SceneKeys.Preloader, null);
    this.scene.start(startScene());
  }
}

/**
 * Resolve which gameplay scene to start from the URL: the Field scene when the
 * page carries `?scene=field`, the Bench (growth) scene when it carries
 * `?scene=bench`, the Dialogue presenter scene when it carries `?scene=dialogue`,
 * `?scene=opening` (the Ch.1 opening — the Dialogue scene selects the Ch.1 script
 * over the demo for `opening`; #105), or `?scene=mill` (Wren's "What the mill took"
 * side-story beat; #111), `?scene=reckoning` (the Reckoning world-turn set-piece;
 * #251/#125), the standalone Battle when it carries `?scene=battle`,
 * case-insensitive, with the `?start=<Scene>` alias, else the default Title front
 * door (#226).
 * Reading the query here (not in `gameConfig`) keeps the scene registry static. The
 * `?scene=`/`?start=` values are the DEV/UAT verification entry points (growth slice
 * #86; dialogue presenter #104; the field counterpart of `?scene=field`); the
 * explicit `?scene=battle` keeps every existing battle test booting Battle even
 * though the no-param default is now Title. Guarded for non-browser (test) contexts
 * where `window` is absent.
 * @returns The scene key to start.
 */
function startScene(): string {
  if (typeof window === "undefined") {
    return SceneKeys.Title;
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
  if (requested === "menu") {
    return SceneKeys.Menu;
  }
  if (requested === "worldmap") {
    return SceneKeys.WorldMap;
  }
  if (requested === "finale") {
    return SceneKeys.Finale;
  }
  if (requested === "reckoning") {
    return SceneKeys.Reckoning;
  }
  if (requested === "battle") {
    return SceneKeys.Battle;
  }
  return SceneKeys.Title;
}
