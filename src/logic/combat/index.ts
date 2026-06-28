/**
 * Public surface of the pure combat-logic core. The typed foundation (elements,
 * statuses, stat / combatant shapes, battle state + action types), the
 * deterministic ATB engine (`startBattle` / `step`), the turn-order derivation,
 * and the determinism hash. Re-export only — no logic lives in the barrel.
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
export { startBattle, step, combatantAt, AtbTuning } from "./engine";
export { readyActors, nextActor, advanceToNextTurn } from "./turn-order";
export { hashState } from "./hash";
