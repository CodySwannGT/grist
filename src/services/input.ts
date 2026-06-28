/**
 * The semantic input layer (ui-ux-and-controls "Controls"): the single place raw
 * keyboard and pointer/touch input is read, translated into **named battle
 * intents** (navigate, cycle target, confirm, cancel, toggle speed, and the
 * touch-only direct selections), and published — device-tagged — on the
 * EventsCenter bus as {@link BattleEvents.Input}. The HUD controller subscribes
 * to those intents; no gameplay code reads `event.key` or pointer coordinates
 * directly, so adding devices or remapping keys stays a change in this one module
 * plus its pure {@link import("./input-map").keyToIntent} map ("actions, not raw
 * keys"). This module wires that map to a scene's keyboard plugin and exposes
 * pointer entry points for the HUD's interactive objects.
 * @module services/input
 */
import Phaser from "phaser";
import { BattleEvents } from "../consts";
import { eventsCenter } from "./events";
import {
  InputDevices,
  keyToIntent,
  TOGGLE_SPEED,
  type InputDevice,
  type InputIntent,
} from "./input-map";

/**
 * Owns the live keyboard subscription for one battle scene and the pointer entry
 * points the HUD's interactive objects call. Every input it observes is emitted
 * as a device-tagged {@link InputIntent} on the bus; nothing else in the game
 * touches raw input. Free the keyboard listener with {@link dispose} on shutdown.
 */
export class InputService {
  readonly #keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  /**
   * Bind the scene's keyboard plugin so every keydown becomes a semantic intent.
   * @param scene - The battle scene whose keyboard input to route.
   */
  constructor(scene: Phaser.Scene) {
    this.#keyboard = scene.input.keyboard;
    this.#keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.#onKey);
  }

  /**
   * Keyboard handler: map the physical key to an intent and publish it. A stable
   * arrow field so it can be unsubscribed by reference in {@link dispose}.
   * @param event - The native keyboard event Phaser forwards.
   * @returns void
   */
  readonly #onKey = (event: KeyboardEvent): void => {
    // Ignore OS auto-repeat so a held key never fires an intent more than once.
    if (event.repeat) {
      return;
    }
    const intent = keyToIntent(event.code);
    if (intent) {
      this.#emit(intent, InputDevices.keyboard);
    }
  };

  /**
   * Publish a touch/pointer command selection (tapping a command button). The id
   * travels as a plain string so this layer stays free of the UI command catalog;
   * the HUD controller validates it.
   * @param command - The tapped command id.
   * @returns void
   */
  tapCommand(command: string): void {
    this.#emit({ kind: "select-command", command }, InputDevices.pointer);
  }

  /**
   * Publish a touch/pointer target selection (tapping an enemy).
   * @param index - The tapped enemy's index.
   * @returns void
   */
  tapTarget(index: number): void {
    this.#emit({ kind: "select-target", index }, InputDevices.pointer);
  }

  /**
   * Publish a touch/pointer battle-speed toggle (tapping the speed widget).
   * @returns void
   */
  tapToggleSpeed(): void {
    this.#emit(TOGGLE_SPEED, InputDevices.pointer);
  }

  /**
   * Emit a device-tagged intent on the EventsCenter bus.
   * @param intent - The semantic intent.
   * @param device - The originating device.
   * @returns void
   */
  #emit(intent: InputIntent, device: InputDevice): void {
    eventsCenter.emit(BattleEvents.Input, intent, device);
  }

  /**
   * Free the keyboard subscription. Call from the owning scene's shutdown.
   * @returns void
   */
  dispose(): void {
    this.#keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.#onKey);
  }
}
