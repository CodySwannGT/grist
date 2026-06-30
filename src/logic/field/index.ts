/**
 * Public surface of the pure field-traversal + encounter-trigger logic. The
 * typed foundation (field phases, room/trigger/prop/session state, action
 * kinds), the deterministic session engine (`startField` / `stepField`), and
 * the pure selectors (`encounterForRoom` / `loreForProp` / `canTraverse`). The
 * Phaser Field scene (sub-task #81) imports from here and is a thin adapter —
 * no Phaser import ever touches this module. Re-export only — no logic lives
 * in the barrel.
 * @module logic/field
 */
export {
  FieldPhases,
  FieldActionKinds,
  type FieldPhase,
  type FieldActionKind,
  type RoomTriggerState,
  type PropExamineState,
  type RoomFieldState,
  type FieldState,
  type FieldAction,
  type FieldEvent,
} from "./types";
export {
  startField,
  stepField,
  beginDescent,
  advanceAfterBattle,
  traverseToNext,
  pendingLaunch,
  encounterForRoom,
  examinablePropForRoom,
  loreForProp,
  canTraverse,
} from "./engine";
export {
  MARROW_ROOM_ORDER,
  RoomVisitStates,
  type RoomVisitState,
  type MiniMapNode,
  miniMapModel,
  contextPromptFor,
  gristReadoutLabel,
  toggleMiniMap,
} from "./hud";
