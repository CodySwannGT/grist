/**
 * Pure, Phaser-free field-traversal primitives: the room-state, traversal-action,
 * examinable-prop, and encounter-trigger types the deterministic field sim is
 * built on. These are the typed foundation the Field scene (Phaser adapter, #81)
 * renders and the unit-test suite asserts. No Phaser, no I/O, no randomness — so
 * the whole tree typechecks under plain `tsc` and is unit-testable headless.
 * @module logic/field/types
 */
import { type EncounterId } from "../../content/encounters";
import { type MarrowRoomId } from "../../content/map";

/**
 * The phase of a field session. `exploring` is the normal state while the player
 * moves through rooms; `triggered` is set the tick an encounter fires (so the
 * Phaser adapter can launch the battle scene); `complete` is the terminal state
 * once all three rooms are resolved.
 */
export const FieldPhases = {
  exploring: "exploring",
  triggered: "triggered",
  complete: "complete",
} as const;

/** A field session phase id. */
export type FieldPhase = (typeof FieldPhases)[keyof typeof FieldPhases];

/**
 * The trigger state of one room: whether the encounter has fired, and if so
 * which encounter. `fired` starts `false` and flips to `true` exactly once per
 * room — the field sim is append-only (encounter cannot un-fire).
 */
export interface RoomTriggerState {
  /** Whether the encounter for this room has already fired. */
  readonly fired: boolean;
  /** The encounter that fired, or null if it has not yet. */
  readonly encounterId: EncounterId | null;
}

/**
 * The examinable-prop state for one prop: whether the player has examined it
 * and seen the lore beat. `examined` starts `false` and flips to `true` once.
 */
export interface PropExamineState {
  /** Whether the player has examined this prop and seen its lore beat. */
  readonly examined: boolean;
  /** The lore text shown when the prop is examined (null until first examine). */
  readonly loreText: string | null;
}

/**
 * The full state of one room during a field session: its trigger record and
 * per-prop examine state. Immutable — the reducer returns new state.
 */
export interface RoomFieldState {
  /** Whether the encounter for this room has fired. */
  readonly trigger: RoomTriggerState;
  /** Per-prop examine state, keyed by prop id. */
  readonly props: Readonly<Record<string, PropExamineState>>;
}

/**
 * The complete field session state. `currentRoom` tracks where the player is;
 * `rooms` holds per-room state; `seed` / `rngState` thread the seeded RNG so
 * the same seed + same action sequence produces the same state every time.
 * `phase` tracks the lifecycle so the adapter knows when to launch a battle.
 */
export interface FieldState {
  /** The room the player is currently in. */
  readonly currentRoom: MarrowRoomId;
  /** Per-room state, keyed by room id. */
  readonly rooms: Readonly<Record<MarrowRoomId, RoomFieldState>>;
  /** The immutable origin seed. */
  readonly seed: number;
  /** The live mulberry32 RNG state threaded through every step. */
  readonly rngState: number;
  /** The overall field session phase. */
  readonly phase: FieldPhase;
  /**
   * The encounter that just triggered, or null when no trigger is pending.
   * Set to the encounter id the tick a trigger fires; cleared back to null
   * once the adapter acknowledges the trigger (via the `acknowledge` action).
   */
  readonly pendingEncounter: EncounterId | null;
}

/**
 * The action kinds the field reducer accepts.
 *
 * - `enter` — the player enters a room (A/B/C); triggers the encounter if
 *   the room's trigger has not already fired.
 * - `traverse` — the player moves to an adjacent room (A→B or B→C); only
 *   valid when the current room's encounter has already fired (or has been
 *   acknowledged).
 * - `examine` — the player examines an examinable prop in the current room;
 *   reveals the lore beat and marks the prop examined.
 * - `acknowledge` — the adapter signals that the pending encounter has been
 *   handed off to the battle scene; clears `pendingEncounter` and marks the
 *   trigger fired on the room.
 */
export const FieldActionKinds = {
  enter: "enter",
  traverse: "traverse",
  examine: "examine",
  acknowledge: "acknowledge",
} as const;

/** A field action kind. */
export type FieldActionKind =
  (typeof FieldActionKinds)[keyof typeof FieldActionKinds];

/**
 * One command applied to the field session via the reducer.
 * - `enter` / `traverse` carry the `roomId` target.
 * - `examine` carries the `propId` to examine.
 * - `acknowledge` carries no payload — it clears the pending encounter.
 */
export interface FieldAction {
  readonly kind: FieldActionKind;
  /** Target room id (for `enter` and `traverse`). */
  readonly roomId?: MarrowRoomId;
  /** Prop id to examine (for `examine`). */
  readonly propId?: string;
}

/**
 * An event appended to the field log each time the reducer fires a trigger or
 * the player examines a prop. Append-only — the log is the observable trail
 * the determinism check and the verification (UAT) suite read.
 */
export interface FieldEvent {
  /** The kind of event. */
  readonly kind: "triggered" | "examined" | "traversed" | "entered";
  /** The room this event fired in. */
  readonly roomId: MarrowRoomId;
  /** The encounter id (only for `triggered` events). */
  readonly encounterId?: EncounterId;
  /** The prop id (only for `examined` events). */
  readonly propId?: string;
}
