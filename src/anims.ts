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
  /** Craft / magic burst (neutral fallback for an element-less Craft). */
  spark: "anim-fx-spark",
  /** Defend / vanish puff. */
  smoke: "anim-fx-smoke",
  /** Flux craft — lightning arc (view tints it cyan-white). */
  flux: "anim-fx-flux",
  /** Ash craft — ember flare (view tints it grey-violet). */
  ash: "anim-fx-ash",
  /** Iron craft — earthen shard burst (view tints it steel-orange). */
  iron: "anim-fx-iron",
  /** Bloom craft — verdant spray (view tints it green-gold). */
  bloom: "anim-fx-bloom",
  /** Gloom craft — void crystal (view tints it void-black). */
  gloom: "anim-fx-gloom",
  /** The Break burst — the dedicated Pressure→Break visual moment. */
  break: "anim-fx-break",
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
  flux: [
    Frames.fx.flux0,
    Frames.fx.flux1,
    Frames.fx.flux2,
    Frames.fx.flux3,
    Frames.fx.flux4,
    Frames.fx.flux5,
    Frames.fx.flux6,
    Frames.fx.flux7,
  ],
  ash: [
    Frames.fx.ash0,
    Frames.fx.ash1,
    Frames.fx.ash2,
    Frames.fx.ash3,
    Frames.fx.ash4,
    Frames.fx.ash5,
    Frames.fx.ash6,
    Frames.fx.ash7,
  ],
  iron: [
    Frames.fx.iron0,
    Frames.fx.iron1,
    Frames.fx.iron2,
    Frames.fx.iron3,
    Frames.fx.iron4,
    Frames.fx.iron5,
    Frames.fx.iron6,
    Frames.fx.iron7,
    Frames.fx.iron8,
    Frames.fx.iron9,
    Frames.fx.iron10,
    Frames.fx.iron11,
    Frames.fx.iron12,
    Frames.fx.iron13,
  ],
  bloom: [
    Frames.fx.bloom0,
    Frames.fx.bloom1,
    Frames.fx.bloom2,
    Frames.fx.bloom3,
    Frames.fx.bloom4,
    Frames.fx.bloom5,
    Frames.fx.bloom6,
    Frames.fx.bloom7,
  ],
  gloom: [
    Frames.fx.gloom0,
    Frames.fx.gloom1,
    Frames.fx.gloom2,
    Frames.fx.gloom3,
    Frames.fx.gloom4,
    Frames.fx.gloom5,
    Frames.fx.gloom6,
    Frames.fx.gloom7,
    Frames.fx.gloom8,
    Frames.fx.gloom9,
  ],
  break: [
    Frames.fx.break0,
    Frames.fx.break1,
    Frames.fx.break2,
    Frames.fx.break3,
    Frames.fx.break4,
    Frames.fx.break5,
    Frames.fx.break6,
    Frames.fx.break7,
    Frames.fx.break8,
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
