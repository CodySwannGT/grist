/**
 * Resolve content-table facts about an in-battle combatant from its `ref`. The
 * runtime {@link Combatant} carries only mutable battle state; its immutable
 * authoring data (here, the per-element weakness table) lives in `src/content`
 * and is looked up by ref. Party members have no element table, so they default
 * to neutral. Pure data lookup — no Phaser, no I/O.
 * @module logic/combat/target
 */
import { ENEMIES, type EnemyId } from "../../content";
import { type Combatant, type ElementId } from "./types";

/**
 * The per-element multiplier table for a combatant, from the enemy content
 * table — or an empty (all-neutral) table for party members and unknown refs.
 * @param combatant - The combatant whose element table to resolve.
 * @returns The element-multiplier table (possibly empty).
 */
export function targetElements(
  combatant: Combatant
): Partial<Record<ElementId, number>> {
  return ENEMIES[combatant.ref as EnemyId]?.elements ?? {};
}
