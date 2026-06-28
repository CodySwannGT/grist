/**
 * Public surface of the pure combat-logic core. The typed foundation (elements,
 * statuses, stat / combatant shapes, battle state + action types), the
 * deterministic ATB engine (`startBattle` / `step`), the turn-order derivation,
 * the determinism hash, and the combat-rules layer (damage/heal formula, the
 * element multiplier, Rendering DoT + loot denial, and Pressure → Break →
 * Severance). Re-export only — no logic lives in the barrel.
 * @module logic/combat
 */
export {
  Elements,
  Statuses,
  SpellTargets,
  BattleSides,
  ActionKinds,
  BattlePhases,
  type ElementId,
  type StatusId,
  type SpellTarget,
  type Stats,
  type CombatantStatus,
  type Combatant,
  type BattleSide,
  type CombatantRef,
  type ActionKind,
  type BattleAction,
  type BattlePhase,
  type BattleEvent,
  type BattleState,
} from "./types";
export { startBattle, step, AtbTuning } from "./engine";
export { combatantAt } from "./select";
export { readyActors, nextActor, advanceToNextTurn } from "./turn-order";
export { hashState } from "./hash";
export {
  CombatTuning,
  computeDamage,
  computeHeal,
  computeRenderingTick,
  elementMultiplier,
  varianceFromRoll,
} from "./formula";
export {
  applyRendering,
  tickStatuses,
  addPressure,
  severanceAvailable,
  lootGristFor,
} from "./effects";
