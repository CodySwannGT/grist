/**
 * Game-feel ("juice") helpers — the small, reusable tactile-feedback vocabulary
 * the scenes fire on discrete sim events (never per frame): an attacker's lunge,
 * a hit-flash on the target, a camera shake, and a rising damage popup.
 *
 * Every helper is one-shot: it creates its tween/timer when the event happens
 * and cleans up after itself, so the pooling rule (nothing allocated in
 * `update()`) stays intact — callers trigger these from event-diffing code, not
 * from per-frame render mirroring. All motion respects the player's
 * reduced-motion preference: when the OS asks for reduced motion, movement and
 * shake collapse to their readable non-moving equivalents (the flash and popup
 * remain, motionless).
 * @module ui/juice
 */
import Phaser from "phaser";

/** Juice timing/intensity tunables (ms / logical px / camera-shake fraction). */
export const JuiceTuning = {
  /** Attacker lunge distance toward the foe (logical px). */
  lungePx: 8,
  /** Attacker lunge out-and-back duration (ms, each way). */
  lungeMs: 90,
  /** Hit-flash duration (ms) the target shows solid white. */
  flashMs: 70,
  /** Camera-shake duration (ms) on a landed hit. */
  shakeMs: 100,
  /** Camera-shake intensity (fraction of viewport). */
  shakeIntensity: 0.004,
  /** Damage-popup rise distance (logical px). */
  popupRisePx: 14,
  /** Damage-popup rise + fade duration (ms). */
  popupMs: 550,
} as const;

/** Damage-popup text style (monospace chrome, matching the HUD). */
const POPUP_STYLE = {
  fontFamily: "monospace",
  fontSize: "9px",
} as const;

/** The solid hit-flash tint (white). */
const FLASH_TINT = 0xffffff;

/**
 * Whether the player asked the OS for reduced motion. Guarded for non-browser
 * (headless test) contexts, where it reports false.
 * @returns True when `prefers-reduced-motion: reduce` matches.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || window.matchMedia === undefined) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Lunge `sprite` horizontally by `dx` and back — the attacker's wind-and-strike
 * beat. A no-op under reduced motion.
 * @param scene - The owning scene (tween factory).
 * @param sprite - The attacker's sprite.
 * @param dx - Signed lunge distance (negative = toward screen left).
 * @returns void
 */
export function attackLunge(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  dx: number
): void {
  if (prefersReducedMotion()) {
    return;
  }
  scene.tweens.add({
    targets: sprite,
    x: sprite.x + dx,
    duration: JuiceTuning.lungeMs,
    yoyo: true,
    ease: "Quad.easeOut",
  });
}

/**
 * Flash `sprite` solid white for {@link JuiceTuning.flashMs} — the "it
 * connected" read on the target. The caller owns the sprite's steady-state
 * tint; this restores via `clearTint`, so fire it only on sprites whose
 * steady-state is untinted (real art), or re-assert state tint afterward.
 * @param scene - The owning scene (timer factory).
 * @param sprite - The hit target's sprite.
 * @returns void
 */
export function hitFlash(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image
): void {
  sprite.setTint(FLASH_TINT).setTintMode(Phaser.TintModes.FILL);
  scene.time.delayedCall(JuiceTuning.flashMs, () => {
    sprite.clearTint();
  });
}

/**
 * One short camera shake — the impact weight on a landed hit. A no-op under
 * reduced motion.
 * @param scene - The scene whose main camera shakes.
 * @returns void
 */
export function screenShake(scene: Phaser.Scene): void {
  if (prefersReducedMotion()) {
    return;
  }
  scene.cameras.main.shake(JuiceTuning.shakeMs, JuiceTuning.shakeIntensity);
}

/**
 * Spawn a rising, fading damage number above `(x, y)` and destroy it when the
 * rise completes. Under reduced motion the number holds still and fades.
 * @param scene - The owning scene.
 * @param x - Popup center X (logical px).
 * @param y - Popup start Y (logical px).
 * @param text - The popup text (e.g. the damage amount).
 * @param color - CSS color for the number.
 * @returns void
 */
export function damagePopup(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string
): void {
  const popup = scene.add
    .text(x, y, text, { ...POPUP_STYLE, color })
    .setOrigin(0.5, 1);
  const rise = prefersReducedMotion() ? 0 : JuiceTuning.popupRisePx;
  scene.tweens.add({
    targets: popup,
    y: y - rise,
    alpha: 0,
    duration: JuiceTuning.popupMs,
    ease: "Quad.easeOut",
    onComplete: () => {
      popup.destroy();
    },
  });
}
