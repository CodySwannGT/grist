/**
 * The app-wide event bus (EventsCenter). A single dedicated emitter for
 * cross-cutting game events — NEVER reuse `game.events`, which collides with
 * Phaser internals. Scenes publish typed events from `GameEvents`; UI/HUD/audio
 * subscribe. Every `.on()` a subscriber adds must have a matching `.off()` on
 * scene shutdown.
 * @module services/events
 */
import Phaser from "phaser";

/** The single shared event bus for app-level game events. */
export const eventsCenter = new Phaser.Events.EventEmitter();
