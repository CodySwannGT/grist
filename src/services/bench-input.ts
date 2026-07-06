/**
 * The semantic input layer for the Bench (growth) scene (#86): the single place
 * the bench's raw pointer taps and Back keypress are translated into **named bench
 * intents** (equip a shard, buy a grist sink, back out) and published — device-
 * tagged — on the EventsCenter bus as {@link BenchEvents.Input}. The Bench scene
 * subscribes to those intents; no gameplay code reads pointer coordinates or key
 * codes directly, so the scene stays a thin, sim-authoritative renderer. The bench
 * counterpart of {@link import("./field-input").FieldInputService}.
 *
 * The bench's growth actions are discrete pointer taps (no continuous input), so
 * those need no keyboard subscription. The exit is the one keyboard binding (#239):
 * the service owns a Back-key listener (Esc / Q → a `back` intent), symmetric with
 * the field/menu Cancel verb, freed via {@link dispose} on scene shutdown.
 * @module services/bench-input
 */
import Phaser from "phaser";
import { BenchEvents } from "../consts";
import { type BenchSinkId } from "../content/bench";
import { type BoundId } from "../content/bounds";
import { keyToBenchIntent, type BenchIntent } from "./bench-input-map";
import { eventsCenter } from "./events";
import { InputDevices, type InputDevice } from "./input-map";

/**
 * Publishes the bench's semantic intents on the EventsCenter bus. The scene's
 * interactive buttons call {@link tapEquip} / {@link tapBuySink} / {@link tapBack};
 * the Back key is read here and published too. The scene subscribes to
 * {@link BenchEvents.Input} and applies the matching pure reducer / transition.
 */
export class BenchInputService {
  readonly #keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  /**
   * Bind the scene's keyboard plugin so a Back key (Esc / Q) publishes a `back`
   * intent — the Bench's exit (#239). Free the listener with {@link dispose}.
   * @param scene - The Bench scene whose keyboard input to route.
   */
  constructor(scene: Phaser.Scene) {
    this.#keyboard = scene.input.keyboard;
    this.#keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.#onKeyDown
    );
  }

  /**
   * Keydown handler: a bound Back key (Esc / Q) publishes a one-shot `back` intent;
   * OS auto-repeat is ignored so a held key backs out once. A stable arrow field so
   * it can be unsubscribed by reference in {@link dispose}.
   * @param event - The native keyboard event Phaser forwards.
   * @returns void
   */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const intent = keyToBenchIntent(event.code);
    if (intent && !event.repeat) {
      this.#emit(intent, InputDevices.keyboard);
    }
  };

  /**
   * Publish an equip-shard intent (tapping the equip button).
   * @param shard - The shard to equip.
   * @returns void
   */
  tapEquip(shard: BoundId): void {
    this.#emit({ kind: "equip", shard }, InputDevices.pointer);
  }

  /**
   * Publish a buy-sink intent (tapping a grist-sink button).
   * @param sink - The bench sink to purchase.
   * @returns void
   */
  tapBuySink(sink: BenchSinkId): void {
    this.#emit({ kind: "buy-sink", sink }, InputDevices.pointer);
  }

  /**
   * Publish a back intent (tapping the on-screen Back control), so touch players —
   * who have no Esc key — get the same exit as the keyboard Back (#239).
   * @returns void
   */
  tapBack(): void {
    this.#emit({ kind: "back" }, InputDevices.pointer);
  }

  /**
   * Emit a device-tagged bench intent on the EventsCenter bus.
   * @param intent - The semantic bench intent.
   * @param device - The originating device.
   * @returns void
   */
  #emit(intent: BenchIntent, device: InputDevice): void {
    eventsCenter.emit(BenchEvents.Input, intent, device);
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
