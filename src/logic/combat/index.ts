/**
 * Public surface of the pure combat-logic foundation. Content tables and (later)
 * the ATB sim import the primitives from here. Re-export only — no logic lives in
 * the barrel.
 * @module logic/combat
 */
export {
  Elements,
  Statuses,
  SpellTargets,
  type ElementId,
  type StatusId,
  type SpellTarget,
  type Stats,
  type CombatantStatus,
  type Combatant,
} from "./types";
