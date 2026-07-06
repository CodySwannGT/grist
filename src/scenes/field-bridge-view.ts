/**
 * Factory for the Field scene's verification (UAT) {@link FieldView}. Extracted
 * from `scenes/Field.ts` so the scene body stays under its line budget and a thin
 * renderer — the same split the bench/dialogue/region cells use. The view is the
 * live link the Field scene registers with the bridge: it reads the scene's
 * render scale, room/phase, Wren's position, surfaced lore, run-state (grist /
 * shards / pending choice), the field-HUD context prompt + mini-map state, and
 * drives the deterministic examine / engage / traverse / toggle-map actions.
 *
 * The scene passes a small accessor object rather than its private fields, so the
 * factory needs no knowledge of the scene's internals beyond this contract. No
 * gameplay rules live here — every entry delegates to the accessors the scene
 * supplies.
 * @module scenes/field-bridge-view
 */
import type Phaser from "phaser";
import { type FieldState, loreForProp } from "../logic/field";
import { contextPromptFor } from "../logic/field";
import { type FieldView } from "../uat/bridge";

/**
 * The seam the Field scene exposes to its bridge view: live reads of the session
 * + run state and the field-HUD, plus the deterministic verification actions
 * (examine / engage / traverse / toggle-map). The scene owns the mutations; the
 * factory only wires them to the bridge contract.
 */
interface FieldViewAccessors {
  /** The owning scene (for its ScaleManager resolution). */
  readonly scene: Phaser.Scene;
  /** The live field session state. */
  readonly state: () => FieldState;
  /** Wren's live logical position. */
  readonly wren: () => { readonly x: number; readonly y: number };
  /** The current room's examinable prop id, or null. */
  readonly examinableProp: () => string | null;
  /** Whether Wren is within the current prop's examine radius. */
  readonly inExamineRange: () => boolean;
  /** The shared wallet's grist balance. */
  readonly grist: () => number;
  /** The Bound shards acquired this run. */
  readonly shards: () => readonly string[];
  /** The shard whose free-vs-wield choice is pending, or null. */
  readonly pendingChoiceShard: () => string | null;
  /** Whether the summonable mini-map overlay is open. */
  readonly miniMapOpen: () => boolean;
  /** Summon or dismiss the mini-map overlay. */
  readonly toggleMiniMap: () => void;
  /** Deterministically examine the nearest examinable prop. */
  readonly examineNearest: () => void;
  /** Fire the current room's encounter, launching its battle. */
  readonly engage: () => void;
  /** Advance to the next room, firing its trigger and launching its battle. */
  readonly traverse: () => void;
}

/**
 * Build the {@link FieldView} the Field scene hands to the verification bridge
 * from the scene's accessor seam.
 * @param accessors - The scene's live-state reads and verification actions.
 * @returns The field view.
 */
export function makeFieldView(accessors: FieldViewAccessors): FieldView {
  return {
    resolution: () => {
      const { gameSize, displaySize } = accessors.scene.scale;
      return {
        width: gameSize.width,
        height: gameSize.height,
        zoom: displaySize.width / gameSize.width,
      };
    },
    room: () => accessors.state().currentRoom,
    phase: () => accessors.state().phase,
    wren: () => accessors.wren(),
    lore: () => loreOnScreen(accessors),
    grist: () => accessors.grist(),
    shards: () => accessors.shards(),
    pendingChoiceShard: () => accessors.pendingChoiceShard(),
    contextPrompt: () =>
      contextPromptFor(
        accessors.state().currentRoom,
        accessors.examinableProp(),
        accessors.inExamineRange(),
        loreOnScreen(accessors) !== null
      ),
    miniMapOpen: () => accessors.miniMapOpen(),
    toggleMiniMap: () => accessors.toggleMiniMap(),
    examineNearest: () => accessors.examineNearest(),
    engage: () => accessors.engage(),
    traverse: () => accessors.traverse(),
  };
}

/**
 * The lore text currently surfaced on the field's examine banner, or null when
 * nothing is shown. Mirrors the scene's own visibility rule (#234): the banner
 * is a "stand-at-the-prop" read, so it shows only while Wren is in examine range
 * AND the prop has an authored, examined beat — it dismisses on walk-away even
 * though the prop stays examined. Deriving it here (rather than reading the
 * banner object) keeps the bridge in lockstep with the scene without a new seam.
 * @param accessors - The scene's live-state reads.
 * @returns The on-screen lore text, or null.
 */
function loreOnScreen(accessors: FieldViewAccessors): string | null {
  const propId = accessors.examinableProp();
  if (propId === null || !accessors.inExamineRange()) {
    return null;
  }
  return loreForProp(accessors.state(), propId);
}
