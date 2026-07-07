/**
 * Pure, Phaser-free field-HUD model (PD-3.3 / #107). The Field scene's HUD —
 * context prompts on interactables, the persistent grist readout, and the
 * summonable mini-map — is driven entirely by the total functions here so its
 * shape unit-tests headless and the scene stays a thin renderer. Three concerns:
 *
 * - **Context prompt**: given the current room and whether Wren is within an
 *   interactable's range, what prompt string (if any) the HUD shows.
 * - **Grist readout**: the always-visible wallet label string. The persistence
 *   is the scene's (it is built once and updated every frame); the *format* is a
 *   pure function so the label can never drift between surfaces.
 * - **Mini-map**: a model of the Marrow descent (room nodes A→B→C, each marked
 *   current / visited / unvisited) derived from {@link FieldState}, plus a pure
 *   open/close toggle. The mini-map is summonable (not always-on) per
 *   ui-ux-and-controls, so the open flag is its own piece of HUD state.
 *
 * No Phaser, no I/O, no randomness — the whole module typechecks under plain
 * `tsc` and is asserted by the unit suite (`tests/logic/field-hud.test.ts`).
 * @module logic/field/hud
 */
import {
  MARROW_MAP,
  MarrowRoomIds,
  type MarrowRoomId,
} from "../../content/map";
import { type FieldState } from "./types";

/** The fixed descent order of the Marrow rooms (A → B → C). */
export const MARROW_ROOM_ORDER: readonly MarrowRoomId[] = [
  MarrowRoomIds.a,
  MarrowRoomIds.b,
  MarrowRoomIds.c,
] as const;

/**
 * The visit state of one mini-map node. `current` is the room Wren is in;
 * `visited` is a room she has already passed through (earlier in the descent
 * than the current room); `unvisited` is a room still ahead. The descent is
 * strictly linear, so position in {@link MARROW_ROOM_ORDER} relative to the
 * current room fully determines this.
 */
export const RoomVisitStates = {
  current: "current",
  visited: "visited",
  unvisited: "unvisited",
} as const;

/** A mini-map node's visit state. */
export type RoomVisitState =
  (typeof RoomVisitStates)[keyof typeof RoomVisitStates];

/** One node on the mini-map: a room, its display name, and its visit state. */
export interface MiniMapNode {
  /** The room id. */
  readonly room: MarrowRoomId;
  /** The room's display name (from {@link MARROW_MAP}). */
  readonly name: string;
  /** Whether this is the current room, a visited room, or one still ahead. */
  readonly state: RoomVisitState;
  /**
   * The one-line "why is this locked" cue for a node still ahead in the linear
   * descent: it opens once the room immediately before it is cleared, so the cue
   * names that predecessor (mirrors the World Map's `regionUnlockCue` — "Locked —
   * finish <region>"). Empty for the reachable current/visited nodes. Lets the
   * summonable overlay explain a dimmed node instead of dead-airing a curious
   * player who wonders why The Drip / The Cage can't be picked (#250).
   */
  readonly lockReason: string;
}

/**
 * The mini-map model: the ordered descent nodes (A → B → C) with each marked
 * current / visited / unvisited relative to where Wren is now, and each locked
 * node carrying the cue that explains it. Pure derivation from the field state —
 * the scene renders this and holds no map geometry of its own beyond placement
 * constants.
 * @param state - The current field session state.
 * @returns The ordered mini-map nodes.
 */
export function miniMapModel(state: FieldState): readonly MiniMapNode[] {
  const currentIndex = MARROW_ROOM_ORDER.indexOf(state.currentRoom);
  return MARROW_ROOM_ORDER.map((room, index) => ({
    room,
    name: MARROW_MAP[room].name,
    state: visitStateFor(index, currentIndex),
    lockReason: roomUnlockCue(index, currentIndex),
  }));
}

/**
 * The lock cue for the node at `index` given the current room's `currentIndex`
 * in the linear descent. A room still ahead of Wren is locked until the room
 * immediately before it is cleared, so its cue names that predecessor — the same
 * "name the gate" idiom the World Map's `regionUnlockCue` uses ("Locked — finish
 * <region>"), phrased "clear" for the Marrow's per-room encounter gate. The
 * current room and rooms already passed are reachable, so their cue is empty.
 * Pure.
 * @param index - The node's index in {@link MARROW_ROOM_ORDER}.
 * @param currentIndex - The current room's index.
 * @returns The lock cue, or "" when the node is reachable.
 */
function roomUnlockCue(index: number, currentIndex: number): string {
  if (index <= currentIndex) {
    return "";
  }
  const predecessor = MARROW_ROOM_ORDER[index - 1];
  return predecessor === undefined
    ? "Locked"
    : `Locked — clear ${MARROW_MAP[predecessor].name}`;
}

/** The suffix tag that marks a locked node in the overlay list — the visible
 *  per-node lock indicator, mirroring the World Map row's "— LOCKED" status tag. */
const LOCKED_TAG = " — LOCKED";

/**
 * The overlay list label for a node: its room name, plus the "— LOCKED" tag when
 * the node is still locked (a visible per-node lock indicator, matching the World
 * Map row idiom `worldMapEntryLabel`). Pure.
 * @param node - The mini-map node.
 * @returns The display label for the overlay row.
 */
export function miniMapNodeLabel(node: MiniMapNode): string {
  return node.lockReason === "" ? node.name : `${node.name}${LOCKED_TAG}`;
}

/**
 * The single lock cue the overlay surfaces as its footer detail line: the cue of
 * the next node still ahead in the descent — the player's immediate objective —
 * or "" when nothing is locked (the final room). Mirrors the World Map, which
 * surfaces one entry's cue at a time (the focused row) rather than every locked
 * entry's at once. Pure.
 * @param nodes - The ordered mini-map nodes.
 * @returns The next lock cue, or "" when nothing is locked.
 */
export function miniMapLockCue(nodes: readonly MiniMapNode[]): string {
  return nodes.find(node => node.lockReason !== "")?.lockReason ?? "";
}

/**
 * The visit state of the node at `index` given the current room's `currentIndex`
 * in the linear descent: the current room is `current`, anything before it is
 * `visited`, anything after it is `unvisited`.
 * @param index - The node's index in {@link MARROW_ROOM_ORDER}.
 * @param currentIndex - The current room's index.
 * @returns The node's visit state.
 */
function visitStateFor(index: number, currentIndex: number): RoomVisitState {
  if (index === currentIndex) {
    return RoomVisitStates.current;
  }
  return index < currentIndex
    ? RoomVisitStates.visited
    : RoomVisitStates.unvisited;
}

/** The prompt verb shown for an in-range interactable prop. */
const EXAMINE_VERB = "examine";

/**
 * The context-prompt string the HUD shows for the current room, or `null` when
 * there is no interactable affordance to surface. A prompt is shown only when
 * the room has an examinable lore prop AND Wren is reported in range of it AND
 * the examine lore banner is not already on screen — the "context" in context
 * prompt. The last gate is the fix for #234: the floating "[E] examine <prop>"
 * prompt and the examine lore banner share the bottom band, so surfacing both at
 * once overlapped their text; once the banner shows, the prompt's job is done, so
 * it is suppressed until the banner clears (Wren steps out of range). The prop's
 * name is read from {@link MARROW_MAP} so the label always matches the authored
 * content.
 * @param room - The room Wren is currently in.
 * @param propId - The room's examinable prop id, or null when it has none.
 * @param inRange - Whether Wren is within the prop's examine radius.
 * @param loreVisible - Whether the examine lore banner is currently on screen.
 * @returns The prompt string, or null when no prompt should show.
 */
export function contextPromptFor(
  room: MarrowRoomId,
  propId: string | null,
  inRange: boolean,
  loreVisible: boolean
): string | null {
  if (propId === null || !inRange || loreVisible) {
    return null;
  }
  const prop = MARROW_MAP[room].props.find(
    candidate => candidate.id === propId
  );
  const name = prop?.name ?? propId;
  return `[E] ${EXAMINE_VERB} ${name}`;
}

/**
 * The always-visible grist readout label (e.g. `"Grist 120"`). A pure formatter
 * so the field readout, the bench readout, and any future surface can never
 * drift on wording. The scene builds the label once and re-feeds this each frame
 * through a churn-free guarded text.
 * @param grist - The shared wallet's grist balance.
 * @returns The readout label string.
 */
export function gristReadoutLabel(grist: number): string {
  return `Grist ${grist}`;
}

/**
 * The mini-map open/close toggle — a pure transition over the summon flag. The
 * mini-map is summonable, not always-on (ui-ux-and-controls): opening shows the
 * overlay, toggling again dismisses it. Kept pure so the toggle is unit-tested
 * without a scene and the scene only mirrors the resulting flag onto visibility.
 * @param open - The current open state.
 * @returns The toggled open state.
 */
export function toggleMiniMap(open: boolean): boolean {
  return !open;
}
