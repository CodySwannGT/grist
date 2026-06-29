/**
 * The semantic input layer for the Bench (growth) scene (#86): the single place
 * the bench's raw pointer taps are translated into **named bench intents** (equip
 * a shard, buy a grist sink) and published — device-tagged — on the EventsCenter
 * bus as {@link BenchEvents.Input}. The Bench scene subscribes to those intents;
 * no gameplay code reads pointer coordinates directly, so the scene stays a thin,
 * sim-authoritative renderer. The bench counterpart of {@link
 * import("./field-input").FieldInputService}.
 *
 * The bench is a discrete menu (no continuous input), so this service has no
 * keyboard subscription and nothing to dispose — it is a thin publisher kept
 * symmetric with the other input services so the "raw input never leaves this
 * layer" contract reads the same across scenes.
 * @module services/bench-input
 */
import { BenchEvents } from "../consts";
import { type BenchSinkId } from "../content/bench";
import { type BoundId } from "../content/bounds";
import { type BenchIntent } from "./bench-input-map";
import { eventsCenter } from "./events";
import { InputDevices, type InputDevice } from "./input-map";

/**
 * Publishes the bench's semantic intents on the EventsCenter bus. The scene's
 * interactive buttons call {@link tapEquip} / {@link tapBuySink}; the scene
 * subscribes to {@link BenchEvents.Input} and applies the matching pure reducer.
 */
export class BenchInputService {
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
   * Emit a device-tagged bench intent on the EventsCenter bus.
   * @param intent - The semantic bench intent.
   * @param device - The originating device.
   * @returns void
   */
  #emit(intent: BenchIntent, device: InputDevice): void {
    eventsCenter.emit(BenchEvents.Input, intent, device);
  }
}
