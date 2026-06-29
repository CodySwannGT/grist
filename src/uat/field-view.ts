/**
 * The field slice of the verification (UAT) bridge. Extracted from `uat/bridge.ts`
 * so the bridge stays under its line budget and the field read surface lives next
 * to the scene it serves — the same split the bench / world-state / region /
 * dialogue cells use. Holds the field view contract the Field scene registers, the
 * read-only snapshot the field e2e asserts on, and the pure mapper between them.
 * No Phaser, no gameplay state — a thin test seam.
 * @module uat/field-view
 */
import { type VerifyResolution } from "./bridge";

/** A read-only snapshot of Wren's logical (384×216) position in the field. */
export interface VerifyFieldPosition {
  readonly x: number;
  readonly y: number;
}

/** A read-only snapshot of the running field session for assertions. */
export interface VerifyFieldState {
  readonly scene: string;
  readonly room: string;
  readonly phase: string;
  readonly wren: VerifyFieldPosition;
  /** The lore text currently surfaced by the last examine, or null. */
  readonly lore: string | null;
  /** The shared grist pool the run has accrued (consumed battle results). */
  readonly grist: number;
  /** The Bound shards acquired so far this run. */
  readonly shards: readonly string[];
  /** The shard whose free-vs-wield choice is pending, or null. */
  readonly pendingChoiceShard: string | null;
}

/**
 * The live link the Field scene registers with the bridge. Lets the field e2e
 * read the resolved integer scale (scene-agnostic — the same shape battle uses),
 * Wren's live position (to assert it changed after a move), the current room /
 * phase, and the surfaced lore beat after an examine. Kept separate from
 * {@link import("./bridge").BattleView} so neither path constrains the other; the
 * controller stores whichever is attached and the bridge dispatches by which one
 * is present.
 */
export interface FieldView {
  readonly resolution: () => VerifyResolution;
  readonly room: () => string;
  readonly phase: () => string;
  readonly wren: () => VerifyFieldPosition;
  readonly lore: () => string | null;
  /** The shared grist pool the run has accrued from consumed battle results. */
  readonly grist: () => number;
  /** The Bound shards acquired so far this run. */
  readonly shards: () => readonly string[];
  /** The shard whose free-vs-wield choice is pending, or null. */
  readonly pendingChoiceShard: () => string | null;
  /** Examine the nearest examinable prop now (the canonical "agent examined it"). */
  readonly examineNearest: () => void;
  /** Engage the current room's encounter, launching its battle. */
  readonly engage: () => void;
  /** Traverse to the next room, firing its trigger and launching the next battle. */
  readonly traverse: () => void;
}

/**
 * Map an attached {@link FieldView} to its read-only snapshot for the bridge.
 * @param scene - The active scene key.
 * @param view - The attached field view.
 * @returns The read-only field snapshot.
 */
export function toVerifyFieldState(
  scene: string,
  view: FieldView
): VerifyFieldState {
  return {
    scene,
    room: view.room(),
    phase: view.phase(),
    wren: view.wren(),
    lore: view.lore(),
    grist: view.grist(),
    shards: view.shards(),
    pendingChoiceShard: view.pendingChoiceShard(),
  };
}
