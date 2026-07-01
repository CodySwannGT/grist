/**
 * The semantic input layer for the pause/main-menu scene (#113): the single place
 * the menu's raw keyboard and pointer taps are read, translated into **named menu
 * intents** (navigate / confirm / cancel, and the pointer-only select-entry), and
 * published — device-tagged — on the EventsCenter bus as {@link
 * PauseMenuEvents.Input}. The PauseMenu scene subscribes to those intents; no
 * gameplay code reads `event.code` or pointer coordinates directly, so the menu is
 * keyboard-navigable and remapping a key stays a change in this one module plus
 * its pure {@link keyToMenuIntent} map ("actions, not raw keys"). The menu
 * counterpart of {@link import("./input").InputService}.
 *
 * Free the keyboard listener with {@link dispose} on scene shutdown (the
 * `require-shutdown-cleanup` contract).
 * @module services/pause-menu-input
 */
import Phaser from "phaser";
import { PauseMenuEvents } from "../consts";
import { eventsCenter } from "./events";
import { InputDevices, type InputDevice } from "./input-map";
import { keyToMenuIntent, type MenuIntent } from "./pause-menu-input-map";

/**
 * Owns the live keyboard subscription for the PauseMenu scene and the pointer
 * entry point its interactive entry rows call. Every input it observes is emitted
 * as a device-tagged {@link MenuIntent} on the bus; nothing else in the game
 * touches raw menu input. Free the keyboard listener with {@link dispose}.
 */
export class PauseMenuInputService {
  readonly #keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  /**
   * Bind the scene's keyboard plugin so every keydown becomes a semantic menu
   * intent (navigate / confirm / cancel).
   * @param scene - The PauseMenu scene whose keyboard input to route.
   */
  constructor(scene: Phaser.Scene) {
    this.#keyboard = scene.input.keyboard;
    this.#keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.#onKey);
  }

  /**
   * Keydown handler: translate the physical code to a menu intent (ignoring OS
   * auto-repeat so a held key fires once) and publish it. A stable arrow field so
   * it can be unsubscribed by reference in {@link dispose}.
   * @param event - The native keyboard event Phaser forwards.
   * @returns void
   */
  readonly #onKey = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    const intent = keyToMenuIntent(event.code);
    if (intent) {
      this.#emit(intent, InputDevices.keyboard);
    }
  };

  /**
   * Publish a select-entry intent (tapping an entry row) — the pointer's absolute
   * selection of a menu entry by id.
   * @param entry - The tapped entry id.
   * @returns void
   */
  tapEntry(entry: string): void {
    this.#emit({ kind: "select-entry", entry }, InputDevices.pointer);
  }

  /**
   * Publish a confirm intent (tapping the highlighted entry to open it).
   * @returns void
   */
  tapConfirm(): void {
    this.#emit({ kind: "confirm" }, InputDevices.pointer);
  }

  /**
   * Emit a device-tagged menu intent on the EventsCenter bus.
   * @param intent - The semantic menu intent.
   * @param device - The originating device.
   * @returns void
   */
  #emit(intent: MenuIntent, device: InputDevice): void {
    eventsCenter.emit(PauseMenuEvents.Input, intent, device);
  }

  /**
   * Free the keyboard subscription. Call from the owning scene's shutdown.
   * @returns void
   */
  dispose(): void {
    this.#keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.#onKey);
  }
}
