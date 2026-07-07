/**
 * Public surface of the pure combat-logic core. The typed foundation (elements,
 * statuses, stat / combatant shapes, battle state + action types), the
 * deterministic ATB engine (`startBattle` / `step`), the turn-order derivation,
 * the deterministic enemy-turn / decision-advance helpers (`resolveEnemyTurns` /
 * `runToNextDecision`), the determinism hash, the combat-rules layer (damage/heal
 * formula, the
 * element multiplier, Rendering DoT + loot denial, and Pressure → Break →
 * Severance), the two-resource economy (per-turn AP regen, AP-costed Craft,
 * grist-costed Bind from the shared party pool), and the terminal-outcome
 * resolution (Victory when all enemies fall, Defeat on a party wipe). Re-export
 * only — no logic lives in the barrel.
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
export {
  isDefeated,
  isResolved,
  isVictory,
  isDefeat,
  resolveOutcome,
} from "./outcome";
export { combatantAt } from "./select";
export { readyActors, nextActor, advanceToNextTurn } from "./turn-order";
export { resolveEnemyTurns, runToNextDecision, enemyIntentKind } from "./ai";
export { hashState } from "./hash";
export {
  CombatTuning,
  computeDamage,
  computeHeal,
  computeRenderingTick,
  elementMultiplier,
  guardMod,
  varianceFromRoll,
} from "./formula";
export {
  applyRendering,
  tickStatuses,
  addPressure,
  severanceAvailable,
  pressureMeter,
  lootGristFor,
  type PressureMeter,
} from "./effects";
export {
  ResourceTuning,
  regenAp,
  actionCost,
  canAfford,
  type ActionCost,
} from "./resource";
export {
  TelegraphTuning,
  enemyTelegraph,
  type EnemyTelegraph,
} from "./telegraph";
