/**
 * The semantic input layer for the Field scene: the single place raw keyboard
 * and pointer/touch input is read, translated into **named field intents**
 * (directional MOVE while a key is held, EXAMINE, and a touch-only tap-to-move
 * destination), and published — device-tagged — on the EventsCenter bus as
 * {@link FieldEvents.Input}. The Field scene subscribes to those intents; no
 * gameplay code reads `event.key` or pointer coordinates directly, so adding
 * devices or remapping keys stays a change in this one module plus its pure
 * {@link import("./field-input-map").keyToFieldIntent} map ("actions, not raw
 * keys"). This is the field counterpart of {@link import("./input").InputService}.
 *
 * Unlike the battle layer (discrete keydown intents), field movement is
 * continuous: the service tracks which movement keys are currently held and, each
 * time the scene asks (via {@link heldDirection}), reports the resolved unit
 * vector. Discrete keys (examine) and pointer taps are still published as
 * one-shot intents on the bus.
 * @module services/field-input
 */
import Phaser from "phaser";
import { FieldEvents } from "../consts";
import { eventsCenter } from "./events";
import {
  keyToFieldIntent,
  type FieldIntent,
  type FieldMoveDir,
} from "./field-input-map";
import { InputDevices, type InputDevice } from "./input-map";

/** The resolved net held-move vector (not normalized; the scene scales by delta). */
const NO_MOVE: FieldMoveDir = { dx: 0, dy: 0 };

/**
 * Owns the live keyboard subscription for the Field scene plus the pointer entry
 * point the scene's floor calls. Movement keys held down are tracked so the scene
 * can poll the net direction each frame (delta-driven); discrete intents (examine)
 * and pointer taps are emitted on the bus as one-shot {@link FieldIntent}s. Free
 * the keyboard listeners with {@link dispose} on shutdown.
 */
export class FieldInputService {
  readonly #keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;
  /** Physical codes of the movement keys currently held (for continuous walk). */
  readonly #heldMoveCodes = new Set<string>();

  /**
   * Bind the scene's keyboard plugin: keydown updates the held-move set and emits
   * discrete intents; keyup clears the held-move set.
   * @param scene - The Field scene whose keyboard input to route.
   */
  constructor(scene: Phaser.Scene) {
    this.#keyboard = scene.input.keyboard;
    this.#keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKeyDown
    );
    this.#keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_UP, this.#onKeyUp);
  }

  /**
   * Keydown handler: a held movement key joins the held-move set (so the scene
   * walks while it is down); a discrete intent (examine) is published once. A
   * stable arrow field so it can be unsubscribed by reference in {@link dispose}.
   * @param event - The native keyboard event Phaser forwards.
   * @returns void
   */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const intent = keyToFieldIntent(event.code);
    if (!intent) {
      return;
    }
    if (intent.kind === "move") {
      // Track the held movement key; the scene polls heldDirection() per frame.
      this.#heldMoveCodes.add(event.code);
      return;
    }
    // Examine is one-shot; ignore OS auto-repeat so a held key fires once.
    if (!event.repeat) {
      this.#emit(intent, InputDevices.keyboard);
    }
  };

  /**
   * Keyup handler: release a held movement key. A stable arrow field so it can be
   * unsubscribed by reference in {@link dispose}.
   * @param event - The native keyboard event Phaser forwards.
   * @returns void
   */
  readonly #onKeyUp = (event: KeyboardEvent): void => {
    this.#heldMoveCodes.delete(event.code);
  };

  /**
   * The net unit direction of all currently-held movement keys (opposing keys
   * cancel). The Field scene multiplies this by the frame delta and the move
   * speed, so movement is delta-driven and deterministic. `{0,0}` when no
   * movement key is held.
   * @returns The net held-move direction.
   */
  heldDirection(): FieldMoveDir {
    const net = [...this.#heldMoveCodes].reduce(
      (acc, code) => {
        const intent = keyToFieldIntent(code);
        return intent?.kind === "move"
          ? { dx: acc.dx + intent.dir.dx, dy: acc.dy + intent.dir.dy }
          : acc;
      },
      { dx: 0, dy: 0 }
    );
    if (net.dx === 0 && net.dy === 0) {
      return NO_MOVE;
    }
    return {
      dx: Math.sign(net.dx) as -1 | 0 | 1,
      dy: Math.sign(net.dy) as -1 | 0 | 1,
    };
  }

  /**
   * Publish a touch/pointer move-to destination (tapping the floor). The scene
   * walks Wren toward the logical point; the coordinates are already mapped to
   * logical (384×216) space by the caller, so no raw pointer math leaks past this
   * layer. Emitted on the bus as a device-tagged pointer intent.
   * @param x - The logical destination X.
   * @param y - The logical destination Y.
   * @returns void
   */
  tapMoveTo(x: number, y: number): void {
    this.#emit({ kind: "move-to", x, y }, InputDevices.pointer);
  }

  /**
   * Publish a touch/pointer examine (tapping a prop).
   * @returns void
   */
  tapExamine(): void {
    this.#emit({ kind: "examine" }, InputDevices.pointer);
  }

  /**
   * Emit a device-tagged field intent on the EventsCenter bus.
   * @param intent - The semantic field intent.
   * @param device - The originating device.
   * @returns void
   */
  #emit(intent: FieldIntent, device: InputDevice): void {
    eventsCenter.emit(FieldEvents.Input, intent, device);
  }

  /**
   * Free the keyboard subscriptions. Call from the owning scene's shutdown.
   * @returns void
   */
  dispose(): void {
    this.#keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKeyDown
    );
    this.#keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_UP, this.#onKeyUp);
    this.#heldMoveCodes.clear();
  }
}
