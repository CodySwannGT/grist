/**
 * Global animation registration — every sprite animation the game plays,
 * created once (idempotently) from the typed atlas keys after the Preloader
 * finishes loading. Battler walk/hover cycles are derived from the cast table
 * (`ui/battler-view`); battle FX play-once strips are enumerated here. The
 * asset-coverage contract test proves every frame these definitions reference
 * exists in the committed atlases.
 * @module anims
 */
import type Phaser from "phaser";
import { AtlasKeys, Frames } from "./assets";
import {
  BATTLER_KIND,
  BATTLER_REFS,
  BattlerDirs,
  BattlerKinds,
  WALK_FRAME_COUNT,
  battlerWalkAnim,
  battlerWalkFrame,
  type BattlerDir,
} from "./ui/battler-view";

/** Field walk-cycle frame rate (fps) for `char` battlers. */
const CHAR_WALK_FPS = 8;
/** Idle hover/bob frame rate (fps) for `monster` battlers — slow, reads as floating. */
const MONSTER_HOVER_FPS = 5;
/** Battle FX strip frame rate (fps). */
const FX_FPS = 14;

/** The registered play-once battle-FX animation keys. */
export const FxAnims = {
  /** Physical hit arc (strike / bind). */
  slash: "anim-fx-slash",
  /** Craft / magic burst. */
  spark: "anim-fx-spark",
  /** Defend / vanish puff. */
  smoke: "anim-fx-smoke",
} as const;

/**
 * The FX frame sequences (typed constants from the generated key module).
 * Exported for the asset-coverage contract test.
 */
export const FX_FRAMES: Readonly<
  Record<keyof typeof FxAnims, readonly string[]>
> = {
  slash: [
    Frames.fx.slash0,
    Frames.fx.slash1,
    Frames.fx.slash2,
    Frames.fx.slash3,
    Frames.fx.slash4,
  ],
  spark: [
    Frames.fx.spark0,
    Frames.fx.spark1,
    Frames.fx.spark2,
    Frames.fx.spark3,
    Frames.fx.spark4,
    Frames.fx.spark5,
  ],
  smoke: [
    Frames.fx.smoke0,
    Frames.fx.smoke1,
    Frames.fx.smoke2,
    Frames.fx.smoke3,
    Frames.fx.smoke4,
    Frames.fx.smoke5,
  ],
};

/**
 * Register every game animation on the global animation manager. Idempotent —
 * a re-entered Preloader (scene restarts) skips existing keys, so this can run
 * on every boot without churn.
 * @param scene - Any live scene (route to the global anims manager).
 * @returns void
 */
export function registerGameAnims(scene: Phaser.Scene): void {
  registerBattlerAnims(scene);
  registerFxAnims(scene);
}

/**
 * Register every battler's per-direction walk/hover cycle.
 * @param scene - Any live scene (route to the global anims manager).
 * @returns void
 */
function registerBattlerAnims(scene: Phaser.Scene): void {
  for (const ref of BATTLER_REFS) {
    const fps =
      BATTLER_KIND[ref] === BattlerKinds.char
        ? CHAR_WALK_FPS
        : MONSTER_HOVER_FPS;
    for (const dir of Object.values(BattlerDirs) as readonly BattlerDir[]) {
      const key = battlerWalkAnim(ref, dir);
      if (scene.anims.exists(key)) {
        continue;
      }
      scene.anims.create({
        key,
        frames: Array.from({ length: WALK_FRAME_COUNT }, (_unused, index) => ({
          key: AtlasKeys.battlers,
          frame: battlerWalkFrame(ref, dir, index),
        })),
        frameRate: fps,
        repeat: -1,
      });
    }
  }
}

/**
 * Register the play-once battle-FX strips.
 * @param scene - Any live scene (route to the global anims manager).
 * @returns void
 */
function registerFxAnims(scene: Phaser.Scene): void {
  for (const [name, key] of Object.entries(FxAnims)) {
    if (scene.anims.exists(key)) {
      continue;
    }
    scene.anims.create({
      key,
      frames: FX_FRAMES[name as keyof typeof FxAnims].map(frame => ({
        key: AtlasKeys.fx,
        frame,
      })),
      frameRate: FX_FPS,
      repeat: 0,
      hideOnComplete: true,
    });
  }
}
