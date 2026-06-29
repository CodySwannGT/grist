/**
 * The pure intent vocabulary for the growth/bench screen (#86). The Bench scene's
 * interactive buttons feed the semantic {@link import("./bench-input")
 * .BenchInputService}, which publishes these named intents on the EventsCenter
 * bus; the Bench scene subscribes and threads each through the pure run-state
 * reducers. No gameplay code reads a raw pointer — only these intents cross the
 * boundary ("actions, not raw keys/pointers", the bench counterpart of
 * {@link import("./field-input-map").FieldIntent}). Pure data — no Phaser.
 * @module services/bench-input-map
 */
import { type BenchSinkId } from "../content/bench";
import { type BoundId } from "../content/bounds";

/**
 * A semantic bench action the player requested at the growth screen: equip a
 * shard (begins its learning) or buy a grist sink (changes the build). Each is a
 * discrete, one-shot intent — there is no continuous bench input.
 */
export type BenchIntent =
  | { readonly kind: "equip"; readonly shard: BoundId }
  | { readonly kind: "buy-sink"; readonly sink: BenchSinkId };
