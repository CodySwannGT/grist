/**
 * The deterministic field traversal + encounter-trigger engine: build a field
 * session ({@link startField}) and advance it with a pure reducer ({@link stepField}).
 * The engine owns room entry, A→B→C traversal, per-room encounter-trigger rules,
 * and examinable-prop state. It mutates nothing and reads nothing ambient — no
 * Phaser, no `Math.random` / `Date.now` / `performance.now` — so the same
 * `(state, action)` always produces the same next state.
 * @module logic/field/engine
 */
import { ENCOUNTERS } from "../../content/encounters";
import {
  MARROW_MAP,
  MarrowRoomIds,
  type MarrowRoomId,
} from "../../content/map";
import { rngStep } from "../rng";
import {
  FieldActionKinds,
  FieldPhases,
  type FieldAction,
  type FieldState,
  type PropExamineState,
  type RoomFieldState,
  type RoomTriggerState,
} from "./types";

// ---------------------------------------------------------------------------
// Lore beats for examinable props (the rendering notice in Room A).
// The Field scene renders these; the field logic only holds the text so the
// scene stays a thin adapter with no authored copy.
// ---------------------------------------------------------------------------

/**
 * Authored lore beats keyed by prop id. Only props listed here are examinable
 * in the field logic sense — the Field scene may decorate others with visual
 * affordances but the sim will ignore examine actions for non-lore props.
 */
const LORE_BEATS: Readonly<Record<string, string>> = {
  "warren-sign":
    'A faded placard reads: "Warren St. — RENDERING IN PROGRESS. ' +
    "All residents must evacuate by order of the Civic Authority. " +
    'Compliance ensures continued Binding access." The ink has long since run.',
};

// ---------------------------------------------------------------------------
// Ordered room progression (A → B → C). Used to validate traverse targets
// and to determine when the slice is complete.
// ---------------------------------------------------------------------------

const ROOM_ORDER: readonly MarrowRoomId[] = [
  MarrowRoomIds.a,
  MarrowRoomIds.b,
  MarrowRoomIds.c,
];

/**
 * Return the room immediately after `roomId` in the A→B→C progression,
 * or `null` if `roomId` is the final room.
 * @param roomId - The current room.
 * @returns The next room id, or null.
 */
function nextRoom(roomId: MarrowRoomId): MarrowRoomId | null {
  const idx = ROOM_ORDER.indexOf(roomId);
  return idx < 0 || idx >= ROOM_ORDER.length - 1 ? null : ROOM_ORDER[idx + 1]!;
}

// ---------------------------------------------------------------------------
// Initial state builders
// ---------------------------------------------------------------------------

/**
 * Build the initial {@link RoomTriggerState} for a room: not yet fired.
 * @returns The unfired trigger state.
 */
function buildTriggerState(): RoomTriggerState {
  return { fired: false, encounterId: null };
}

/**
 * Build the initial {@link PropExamineState} for a prop: not yet examined.
 * @returns The unexamined prop state.
 */
function buildPropState(): PropExamineState {
  return { examined: false, loreText: null };
}

/**
 * Build the initial {@link RoomFieldState} for one room: unfired trigger,
 * unexamined props.
 * @param roomId - The room to build state for.
 * @returns The initial room field state.
 */
function buildRoomState(roomId: MarrowRoomId): RoomFieldState {
  const room = MARROW_MAP[roomId];
  const props = Object.fromEntries(
    room.props.map(prop => [prop.id, buildPropState()])
  ) as Record<string, PropExamineState>;
  return { trigger: buildTriggerState(), props };
}

/**
 * Build the initial {@link FieldState} for a full field session from a numeric
 * seed. The player starts in Room A; all rooms begin unexplored. The seed
 * initializes the threaded RNG (matching `rngStep`), so the session is
 * reproducible. Pure — returns fresh state and reads nothing ambient.
 * @param seed - The 32-bit field seed.
 * @returns The initial field state.
 */
export function startField(seed: number): FieldState {
  const rooms: Record<MarrowRoomId, RoomFieldState> = {
    [MarrowRoomIds.a]: buildRoomState(MarrowRoomIds.a),
    [MarrowRoomIds.b]: buildRoomState(MarrowRoomIds.b),
    [MarrowRoomIds.c]: buildRoomState(MarrowRoomIds.c),
  };
  return {
    currentRoom: MarrowRoomIds.a,
    rooms: rooms as Readonly<Record<MarrowRoomId, RoomFieldState>>,
    seed: seed >>> 0,
    rngState: seed >>> 0,
    phase: FieldPhases.exploring,
    pendingEncounter: null,
  };
}

// ---------------------------------------------------------------------------
// Action handlers (pure — each returns new state, mutates nothing)
// ---------------------------------------------------------------------------

/**
 * Settle into `roomId`: advance the seeded RNG one step, fire the room's
 * encounter trigger if it has not already fired, and update the phase. This is
 * the shared core both `applyEnter` (entering the current room) and
 * `applyTraverse` (stepping to the adjacent room) delegate to — neither path
 * can address an arbitrary room, so the A→B→C progression is structurally
 * enforced. Assumes the caller has already validated `roomId` and that no
 * trigger is pending.
 * @param state - The current field state.
 * @param roomId - The room to settle into (current room, or the adjacent target).
 * @returns The next field state.
 */
function settleIntoRoom(state: FieldState, roomId: MarrowRoomId): FieldState {
  const roomState = state.rooms[roomId];

  // Advance the RNG one step per room entry (preserves the seeded sequence
  // even for rooms whose trigger has already fired, so seed + movement always
  // produces the identical state regardless of trigger state).
  const { state: nextRngState } = rngStep(state.rngState);

  if (!roomState.trigger.fired) {
    // Fire the encounter trigger for this room.
    const encounterId = MARROW_MAP[roomId].encounter;
    const updatedTrigger: RoomTriggerState = {
      fired: false, // stays false until the adapter acknowledges
      encounterId,
    };
    const updatedRooms = {
      ...state.rooms,
      [roomId]: { ...roomState, trigger: updatedTrigger },
    };
    return {
      ...state,
      currentRoom: roomId,
      rooms: updatedRooms as Readonly<Record<MarrowRoomId, RoomFieldState>>,
      rngState: nextRngState,
      phase: FieldPhases.triggered,
      pendingEncounter: encounterId,
    };
  }

  // Trigger already fired — just settle in.
  return {
    ...state,
    currentRoom: roomId,
    rngState: nextRngState,
    phase: FieldPhases.exploring,
  };
}

/**
 * Handle an `enter` action: fire the trigger for the room the player is
 * currently in. `enter` can only address the current room — it never jumps the
 * player across the map (that would skip earlier rooms and fire their
 * encounters out of order); inter-room movement is the `traverse` action's job.
 * Returns state unchanged when:
 * - `roomId` is absent or is not the current room.
 * - a trigger is already pending acknowledgment.
 * @param state - The current field state.
 * @param action - The enter action (must carry `roomId === currentRoom`).
 * @returns The next field state.
 */
function applyEnter(state: FieldState, action: FieldAction): FieldState {
  const { roomId } = action;
  // `enter` is only valid for the room the player already occupies — it fires
  // that room's trigger. Entering any other room would bypass the A→B→C
  // progression; use `traverse` to move.
  if (!roomId || roomId !== state.currentRoom) {
    return state;
  }
  // Cannot re-enter while a trigger is pending acknowledgment.
  if (state.pendingEncounter !== null) {
    return state;
  }
  return settleIntoRoom(state, roomId);
}

/**
 * Handle a `traverse` action: move the player to the next room in the A→B→C
 * sequence. Only valid when:
 * - the current room's encounter has been fired AND acknowledged (no pending).
 * - there IS a next room (C has no successor).
 * @param state - The current field state.
 * @returns The next field state.
 */
function applyTraverse(state: FieldState): FieldState {
  // Cannot traverse while a trigger is pending.
  if (state.pendingEncounter !== null) {
    return state;
  }
  // Current room's trigger must have been acknowledged (fired = true) before
  // the player can move on.
  const currentRoomState = state.rooms[state.currentRoom];
  if (!currentRoomState.trigger.fired) {
    return state;
  }

  const target = nextRoom(state.currentRoom);
  if (!target) {
    // Already in the final room — mark complete if all triggers fired.
    const allFired = ROOM_ORDER.every(id => state.rooms[id].trigger.fired);
    if (allFired) {
      return { ...state, phase: FieldPhases.complete };
    }
    return state;
  }

  // Step to the adjacent room, firing its trigger. Only the next room in the
  // ordered progression is reachable, so traversal can never skip a room.
  return settleIntoRoom(state, target);
}

/**
 * Handle an `examine` action: reveal the lore beat for the specified prop in
 * the current room, if the prop is interactable and has an authored lore beat.
 * Returns state unchanged when:
 * - `propId` is absent or not a prop in the current room.
 * - the prop has already been examined.
 * - the prop has no authored lore beat.
 * @param state - The current field state.
 * @param action - The examine action (must carry `propId`).
 * @returns The next field state.
 */
function applyExamine(state: FieldState, action: FieldAction): FieldState {
  const { propId } = action;
  if (!propId) {
    return state;
  }

  const roomState = state.rooms[state.currentRoom];
  const propState = roomState.props[propId];
  if (!propState || propState.examined) {
    return state;
  }

  const loreText = LORE_BEATS[propId] ?? null;
  if (!loreText) {
    // No authored lore — not an examinable prop in the logic sense.
    return state;
  }

  const updatedProps = {
    ...roomState.props,
    [propId]: { examined: true, loreText },
  };
  const updatedRooms = {
    ...state.rooms,
    [state.currentRoom]: { ...roomState, props: updatedProps },
  };
  return {
    ...state,
    rooms: updatedRooms as Readonly<Record<MarrowRoomId, RoomFieldState>>,
  };
}

/**
 * Handle an `acknowledge` action: the Phaser adapter has handed the pending
 * encounter off to the battle scene. Clear `pendingEncounter`, mark the room's
 * trigger as fired (so the player can traverse to the next room), and return to
 * the `exploring` phase. If there is no pending encounter, returns state unchanged.
 * If the acknowledged room is the final room and all triggers are now fired, the
 * session moves to `complete`.
 * @param state - The current field state.
 * @returns The next field state.
 */
function applyAcknowledge(state: FieldState): FieldState {
  if (state.pendingEncounter === null) {
    return state;
  }

  const roomId = state.currentRoom;
  const roomState = state.rooms[roomId];
  const updatedTrigger: RoomTriggerState = {
    fired: true,
    encounterId: roomState.trigger.encounterId,
  };
  const updatedRooms = {
    ...state.rooms,
    [roomId]: { ...roomState, trigger: updatedTrigger },
  };
  const nextRooms = updatedRooms as Readonly<
    Record<MarrowRoomId, RoomFieldState>
  >;

  const allFired = ROOM_ORDER.every(id => nextRooms[id].trigger.fired);
  const phase = allFired ? FieldPhases.complete : FieldPhases.exploring;

  return {
    ...state,
    rooms: nextRooms,
    phase,
    pendingEncounter: null,
  };
}

// ---------------------------------------------------------------------------
// Public reducer
// ---------------------------------------------------------------------------

/**
 * The pure field reducer: apply one {@link FieldAction} and return the next
 * {@link FieldState}, mutating nothing and reading nothing ambient. The same
 * `(state, action)` always produces the same next state — the sim reads no
 * `Math.random` / `Date.now` / `performance.now` and carries the seeded RNG
 * as an explicit state field.
 *
 * A session in the `complete` phase is terminal: every further action is
 * rejected and the state returned unchanged, so the outcome is stable.
 * @param state - The current field state (never mutated).
 * @param action - The action to apply.
 * @returns The next field state.
 */
export function stepField(state: FieldState, action: FieldAction): FieldState {
  if (state.phase === FieldPhases.complete) {
    return state;
  }
  switch (action.kind) {
    case FieldActionKinds.enter:
      return applyEnter(state, action);
    case FieldActionKinds.traverse:
      return applyTraverse(state);
    case FieldActionKinds.examine:
      return applyExamine(state, action);
    case FieldActionKinds.acknowledge:
      return applyAcknowledge(state);
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/**
 * Return the encounter definition that is still available to fire when the
 * player enters `roomId`, or `null` when there is nothing to fire. This is the
 * per-room encounter-trigger rule: Room A → scrapper, Room B → scrapper +
 * Vesper, Room C → the Ashling.
 *
 * Returns `null` when the room's trigger has already fired (acknowledged) AND
 * also when an encounter for that room is currently pending acknowledgment —
 * during the `triggered` phase the encounter is in flight, not "available", so
 * an adapter using this selector as an availability check sees no false
 * positive between `enter` and `acknowledge`. Pure selector — reads nothing
 * ambient.
 * @param state - The current field state.
 * @param roomId - The room to check.
 * @returns The encounter def, or null when already fired or in flight.
 */
export function encounterForRoom(
  state: FieldState,
  roomId: MarrowRoomId
): (typeof ENCOUNTERS)[keyof typeof ENCOUNTERS] | null {
  const roomState = state.rooms[roomId];
  if (roomState.trigger.fired) {
    return null;
  }
  // An encounter already in flight for this room (entered, not yet
  // acknowledged) is not "available" to fire again.
  if (state.pendingEncounter !== null && state.currentRoom === roomId) {
    return null;
  }
  const encounterId = MARROW_MAP[roomId].encounter;
  return ENCOUNTERS[encounterId];
}

/**
 * Return the lore text for `propId` in the current room if the prop has been
 * examined, or `null` otherwise. Pure selector — reads nothing ambient.
 * @param state - The current field state.
 * @param propId - The prop id to look up.
 * @returns The lore text string, or null.
 */
export function loreForProp(state: FieldState, propId: string): string | null {
  const roomState = state.rooms[state.currentRoom];
  return roomState.props[propId]?.loreText ?? null;
}

/**
 * Whether the player can traverse from the current room to the next (A→B or
 * B→C): requires the current room's encounter to be acknowledged (fired = true)
 * and no encounter pending acknowledgment.
 * @param state - The current field state.
 * @returns True when traversal to the next room is permitted.
 */
export function canTraverse(state: FieldState): boolean {
  if (state.pendingEncounter !== null) {
    return false;
  }
  const currentRoomState = state.rooms[state.currentRoom];
  return currentRoomState.trigger.fired && nextRoom(state.currentRoom) !== null;
}
