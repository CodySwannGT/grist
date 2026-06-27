/**
 * InputService — maps raw keyboard/pointer input to a semantic movement intent.
 * Scenes read intent, never raw keys, so input is centralized and remappable.
 * It reads `scene.input` (not `this.input` on a Scene), and frees its keys on
 * destroy(), which the owning scene calls on shutdown.
 * @module services/input
 */
import Phaser from "phaser";

const POINTER_DEADZONE_PX = 8;

/** Translates input devices into a -1/0/1 movement intent. */
export class InputService {
  readonly #scene: Phaser.Scene;
  readonly #cursors: Phaser.Types.Input.Keyboard.CursorKeys | null;
  readonly #keyA: Phaser.Input.Keyboard.Key | null;
  readonly #keyD: Phaser.Input.Keyboard.Key | null;

  /**
   * Create the input service and acquire its keys.
   * @param scene - The scene whose input plugin to read.
   */
  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    const keyboard = scene.input.keyboard;
    this.#cursors = keyboard ? keyboard.createCursorKeys() : null;
    this.#keyA = keyboard
      ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
      : null;
    this.#keyD = keyboard
      ? keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      : null;
  }

  /**
   * Current movement intent. Keyboard wins; otherwise a held pointer steers
   * toward its x relative to a reference (the player's position).
   * @param referenceX - The x the pointer is steering relative to.
   * @returns -1 (left), 0 (still), or 1 (right).
   */
  moveIntent(referenceX: number): number {
    const left =
      (this.#cursors?.left.isDown ?? false) || (this.#keyA?.isDown ?? false);
    const right =
      (this.#cursors?.right.isDown ?? false) || (this.#keyD?.isDown ?? false);
    if (left && !right) {
      return -1;
    }
    if (right && !left) {
      return 1;
    }
    const pointer = this.#scene.input.activePointer;
    if (pointer.isDown) {
      const delta = pointer.worldX - referenceX;
      if (Math.abs(delta) > POINTER_DEADZONE_PX) {
        return Math.sign(delta);
      }
    }
    return 0;
  }

  /**
   * Free the keys this service owns. Call from the scene's shutdown handler.
   * @returns void
   */
  destroy(): void {
    this.#keyA?.destroy();
    this.#keyD?.destroy();
    // CursorKeys are owned by the keyboard plugin and freed on scene shutdown.
  }
}
