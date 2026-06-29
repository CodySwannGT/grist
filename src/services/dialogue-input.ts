/**
 * The semantic input layer for the Dialogue scene (sub-task #104): the single
 * place raw keyboard input is read, translated into **named dialogue intents**
 * (advance / skip / choose-the-Nth-branch) via the pure
 * {@link keyToDialogueIntent} map, and published — device-tagged — on the
 * EventsCenter bus as {@link DialogueEvents.Intent}. The Dialogue scene subscribes
 * to those intents; no gameplay code reads `event.code` directly, so adding
 * devices or remapping keys stays a change in this one module plus its pure map
 * ("actions, not raw keys"). This is the dialogue counterpart of
 * {@link import("./field-input").FieldInputService}.
 *
 * Dialogue intents are all discrete (one-shot keydown), so — unlike the field
 * layer's continuous held-move tracking — this service holds no state: it maps
 * each non-repeat keydown to an intent and emits it. The pointer path (clicking a
 * branch button) is published by the scene through {@link tapChoose}, so a tapped
 * choice and a number-key choice flow through the same bus intent.
 * @module services/dialogue-input
 */
import Phaser from "phaser";
import { DialogueEvents } from "../consts";
import { eventsCenter } from "./events";
import { keyToDialogueIntent, type DialogueIntent } from "./dialogue-input-map";
import { InputDevices, type InputDevice } from "./input-map";

/**
 * Owns the live keyboard subscription for the Dialogue scene. Each bound keydown
 * is mapped to a discrete {@link DialogueIntent} and emitted on the bus; the
 * pointer path is published via {@link tapChoose}. Free the keyboard listener with
 * {@link dispose} on shutdown (the `require-shutdown-cleanup` contract).
 */
export class DialogueInputService {
  readonly #keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  /**
   * Bind the scene's keyboard plugin: a bound, non-repeat keydown publishes a
   * one-shot dialogue intent.
   * @param scene - The Dialogue scene whose keyboard input to route.
   */
  constructor(scene: Phaser.Scene) {
    this.#keyboard = scene.input.keyboard;
    this.#keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKeyDown
    );
  }

  /**
   * Keydown handler: map the physical key to a dialogue intent and publish it,
   * ignoring OS auto-repeat so a held key fires once. A stable arrow field so it
   * can be unsubscribed by reference in {@link dispose}.
   * @param event - The native keyboard event Phaser forwards.
   * @returns void
   */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }
    const intent = keyToDialogueIntent(event.code);
    if (intent) {
      this.#emit(intent, InputDevices.keyboard);
    }
  };

  /**
   * Publish a touch/pointer branch selection (tapping a choice button). The scene
   * calls this with the tapped choice's index; it flows through the same bus
   * intent a number-key press does, so no raw pointer leaks past this layer.
   * @param index - The zero-based index of the tapped choice.
   * @returns void
   */
  tapChoose(index: number): void {
    this.#emit({ kind: "choose", index }, InputDevices.pointer);
  }

  /**
   * Publish a touch/pointer advance (tapping the caption box to continue).
   * @returns void
   */
  tapAdvance(): void {
    this.#emit({ kind: "advance" }, InputDevices.pointer);
  }

  /**
   * Emit a device-tagged dialogue intent on the EventsCenter bus.
   * @param intent - The semantic dialogue intent.
   * @param device - The originating device.
   * @returns void
   */
  #emit(intent: DialogueIntent, device: InputDevice): void {
    eventsCenter.emit(DialogueEvents.Intent, intent, device);
  }

  /**
   * Free the keyboard subscription. Call from the owning scene's shutdown.
   * @returns void
   */
  dispose(): void {
    this.#keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKeyDown
    );
  }
}
